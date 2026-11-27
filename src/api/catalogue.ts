import { apiRequest } from './config';
import {
  clearCatalogueSqliteCache,
  getCatalogueSqliteStats,
  readOfflineSqliteBrandById,
  readSqliteCacheEntry,
  searchOfflineSqliteBrands,
  upsertOfflineBrandSummaries,
  writeSqliteCacheEntry,
} from '../features/catalogue/catalogue-sqlite-cache';

export type VerificationStatusDto = 'UNVERIFIED' | 'VERIFIED' | 'NEEDS_REVIEW';
export type FieldStatusDto = 'PRESENT' | 'MISSING' | 'UNAVAILABLE' | 'INVALID';

export interface CatalogueSummaryResponse {
  sourceName: string;
  schemaVersion: string;
  generatedAt: string | null;
  importedAt: string | null;
  verificationNotice: string;
  counts: {
    generics: number;
    brands: number;
    packs: number;
    alternativeGroups: number;
    manufacturers: number;
    brandsWithImages: number;
  };
}

export interface CataloguePackDto {
  id: string;
  packQuantity: string | null;
  packUnits: number | null;
  stripUnits?: number | null;
  unitPrice: string | null;
  packPrice: string | null;
  currency: string;
  unitPriceLabel: string | null;
  priceSource: string;
  sourceUrl: string | null;
  collectedAt: string | null;
  verification: VerificationStatusDto;
  warnings: string[];
  hasPriceWarning: boolean;
}

export interface CatalogueImageDto {
  id: string;
  imageUrl: string;
  sourceName: string;
  sourcePageUrl: string | null;
  permissionStatus: string;
  matchStatus: VerificationStatusDto;
  checkedAt: string;
}

export interface CatalogueBrandSummaryDto {
  id: string;
  sourceId: string;
  name: string;
  strength: string | null;
  strengthNorm: string | null;
  dosageForm: string | null;
  dosageFormNorm: string | null;
  manufacturer: string | null;
  category: string;
  releaseMarker: string | null;
  verification: VerificationStatusDto;
  fieldStatus: {
    generic: FieldStatusDto;
    strength: FieldStatusDto;
    dosageForm: FieldStatusDto;
    manufacturer: FieldStatusDto;
    price: FieldStatusDto;
  };
  warnings: string[];
  hasPriceWarning: boolean;
  generic: {
    id: string;
    sourceId: string;
    name: string;
    slug: string | null;
  } | null;
  primaryPack: CataloguePackDto | null;
  primaryImageUrl: string | null;
  primaryImageStatus: {
    sourceName: string;
    permissionStatus: string;
    matchStatus: VerificationStatusDto;
  } | null;
}

export interface CatalogueBrandDetailDto extends CatalogueBrandSummaryDto {
  productUrl: string | null;
  collectedAt: string | null;
  packs: CataloguePackDto[];
  images: CatalogueImageDto[];
  sameGenericBrandsCount?: number;
  safetyNotice: string;
}

export interface PaginatedCatalogueResponse<T> {
  items: T[];
  totalCount: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface CatalogueGenericListItemDto {
  id: string;
  sourceId: string;
  name: string;
  slug: string | null;
  verification: VerificationStatusDto;
  brandsCount: number;
}

export interface CatalogueGenericDetailResponse {
  generic: {
    id: string;
    sourceId: string;
    name: string;
    slug: string | null;
    sourceUrl: string | null;
    collectedAt: string | null;
    verification: VerificationStatusDto;
  };
  brands: PaginatedCatalogueResponse<CatalogueBrandSummaryDto>;
  warningNotice: string;
}

export interface AlternativeGroupWithCandidatesDto {
  id: string;
  sourceGroupId: string;
  strengthNorm: string;
  dosageFormNorm: string;
  releaseMarker: string | null;
  isCombination: boolean;
  requiresReviewReasons: string[];
  generic: {
    id: string;
    sourceId: string;
    name: string;
    slug: string | null;
  };
  totalBrandsInGroup: number;
  candidateBrands: CatalogueBrandSummaryDto[];
}

export interface CatalogueBrandAlternativesResponse {
  brand: CatalogueBrandSummaryDto;
  groups: AlternativeGroupWithCandidatesDto[];
  warningNotice: string;
}

export interface AlternativeGroupSearchItemDto {
  id: string;
  sourceGroupId: string;
  strengthNorm: string;
  dosageFormNorm: string;
  releaseMarker: string | null;
  isCombination: boolean;
  requiresReviewReasons: string[];
  generic: {
    id: string;
    sourceId: string;
    name: string;
    slug: string | null;
  };
  brands: CatalogueBrandSummaryDto[];
}

export interface AlternativeGroupsSearchResponse
  extends PaginatedCatalogueResponse<AlternativeGroupSearchItemDto> {
  warningNotice: string;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && String(v).trim().length > 0,
  );
  if (entries.length === 0) {
    return '';
  }
  const search = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v).trim())}`)
    .join('&');
  return `?${search}`;
}

interface ClientCacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CLIENT_CACHE_MAX = 120;
const clientCatalogueCache = new Map<string, ClientCacheEntry<unknown>>();

function readClientCache<T>(key: string): T | undefined {
  const hit = clientCatalogueCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    clientCatalogueCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function writeClientCache<T>(key: string, value: T, ttlMs = 3 * 60 * 1000): T {
  if (clientCatalogueCache.has(key)) {
    clientCatalogueCache.delete(key);
  } else if (clientCatalogueCache.size >= CLIENT_CACHE_MAX) {
    const oldest = clientCatalogueCache.keys().next().value;
    if (oldest !== undefined) {
      clientCatalogueCache.delete(oldest);
    }
  }
  clientCatalogueCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export async function clearCatalogueClientCache(options?: {
  includeSqlite?: boolean;
}): Promise<void> {
  clientCatalogueCache.clear();
  if (options?.includeSqlite) {
    await clearCatalogueSqliteCache();
  }
}

export { getCatalogueSqliteStats };

async function cachedCatalogueGet<T>(
  cacheKey: string,
  kind: string,
  fetcher: () => Promise<T>,
  options?: {
    forceRefresh?: boolean;
    ttlMs?: number;
    sqliteTtlMs?: number;
    onResolved?: (value: T) => void | Promise<void>;
  },
): Promise<T> {
  if (!options?.forceRefresh) {
    const memCached = readClientCache<T>(cacheKey);
    if (memCached !== undefined) {
      return memCached;
    }
    const sqliteHit = await readSqliteCacheEntry<T>(cacheKey, {
      allowStale: false,
    });
    if (sqliteHit) {
      return writeClientCache(cacheKey, sqliteHit.value, options?.ttlMs);
    }
  }

  const fresh = await fetcher();
  writeClientCache(cacheKey, fresh, options?.ttlMs);
  await writeSqliteCacheEntry(
    cacheKey,
    kind,
    fresh,
    options?.sqliteTtlMs ?? 10 * 60 * 1000,
  );
  if (options?.onResolved) {
    await options.onResolved(fresh);
  }
  return fresh;
}

export function getCatalogueSummary(options?: {
  forceRefresh?: boolean;
}): Promise<CatalogueSummaryResponse> {
  return cachedCatalogueGet(
    'summary',
    'summary',
    () => apiRequest<CatalogueSummaryResponse>('/catalogue/summary'),
    {
      forceRefresh: options?.forceRefresh,
      ttlMs: 5 * 60 * 1000,
      sqliteTtlMs: 30 * 60 * 1000,
    },
  );
}

export function searchCatalogueBrands(params: {
  q?: string;
  form?: string;
  manufacturer?: string;
  genericId?: string;
  cursor?: string;
  limit?: number;
  forceRefresh?: boolean;
}): Promise<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>> {
  const { forceRefresh, ...query } = params;
  const qs = buildQueryString(query);
  return cachedCatalogueGet(
    `search:${qs}`,
    'search',
    () => apiRequest<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>>(`/catalogue/search${qs}`),
    {
      forceRefresh,
      ttlMs: 2 * 60 * 1000,
      sqliteTtlMs: 10 * 60 * 1000,
      onResolved: async (res) => {
        await upsertOfflineBrandSummaries(res.items);
      },
    },
  );
}

export async function searchCatalogueOfflineFallback(params: {
  q?: string;
  form?: string;
  manufacturer?: string;
  genericId?: string;
  cursor?: string;
  limit?: number;
}): Promise<{
  items: CatalogueBrandSummaryDto[];
  totalCount: number;
  cachedBrandsCount: number;
  source: 'sqlite' | 'none';
}> {
  const { ...query } = params;
  const qs = buildQueryString(query);
  const exactSqlite = await readSqliteCacheEntry<
    PaginatedCatalogueResponse<CatalogueBrandSummaryDto>
  >(`search:${qs}`, { allowStale: true });

  const stats = await getCatalogueSqliteStats();
  if (exactSqlite && exactSqlite.value.items.length > 0) {
    return {
      items: exactSqlite.value.items,
      totalCount: exactSqlite.value.totalCount,
      cachedBrandsCount: stats.cachedBrandsCount,
      source: 'sqlite',
    };
  }

  const offlineMatches = await searchOfflineSqliteBrands({
    q: params.q,
    form: params.form,
    manufacturer: params.manufacturer,
    genericId: params.genericId,
    limit: params.limit ?? 20,
  });
  if (offlineMatches.length > 0) {
    return {
      items: offlineMatches,
      totalCount: offlineMatches.length,
      cachedBrandsCount: stats.cachedBrandsCount,
      source: 'sqlite',
    };
  }

  return {
    items: [],
    totalCount: 0,
    cachedBrandsCount: stats.cachedBrandsCount,
    source: 'none',
  };
}

export function getCatalogueBrandDetail(
  brandId: string,
  options?: { forceRefresh?: boolean },
): Promise<CatalogueBrandDetailDto> {
  const key = `brand:${brandId}`;
  return cachedCatalogueGet(
    key,
    'brand',
    () =>
      apiRequest<CatalogueBrandDetailDto>(`/catalogue/brands/${encodeURIComponent(brandId)}`),
    {
      forceRefresh: options?.forceRefresh,
      ttlMs: 5 * 60 * 1000,
      sqliteTtlMs: 30 * 60 * 1000,
      onResolved: async (detail) => {
        await upsertOfflineBrandSummaries([detail]);
      },
    },
  );
}

export async function getOfflineCachedBrandDetail(
  brandId: string,
): Promise<CatalogueBrandDetailDto | CatalogueBrandSummaryDto | null> {
  return readOfflineSqliteBrandById(brandId);
}

export function getCatalogueBrandAlternatives(
  brandId: string,
  options?: { forceRefresh?: boolean },
): Promise<CatalogueBrandAlternativesResponse> {
  const key = `brand-alts:${brandId}`;
  return cachedCatalogueGet(
    key,
    'brand-alts',
    () =>
      apiRequest<CatalogueBrandAlternativesResponse>(
        `/catalogue/brands/${encodeURIComponent(brandId)}/alternatives`,
      ),
    {
      forceRefresh: options?.forceRefresh,
      ttlMs: 5 * 60 * 1000,
      sqliteTtlMs: 30 * 60 * 1000,
      onResolved: async (altRes) => {
        const candidates = altRes.groups.flatMap((g) => g.candidateBrands);
        await upsertOfflineBrandSummaries(candidates);
      },
    },
  );
}

export function searchCatalogueGenerics(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedCatalogueResponse<CatalogueGenericListItemDto>> {
  const qs = buildQueryString(params);
  return cachedCatalogueGet(
    `generics:${qs}`,
    'generics',
    () =>
      apiRequest<PaginatedCatalogueResponse<CatalogueGenericListItemDto>>(
        `/catalogue/generics${qs}`,
      ),
    { ttlMs: 3 * 60 * 1000, sqliteTtlMs: 20 * 60 * 1000 },
  );
}

export function getCatalogueGenericDetail(
  genericId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<CatalogueGenericDetailResponse> {
  const qs = buildQueryString(params);
  return cachedCatalogueGet(
    `generic:${genericId}:${qs}`,
    'generic',
    () =>
      apiRequest<CatalogueGenericDetailResponse>(
        `/catalogue/generics/${encodeURIComponent(genericId)}${qs}`,
      ),
    {
      ttlMs: 5 * 60 * 1000,
      sqliteTtlMs: 30 * 60 * 1000,
      onResolved: async (res) => {
        await upsertOfflineBrandSummaries(res.brands.items);
      },
    },
  );
}

export async function getOfflineCachedGenericDetail(
  genericId: string,
): Promise<CatalogueGenericDetailResponse | null> {
  const qs = buildQueryString({ limit: 20 });
  const stale = await readSqliteCacheEntry<CatalogueGenericDetailResponse>(
    `generic:${genericId}:${qs}`,
    { allowStale: true },
  );
  if (stale) return stale.value;

  const matchingBrands = await searchOfflineSqliteBrands({
    genericId,
    limit: 20,
  });
  if (matchingBrands.length === 0) return null;

  const firstGeneric = matchingBrands[0].generic;
  return {
    generic: {
      id: firstGeneric?.id ?? genericId,
      sourceId: firstGeneric?.sourceId ?? genericId,
      name: firstGeneric?.name ?? 'Generic Medicine',
      slug: firstGeneric?.slug ?? null,
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
    },
    brands: {
      items: matchingBrands,
      totalCount: matchingBrands.length,
      limit: 20,
      hasMore: false,
      nextCursor: null,
    },
    warningNotice:
      'Showing locally cached generic records from SQLite. Connect to the backend server for the complete catalogue.',
  };
}

export function searchAlternativeGroups(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<AlternativeGroupsSearchResponse> {
  const qs = buildQueryString(params);
  return cachedCatalogueGet(
    `alt-groups:${qs}`,
    'alt-groups',
    () => apiRequest<AlternativeGroupsSearchResponse>(`/catalogue/alternatives${qs}`),
    { ttlMs: 3 * 60 * 1000, sqliteTtlMs: 15 * 60 * 1000 },
  );
}
