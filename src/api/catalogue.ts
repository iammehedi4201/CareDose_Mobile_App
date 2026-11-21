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

export function getCatalogueSummary(): Promise<CatalogueSummaryResponse> {
  return apiRequest<CatalogueSummaryResponse>('/catalogue/summary');
}

export function searchCatalogueBrands(params: {
  q?: string;
  form?: string;
  manufacturer?: string;
  genericId?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>> {
  const qs = buildQueryString(params);
  return apiRequest<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>>(
    `/catalogue/search${qs}`,
  );
}

export function getCatalogueBrandDetail(brandId: string): Promise<CatalogueBrandDetailDto> {
  return apiRequest<CatalogueBrandDetailDto>(
    `/catalogue/brands/${encodeURIComponent(brandId)}`,
  );
}

export function getCatalogueBrandAlternatives(
  brandId: string,
): Promise<CatalogueBrandAlternativesResponse> {
  return apiRequest<CatalogueBrandAlternativesResponse>(
    `/catalogue/brands/${encodeURIComponent(brandId)}/alternatives`,
  );
}

export function searchCatalogueGenerics(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedCatalogueResponse<CatalogueGenericListItemDto>> {
  const qs = buildQueryString(params);
  return apiRequest<PaginatedCatalogueResponse<CatalogueGenericListItemDto>>(
    `/catalogue/generics${qs}`,
  );
}

export function getCatalogueGenericDetail(
  genericId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<CatalogueGenericDetailResponse> {
  const qs = buildQueryString(params);
  return apiRequest<CatalogueGenericDetailResponse>(
    `/catalogue/generics/${encodeURIComponent(genericId)}${qs}`,
  );
}

export function searchAlternativeGroups(params: {
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<AlternativeGroupsSearchResponse> {
  const qs = buildQueryString(params);
  return apiRequest<AlternativeGroupsSearchResponse>(`/catalogue/alternatives${qs}`);
}
