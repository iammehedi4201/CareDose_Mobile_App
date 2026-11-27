import type {
  GlucoseUnitDto,
  HealthChartPointDto,
  HealthReadingItemDto,
  ReadingContextDto,
} from '../../api/health-logs';
import {
  addDaysYmd,
  format24To12Hour,
  getTodayLocalYmd,
  normalizeTimeTo24Hour,
} from '../schedule/dose-rules';

export const HEALTH_READINGS_STORAGE_KEY = 'caredose:health-readings:v1';
export const USER_PREFERENCES_STORAGE_KEY = 'caredose:user-preferences:v1';

export const HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER =
  'Readings are stored exactly as entered for personal tracking. CareDose does not diagnose or interpret blood glucose values.';

const MG_DL_PER_MMOL_L = 18.0182;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface LocalUserPreferences {
  displayName: string;
  glucoseUnit: GlucoseUnitDto;
  remindersEnabled: boolean;
  soundEnabled: boolean;
  reminderLeadMins: number;
  hideMedicineInNotifications: boolean;
  currency: string;
  monthlyBudget: number | null;
  activePatientId: string;
  activePatientName: string;
  activePatientRelationship: string;
  activePatientTimezone: string;
}

export const DEFAULT_USER_PREFERENCES: LocalUserPreferences = {
  displayName: 'Karim',
  glucoseUnit: 'MG_DL',
  remindersEnabled: true,
  soundEnabled: true,
  reminderLeadMins: 10,
  hideMedicineInNotifications: false,
  currency: 'BDT',
  monthlyBudget: 2500,
  activePatientId: 'local-patient',
  activePatientName: 'Karim',
  activePatientRelationship: 'Self',
  activePatientTimezone: 'Asia/Dhaka',
};

export const GLUCOSE_UNIT_OPTIONS: Array<{ label: 'mg/dL' | 'mmol/L'; value: GlucoseUnitDto }> = [
  { label: 'mg/dL', value: 'MG_DL' },
  { label: 'mmol/L', value: 'MMOL_L' },
];

export const READING_CONTEXT_OPTIONS: Array<{
  label: 'Fasting' | 'Before meal' | 'After meal' | 'Other';
  value: ReadingContextDto;
}> = [
  { label: 'Fasting', value: 'FASTING' },
  { label: 'Before meal', value: 'BEFORE_MEAL' },
  { label: 'After meal', value: 'AFTER_MEAL' },
  { label: 'Other', value: 'OTHER' },
];

export const READING_CONTEXT_FILTER_CHIPS: Array<{
  key: ReadingContextDto | 'ALL';
  label: string;
}> = [
  { key: 'ALL', label: 'All' },
  { key: 'FASTING', label: 'Fasting' },
  { key: 'BEFORE_MEAL', label: 'Before meal' },
  { key: 'AFTER_MEAL', label: 'After meal' },
  { key: 'OTHER', label: 'Other' },
];

export const REMINDER_LEAD_TIME_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'At dose time (0 mins)', value: '0' },
  { label: '5 minutes before', value: '5' },
  { label: '10 minutes before', value: '10' },
  { label: '15 minutes before', value: '15' },
  { label: '30 minutes before', value: '30' },
];

export interface HealthReadingDraft {
  value: string;
  unit: GlucoseUnitDto;
  context: ReadingContextDto;
  date: string;
  time: string;
  note?: string;
}

export interface ValidatedHealthReadingInput {
  value: number;
  unit: GlucoseUnitDto;
  context: ReadingContextDto;
  date: string;
  time: string;
  note?: string;
}

export function normalizeGlucoseUnit(raw?: string | null): GlucoseUnitDto {
  const cleaned = (raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (cleaned === 'MMOLL') return 'MMOL_L';
  return 'MG_DL';
}

export function formatGlucoseUnitLabel(unit: GlucoseUnitDto): 'mg/dL' | 'mmol/L' {
  return unit === 'MMOL_L' ? 'mmol/L' : 'mg/dL';
}

export function normalizeReadingContext(raw?: string | null): ReadingContextDto {
  const cleaned = (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (cleaned === 'FASTING') return 'FASTING';
  if (cleaned === 'BEFORE_MEAL' || cleaned === 'BEFOREMEAL') return 'BEFORE_MEAL';
  if (cleaned === 'AFTER_MEAL' || cleaned === 'AFTERMEAL') return 'AFTER_MEAL';
  return 'OTHER';
}

export function formatReadingContextLabel(
  context: ReadingContextDto,
): 'Fasting' | 'Before meal' | 'After meal' | 'Other' {
  switch (context) {
    case 'FASTING':
      return 'Fasting';
    case 'BEFORE_MEAL':
      return 'Before meal';
    case 'AFTER_MEAL':
      return 'After meal';
    case 'OTHER':
    default:
      return 'Other';
  }
}

export function formatGlucoseNumberDisplay(raw: number | string): string {
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return '0';
  return String(Number(num.toFixed(2)));
}

/**
 * Converts blood glucose values between mg/dL and mmol/L (1 mmol/L = 18.0182 mg/dL)
 * strictly for display normalization while leaving stored entries unchanged.
 */
export function convertGlucoseValue(
  value: number,
  fromUnit: GlucoseUnitDto,
  toUnit: GlucoseUnitDto,
): number {
  if (!Number.isFinite(value)) return 0;
  if (fromUnit === toUnit) {
    return Number(value.toFixed(2));
  }
  if (fromUnit === 'MMOL_L' && toUnit === 'MG_DL') {
    return Math.round(value * MG_DL_PER_MMOL_L);
  }
  return Number((value / MG_DL_PER_MMOL_L).toFixed(1));
}

export function computeInitials(displayName?: string | null): string {
  const cleaned = (displayName ?? '').trim();
  if (!cleaned) return 'CD';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatShortReadingDate(ymd: string): string {
  if (!ISO_DATE_RE.test(ymd)) return ymd.slice(5);
  return ymd.slice(5);
}

/**
 * Validates user-entered reading values, unit-appropriate bounds, date, and time.
 */
export function validateHealthReadingDraft(draft: HealthReadingDraft): {
  valid: boolean;
  errors: Record<string, string>;
  parsed?: ValidatedHealthReadingInput;
} {
  const errors: Record<string, string> = {};
  const unit = normalizeGlucoseUnit(draft.unit);
  const context = normalizeReadingContext(draft.context);

  const rawValue = draft.value.trim();
  if (!rawValue) {
    errors.value = 'Reading value is required';
  } else {
    const parsedNum = Number(rawValue);
    if (!Number.isFinite(parsedNum) || parsedNum <= 0) {
      errors.value = 'Enter a valid reading greater than 0';
    } else if (!/^\d+(?:\.\d{1,2})?$/.test(rawValue)) {
      errors.value = 'Use at most 2 decimal places';
    } else if (unit === 'MG_DL' && (parsedNum < 10 || parsedNum > 2000)) {
      errors.value = 'Enter an mg/dL reading between 10 and 2000';
    } else if (unit === 'MMOL_L' && (parsedNum < 0.1 || parsedNum > 100)) {
      errors.value = 'Enter an mmol/L reading between 0.1 and 100';
    }
  }

  const trimmedDate = draft.date.trim();
  if (!ISO_DATE_RE.test(trimmedDate)) {
    errors.date = 'Select a valid reading date';
  }

  const trimmedTime = draft.time.trim();
  if (!trimmedTime) {
    errors.time = 'Select a reading time';
  }

  const trimmedNote = draft.note?.trim() ?? '';
  if (trimmedNote.length > 300) {
    errors.note = 'Note must be 300 characters or fewer';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const normTime24 = normalizeTimeTo24Hour(trimmedTime);
  const normTime12 = format24To12Hour(normTime24);

  return {
    valid: true,
    errors: {},
    parsed: {
      value: Number(Number(rawValue).toFixed(2)),
      unit,
      context,
      date: trimmedDate,
      time: normTime12,
      note: trimmedNote.length > 0 ? trimmedNote : undefined,
    },
  };
}

/**
 * Builds an offline-persisted HealthReadingItemDto using the user's entered value and unit verbatim.
 */
export function createLocalHealthReadingItem(
  input: ValidatedHealthReadingInput,
  patientId = 'local-patient',
  now: Date = new Date(),
  options: { id?: string; isSample?: boolean } = {},
): HealthReadingItemDto {
  const time24 = normalizeTimeTo24Hour(input.time);
  const time12 = format24To12Hour(time24);
  const [y, m, d] = input.date.split('-').map(Number);
  const [hh, mm] = time24.split(':').map(Number);
  const localMeasured = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  const measuredIso = Number.isNaN(localMeasured.getTime())
    ? now.toISOString()
    : localMeasured.toISOString();

  const fixedValue = input.value.toFixed(2);
  const id =
    options.id ?? `hr-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  return {
    id,
    patientId,
    value: fixedValue,
    displayValue: formatGlucoseNumberDisplay(fixedValue),
    unit: input.unit,
    unitLabel: formatGlucoseUnitLabel(input.unit),
    context: input.context,
    contextLabel: formatReadingContextLabel(input.context),
    measuredAt: measuredIso,
    measuredDateYmd: input.date,
    measuredTime24: time24,
    measuredTime12: time12,
    note: input.note ?? null,
    createdAt: now.toISOString(),
    isSample: options.isSample,
  };
}

function compareReadingsNewestFirst(
  a: HealthReadingItemDto,
  b: HealthReadingItemDto,
): number {
  const aMs = new Date(a.measuredAt).getTime();
  const bMs = new Date(b.measuredAt).getTime();
  if (aMs !== bMs) return bMs - aMs;
  const aCreated = new Date(a.createdAt).getTime();
  const bCreated = new Date(b.createdAt).getTime();
  if (aCreated !== bCreated) return bCreated - aCreated;
  return b.id.localeCompare(a.id);
}

/**
 * Computes sorted readings, overall latest reading, and 7-point preferred-unit chart bars.
 */
export function buildLocalHealthReadingsSummary(
  allReadings: HealthReadingItemDto[],
  preferredUnit: GlucoseUnitDto,
  contextFilter: ReadingContextDto | 'ALL' = 'ALL',
): {
  items: HealthReadingItemDto[];
  latestReading: HealthReadingItemDto | null;
  filteredLatestReading: HealthReadingItemDto | null;
  chartPoints: HealthChartPointDto[];
  totalCount: number;
} {
  const sortedAll = [...allReadings].sort(compareReadingsNewestFirst);
  const filtered =
    contextFilter === 'ALL'
      ? sortedAll
      : sortedAll.filter((r) => r.context === contextFilter);

  const preferredUnitLabel = formatGlucoseUnitLabel(preferredUnit);
  const chartPoints: HealthChartPointDto[] = filtered
    .slice(0, 7)
    .reverse()
    .map((item) => {
      const numericRaw = Number(item.value);
      return {
        id: item.id,
        measuredDateYmd: item.measuredDateYmd,
        shortDateLabel: formatShortReadingDate(item.measuredDateYmd),
        measuredTime12: item.measuredTime12,
        contextLabel: item.contextLabel,
        originalValue: item.displayValue,
        originalUnitLabel: item.unitLabel,
        convertedValue: convertGlucoseValue(numericRaw, item.unit, preferredUnit),
        unitLabel: preferredUnitLabel,
      };
    });

  return {
    items: filtered,
    latestReading: sortedAll[0] ?? null,
    filteredLatestReading: filtered[0] ?? null,
    chartPoints,
    totalCount: filtered.length,
  };
}

/**
 * Explicitly constructs clearly tagged sample demo readings when requested in demo mode.
 */
export function createSampleDemoHealthReadings(
  todayYmd: string = getTodayLocalYmd(),
): HealthReadingItemDto[] {
  const specs: Array<{
    dayOffset: number;
    value: number;
    unit: GlucoseUnitDto;
    context: ReadingContextDto;
    time: string;
    note?: string;
  }> = [
    { dayOffset: -6, value: 112, unit: 'MG_DL', context: 'FASTING', time: '07:20 AM' },
    { dayOffset: -5, value: 138, unit: 'MG_DL', context: 'AFTER_MEAL', time: '02:15 PM' },
    { dayOffset: -4, value: 109, unit: 'MG_DL', context: 'FASTING', time: '07:40 AM' },
    { dayOffset: -3, value: 6.4, unit: 'MMOL_L', context: 'BEFORE_MEAL', time: '01:05 PM', note: 'Sample mmol/L check' },
    { dayOffset: -2, value: 118, unit: 'MG_DL', context: 'FASTING', time: '07:25 AM' },
    { dayOffset: -1, value: 142, unit: 'MG_DL', context: 'AFTER_MEAL', time: '09:10 PM' },
    { dayOffset: 0, value: 106, unit: 'MG_DL', context: 'FASTING', time: '07:30 AM', note: 'Sample morning fasting check' },
  ];

  return specs.map((s, idx) =>
    createLocalHealthReadingItem(
      {
        value: s.value,
        unit: s.unit,
        context: s.context,
        date: addDaysYmd(todayYmd, s.dayOffset),
        time: s.time,
        note: s.note,
      },
      'local-patient',
      new Date(),
      { id: `sample-hr-${idx + 1}`, isSample: true },
    ),
  );
}
