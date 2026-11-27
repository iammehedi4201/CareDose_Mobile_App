import { apiRequest } from './config';

export interface PatientProfileDto {
  id: string;
  ownerUserId: string;
  name: string;
  relationship: string;
  timezone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientProfilePayload {
  name: string;
  relationship?: string;
  timezone?: string;
  isDefault?: boolean;
}

export interface UpdatePatientProfilePayload {
  name?: string;
  relationship?: string;
  timezone?: string;
  isDefault?: boolean;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Lists care recipient profiles owned by the authenticated user.
 */
export async function listPatientProfiles(token: string): Promise<PatientProfileDto[]> {
  return apiRequest<PatientProfileDto[]>('/patients', {
    headers: authHeaders(token),
  });
}

/**
 * Creates a new care recipient profile.
 */
export async function createPatientProfile(
  token: string,
  payload: CreatePatientProfilePayload,
): Promise<PatientProfileDto> {
  return apiRequest<PatientProfileDto>('/patients', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

/**
 * Updates metadata on a care recipient profile.
 */
export async function updatePatientProfile(
  patientId: string,
  token: string,
  payload: UpdatePatientProfilePayload,
): Promise<PatientProfileDto> {
  return apiRequest<PatientProfileDto>(`/patients/${encodeURIComponent(patientId)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}
