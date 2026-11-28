import type { CatalogueBrandSummaryDto, CataloguePackDto } from '../../api/catalogue';
import type { StatusVariant } from '../../components/StatusBadge';
import {
  extractMeteredDoses,
  extractPackInfo,
  extractVolumeMl,
  extractWeightGm,
} from '../medications/stock-calculator';

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

export interface PackQuantityUnitDisplay {
  label: string;
  value: string;
}

function singularContainerNoun(unit: string): string {
  switch (unit) {
    case 'syringes':
      return 'pre-filled syringe';
    case 'ampoules':
      return 'ampoule';
    case 'vials':
      return 'vial';
    case 'pens':
      return 'pen';
    case 'cartridges':
      return 'cartridge';
    case 'respules':
      return 'respule';
    case 'bags':
      return 'infusion bag';
    case 'bottles':
      return 'bottle';
    case 'inhalers':
      return 'inhaler';
    case 'containers':
      return 'container';
    default:
      return unit.replace(/s$/, '');
  }
}

function formatMlOrLiter(ml: number): string {
  if (ml >= 1000 && ml % 1000 === 0) {
    return `${ml / 1000} L`;
  }
  return `${ml} ml`;
}

export function resolvePackQuantityUnit(
  pack: CataloguePackDto | null | undefined,
  dosageForm?: string | null,
  allPacks: CataloguePackDto[] = [],
  options: { includeStripsInPack?: boolean } = {},
): PackQuantityUnitDisplay {
  const { includeStripsInPack = true } = options;
  const formLower = (dosageForm ?? '').trim().toLowerCase();
  const pq = pack?.packQuantity?.trim() || null;
  const info = extractPackInfo(dosageForm, pack ?? null, allPacks.length > 0 ? allPacks : pack ? [pack] : []);

  if (info.strategy === 'tablet_capsule') {
    const plural = info.baseUnit;
    const singular = plural === 'capsules' ? 'capsule' : 'tablet';
    if (info.stripUnits !== null) {
      return {
        label: getStripUnitsLabel(dosageForm),
        value: formatStripUnitsValue(
          info.stripUnits,
          dosageForm,
          includeStripsInPack ? info.packTotalUnits : null,
        ),
      };
    }
    if (info.packTotalUnits !== null) {
      return {
        label: 'Pack quantity',
        value: `${info.packTotalUnits} ${info.packTotalUnits === 1 ? singular : plural} per pack`,
      };
    }
    if (pq) {
      return {
        label: 'Quantity unit',
        value: `Per ${singular} (${pq})`,
      };
    }
    return {
      label: 'Quantity unit',
      value: `Per ${singular} (sold by unit)`,
    };
  }

  if (info.strategy === 'suppository') {
    if (info.stripUnits !== null) {
      return {
        label: 'Pieces per strip',
        value: formatStripUnitsValue(
          info.stripUnits,
          dosageForm,
          includeStripsInPack ? info.packTotalUnits : null,
        ),
      };
    }
    if (info.packTotalUnits !== null) {
      return {
        label: 'Quantity unit',
        value: `${info.packTotalUnits} ${info.packTotalUnits === 1 ? 'piece' : 'pieces'} per pack`,
      };
    }
    return {
      label: 'Quantity unit',
      value: 'Per piece',
    };
  }

  if (info.strategy === 'liquid') {
    if (pq && /\bsachet\b/i.test(pq)) {
      return {
        label: 'Sachet unit',
        value: pq,
      };
    }
    if (pq && /^\d+\s*x\s*\d+/i.test(pq) && info.packTotalUnits !== null) {
      return {
        label: 'Pack quantity',
        value: `${info.packTotalUnits} ampoules / respules per pack`,
      };
    }
    const metered = info.meteredDoses ?? extractMeteredDoses(pq);
    if (metered !== null) {
      return {
        label: 'Doses / capacity',
        value: `${metered} puffs per container`,
      };
    }
    if (info.bottleVolumeMl !== null) {
      const containerNoun = pq && /\bcontainer\b/i.test(pq) ? 'container' : 'bottle';
      if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
        return {
          label: containerNoun === 'container' ? 'Container volume' : 'Bottle volume',
          value: `${formatMlOrLiter(info.bottleVolumeMl)} × ${info.packTotalUnits} ${containerNoun}s`,
        };
      }
      return {
        label: containerNoun === 'container' ? 'Container volume' : 'Bottle volume',
        value: `${formatMlOrLiter(info.bottleVolumeMl)} per ${containerNoun}`,
      };
    }
    const liquidGm = extractWeightGm(pq);
    if (liquidGm !== null) {
      const containerNoun = pq && /\bcontainer\b/i.test(pq) ? 'container' : 'bottle';
      return {
        label: 'Bottle weight',
        value: `${liquidGm} gm per ${containerNoun}`,
      };
    }
    if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
      return {
        label: 'Pack quantity',
        value: formLower.includes('nebul')
          ? `${info.packTotalUnits} respules / ampoules per pack`
          : `${info.packTotalUnits} units per pack`,
      };
    }
    return {
      label: 'Quantity unit',
      value: pq ?? 'In ml (per bottle)',
    };
  }

  if (info.strategy === 'drops') {
    if (info.bottleVolumeMl !== null) {
      if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
        return {
          label: 'Drop bottle volume',
          value: `${formatMlOrLiter(info.bottleVolumeMl)} × ${info.packTotalUnits} bottles`,
        };
      }
      return {
        label: 'Drop bottle volume',
        value: `${formatMlOrLiter(info.bottleVolumeMl)} per bottle`,
      };
    }
    if (info.packTotalUnits !== null) {
      return {
        label: 'Pack quantity',
        value: `${info.packTotalUnits} ${info.packTotalUnits === 1 ? 'bottle' : 'bottles'} per pack`,
      };
    }
    return {
      label: 'Quantity unit',
      value: 'Per drop bottle (ml)',
    };
  }

  if (info.strategy === 'injection') {
    const singular = singularContainerNoun(info.containerUnit ?? 'vials');
    if (formLower.includes('infusion') && info.bottleVolumeMl !== null) {
      if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
        return {
          label: 'Infusion volume',
          value: `${formatMlOrLiter(info.bottleVolumeMl)} × ${info.packTotalUnits} bags/bottles`,
        };
      }
      return {
        label: 'Infusion volume',
        value: `${formatMlOrLiter(info.bottleVolumeMl)} per bag / bottle`,
      };
    }
    if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
      const plural = info.containerUnit ?? 'vials';
      return {
        label:
          formLower.includes('nebul') || plural === 'respules'
            ? 'Pack quantity'
            : 'Injection pack',
        value: `${info.packTotalUnits} ${plural} per pack`,
      };
    }
    if (info.bottleVolumeMl !== null) {
      return {
        label: 'Injection unit',
        value: `${formatMlOrLiter(info.bottleVolumeMl)} ${singular}`,
      };
    }
    return {
      label: 'Injection unit',
      value: pq ? `Per ${singular} (${pq})` : `Per ${singular}`,
    };
  }

  if (info.strategy === 'inhaler') {
    if (info.meteredDoses !== null) {
      return {
        label: 'Inhaler doses',
        value: `${info.meteredDoses} puffs / metered doses`,
      };
    }
    const vol = extractVolumeMl(pq);
    if (vol !== null) {
      return {
        label: 'Spray volume',
        value: `${formatMlOrLiter(vol)} per bottle`,
      };
    }
    if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
      return {
        label: 'Pack quantity',
        value: `${info.packTotalUnits} units per pack`,
      };
    }
    return {
      label: 'Quantity unit',
      value: pq ?? 'Per inhaler',
    };
  }

  if (info.strategy === 'topical') {
    const noun = info.containerUnit === 'containers' ? 'container' : 'tube';
    if (info.tubeWeightGm !== null) {
      return {
        label: noun === 'container' ? 'Container weight' : 'Tube weight',
        value: `${info.tubeWeightGm} gm per ${noun}`,
      };
    }
    const vol = extractVolumeMl(pq);
    if (vol !== null) {
      return {
        label: 'Container volume',
        value: `${formatMlOrLiter(vol)} per ${noun}`,
      };
    }
    return {
      label: 'Quantity unit',
      value: pq ? `Per ${noun} (${pq})` : `Per ${noun}`,
    };
  }

  if (info.strategy === 'sachet') {
    if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
      return {
        label: 'Sachet pack',
        value: `${info.packTotalUnits} sachets per pack`,
      };
    }
    const gm = extractWeightGm(pq);
    if (gm !== null) {
      return {
        label: 'Sachet weight',
        value: `${gm} gm per sachet`,
      };
    }
    return {
      label: 'Quantity unit',
      value: pq ?? 'Per sachet',
    };
  }

  // Other medical sundries / devices / shampoos / patches / test strips
  const otherVol = extractVolumeMl(pq);
  if (otherVol !== null) {
    return {
      label: 'Container volume',
      value: `${formatMlOrLiter(otherVol)} per bottle`,
    };
  }
  const otherGm = extractWeightGm(pq);
  if (otherGm !== null) {
    return {
      label: 'Pack weight',
      value: `${otherGm} gm`,
    };
  }
  if (info.packTotalUnits !== null && info.packTotalUnits > 1) {
    if (formLower.includes('test strip')) {
      return { label: 'Pack quantity', value: `${info.packTotalUnits} test strips per pack` };
    }
    if (formLower.includes('patch')) {
      return { label: 'Pack quantity', value: `${info.packTotalUnits} patches per pack` };
    }
    if (formLower.includes('needle')) {
      return { label: 'Pack quantity', value: `${info.packTotalUnits} needles per pack` };
    }
    return { label: 'Pack quantity', value: `${info.packTotalUnits} units per pack` };
  }
  return {
    label: 'Quantity unit',
    value: pq ?? 'Per unit',
  };
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

function computeBrandSuggestionTier(
  brand: CatalogueBrandSummaryDto,
  q: string,
): number | null {
  const nameLower = brand.name.trim().toLowerCase();
  const genericLower = (brand.generic?.name ?? '').trim().toLowerCase();
  const strengthLower = (brand.strength ?? '').trim().toLowerCase();
  const mfrLower = (brand.manufacturer ?? '').trim().toLowerCase();

  if (nameLower === q) return 0;
  if (nameLower.startsWith(q)) return 1;
  if (nameLower.includes(` ${q}`)) return 2;
  if (genericLower.startsWith(q)) return 3;
  if (nameLower.includes(q)) return 4;
  if (
    genericLower.includes(q) ||
    strengthLower.includes(q) ||
    mfrLower.includes(q)
  ) {
    return 5;
  }
  return null;
}

/**
 * Ranks and deduplicates catalogue brand suggestions for live search dropdowns.
 * Prioritizes exact and prefix matches on brand name (e.g. "n" -> Napa, Neuro-B)
 * before substring or generic/manufacturer matches.
 */
export function rankMedicineSuggestions(
  items: CatalogueBrandSummaryDto[],
  query: string,
  limit = 6,
): CatalogueBrandSummaryDto[] {
  const q = query.trim().toLowerCase();
  if (!q || items.length === 0) return [];

  const deduped = new Map<string, { item: CatalogueBrandSummaryDto; tier: number }>();

  for (const item of items) {
    const tier = computeBrandSuggestionTier(item, q);
    if (tier === null) continue;

    const dedupeKey = [
      item.name.trim().toLowerCase(),
      (item.strengthNorm ?? item.strength ?? '').trim().toLowerCase(),
      (item.dosageFormNorm ?? item.dosageForm ?? '').trim().toLowerCase(),
    ].join('|');

    const existing = deduped.get(dedupeKey);
    if (!existing || tier < existing.tier) {
      deduped.set(dedupeKey, { item, tier });
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const nameCmp = a.item.name.localeCompare(b.item.name);
      if (nameCmp !== 0) return nameCmp;
      return (a.item.strength ?? '').localeCompare(b.item.strength ?? '');
    })
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.item);
}
