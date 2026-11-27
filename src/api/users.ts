import { apiRequest } from './config';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  glucoseUnit: 'MG_DL' | 'MMOL_L';
  currency: string;
  monthlyBudget: string | null;
  remindersEnabled: boolean;
  soundEnabled: boolean;
  reminderLeadMins: number;
}

export interface UpdateUserSettingsPayload {
  displayName?: string;
  glucoseUnit?: 'MG_DL' | 'MMOL_L';
  monthlyBudget?: number | null;
  remindersEnabled?: boolean;
  soundEnabled?: boolean;
  reminderLeadMins?: number;
}

export interface AccountBackupSummaryDto {
  profilesCount: number;
  medicationsCount: number;
  schedulesCount: number;
  doseEventsCount: number;
  purchasesCount: number;
  inventoryTransactionsCount: number;
  healthReadingsCount: number;
}

export interface BackupScheduleItemDto {
  id: string;
  doseAmount: string;
  doseUnit: string;
  frequency: string;
  intervalHours: number | null;
  weekdays: number[];
  scheduledTimes: string[];
  startDate: string;
  endDate: string | null;
  instructions: string | null;
  remindersEnabled: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupDoseEventItemDto {
  id: string;
  scheduleId: string;
  scheduledFor: string;
  status: 'PLANNED' | 'TAKEN' | 'SKIPPED';
  recordedAt: string | null;
  note: string | null;
  createdAt?: string;
}

export interface BackupPurchaseItemDto {
  id: string;
  purchaseDate: string;
  packCount: number;
  unitsPerPack: string;
  totalUnitsAdded: string;
  amountPaid: string;
  currency: string;
  vendor: string | null;
  note: string | null;
  createdAt?: string;
}

export interface BackupInventoryTxItemDto {
  id: string;
  doseEventId: string | null;
  purchaseId: string | null;
  cataloguePackId: string | null;
  type: 'OPENING_STOCK' | 'PURCHASE' | 'DOSE_CONSUMPTION' | 'WASTAGE' | 'ADJUSTMENT';
  enteredQuantity: string | null;
  enteredUnit: string | null;
  baseUnit: string | null;
  quantityDelta: string;
  balanceAfter: string;
  reason: string | null;
  note: string | null;
  createdAt?: string;
}

export interface BackupMedicationItemDto {
  id: string;
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
  status: 'ACTIVE' | 'ARCHIVED';
  schedules: BackupScheduleItemDto[];
  doseEvents: BackupDoseEventItemDto[];
  purchases: BackupPurchaseItemDto[];
  inventoryTransactions: BackupInventoryTxItemDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BackupHealthReadingItemDto {
  id: string;
  value: string;
  unit: 'MG_DL' | 'MMOL_L';
  context: 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'OTHER';
  measuredAt: string;
  note: string | null;
  createdAt?: string;
}

export interface BackupPatientProfileItemDto {
  id: string;
  name: string;
  relationship: string;
  timezone: string;
  isDefault: boolean;
  medications: BackupMedicationItemDto[];
  healthReadings: BackupHealthReadingItemDto[];
}

export interface AccountBackupDocumentDto {
  schemaVersion: 'caredose.backup.v1';
  exportedAt: string;
  account: {
    email: string;
    displayName: string;
    glucoseUnit: 'MG_DL' | 'MMOL_L';
    currency: string;
    monthlyBudget: string | null;
    remindersEnabled: boolean;
    soundEnabled: boolean;
    reminderLeadMins: number;
  };
  patientProfiles: BackupPatientProfileItemDto[];
  summary: AccountBackupSummaryDto;
}

export interface RestoreAccountResultDto {
  restoredAt: string;
  schemaVersion: 'caredose.backup.v1';
  summary: AccountBackupSummaryDto;
}

export interface DeleteAccountResultDto {
  deletedUserId: string;
  deletedAt: string;
}

export function getCurrentUserProfile(token: string): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateCurrentUserSettings(
  token: string,
  payload: UpdateUserSettingsPayload,
): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('/users/me/settings', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function exportAccountBackup(
  token: string,
): Promise<AccountBackupDocumentDto> {
  return apiRequest<AccountBackupDocumentDto>('/users/me/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function restoreAccountBackup(
  token: string,
  payload: AccountBackupDocumentDto,
): Promise<RestoreAccountResultDto> {
  return apiRequest<RestoreAccountResultDto>('/users/me/restore', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function deleteUserAccount(
  token: string,
  confirmation: 'DELETE',
): Promise<DeleteAccountResultDto> {
  return apiRequest<DeleteAccountResultDto>('/users/me', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmation }),
  });
}
