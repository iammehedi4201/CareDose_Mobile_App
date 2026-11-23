import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PersonalMedicationRecord } from '../medications/medication-helpers';
import {
  adaptDefaultDoseUnit,
  buildLocalOccurrenceDate,
  computeStockAfterDoseTaken,
  expandLocalScheduleOccurrencesForRange,
  findDuplicateTimes,
  formatDoseAmountDisplay,
  formatRecurrenceSummary,
  getDoseUnitOptions,
  getLocalScheduleTimesForDate,
  isDuplicateScheduleDefinition,
  LocalScheduleRecord,
  mapApiScheduleToLocal,
  parseDoseAmountInput,
  resolveInitialScheduleMedication,
} from './dose-rules';

const MEDS: PersonalMedicationRecord[] = [
  {
    id: 'med-tab',
    name: 'Napa',
    strength: '500 mg',
    dosageForm: 'Tablet',
    instructions: '',
    stockRemaining: 30,
    stockUnit: 'tablets',
    unitPriceText: '৳1.20/tablet',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'med-cap',
    name: 'Seclo',
    strength: '20 mg',
    dosageForm: 'Capsule',
    instructions: '',
    stockRemaining: 20,
    stockUnit: 'capsules',
    unitPriceText: '৳7.00/capsule',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'med-syrup',
    name: 'Napa Syrup',
    strength: '120 mg/5 ml',
    dosageForm: 'Syrup',
    instructions: '',
    stockRemaining: 120,
    stockUnit: 'ml',
    unitPriceText: '৳45.00/bottle',
    lowStockThreshold: 20,
    archived: false,
  },
  {
    id: 'med-drops',
    name: 'Aristovision',
    strength: '0.5%',
    dosageForm: 'Eye Drops',
    instructions: '',
    stockRemaining: 2,
    stockUnit: 'bottle',
    unitPriceText: '৳90.00/bottle',
    lowStockThreshold: 1,
    archived: false,
  },
  {
    id: 'med-supp',
    name: 'Ace Suppository',
    strength: '250 mg',
    dosageForm: 'Suppository',
    instructions: '',
    stockRemaining: 10,
    stockUnit: 'pieces',
    unitPriceText: '৳6.00/piece',
    lowStockThreshold: 2,
    archived: false,
  },
  {
    id: 'med-inj',
    name: 'Rocephin',
    strength: '1 gm',
    dosageForm: 'IV Injection',
    instructions: '',
    stockRemaining: 4,
    stockUnit: 'vials',
    unitPriceText: '৳190.00/vial',
    lowStockThreshold: 1,
    archived: false,
  },
];

function makeSched(overrides: Partial<LocalScheduleRecord>): LocalScheduleRecord {
  return {
    id: 's1',
    patientMedicationId: 'med-tab',
    doseAmount: 1,
    doseUnit: 'tablets',
    frequency: 'DAILY',
    intervalHours: null,
    weekdays: [],
    scheduledTimes: ['09:00'],
    startDateYmd: '2026-11-23',
    endDateYmd: null,
    instructions: null,
    remindersEnabled: false,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('CareDose Simplified Create Dose / Schedule Modal — Domain & UI Rules', () => {
  it('adapts dose units to each selected dosage form and resets cleanly on change', () => {
    expect(adaptDefaultDoseUnit('Tablet', 'tablets')).toBe('tablets');
    expect(adaptDefaultDoseUnit('Capsule', 'capsules')).toBe('capsules');
    expect(adaptDefaultDoseUnit('Syrup', 'ml')).toBe('mL');
    expect(adaptDefaultDoseUnit('Eye Drops', 'bottle')).toBe('drops');
    expect(adaptDefaultDoseUnit('Suppository', 'pieces')).toBe('pieces');
    expect(adaptDefaultDoseUnit('IV Injection', 'vials')).toBe('vials');
    expect(adaptDefaultDoseUnit('IM Injection', 'ampoules')).toBe('ampoules');

    expect(getDoseUnitOptions('Eye Drops', 'bottle').map((o) => o.value)).toEqual([
      'drops',
      'mL',
    ]);
    expect(getDoseUnitOptions('IV Injection', 'vials').map((o) => o.value)).toContain(
      'mL',
    );

    expect(formatDoseAmountDisplay(1, 'tablets')).toBe('1 tablet');
    expect(formatDoseAmountDisplay(2, 'tablets')).toBe('2 tablets');
    expect(formatDoseAmountDisplay(5, 'mL')).toBe('5 mL');
  });

  it('validates positive prescribed doses and rejects invalid dose amounts', () => {
    expect(parseDoseAmountInput('1', 'tablets')).toEqual({ amount: 1, unit: 'tablets' });
    expect(parseDoseAmountInput('0.5', 'tablets')).toEqual({ amount: 0.5, unit: 'tablets' });
    expect(parseDoseAmountInput('')).toBeNull();
    expect(parseDoseAmountInput('0')).toBeNull();
    expect(parseDoseAmountInput('-2')).toBeNull();
    expect(parseDoseAmountInput('abc')).toBeNull();
  });

  it('expands Once daily, Twice daily, Three times daily, Custom times, Every X hours, Alternate days, Selected weekdays, and Weekly cleanly without duplicate occurrences', () => {
    // Once daily
    const daily = makeSched({ frequency: 'DAILY', scheduledTimes: ['09:15'] });
    expect(getLocalScheduleTimesForDate(daily, '2026-11-23')).toEqual(['09:15']);

    // Twice daily
    const twice = makeSched({ frequency: 'TWICE_DAILY', scheduledTimes: ['08:00', '20:00'] });
    expect(getLocalScheduleTimesForDate(twice, '2026-11-23')).toEqual(['08:00', '20:00']);

    // Three times daily
    const thrice = makeSched({
      frequency: 'THREE_TIMES_DAILY',
      scheduledTimes: ['07:30', '14:00', '21:30'],
    });
    expect(getLocalScheduleTimesForDate(thrice, '2026-11-23')).toEqual([
      '07:30',
      '14:00',
      '21:30',
    ]);

    // Custom times
    const custom = makeSched({
      frequency: 'CUSTOM_TIMES',
      scheduledTimes: ['06:00', '11:00', '16:00', '22:00'],
    });
    expect(getLocalScheduleTimesForDate(custom, '2026-11-23')).toEqual([
      '06:00',
      '11:00',
      '16:00',
      '22:00',
    ]);

    // Every X hours (8 hours starting 08:00 -> day 1: 08:00, 16:00; day 2: 00:00, 08:00, 16:00)
    const every8 = makeSched({
      frequency: 'EVERY_X_HOURS',
      intervalHours: 8,
      scheduledTimes: ['08:00'],
      startDateYmd: '2026-11-23',
    });
    expect(getLocalScheduleTimesForDate(every8, '2026-11-23')).toEqual(['08:00', '16:00']);
    expect(getLocalScheduleTimesForDate(every8, '2026-11-24')).toEqual(['00:00', '08:00', '16:00']);
    expect(formatRecurrenceSummary(every8)).toBe('Every 8 hours');

    // Every 6 hours starting 07:00
    const every6 = makeSched({
      frequency: 'EVERY_X_HOURS',
      intervalHours: 6,
      scheduledTimes: ['07:00'],
      startDateYmd: '2026-11-23',
    });
    expect(getLocalScheduleTimesForDate(every6, '2026-11-23')).toEqual(['07:00', '13:00', '19:00']);
    expect(getLocalScheduleTimesForDate(every6, '2026-11-24')).toEqual([
      '01:00',
      '07:00',
      '13:00',
      '19:00',
    ]);

    // Selected weekdays: Mon (1), Wed (3), Fri (5) during week of 2026-11-23 (Monday)
    const weekdaySched = makeSched({
      frequency: 'SELECTED_WEEKDAYS',
      weekdays: [1, 3, 5],
      scheduledTimes: ['10:00'],
      startDateYmd: '2026-11-23',
    });
    const weekRes = expandLocalScheduleOccurrencesForRange(
      [weekdaySched],
      MEDS,
      [],
      '2026-11-23',
      7,
      buildLocalOccurrenceDate('2026-11-23', '07:00'),
    );
    expect(weekRes.days.map((d) => d.totalCount)).toEqual([1, 0, 1, 0, 1, 0, 0]);
    expect(formatRecurrenceSummary(weekdaySched)).toBe('Weekdays (Mon, Wed, Fri)');

    // Alternate days & Weekly recurrence
    const altSched = makeSched({ frequency: 'ALTERNATE_DAYS', startDateYmd: '2026-11-23' });
    const altWeek = expandLocalScheduleOccurrencesForRange(
      [altSched],
      MEDS,
      [],
      '2026-11-23',
      7,
      buildLocalOccurrenceDate('2026-11-23', '07:00'),
    );
    expect(altWeek.days.map((d) => d.totalCount)).toEqual([1, 0, 1, 0, 1, 0, 1]);

    const weeklySched = makeSched({ frequency: 'WEEKLY', startDateYmd: '2026-11-23' });
    const weeklySpan = expandLocalScheduleOccurrencesForRange(
      [weeklySched],
      MEDS,
      [],
      '2026-11-23',
      8,
      buildLocalOccurrenceDate('2026-11-23', '07:00'),
    );
    expect(weeklySpan.days.map((d) => d.totalCount)).toEqual([1, 0, 0, 0, 0, 0, 0, 1]);
  });

  it('prevents duplicate reminder times and duplicate overlapping active schedules', () => {
    expect(findDuplicateTimes(['08:00 AM', '08:00'])).toBe(true);
    expect(findDuplicateTimes(['08:00 AM', '08:00 PM'])).toBe(false);

    const existing = [
      makeSched({
        id: 's-existing',
        patientMedicationId: 'med-tab',
        frequency: 'TWICE_DAILY',
        scheduledTimes: ['08:00', '20:00'],
        startDateYmd: '2026-11-23',
        endDateYmd: '2026-12-01',
      }),
    ];

    expect(
      isDuplicateScheduleDefinition(existing, {
        patientMedicationId: 'med-tab',
        frequency: 'TWICE_DAILY',
        scheduledTimes: ['20:00', '08:00'],
        startDateYmd: '2026-11-25',
        endDateYmd: null,
      }),
    ).toBe(true);

    // Non-overlapping date window is allowed
    expect(
      isDuplicateScheduleDefinition(existing, {
        patientMedicationId: 'med-tab',
        frequency: 'TWICE_DAILY',
        scheduledTimes: ['08:00', '20:00'],
        startDateYmd: '2026-12-02',
        endDateYmd: null,
      }),
    ).toBe(false);

    // Updating the same schedule ID is allowed
    expect(
      isDuplicateScheduleDefinition(
        existing,
        {
          patientMedicationId: 'med-tab',
          frequency: 'TWICE_DAILY',
          scheduledTimes: ['08:00', '20:00'],
          startDateYmd: '2026-11-23',
          endDateYmd: '2026-12-01',
        },
        's-existing',
      ),
    ).toBe(false);
  });

  it('preserves intervalHours and weekdays when mapping API schedule DTOs and keeps stock deduction strict', () => {
    const mapped = mapApiScheduleToLocal({
      id: 'api-s1',
      patientMedicationId: 'med-syrup',
      doseAmount: '5.00',
      doseUnit: 'mL',
      frequency: 'SELECTED_WEEKDAYS',
      intervalHours: null,
      weekdays: [1, 4],
      scheduledTimes: ['09:00', '21:00'],
      scheduledTimes12h: ['09:00 AM', '09:00 PM'],
      startDate: '2026-11-23T00:00:00.000Z',
      startDateYmd: '2026-11-23',
      endDate: null,
      endDateYmd: null,
      instructions: null,
      remindersEnabled: false,
      status: 'ACTIVE',
      createdAt: '2026-11-23T00:00:00.000Z',
      updatedAt: '2026-11-23T00:00:00.000Z',
    });

    expect(mapped.intervalHours).toBeNull();
    expect(mapped.weekdays).toEqual([1, 4]);
    expect(mapped.doseUnit).toBe('mL');

    // Only compatible units deduct stock on Taken (e.g. mL -> ml, tablets -> tablets, whereas drops -> bottle does not guess)
    expect(computeStockAfterDoseTaken(120, 5, 'mL', 'ml')).toEqual({
      stockDeducted: true,
      deductedQuantity: 5,
      nextStock: 115,
    });
    expect(computeStockAfterDoseTaken(30, 1, 'tablets', 'tablets')).toEqual({
      stockDeducted: true,
      deductedQuantity: 1,
      nextStock: 29,
    });
    expect(computeStockAfterDoseTaken(2, 2, 'drops', 'bottle')).toEqual({
      stockDeducted: false,
      deductedQuantity: 0,
      nextStock: 2,
    });
  });

  it('verifies simplified ScheduleModal UX labels, inline controls, no guessed default times, and honest reminder UI', () => {
    const modalSource = fs.readFileSync(
      path.resolve(__dirname, '../../components/ScheduleModal.tsx'),
      'utf8',
    );
    const notifSource = fs.readFileSync(
      path.resolve(__dirname, './notifications.ts'),
      'utf8',
    );

    expect(modalSource).toContain('Which medicine?');
    expect(modalSource).toContain('Select a medicine');
    expect(modalSource).toContain('How much each time?');
    expect(modalSource).toContain('When should it be taken?');
    expect(modalSource).toContain('More options');
    expect(modalSource).toContain('Once daily');
    expect(modalSource).toContain('Twice daily');
    expect(modalSource).toContain('Three times daily');
    expect(modalSource).toContain('Custom times');
    expect(modalSource).toContain('Every X hours');
    expect(modalSource).toContain('Selected weekdays');
    expect(modalSource).toContain('Add end date (optional)');
    expect(modalSource).toContain('Instructions (optional)');
    expect(modalSource).toContain('Save Schedule');

    // No assumed breakfast/lunch/bedtime times when starting a new schedule
    expect(modalSource).toContain("useState<string[]>([''])");
    expect(modalSource).toContain("useState('')");
    expect(modalSource).not.toContain("'08:00 AM'");
    expect(modalSource).not.toContain("'08:00 PM'");
    expect(modalSource).not.toContain('<SelectField');

    // NativeWind utility styling instead of raw StyleSheet rules
    expect(modalSource).not.toContain('StyleSheet.create');
    expect(modalSource).toContain('className=');

    // Notification safety: reminders never auto-mark Taken
    expect(notifSource).toContain('autoMarkTaken: false');
    expect(modalSource).toContain('Alerts never mark doses Taken automatically.');
  });

  it('never auto-selects a medicine when opening a new schedule without an explicit target', () => {
    expect(resolveInitialScheduleMedication(MEDS, null, null)).toBeNull();
    expect(resolveInitialScheduleMedication(MEDS, undefined, null)).toBeNull();

    // Explicit medicine context (from Medicine Details screen) pre-selects that exact medicine
    expect(resolveInitialScheduleMedication(MEDS, 'med-syrup', null)?.id).toBe('med-syrup');

    // Editing an existing schedule pre-selects its linked medicine
    expect(
      resolveInitialScheduleMedication(
        MEDS,
        null,
        makeSched({ patientMedicationId: 'med-cap' }),
      )?.id,
    ).toBe('med-cap');
  });
});
