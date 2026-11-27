import type {
  DailyDosesResponseDto,
  DoseDisplayStatusDto,
  DoseHistoryItemDto,
  DoseHistoryResponseDto,
  MedicationScheduleDto,
  ScheduleDayBucketDto,
  SchedulePeriodGroupDto,
  ScheduledDoseItemDto,
  ScheduleStatusDto,
} from '../../api/schedules';
import type { PersonalMedicationRecord } from '../medications/medication-helpers';

export interface LocalScheduleRecord {
  id: string;
  patientMedicationId: string;
  doseAmount: number;
  doseUnit: string;
  frequency: string;
  intervalHours?: number | null;
  weekdays?: number[];
  scheduledTimes: string[];
  startDateYmd: string;
  endDateYmd: string | null;
  instructions: string | null;
  remindersEnabled: boolean;
  status: ScheduleStatusDto;
}

export interface LocalDoseEventRecord {
  id: string;
  occurrenceKey: string;
  scheduleId: string;
  patientMedicationId: string;
  scheduledDateYmd: string;
  scheduledTime24: string;
  scheduledFor: string;
  status: 'taken' | 'skipped';
  recordedAt: string;
  note: string | null;
}

const FREQUENCY_LABEL_TO_CODE: Record<string, string> = {
  daily: 'DAILY',
  once_daily: 'DAILY',
  'once daily': 'DAILY',
  twice_daily: 'TWICE_DAILY',
  'twice daily': 'TWICE_DAILY',
  three_times_daily: 'THREE_TIMES_DAILY',
  'three times daily': 'THREE_TIMES_DAILY',
  '3 times daily': 'THREE_TIMES_DAILY',
  thrice_daily: 'THREE_TIMES_DAILY',
  custom_times: 'CUSTOM_TIMES',
  'custom times': 'CUSTOM_TIMES',
  custom: 'CUSTOM_TIMES',
  every_x_hours: 'EVERY_X_HOURS',
  'every x hours': 'EVERY_X_HOURS',
  every_8_hours: 'EVERY_8_HOURS',
  'every 8 hours': 'EVERY_8_HOURS',
  alternate_days: 'ALTERNATE_DAYS',
  every_2_days: 'ALTERNATE_DAYS',
  'every 2 days': 'ALTERNATE_DAYS',
  'alternate days': 'ALTERNATE_DAYS',
  selected_weekdays: 'SELECTED_WEEKDAYS',
  'selected weekdays': 'SELECTED_WEEKDAYS',
  weekdays: 'SELECTED_WEEKDAYS',
  weekly: 'WEEKLY',
  as_needed: 'AS_NEEDED',
  'as needed': 'AS_NEEDED',
};

const FREQUENCY_CODE_TO_LABEL: Record<string, string> = {
  DAILY: 'Once daily',
  TWICE_DAILY: 'Twice daily',
  THREE_TIMES_DAILY: 'Three times daily',
  CUSTOM_TIMES: 'Custom times',
  EVERY_X_HOURS: 'Every X hours',
  EVERY_8_HOURS: 'Every 8 hours',
  ALTERNATE_DAYS: 'Alternate days',
  SELECTED_WEEKDAYS: 'Selected weekdays',
  WEEKLY: 'Weekly',
  AS_NEEDED: 'As needed',
};

export const WEEKDAY_OPTIONS = [
  { value: 1, short: 'Mon', label: 'Monday' },
  { value: 2, short: 'Tue', label: 'Tuesday' },
  { value: 3, short: 'Wed', label: 'Wednesday' },
  { value: 4, short: 'Thu', label: 'Thursday' },
  { value: 5, short: 'Fri', label: 'Friday' },
  { value: 6, short: 'Sat', label: 'Saturday' },
  { value: 0, short: 'Sun', label: 'Sunday' },
] as const;

const UNIT_CANONICAL_MAP: Record<string, string> = {
  tablet: 'tablet',
  tablets: 'tablet',
  tab: 'tablet',
  tabs: 'tablet',
  capsule: 'capsule',
  capsules: 'capsule',
  cap: 'capsule',
  caps: 'capsule',
  ml: 'ml',
  vial: 'vial',
  vials: 'vial',
  puff: 'puff',
  puffs: 'puff',
  sachet: 'sachet',
  sachets: 'sachet',
  suppository: 'suppository',
  suppositories: 'suppository',
  piece: 'piece',
  pieces: 'piece',
  ampoule: 'ampoule',
  ampoules: 'ampoule',
  syringe: 'syringe',
  syringes: 'syringe',
  pen: 'pen',
  pens: 'pen',
  cartridge: 'cartridge',
  cartridges: 'cartridge',
  bag: 'bag',
  bags: 'bag',
  drop: 'drop',
  drops: 'drop',
  bottle: 'bottle',
  bottles: 'bottle',
  tube: 'tube',
  tubes: 'tube',
};

export function formatDoseActionFeedback(outcome: {
  status: 'taken' | 'skipped';
  stockDeducted: boolean;
  deductedQuantity: number;
  stockUnit: string;
  idempotentReplay: boolean;
}): string {
  if (outcome.status === 'skipped') {
    return outcome.idempotentReplay
      ? 'Dose was already recorded as skipped.'
      : 'Dose marked as skipped (no stock deducted).';
  }
  if (outcome.idempotentReplay) {
    return 'Dose was already confirmed as taken.';
  }
  if (outcome.stockDeducted && outcome.deductedQuantity > 0) {
    const qty = Number.isInteger(outcome.deductedQuantity)
      ? String(outcome.deductedQuantity)
      : String(Number(outcome.deductedQuantity.toFixed(2)));
    return `Dose marked as taken (−${qty} ${outcome.stockUnit} from stock).`;
  }
  return 'Dose confirmed as taken.';
}

export function buildScheduledTimesForFrequency(
  primaryTime: string,
  frequency: string,
  secondaryTime?: string,
  extraTimes: string[] = [],
): string[] {
  const first = normalizeTimeTo24Hour(primaryTime);
  const code = normalizeScheduleFrequencyCode(frequency);
  if (code === 'TWICE_DAILY') {
    const second = normalizeTimeTo24Hour(secondaryTime || '08:00 PM');
    return [...new Set([first, second])].sort();
  }
  if (code === 'THREE_TIMES_DAILY' || code === 'CUSTOM_TIMES') {
    const combined = [first, ...(secondaryTime ? [secondaryTime] : []), ...extraTimes]
      .filter((t) => t.trim().length > 0)
      .map(normalizeTimeTo24Hour);
    return [...new Set(combined)].sort();
  }
  if (code === 'EVERY_8_HOURS') {
    const [hStr, mStr] = first.split(':');
    const h0 = Number(hStr);
    const h1 = (h0 + 8) % 24;
    const h2 = (h0 + 16) % 24;
    return [
      first,
      `${String(h1).padStart(2, '0')}:${mStr}`,
      `${String(h2).padStart(2, '0')}:${mStr}`,
    ].sort();
  }
  return [first];
}

export function findDuplicateTimes(times: string[]): boolean {
  const nonEmpty = times.map((t) => t.trim()).filter(Boolean);
  const normalized = nonEmpty.map(normalizeTimeTo24Hour);
  return new Set(normalized).size !== normalized.length;
}

export function adaptDefaultDoseUnit(
  dosageForm?: string | null,
  stockUnit?: string | null,
): string {
  const form = (dosageForm ?? '').trim().toLowerCase();
  const stock = (stockUnit ?? '').trim().toLowerCase();

  if (form.includes('capsule')) return 'capsules';
  if (form.includes('tablet')) return 'tablets';
  if (form.includes('drop') || form.includes('ophthalmic') || form.includes('otic')) {
    return 'drops';
  }
  if (form.includes('syrup') || form.includes('suspension') || form.includes('solution') || form.includes('elixir')) {
    return 'mL';
  }
  if (form.includes('suppository') || form.includes('pessary')) return 'pieces';
  if (form.includes('inhaler') || form.includes('mdi') || form.includes('spray')) return 'puffs';
  if (form.includes('sachet') || form.includes('powder') || form.includes('granules')) return 'sachets';
  if (form.includes('cream') || form.includes('ointment') || form.includes('gel')) return 'applications';
  if (form.includes('injection') || form.includes('infusion')) {
    if (stock === 'ampoules' || stock === 'ampoule') return 'ampoules';
    if (stock === 'syringes' || stock === 'syringe') return 'syringes';
    if (stock === 'pens' || stock === 'pen') return 'pens';
    if (stock === 'cartridges' || stock === 'cartridge') return 'cartridges';
    if (stock === 'ml') return 'mL';
    return 'vials';
  }

  if (stock === 'ml') return 'mL';
  if (stock === 'capsules') return 'capsules';
  if (stock === 'pieces') return 'pieces';
  if (stock === 'bottle' || stock === 'bottles') return 'drops';
  if (stock === 'vials' || stock === 'ampoules' || stock === 'syringes' || stock === 'sachets' || stock === 'puffs') {
    return stock;
  }
  return 'tablets';
}

export function getDoseUnitOptions(
  dosageForm?: string | null,
  stockUnit?: string | null,
): Array<{ label: string; value: string }> {
  const primary = adaptDefaultDoseUnit(dosageForm, stockUnit);
  const form = (dosageForm ?? '').trim().toLowerCase();

  if (form.includes('injection') || form.includes('infusion')) {
    const candidates = [primary, 'mL', 'vials', 'ampoules', 'syringes', 'units'];
    const seen = new Set<string>();
    return candidates
      .filter((c) => {
        const key = c.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((u) => ({ label: u, value: u }));
  }

  if (primary === 'drops') {
    return [
      { label: 'drops', value: 'drops' },
      { label: 'mL', value: 'mL' },
    ];
  }

  if (primary === 'mL') {
    return [
      { label: 'mL', value: 'mL' },
      { label: 'drops', value: 'drops' },
    ];
  }

  if (primary === 'applications') {
    return [
      { label: 'applications', value: 'applications' },
      { label: 'gm', value: 'gm' },
      { label: 'tubes', value: 'tubes' },
    ];
  }

  return [{ label: primary, value: primary }];
}

export function formatDoseAmountDisplay(amount: number | string, doseUnit: string): string {
  const num = Number(amount);
  const cleanNum = Number.isFinite(num)
    ? Number.isInteger(num)
      ? String(num)
      : String(Number(num.toFixed(2)))
    : String(amount);
  const trimmedUnit = doseUnit.trim();
  const singularMap: Record<string, string> = {
    tablets: 'tablet',
    capsules: 'capsule',
    pieces: 'piece',
    drops: 'drop',
    vials: 'vial',
    ampoules: 'ampoule',
    syringes: 'syringe',
    pens: 'pen',
    cartridges: 'cartridge',
    bags: 'bag',
    puffs: 'puff',
    sachets: 'sachet',
    applications: 'application',
    tubes: 'tube',
    units: 'unit',
  };
  if (num === 1 && singularMap[trimmedUnit.toLowerCase()]) {
    return `${cleanNum} ${singularMap[trimmedUnit.toLowerCase()]}`;
  }
  return `${cleanNum} ${trimmedUnit}`;
}

export function formatRecurrenceSummary(sched: {
  frequency: string;
  intervalHours?: number | null;
  weekdays?: number[];
}): string {
  const code = normalizeScheduleFrequencyCode(sched.frequency);
  if (code === 'EVERY_X_HOURS' || code === 'EVERY_8_HOURS') {
    return `Every ${sched.intervalHours ?? 8} hours`;
  }
  if (code === 'SELECTED_WEEKDAYS') {
    const days = Array.isArray(sched.weekdays) ? sched.weekdays : [];
    const labels = WEEKDAY_OPTIONS.filter((w) => days.includes(w.value)).map((w) => w.short);
    return labels.length > 0 ? `Weekdays (${labels.join(', ')})` : 'Selected weekdays';
  }
  return formatFrequencyLabel(code);
}

export function isDuplicateScheduleDefinition(
  existingSchedules: LocalScheduleRecord[],
  candidate: {
    patientMedicationId: string;
    frequency: string;
    intervalHours?: number | null;
    weekdays?: number[];
    scheduledTimes: string[];
    startDateYmd: string;
    endDateYmd?: string | null;
  },
  excludeScheduleId?: string | null,
): boolean {
  const candFreq = normalizeScheduleFrequencyCode(candidate.frequency);
  const candInterval =
    candFreq === 'EVERY_X_HOURS' || candFreq === 'EVERY_8_HOURS'
      ? (candidate.intervalHours ?? 8)
      : null;
  const candWeekdays =
    candFreq === 'SELECTED_WEEKDAYS'
      ? [...new Set(candidate.weekdays ?? [])].sort((a, b) => a - b)
      : [];
  const candTimes = [...new Set(candidate.scheduledTimes.map(normalizeTimeTo24Hour))].sort();
  const candEnd = candidate.endDateYmd?.trim() || null;

  return existingSchedules.some((s) => {
    if (excludeScheduleId && s.id === excludeScheduleId) return false;
    if (s.status !== 'ACTIVE') return false;
    if (s.patientMedicationId !== candidate.patientMedicationId) return false;

    const exFreq = normalizeScheduleFrequencyCode(s.frequency);
    if (exFreq !== candFreq) return false;

    const exInterval =
      exFreq === 'EVERY_X_HOURS' || exFreq === 'EVERY_8_HOURS'
        ? (s.intervalHours ?? 8)
        : null;
    if (exInterval !== candInterval) return false;

    const exDays =
      exFreq === 'SELECTED_WEEKDAYS'
        ? [...new Set(s.weekdays ?? [])].sort((a, b) => a - b)
        : [];
    if (
      exDays.length !== candWeekdays.length ||
      exDays.some((d, idx) => d !== candWeekdays[idx])
    ) {
      return false;
    }

    const exTimes = [...new Set(s.scheduledTimes.map(normalizeTimeTo24Hour))].sort();
    if (
      exTimes.length !== candTimes.length ||
      exTimes.some((t, idx) => t !== candTimes[idx])
    ) {
      return false;
    }

    const exEnd = s.endDateYmd?.trim() || null;
    const startsAfterEx = exEnd !== null && candidate.startDateYmd > exEnd;
    const endsBeforeEx = candEnd !== null && candEnd < s.startDateYmd;
    return !startsAfterEx && !endsBeforeEx;
  });
}

export const DOSE_DUE_LEAD_MS = 15 * 60_000;
export const DOSE_GRACE_PERIOD_MS = 60 * 60_000;

export function normalizeScheduleFrequencyCode(raw?: string | null): string {
  const key = (raw ?? '').trim().toLowerCase();
  return FREQUENCY_LABEL_TO_CODE[key] ?? (raw ?? 'DAILY').trim().toUpperCase();
}

export function formatFrequencyLabel(code?: string | null): string {
  const upper = (code ?? '').trim().toUpperCase();
  return FREQUENCY_CODE_TO_LABEL[upper] ?? 'Once daily';
}

export function normalizeTimeTo24Hour(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const mer = m12[3];
    if (h >= 1 && h <= 12 && min >= 0 && min <= 59) {
      if (mer === 'AM') {
        h = h === 12 ? 0 : h;
      } else if (h !== 12) {
        h += 12;
      }
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  return '08:00';
}

export function format24To12Hour(time24: string): string {
  const norm = normalizeTimeTo24Hour(time24);
  const [hStr, mStr] = norm.split(':');
  const h = Number(hStr);
  const mer = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${mStr} ${mer}`;
}

export function formatIsoTimestampTo12Hour(iso?: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return format24To12Hour(`${hh}:${mm}`);
}

export function classifyDayPeriod(time24Or12: string): SchedulePeriodGroupDto {
  const norm = normalizeTimeTo24Hour(time24Or12);
  const h = Number(norm.slice(0, 2));
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Bedtime';
}

export function inferSingleDoseUnitFromStockUnit(stockUnit?: string | null): string {
  const cleaned = (stockUnit ?? '').trim().toLowerCase();
  if (cleaned === 'tablets') return 'tablet';
  if (cleaned === 'capsules') return 'capsule';
  if (cleaned === 'pieces') return 'piece';
  if (cleaned === 'vials') return 'vial';
  if (cleaned === 'ampoules') return 'ampoule';
  if (cleaned === 'syringes') return 'syringe';
  if (cleaned === 'sachets') return 'sachet';
  if (cleaned === 'puffs') return 'puff';
  if (cleaned === 'bottle' || cleaned === 'bottles') return 'drop';
  if (cleaned === 'ml') return 'ml';
  return cleaned || 'tablet';
}

export function parseDoseAmountInput(
  raw: string,
  fallbackUnit = 'tablet',
): { amount: number; unit: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) {
    const leading = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s+([a-zA-Z\s]+))?$/);
    if (!leading) return null;
    const amount = Number(leading[1]);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = leading[2]?.trim() || fallbackUnit;
    return { amount: Number(amount.toFixed(2)), unit };
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2]?.trim() || fallbackUnit;
  return { amount: Number(amount.toFixed(2)), unit };
}

export function canConvertDoseUnitToStockUnit(
  doseUnit?: string | null,
  stockUnit?: string | null,
): boolean {
  const d = UNIT_CANONICAL_MAP[(doseUnit ?? '').trim().toLowerCase()] ?? (doseUnit ?? '').trim().toLowerCase();
  const s = UNIT_CANONICAL_MAP[(stockUnit ?? '').trim().toLowerCase()] ?? (stockUnit ?? '').trim().toLowerCase();
  return d.length > 0 && d === s;
}

export function computeStockAfterDoseTaken(
  stockRemaining: number,
  doseAmount: number,
  doseUnit?: string | null,
  stockUnit?: string | null,
): { stockDeducted: boolean; deductedQuantity: number; nextStock: number } {
  if (!canConvertDoseUnitToStockUnit(doseUnit, stockUnit) || stockRemaining <= 0 || doseAmount <= 0) {
    return {
      stockDeducted: false,
      deductedQuantity: 0,
      nextStock: Number(Math.max(0, stockRemaining).toFixed(2)),
    };
  }
  const deducted = Number(Math.min(stockRemaining, doseAmount).toFixed(2));
  const nextStock = Number(Math.max(0, stockRemaining - deducted).toFixed(2));
  return {
    stockDeducted: deducted > 0,
    deductedQuantity: deducted,
    nextStock,
  };
}

export function getTodayLocalYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function addDaysYmd(ymd: string, delta: number): string {
  const date = parseYmdToLocalDate(ymd);
  date.setDate(date.getDate() + delta);
  return getTodayLocalYmd(date);
}

export function diffYmdDays(fromYmd: string, toYmd: string): number {
  const [y1, m1, d1] = fromYmd.split('-').map(Number);
  const [y2, m2, d2] = toYmd.split('-').map(Number);
  return Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
}

export function getMondayOfWeekYmd(ymd: string): string {
  const d = parseYmdToLocalDate(ymd);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  return addDaysYmd(ymd, diffToMon);
}

export function buildLocalOccurrenceDate(ymd: string, time24: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = normalizeTimeTo24Hour(time24).split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

export function formatDayHeadingLabel(ymd: string, todayYmd = getTodayLocalYmd()): string {
  const d = parseYmdToLocalDate(ymd);
  const prefix =
    ymd === todayYmd
      ? 'Today · '
      : ymd === addDaysYmd(todayYmd, -1)
        ? 'Yesterday · '
        : ymd === addDaysYmd(todayYmd, 1)
          ? 'Tomorrow · '
          : '';
  return `${prefix}${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatScheduleBarDateLabel(ymd: string): string {
  const d = parseYmdToLocalDate(ymd);
  return `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatHistoryDateLabel(ymd: string): string {
  const d = parseYmdToLocalDate(ymd);
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function formatWeekRangeLabel(weekStartYmd: string): string {
  const start = parseYmdToLocalDate(weekStartYmd);
  const endYmd = addDaysYmd(weekStartYmd, 6);
  const end = parseYmdToLocalDate(endYmd);
  if (start.getMonth() === end.getMonth()) {
    return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}

export function isLocalScheduleActiveOnDate(
  schedule: LocalScheduleRecord,
  ymd: string,
): boolean {
  if (schedule.status !== 'ACTIVE') return false;
  const freq = normalizeScheduleFrequencyCode(schedule.frequency);
  if (freq === 'AS_NEEDED') return false;
  if (ymd < schedule.startDateYmd) return false;
  if (schedule.endDateYmd && ymd > schedule.endDateYmd) return false;

  const delta = diffYmdDays(schedule.startDateYmd, ymd);
  if (delta < 0) return false;
  if (freq === 'ALTERNATE_DAYS') return delta % 2 === 0;
  if (freq === 'WEEKLY') return delta % 7 === 0;
  if (freq === 'SELECTED_WEEKDAYS') {
    const allowed = Array.isArray(schedule.weekdays) ? schedule.weekdays : [];
    if (allowed.length === 0) return false;
    const [y, m, d] = ymd.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay();
    return allowed.includes(weekday);
  }
  return true;
}

export function getLocalScheduleTimesForDate(
  schedule: LocalScheduleRecord,
  ymd: string,
): string[] {
  if (!isLocalScheduleActiveOnDate(schedule, ymd)) {
    return [];
  }
  const freq = normalizeScheduleFrequencyCode(schedule.frequency);
  const baseTimes = [
    ...new Set(schedule.scheduledTimes.map(normalizeTimeTo24Hour)),
  ].sort();
  if (baseTimes.length === 0) {
    return [];
  }

  if (
    freq === 'EVERY_X_HOURS' ||
    (freq === 'EVERY_8_HOURS' && baseTimes.length === 1)
  ) {
    const stepHours = schedule.intervalHours ?? 8;
    const stepMins = Math.max(1, stepHours) * 60;
    const [hStr, mStr] = baseTimes[0].split(':');
    const firstMin = Number(hStr) * 60 + Number(mStr);
    const diff = diffYmdDays(schedule.startDateYmd, ymd);
    const dayStartMin = diff * 1440;
    const dayEndMin = (diff + 1) * 1440;
    const kStart = Math.max(0, Math.ceil((dayStartMin - firstMin) / stepMins));

    const expanded = new Set<string>();
    for (let k = kStart; ; k += 1) {
      const absMin = firstMin + k * stepMins;
      if (absMin >= dayEndMin) break;
      const minOfDay = absMin - dayStartMin;
      const hh = Math.floor(minOfDay / 60);
      const mm = minOfDay % 60;
      expanded.add(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
    return [...expanded].sort();
  }

  return baseTimes;
}

export function computeDoseDisplayStatus(
  scheduledForIso: string,
  recordedStatus: 'taken' | 'skipped' | null | undefined,
  now: Date = new Date(),
): DoseDisplayStatusDto {
  if (recordedStatus === 'taken') return 'taken';
  if (recordedStatus === 'skipped') return 'skipped';

  const scheduledMs = new Date(scheduledForIso).getTime();
  const diffMs = now.getTime() - scheduledMs;
  if (diffMs > DOSE_GRACE_PERIOD_MS) return 'missed';
  if (diffMs >= -DOSE_DUE_LEAD_MS) return 'due';
  return 'upcoming';
}

export function selectNextDose(
  items: ScheduledDoseItemDto[],
): ScheduledDoseItemDto | null {
  return (
    items.find((item) => item.status === 'due' || item.status === 'upcoming') ?? null
  );
}

export function mapApiScheduleToLocal(dto: MedicationScheduleDto): LocalScheduleRecord {
  return {
    id: dto.id,
    patientMedicationId: dto.patientMedicationId,
    doseAmount: Number(dto.doseAmount) || 1,
    doseUnit: dto.doseUnit,
    frequency: dto.frequency,
    intervalHours: dto.intervalHours ?? null,
    weekdays: Array.isArray(dto.weekdays) ? dto.weekdays : [],
    scheduledTimes: dto.scheduledTimes,
    startDateYmd: dto.startDateYmd,
    endDateYmd: dto.endDateYmd,
    instructions: dto.instructions,
    remindersEnabled: dto.remindersEnabled,
    status: dto.status,
  };
}

export function expandLocalScheduleOccurrencesForRange(
  schedules: LocalScheduleRecord[],
  medications: PersonalMedicationRecord[],
  events: LocalDoseEventRecord[],
  startYmd: string,
  daysCount: number,
  now: Date = new Date(),
): DailyDosesResponseDto {
  const medMap = new Map(medications.map((m) => [m.id, m]));
  const eventMap = new Map(events.map((e) => [e.occurrenceKey, e]));

  const days: ScheduleDayBucketDto[] = [];
  for (let i = 0; i < daysCount; i += 1) {
    const ymd = addDaysYmd(startYmd, i);
    const items: ScheduledDoseItemDto[] = [];
    const seenKeys = new Set<string>();

    for (const sched of schedules) {
      const med = medMap.get(sched.patientMedicationId);
      if (!med || med.archived) continue;

      const sortedTimes = getLocalScheduleTimesForDate(sched, ymd);
      if (sortedTimes.length === 0) continue;

      for (const time24 of sortedTimes) {
        const dt = buildLocalOccurrenceDate(ymd, time24);
        const scheduledFor = dt.toISOString();
        const occurrenceKey = `${sched.id}:${scheduledFor}`;
        if (seenKeys.has(occurrenceKey)) continue;
        seenKeys.add(occurrenceKey);

        const recorded = eventMap.get(occurrenceKey);

        const formattedAmountUnit = formatDoseAmountDisplay(sched.doseAmount, sched.doseUnit);
        const note = (sched.instructions ?? '').trim();

        items.push({
          occurrenceKey,
          doseEventId: recorded?.id ?? null,
          scheduleId: sched.id,
          patientMedicationId: med.id,
          medicineName: med.name,
          strength: med.strength ?? null,
          dosageForm: med.dosageForm,
          imageUrl: med.imageUrl ?? null,
          doseAmount: Number(sched.doseAmount).toFixed(2),
          doseUnit: sched.doseUnit,
          doseInstruction: note
            ? `${formattedAmountUnit} · ${note}`
            : formattedAmountUnit,
          scheduledDateYmd: ymd,
          scheduledTime24: time24,
          scheduledTime12: format24To12Hour(time24),
          scheduledFor,
          period: classifyDayPeriod(time24),
          status: computeDoseDisplayStatus(scheduledFor, recorded?.status, now),
          recordedAt: recorded?.recordedAt ?? null,
          note: recorded?.note ?? null,
        });
      }
    }

    items.sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
    const takenCount = items.filter((d) => d.status === 'taken').length;
    const skippedCount = items.filter((d) => d.status === 'skipped').length;
    days.push({
      date: ymd,
      totalCount: items.length,
      takenCount,
      skippedCount,
      pendingCount: items.length - takenCount - skippedCount,
      items,
    });
  }

  const firstItems = days[0]?.items ?? [];
  const allItems = days.flatMap((d) => d.items);

  return {
    startDate: startYmd,
    daysCount,
    timezone: 'Local',
    days,
    summary: {
      total: firstItems.length,
      taken: days[0]?.takenCount ?? 0,
      skipped: days[0]?.skippedCount ?? 0,
      remaining: firstItems.filter((i) => i.status === 'upcoming' || i.status === 'due').length,
    },
    nextDose: selectNextDose(allItems),
  };
}

export function resolveEffectiveScheduleStatus(
  schedule: Pick<LocalScheduleRecord, 'status' | 'endDateYmd'>,
  todayYmd: string = getTodayLocalYmd(),
): ScheduleStatusDto {
  if (
    schedule.status === 'ACTIVE' &&
    schedule.endDateYmd &&
    schedule.endDateYmd < todayYmd
  ) {
    return 'COMPLETED';
  }
  return schedule.status;
}

function buildMissedLocalDoseHistoryItems(
  schedules: LocalScheduleRecord[],
  medMap: Map<string, PersonalMedicationRecord>,
  recordedSlotKeys: Set<string>,
  filter: {
    fromDate?: string;
    toDate?: string;
    medicationId?: string | null;
  },
  now: Date,
): DoseHistoryItemDto[] {
  const todayYmd = getTodayLocalYmd(now);
  const scanToYmd = filter.toDate && filter.toDate < todayYmd ? filter.toDate : todayYmd;
  const defaultStartYmd = addDaysYmd(todayYmd, -30);
  const earliestSafeYmd = addDaysYmd(scanToYmd, -120);
  const lowerBoundYmd = filter.fromDate
    ? filter.fromDate < earliestSafeYmd
      ? earliestSafeYmd
      : filter.fromDate
    : defaultStartYmd;

  if (lowerBoundYmd > scanToYmd) {
    return [];
  }

  const missed: DoseHistoryItemDto[] = [];
  const seenKeys = new Set<string>();

  for (const sched of schedules) {
    if (sched.status !== 'ACTIVE') continue;
    if (filter.medicationId && sched.patientMedicationId !== filter.medicationId) {
      continue;
    }
    const med = medMap.get(sched.patientMedicationId);
    if (!med || med.archived) continue;

    const endLimitYmd =
      sched.endDateYmd && sched.endDateYmd < scanToYmd ? sched.endDateYmd : scanToYmd;
    let cursorYmd =
      lowerBoundYmd > sched.startDateYmd ? lowerBoundYmd : sched.startDateYmd;

    while (cursorYmd <= endLimitYmd) {
      const times = getLocalScheduleTimesForDate(sched, cursorYmd);
      for (const time24 of times) {
        const scheduledFor = buildLocalOccurrenceDate(cursorYmd, time24).toISOString();
        const slotKey = `${sched.id}:${scheduledFor}`;
        if (seenKeys.has(slotKey) || recordedSlotKeys.has(slotKey)) {
          continue;
        }
        if (computeDoseDisplayStatus(scheduledFor, null, now) !== 'missed') {
          continue;
        }
        seenKeys.add(slotKey);
        missed.push({
          id: `missed:${slotKey}`,
          scheduleId: sched.id,
          patientMedicationId: med.id,
          medicineName: med.name,
          strength: med.strength ?? null,
          dosageForm: med.dosageForm,
          doseAmount: Number(sched.doseAmount ?? 1).toFixed(2),
          doseUnit: sched.doseUnit,
          scheduledDateYmd: cursorYmd,
          scheduledTime12: format24To12Hour(time24),
          scheduledFor,
          recordedAt: null,
          status: 'missed',
          note: null,
        });
      }
      cursorYmd = addDaysYmd(cursorYmd, 1);
    }
  }

  return missed;
}

export function filterLocalDoseHistory(
  events: LocalDoseEventRecord[],
  schedules: LocalScheduleRecord[],
  medications: PersonalMedicationRecord[],
  filter: {
    fromDate?: string;
    toDate?: string;
    status?: 'all' | 'taken' | 'skipped' | 'missed';
    medicationId?: string | null;
  },
  now: Date = new Date(),
): DoseHistoryResponseDto {
  const schedMap = new Map(schedules.map((s) => [s.id, s]));
  const medMap = new Map(medications.map((m) => [m.id, m]));

  const recordedSlotKeys = new Set<string>();
  const recordedItems: DoseHistoryItemDto[] = [];

  for (const ev of events) {
    recordedSlotKeys.add(`${ev.scheduleId}:${ev.scheduledFor}`);
    if (filter.medicationId && ev.patientMedicationId !== filter.medicationId) {
      continue;
    }
    if (filter.fromDate && ev.scheduledDateYmd < filter.fromDate) {
      continue;
    }
    if (filter.toDate && ev.scheduledDateYmd > filter.toDate) {
      continue;
    }
    const med = medMap.get(ev.patientMedicationId);
    const sched = schedMap.get(ev.scheduleId);
    recordedItems.push({
      id: ev.id,
      scheduleId: ev.scheduleId,
      patientMedicationId: ev.patientMedicationId,
      medicineName: med?.name ?? 'Medication',
      strength: med?.strength ?? null,
      dosageForm: med?.dosageForm ?? null,
      doseAmount: Number(sched?.doseAmount ?? 1).toFixed(2),
      doseUnit: sched?.doseUnit ?? 'tablet',
      scheduledDateYmd: ev.scheduledDateYmd,
      scheduledTime12: format24To12Hour(ev.scheduledTime24),
      scheduledFor: ev.scheduledFor,
      recordedAt: ev.recordedAt,
      status: ev.status,
      note: ev.note,
    });
  }

  const missedItems = buildMissedLocalDoseHistoryItems(
    schedules,
    medMap,
    recordedSlotKeys,
    filter,
    now,
  );

  const combined = [...recordedItems, ...missedItems].sort((a, b) =>
    b.scheduledFor.localeCompare(a.scheduledFor),
  );

  const takenCount = combined.filter((e) => e.status === 'taken').length;
  const skippedCount = combined.filter((e) => e.status === 'skipped').length;
  const missedCount = combined.filter((e) => e.status === 'missed').length;

  const items = combined.filter(
    (item) => !filter.status || filter.status === 'all' || item.status === filter.status,
  );

  return {
    items,
    counts: {
      all: combined.length,
      taken: takenCount,
      skipped: skippedCount,
      missed: missedCount,
    },
    hasMore: false,
    nextCursor: null,
  };
}

export function createInitialDemoSchedules(): LocalScheduleRecord[] {
  return [];
}

export function createInitialDemoDoseEvents(): LocalDoseEventRecord[] {
  return [];
}

export function createFixtureDemoSchedules(todayYmd = getTodayLocalYmd()): LocalScheduleRecord[] {
  const startDateYmd = addDaysYmd(todayYmd, -3);
  return [
    {
      id: 'sched-m1',
      patientMedicationId: 'm1',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'TWICE_DAILY',
      scheduledTimes: ['08:00', '20:00'],
      startDateYmd,
      endDateYmd: null,
      instructions: 'After breakfast & dinner',
      remindersEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'sched-m2',
      patientMedicationId: 'm2',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'DAILY',
      scheduledTimes: ['08:30'],
      startDateYmd,
      endDateYmd: null,
      instructions: 'With morning meal',
      remindersEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'sched-m3',
      patientMedicationId: 'm3',
      doseAmount: 1,
      doseUnit: 'capsule',
      frequency: 'DAILY',
      scheduledTimes: ['13:30'],
      startDateYmd,
      endDateYmd: null,
      instructions: 'After lunch',
      remindersEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'sched-m4',
      patientMedicationId: 'm4',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'DAILY',
      scheduledTimes: ['22:00'],
      startDateYmd,
      endDateYmd: null,
      instructions: 'Before sleep',
      remindersEnabled: true,
      status: 'ACTIVE',
    },
    {
      id: 'sched-m5',
      patientMedicationId: 'm5',
      doseAmount: 1,
      doseUnit: 'drop',
      frequency: 'DAILY',
      scheduledTimes: ['19:30'],
      startDateYmd,
      endDateYmd: null,
      instructions: 'Affected eye',
      remindersEnabled: true,
      status: 'ACTIVE',
    },
  ];
}

export function createFixtureDemoDoseEvents(todayYmd = getTodayLocalYmd()): LocalDoseEventRecord[] {
  const yesterday = addDaysYmd(todayYmd, -1);
  const twoDaysAgo = addDaysYmd(todayYmd, -2);

  const makeEv = (
    id: string,
    scheduleId: string,
    medId: string,
    ymd: string,
    time24: string,
    status: 'taken' | 'skipped',
  ): LocalDoseEventRecord => {
    const dt = buildLocalOccurrenceDate(ymd, time24);
    const iso = dt.toISOString();
    return {
      id,
      occurrenceKey: `${scheduleId}:${iso}`,
      scheduleId,
      patientMedicationId: medId,
      scheduledDateYmd: ymd,
      scheduledTime24: time24,
      scheduledFor: iso,
      status,
      recordedAt: iso,
      note: null,
    };
  };

  return [
    makeEv('ev-1', 'sched-m1', 'm1', yesterday, '08:00', 'taken'),
    makeEv('ev-2', 'sched-m2', 'm2', yesterday, '08:30', 'taken'),
    makeEv('ev-3', 'sched-m3', 'm3', yesterday, '13:30', 'taken'),
    makeEv('ev-4', 'sched-m5', 'm5', yesterday, '19:30', 'skipped'),
    makeEv('ev-5', 'sched-m4', 'm4', twoDaysAgo, '22:00', 'taken'),
  ];
}

/**
 * Returns active (non-archived) medicines that do not currently have a booked
 * (non-completed) dose schedule.
 */
export function getUnscheduledActiveMedications(
  activeMedications: PersonalMedicationRecord[],
  schedules: LocalScheduleRecord[],
  todayYmd: string = getTodayLocalYmd(),
): PersonalMedicationRecord[] {
  const bookedMedicationIds = new Set(
    schedules
      .filter((s) => {
        const eff = resolveEffectiveScheduleStatus(s, todayYmd);
        return eff !== 'COMPLETED' && eff !== 'ARCHIVED';
      })
      .map((s) => s.patientMedicationId),
  );
  return activeMedications.filter(
    (m) => !m.archived && !bookedMedicationIds.has(m.id),
  );
}

/**
 * Resolves the initial medicine for ScheduleModal.
 * Never auto-selects activeMeds[0] when creating a new schedule without an explicit target.
 */
export function resolveInitialScheduleMedication(
  activeMedications: PersonalMedicationRecord[],
  initialMedicationId?: string | null,
  editingSchedule?: LocalScheduleRecord | null,
): PersonalMedicationRecord | null {
  if (editingSchedule) {
    return (
      activeMedications.find((m) => m.id === editingSchedule.patientMedicationId) ?? null
    );
  }
  if (initialMedicationId) {
    return activeMedications.find((m) => m.id === initialMedicationId) ?? null;
  }
  return null;
}

export interface PeriodStatusSummary {
  label: string;
  bgClass: string;
  textClass: string;
}

/**
 * Summarizes dose statuses within a day period using CareDose semantic pill tokens.
 */
export function summarizePeriodStatus(periodDoses: ScheduledDoseItemDto[]): PeriodStatusSummary {
  if (periodDoses.length === 0) {
    return {
      label: '0 doses',
      bgClass: 'bg-[#EEF2F0]',
      textClass: 'text-[#5A706B]',
    };
  }
  let overdue = 0;
  let upcoming = 0;
  let taken = 0;
  for (const d of periodDoses) {
    if (d.status === 'missed') overdue += 1;
    else if (d.status === 'upcoming' || d.status === 'due') upcoming += 1;
    else if (d.status === 'taken') taken += 1;
  }
  if (overdue > 0) {
    return {
      label: `${overdue} overdue`,
      bgClass: 'bg-[#FDECEC]',
      textClass: 'text-error',
    };
  }
  if (upcoming > 0) {
    return {
      label: `${upcoming} upcoming`,
      bgClass: 'bg-[#EBF3FD]',
      textClass: 'text-info',
    };
  }
  if (taken === periodDoses.length) {
    return {
      label: `${taken} taken`,
      bgClass: 'bg-mint',
      textClass: 'text-success',
    };
  }
  return {
    label: `${periodDoses.length - taken} skipped`,
    bgClass: 'bg-[#FDF5E6]',
    textClass: 'text-warning',
  };
}
