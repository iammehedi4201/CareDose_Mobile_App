import { apiRequest } from './config';

export type GlucoseUnitDto = 'MG_DL' | 'MMOL_L';
export type ReadingContextDto = 'FASTING' | 'BEFORE_MEAL' | 'AFTER_MEAL' | 'OTHER';

export interface HealthReadingItemDto {
  id: string;
  patientId: string;
  value: string;
  displayValue: string;
  unit: GlucoseUnitDto;
  unitLabel: 'mg/dL' | 'mmol/L';
  context: ReadingContextDto;
  contextLabel: 'Fasting' | 'Before meal' | 'After meal' | 'Other';
  measuredAt: string;
  measuredDateYmd: string;
  measuredTime24: string;
  measuredTime12: string;
  note: string | null;
  createdAt: string;
  isSample?: boolean;
}

export interface HealthChartPointDto {
  id: string;
  measuredDateYmd: string;
  shortDateLabel: string;
  measuredTime12: string;
  contextLabel: string;
  originalValue: string;
  originalUnitLabel: 'mg/dL' | 'mmol/L';
  convertedValue: number;
  unitLabel: 'mg/dL' | 'mmol/L';
}

export interface ListHealthReadingsResponseDto {
  patientId: string;
  timezone: string;
  preferredUnit: GlucoseUnitDto;
  preferredUnitLabel: 'mg/dL' | 'mmol/L';
  items: HealthReadingItemDto[];
  latestReading: HealthReadingItemDto | null;
  chartPoints: HealthChartPointDto[];
  totalCount: number;
  nextCursor: string | null;
  disclaimer: string;
}

export interface CreateHealthReadingPayload {
  value: number;
  unit?: GlucoseUnitDto;
  context?: ReadingContextDto;
  measuredAt?: string;
  date?: string;
  time?: string;
  note?: string;
}

export interface ListHealthReadingsQuery {
  from?: string;
  to?: string;
  context?: ReadingContextDto;
  limit?: number;
  cursor?: string;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Lists blood glucose readings and 7-day normalized chart points for a patient profile.
 */
export async function listPatientHealthReadings(
  patientId: string,
  token: string,
  query: ListHealthReadingsQuery = {},
): Promise<ListHealthReadingsResponseDto> {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.context) params.set('context', query.context);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  if (query.cursor) params.set('cursor', query.cursor);
  const qs = params.toString();

  return apiRequest<ListHealthReadingsResponseDto>(
    `/patients/${encodeURIComponent(patientId)}/health-readings${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token) },
  );
}

/**
 * Records a new blood glucose reading without automated diagnostic interpretation.
 */
export async function createPatientHealthReading(
  patientId: string,
  token: string,
  payload: CreateHealthReadingPayload,
): Promise<HealthReadingItemDto> {
  return apiRequest<HealthReadingItemDto>(
    `/patients/${encodeURIComponent(patientId)}/health-readings`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Deletes an individual blood glucose reading owned by the authenticated caregiver.
 */
export async function deletePatientHealthReading(
  patientId: string,
  readingId: string,
  token: string,
): Promise<{ deletedId: string }> {
  return apiRequest<{ deletedId: string }>(
    `/patients/${encodeURIComponent(patientId)}/health-readings/${encodeURIComponent(readingId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );
}
