import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CatalogueBrandDetailDto, CatalogueBrandSummaryDto } from '../../api/catalogue';
import {
  __setCatalogueSqliteDbForTesting,
  CatalogueSqliteDb,
  clearCatalogueSqliteCache,
  getCatalogueSqliteStats,
  readOfflineSqliteBrandById,
  readSqliteCacheEntry,
  searchOfflineSqliteBrands,
  upsertOfflineBrandSummaries,
  writeSqliteCacheEntry,
} from './catalogue-sqlite-cache';

function createFakeSqliteDb(): CatalogueSqliteDb {
  const cacheMap = new Map<
    string,
    {
      cache_key: string;
      kind: string;
      payload_json: string;
      cached_at: number;
      expires_at: number;
    }
  >();
  const brandsMap = new Map<
    string,
    {
      id: string;
      source_id: string;
      name: string;
      generic_name: string | null;
      strength: string | null;
      dosage_form_norm: string | null;
      manufacturer: string | null;
      payload_json: string;
      updated_at: number;
    }
  >();

  return {
    async execAsync(source: string) {
      if (source.includes('DELETE FROM catalogue_cache_entries')) {
        cacheMap.clear();
      }
      if (source.includes('DELETE FROM catalogue_brands_offline')) {
        brandsMap.clear();
      }
    },
    async runAsync(source: string, ...params: unknown[]) {
      if (source.includes('INSERT INTO catalogue_cache_entries')) {
        const [cache_key, kind, payload_json, cached_at, expires_at] = params as [
          string,
          string,
          string,
          number,
          number,
        ];
        cacheMap.set(cache_key, {
          cache_key,
          kind,
          payload_json,
          cached_at,
          expires_at,
        });
      } else if (source.includes('INSERT INTO catalogue_brands_offline')) {
        const [
          id,
          source_id,
          name,
          generic_name,
          strength,
          dosage_form_norm,
          manufacturer,
          payload_json,
          updated_at,
        ] = params as [
          string,
          string,
          string,
          string | null,
          string | null,
          string | null,
          string | null,
          string,
          number,
        ];
        brandsMap.set(id, {
          id,
          source_id,
          name,
          generic_name,
          strength,
          dosage_form_norm,
          manufacturer,
          payload_json,
          updated_at,
        });
      }
      return { changes: 1 };
    },
    async getFirstAsync<T>(source: string, ...params: unknown[]): Promise<T | null> {
      if (source.includes('FROM catalogue_cache_entries WHERE cache_key = ?')) {
        const row = cacheMap.get(String(params[0]));
        return (row as T) ?? null;
      }
      if (source.includes('COUNT(*) AS entry_count')) {
        const rows = Array.from(cacheMap.values());
        const last = rows.reduce<number | null>(
          (acc, r) => (acc === null || r.cached_at > acc ? r.cached_at : acc),
          null,
        );
        return { entry_count: rows.length, last_cached_at: last } as T;
      }
      if (source.includes('COUNT(*) AS brand_count')) {
        return { brand_count: brandsMap.size } as T;
      }
      if (source.includes('FROM catalogue_brands_offline WHERE id = ? OR source_id = ?')) {
        const target = String(params[0]);
        for (const b of brandsMap.values()) {
          if (b.id === target || b.source_id === target) {
            return { payload_json: b.payload_json } as T;
          }
        }
      }
      return null;
    },
    async getAllAsync<T>(source: string, ...params: unknown[]): Promise<T[]> {
      if (!source.includes('FROM catalogue_brands_offline')) return [];
      const limit = Number(params[params.length - 1] ?? 20);
      const qClause = source.includes('LOWER(name) LIKE ?');
      const formClause = source.includes("LOWER(COALESCE(dosage_form_norm, '')) LIKE ?");
      const mfrClause =
        source.includes("AND LOWER(COALESCE(manufacturer, '')) LIKE ?") ||
        source.includes("WHERE LOWER(COALESCE(manufacturer, '')) LIKE ?");

      let idx = 0;
      const qTerm = qClause
        ? String(params[idx]).replace(/%/g, '').toLowerCase()
        : null;
      if (qClause) idx += 4;
      const formTerm = formClause
        ? String(params[idx]).replace(/%/g, '').toLowerCase()
        : null;
      if (formClause) idx += 1;
      const mfrTerm = mfrClause
        ? String(params[idx]).replace(/%/g, '').toLowerCase()
        : null;

      return Array.from(brandsMap.values())
        .filter((b) => {
          if (qTerm) {
            const hay = `${b.name} ${b.generic_name ?? ''} ${b.strength ?? ''} ${b.manufacturer ?? ''}`.toLowerCase();
            if (!hay.includes(qTerm)) return false;
          }
          if (formTerm && !(b.dosage_form_norm ?? '').includes(formTerm)) {
            return false;
          }
          if (mfrTerm && !(b.manufacturer ?? '').toLowerCase().includes(mfrTerm)) {
            return false;
          }
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, limit)
        .map((b) => ({ payload_json: b.payload_json }) as T);
    },
  };
}

function makeBrand(
  overrides: Partial<CatalogueBrandSummaryDto>,
): CatalogueBrandSummaryDto {
  return {
    id: overrides.id ?? 'b-uuid-1',
    sourceId: overrides.sourceId ?? 'b-src-1',
    name: overrides.name ?? 'Napa 500 mg',
    strength: overrides.strength ?? '500 mg',
    strengthNorm: '500mg',
    dosageForm: overrides.dosageForm ?? 'Tablet',
    dosageFormNorm: overrides.dosageFormNorm ?? 'tablet',
    manufacturer: overrides.manufacturer ?? 'Beximco Pharmaceuticals Ltd.',
    category: 'allopathic',
    releaseMarker: null,
    verification: 'UNVERIFIED',
    fieldStatus: {
      generic: 'PRESENT',
      strength: 'PRESENT',
      dosageForm: 'PRESENT',
      manufacturer: 'PRESENT',
      price: 'PRESENT',
    },
    warnings: [],
    hasPriceWarning: false,
    generic: overrides.generic ?? {
      id: 'g1',
      sourceId: 'paracetamol',
      name: 'Paracetamol',
      slug: 'paracetamol',
    },
    primaryPack: null,
    primaryImageUrl: null,
    primaryImageStatus: null,
  };
}

describe('catalogue-sqlite-cache', () => {
  beforeEach(() => {
    __setCatalogueSqliteDbForTesting(createFakeSqliteDb());
  });

  afterEach(() => {
    __setCatalogueSqliteDbForTesting(null);
  });

  it('persists cache entries with TTL expiration and stale offline recovery', async () => {
    await writeSqliteCacheEntry(
      'search:?q=Napa',
      'search',
      { items: ['napa'], totalCount: 1 },
      60_000,
      1_000,
    );

    const freshHit = await readSqliteCacheEntry<{ totalCount: number }>(
      'search:?q=Napa',
      { nowMs: 10_000 },
    );
    expect(freshHit?.stale).toBe(false);
    expect(freshHit?.value.totalCount).toBe(1);

    const expiredMiss = await readSqliteCacheEntry('search:?q=Napa', {
      nowMs: 80_000,
    });
    expect(expiredMiss).toBeNull();

    const staleHit = await readSqliteCacheEntry<{ totalCount: number }>(
      'search:?q=Napa',
      { allowStale: true, nowMs: 80_000 },
    );
    expect(staleHit?.stale).toBe(true);
    expect(staleHit?.value.totalCount).toBe(1);
  });

  it('indexes browsed medicines for offline search, detail lookup, stats, and clearing', async () => {
    const napa = makeBrand({
      id: 'b-napa',
      sourceId: 'napa-500',
      name: 'Napa',
      strength: '500 mg',
      dosageForm: 'Tablet',
      dosageFormNorm: 'tablet',
      manufacturer: 'Beximco Pharma',
    });
    const seclo = makeBrand({
      id: 'b-seclo',
      sourceId: 'seclo-20',
      name: 'Seclo',
      strength: '20 mg',
      dosageForm: 'Capsule',
      dosageFormNorm: 'capsule',
      manufacturer: 'Square Pharmaceuticals',
      generic: {
        id: 'g2',
        sourceId: 'omeprazole',
        name: 'Omeprazole',
        slug: 'omeprazole',
      },
    });

    await upsertOfflineBrandSummaries([napa, seclo]);
    const stats = await getCatalogueSqliteStats();
    expect(stats.cachedBrandsCount).toBe(2);

    const searchByGeneric = await searchOfflineSqliteBrands({ q: 'omeprazole' });
    expect(searchByGeneric.map((b) => b.name)).toEqual(['Seclo']);

    const searchByForm = await searchOfflineSqliteBrands({ form: 'tablet' });
    expect(searchByForm.map((b) => b.name)).toEqual(['Napa']);

    // Detailed SQLite entry takes priority when cached
    const napaDetail: CatalogueBrandDetailDto = {
      ...napa,
      productUrl: null,
      collectedAt: null,
      packs: [],
      images: [],
      safetyNotice: 'Verify before use',
    };
    await writeSqliteCacheEntry('brand:napa-500', 'brand', napaDetail);
    const loaded = await readOfflineSqliteBrandById('napa-500');
    expect((loaded as CatalogueBrandDetailDto)?.safetyNotice).toBe('Verify before use');

    // Summary record is recovered by UUID or sourceId cleanly
    const secloFallback = await readOfflineSqliteBrandById('seclo-20');
    expect(secloFallback?.name).toBe('Seclo');

    await clearCatalogueSqliteCache();
    const afterClear = await getCatalogueSqliteStats();
    expect(afterClear.cachedBrandsCount).toBe(0);
    expect(afterClear.cachedEntriesCount).toBe(0);
  });
});
