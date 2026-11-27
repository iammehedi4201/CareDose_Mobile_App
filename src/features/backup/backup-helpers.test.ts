import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMap = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storageMap.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storageMap.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storageMap.delete(key);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      keys.forEach((k) => storageMap.delete(k));
    }),
    clear: vi.fn(async () => {
      storageMap.clear();
    }),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyBackupDocumentToLocalStorage,
  BACKUP_STORAGE_KEYS,
  buildLocalCareDoseBackupDocument,
  CAREDOSE_BACKUP_SCHEMA_VERSION,
  parseAndValidateCareDoseBackupJson,
  wipeAllLocalCareDoseData,
} from './backup-helpers';
import { DEFAULT_USER_PREFERENCES } from '../health/health-helpers';

describe('backup-helpers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('exports, validates, and restores full personal records into local storage cleanly', async () => {
    const exported = buildLocalCareDoseBackupDocument({
      preferences: {
        ...DEFAULT_USER_PREFERENCES,
        displayName: 'Nadia Rahman',
        glucoseUnit: 'MMOL_L',
        monthlyBudget: 3500,
        reminderLeadMins: 15,
      },
      medications: [
        {
          id: 'med-1',
          name: 'Napa',
          strength: '500 mg',
          dosageForm: 'Tablet',
          instructions: 'After breakfast',
          stockRemaining: 19,
          stockUnit: 'tablets',
          unitPriceText: '৳1.20/tablet',
          lowStockThreshold: 5,
          archived: false,
        },
      ],
      schedules: [
        {
          id: 'sched-1',
          patientMedicationId: 'med-1',
          doseAmount: 1,
          doseUnit: 'tablet',
          frequency: 'DAILY',
          scheduledTimes: ['08:00'],
          startDateYmd: '2026-11-25',
          endDateYmd: null,
          instructions: 'After breakfast',
          remindersEnabled: true,
          status: 'ACTIVE',
        },
      ],
      doseEvents: [
        {
          id: 'ev-1',
          occurrenceKey: 'sched-1:2026-11-25T02:00:00.000Z',
          scheduleId: 'sched-1',
          patientMedicationId: 'med-1',
          scheduledDateYmd: '2026-11-25',
          scheduledTime24: '08:00',
          scheduledFor: '2026-11-25T02:00:00.000Z',
          status: 'taken',
          recordedAt: '2026-11-25T02:05:00.000Z',
          note: null,
        },
      ],
      purchases: [
        {
          id: 'pur-1',
          patientId: 'local-patient',
          patientMedicationId: 'med-1',
          purchaseDate: '2026-11-20T06:00:00.000Z',
          purchaseDateYmd: '2026-11-20',
          packCount: 2,
          unitsPerPack: '10.00',
          totalUnitsAdded: '20.00',
          amountPaid: '24.00',
          unitPrice: '1.20',
          currency: 'BDT',
          vendor: 'Lazz Pharma',
          note: null,
          createdAt: '2026-11-20T06:00:00.000Z',
          medication: null,
        },
      ],
      readings: [
        {
          id: 'hr-1',
          patientId: 'local-patient',
          value: '6.10',
          displayValue: '6.1',
          unit: 'MMOL_L',
          unitLabel: 'mmol/L',
          context: 'FASTING',
          contextLabel: 'Fasting',
          measuredAt: '2026-11-25T01:30:00.000Z',
          measuredDateYmd: '2026-11-25',
          measuredTime24: '07:30',
          measuredTime12: '07:30 AM',
          note: 'Fasting morning',
          createdAt: '2026-11-25T01:30:00.000Z',
        },
      ],
    });

    expect(exported.schemaVersion).toBe(CAREDOSE_BACKUP_SCHEMA_VERSION);
    expect(exported.summary.medicationsCount).toBe(1);
    expect(exported.summary.healthReadingsCount).toBe(1);

    const parsed = parseAndValidateCareDoseBackupJson(JSON.stringify(exported));
    expect(parsed.valid).toBe(true);
    if (!parsed.valid) return;

    await applyBackupDocumentToLocalStorage(parsed.document);

    const rawMeds = JSON.parse(
      (await AsyncStorage.getItem(BACKUP_STORAGE_KEYS.medications)) ?? '[]',
    ) as Array<{ name: string; stockRemaining: number }>;
    expect(rawMeds).toHaveLength(1);
    expect(rawMeds[0].name).toBe('Napa');
    expect(rawMeds[0].stockRemaining).toBe(19);

    const rawPrefs = JSON.parse(
      (await AsyncStorage.getItem(BACKUP_STORAGE_KEYS.userPreferences)) ?? '{}',
    ) as { displayName: string; glucoseUnit: string };
    expect(rawPrefs.displayName).toBe('Nadia Rahman');
    expect(rawPrefs.glucoseUnit).toBe('MMOL_L');

    await wipeAllLocalCareDoseData();
    expect(await AsyncStorage.getItem(BACKUP_STORAGE_KEYS.medications)).toBeNull();
    expect(await AsyncStorage.getItem(BACKUP_STORAGE_KEYS.userPreferences)).toBeNull();
  });

  it('rejects malformed, wrong-version, or empty-profile backups cleanly', () => {
    expect(parseAndValidateCareDoseBackupJson('{not valid json').valid).toBe(false);
    expect(
      parseAndValidateCareDoseBackupJson(
        JSON.stringify({ schemaVersion: 'wrong.v0' }),
      ).valid,
    ).toBe(false);
    expect(
      parseAndValidateCareDoseBackupJson(
        JSON.stringify({
          schemaVersion: CAREDOSE_BACKUP_SCHEMA_VERSION,
          account: {
            displayName: 'Karim',
            glucoseUnit: 'MG_DL',
          },
          patientProfiles: [],
        }),
      ).valid,
    ).toBe(false);
  });
});
