import { apiRequest } from './config';

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

export function clearCatalogueClientCache(): void {
  clientCatalogueCache.clear();
}

async function cachedCatalogueGet<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean; ttlMs?: number },
): Promise<T> {
  if (!options?.forceRefresh) {
    const cached = readClientCache<T>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
  }
  const fresh = await fetcher();
  return writeClientCache(cacheKey, fresh, options?.ttlMs);
}

export function getCatalogueSummary(options?: {
  forceRefresh?: boolean;
}): Promise<CatalogueSummaryResponse> {
  return cachedCatalogueGet(
    'summary',
    () => apiRequest<CatalogueSummaryResponse>('/catalogue/summary'),
    { forceRefresh: options?.forceRefresh, ttlMs: 5 * 60 * 1000 },
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
    () => apiRequest<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>>(`/catalogue/search${qs}`),
    { forceRefresh, ttlMs: 2 * 60 * 1000 },
  );
}

export function getCatalogueBrandDetail(
  brandId: string,
  options?: { forceRefresh?: boolean },
): Promise<CatalogueBrandDetailDto> {
  const key = `brand:${brandId}`;
  return cachedCatalogueGet(
    key,
    () =>
      apiRequest<CatalogueBrandDetailDto>(`/catalogue/brands/${encodeURIComponent(brandId)}`),
    { forceRefresh: options?.forceRefresh, ttlMs: 5 * 60 * 1000 },
  );
}

export function getCatalogueBrandAlternatives(
  brandId: string,
  options?: { forceRefresh?: boolean },
): Promise<CatalogueBrandAlternativesResponse> {
  const key = `brand-alts:${brandId}`;
  return cachedCatalogueGet(
    key,
    () =>
      apiRequest<CatalogueBrandAlternativesResponse>(
        `/catalogue/brands/${encodeURIComponent(brandId)}/alternatives`,
      ),
    { forceRefresh: options?.forceRefresh, ttlMs: 5 * 60 * 1000 },
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
    () =>
      apiRequest<PaginatedCatalogueResponse<CatalogueGenericListItemDto>>(
        `/catalogue/generics${qs}`,
      ),
    { ttlMs: 3 * 60 * 1000 },
  );
}

export function getCatalogueGenericDetail(
  genericId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<CatalogueGenericDetailResponse> {
  const qs = buildQueryString(params);
  return cachedCatalogueGet(
    `generic:${genericId}:${qs}`,
    () =>
      apiRequest<CatalogueGenericDetailResponse>(
        `/catalogue/generics/${encodeURIComponent(genericId)}${qs}`,
      ),
    { ttlMs: 5 * 60 * 1000 },
  );
}

export function searchAlternativeGroups(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<AlternativeGroupsSearchResponse> {
  const qs = buildQueryString(params);
  return cachedCatalogueGet(
    `alt-groups:${qs}`,
    () => apiRequest<AlternativeGroupsSearchResponse>(`/catalogue/alternatives${qs}`),
    { ttlMs: 3 * 60 * 1000 },
  );
}
