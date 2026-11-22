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
  expandLocalScheduleOccurrencesForRange,
  filterLocalDoseHistory,
  format24To12Hour,
  formatWeekRangeLabel,
  getMondayOfWeekYmd,
  normalizeTimeTo24Hour,
  parseDoseAmountInput,
  selectNextDose,
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
    expect(classifyDayPeriod('06:45 PM')).toBe('Evening');
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
    const history = filterLocalDoseHistory(
      createFixtureDemoDoseEvents(today),
      createFixtureDemoSchedules(today),
      DEMO_FIXTURE_MEDS,
      {
        fromDate: addDaysYmd(today, -2),
        toDate: today,
        status: 'skipped',
      },
    );
    expect(history.counts).toEqual({ all: 5, taken: 4, skipped: 1 });
    expect(history.items).toHaveLength(1);
    expect(history.items[0].medicineName).toBe('Lumigan Drops 0.01%');
  });
});
