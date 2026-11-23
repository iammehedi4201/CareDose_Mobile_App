import { apiRequest } from './config';

export type ScheduleStatusDto = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
export type DoseDisplayStatusDto = 'upcoming' | 'due' | 'missed' | 'taken' | 'skipped';
export type SchedulePeriodGroupDto = 'Morning' | 'Afternoon' | 'Evening' | 'Bedtime';

export interface MedicationScheduleDto {
  id: string;
  patientMedicationId: string;
  doseAmount: string;
  doseUnit: string;
  frequency: string;
  intervalHours: number | null;
  weekdays: number[];
  scheduledTimes: string[];
  scheduledTimes12h: string[];
  startDate: string;
  startDateYmd: string;
  endDate: string | null;
  endDateYmd: string | null;
  instructions: string | null;
  remindersEnabled: boolean;
  status: ScheduleStatusDto;
  createdAt: string;
  updatedAt: string;
  medication?: {
    id: string;
    patientId: string;
    name: string;
    strength: string | null;
    dosageForm: string | null;
    stockUnit: string;
    personalInstructions: string;
  };
}

export interface ScheduledDoseItemDto {
  occurrenceKey: string;
  doseEventId: string | null;
  scheduleId: string;
  patientMedicationId: string;
  medicineName: string;
  strength: string | null;
  dosageForm: string | null;
  imageUrl?: string | null;
  doseAmount: string;
  doseUnit: string;
  doseInstruction: string;
  scheduledDateYmd: string;
  scheduledTime24: string;
  scheduledTime12: string;
  scheduledFor: string;
  period: SchedulePeriodGroupDto;
  status: DoseDisplayStatusDto;
  recordedAt: string | null;
  note: string | null;
}

export interface ScheduleDayBucketDto {
  date: string;
  totalCount: number;
  takenCount: number;
  skippedCount: number;
  pendingCount: number;
  items: ScheduledDoseItemDto[];
}

export interface DailyDosesResponseDto {
  startDate: string;
  daysCount: number;
  timezone: string;
  days: ScheduleDayBucketDto[];
  summary: {
    total: number;
    taken: number;
    skipped: number;
    remaining: number;
  };
  nextDose: ScheduledDoseItemDto | null;
}

export interface DoseHistoryItemDto {
  id: string;
  scheduleId: string;
  patientMedicationId: string;
  medicineName: string;
  strength: string | null;
  dosageForm: string | null;
  imageUrl?: string | null;
  doseAmount: string;
  doseUnit: string;
  scheduledDateYmd: string;
  scheduledTime12: string;
  scheduledFor: string;
  recordedAt: string | null;
  status: 'taken' | 'skipped' | 'missed';
  note: string | null;
}

export interface DoseHistoryResponseDto {
  items: DoseHistoryItemDto[];
  counts: {
    all: number;
    taken: number;
    skipped: number;
    missed: number;
  };
  hasMore: boolean;
  nextCursor: string | null;
}

export interface RecordDoseResultDto {
  doseEventId: string;
  scheduleId: string;
  patientMedicationId: string;
  scheduledFor: string;
  status: 'PLANNED' | 'TAKEN' | 'SKIPPED';
  recordedAt: string | null;
  stockDeducted: boolean;
  deductedQuantity: string;
  newStockRemaining: string;
  stockUnit: string;
  idempotentReplay: boolean;
}

export interface CreateMedicationSchedulePayload {
  doseAmount?: number;
  doseUnit?: string;
  frequency?: string;
  intervalHours?: number | null;
  weekdays?: number[];
  scheduledTimes: string[];
  startDate: string;
  endDate?: string | null;
  instructions?: string | null;
  remindersEnabled?: boolean;
}

export interface UpdateMedicationSchedulePayload {
  doseAmount?: number;
  doseUnit?: string;
  frequency?: string;
  intervalHours?: number | null;
  weekdays?: number[];
  scheduledTimes?: string[];
  startDate?: string;
  endDate?: string | null;
  instructions?: string | null;
  remindersEnabled?: boolean;
  status?: ScheduleStatusDto;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function listPatientSchedules(
  patientId: string,
  token: string,
  status: 'ALL' | ScheduleStatusDto = 'ALL',
): Promise<MedicationScheduleDto[]> {
  return apiRequest<MedicationScheduleDto[]>(
    `/patients/${encodeURIComponent(patientId)}/schedules?status=${encodeURIComponent(status)}`,
    { headers: authHeaders(token) },
  );
}

export function listMedicationSchedules(
  medicationId: string,
  token: string,
): Promise<MedicationScheduleDto[]> {
  return apiRequest<MedicationScheduleDto[]>(
    `/patient-medications/${encodeURIComponent(medicationId)}/schedules`,
    { headers: authHeaders(token) },
  );
}

export function createMedicationSchedule(
  medicationId: string,
  token: string,
  payload: CreateMedicationSchedulePayload,
): Promise<MedicationScheduleDto> {
  return apiRequest<MedicationScheduleDto>(
    `/patient-medications/${encodeURIComponent(medicationId)}/schedules`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

export function updateSchedule(
  scheduleId: string,
  token: string,
  payload: UpdateMedicationSchedulePayload,
): Promise<MedicationScheduleDto> {
  return apiRequest<MedicationScheduleDto>(
    `/schedules/${encodeURIComponent(scheduleId)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

export function deleteSchedule(
  scheduleId: string,
  token: string,
): Promise<{ deleted: true; id: string }> {
  return apiRequest<{ deleted: true; id: string }>(
    `/schedules/${encodeURIComponent(scheduleId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );
}

export function archiveSchedule(
  scheduleId: string,
  token: string,
): Promise<MedicationScheduleDto> {
  return apiRequest<MedicationScheduleDto>(
    `/schedules/${encodeURIComponent(scheduleId)}/archive`,
    {
      method: 'POST',
      headers: authHeaders(token),
    },
  );
}

export function getPatientDoses(
  patientId: string,
  token: string,
  opts: { date?: string; days?: number } = {},
): Promise<DailyDosesResponseDto> {
  const params: string[] = [];
  if (opts.date) params.push(`date=${encodeURIComponent(opts.date)}`);
  if (opts.days) params.push(`days=${encodeURIComponent(String(opts.days))}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return apiRequest<DailyDosesResponseDto>(
    `/patients/${encodeURIComponent(patientId)}/doses${qs}`,
    { headers: authHeaders(token) },
  );
}

export function recordDoseEvent(
  patientId: string,
  token: string,
  payload: {
    scheduleId: string;
    scheduledFor: string;
    action: 'TAKEN' | 'SKIPPED';
    note?: string;
  },
): Promise<RecordDoseResultDto> {
  return apiRequest<RecordDoseResultDto>(
    `/patients/${encodeURIComponent(patientId)}/dose-events/record`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

export function listPatientDoseHistory(
  patientId: string,
  token: string,
  query: {
    from?: string;
    to?: string;
    status?: 'ALL' | 'TAKEN' | 'SKIPPED' | 'MISSED';
    medicationId?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<DoseHistoryResponseDto> {
  const params: string[] = [];
  if (query.from) params.push(`from=${encodeURIComponent(query.from)}`);
  if (query.to) params.push(`to=${encodeURIComponent(query.to)}`);
  if (query.status) params.push(`status=${encodeURIComponent(query.status)}`);
  if (query.medicationId) {
    params.push(`medicationId=${encodeURIComponent(query.medicationId)}`);
  }
  if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
  if (query.limit) params.push(`limit=${encodeURIComponent(String(query.limit))}`);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';

  return apiRequest<DoseHistoryResponseDto>(
    `/patients/${encodeURIComponent(patientId)}/dose-history${qs}`,
    { headers: authHeaders(token) },
  );
}
