import { describe, expect, it } from 'vitest';
import {
  buildLocalHealthReadingsSummary,
  computeInitials,
  convertGlucoseValue,
  createLocalHealthReadingItem,
  createSampleDemoHealthReadings,
  validateHealthReadingDraft,
} from './health-helpers';

describe('health-helpers', () => {
  it('converts mixed glucose units symmetrically for chart scaling', () => {
    expect(convertGlucoseValue(6.0, 'MMOL_L', 'MG_DL')).toBe(108);
    expect(convertGlucoseValue(108, 'MG_DL', 'MMOL_L')).toBe(6);
    expect(convertGlucoseValue(5.95, 'MMOL_L', 'MMOL_L')).toBe(5.95);
    expect(convertGlucoseValue(106, 'MG_DL', 'MG_DL')).toBe(106);
  });

  it('validates entered glucose readings strictly without diagnostic interpretation', () => {
    const emptyRes = validateHealthReadingDraft({
      value: '',
      unit: 'MG_DL',
      context: 'FASTING',
      date: '2026-11-25',
      time: '07:30 AM',
    });
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.errors.value).toContain('required');

    const badMmol = validateHealthReadingDraft({
      value: '180',
      unit: 'MMOL_L',
      context: 'FASTING',
      date: '2026-11-25',
      time: '07:30 AM',
    });
    expect(badMmol.valid).toBe(false);
    expect(badMmol.errors.value).toContain('0.1 and 100');

    const validMmol = validateHealthReadingDraft({
      value: '5.9',
      unit: 'MMOL_L',
      context: 'AFTER_MEAL',
      date: '2026-11-25',
      time: '02:15 PM',
      note: 'After lunch check',
    });
    expect(validMmol.valid).toBe(true);
    expect(validMmol.parsed).toEqual({
      value: 5.9,
      unit: 'MMOL_L',
      context: 'AFTER_MEAL',
      date: '2026-11-25',
      time: '02:15 PM',
      note: 'After lunch check',
    });
  });

  it('orders readings newest-first, builds chronological 7-point charts, and supports context filtering', () => {
    const r1 = createLocalHealthReadingItem(
      {
        value: 104,
        unit: 'MG_DL',
        context: 'FASTING',
        date: '2026-11-23',
        time: '07:30 AM',
      },
      'p1',
    );
    const r2 = createLocalHealthReadingItem(
      {
        value: 6.2,
        unit: 'MMOL_L',
        context: 'AFTER_MEAL',
        date: '2026-11-24',
        time: '01:45 PM',
      },
      'p1',
    );
    const r3 = createLocalHealthReadingItem(
      {
        value: 110,
        unit: 'MG_DL',
        context: 'FASTING',
        date: '2026-11-25',
        time: '07:15 AM',
      },
      'p1',
    );

    const summaryMgDl = buildLocalHealthReadingsSummary([r1, r2, r3], 'MG_DL', 'ALL');
    expect(summaryMgDl.latestReading?.id).toBe(r3.id);
    expect(summaryMgDl.items.map((x) => x.id)).toEqual([r3.id, r2.id, r1.id]);
    expect(summaryMgDl.chartPoints).toHaveLength(3);
    expect(summaryMgDl.chartPoints.map((c) => c.id)).toEqual([r1.id, r2.id, r3.id]);
    // Preserves entered value on original row while converting chart bar to mg/dL
    expect(summaryMgDl.chartPoints[1]).toMatchObject({
      originalValue: '6.2',
      originalUnitLabel: 'mmol/L',
      convertedValue: 112,
      unitLabel: 'mg/dL',
    });

    const summaryMmol = buildLocalHealthReadingsSummary([r1, r2, r3], 'MMOL_L', 'FASTING');
    expect(summaryMmol.totalCount).toBe(2);
    expect(summaryMmol.chartPoints).toHaveLength(2);
    expect(summaryMmol.chartPoints[1].unitLabel).toBe('mmol/L');
    expect(summaryMmol.chartPoints[1].convertedValue).toBe(6.1);
    // Unfiltered overall latest remains r3
    expect(summaryMmol.latestReading?.id).toBe(r3.id);
  });

  it('builds explicitly tagged sample readings and computes display initials', () => {
    const sample = createSampleDemoHealthReadings('2026-11-25');
    expect(sample).toHaveLength(7);
    expect(sample.every((item) => item.isSample === true)).toBe(true);
    expect(sample[6].displayValue).toBe('106');
    expect(sample[6].measuredDateYmd).toBe('2026-11-25');

    expect(computeInitials('Karim')).toBe('K');
    expect(computeInitials('Karim Hasan')).toBe('KH');
    expect(computeInitials('  ')).toBe('CD');
  });
});
