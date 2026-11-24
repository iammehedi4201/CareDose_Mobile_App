import type {
  EstimatedMedicationCostItemDto,
  EstimatedMedicationExcludedItemDto,
  ExpensesSummaryResponseDto,
  MedicationSpendBreakdownItemDto,
  MonthlySpendPointDto,
} from '../../api/expenses';
import type { AdjustStockModeDto } from '../../api/inventory';
import type { PurchaseItemDto } from '../../api/purchases';
import type { PersonalMedicationRecord } from '../medications/medication-helpers';
import {
  formatBdtCurrency,
  formatStockWithUnit,
} from '../medications/stock-calculator';
import {
  canConvertDoseUnitToStockUnit,
  getTodayLocalYmd,
  LocalScheduleRecord,
  normalizeScheduleFrequencyCode,
} from '../schedule/dose-rules';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const DISCRETE_STOCK_UNITS = new Set([
  'tablet',
  'tablets',
  'capsule',
  'capsules',
  'piece',
  'pieces',
  'sachet',
  'sachets',
  'suppository',
  'suppositories',
  'puff',
  'puffs',
]);

const CONTAINER_STOCK_UNITS = new Set([
  'bottle',
  'bottles',
  'vial',
  'vials',
  'ampoule',
  'ampoules',
  'syringe',
  'syringes',
  'tube',
  'tubes',
  'pen',
  'pens',
  'bag',
  'bags',
]);

export interface PurchaseFormDraft {
  medicationId: string;
  purchaseDate: string;
  packCount: string;
  unitsPerPack: string;
  amountPaid: string;
  vendor?: string;
  note?: string;
}

export interface ValidatedPurchaseInput {
  medicationId: string;
  purchaseDate: string;
  packCount: number;
  unitsPerPack: number;
  totalUnitsAdded: number;
  amountPaid: number;
  vendor?: string;
  note?: string;
}

/**
 * Formats a BDT amount cleanly for display cards and badges.
 * Whole taka amounts omit trailing .00 for compact card headings unless keepDecimals is true.
 */
export function formatBdtAmount(
  amount: number | string,
  options: { keepDecimals?: boolean } = {},
): string {
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(num)) return '৳0';
  const rounded = Number(num.toFixed(2));
  if (!options.keepDecimals && Number.isInteger(rounded)) {
    return `৳${rounded.toLocaleString('en-US')}`;
  }
  const fixed = formatBdtCurrency(rounded);
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = Number(intPart).toLocaleString('en-US');
  return decPart ? `৳${formattedInt}.${decPart}` : `৳${formattedInt}`;
}

export function formatPurchaseDateCompact(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return ymd;
  const monthLabel = SHORT_MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${Number(m[3])} ${monthLabel} ${m[1]}`;
}

export function getCurrentMonthYm(todayYmd = getTodayLocalYmd()): string {
  return todayYmd.slice(0, 7);
}

export function shiftMonthYm(ym: string, deltaMonths: number): string {
  const [yStr, mStr] = ym.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const d = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthHeading(ym: string): string {
  const [yStr, mStr] = ym.split('-');
  const monthLabel = SHORT_MONTHS[Number(mStr) - 1] ?? mStr;
  return `${monthLabel} ${yStr}`;
}

export function computePurchaseTotalUnits(
  packCount: number,
  unitsPerPack: number,
): number {
  if (!Number.isFinite(packCount) || !Number.isFinite(unitsPerPack)) return 0;
  return Number(Math.max(0, packCount * unitsPerPack).toFixed(2));
}

export function computePurchaseUnitPrice(
  amountPaid: number,
  totalUnitsAdded: number,
): number | null {
  if (!Number.isFinite(amountPaid) || !Number.isFinite(totalUnitsAdded)) return null;
  if (amountPaid < 0 || totalUnitsAdded <= 0) return null;
  return Number((amountPaid / totalUnitsAdded).toFixed(2));
}

export function validatePurchaseDraft(draft: PurchaseFormDraft): {
  valid: ValidatedPurchaseInput | null;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!draft.medicationId.trim()) {
    errors.medicationId = 'Select a medicine.';
  }

  const dateStr = draft.purchaseDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    errors.purchaseDate = 'Enter a valid purchase date (YYYY-MM-DD).';
  }

  const packCountNum = Number(draft.packCount.trim());
  if (!Number.isInteger(packCountNum) || packCountNum < 1 || packCountNum > 100000) {
    errors.packCount = 'Enter a whole number of packs (1 or more).';
  }

  const unitsNum = Number(draft.unitsPerPack.trim());
  if (!Number.isFinite(unitsNum) || unitsNum <= 0 || unitsNum > 100000) {
    errors.unitsPerPack = 'Enter valid units per pack (> 0).';
  }

  const amountNum = Number(draft.amountPaid.trim());
  if (
    draft.amountPaid.trim().length === 0 ||
    !Number.isFinite(amountNum) ||
    amountNum < 0 ||
    amountNum > 10000000
  ) {
    errors.amountPaid = 'Enter a valid non-negative amount in BDT.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: null, errors };
  }

  const roundedUnits = Number(unitsNum.toFixed(2));
  const totalUnitsAdded = computePurchaseTotalUnits(packCountNum, roundedUnits);
  return {
    valid: {
      medicationId: draft.medicationId.trim(),
      purchaseDate: dateStr,
      packCount: packCountNum,
      unitsPerPack: roundedUnits,
      totalUnitsAdded,
      amountPaid: Number(amountNum.toFixed(2)),
      vendor: draft.vendor?.trim() || undefined,
      note: draft.note?.trim() || undefined,
    },
    errors: {},
  };
}

export function computeProjectedStockBalance(
  currentStock: number,
  mode: AdjustStockModeDto,
  quantityRaw: string,
): { nextBalance: number | null; quantityValue: number | null; error: string | null } {
  const trimmed = quantityRaw.trim();
  if (!trimmed) {
    return { nextBalance: null, quantityValue: null, error: 'Quantity is required.' };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000000) {
    return { nextBalance: null, quantityValue: null, error: 'Enter a valid non-negative quantity.' };
  }
  const qty = Number(parsed.toFixed(2));
  if ((mode === 'ADD' || mode === 'DEDUCT') && qty <= 0) {
    return { nextBalance: null, quantityValue: null, error: 'Quantity must be greater than 0.' };
  }
  if (mode === 'ADD') {
    return {
      nextBalance: Number((currentStock + qty).toFixed(2)),
      quantityValue: qty,
      error: null,
    };
  }
  if (mode === 'DEDUCT') {
    const next = Number((currentStock - qty).toFixed(2));
    if (next < 0) {
      return {
        nextBalance: null,
        quantityValue: qty,
        error: 'Deduction exceeds current stock. Use Set balance to set 0.',
      };
    }
    return { nextBalance: next, quantityValue: qty, error: null };
  }
  return { nextBalance: qty, quantityValue: qty, error: null };
}

export function filterPurchasesList(
  purchases: PurchaseItemDto[],
  filters: { medicationId?: string | null; query?: string },
): PurchaseItemDto[] {
  const medFilter = filters.medicationId?.trim();
  const q = (filters.query ?? '').trim().toLowerCase();

  return purchases.filter((item) => {
    if (medFilter && medFilter !== 'ALL' && item.patientMedicationId !== medFilter) {
      return false;
    }
    if (q.length > 0) {
      const hay = `${item.medication?.name ?? ''} ${item.medication?.strength ?? ''} ${item.vendor ?? ''} ${item.note ?? ''}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });
}

function parseUnitPriceFromText(med: PersonalMedicationRecord): {
  price: number | null;
  source: 'confirmed_purchase' | 'catalogue_reference' | null;
} {
  const text = (med.unitPriceText ?? '').trim();
  const match = /৳\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(unit|bottle|vial|pack)/i.exec(text);
  if (!match) return { price: null, source: null };
  const val = Number(match[1]);
  const basis = match[2].toLowerCase();
  if (!Number.isFinite(val) || val <= 0) return { price: null, source: null };
  const unitLower = med.stockUnit.toLowerCase();

  if (basis === 'unit' && DISCRETE_STOCK_UNITS.has(unitLower)) {
    return { price: val, source: 'catalogue_reference' };
  }
  if (basis !== 'unit' && CONTAINER_STOCK_UNITS.has(unitLower)) {
    return { price: val, source: 'catalogue_reference' };
  }
  return { price: null, source: null };
}

function estimateMonthlyScheduleFactor(schedule: LocalScheduleRecord): {
  factor: number | null;
  summary: string;
} {
  const code = normalizeScheduleFrequencyCode(schedule.frequency);
  const timesCount = Math.max(schedule.scheduledTimes.length, 1);
  if (code === 'AS_NEEDED') {
    return { factor: null, summary: 'As needed' };
  }
  if (code === 'ALTERNATE_DAYS') {
    return { factor: timesCount * 15, summary: `${timesCount}x every 2 days` };
  }
  if (code === 'WEEKLY') {
    return { factor: (timesCount * 30) / 7, summary: `${timesCount}x weekly` };
  }
  if (code === 'SELECTED_WEEKDAYS') {
    const days = Math.max(schedule.weekdays?.length ?? 0, 1);
    return { factor: (timesCount * days * 30) / 7, summary: `${timesCount}x · ${days} days/wk` };
  }
  return { factor: timesCount * 30, summary: `${timesCount}x daily` };
}

export function buildLocalExpensesSummary(params: {
  purchases: PurchaseItemDto[];
  medications: PersonalMedicationRecord[];
  schedules: LocalScheduleRecord[];
  selectedMonth?: string;
  monthlyBudget: number | null;
  monthsCount?: number;
  todayYmd?: string;
}): ExpensesSummaryResponseDto {
  const todayYmd = params.todayYmd ?? getTodayLocalYmd();
  const selectedMonth = params.selectedMonth ?? getCurrentMonthYm(todayYmd);
  const monthsCount = Math.min(Math.max(params.monthsCount ?? 6, 1), 12);

  const monthKeys: string[] = [];
  for (let offset = -(monthsCount - 1); offset <= 0; offset += 1) {
    monthKeys.push(shiftMonthYm(selectedMonth, offset));
  }

  const monthTotals = new Map<string, { totalPaisa: number; count: number }>();
  for (const ym of monthKeys) {
    monthTotals.set(ym, { totalPaisa: 0, count: 0 });
  }

  const medBreakdownMap = new Map<
    string,
    {
      medicationId: string;
      medicationName: string;
      strength: string | null;
      dosageForm: string | null;
      stockUnit: string;
      totalPaisa: number;
      totalUnitsHundredths: number;
      purchaseCount: number;
    }
  >();

  const medById = new Map(params.medications.map((m) => [m.id, m]));

  for (const p of params.purchases) {
    const ym = p.purchaseDateYmd.slice(0, 7);
    const paisa = Math.round(Number(p.amountPaid) * 100);
    const unitsHundredths = Math.round(Number(p.totalUnitsAdded) * 100);

    const bucket = monthTotals.get(ym);
    if (bucket) {
      bucket.totalPaisa += paisa;
      bucket.count += 1;
    }

    if (ym === selectedMonth) {
      const med = medById.get(p.patientMedicationId);
      const existing = medBreakdownMap.get(p.patientMedicationId) ?? {
        medicationId: p.patientMedicationId,
        medicationName: p.medication?.name ?? med?.name ?? 'Medicine',
        strength: p.medication?.strength ?? med?.strength ?? null,
        dosageForm: p.medication?.dosageForm ?? med?.dosageForm ?? null,
        stockUnit: p.medication?.stockUnit ?? med?.stockUnit ?? 'units',
        totalPaisa: 0,
        totalUnitsHundredths: 0,
        purchaseCount: 0,
      };
      existing.totalPaisa += paisa;
      existing.totalUnitsHundredths += unitsHundredths;
      existing.purchaseCount += 1;
      medBreakdownMap.set(p.patientMedicationId, existing);
    }
  }

  const monthlySeries: MonthlySpendPointDto[] = monthKeys.map((ym) => {
    const [yStr, mStr] = ym.split('-');
    const bucket = monthTotals.get(ym) ?? { totalPaisa: 0, count: 0 };
    return {
      month: ym,
      shortLabel: SHORT_MONTHS[Number(mStr) - 1] ?? mStr,
      yearLabel: yStr,
      totalSpent: (bucket.totalPaisa / 100).toFixed(2),
      purchaseCount: bucket.count,
      isSelected: ym === selectedMonth,
    };
  });

  const selectedPaisa = monthTotals.get(selectedMonth)?.totalPaisa ?? 0;
  const actualSpentNum = selectedPaisa / 100;
  const budgetRemainingNum =
    params.monthlyBudget !== null ? Number((params.monthlyBudget - actualSpentNum).toFixed(2)) : null;
  const budgetUtil =
    params.monthlyBudget !== null && params.monthlyBudget > 0
      ? Number(((actualSpentNum / params.monthlyBudget) * 100).toFixed(1))
      : null;

  const medicationBreakdown: MedicationSpendBreakdownItemDto[] = [...medBreakdownMap.values()]
    .sort((a, b) => b.totalPaisa - a.totalPaisa)
    .map((entry) => ({
      medicationId: entry.medicationId,
      medicationName: entry.medicationName,
      strength: entry.strength,
      dosageForm: entry.dosageForm,
      stockUnit: entry.stockUnit,
      totalSpent: (entry.totalPaisa / 100).toFixed(2),
      totalUnitsAdded: (entry.totalUnitsHundredths / 100).toFixed(2),
      purchaseCount: entry.purchaseCount,
    }));

  const sortedRecent = [...params.purchases]
    .sort((a, b) => b.purchaseDateYmd.localeCompare(a.purchaseDateYmd) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  // Estimate future 30-day cost cleanly
  const estimatedItems: EstimatedMedicationCostItemDto[] = [];
  const excludedItems: EstimatedMedicationExcludedItemDto[] = [];
  let totalEstPaisa = 0;

  for (const med of params.medications) {
    if (med.archived) continue;
    const activeSchedules = params.schedules.filter(
      (s) =>
        s.patientMedicationId === med.id &&
        s.status === 'ACTIVE' &&
        (!s.endDateYmd || s.endDateYmd >= `${selectedMonth}-01`),
    );
    if (activeSchedules.length === 0) continue;

    const latestPaidPurchase = [...params.purchases]
      .filter(
        (p) =>
          p.patientMedicationId === med.id &&
          Number(p.amountPaid) > 0 &&
          Number(p.totalUnitsAdded) > 0,
      )
      .sort((a, b) => b.purchaseDateYmd.localeCompare(a.purchaseDateYmd))[0];

    let unitPrice: number | null = null;
    let priceSource: 'confirmed_purchase' | 'catalogue_reference' | null = null;
    if (latestPaidPurchase) {
      unitPrice = Number(latestPaidPurchase.amountPaid) / Number(latestPaidPurchase.totalUnitsAdded);
      priceSource = 'confirmed_purchase';
    } else {
      const ref = parseUnitPriceFromText(med);
      unitPrice = ref.price;
      priceSource = ref.source;
    }

    if (!unitPrice || !priceSource) {
      excludedItems.push({
        medicationId: med.id,
        medicationName: med.name,
        reason: 'Unit price unknown — record a purchase to confirm price.',
      });
      continue;
    }

    let monthlyUnits = 0;
    const summaryParts: string[] = [];
    let excludedReason: string | null = null;
    for (const sched of activeSchedules) {
      if (!canConvertDoseUnitToStockUnit(sched.doseUnit, med.stockUnit)) {
        excludedReason = `Dose unit (${sched.doseUnit}) differs from stock unit (${med.stockUnit}).`;
        break;
      }
      const { factor, summary } = estimateMonthlyScheduleFactor(sched);
      if (factor === null || sched.doseAmount <= 0) {
        excludedReason = 'As-needed or variable schedule cannot be forecasted.';
        break;
      }
      monthlyUnits += sched.doseAmount * factor;
      summaryParts.push(summary);
    }

    if (excludedReason || monthlyUnits <= 0) {
      excludedItems.push({
        medicationId: med.id,
        medicationName: med.name,
        reason: excludedReason ?? 'No fixed dose frequency found.',
      });
      continue;
    }

    const estPaisa = Math.round(monthlyUnits * unitPrice * 100);
    totalEstPaisa += estPaisa;
    estimatedItems.push({
      medicationId: med.id,
      medicationName: med.name,
      strength: med.strength ?? null,
      estimatedCost: (estPaisa / 100).toFixed(2),
      monthlyUnits: monthlyUnits.toFixed(2),
      stockUnit: med.stockUnit,
      unitPriceUsed: unitPrice.toFixed(2),
      priceSource,
      scheduleSummary: summaryParts.join(', '),
    });
  }

  estimatedItems.sort((a, b) => Number(b.estimatedCost) - Number(a.estimatedCost));

  return {
    patientId: 'local-patient',
    timezone: 'Asia/Dhaka',
    selectedMonth,
    currency: 'BDT',
    actualSpent: actualSpentNum.toFixed(2),
    monthlyBudget: params.monthlyBudget !== null ? params.monthlyBudget.toFixed(2) : null,
    budgetRemaining: budgetRemainingNum !== null ? budgetRemainingNum.toFixed(2) : null,
    budgetUtilizationPercent: budgetUtil,
    monthlySeries,
    medicationBreakdown,
    recentPurchases: sortedRecent,
    estimatedMonthlyCost: {
      hasEstimate: estimatedItems.length > 0,
      totalEstimatedCost: estimatedItems.length > 0 ? (totalEstPaisa / 100).toFixed(2) : null,
      includedCount: estimatedItems.length,
      excludedCount: excludedItems.length,
      disclaimer:
        'Estimated 30-day cost from active fixed schedules and confirmed purchase or verified reference prices. Kept separate from actual recorded spending.',
      items: estimatedItems,
      excludedItems,
    },
  };
}

export const PURCHASES_STORAGE_KEY = 'caredose:purchases:v2';

export interface InitialMedicationPurchaseInput {
  amountPaid: number;
  purchaseDate?: string;
  packCount?: number;
  unitsPerPack?: number;
  vendor?: string;
  note?: string;
}

export interface PurchaseRefillSuggestion {
  lastVendor: string | null;
  recentVendors: string[];
  lastUnitsPerPack: number | null;
  lastPackCount: number | null;
  lastAmountPaid: number | null;
  lastPurchaseDateYmd: string | null;
}

export function formatPurchasePackSummary(purchase: PurchaseItemDto): string {
  const unit = purchase.medication?.stockUnit ?? 'units';
  return `${purchase.packCount} ${purchase.packCount === 1 ? 'pack' : 'packs'} (${formatStockWithUnit(
    purchase.totalUnitsAdded,
    unit,
  )})`;
}

/**
 * Mirrors backend MedicationsService.createForPatient initial-purchase math
 * so offline/local additions appear in Purchase History and Expenses immediately.
 */
export function buildLocalPurchaseFromInitialMedication(params: {
  medication: PersonalMedicationRecord;
  purchaseDetails: InitialMedicationPurchaseInput;
  enteredQuantity?: number;
  todayYmd?: string;
}): PurchaseItemDto {
  const { medication, purchaseDetails } = params;
  const totalUnits = Math.max(0, Number(medication.stockRemaining.toFixed(2)));
  const enteredQty = params.enteredQuantity;
  const derivedPackCount =
    purchaseDetails.packCount ??
    (enteredQty !== undefined && enteredQty > 0 && Number.isInteger(enteredQty)
      ? Math.max(1, enteredQty)
      : 1);
  const derivedUnitsPerPack =
    purchaseDetails.unitsPerPack ??
    (totalUnits > 0 ? Math.max(0.01, Number((totalUnits / derivedPackCount).toFixed(2))) : 1);

  const rawDate = purchaseDetails.purchaseDate?.trim() || params.todayYmd || getTodayLocalYmd();
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : getTodayLocalYmd();
  const unitPrice = computePurchaseUnitPrice(purchaseDetails.amountPaid, totalUnits);
  const nowIso = new Date().toISOString();

  return {
    id: `pur-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patientId: 'local-patient',
    patientMedicationId: medication.id,
    purchaseDate: `${ymd}T12:00:00.000Z`,
    purchaseDateYmd: ymd,
    packCount: derivedPackCount,
    unitsPerPack: derivedUnitsPerPack.toFixed(2),
    totalUnitsAdded: totalUnits.toFixed(2),
    amountPaid: Number(purchaseDetails.amountPaid).toFixed(2),
    unitPrice: unitPrice !== null ? unitPrice.toFixed(2) : null,
    currency: 'BDT',
    vendor: purchaseDetails.vendor?.trim() || null,
    note: purchaseDetails.note?.trim() || null,
    createdAt: nowIso,
    medication: {
      id: medication.id,
      name: medication.name,
      strength: medication.strength ?? null,
      dosageForm: medication.dosageForm,
      stockUnit: medication.stockUnit,
    },
  };
}

/**
 * Extracts smart refill defaults (previous pharmacy, pack size, and last paid amount)
 * from recorded purchase history for a given medication.
 */
export function getPurchaseRefillSuggestion(
  purchases: PurchaseItemDto[],
  medicationId: string,
): PurchaseRefillSuggestion {
  const sortNewestFirst = (a: PurchaseItemDto, b: PurchaseItemDto): number => {
    const byDate = b.purchaseDateYmd.localeCompare(a.purchaseDateYmd);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  };

  const medPurchases = [...purchases]
    .filter((p) => p.patientMedicationId === medicationId)
    .sort(sortNewestFirst);
  const latestMedPurchase = medPurchases[0] ?? null;

  const lastVendorForMed =
    medPurchases.find((p) => (p.vendor ?? '').trim().length > 0)?.vendor?.trim() ?? null;

  const recentVendors: string[] = [];
  const seenLower = new Set<string>();
  const pushVendor = (raw?: string | null): void => {
    const clean = (raw ?? '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seenLower.has(key)) return;
    seenLower.add(key);
    recentVendors.push(clean);
  };

  for (const p of medPurchases) {
    pushVendor(p.vendor);
    if (recentVendors.length >= 4) break;
  }
  if (recentVendors.length < 4) {
    for (const p of [...purchases].sort(sortNewestFirst)) {
      pushVendor(p.vendor);
      if (recentVendors.length >= 4) break;
    }
  }

  const rawUnitsPerPack = latestMedPurchase ? Number(latestMedPurchase.unitsPerPack) : NaN;
  const rawAmountPaid = latestMedPurchase ? Number(latestMedPurchase.amountPaid) : NaN;

  return {
    lastVendor: lastVendorForMed,
    recentVendors,
    lastUnitsPerPack:
      Number.isFinite(rawUnitsPerPack) && rawUnitsPerPack > 0 ? rawUnitsPerPack : null,
    lastPackCount:
      latestMedPurchase && latestMedPurchase.packCount > 0
        ? latestMedPurchase.packCount
        : null,
    lastAmountPaid:
      Number.isFinite(rawAmountPaid) && rawAmountPaid >= 0 ? rawAmountPaid : null,
    lastPurchaseDateYmd: latestMedPurchase?.purchaseDateYmd ?? null,
  };
}
