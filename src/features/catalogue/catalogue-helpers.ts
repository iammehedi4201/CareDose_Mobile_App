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

export function isSolidDosageForm(dosageForm?: string | null): boolean {
  if (!dosageForm) return false;
  const lower = dosageForm.toLowerCase();
  return (
    lower.includes('tablet') ||
    lower.includes('capsule') ||
    lower.includes('suppository') ||
    lower.includes('pessary') ||
    lower.includes('cap') ||
    lower.includes('tab')
  );
}

export function getStripUnitsLabel(dosageForm?: string | null): string {
  const lower = (dosageForm ?? '').toLowerCase();
  if (lower.includes('capsule')) {
    return 'Capsules per strip';
  }
  if (lower.includes('suppository') || lower.includes('pessary')) {
    return 'Pieces per strip';
  }
  return 'Tablets per strip';
}

export function formatStripUnitsValue(
  stripUnits?: number | null,
  dosageForm?: string | null,
  packUnits?: number | null,
): string {
  if (typeof stripUnits !== 'number' || !Number.isFinite(stripUnits) || stripUnits <= 0) {
    return 'Not available';
  }
  const count = Math.round(stripUnits);
  const lower = (dosageForm ?? '').toLowerCase();
  const noun = lower.includes('capsule')
    ? count === 1
      ? 'capsule'
      : 'capsules'
    : lower.includes('suppository') || lower.includes('pessary')
      ? count === 1
        ? 'piece'
        : 'pieces'
      : count === 1
        ? 'tablet'
        : 'tablets';

  if (
    typeof packUnits === 'number' &&
    Number.isInteger(packUnits) &&
    packUnits > count &&
    packUnits % count === 0
  ) {
    const strips = packUnits / count;
    return `${count} ${noun} (${strips} ${strips === 1 ? 'strip' : 'strips'} in pack)`;
  }

  return `${count} ${noun}`;
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
): { variant: StatusVariant; label: string; showBadge: boolean } {
  if (brand.hasPriceWarning) {
    return { variant: 'low_stock', label: 'Price warning', showBadge: true };
  }
  if (brand.verification === 'NEEDS_REVIEW') {
    return { variant: 'low_stock', label: 'Needs review', showBadge: true };
  }
  if (brand.verification === 'VERIFIED') {
    return { variant: 'verified', label: 'Verified', showBadge: true };
  }
  return { variant: 'unverified', label: 'Unverified', showBadge: false };
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
      stripUnits: 10,
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
      stripUnits: 10,
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
      stripUnits: null,
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
