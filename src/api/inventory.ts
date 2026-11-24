import { apiRequest } from './config';

export type InventoryTransactionTypeDto =
  | 'OPENING_STOCK'
  | 'PURCHASE'
  | 'DOSE_CONSUMPTION'
  | 'WASTAGE'
  | 'ADJUSTMENT';

export type AdjustStockModeDto = 'ADD' | 'SET' | 'DEDUCT';

export interface InventoryTransactionItemDto {
  id: string;
  patientMedicationId: string;
  doseEventId: string | null;
  purchaseId: string | null;
  cataloguePackId: string | null;
  type: InventoryTransactionTypeDto;
  enteredQuantity: string | null;
  enteredUnit: string | null;
  baseUnit: string | null;
  quantityDelta: string;
  balanceAfter: string;
  reason: string | null;
  note: string | null;
  createdAt: string;
}

export interface InventoryLedgerResponseDto {
  medicationId: string;
  stockRemaining: string;
  stockUnit: string;
  lowStockThreshold: string;
  isLowStock: boolean;
  items: InventoryTransactionItemDto[];
  nextCursor: string | null;
}

export interface AdjustMedicationStockPayload {
  mode: AdjustStockModeDto;
  quantity: number;
  enteredQuantity?: number;
  enteredUnit?: string;
  reason?: string;
  note?: string;
  transactionType?: 'ADJUSTMENT' | 'WASTAGE';
}

export interface StockAdjustmentResultDto {
  medicationId: string;
  stockRemaining: string;
  stockUnit: string;
  lowStockThreshold: string;
  isLowStock: boolean;
  transaction: InventoryTransactionItemDto;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function listMedicationInventory(
  medicationId: string,
  token: string,
  query: { type?: InventoryTransactionTypeDto; limit?: number; cursor?: string } = {},
): Promise<InventoryLedgerResponseDto> {
  const params: string[] = [];
  if (query.type) params.push(`type=${encodeURIComponent(query.type)}`);
  if (query.limit !== undefined) params.push(`limit=${query.limit}`);
  if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<InventoryLedgerResponseDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/inventory${qs}`,
    { headers: authHeaders(token) },
  );
}

export function adjustMedicationInventory(
  medicationId: string,
  token: string,
  payload: AdjustMedicationStockPayload,
): Promise<StockAdjustmentResultDto> {
  return apiRequest<StockAdjustmentResultDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/inventory/adjust`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}
