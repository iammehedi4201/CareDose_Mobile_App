import type {
  CatalogueBrandDetailDto,
  CatalogueBrandSummaryDto,
} from '../../api/catalogue';
import {
  CatalogueSqliteDb,
  openCatalogueSqliteDatabase,
} from './open-sqlite';

export type { CatalogueSqliteDb };

interface CacheEntryRow {
  cache_key: string;
  kind: string;
  payload_json: string;
  cached_at: number;
  expires_at: number;
}

interface BrandOfflineRow {
  payload_json: string;
}

interface CacheStatsRow {
  entry_count: number;
  last_cached_at: number | null;
}

interface BrandCountRow {
  brand_count: number;
}

const MAX_CACHE_ENTRIES = 150;
const MAX_OFFLINE_BRANDS = 400;

let dbInitPromise: Promise<CatalogueSqliteDb | null> | null = null;
let testSqliteDb: CatalogueSqliteDb | null = null;

/**
 * Allows Vitest unit tests to inject a deterministic in-memory SQLite driver.
 */
export function __setCatalogueSqliteDbForTesting(
  db: CatalogueSqliteDb | null,
): void {
  testSqliteDb = db;
  dbInitPromise = null;
}

async function ensureSchema(db: CatalogueSqliteDb): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS catalogue_cache_entries (
      cache_key TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      cached_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS catalogue_brands_offline (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      generic_name TEXT,
      strength TEXT,
      dosage_form_norm TEXT,
      manufacturer TEXT,
      payload_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_catalogue_cache_updated
      ON catalogue_cache_entries(cached_at);
    CREATE INDEX IF NOT EXISTS idx_catalogue_brands_name
      ON catalogue_brands_offline(name);
  `);
}

async function openCatalogueDb(): Promise<CatalogueSqliteDb | null> {
  if (testSqliteDb) {
    await ensureSchema(testSqliteDb);
    return testSqliteDb;
  }

  try {
    const db = await openCatalogueSqliteDatabase();
    if (!db) {
      return null;
    }
    await ensureSchema(db);
    return db;
  } catch {
    return null;
  }
}

async function getDb(): Promise<CatalogueSqliteDb | null> {
  if (!dbInitPromise) {
    dbInitPromise = openCatalogueDb();
  }
  return dbInitPromise;
}

export async function readSqliteCacheEntry<T>(
  cacheKey: string,
  options: { allowStale?: boolean; nowMs?: number } = {},
): Promise<{ value: T; stale: boolean; cachedAt: number } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const row = await db.getFirstAsync<CacheEntryRow>(
      'SELECT cache_key, kind, payload_json, cached_at, expires_at FROM catalogue_cache_entries WHERE cache_key = ?',
      cacheKey,
    );
    if (!row) return null;
    const now = options.nowMs ?? Date.now();
    const isStale = now > row.expires_at;
    if (isStale && !options.allowStale) {
      return null;
    }
    const parsed = JSON.parse(row.payload_json) as T;
    return {
      value: parsed,
      stale: isStale,
      cachedAt: row.cached_at,
    };
  } catch {
    return null;
  }
}

export async function writeSqliteCacheEntry<T>(
  cacheKey: string,
  kind: string,
  value: T,
  ttlMs = 10 * 60 * 1000,
  nowMs: number = Date.now(),
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const json = JSON.stringify(value);
    const expiresAt = nowMs + ttlMs;
    await db.runAsync(
      `INSERT INTO catalogue_cache_entries (cache_key, kind, payload_json, cached_at, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         kind = excluded.kind,
         payload_json = excluded.payload_json,
         cached_at = excluded.cached_at,
         expires_at = excluded.expires_at`,
      cacheKey,
      kind,
      json,
      nowMs,
      expiresAt,
    );
    await db.runAsync(
      `DELETE FROM catalogue_cache_entries
       WHERE cache_key NOT IN (
         SELECT cache_key FROM catalogue_cache_entries
         ORDER BY cached_at DESC
         LIMIT ?
       )`,
      MAX_CACHE_ENTRIES,
    );
  } catch {
    // Cache writes are non-fatal
  }
}

/**
 * Indexes browsed catalogue brand summaries locally in SQLite for offline search & fallback.
 * Strictly stores public read-only catalogue records — never patient/personal dose records.
 */
export async function upsertOfflineBrandSummaries(
  brands: CatalogueBrandSummaryDto[],
  nowMs: number = Date.now(),
): Promise<void> {
  if (brands.length === 0) return;
  const db = await getDb();
  if (!db) return;

  try {
    for (const brand of brands) {
      await db.runAsync(
        `INSERT INTO catalogue_brands_offline (
           id, source_id, name, generic_name, strength, dosage_form_norm, manufacturer, payload_json, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           source_id = excluded.source_id,
           name = excluded.name,
           generic_name = excluded.generic_name,
           strength = excluded.strength,
           dosage_form_norm = excluded.dosage_form_norm,
           manufacturer = excluded.manufacturer,
           payload_json = excluded.payload_json,
           updated_at = excluded.updated_at`,
        brand.id,
        brand.sourceId,
        brand.name,
        brand.generic?.name ?? null,
        brand.strength ?? null,
        (brand.dosageFormNorm ?? brand.dosageForm ?? '').toLowerCase() || null,
        brand.manufacturer ?? null,
        JSON.stringify(brand),
        nowMs,
      );
    }

    await db.runAsync(
      `DELETE FROM catalogue_brands_offline
       WHERE id NOT IN (
         SELECT id FROM catalogue_brands_offline
         ORDER BY updated_at DESC
         LIMIT ?
       )`,
      MAX_OFFLINE_BRANDS,
    );
  } catch {
    // Non-fatal offline cache indexing error
  }
}

export async function searchOfflineSqliteBrands(params: {
  q?: string;
  form?: string;
  manufacturer?: string;
  genericId?: string;
  limit?: number;
}): Promise<CatalogueBrandSummaryDto[]> {
  const db = await getDb();
  if (!db) return [];

  const clauses: string[] = [];
  const binds: unknown[] = [];

  const q = params.q?.trim().toLowerCase();
  if (q) {
    const pattern = `%${q}%`;
    clauses.push(
      `(LOWER(name) LIKE ? OR LOWER(COALESCE(generic_name, '')) LIKE ? OR LOWER(COALESCE(strength, '')) LIKE ? OR LOWER(COALESCE(manufacturer, '')) LIKE ?)`,
    );
    binds.push(pattern, pattern, pattern, pattern);
  }

  const form = params.form?.trim().toLowerCase();
  if (form && form !== 'all') {
    clauses.push(`LOWER(COALESCE(dosage_form_norm, '')) LIKE ?`);
    binds.push(`%${form}%`);
  }

  const mfr = params.manufacturer?.trim().toLowerCase();
  if (mfr) {
    clauses.push(`LOWER(COALESCE(manufacturer, '')) LIKE ?`);
    binds.push(`%${mfr}%`);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(50, params.limit ?? 20));
  binds.push(params.genericId ? 100 : limit);

  try {
    const rows = await db.getAllAsync<BrandOfflineRow>(
      `SELECT payload_json FROM catalogue_brands_offline ${whereSql} ORDER BY name ASC LIMIT ?`,
      ...binds,
    );
    const items = rows
      .map((row) => {
        try {
          return JSON.parse(row.payload_json) as CatalogueBrandSummaryDto;
        } catch {
          return null;
        }
      })
      .filter((x): x is CatalogueBrandSummaryDto => x !== null);

    if (params.genericId) {
      return items
        .filter(
          (b) =>
            b.generic?.id === params.genericId ||
            b.generic?.sourceId === params.genericId,
        )
        .slice(0, limit);
    }
    return items;
  } catch {
    return [];
  }
}

export async function readOfflineSqliteBrandById(
  brandIdOrSourceId: string,
): Promise<CatalogueBrandDetailDto | CatalogueBrandSummaryDto | null> {
  const detailHit = await readSqliteCacheEntry<CatalogueBrandDetailDto>(
    `brand:${brandIdOrSourceId}`,
    { allowStale: true },
  );
  if (detailHit) {
    return detailHit.value;
  }

  const db = await getDb();
  if (!db) return null;

  try {
    const row = await db.getFirstAsync<BrandOfflineRow>(
      'SELECT payload_json FROM catalogue_brands_offline WHERE id = ? OR source_id = ? LIMIT 1',
      brandIdOrSourceId,
      brandIdOrSourceId,
    );
    if (!row) return null;
    return JSON.parse(row.payload_json) as CatalogueBrandSummaryDto;
  } catch {
    return null;
  }
}

export async function getCatalogueSqliteStats(): Promise<{
  cachedEntriesCount: number;
  cachedBrandsCount: number;
  lastUpdatedAt: string | null;
}> {
  const db = await getDb();
  if (!db) {
    return { cachedEntriesCount: 0, cachedBrandsCount: 0, lastUpdatedAt: null };
  }

  try {
    const [entryStats, brandStats] = await Promise.all([
      db.getFirstAsync<CacheStatsRow>(
        'SELECT COUNT(*) AS entry_count, MAX(cached_at) AS last_cached_at FROM catalogue_cache_entries',
      ),
      db.getFirstAsync<BrandCountRow>(
        'SELECT COUNT(*) AS brand_count FROM catalogue_brands_offline',
      ),
    ]);
    return {
      cachedEntriesCount: Number(entryStats?.entry_count ?? 0),
      cachedBrandsCount: Number(brandStats?.brand_count ?? 0),
      lastUpdatedAt:
        typeof entryStats?.last_cached_at === 'number' &&
        entryStats.last_cached_at > 0
          ? new Date(entryStats.last_cached_at).toISOString()
          : null,
    };
  } catch {
    return { cachedEntriesCount: 0, cachedBrandsCount: 0, lastUpdatedAt: null };
  }
}

export async function clearCatalogueSqliteCache(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execAsync(`
      DELETE FROM catalogue_cache_entries;
      DELETE FROM catalogue_brands_offline;
    `);
  } catch {
    // Ignore clear failures
  }
}
