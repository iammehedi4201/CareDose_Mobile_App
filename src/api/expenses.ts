import { apiRequest } from './config';
import type { PurchaseItemDto } from './purchases';

export interface MonthlySpendPointDto {
  month: string;
  shortLabel: string;
  yearLabel: string;
  totalSpent: string;
  purchaseCount: number;
  isSelected: boolean;
}

export interface MedicationSpendBreakdownItemDto {
  medicationId: string;
  medicationName: string;
  strength: string | null;
  dosageForm: string | null;
  stockUnit: string;
  totalSpent: string;
  totalUnitsAdded: string;
  purchaseCount: number;
}

export interface EstimatedMedicationCostItemDto {
  medicationId: string;
  medicationName: string;
  strength: string | null;
  estimatedCost: string;
  monthlyUnits: string;
  stockUnit: string;
  unitPriceUsed: string;
  priceSource: 'confirmed_purchase' | 'catalogue_reference';
  scheduleSummary: string;
}

export interface EstimatedMedicationExcludedItemDto {
  medicationId: string;
  medicationName: string;
  reason: string;
}

export interface ExpensesSummaryResponseDto {
  patientId: string;
  timezone: string;
  selectedMonth: string;
  currency: string;
  actualSpent: string;
  monthlyBudget: string | null;
  budgetRemaining: string | null;
  budgetUtilizationPercent: number | null;
  monthlySeries: MonthlySpendPointDto[];
  medicationBreakdown: MedicationSpendBreakdownItemDto[];
  recentPurchases: PurchaseItemDto[];
  estimatedMonthlyCost: {
    hasEstimate: boolean;
    totalEstimatedCost: string | null;
    includedCount: number;
    excludedCount: number;
    disclaimer: string;
    items: EstimatedMedicationCostItemDto[];
    excludedItems: EstimatedMedicationExcludedItemDto[];
  };
}

export function getPatientExpensesSummary(
  patientId: string,
  token: string,
  query: { month?: string; monthsCount?: number } = {},
): Promise<ExpensesSummaryResponseDto> {
  const params: string[] = [];
  if (query.month) params.push(`month=${encodeURIComponent(query.month)}`);
  if (query.monthsCount !== undefined) params.push(`monthsCount=${query.monthsCount}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<ExpensesSummaryResponseDto>(
    `/patients/${encodeURIComponent(patientId)}/expenses${qs}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
