import type {
  CatalogueBrandDetailDto,
  CatalogueBrandSummaryDto,
  CataloguePackDto,
} from '../../api/catalogue';
import { formatStockQuantity } from './medication-helpers';

export function resolveBrandPacks(
  brand: CatalogueBrandSummaryDto | null | undefined,
  detail?: CatalogueBrandDetailDto | null,
): CataloguePackDto[] {
  if (detail?.packs && detail.packs.length > 0) {
    return detail.packs;
  }
  if (brand && 'packs' in brand && Array.isArray((brand as CatalogueBrandDetailDto).packs)) {
    const brandPacks = (brand as CatalogueBrandDetailDto).packs;
    if (brandPacks.length > 0) return brandPacks;
  }
  return brand?.primaryPack ? [brand.primaryPack] : [];
}

export type DosageFormStrategy =
  | 'tablet_capsule'
  | 'liquid'
  | 'drops'
  | 'suppository'
  | 'injection'
  | 'inhaler'
  | 'topical'
  | 'sachet'
  | 'other';

export type StockEntryMode =
  | 'strips'
  | 'direct'
  | 'packs'
  | 'bottles'
  | 'ml'
  | 'containers'
  | 'puffs';

export interface ExtractedPackInfo {
  strategy: DosageFormStrategy;
  dosageFormLabel: string;
  baseUnit: string;
  pack: CataloguePackDto | null;
  packQuantityLabel: string | null;
  /** Units in one strip/blister, ONLY populated when explicitly listed in packQuantity (e.g. "50 x 10" -> 10, "4 tablet strip" -> 4). */
  stripUnits: number | null;
  /** Number of strips per commercial box when packQuantity is "A x B" (e.g. "50 x 10" -> 50). */
  stripsInPack: number | null;
  /** Discrete pack units from DB when pack represents N countable pieces/units (e.g. "30's pack" -> 30). */
  packTotalUnits: number | null;
  /** Volume per bottle/ampoule/bag in ml, ONLY populated when packQuantity states ml/L (e.g. "100 ml bottle" -> 100). */
  bottleVolumeMl: number | null;
  /** Weight per tube/container in gm when stated in packQuantity (e.g. "15 gm tube" -> 15). */
  tubeWeightGm: number | null;
  /** Metered doses/puffs in an inhaler/spray when stated in packQuantity (e.g. "120 metered doses" -> 120). */
  meteredDoses: number | null;
  /** Specific container unit for injections/topicals/inhalers (e.g. "vials", "ampoules", "syringes", "tube"). */
  containerUnit: string | null;
  /** Price for 1 discrete unit (tablet, capsule, piece, sachet), or derived packPrice / packTotalUnits when pack is countable. */
  discreteUnitPrice: number | null;
  discretePriceSource: 'unit_price' | 'derived_from_pack' | 'none';
  /** Price for 1 container (bottle, vial, ampoule, syringe, tube, inhaler) when packPrice is per container or per pack of N containers. */
  containerPrice: number | null;
  containerPriceSource: 'pack_price' | 'derived_per_container' | 'none';
  hasPriceWarning: boolean;
}

export interface StockCalculationResult {
  stockRemaining: number | null;
  stockUnit: string;
  calculationSummary: string | null;
  calculatedTotalPrice: number | null;
  referenceUnitPriceText: string;
  referencePackText: string | null;
  priceScopeDescription: string;
  missingPackagingNotice: string | null;
  isValid: boolean;
}

function toPositiveNumber(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const parsed = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function classifyDosageFormStrategy(
  dosageForm?: string | null,
  packQuantity?: string | null,
): DosageFormStrategy {
  const form = (dosageForm ?? '').trim().toLowerCase();
  const packQty = (packQuantity ?? '').trim().toLowerCase();

  // If the selected pack itself is explicitly a sachet (e.g. Gavicool suspension 10 ml sachet),
  // handle it cleanly as sachet pieces.
  if (/\bsachets?\b/.test(packQty) && !/\bpack\b/.test(packQty)) {
    return 'sachet';
  }

  if (form.includes('suppository') || form.includes('pessary')) {
    return 'suppository';
  }

  if (
    form.includes('ophthalmic ointment') ||
    form.includes('ophthalmic gel') ||
    form.includes('cream') ||
    form.includes('ointment') ||
    form.includes('gel') ||
    form.includes('paste')
  ) {
    return 'topical';
  }

  if (
    form.includes('drop') ||
    form.includes('ophthalmic solution') ||
    form.includes('ophthalmic suspension') ||
    form.includes('ophthalmic emulsion')
  ) {
    return 'drops';
  }

  if (form.includes('tablet') || form.includes('capsule')) {
    return 'tablet_capsule';
  }

  if (
    form.includes('injection') ||
    form.includes('infusion') ||
    form.includes('insulin device') ||
    form.includes('pre-filled') ||
    form.includes('prefilled') ||
    form.includes('syringe')
  ) {
    return 'injection';
  }

  if (
    form.includes('inhaler') ||
    form.includes('nasal spray') ||
    form.includes('topical spray') ||
    form.includes('ocular spray')
  ) {
    return 'inhaler';
  }

  if (
    form.includes('syrup') ||
    form.includes('suspension') ||
    form.includes('oral solution') ||
    form.includes('solution') ||
    form.includes('elixir') ||
    form.includes('mouthwash') ||
    form.includes('lotion') ||
    form.includes('hand rub') ||
    form.includes('emulsion') ||
    form.includes('saline') ||
    form.includes('cleanser') ||
    form.includes('liquid')
  ) {
    return 'liquid';
  }

  if (
    form.includes('powder') ||
    form.includes('granules') ||
    form.includes('sachet')
  ) {
    return 'sachet';
  }

  return 'other';
}

export function extractStripDetails(
  packQuantity: string | null | undefined,
  strategy: DosageFormStrategy,
  explicitStripUnits?: number | null,
): { stripUnits: number | null; stripsInPack: number | null } {
  if (strategy !== 'tablet_capsule' && strategy !== 'suppository') {
    return { stripUnits: null, stripsInPack: null };
  }
  const cleanExplicit =
    typeof explicitStripUnits === 'number' &&
    Number.isInteger(explicitStripUnits) &&
    explicitStripUnits > 0
      ? explicitStripUnits
      : null;

  if (!packQuantity) {
    return { stripUnits: cleanExplicit, stripsInPack: null };
  }
  const clean = packQuantity.trim();

  // "50 x 10", "3 x 10", "4 x 14", "6 x 5", "3 x 10's pack"
  const matrixMatch = clean.match(
    /^(\d+)\s*x\s*(\d+)(?:'s|’s)?(?:\s+(?:pack|strip|blister|box|pot|tin))?$/i,
  );
  if (matrixMatch) {
    const a = Number(matrixMatch[1]);
    const b = Number(matrixMatch[2]);
    if (a > 0 && b > 0) {
      return { stripUnits: cleanExplicit ?? b, stripsInPack: a };
    }
  }

  // "4 tablet strip", "10 capsule blister"
  const nounStripMatch = clean.match(
    /^(\d+)\s+(?:tablets?|tabs?|capsules?|caps?)\s+(?:strip|blister)$/i,
  );
  if (nounStripMatch) {
    const n = Number(nounStripMatch[1]);
    if (n > 0) {
      return { stripUnits: cleanExplicit ?? n, stripsInPack: 1 };
    }
  }

  // "100's strip", "10's blister"
  const sStripMatch = clean.match(/^(\d+)(?:'s|’s)\s+(?:strip|blister)$/i);
  if (sStripMatch) {
    const n = Number(sStripMatch[1]);
    if (n > 0) {
      return { stripUnits: cleanExplicit ?? n, stripsInPack: 1 };
    }
  }

  // Note: "30's pack", "510's pack", etc. are commercial packs/boxes, unless explicitStripUnits is listed.
  return { stripUnits: cleanExplicit, stripsInPack: null };
}

export function extractVolumeMl(packQuantity?: string | null): number | null {
  if (!packQuantity) return null;
  const mlMatch = packQuantity.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (mlMatch) {
    const val = Number(mlMatch[1]);
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  const literMatch = packQuantity.match(/(\d+(?:\.\d+)?)\s*l(?:iters?|itters?)?\b/i);
  if (literMatch) {
    const val = Number(literMatch[1]) * 1000;
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

export function extractWeightGm(packQuantity?: string | null): number | null {
  if (!packQuantity) return null;
  const gmMatch = packQuantity.match(/(\d+(?:\.\d+)?)\s*(?:gm|g)\b/i);
  if (gmMatch) {
    const val = Number(gmMatch[1]);
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

export function extractMeteredDoses(packQuantity?: string | null): number | null {
  if (!packQuantity) return null;
  const m = packQuantity.match(/^(\d+)\s*(?:metered\s+(?:doses?|sprays?)|puffs?)\b/i);
  if (m) {
    const val = Number(m[1]);
    return Number.isFinite(val) && val > 0 ? val : null;
  }
  return null;
}

function detectContainerNoun(text: string): string | null {
  const lower = text.toLowerCase();
  if (/pre-filled\s*syringe|prefilled\s*syringe|syringe|\bpfs\b/.test(lower)) {
    return 'syringes';
  }
  if (/\bampoules?\b|\bamp\b/.test(lower)) {
    return 'ampoules';
  }
  if (/\bvials?\b/.test(lower)) {
    return 'vials';
  }
  if (/\bpens?\b/.test(lower)) {
    return 'pens';
  }
  if (/\bcartridges?\b/.test(lower)) {
    return 'cartridges';
  }
  if (/\bbags?\b/.test(lower)) {
    return 'bags';
  }
  if (/\bbottles?\b/.test(lower)) {
    return 'bottles';
  }
  return null;
}

export function extractInjectionContainerUnit(
  selectedPack: CataloguePackDto | null,
  allPacks: CataloguePackDto[],
  dosageForm?: string | null,
): string | null {
  if (selectedPack?.packQuantity) {
    const direct = detectContainerNoun(selectedPack.packQuantity);
    if (direct) return direct;
  }
  // Check sibling packs for the same brand (e.g. Neos-R has both "5 ml ampoule" and "5's pack")
  for (const pk of allPacks) {
    if (pk.packQuantity) {
      const sibling = detectContainerNoun(pk.packQuantity);
      if (sibling) return sibling;
    }
  }
  const formLower = (dosageForm ?? '').toLowerCase();
  if (formLower.includes('syringe') || formLower.includes('prefilled')) {
    return 'syringes';
  }
  if (formLower.includes('insulin device')) {
    return 'pens';
  }
  // If an injection only has "5's pack" or no container keyword at all, do NOT guess vials vs ampoules.
  return null;
}

export function getBaseStockUnitForStrategy(
  strategy: DosageFormStrategy,
  dosageForm?: string | null,
  containerUnit?: string | null,
): string {
  const formLower = (dosageForm ?? '').toLowerCase();
  switch (strategy) {
    case 'tablet_capsule':
      return formLower.includes('capsule') ? 'capsules' : 'tablets';
    case 'liquid':
      return 'ml';
    case 'drops':
      return 'bottle';
    case 'suppository':
      return 'pieces';
    case 'injection':
      return containerUnit ?? 'vials';
    case 'inhaler':
      return 'puffs';
    case 'topical':
      return 'tube';
    case 'sachet':
      return 'sachets';
    default:
      return 'units';
  }
}

export function extractPackInfo(
  dosageForm?: string | null,
  selectedPack: CataloguePackDto | null = null,
  allPacks: CataloguePackDto[] = [],
): ExtractedPackInfo {
  let strategy = classifyDosageFormStrategy(dosageForm, selectedPack?.packQuantity);
  const packQty = selectedPack?.packQuantity?.trim() || null;
  const packTotalUnits =
    selectedPack?.packUnits && selectedPack.packUnits > 0 ? selectedPack.packUnits : null;
  if (
    strategy === 'liquid' &&
    packTotalUnits !== null &&
    allPacks.some((pk) => /\bsachets?\b/i.test(pk.packQuantity ?? ''))
  ) {
    strategy = 'sachet';
  }
  const { stripUnits, stripsInPack: parsedStripsInPack } = extractStripDetails(
    packQty,
    strategy,
    selectedPack?.stripUnits ?? null,
  );
  const stripsInPack =
    parsedStripsInPack ??
    (stripUnits !== null &&
    packTotalUnits !== null &&
    packTotalUnits >= stripUnits &&
    packTotalUnits % stripUnits === 0
      ? packTotalUnits / stripUnits
      : null);
  const bottleVolumeMl =
    strategy === 'liquid' || strategy === 'drops' || strategy === 'injection'
      ? extractVolumeMl(packQty)
      : null;
  const tubeWeightGm = strategy === 'topical' ? extractWeightGm(packQty) : null;
  const meteredDoses = strategy === 'inhaler' ? extractMeteredDoses(packQty) : null;

  let containerUnit: string | null = null;
  if (strategy === 'injection') {
    containerUnit = extractInjectionContainerUnit(selectedPack, allPacks, dosageForm);
  } else if (strategy === 'topical') {
    containerUnit =
      packQty && /\bcontainer\b/i.test(packQty) ? 'containers' : 'tube';
  } else if (strategy === 'drops' || strategy === 'liquid') {
    containerUnit = 'bottle';
  } else if (strategy === 'inhaler') {
    containerUnit = (dosageForm ?? '').toLowerCase().includes('spray')
      ? 'bottles'
      : 'inhalers';
  }

  const baseUnit = getBaseStockUnitForStrategy(strategy, dosageForm, containerUnit);

  const rawUnitPrice = toPositiveNumber(selectedPack?.unitPrice);
  const rawPackPrice = toPositiveNumber(selectedPack?.packPrice);

  let discreteUnitPrice: number | null = null;
  let discretePriceSource: ExtractedPackInfo['discretePriceSource'] = 'none';

  if (rawUnitPrice !== null) {
    discreteUnitPrice = rawUnitPrice;
    discretePriceSource = 'unit_price';
  } else if (rawPackPrice !== null && packTotalUnits !== null && packTotalUnits > 0) {
    discreteUnitPrice = Number((rawPackPrice / packTotalUnits).toFixed(4));
    discretePriceSource = 'derived_from_pack';
  } else if (
    strategy === 'sachet' &&
    rawPackPrice !== null &&
    packQty &&
    /\bsachet\b/i.test(packQty)
  ) {
    discreteUnitPrice = rawPackPrice;
    discretePriceSource = 'derived_from_pack';
  }

  let containerPrice: number | null = null;
  let containerPriceSource: ExtractedPackInfo['containerPriceSource'] = 'none';

  if (
    strategy === 'liquid' ||
    strategy === 'drops' ||
    strategy === 'injection' ||
    strategy === 'topical' ||
    strategy === 'inhaler'
  ) {
    if (rawPackPrice !== null) {
      if (packTotalUnits !== null && packTotalUnits > 1) {
        containerPrice = Number((rawPackPrice / packTotalUnits).toFixed(4));
        containerPriceSource = 'derived_per_container';
      } else {
        containerPrice = rawPackPrice;
        containerPriceSource = 'pack_price';
      }
    } else if (rawUnitPrice !== null) {
      containerPrice = rawUnitPrice;
      containerPriceSource = 'pack_price';
    }
  }

  return {
    strategy,
    dosageFormLabel: dosageForm?.trim() || 'Medicine',
    baseUnit,
    pack: selectedPack,
    packQuantityLabel: packQty,
    stripUnits,
    stripsInPack,
    packTotalUnits,
    bottleVolumeMl,
    tubeWeightGm,
    meteredDoses,
    containerUnit,
    discreteUnitPrice,
    discretePriceSource,
    containerPrice,
    containerPriceSource,
    hasPriceWarning: Boolean(selectedPack?.hasPriceWarning),
  };
}

export function getAvailableStockModes(
  info: ExtractedPackInfo,
): Array<{ mode: StockEntryMode; label: string }> {
  switch (info.strategy) {
    case 'tablet_capsule': {
      const unitLabel = info.baseUnit === 'capsules' ? 'Capsules' : 'Tablets';
      const modes: Array<{ mode: StockEntryMode; label: string }> =
        info.stripUnits !== null
          ? [
              { mode: 'strips', label: `By strips (${info.stripUnits})` },
              { mode: 'direct', label: unitLabel },
            ]
          : [
              { mode: 'direct', label: unitLabel },
              { mode: 'strips', label: 'By strips' },
            ];
      if (
        info.stripUnits === null &&
        info.packTotalUnits !== null &&
        info.packTotalUnits > 1 &&
        info.packTotalUnits <= 100
      ) {
        modes.push({ mode: 'packs', label: `Packs (${info.packTotalUnits})` });
      }
      return modes;
    }

    case 'liquid':
      return [
        {
          mode: 'bottles',
          label: info.bottleVolumeMl
            ? `By bottles (${info.bottleVolumeMl} ml)`
            : 'By bottles',
        },
        { mode: 'ml', label: 'In ml' },
      ];

    case 'drops':
      return [
        {
          mode: 'bottles',
          label: info.bottleVolumeMl
            ? `By bottles (${info.bottleVolumeMl} ml)`
            : 'By bottles',
        },
        { mode: 'ml', label: 'In ml' },
      ];

    case 'suppository':
      return info.stripUnits !== null
        ? [
            { mode: 'direct', label: 'Pieces' },
            { mode: 'strips', label: `By strips (${info.stripUnits})` },
          ]
        : [{ mode: 'direct', label: 'Pieces' }];

    case 'injection':
      return [{ mode: 'containers', label: formatUnitNounCapitalized(info.containerUnit ?? 'vials') }];

    case 'inhaler':
      return info.meteredDoses !== null
        ? [
            {
              mode: 'containers',
              label: `By packs (${info.meteredDoses} puffs)`,
            },
            { mode: 'puffs', label: 'In puffs' },
          ]
        : [
            { mode: 'containers', label: formatUnitNounCapitalized(info.containerUnit ?? 'inhalers') },
            { mode: 'puffs', label: 'In puffs' },
          ];

    case 'topical':
      return [{ mode: 'containers', label: formatUnitNounCapitalized(info.containerUnit ?? 'tubes') }];

    case 'sachet':
      return info.packTotalUnits !== null && info.packTotalUnits > 1
        ? [
            { mode: 'direct', label: 'Sachets' },
            { mode: 'packs', label: `Packs (${info.packTotalUnits})` },
          ]
        : [{ mode: 'direct', label: 'Sachets' }];

    default:
      return [{ mode: 'direct', label: 'Units' }];
  }
}

export function getDefaultStockMode(info: ExtractedPackInfo): StockEntryMode {
  if (info.strategy === 'tablet_capsule') {
    return info.stripUnits !== null ? 'strips' : 'direct';
  }
  if (info.strategy === 'liquid') {
    return info.bottleVolumeMl !== null ? 'bottles' : 'ml';
  }
  if (info.strategy === 'drops') {
    return 'bottles';
  }
  if (info.strategy === 'suppository' || info.strategy === 'sachet' || info.strategy === 'other') {
    return 'direct';
  }
  return 'containers';
}

export function formatUnitNounCapitalized(unit: string): string {
  if (!unit) return 'Units';
  if (unit === 'bottle') return 'Bottles';
  if (unit === 'tube') return 'Tubes';
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}

export function formatUnitLabelForCount(count: number, unit: string): string {
  const lower = unit.toLowerCase();
  const isOne = count === 1;
  if (lower === 'ml' || lower === 'gm') return lower;
  if (lower === 'bottle' || lower === 'bottles') return isOne ? 'bottle' : 'bottles';
  if (lower === 'tube' || lower === 'tubes') return isOne ? 'tube' : 'tubes';
  if (lower === 'tablet' || lower === 'tablets') return isOne ? 'tablet' : 'tablets';
  if (lower === 'capsule' || lower === 'capsules') return isOne ? 'capsule' : 'capsules';
  if (lower === 'piece' || lower === 'pieces') return isOne ? 'piece' : 'pieces';
  if (lower === 'vial' || lower === 'vials') return isOne ? 'vial' : 'vials';
  if (lower === 'ampoule' || lower === 'ampoules') return isOne ? 'ampoule' : 'ampoules';
  if (lower === 'syringe' || lower === 'syringes') return isOne ? 'pre-filled syringe' : 'pre-filled syringes';
  if (lower === 'pen' || lower === 'pens') return isOne ? 'pen' : 'pens';
  if (lower === 'cartridge' || lower === 'cartridges') return isOne ? 'cartridge' : 'cartridges';
  if (lower === 'bag' || lower === 'bags') return isOne ? 'bag' : 'bags';
  if (lower === 'sachet' || lower === 'sachets') return isOne ? 'sachet' : 'sachets';
  if (lower === 'puff' || lower === 'puffs') return isOne ? 'puff' : 'puffs';
  if (lower === 'inhaler' || lower === 'inhalers') return isOne ? 'inhaler' : 'inhalers';
  if (lower === 'container' || lower === 'containers') return isOne ? 'container' : 'containers';
  if (lower === 'unit' || lower === 'units') return isOne ? 'unit' : 'units';
  return unit;
}

export function formatStockWithUnit(quantity: number | string, unit: string): string {
  const num = typeof quantity === 'number' ? quantity : Number(quantity);
  return `${formatStockQuantity(quantity)} ${formatUnitLabelForCount(num, unit)}`;
}

export function formatBdtCurrency(amount: number): string {
  const rounded = Number(amount.toFixed(2));
  return Number.isInteger(rounded) ? `${rounded}.00` : rounded.toFixed(2);
}

export function computeDefaultLowStockThreshold(
  strategy: DosageFormStrategy,
  stockUnit: string,
  initialStock: number,
  bottleVolumeMl?: number | null,
): number {
  const u = stockUnit.toLowerCase();
  if (u === 'ml') {
    if (bottleVolumeMl && bottleVolumeMl <= 30) {
      return 5;
    }
    if (initialStock > 0 && initialStock <= 25) {
      return Math.max(0, Math.floor(initialStock * 0.2));
    }
    return 20;
  }
  if (u === 'puffs') {
    return 20;
  }
  if (u === 'bottle' || u === 'bottles' || u === 'tube' || u === 'tubes' || u === 'inhalers') {
    return initialStock > 1 ? 1 : 0;
  }
  if (
    u === 'vials' ||
    u === 'ampoules' ||
    u === 'syringes' ||
    u === 'pens' ||
    u === 'cartridges' ||
    u === 'bags'
  ) {
    return initialStock > 2 ? 1 : 0;
  }
  // tablets, capsules, pieces, sachets, units
  if (strategy === 'suppository' || strategy === 'tablet_capsule' || strategy === 'sachet') {
    return initialStock > 0 && initialStock <= 5 ? Math.max(1, Math.floor(initialStock / 2)) : 5;
  }
  return 5;
}

export function getSuggestedInstructionPlaceholder(strategy: DosageFormStrategy): string {
  switch (strategy) {
    case 'tablet_capsule':
      return 'e.g. 1 tablet twice daily after meal';
    case 'liquid':
      return 'e.g. 5 ml twice daily after meal';
    case 'drops':
      return 'e.g. 1 drop twice daily or 1 ml every 8 hours';
    case 'suppository':
      return 'e.g. 1 suppository when needed for fever';
    case 'injection':
      return 'e.g. 1 dose as prescribed by doctor';
    case 'inhaler':
      return 'e.g. 2 puffs twice daily';
    case 'topical':
      return 'e.g. Apply thinly twice daily to affected area';
    case 'sachet':
      return 'e.g. Mix 1 sachet in water once daily';
    default:
      return 'e.g. Take as directed by your doctor';
  }
}

export function calculateStockAndPrice(params: {
  packInfo: ExtractedPackInfo;
  mode: StockEntryMode;
  primaryQty: string;
  secondaryQty?: string;
  overrideContainerUnit?: string | null;
  hasCatalogSelection?: boolean;
}): StockCalculationResult {
  const { packInfo, mode, primaryQty, secondaryQty = '', overrideContainerUnit, hasCatalogSelection = true } = params;
  const p1 = toPositiveNumberAllowZero(primaryQty);
  const p2 = toPositiveNumberAllowZero(secondaryQty);

  const resolvedContainerUnit =
    overrideContainerUnit ?? packInfo.containerUnit ?? packInfo.baseUnit;

  let stockRemaining: number | null = null;
  let stockUnit: string = packInfo.baseUnit;
  let calculationSummary: string | null = null;
  let calculatedTotalPrice: number | null = null;
  let priceScopeDescription = 'Total value of entered stock';
  let missingPackagingNotice: string | null = null;

  // Build transparent reference prices from catalogue pack
  let referenceUnitPriceText = 'Not listed';
  if (packInfo.discreteUnitPrice !== null) {
    const unitNoun = formatUnitLabelForCount(1, packInfo.baseUnit);
    referenceUnitPriceText = `৳${formatBdtCurrency(packInfo.discreteUnitPrice)}/${unitNoun}`;
  } else if (packInfo.containerPrice !== null) {
    const cUnit = formatUnitLabelForCount(1, resolvedContainerUnit);
    referenceUnitPriceText = `৳${formatBdtCurrency(packInfo.containerPrice)}/${cUnit}`;
  }

  const referencePackText =
    packInfo.packQuantityLabel && packInfo.pack?.packPrice
      ? `${packInfo.packQuantityLabel} · ৳${packInfo.pack.packPrice}`
      : packInfo.pack?.packPrice
        ? `Pack · ৳${packInfo.pack.packPrice}`
        : null;

  if (mode === 'strips') {
    const stripSize = p2 !== null && p2 > 0 ? p2 : null;
    if (hasCatalogSelection && packInfo.stripUnits === null) {
      missingPackagingNotice = packInfo.packQuantityLabel
        ? `Strip size is not listed in catalogue (${packInfo.packQuantityLabel}). Enter your tablets per strip manually, or switch to ${formatUnitNounCapitalized(packInfo.baseUnit)}.`
        : `Strip size is not listed in catalogue. Enter your tablets per strip manually.`;
    }
    if (p1 !== null && stripSize !== null) {
      stockRemaining = Number((p1 * stripSize).toFixed(2));
      const unitLabel = formatUnitLabelForCount(stockRemaining, packInfo.baseUnit);
      calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${unitLabel} (${formatStockQuantity(p1)} ${p1 === 1 ? 'strip' : 'strips'} × ${formatStockQuantity(stripSize)})`;
      if (packInfo.discreteUnitPrice !== null) {
        calculatedTotalPrice = Number((stockRemaining * packInfo.discreteUnitPrice).toFixed(2));
        priceScopeDescription = `Total value for ${formatStockQuantity(stockRemaining)} ${unitLabel} (Ref: ${referenceUnitPriceText})`;
      }
    }
  } else if (mode === 'packs') {
    const packUnits = packInfo.packTotalUnits;
    if (p1 !== null && packUnits !== null) {
      stockRemaining = Number((p1 * packUnits).toFixed(2));
      const unitLabel = formatUnitLabelForCount(stockRemaining, packInfo.baseUnit);
      calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${unitLabel} (${formatStockQuantity(p1)} ${p1 === 1 ? 'pack' : 'packs'} × ${packUnits})`;
      const packPrice = toPositiveNumber(packInfo.pack?.packPrice);
      if (packPrice !== null) {
        calculatedTotalPrice = Number((p1 * packPrice).toFixed(2));
        priceScopeDescription = `Total value for ${formatStockQuantity(p1)} ${p1 === 1 ? 'pack' : 'packs'} (৳${formatBdtCurrency(packPrice)}/pack)`;
      } else if (packInfo.discreteUnitPrice !== null) {
        calculatedTotalPrice = Number((stockRemaining * packInfo.discreteUnitPrice).toFixed(2));
        priceScopeDescription = `Total value for ${formatStockQuantity(stockRemaining)} ${unitLabel}`;
      }
    }
  } else if (mode === 'bottles') {
    const bottleVol =
      p2 !== null && p2 > 0
        ? p2
        : packInfo.bottleVolumeMl;

    if (packInfo.strategy === 'liquid') {
      stockUnit = 'ml';
      if (hasCatalogSelection && packInfo.bottleVolumeMl === null) {
        missingPackagingNotice =
          'Bottle volume (ml) is not listed in catalogue. Enter ml per bottle manually, or switch to "In ml".';
      }
      if (p1 !== null && bottleVol !== null) {
        stockRemaining = Number((p1 * bottleVol).toFixed(2));
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ml (${formatStockQuantity(p1)} ${p1 === 1 ? 'bottle' : 'bottles'} × ${formatStockQuantity(bottleVol)} ml)`;
      }
    } else {
      // Eye/ear/nasal/pediatric drops stored as bottle count when in bottle mode
      stockUnit = 'bottle';
      if (p1 !== null) {
        stockRemaining = Number(p1.toFixed(2));
        const bottleLabel = formatUnitLabelForCount(stockRemaining, 'bottle');
        if (bottleVol !== null) {
          const totalMl = Number((stockRemaining * bottleVol).toFixed(2));
          calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${bottleLabel} (${formatStockQuantity(totalMl)} ml total)`;
        } else {
          calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${bottleLabel}`;
          if (hasCatalogSelection) {
            missingPackagingNotice =
              'Bottle volume (ml) is not listed in catalogue. Quantity will be tracked in bottles.';
          }
        }
      }
    }

    if (p1 !== null && packInfo.containerPrice !== null) {
      calculatedTotalPrice = Number((p1 * packInfo.containerPrice).toFixed(2));
      const volNote = bottleVol ? `${formatStockQuantity(bottleVol)} ml bottle` : 'bottle';
      priceScopeDescription = `Total value for ${formatStockQuantity(p1)} ${p1 === 1 ? 'bottle' : 'bottles'} (Ref: ৳${formatBdtCurrency(packInfo.containerPrice)} / ${volNote})`;
    }
  } else if (mode === 'ml') {
    stockUnit = 'ml';
    if (p1 !== null) {
      stockRemaining = Number(p1.toFixed(2));
      calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ml`;
      if (packInfo.containerPrice !== null && packInfo.bottleVolumeMl !== null && packInfo.bottleVolumeMl > 0) {
        const perMl = packInfo.containerPrice / packInfo.bottleVolumeMl;
        calculatedTotalPrice = Number((stockRemaining * perMl).toFixed(2));
        priceScopeDescription = `Proportional value for ${formatStockQuantity(stockRemaining)} ml (Ref: ৳${formatBdtCurrency(packInfo.containerPrice)} / ${formatStockQuantity(packInfo.bottleVolumeMl)} ml bottle)`;
      } else if (packInfo.containerPrice !== null && hasCatalogSelection) {
        missingPackagingNotice =
          `Catalogue lists ৳${formatBdtCurrency(packInfo.containerPrice)} per bottle without bottle volume (ml). Enter total stock price manually.`;
      }
    }
  } else if (mode === 'containers') {
    stockUnit = resolvedContainerUnit;
    if (packInfo.strategy === 'injection' && !packInfo.containerUnit && hasCatalogSelection) {
      missingPackagingNotice =
        'Container type (vial, ampoule, or pre-filled syringe) is not specified in catalogue. Choose your unit below.';
    }

    if (packInfo.strategy === 'inhaler') {
      if (packInfo.meteredDoses !== null && p1 !== null) {
        stockUnit = 'puffs';
        stockRemaining = Number((p1 * packInfo.meteredDoses).toFixed(2));
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} puffs (${formatStockQuantity(p1)} × ${packInfo.meteredDoses} puffs)`;
      } else if (p1 !== null) {
        stockUnit = resolvedContainerUnit;
        stockRemaining = Number(p1.toFixed(2));
        const lbl = formatUnitLabelForCount(stockRemaining, stockUnit);
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${lbl}`;
        if (hasCatalogSelection) {
          missingPackagingNotice =
            'Dose/puff count is not listed in catalogue. Quantity is tracked by container.';
        }
      }
    } else if (p1 !== null) {
      stockRemaining = Number(p1.toFixed(2));
      const lbl = formatUnitLabelForCount(stockRemaining, stockUnit);
      if (packInfo.strategy === 'topical' && packInfo.tubeWeightGm !== null) {
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${lbl} (${formatStockQuantity(packInfo.tubeWeightGm)} gm each)`;
      } else if (packInfo.strategy === 'injection' && packInfo.packQuantityLabel) {
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${lbl} (${packInfo.packQuantityLabel})`;
      } else {
        calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${lbl}`;
      }
    }

    if (p1 !== null && packInfo.containerPrice !== null) {
      calculatedTotalPrice = Number((p1 * packInfo.containerPrice).toFixed(2));
      const cLabel = formatUnitLabelForCount(1, resolvedContainerUnit);
      priceScopeDescription = `Total value for ${formatStockQuantity(p1)} ${formatUnitLabelForCount(p1, resolvedContainerUnit)} (Ref: ৳${formatBdtCurrency(packInfo.containerPrice)} / ${cLabel})`;
    }
  } else if (mode === 'puffs') {
    stockUnit = 'puffs';
    if (p1 !== null) {
      stockRemaining = Number(p1.toFixed(2));
      calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${stockRemaining === 1 ? 'puff' : 'puffs'}`;
      if (packInfo.containerPrice !== null && packInfo.meteredDoses !== null && packInfo.meteredDoses > 0) {
        calculatedTotalPrice = Number(((stockRemaining / packInfo.meteredDoses) * packInfo.containerPrice).toFixed(2));
        priceScopeDescription = `Proportional value for ${formatStockQuantity(stockRemaining)} puffs (Ref: ৳${formatBdtCurrency(packInfo.containerPrice)} / ${packInfo.meteredDoses} puffs)`;
      }
    }
  } else {
    // 'direct' mode: tablets, capsules, pieces, sachets, units
    stockUnit = packInfo.baseUnit;

    if (p1 !== null) {
      stockRemaining = Number(p1.toFixed(2));
      const lbl = formatUnitLabelForCount(stockRemaining, stockUnit);
      calculationSummary = `Total stock: ${formatStockQuantity(stockRemaining)} ${lbl}`;
      if (packInfo.discreteUnitPrice !== null) {
        calculatedTotalPrice = Number((stockRemaining * packInfo.discreteUnitPrice).toFixed(2));
        priceScopeDescription = `Total value for ${formatStockQuantity(stockRemaining)} ${lbl} (Ref: ${referenceUnitPriceText})`;
      }
    }
  }

  return {
    stockRemaining,
    stockUnit,
    calculationSummary,
    calculatedTotalPrice,
    referenceUnitPriceText,
    referencePackText,
    priceScopeDescription,
    missingPackagingNotice,
    isValid: stockRemaining !== null && stockRemaining >= 0,
  };
}

function toPositiveNumberAllowZero(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function getPriceUnitBasis(params: {
  mode: StockEntryMode;
  primaryQty: string;
  stockRemaining: number | null;
  containerUnit: string;
  stockUnit: string;
}): { multiplier: number | null; unitLabel: string } {
  const { mode, primaryQty, stockRemaining, containerUnit, stockUnit } = params;
  const p1 = toPositiveNumberAllowZero(primaryQty);

  if (mode === 'bottles') {
    return {
      multiplier: p1 !== null && p1 > 0 ? p1 : null,
      unitLabel: 'bottle',
    };
  }
  if (mode === 'packs') {
    return {
      multiplier: p1 !== null && p1 > 0 ? p1 : null,
      unitLabel: 'pack',
    };
  }
  if (mode === 'containers') {
    return {
      multiplier: p1 !== null && p1 > 0 ? p1 : null,
      unitLabel: formatUnitLabelForCount(1, containerUnit),
    };
  }
  return {
    multiplier: stockRemaining !== null && stockRemaining > 0 ? stockRemaining : null,
    unitLabel: formatUnitLabelForCount(1, stockUnit),
  };
}
