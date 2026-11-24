import { apiRequest } from './config';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  glucoseUnit: 'MG_DL' | 'MMOL_L';
  currency: string;
  monthlyBudget: string | null;
  remindersEnabled: boolean;
  soundEnabled: boolean;
  reminderLeadMins: number;
}

export interface UpdateUserSettingsPayload {
  displayName?: string;
  glucoseUnit?: 'MG_DL' | 'MMOL_L';
  monthlyBudget?: number | null;
  remindersEnabled?: boolean;
  soundEnabled?: boolean;
  reminderLeadMins?: number;
}

export function getCurrentUserProfile(token: string): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateCurrentUserSettings(
  token: string,
  payload: UpdateUserSettingsPayload,
): Promise<UserProfileDto> {
  return apiRequest<UserProfileDto>('/users/me/settings', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
