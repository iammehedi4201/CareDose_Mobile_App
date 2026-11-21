import type { CatalogueBrandSummaryDto, CataloguePackDto } from '../../api/catalogue';
import type { StatusVariant } from '../../components/StatusBadge';

export function formatMissingCatalogueValue(value?: string | null): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Not available';
}

export function formatCurrencyAmount(
  amount: string | null | undefined,
  currency = 'BDT',
): string {
  if (!amount || amount.trim().length === 0) {
    return 'Not available';
  }
  const symbol = currency.toUpperCase() === 'BDT' ? '৳' : currency;
  return `${symbol} ${amount.trim()}`;
}

export function formatPackSummary(pack: CataloguePackDto | null | undefined): string {
  if (!pack) {
    return 'Pack: Not available';
  }
  const qty = pack.packQuantity?.trim();
  if (qty && pack.packUnits) {
    if (qty.toLowerCase().includes(String(pack.packUnits))) {
      return qty;
    }
    return `${qty} (${pack.packUnits} units)`;
  }
  if (qty) {
    return qty;
  }
  if (pack.packUnits) {
    return `${pack.packUnits} units`;
  }
  return 'Pack: Not available';
}

export function formatUnitOrPackPrice(pack: CataloguePackDto | null | undefined): string {
  if (!pack) {
    return 'Price unavailable';
  }
  if (pack.unitPrice) {
    return `${formatCurrencyAmount(pack.unitPrice, pack.currency)} / unit`;
  }
  if (pack.packPrice) {
    return `${formatCurrencyAmount(pack.packPrice, pack.currency)} / pack`;
  }
  return 'Price unavailable';
}

export function resolveBrandBadge(
  brand: Pick<CatalogueBrandSummaryDto, 'verification' | 'hasPriceWarning'>,
): { variant: StatusVariant; label: string } {
  if (brand.hasPriceWarning) {
    return { variant: 'low_stock', label: 'Unverified · Price warning' };
  }
  if (brand.verification === 'NEEDS_REVIEW') {
    return { variant: 'low_stock', label: 'Needs review' };
  }
  if (brand.verification === 'VERIFIED') {
    return { variant: 'verified', label: 'Verified' };
  }
  return { variant: 'unverified', label: 'Unverified' };
}

export function formatPackWarningReason(code: string): string {
  if (code === 'pack_price_inconsistent_with_unit_price') {
    return 'Source pack price differs slightly from unit price × units.';
  }
  if (code.startsWith('possible_duplicate_of:')) {
    return 'Source dataset flagged a possible duplicate listing.';
  }
  if (code === 'unverified_data') {
    return 'Source details have not been clinically verified.';
  }
  if (code === 'combination_product') {
    return 'Combination product — verify every active ingredient carefully.';
  }
  return code.replace(/_/g, ' ');
}

export const OFFLINE_FALLBACK_CATALOGUE_BRANDS: CatalogueBrandSummaryDto[] = [
  {
    id: '1',
    sourceId: '1',
    name: 'Celofen',
    strength: '100 mg',
    strengthNorm: '100mg',
    dosageForm: 'Tablet',
    dosageFormNorm: 'tablet',
    manufacturer: 'ACI Limited',
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
    generic: { id: '3', sourceId: '3', name: 'Aceclofenac', slug: 'aceclofenac' },
    primaryPack: {
      id: 'offline-pack-1',
      packQuantity: '5 x 10',
      packUnits: 50,
      unitPrice: '4.01',
      packPrice: '200.50',
      currency: 'BDT',
      unitPriceLabel: 'Unit Price',
      priceSource: 'brand_page',
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
      warnings: [],
      hasPriceWarning: false,
    },
    primaryImageUrl: null,
    primaryImageStatus: null,
  },
  {
    id: '2',
    sourceId: '2',
    name: 'Flexi',
    strength: '100 mg',
    strengthNorm: '100mg',
    dosageForm: 'Tablet',
    dosageFormNorm: 'tablet',
    manufacturer: 'Square Pharmaceuticals PLC',
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
    generic: { id: '3', sourceId: '3', name: 'Aceclofenac', slug: 'aceclofenac' },
    primaryPack: {
      id: 'offline-pack-2',
      packQuantity: "100's pack",
      packUnits: 100,
      unitPrice: '7.00',
      packPrice: '700.00',
      currency: 'BDT',
      unitPriceLabel: 'Unit Price',
      priceSource: 'brand_page',
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
      warnings: [],
      hasPriceWarning: false,
    },
    primaryImageUrl: null,
    primaryImageStatus: null,
  },
  {
    id: '358',
    sourceId: '358',
    name: 'Dextrolac',
    strength: null,
    strengthNorm: null,
    dosageForm: 'IV Infusion',
    dosageFormNorm: 'iv infusion',
    manufacturer: 'Orion Infusion Ltd.',
    category: 'allopathic',
    releaseMarker: null,
    verification: 'UNVERIFIED',
    fieldStatus: {
      generic: 'PRESENT',
      strength: 'MISSING',
      dosageForm: 'PRESENT',
      manufacturer: 'PRESENT',
      price: 'PRESENT',
    },
    warnings: [],
    hasPriceWarning: false,
    generic: {
      id: '179',
      sourceId: '179',
      name: 'Dextrose + Ringer Lactate',
      slug: 'dextrose-ringer-lactate',
    },
    primaryPack: {
      id: 'offline-pack-358',
      packQuantity: '500 ml bottle',
      packUnits: null,
      unitPrice: null,
      packPrice: '95.00',
      currency: 'BDT',
      unitPriceLabel: null,
      priceSource: 'brand_page',
      sourceUrl: null,
      collectedAt: null,
      verification: 'UNVERIFIED',
      warnings: [],
      hasPriceWarning: false,
    },
    primaryImageUrl: null,
    primaryImageStatus: null,
  },
];
