import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiRequestError, readSavedAuthSession } from '../../api/config';
import {
  createPatientHealthReading,
  deletePatientHealthReading,
  HealthChartPointDto,
  HealthReadingItemDto,
  listPatientHealthReadings,
  ListHealthReadingsResponseDto,
  ReadingContextDto,
} from '../../api/health-logs';
import { getTodayLocalYmd } from '../schedule/dose-rules';
import { useUserPreferences } from '../profile/UserPreferencesContext';
import {
  buildLocalHealthReadingsSummary,
  createLocalHealthReadingItem,
  createSampleDemoHealthReadings,
  HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER,
  HEALTH_READINGS_STORAGE_KEY,
  ValidatedHealthReadingInput,
} from './health-helpers';

const UUID_PREFIX_RE = /^[0-9a-f]{8}-/i;

interface HealthLogsContextValue {
  readings: HealthReadingItemDto[];
  latestReading: HealthReadingItemDto | null;
  filteredLatestReading: HealthReadingItemDto | null;
  chartPoints: HealthChartPointDto[];
  totalCount: number;
  contextFilter: ReadingContextDto | 'ALL';
  setContextFilter: (next: ReadingContextDto | 'ALL') => void;
  hasSampleReadings: boolean;
  disclaimer: string;
  loading: boolean;
  saving: boolean;
  deletingId: string | null;
  error: string | null;
  refreshHealthLogs: (filterOverride?: ReadingContextDto | 'ALL') => Promise<void>;
  logHealthReading: (input: ValidatedHealthReadingInput) => Promise<HealthReadingItemDto>;
  deleteHealthReading: (readingId: string) => Promise<void>;
  loadSampleDemoReadings: () => Promise<void>;
  resetDemoHealthReadings: () => Promise<void>;
}

const HealthLogsContext = createContext<HealthLogsContextValue | null>(null);

export function HealthLogsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { preferences } = useUserPreferences();

  const [localReadings, setLocalReadings] = useState<HealthReadingItemDto[]>([]);
  const [remoteResponse, setRemoteResponse] = useState<ListHealthReadingsResponseDto | null>(null);
  const [remoteOverallLatest, setRemoteOverallLatest] = useState<HealthReadingItemDto | null>(null);
  const [contextFilter, setContextFilterState] = useState<ReadingContextDto | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const persistLocal = useCallback(async (next: HealthReadingItemDto[]) => {
    try {
      await AsyncStorage.setItem(HEALTH_READINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore offline storage errors
    }
  }, []);

  const refreshHealthLogs = useCallback(
    async (filterOverride?: ReadingContextDto | 'ALL') => {
      const targetFilter = filterOverride ?? contextFilter;
      setLoading(true);
      setError(null);
      try {
        const [rawLocal, session] = await Promise.all([
          AsyncStorage.getItem(HEALTH_READINGS_STORAGE_KEY),
          readSavedAuthSession(),
        ]);

        if (rawLocal) {
          try {
            const parsed = JSON.parse(rawLocal) as HealthReadingItemDto[];
            if (Array.isArray(parsed)) {
              setLocalReadings(parsed);
            }
          } catch {
            // Preserve state on malformed JSON
          }
        }

        if (session) {
          try {
            const [filteredRes, overallRes] = await Promise.all([
              listPatientHealthReadings(session.activePatientId, session.token, {
                limit: 50,
                context: targetFilter !== 'ALL' ? targetFilter : undefined,
              }),
              targetFilter === 'ALL'
                ? Promise.resolve(null)
                : listPatientHealthReadings(session.activePatientId, session.token, {
                    limit: 1,
                  }),
            ]);
            setRemoteResponse(filteredRes);
            setRemoteOverallLatest(
              overallRes ? overallRes.latestReading : filteredRes.latestReading,
            );
          } catch (err) {
            setRemoteResponse(null);
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              setError(err.message);
            }
          }
        } else {
          setRemoteResponse(null);
          setRemoteOverallLatest(null);
        }
      } catch {
        setError('Unable to load health readings.');
      } finally {
        setLoading(false);
      }
    },
    [contextFilter],
  );

  useEffect(() => {
    void refreshHealthLogs(contextFilter);
  }, [refreshHealthLogs, contextFilter, preferences.glucoseUnit]);

  const setContextFilter = useCallback((next: ReadingContextDto | 'ALL') => {
    setContextFilterState(next);
  }, []);

  const localSummary = useMemo(
    () =>
      buildLocalHealthReadingsSummary(
        localReadings,
        preferences.glucoseUnit,
        contextFilter,
      ),
    [localReadings, preferences.glucoseUnit, contextFilter],
  );

  const readings = remoteResponse ? remoteResponse.items : localSummary.items;
  const chartPoints = remoteResponse
    ? remoteResponse.chartPoints
    : localSummary.chartPoints;
  const latestReading = remoteResponse
    ? (remoteOverallLatest ?? remoteResponse.latestReading)
    : localSummary.latestReading;
  const filteredLatestReading = remoteResponse
    ? remoteResponse.latestReading
    : localSummary.filteredLatestReading;
  const totalCount = remoteResponse
    ? remoteResponse.totalCount
    : localSummary.totalCount;

  const hasSampleReadings = useMemo(
    () => !remoteResponse && localReadings.some((item) => Boolean(item.isSample)),
    [remoteResponse, localReadings],
  );

  const logHealthReading = useCallback(
    async (input: ValidatedHealthReadingInput): Promise<HealthReadingItemDto> => {
      setSaving(true);
      setError(null);
      try {
        const session = await readSavedAuthSession();
        if (session) {
          try {
            const created = await createPatientHealthReading(
              session.activePatientId,
              session.token,
              {
                value: input.value,
                unit: input.unit,
                context: input.context,
                date: input.date,
                time: input.time,
                note: input.note,
              },
            );
            await refreshHealthLogs(contextFilter);
            return created;
          } catch (err) {
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              throw err;
            }
          }
        }

        const localItem = createLocalHealthReadingItem(
          input,
          preferences.activePatientId || 'local-patient',
        );
        setLocalReadings((prev) => {
          const next = [localItem, ...prev];
          void persistLocal(next);
          return next;
        });
        setRemoteResponse(null);
        return localItem;
      } finally {
        setSaving(false);
      }
    },
    [
      contextFilter,
      persistLocal,
      preferences.activePatientId,
      refreshHealthLogs,
    ],
  );

  const deleteHealthReading = useCallback(
    async (readingId: string): Promise<void> => {
      setDeletingId(readingId);
      setError(null);
      try {
        const session = await readSavedAuthSession();
        if (session && UUID_PREFIX_RE.test(readingId)) {
          try {
            await deletePatientHealthReading(
              session.activePatientId,
              readingId,
              session.token,
            );
            await refreshHealthLogs(contextFilter);
            return;
          } catch (err) {
            if (err instanceof ApiRequestError && !err.isNetworkError) {
              throw err;
            }
          }
        }

        setLocalReadings((prev) => {
          const next = prev.filter((item) => item.id !== readingId);
          void persistLocal(next);
          return next;
        });
      } finally {
        setDeletingId(null);
      }
    },
    [contextFilter, persistLocal, refreshHealthLogs],
  );

  const loadSampleDemoReadings = useCallback(async () => {
    const sampleItems = createSampleDemoHealthReadings(getTodayLocalYmd());
    setLocalReadings(sampleItems);
    setRemoteResponse(null);
    await persistLocal(sampleItems);
  }, [persistLocal]);

  const resetDemoHealthReadings = useCallback(async () => {
    setLocalReadings([]);
    setRemoteResponse(null);
    setRemoteOverallLatest(null);
    setContextFilterState('ALL');
    await persistLocal([]);
  }, [persistLocal]);

  return (
    <HealthLogsContext.Provider
      value={{
        readings,
        latestReading,
        filteredLatestReading,
        chartPoints,
        totalCount,
        contextFilter,
        setContextFilter,
        hasSampleReadings,
        disclaimer:
          remoteResponse?.disclaimer ?? HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER,
        loading,
        saving,
        deletingId,
        error,
        refreshHealthLogs,
        logHealthReading,
        deleteHealthReading,
        loadSampleDemoReadings,
        resetDemoHealthReadings,
      }}
    >
      {children}
    </HealthLogsContext.Provider>
  );
}

export function useHealthLogs(): HealthLogsContextValue {
  const ctx = useContext(HealthLogsContext);
  if (!ctx) {
    throw new Error('useHealthLogs must be used inside a HealthLogsProvider.');
  }
  return ctx;
}
