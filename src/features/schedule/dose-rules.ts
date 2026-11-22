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
  every_8_hours: 'EVERY_8_HOURS',
  'every 8 hours': 'EVERY_8_HOURS',
  alternate_days: 'ALTERNATE_DAYS',
  every_2_days: 'ALTERNATE_DAYS',
  'alternate days': 'ALTERNATE_DAYS',
  weekly: 'WEEKLY',
  as_needed: 'AS_NEEDED',
  'as needed': 'AS_NEEDED',
};

const FREQUENCY_CODE_TO_LABEL: Record<string, string> = {
  DAILY: 'Once daily',
  TWICE_DAILY: 'Twice daily',
  EVERY_8_HOURS: 'Every 8 hours',
  ALTERNATE_DAYS: 'Alternate days',
  WEEKLY: 'Weekly',
  AS_NEEDED: 'As needed',
};

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
): string[] {
  const first = normalizeTimeTo24Hour(primaryTime);
  const code = normalizeScheduleFrequencyCode(frequency);
  if (code === 'TWICE_DAILY') {
    const second = normalizeTimeTo24Hour(secondaryTime || '08:00 PM');
    return [...new Set([first, second])].sort();
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

export const DOSE_DUE_LEAD_MS = 15 * 60_000;
export const DOSE_GRACE_PERIOD_MS = 60 * 60_000;

export function normalizeScheduleFrequencyCode(raw?: string | null): string {
  const key = (raw ?? '').trim().toLowerCase();
  return FREQUENCY_LABEL_TO_CODE[key] ?? 'DAILY';
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
  return true;
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

    for (const sched of schedules) {
      const med = medMap.get(sched.patientMedicationId);
      if (!med || med.archived) continue;
      if (!isLocalScheduleActiveOnDate(sched, ymd)) continue;

      const sortedTimes = [...new Set(sched.scheduledTimes.map(normalizeTimeTo24Hour))].sort();
      for (const time24 of sortedTimes) {
        const dt = buildLocalOccurrenceDate(ymd, time24);
        const scheduledFor = dt.toISOString();
        const occurrenceKey = `${sched.id}:${scheduledFor}`;
        const recorded = eventMap.get(occurrenceKey);

        const amountText = Number.isInteger(sched.doseAmount)
          ? String(sched.doseAmount)
          : String(Number(sched.doseAmount.toFixed(2)));
        const note = (sched.instructions || med.instructions || '').trim();

        items.push({
          occurrenceKey,
          doseEventId: recorded?.id ?? null,
          scheduleId: sched.id,
          patientMedicationId: med.id,
          medicineName: med.name,
          strength: med.strength ?? null,
          dosageForm: med.dosageForm,
          doseAmount: Number(sched.doseAmount).toFixed(2),
          doseUnit: sched.doseUnit,
          doseInstruction: note
            ? `${amountText} ${sched.doseUnit} · ${note}`
            : `${amountText} ${sched.doseUnit}`,
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

export function filterLocalDoseHistory(
  events: LocalDoseEventRecord[],
  schedules: LocalScheduleRecord[],
  medications: PersonalMedicationRecord[],
  filter: {
    fromDate?: string;
    toDate?: string;
    status?: 'all' | 'taken' | 'skipped';
    medicationId?: string | null;
  },
): DoseHistoryResponseDto {
  const schedMap = new Map(schedules.map((s) => [s.id, s]));
  const medMap = new Map(medications.map((m) => [m.id, m]));

  const baseMatches = events.filter((ev) => {
    if (filter.medicationId && ev.patientMedicationId !== filter.medicationId) {
      return false;
    }
    if (filter.fromDate && ev.scheduledDateYmd < filter.fromDate) {
      return false;
    }
    if (filter.toDate && ev.scheduledDateYmd > filter.toDate) {
      return false;
    }
    return true;
  });

  const takenCount = baseMatches.filter((e) => e.status === 'taken').length;
  const skippedCount = baseMatches.filter((e) => e.status === 'skipped').length;

  const statusFiltered = baseMatches
    .filter((ev) => !filter.status || filter.status === 'all' || ev.status === filter.status)
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  const items: DoseHistoryItemDto[] = statusFiltered.map((ev) => {
    const med = medMap.get(ev.patientMedicationId);
    const sched = schedMap.get(ev.scheduleId);
    return {
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
    };
  });

  return {
    items,
    counts: {
      all: baseMatches.length,
      taken: takenCount,
      skipped: skippedCount,
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
