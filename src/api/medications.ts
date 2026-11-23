import { apiRequest } from './config';
import type { CatalogueBrandSummaryDto } from './catalogue';

export type MedicationStatusDto = 'ACTIVE' | 'ARCHIVED';

export interface PatientMedicationDto {
  id: string;
  patientId: string;
  catalogueBrandId: string | null;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  manufacturer: string | null;
  personalInstructions: string;
  stockRemaining: string;
  stockUnit: string;
  lowStockThreshold: string;
  status: MedicationStatusDto;
  isLowStock: boolean;
  schedulesCount: number;
  purchasesCount: number;
  catalogueBrand: CatalogueBrandSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientMedicationDetailDto extends PatientMedicationDto {
  schedules: Array<{
    id: string;
    doseAmount: string;
    doseUnit: string;
    frequency: string;
    scheduledTimes: string[];
    startDate: string;
    endDate: string | null;
    instructions: string | null;
    remindersEnabled: boolean;
    status: string;
  }>;
  recentPurchases: Array<{
    id: string;
    purchaseDate: string;
    packCount: number;
    unitsPerPack: string;
    totalUnitsAdded: string;
    amountPaid: string;
    currency: string;
    vendor: string | null;
  }>;
  recentDoseEvents: Array<{
    id: string;
    scheduledFor: string;
    status: string;
    recordedAt: string | null;
    note: string | null;
  }>;
  recentInventoryTransactions: Array<{
    id: string;
    type: string;
    enteredQuantity: string | null;
    enteredUnit: string | null;
    baseUnit: string | null;
    cataloguePackId: string | null;
    quantityDelta: string;
    balanceAfter: string;
    reason: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

export interface CreateInitialPurchasePayload {
  purchaseDate?: string;
  packCount?: number;
  unitsPerPack?: number;
  amountPaid: number;
  vendor?: string;
  note?: string;
}

export interface CreatePatientMedicationPayload {
  catalogueBrandId?: string;
  name?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  personalInstructions?: string;
  startingStock?: number;
  stockUnit?: string;
  enteredQuantity?: number;
  enteredUnit?: string;
  selectedPackId?: string;
  purchaseDetails?: CreateInitialPurchasePayload;
  lowStockThreshold?: number;
}

export interface UpdatePatientMedicationPayload {
  name?: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  personalInstructions?: string;
  stockUnit?: string;
  lowStockThreshold?: number;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function listPatientMedications(
  patientId: string,
  token: string,
  query: { q?: string; status?: 'ALL' | 'ACTIVE' | 'ARCHIVED'; lowStock?: boolean } = {},
): Promise<PatientMedicationDto[]> {
  const params: string[] = [];
  if (query.q && query.q.trim().length > 0) {
    params.push(`q=${encodeURIComponent(query.q.trim())}`);
  }
  if (query.status) {
    params.push(`status=${encodeURIComponent(query.status)}`);
  }
  if (query.lowStock) {
    params.push('lowStock=true');
  }
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<PatientMedicationDto[]>(
    `/patients/${encodeURIComponent(patientId)}/medications${qs}`,
    { headers: authHeaders(token) },
  );
}

export function createPatientMedication(
  patientId: string,
  token: string,
  payload: CreatePatientMedicationPayload,
): Promise<PatientMedicationDto> {
  return apiRequest<PatientMedicationDto>(
    `/patients/${encodeURIComponent(patientId)}/medications`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

export function getPatientMedicationDetail(
  medicationId: string,
  token: string,
): Promise<PatientMedicationDetailDto> {
  return apiRequest<PatientMedicationDetailDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}`,
    { headers: authHeaders(token) },
  );
}

export function updatePatientMedication(
  medicationId: string,
  token: string,
  payload: UpdatePatientMedicationPayload,
): Promise<PatientMedicationDto> {
  return apiRequest<PatientMedicationDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

export function archivePatientMedication(
  medicationId: string,
  token: string,
): Promise<PatientMedicationDto> {
  return apiRequest<PatientMedicationDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/archive`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
}

export function restorePatientMedication(
  medicationId: string,
  token: string,
): Promise<PatientMedicationDto> {
  return apiRequest<PatientMedicationDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/restore`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
}
