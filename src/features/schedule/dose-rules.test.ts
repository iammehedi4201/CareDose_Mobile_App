import { describe, expect, it } from 'vitest';
import { DEMO_FIXTURE_MEDS } from '../medications/medication-helpers';
import {
  addDaysYmd,
  buildLocalOccurrenceDate,
  classifyDayPeriod,
  computeDoseDisplayStatus,
  computeStockAfterDoseTaken,
  createFixtureDemoDoseEvents,
  createFixtureDemoSchedules,
  createInitialDemoDoseEvents,
  createInitialDemoSchedules,
  DOSE_DUE_LEAD_MS,
  DOSE_GRACE_PERIOD_MS,
  estimateStockDurationForMedication,
  expandLocalScheduleOccurrencesForRange,
  filterLocalDoseHistory,
  format24To12Hour,
  formatWeekRangeLabel,
  getCurrentDayPeriod,
  getMondayOfWeekYmd,
  getMsUntilNextPeriodBoundary,
  normalizeTimeTo24Hour,
  parseDoseAmountInput,
  resolveDefaultExpandedPeriod,
  resolveSectionTimelineState,
  resolveTimelinePeriod,
  selectNextDose,
  summarizePeriodStatus,
} from './dose-rules';

describe('Phase 6 — Mobile Schedule & Dose History Rules', () => {
  it('starts with empty schedules and dose events by default', () => {
    expect(createInitialDemoSchedules()).toEqual([]);
    expect(createInitialDemoDoseEvents()).toEqual([]);
  });

  it('parses times, groups periods, and parses dose amounts cleanly', () => {
    expect(normalizeTimeTo24Hour('8:00 AM')).toBe('08:00');
    expect(normalizeTimeTo24Hour('09:30 PM')).toBe('21:30');
    expect(format24To12Hour('00:05')).toBe('12:05 AM');
    expect(format24To12Hour('14:15')).toBe('02:15 PM');

    expect(classifyDayPeriod('08:00 AM')).toBe('Morning');
    expect(classifyDayPeriod('01:30 PM')).toBe('Afternoon');
    expect(classifyDayPeriod('05:30 PM')).toBe('Afternoon');
    expect(classifyDayPeriod('06:00 PM')).toBe('Bedtime');
    expect(classifyDayPeriod('06:45 PM')).toBe('Bedtime');
    expect(classifyDayPeriod('10:00 PM')).toBe('Bedtime');

    expect(parseDoseAmountInput('1 tablet')).toEqual({ amount: 1, unit: 'tablet' });
    expect(parseDoseAmountInput('2.5', 'ml')).toEqual({ amount: 2.5, unit: 'ml' });
    expect(parseDoseAmountInput('0 tablet')).toBeNull();
  });

  it('computes due, upcoming, missed, taken, and skipped statuses and never recommends past doses as Next Dose', () => {
    const today = '2026-11-22';
    const schedDt = buildLocalOccurrenceDate(today, '13:30');

    expect(
      computeDoseDisplayStatus(
        schedDt.toISOString(),
        null,
        new Date(schedDt.getTime() - DOSE_DUE_LEAD_MS - 1000),
      ),
    ).toBe('upcoming');
    expect(
      computeDoseDisplayStatus(
        schedDt.toISOString(),
        null,
        new Date(schedDt.getTime() + 5 * 60_000),
      ),
    ).toBe('due');
    expect(
      computeDoseDisplayStatus(
        schedDt.toISOString(),
        null,
        new Date(schedDt.getTime() + DOSE_GRACE_PERIOD_MS + 1000),
      ),
    ).toBe('missed');
    expect(computeDoseDisplayStatus(schedDt.toISOString(), 'taken')).toBe('taken');
    expect(computeDoseDisplayStatus(schedDt.toISOString(), 'skipped')).toBe('skipped');

    const schedules = createFixtureDemoSchedules(today);
    const events = createFixtureDemoDoseEvents(today);
    const nowNoon = buildLocalOccurrenceDate(today, '12:00');
    const daily = expandLocalScheduleOccurrencesForRange(
      schedules,
      DEMO_FIXTURE_MEDS,
      events,
      today,
      1,
      nowNoon,
    );

    const next = selectNextDose(daily.days[0].items);
    expect(next).not.toBeNull();
    expect(next?.patientMedicationId).toBe('m3');
    expect(next?.scheduledTime24).toBe('13:30');
    expect(next?.status).toBe('upcoming');
  });

  it('deducts compatible stock units once and preserves bottles/incompatible units safely', () => {
    expect(computeStockAfterDoseTaken(24, 1, 'tablet', 'tablets')).toEqual({
      stockDeducted: true,
      deductedQuantity: 1,
      nextStock: 23,
    });
    expect(computeStockAfterDoseTaken(1, 2, 'tablet', 'tablets')).toEqual({
      stockDeducted: true,
      deductedQuantity: 1,
      nextStock: 0,
    });
    expect(computeStockAfterDoseTaken(1, 1, 'drop', 'bottle')).toEqual({
      stockDeducted: false,
      deductedQuantity: 0,
      nextStock: 1,
    });
  });

  it('calculates Monday–Sunday week ranges, alternate-day frequencies, and history filters', () => {
    const monday = getMondayOfWeekYmd('2026-11-22'); // Sunday Nov 22 -> Monday Nov 16
    expect(monday).toBe('2026-11-16');
    expect(formatWeekRangeLabel(monday)).toBe('Nov 16 – 22, 2026');

    const altSchedules = [
      {
        id: 's-alt',
        patientMedicationId: 'm1',
        doseAmount: 1,
        doseUnit: 'tablet',
        frequency: 'ALTERNATE_DAYS',
        scheduledTimes: ['09:00'],
        startDateYmd: '2026-11-16',
        endDateYmd: '2026-11-20',
        instructions: null,
        remindersEnabled: true,
        status: 'ACTIVE' as const,
      },
    ];
    const week = expandLocalScheduleOccurrencesForRange(
      altSchedules,
      DEMO_FIXTURE_MEDS,
      [],
      '2026-11-16',
      7,
      buildLocalOccurrenceDate('2026-11-16', '07:00'),
    );
    expect(week.days.map((d) => d.totalCount)).toEqual([1, 0, 1, 0, 1, 0, 0]);

    const today = '2026-11-22';
    const graceBoundaryNow = buildLocalOccurrenceDate(today, '08:45');
    const history = filterLocalDoseHistory(
      createFixtureDemoDoseEvents(today),
      [],
      DEMO_FIXTURE_MEDS,
      {
        fromDate: addDaysYmd(today, -2),
        toDate: today,
        status: 'skipped',
      },
      graceBoundaryNow,
    );
    expect(history.counts).toEqual({ all: 5, taken: 4, skipped: 1, missed: 0 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0].medicineName).toBe('Lumigan Drops 0.01%');

    // Missed history only includes ACTIVE occurrences strictly past grace period
    const activeSched = [
      {
        id: 'sched-missed-check',
        patientMedicationId: 'm1',
        doseAmount: 1,
        doseUnit: 'tablet',
        frequency: 'DAILY',
        scheduledTimes: ['08:00', '20:00'],
        startDateYmd: today,
        endDateYmd: null,
        instructions: null,
        remindersEnabled: true,
        status: 'ACTIVE' as const,
      },
    ];
    const withinGrace = filterLocalDoseHistory(
      [],
      activeSched,
      DEMO_FIXTURE_MEDS,
      { fromDate: today, toDate: today, status: 'all' },
      buildLocalOccurrenceDate(today, '08:45'),
    );
    expect(withinGrace.counts).toEqual({ all: 0, taken: 0, skipped: 0, missed: 0 });

    const pastGrace = filterLocalDoseHistory(
      [],
      activeSched,
      DEMO_FIXTURE_MEDS,
      { fromDate: today, toDate: today, status: 'missed' },
      buildLocalOccurrenceDate(today, '09:15'),
    );
    expect(pastGrace.counts).toEqual({ all: 1, taken: 0, skipped: 0, missed: 1 });
    expect(pastGrace.items[0].scheduledTime12).toBe('08:00 AM');

    const pausedNotMissed = filterLocalDoseHistory(
      [],
      [{ ...activeSched[0], status: 'PAUSED' as const }],
      DEMO_FIXTURE_MEDS,
      { fromDate: today, toDate: today, status: 'missed' },
      buildLocalOccurrenceDate(today, '09:15'),
    );
    expect(pausedNotMissed.counts.missed).toBe(0);
  });

  it('summarizes period statuses consistently for Home and Schedule period badges', () => {
    const baseItem = {
      occurrenceKey: 'k1',
      doseEventId: null,
      scheduleId: 's1',
      patientMedicationId: 'm1',
      medicineName: 'Napa',
      strength: '500 mg',
      dosageForm: 'Tablet',
      doseAmount: '1',
      doseUnit: 'tablet',
      doseInstruction: '1 tablet',
      scheduledDateYmd: '2026-11-23',
      scheduledTime24: '08:00',
      scheduledTime12: '08:00 AM',
      scheduledFor: '2026-11-23T02:00:00.000Z',
      period: 'Morning' as const,
      recordedAt: null,
      note: null,
    };

    expect(summarizePeriodStatus([])).toMatchObject({ label: '0 doses' });
    expect(
      summarizePeriodStatus([
        { ...baseItem, status: 'taken' },
        { ...baseItem, occurrenceKey: 'k2', status: 'missed' },
      ]),
    ).toMatchObject({ label: '1 overdue', textClass: 'text-error' });
    expect(
      summarizePeriodStatus([
        { ...baseItem, status: 'taken' },
        { ...baseItem, occurrenceKey: 'k2', status: 'due' },
      ]),
    ).toMatchObject({ label: '1 upcoming', textClass: 'text-info' });
    expect(
      summarizePeriodStatus([{ ...baseItem, status: 'taken' }]),
    ).toMatchObject({ label: '1 taken', textClass: 'text-success' });
    expect(
      summarizePeriodStatus([{ ...baseItem, status: 'skipped' }]),
    ).toMatchObject({ label: '1 skipped', textClass: 'text-warning' });
  });

  it('resolves current day period, active/past/future timeline states, and default expanded section', () => {
    // Before 12 PM -> Morning; 12 PM to < 6 PM -> Afternoon; >= 6 PM -> Bedtime
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 2, 0, 0))).toBe('Morning');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 8, 15, 0))).toBe('Morning');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 11, 59, 0))).toBe('Morning');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 12, 0, 0))).toBe('Afternoon');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 14, 0, 0))).toBe('Afternoon');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 17, 59, 0))).toBe('Afternoon');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 18, 0, 0))).toBe('Bedtime');
    expect(getCurrentDayPeriod(new Date(2026, 10, 27, 22, 0, 0))).toBe('Bedtime');

    // Maps legacy 'Evening' items cleanly into Afternoon (< 18:00) or Bedtime (>= 18:00)
    expect(resolveTimelinePeriod({ period: 'Evening', scheduledTime24: '17:30' })).toBe('Afternoon');
    expect(resolveTimelinePeriod({ period: 'Evening', scheduledTime24: '18:30' })).toBe('Bedtime');

    // Dynamic past/active/future section highlighting on today vs past/future days
    const afternoonNow = new Date(2026, 10, 27, 14, 0, 0);
    expect(resolveSectionTimelineState('Morning', '2026-11-27', '2026-11-27', afternoonNow)).toBe('past');
    expect(resolveSectionTimelineState('Afternoon', '2026-11-27', '2026-11-27', afternoonNow)).toBe('active');
    expect(resolveSectionTimelineState('Bedtime', '2026-11-27', '2026-11-27', afternoonNow)).toBe('future');
    expect(resolveSectionTimelineState('Morning', '2026-11-26', '2026-11-27', afternoonNow)).toBe('past');
    expect(resolveSectionTimelineState('Morning', '2026-11-28', '2026-11-27', afternoonNow)).toBe('future');

    // Exact boundary delay helper schedules next period change cleanly
    const delayToNoon = getMsUntilNextPeriodBoundary(new Date(2026, 10, 27, 11, 59, 0));
    expect(delayToNoon).toBeGreaterThanOrEqual(60_000);
    expect(delayToNoon).toBeLessThanOrEqual(61_000);

    const sampleDoses = [
      {
        occurrenceKey: 'm1',
        doseEventId: null,
        scheduleId: 's1',
        patientMedicationId: 'p1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet',
        scheduledDateYmd: '2026-11-27',
        scheduledTime24: '08:00',
        scheduledTime12: '08:00 AM',
        scheduledFor: '2026-11-27T02:00:00.000Z',
        period: 'Morning' as const,
        status: 'missed' as const,
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'a1',
        doseEventId: null,
        scheduleId: 's1',
        patientMedicationId: 'p1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet',
        scheduledDateYmd: '2026-11-27',
        scheduledTime24: '13:00',
        scheduledTime12: '01:00 PM',
        scheduledFor: '2026-11-27T07:00:00.000Z',
        period: 'Afternoon' as const,
        status: 'due' as const,
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'b1',
        doseEventId: null,
        scheduleId: 's1',
        patientMedicationId: 'p1',
        medicineName: 'Maxpro',
        strength: '40 mg',
        dosageForm: 'Capsule',
        doseAmount: '1',
        doseUnit: 'capsule',
        doseInstruction: '1 capsule',
        scheduledDateYmd: '2026-11-27',
        scheduledTime24: '22:00',
        scheduledTime12: '10:00 PM',
        scheduledFor: '2026-11-27T16:00:00.000Z',
        period: 'Bedtime' as const,
        status: 'upcoming' as const,
        recordedAt: null,
        note: null,
      },
    ];

    expect(
      resolveDefaultExpandedPeriod(sampleDoses, new Date(2026, 10, 27, 9, 0, 0)),
    ).toBe('Morning');
    expect(
      resolveDefaultExpandedPeriod(sampleDoses, new Date(2026, 10, 27, 13, 30, 0)),
    ).toBe('Afternoon');
    // From 6 PM onward, Bedtime is active and expands automatically
    expect(
      resolveDefaultExpandedPeriod(
        sampleDoses.map((d) => ({ ...d, status: 'taken' as const })),
        new Date(2026, 10, 27, 18, 15, 0),
      ),
    ).toBe('Bedtime');
    expect(resolveDefaultExpandedPeriod([], new Date(2026, 10, 27, 9, 0, 0))).toBeNull();
  });

  it('estimates stock duration and schedule summary cleanly without invalid cross-unit guesses', () => {
    const twiceDailySchedule = {
      id: 's-twice',
      patientMedicationId: 'm1',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'TWICE_DAILY',
      scheduledTimes: ['08:00', '20:00'],
      startDateYmd: '2026-11-27',
      endDateYmd: null,
      instructions: null,
      remindersEnabled: true,
      status: 'ACTIVE' as const,
    };

    const est = estimateStockDurationForMedication({
      stockRemaining: 30,
      stockUnit: 'tablets',
      lowStockThreshold: 5,
      archived: false,
      schedules: [twiceDailySchedule],
    });
    expect(est.daysRemaining).toBe(15);
    expect(est.dailyConsumption).toBe(2);
    expect(est.daysLabel).toBe('≈ 15 days left');
    expect(est.fillRatio).toBe(0.5);
    expect(est.schedulePillText).toBe('Twice daily · 1 tablet');

    // Incompatible unit (drops vs bottle) does not guess days remaining
    const incompatible = estimateStockDurationForMedication({
      stockRemaining: 1,
      stockUnit: 'bottle',
      lowStockThreshold: 1,
      archived: false,
      schedules: [{ ...twiceDailySchedule, doseUnit: 'drops', frequency: 'DAILY', scheduledTimes: ['20:00'] }],
    });
    expect(incompatible.daysRemaining).toBeNull();
    expect(incompatible.daysLabel).toBeNull();
    expect(incompatible.schedulePillText).toBe('Once daily · 1 drop');

    const zeroStock = estimateStockDurationForMedication({
      stockRemaining: 0,
      stockUnit: 'tablets',
      lowStockThreshold: 5,
      archived: false,
      schedules: [twiceDailySchedule],
    });
    expect(zeroStock.daysRemaining).toBe(0);
    expect(zeroStock.daysLabel).toBe('Out of stock');
    expect(zeroStock.fillRatio).toBe(0.04);
  });
});
