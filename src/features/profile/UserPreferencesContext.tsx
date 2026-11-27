import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiRequestError, clearSavedAuthSession, readSavedAuthSession } from '../../api/config';
import {
  listPatientProfiles,
  PatientProfileDto,
  updatePatientProfile,
} from '../../api/patients';
import {
  getCurrentUserProfile,
  updateCurrentUserSettings,
  UpdateUserSettingsPayload,
} from '../../api/users';
import {
  DEFAULT_USER_PREFERENCES,
  LocalUserPreferences,
  normalizeGlucoseUnit,
  USER_PREFERENCES_STORAGE_KEY,
} from '../health/health-helpers';

const UUID_PREFIX_RE = /^[0-9a-f]{8}-/i;

export interface UpdateUserPreferencesPatch {
  displayName?: string;
  glucoseUnit?: LocalUserPreferences['glucoseUnit'];
  remindersEnabled?: boolean;
  soundEnabled?: boolean;
  reminderLeadMins?: number;
  hideMedicineInNotifications?: boolean;
  monthlyBudget?: number | null;
}

export interface UpdateActivePatientPatch {
  name?: string;
  relationship?: string;
  timezone?: string;
}

interface UserPreferencesContextValue {
  preferences: LocalUserPreferences;
  patients: PatientProfileDto[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refreshPreferences: () => Promise<void>;
  updatePreferences: (patch: UpdateUserPreferencesPatch) => Promise<void>;
  updateActivePatient: (patch: UpdateActivePatientPatch) => Promise<void>;
  resetDemoPreferences: () => Promise<void>;
  clearAuthSessionAndReset: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [preferences, setPreferences] = useState<LocalUserPreferences>(
    DEFAULT_USER_PREFERENCES,
  );
  const [patients, setPatients] = useState<PatientProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistLocal = useCallback(async (next: LocalUserPreferences) => {
    try {
      await AsyncStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore offline storage errors
    }
  }, []);

  const refreshPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawSaved, session] = await Promise.all([
        AsyncStorage.getItem(USER_PREFERENCES_STORAGE_KEY),
        readSavedAuthSession(),
      ]);

      let merged: LocalUserPreferences = { ...DEFAULT_USER_PREFERENCES };
      if (rawSaved) {
        try {
          const parsed = JSON.parse(rawSaved) as Partial<LocalUserPreferences>;
          merged = {
            ...DEFAULT_USER_PREFERENCES,
            ...parsed,
            glucoseUnit: normalizeGlucoseUnit(parsed.glucoseUnit),
            hideMedicineInNotifications: Boolean(parsed.hideMedicineInNotifications),
          };
          setPreferences(merged);
        } catch {
          setPreferences(DEFAULT_USER_PREFERENCES);
        }
      } else {
        setPreferences(DEFAULT_USER_PREFERENCES);
      }

      if (session) {
        try {
          const [profile, patientList] = await Promise.all([
            getCurrentUserProfile(session.token),
            listPatientProfiles(session.token),
          ]);
          setPatients(patientList);
          const activePatient =
            patientList.find((p) => p.id === session.activePatientId) ??
            patientList.find((p) => p.isDefault) ??
            patientList[0] ??
            null;

          merged = {
            ...merged,
            displayName: profile.displayName || merged.displayName,
            glucoseUnit: normalizeGlucoseUnit(profile.glucoseUnit),
            remindersEnabled: profile.remindersEnabled,
            soundEnabled: profile.soundEnabled,
            reminderLeadMins: profile.reminderLeadMins,
            currency: profile.currency || merged.currency,
            monthlyBudget:
              profile.monthlyBudget !== null && profile.monthlyBudget !== undefined
                ? Number(profile.monthlyBudget)
                : null,
            activePatientId: activePatient?.id ?? session.activePatientId,
            activePatientName: activePatient?.name ?? profile.displayName ?? merged.activePatientName,
            activePatientRelationship:
              activePatient?.relationship ?? merged.activePatientRelationship,
            activePatientTimezone:
              activePatient?.timezone ?? merged.activePatientTimezone,
          };
          setPreferences(merged);
          await persistLocal(merged);
        } catch (err) {
          if (err instanceof ApiRequestError && !err.isNetworkError) {
            setError(err.message);
          }
        }
      }
    } catch {
      setError('Unable to load user preferences.');
    } finally {
      setLoading(false);
    }
  }, [persistLocal]);

  useEffect(() => {
    void refreshPreferences();
  }, [refreshPreferences]);

  const updatePreferences = useCallback(
    async (patch: UpdateUserPreferencesPatch) => {
      setSaving(true);
      setError(null);
      try {
        const remotePayload: UpdateUserSettingsPayload = {};
        if (patch.displayName !== undefined) remotePayload.displayName = patch.displayName;
        if (patch.glucoseUnit !== undefined) remotePayload.glucoseUnit = patch.glucoseUnit;
        if (patch.remindersEnabled !== undefined) {
          remotePayload.remindersEnabled = patch.remindersEnabled;
        }
        if (patch.soundEnabled !== undefined) {
          remotePayload.soundEnabled = patch.soundEnabled;
        }
        if (patch.reminderLeadMins !== undefined) {
          remotePayload.reminderLeadMins = patch.reminderLeadMins;
        }
        if (patch.monthlyBudget !== undefined) {
          remotePayload.monthlyBudget = patch.monthlyBudget;
        }

        const session = await readSavedAuthSession();
        if (session && Object.keys(remotePayload).length > 0) {
          try {
            const updatedUser = await updateCurrentUserSettings(
              session.token,
              remotePayload,
            );
            setPreferences((prev) => {
              const next: LocalUserPreferences = {
                ...prev,
                displayName: updatedUser.displayName,
                glucoseUnit: normalizeGlucoseUnit(updatedUser.glucoseUnit),
                remindersEnabled: updatedUser.remindersEnabled,
                soundEnabled: updatedUser.soundEnabled,
                reminderLeadMins: updatedUser.reminderLeadMins,
                hideMedicineInNotifications:
                  patch.hideMedicineInNotifications ??
                  prev.hideMedicineInNotifications,
                currency: updatedUser.currency || prev.currency,
                monthlyBudget:
                  updatedUser.monthlyBudget !== null &&
                  updatedUser.monthlyBudget !== undefined
                    ? Number(updatedUser.monthlyBudget)
                    : null,
              };
              void persistLocal(next);
              return next;
            });
            return;
          } catch (err) {
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              throw err;
            }
          }
        }

        setPreferences((prev) => {
          const next: LocalUserPreferences = {
            ...prev,
            ...patch,
            glucoseUnit: patch.glucoseUnit
              ? normalizeGlucoseUnit(patch.glucoseUnit)
              : prev.glucoseUnit,
          };
          void persistLocal(next);
          return next;
        });
      } finally {
        setSaving(false);
      }
    },
    [persistLocal],
  );

  const updateActivePatient = useCallback(
    async (patch: UpdateActivePatientPatch) => {
      setSaving(true);
      setError(null);
      try {
        const session = await readSavedAuthSession();
        const targetId = session?.activePatientId ?? preferences.activePatientId;
        if (session && UUID_PREFIX_RE.test(targetId)) {
          try {
            const updated = await updatePatientProfile(targetId, session.token, patch);
            setPatients((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            );
            setPreferences((prev) => {
              const next: LocalUserPreferences = {
                ...prev,
                activePatientId: updated.id,
                activePatientName: updated.name,
                activePatientRelationship: updated.relationship,
                activePatientTimezone: updated.timezone,
              };
              void persistLocal(next);
              return next;
            });
            return;
          } catch (err) {
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              throw err;
            }
          }
        }

        setPreferences((prev) => {
          const next: LocalUserPreferences = {
            ...prev,
            activePatientName: patch.name?.trim() || prev.activePatientName,
            activePatientRelationship:
              patch.relationship?.trim() || prev.activePatientRelationship,
            activePatientTimezone:
              patch.timezone?.trim() || prev.activePatientTimezone,
          };
          void persistLocal(next);
          return next;
        });
      } finally {
        setSaving(false);
      }
    },
    [persistLocal, preferences.activePatientId],
  );

  const resetDemoPreferences = useCallback(async () => {
    setPreferences(DEFAULT_USER_PREFERENCES);
    await persistLocal(DEFAULT_USER_PREFERENCES);

    const session = await readSavedAuthSession();
    if (session) {
      try {
        await updateCurrentUserSettings(session.token, {
          displayName: DEFAULT_USER_PREFERENCES.displayName,
          glucoseUnit: DEFAULT_USER_PREFERENCES.glucoseUnit,
          remindersEnabled: DEFAULT_USER_PREFERENCES.remindersEnabled,
          soundEnabled: DEFAULT_USER_PREFERENCES.soundEnabled,
          reminderLeadMins: DEFAULT_USER_PREFERENCES.reminderLeadMins,
          monthlyBudget: DEFAULT_USER_PREFERENCES.monthlyBudget,
        });
      } catch {
        // Keep local reset intact when offline or unauthenticated
      }
    }
  }, [persistLocal]);

  const clearAuthSessionAndReset = useCallback(async () => {
    await clearSavedAuthSession();
    setPatients([]);
    setPreferences(DEFAULT_USER_PREFERENCES);
    await persistLocal(DEFAULT_USER_PREFERENCES);
  }, [persistLocal]);

  return (
    <UserPreferencesContext.Provider
      value={{
        preferences,
        patients,
        loading,
        saving,
        error,
        refreshPreferences,
        updatePreferences,
        updateActivePatient,
        resetDemoPreferences,
        clearAuthSessionAndReset,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences(): UserPreferencesContextValue {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    throw new Error(
      'useUserPreferences must be used inside a UserPreferencesProvider.',
    );
  }
  return ctx;
}
