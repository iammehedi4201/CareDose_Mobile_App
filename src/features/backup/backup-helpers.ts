import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSavedAuthSession } from '../../api/config';
import type { HealthReadingItemDto } from '../../api/health-logs';
import type { PurchaseItemDto } from '../../api/purchases';
import type {
  AccountBackupDocumentDto,
  BackupHealthReadingItemDto,
  BackupMedicationItemDto,
  BackupPurchaseItemDto,
  BackupScheduleItemDto,
} from '../../api/users';
import { PURCHASES_STORAGE_KEY } from '../expenses/expense-helpers';
import {
  DEFAULT_USER_PREFERENCES,
  formatGlucoseNumberDisplay,
  formatGlucoseUnitLabel,
  formatReadingContextLabel,
  HEALTH_READINGS_STORAGE_KEY,
  LocalUserPreferences,
  normalizeGlucoseUnit,
  normalizeReadingContext,
  USER_PREFERENCES_STORAGE_KEY,
} from '../health/health-helpers';
import type { PersonalMedicationRecord } from '../medications/medication-helpers';
import {
  format24To12Hour,
  formatIsoTimestampTo12Hour,
  LocalDoseEventRecord,
  LocalScheduleRecord,
  normalizeTimeTo24Hour,
} from '../schedule/dose-rules';
import { cancelAllCareDoseNotifications } from '../schedule/notifications';

export const CAREDOSE_BACKUP_SCHEMA_VERSION = 'caredose.backup.v1';

export const BACKUP_STORAGE_KEYS = {
  userPreferences: USER_PREFERENCES_STORAGE_KEY,
  medications: 'caredose:personal-meds:v2',
  schedules: 'caredose:schedules:v2',
  doseEvents: 'caredose:dose-events:v2',
  purchases: PURCHASES_STORAGE_KEY,
  monthlyBudget: 'caredose:monthly-budget:v1',
  healthReadings: HEALTH_READINGS_STORAGE_KEY,
} as const;

function toFixed2(val: number | string | null | undefined, fallback = '0.00'): string {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return num.toFixed(2);
}

function isoToLocalYmd(isoOrYmd: string): string {
  const trimmed = isoOrYmd.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return trimmed.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoToLocalTime24(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '08:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Serializes local CareDose preferences and all tracked collections into the
 * versioned caredose.backup.v1 schema compatible with backend restore endpoints.
 */
export function buildLocalCareDoseBackupDocument(params: {
  preferences: LocalUserPreferences;
  medications: PersonalMedicationRecord[];
  schedules: LocalScheduleRecord[];
  doseEvents: LocalDoseEventRecord[];
  purchases: PurchaseItemDto[];
  readings: HealthReadingItemDto[];
  email?: string;
}): AccountBackupDocumentDto {
  const { preferences, medications, schedules, doseEvents, purchases, readings } = params;

  const nonSampleReadings = readings.filter((r) => !r.isSample);

  const backupMeds: BackupMedicationItemDto[] = medications.map((med) => {
    const medSchedules: BackupScheduleItemDto[] = schedules
      .filter((s) => s.patientMedicationId === med.id)
      .map((s) => ({
        id: s.id,
        doseAmount: toFixed2(s.doseAmount, '1.00'),
        doseUnit: s.doseUnit,
        frequency: s.frequency,
        intervalHours: s.intervalHours ?? null,
        weekdays: [...(s.weekdays ?? [])],
        scheduledTimes: [...s.scheduledTimes],
        startDate: `${s.startDateYmd}T00:00:00.000Z`,
        endDate: s.endDateYmd ? `${s.endDateYmd}T00:00:00.000Z` : null,
        instructions: s.instructions ?? null,
        remindersEnabled: Boolean(s.remindersEnabled),
        status: s.status,
      }));

    const medEvents = doseEvents
      .filter((e) => e.patientMedicationId === med.id)
      .map((e) => ({
        id: e.id,
        scheduleId: e.scheduleId,
        scheduledFor: e.scheduledFor,
        status: e.status === 'taken' ? ('TAKEN' as const) : ('SKIPPED' as const),
        recordedAt: e.recordedAt ?? null,
        note: e.note ?? null,
      }));

    const medPurchases: BackupPurchaseItemDto[] = purchases
      .filter((p) => p.patientMedicationId === med.id)
      .map((p) => ({
        id: p.id,
        purchaseDate: p.purchaseDate,
        packCount: p.packCount,
        unitsPerPack: toFixed2(p.unitsPerPack, '1.00'),
        totalUnitsAdded: toFixed2(p.totalUnitsAdded, '1.00'),
        amountPaid: toFixed2(p.amountPaid),
        currency: p.currency || preferences.currency || 'BDT',
        vendor: p.vendor ?? null,
        note: p.note ?? null,
        createdAt: p.createdAt,
      }));

    return {
      id: med.id,
      catalogueBrandId: med.catalogueBrandId ?? null,
      name: med.name,
      genericName: med.genericName ?? null,
      strength: med.strength ?? null,
      dosageForm: med.dosageForm || null,
      manufacturer: med.manufacturer ?? null,
      personalInstructions: med.instructions,
      stockRemaining: toFixed2(med.stockRemaining),
      stockUnit: med.stockUnit,
      lowStockThreshold: toFixed2(med.lowStockThreshold, '5.00'),
      status: med.archived ? 'ARCHIVED' : 'ACTIVE',
      schedules: medSchedules,
      doseEvents: medEvents,
      purchases: medPurchases,
      inventoryTransactions: [],
    };
  });

  const backupReadings: BackupHealthReadingItemDto[] = nonSampleReadings.map((r) => ({
    id: r.id,
    value: toFixed2(r.value),
    unit: r.unit,
    context: r.context,
    measuredAt: r.measuredAt,
    note: r.note ?? null,
    createdAt: r.createdAt,
  }));

  return {
    schemaVersion: CAREDOSE_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    account: {
      email: params.email ?? 'local-device@caredose.app',
      displayName: preferences.displayName,
      glucoseUnit: preferences.glucoseUnit,
      currency: preferences.currency || 'BDT',
      monthlyBudget:
        preferences.monthlyBudget !== null && preferences.monthlyBudget !== undefined
          ? toFixed2(preferences.monthlyBudget)
          : null,
      remindersEnabled: preferences.remindersEnabled,
      soundEnabled: preferences.soundEnabled,
      reminderLeadMins: preferences.reminderLeadMins,
    },
    patientProfiles: [
      {
        id: preferences.activePatientId || 'local-patient',
        name: preferences.activePatientName || preferences.displayName,
        relationship: preferences.activePatientRelationship || 'Self',
        timezone: preferences.activePatientTimezone || 'Asia/Dhaka',
        isDefault: true,
        medications: backupMeds,
        healthReadings: backupReadings,
      },
    ],
    summary: {
      profilesCount: 1,
      medicationsCount: backupMeds.length,
      schedulesCount: backupMeds.reduce((acc, m) => acc + m.schedules.length, 0),
      doseEventsCount: backupMeds.reduce((acc, m) => acc + m.doseEvents.length, 0),
      purchasesCount: backupMeds.reduce((acc, m) => acc + m.purchases.length, 0),
      inventoryTransactionsCount: 0,
      healthReadingsCount: backupReadings.length,
    },
  };
}

/**
 * Strictly validates pasted or imported JSON strings before attempting local or remote restore.
 */
export function parseAndValidateCareDoseBackupJson(rawText: string):
  | { valid: true; document: AccountBackupDocumentDto }
  | { valid: false; error: string } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, error: 'Paste or choose a CareDose backup JSON file.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { valid: false, error: 'Invalid JSON syntax in backup payload.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Backup JSON must be an object.' };
  }

  const root = parsed as Record<string, unknown>;
  if (root.schemaVersion !== CAREDOSE_BACKUP_SCHEMA_VERSION) {
    return {
      valid: false,
      error: `Unsupported backup schemaVersion. Expected "${CAREDOSE_BACKUP_SCHEMA_VERSION}".`,
    };
  }

  const acc = root.account as Record<string, unknown> | undefined;
  if (!acc || typeof acc !== 'object') {
    return { valid: false, error: 'Backup is missing the account settings section.' };
  }
  if (typeof acc.displayName !== 'string' || acc.displayName.trim().length === 0) {
    return { valid: false, error: 'Backup account.displayName is required.' };
  }
  if (acc.glucoseUnit !== 'MG_DL' && acc.glucoseUnit !== 'MMOL_L') {
    return {
      valid: false,
      error: 'Backup account.glucoseUnit must be MG_DL or MMOL_L.',
    };
  }

  const profiles = root.patientProfiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return {
      valid: false,
      error: 'Backup must include at least one patient profile.',
    };
  }

  let medsCount = 0;
  let schedsCount = 0;
  let eventsCount = 0;
  let purchasesCount = 0;
  let invCount = 0;
  let readingsCount = 0;

  for (const rawProfile of profiles) {
    if (!rawProfile || typeof rawProfile !== 'object') {
      return { valid: false, error: 'Invalid patient profile entry inside backup.' };
    }
    const p = rawProfile as Record<string, unknown>;
    if (typeof p.name !== 'string' || p.name.trim().length === 0) {
      return { valid: false, error: 'Each patient profile must have a non-empty name.' };
    }
    if (!Array.isArray(p.medications) || !Array.isArray(p.healthReadings)) {
      return {
        valid: false,
        error: 'Each patient profile must contain medications and healthReadings arrays.',
      };
    }

    for (const rawMed of p.medications) {
      if (!rawMed || typeof rawMed !== 'object') {
        return { valid: false, error: 'Invalid medication record inside backup.' };
      }
      const m = rawMed as Record<string, unknown>;
      if (typeof m.name !== 'string' || m.name.trim().length === 0) {
        return { valid: false, error: 'Every backup medication must have a name.' };
      }
      if (
        !Array.isArray(m.schedules) ||
        !Array.isArray(m.doseEvents) ||
        !Array.isArray(m.purchases)
      ) {
        return {
          valid: false,
          error: `Medication "${m.name}" is missing schedules, doseEvents, or purchases arrays.`,
        };
      }
      medsCount += 1;
      schedsCount += m.schedules.length;
      eventsCount += m.doseEvents.length;
      purchasesCount += m.purchases.length;
      if (Array.isArray(m.inventoryTransactions)) {
        invCount += m.inventoryTransactions.length;
      }
    }

    for (const rawHr of p.healthReadings) {
      if (!rawHr || typeof rawHr !== 'object') {
        return { valid: false, error: 'Invalid health reading entry inside backup.' };
      }
      const hr = rawHr as Record<string, unknown>;
      const numVal = Number(hr.value);
      if (!Number.isFinite(numVal) || numVal <= 0) {
        return { valid: false, error: 'Health reading value must be a number > 0.' };
      }
      readingsCount += 1;
    }
  }

  const doc = parsed as AccountBackupDocumentDto;
  const normalized: AccountBackupDocumentDto = {
    schemaVersion: CAREDOSE_BACKUP_SCHEMA_VERSION,
    exportedAt:
      typeof doc.exportedAt === 'string' && doc.exportedAt
        ? doc.exportedAt
        : new Date().toISOString(),
    account: {
      email: typeof doc.account.email === 'string' ? doc.account.email : 'local@caredose.app',
      displayName: doc.account.displayName.trim(),
      glucoseUnit: doc.account.glucoseUnit,
      currency: doc.account.currency || 'BDT',
      monthlyBudget:
        doc.account.monthlyBudget !== null && doc.account.monthlyBudget !== undefined
          ? toFixed2(doc.account.monthlyBudget)
          : null,
      remindersEnabled: Boolean(doc.account.remindersEnabled),
      soundEnabled: Boolean(doc.account.soundEnabled),
      reminderLeadMins: Number.isFinite(Number(doc.account.reminderLeadMins))
        ? Math.max(0, Math.min(120, Math.round(Number(doc.account.reminderLeadMins))))
        : 10,
    },
    patientProfiles: doc.patientProfiles.map((p) => ({
      ...p,
      medications: p.medications.map((m) => ({
        ...m,
        inventoryTransactions: Array.isArray(m.inventoryTransactions)
          ? m.inventoryTransactions
          : [],
      })),
    })),
    summary: {
      profilesCount: doc.patientProfiles.length,
      medicationsCount: medsCount,
      schedulesCount: schedsCount,
      doseEventsCount: eventsCount,
      purchasesCount,
      inventoryTransactionsCount: invCount,
      healthReadingsCount: readingsCount,
    },
  };

  return { valid: true, document: normalized };
}

/**
 * Hydrates all offline AsyncStorage stores from a validated backup document so context refreshes
 * pick up restored records immediately.
 */
export async function applyBackupDocumentToLocalStorage(
  doc: AccountBackupDocumentDto,
): Promise<void> {
  const defaultProfile =
    doc.patientProfiles.find((p) => p.isDefault) ?? doc.patientProfiles[0];

  const nextBudget =
    doc.account.monthlyBudget !== null && doc.account.monthlyBudget !== undefined
      ? Number(doc.account.monthlyBudget)
      : null;

  const nextPrefs: LocalUserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    displayName: doc.account.displayName,
    glucoseUnit: normalizeGlucoseUnit(doc.account.glucoseUnit),
    remindersEnabled: doc.account.remindersEnabled,
    soundEnabled: doc.account.soundEnabled,
    reminderLeadMins: doc.account.reminderLeadMins,
    currency: doc.account.currency || 'BDT',
    monthlyBudget: nextBudget,
    activePatientId: defaultProfile?.id || 'local-patient',
    activePatientName: defaultProfile?.name || doc.account.displayName,
    activePatientRelationship: defaultProfile?.relationship || 'Self',
    activePatientTimezone: defaultProfile?.timezone || 'Asia/Dhaka',
  };

  const restoredMeds: PersonalMedicationRecord[] = [];
  const restoredSchedules: LocalScheduleRecord[] = [];
  const restoredDoseEvents: LocalDoseEventRecord[] = [];
  const restoredPurchases: PurchaseItemDto[] = [];
  const restoredReadings: HealthReadingItemDto[] = [];

  for (const profile of doc.patientProfiles) {
    for (const m of profile.medications) {
      restoredMeds.push({
        id: m.id,
        catalogueBrandId: m.catalogueBrandId ?? null,
        name: m.name,
        genericName: m.genericName ?? null,
        strength: m.strength ?? null,
        dosageForm: m.dosageForm ?? 'Tablet',
        manufacturer: m.manufacturer ?? null,
        instructions: m.personalInstructions,
        stockRemaining: Number(m.stockRemaining) || 0,
        stockUnit: m.stockUnit,
        unitPriceText: 'Price not added',
        lowStockThreshold: Number(m.lowStockThreshold) || 5,
        archived: m.status === 'ARCHIVED',
      });

      for (const s of m.schedules) {
        restoredSchedules.push({
          id: s.id,
          patientMedicationId: m.id,
          doseAmount: Number(s.doseAmount) || 1,
          doseUnit: s.doseUnit,
          frequency: s.frequency,
          intervalHours: s.intervalHours ?? null,
          weekdays: [...(s.weekdays ?? [])],
          scheduledTimes: s.scheduledTimes.map(normalizeTimeTo24Hour),
          startDateYmd: isoToLocalYmd(s.startDate),
          endDateYmd: s.endDate ? isoToLocalYmd(s.endDate) : null,
          instructions: s.instructions ?? null,
          remindersEnabled: Boolean(s.remindersEnabled),
          status: s.status,
        });
      }

      for (const ev of m.doseEvents) {
        if (ev.status !== 'TAKEN' && ev.status !== 'SKIPPED') continue;
        restoredDoseEvents.push({
          id: ev.id,
          occurrenceKey: `${ev.scheduleId}:${ev.scheduledFor}`,
          scheduleId: ev.scheduleId,
          patientMedicationId: m.id,
          scheduledDateYmd: isoToLocalYmd(ev.scheduledFor),
          scheduledTime24: isoToLocalTime24(ev.scheduledFor),
          scheduledFor: ev.scheduledFor,
          status: ev.status === 'TAKEN' ? 'taken' : 'skipped',
          recordedAt: ev.recordedAt ?? ev.scheduledFor,
          note: ev.note ?? null,
        });
      }

      for (const pur of m.purchases) {
        const unitsAdded = Number(pur.totalUnitsAdded) || 0;
        const paid = Number(pur.amountPaid) || 0;
        restoredPurchases.push({
          id: pur.id,
          patientId: profile.id,
          patientMedicationId: m.id,
          purchaseDate: pur.purchaseDate,
          purchaseDateYmd: isoToLocalYmd(pur.purchaseDate),
          packCount: pur.packCount,
          unitsPerPack: toFixed2(pur.unitsPerPack, '1.00'),
          totalUnitsAdded: toFixed2(unitsAdded, '1.00'),
          amountPaid: toFixed2(paid),
          unitPrice: unitsAdded > 0 ? (paid / unitsAdded).toFixed(2) : null,
          currency: pur.currency || 'BDT',
          vendor: pur.vendor ?? null,
          note: pur.note ?? null,
          createdAt: pur.createdAt ?? pur.purchaseDate,
          medication: {
            id: m.id,
            name: m.name,
            strength: m.strength ?? null,
            dosageForm: m.dosageForm ?? null,
            stockUnit: m.stockUnit,
          },
        });
      }
    }

    for (const hr of profile.healthReadings) {
      const time24 = isoToLocalTime24(hr.measuredAt);
      const time12 = formatIsoTimestampTo12Hour(hr.measuredAt) ?? format24To12Hour(time24);
      const normUnit = normalizeGlucoseUnit(hr.unit);
      const normCtx = normalizeReadingContext(hr.context);
      const fixedVal = toFixed2(hr.value);

      restoredReadings.push({
        id: hr.id,
        patientId: profile.id,
        value: fixedVal,
        displayValue: formatGlucoseNumberDisplay(fixedVal),
        unit: normUnit,
        unitLabel: formatGlucoseUnitLabel(normUnit),
        context: normCtx,
        contextLabel: formatReadingContextLabel(normCtx),
        measuredAt: hr.measuredAt,
        measuredDateYmd: isoToLocalYmd(hr.measuredAt),
        measuredTime24: time24,
        measuredTime12: time12,
        note: hr.note ?? null,
        createdAt: hr.createdAt ?? hr.measuredAt,
      });
    }
  }

  await Promise.all([
    AsyncStorage.setItem(BACKUP_STORAGE_KEYS.userPreferences, JSON.stringify(nextPrefs)),
    AsyncStorage.setItem(BACKUP_STORAGE_KEYS.medications, JSON.stringify(restoredMeds)),
    AsyncStorage.setItem(BACKUP_STORAGE_KEYS.schedules, JSON.stringify(restoredSchedules)),
    AsyncStorage.setItem(BACKUP_STORAGE_KEYS.doseEvents, JSON.stringify(restoredDoseEvents)),
    AsyncStorage.setItem(BACKUP_STORAGE_KEYS.purchases, JSON.stringify(restoredPurchases)),
    AsyncStorage.setItem(
      BACKUP_STORAGE_KEYS.monthlyBudget,
      JSON.stringify(nextBudget),
    ),
    AsyncStorage.setItem(
      BACKUP_STORAGE_KEYS.healthReadings,
      JSON.stringify(restoredReadings),
    ),
  ]);
}

/**
 * Permanently wipes local personal AsyncStorage records, clears auth session,
 * and cancels all scheduled CareDose reminders.
 */
export async function wipeAllLocalCareDoseData(): Promise<void> {
  await Promise.all([
    clearSavedAuthSession(),
    cancelAllCareDoseNotifications(),
    AsyncStorage.multiRemove([
      BACKUP_STORAGE_KEYS.userPreferences,
      BACKUP_STORAGE_KEYS.medications,
      BACKUP_STORAGE_KEYS.schedules,
      BACKUP_STORAGE_KEYS.doseEvents,
      BACKUP_STORAGE_KEYS.purchases,
      BACKUP_STORAGE_KEYS.monthlyBudget,
      BACKUP_STORAGE_KEYS.healthReadings,
    ]),
  ]);
}
