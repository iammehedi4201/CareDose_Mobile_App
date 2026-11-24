import { apiRequest } from './config';
import type { InventoryTransactionItemDto } from './inventory';

export interface PurchaseItemDto {
  id: string;
  patientId: string;
  patientMedicationId: string;
  purchaseDate: string;
  purchaseDateYmd: string;
  packCount: number;
  unitsPerPack: string;
  totalUnitsAdded: string;
  amountPaid: string;
  unitPrice: string | null;
  currency: string;
  vendor: string | null;
  note: string | null;
  createdAt: string;
  medication: {
    id: string;
    name: string;
    strength: string | null;
    dosageForm: string | null;
    stockUnit: string;
  } | null;
}

export interface PurchaseListResponseDto {
  items: PurchaseItemDto[];
  summary: {
    totalCount: number;
    totalAmountPaid: string;
    currency: string;
  };
  nextCursor: string | null;
}

export interface CreatePurchasePayload {
  purchaseDate?: string;
  packCount: number;
  unitsPerPack: number;
  amountPaid: number;
  currency?: 'BDT';
  vendor?: string;
  note?: string;
  cataloguePackId?: string;
  enteredUnit?: string;
}

export interface RecordPurchaseResultDto {
  purchase: PurchaseItemDto;
  medicationId: string;
  newStockRemaining: string;
  stockUnit: string;
  isLowStock: boolean;
  inventoryTransaction: InventoryTransactionItemDto;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function listPatientPurchases(
  patientId: string,
  token: string,
  query: {
    medicationId?: string;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<PurchaseListResponseDto> {
  const params: string[] = [];
  if (query.medicationId) params.push(`medicationId=${encodeURIComponent(query.medicationId)}`);
  if (query.from) params.push(`from=${encodeURIComponent(query.from)}`);
  if (query.to) params.push(`to=${encodeURIComponent(query.to)}`);
  if (query.limit !== undefined) params.push(`limit=${query.limit}`);
  if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<PurchaseListResponseDto>(
    `/patients/${encodeURIComponent(patientId)}/purchases${qs}`,
    { headers: authHeaders(token) },
  );
}

export function listMedicationPurchases(
  medicationId: string,
  token: string,
  query: { from?: string; to?: string; limit?: number; cursor?: string } = {},
): Promise<PurchaseListResponseDto> {
  const params: string[] = [];
  if (query.from) params.push(`from=${encodeURIComponent(query.from)}`);
  if (query.to) params.push(`to=${encodeURIComponent(query.to)}`);
  if (query.limit !== undefined) params.push(`limit=${query.limit}`);
  if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<PurchaseListResponseDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/purchases${qs}`,
    { headers: authHeaders(token) },
  );
}

export function recordMedicationPurchase(
  medicationId: string,
  token: string,
  payload: CreatePurchasePayload,
): Promise<RecordPurchaseResultDto> {
  return apiRequest<RecordPurchaseResultDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/purchases`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}
