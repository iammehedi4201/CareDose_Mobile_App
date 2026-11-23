import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiRequestError, readSavedAuthSession } from '../../api/config';
import {
  createMedicationSchedule,
  DailyDosesResponseDto,
  deleteSchedule,
  DoseHistoryResponseDto,
  getPatientDoses,
  listPatientDoseHistory,
  listPatientSchedules,
  recordDoseEvent,
  ScheduledDoseItemDto,
  ScheduleStatusDto,
  updateSchedule,
} from '../../api/schedules';
import { useMedications } from '../medications/MedicationsContext';
import {
  computeStockAfterDoseTaken,
  createInitialDemoDoseEvents,
  createInitialDemoSchedules,
  expandLocalScheduleOccurrencesForRange,
  filterLocalDoseHistory,
  inferSingleDoseUnitFromStockUnit,
  isDuplicateScheduleDefinition,
  LocalDoseEventRecord,
  LocalScheduleRecord,
  mapApiScheduleToLocal,
  normalizeScheduleFrequencyCode,
  normalizeTimeTo24Hour,
} from './dose-rules';
import {
  cancelScheduleNotifications,
  syncScheduleNotifications,
} from './notifications';

const SCHEDULES_STORAGE_KEY = 'caredose:schedules:v2';
const DOSE_EVENTS_STORAGE_KEY = 'caredose:dose-events:v2';
const LEGACY_STORAGE_KEYS = ['caredose:schedules:v1', 'caredose:dose-events:v1'];
const UUID_PREFIX_RE = /^[0-9a-f]{8}-/i;

export interface CreateScheduleInput {
  patientMedicationId: string;
  doseAmount: number;
  doseUnit?: string;
  frequency: string;
  intervalHours?: number | null;
  weekdays?: number[];
  scheduledTimes: string[];
  startDateYmd: string;
  endDateYmd?: string | null;
  instructions?: string | null;
  remindersEnabled?: boolean;
}

export interface UpdateScheduleInput {
  doseAmount?: number;
  doseUnit?: string;
  frequency?: string;
  intervalHours?: number | null;
  weekdays?: number[];
  scheduledTimes?: string[];
  startDateYmd?: string;
  endDateYmd?: string | null;
  instructions?: string | null;
  remindersEnabled?: boolean;
  status?: ScheduleStatusDto;
}

export interface RecordDoseOutcome {
  status: 'taken' | 'skipped';
  stockDeducted: boolean;
  deductedQuantity: number;
  stockUnit: string;
  idempotentReplay: boolean;
}

interface SchedulesContextValue {
  schedules: LocalScheduleRecord[];
  doseEvents: LocalDoseEventRecord[];
  loading: boolean;
  pendingOccurrenceKeys: Record<string, boolean>;
  getLocalRangeDoses: (
    startYmd: string,
    daysCount?: number,
    now?: Date,
  ) => DailyDosesResponseDto;
  fetchRemoteRangeDoses: (
    startYmd: string,
    daysCount?: number,
  ) => Promise<DailyDosesResponseDto | null>;
  createSchedule: (input: CreateScheduleInput) => Promise<LocalScheduleRecord>;
  updateScheduleById: (
    scheduleId: string,
    updates: UpdateScheduleInput,
  ) => Promise<LocalScheduleRecord | null>;
  deleteScheduleById: (scheduleId: string) => Promise<void>;
  recordDoseAction: (
    item: ScheduledDoseItemDto,
    action: 'TAKEN' | 'SKIPPED',
    note?: string,
  ) => Promise<RecordDoseOutcome>;
  queryDoseHistory: (query: {
    fromDate?: string;
    toDate?: string;
    status?: 'all' | 'taken' | 'skipped';
    medicationId?: string | null;
    cursor?: string | null;
    limit?: number;
  }) => Promise<DoseHistoryResponseDto>;
  refreshSchedules: () => Promise<void>;
  resetDemoSchedules: () => Promise<void>;
}

const SchedulesContext = createContext<SchedulesContextValue | null>(null);

export function SchedulesProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { medications, adjustMedicationStock, getMedicationById } = useMedications();

  const [schedules, setSchedules] = useState<LocalScheduleRecord[]>(() =>
    createInitialDemoSchedules(),
  );
  const [doseEvents, setDoseEvents] = useState<LocalDoseEventRecord[]>(() =>
    createInitialDemoDoseEvents(),
  );
  const [loading, setLoading] = useState(true);
  const [pendingOccurrenceKeys, setPendingOccurrenceKeys] = useState<
    Record<string, boolean>
  >({});

  const inFlightKeysRef = useRef<Set<string>>(new Set());

  const persistSchedules = useCallback(async (next: LocalScheduleRecord[]) => {
    try {
      await AsyncStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage persistence errors
    }
  }, []);

  const persistEvents = useCallback(async (next: LocalDoseEventRecord[]) => {
    try {
      await AsyncStorage.setItem(DOSE_EVENTS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage persistence errors
    }
  }, []);

  const refreshSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const session = await readSavedAuthSession();
      if (session) {
        try {
          const [remoteSchedules, remoteHistory] = await Promise.all([
            listPatientSchedules(session.activePatientId, session.token, 'ALL'),
            listPatientDoseHistory(session.activePatientId, session.token, {
              limit: 50,
            }),
          ]);
          const mappedScheds = remoteSchedules.map(mapApiScheduleToLocal);
          const mappedEvents: LocalDoseEventRecord[] = remoteHistory.items.map(
            (ev) => ({
              id: ev.id,
              occurrenceKey: `${ev.scheduleId}:${ev.scheduledFor}`,
              scheduleId: ev.scheduleId,
              patientMedicationId: ev.patientMedicationId,
              scheduledDateYmd: ev.scheduledDateYmd,
              scheduledTime24: normalizeTimeTo24Hour(ev.scheduledTime12),
              scheduledFor: ev.scheduledFor,
              status: ev.status,
              recordedAt: ev.recordedAt ?? ev.scheduledFor,
              note: ev.note,
            }),
          );
          setSchedules(mappedScheds);
          setDoseEvents(mappedEvents);
          await Promise.all([
            persistSchedules(mappedScheds),
            persistEvents(mappedEvents),
          ]);
          return;
        } catch {
          // Fall back cleanly to AsyncStorage when backend is unavailable
        }
      }

      const [rawScheds, rawEvents] = await Promise.all([
        AsyncStorage.getItem(SCHEDULES_STORAGE_KEY),
        AsyncStorage.getItem(DOSE_EVENTS_STORAGE_KEY),
      ]);
      if (rawScheds || rawEvents) {
        if (rawScheds) {
          const parsed = JSON.parse(rawScheds) as LocalScheduleRecord[];
          if (Array.isArray(parsed)) setSchedules(parsed);
        }
        if (rawEvents) {
          const parsed = JSON.parse(rawEvents) as LocalDoseEventRecord[];
          if (Array.isArray(parsed)) setDoseEvents(parsed);
        }
      } else {
        await AsyncStorage.multiRemove(LEGACY_STORAGE_KEYS);
        await Promise.all([
          AsyncStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify([])),
          AsyncStorage.setItem(DOSE_EVENTS_STORAGE_KEY, JSON.stringify([])),
        ]);
        setSchedules([]);
        setDoseEvents([]);
      }
    } catch {
      // Retain seeded schedules cleanly on storage failure
    } finally {
      setLoading(false);
    }
  }, [persistEvents, persistSchedules]);

  useEffect(() => {
    void refreshSchedules();
  }, [refreshSchedules]);

  const getLocalRangeDoses = useCallback(
    (startYmd: string, daysCount = 1, now = new Date()): DailyDosesResponseDto =>
      expandLocalScheduleOccurrencesForRange(
        schedules,
        medications,
        doseEvents,
        startYmd,
        daysCount,
        now,
      ),
    [schedules, medications, doseEvents],
  );

  const fetchRemoteRangeDoses = useCallback(
    async (startYmd: string, daysCount = 1): Promise<DailyDosesResponseDto | null> => {
      const session = await readSavedAuthSession();
      if (!session) return null;
      try {
        return await getPatientDoses(session.activePatientId, session.token, {
          date: startYmd,
          days: daysCount,
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const createSchedule = useCallback(
    async (input: CreateScheduleInput): Promise<LocalScheduleRecord> => {
      const med = getMedicationById(input.patientMedicationId);
      const normalizedTimes = [
        ...new Set(input.scheduledTimes.map(normalizeTimeTo24Hour)),
      ].sort();
      const freqCode = normalizeScheduleFrequencyCode(input.frequency);
      const resolvedInterval =
        freqCode === 'EVERY_X_HOURS' || freqCode === 'EVERY_8_HOURS'
          ? (input.intervalHours ?? 8)
          : null;
      const resolvedWeekdays =
        freqCode === 'SELECTED_WEEKDAYS'
          ? [...new Set(input.weekdays ?? [])].sort((a, b) => a - b)
          : [];
      const resolvedUnit =
        input.doseUnit?.trim() ||
        inferSingleDoseUnitFromStockUnit(med?.stockUnit);

      if (
        isDuplicateScheduleDefinition(schedules, {
          patientMedicationId: input.patientMedicationId,
          frequency: freqCode,
          intervalHours: resolvedInterval,
          weekdays: resolvedWeekdays,
          scheduledTimes: normalizedTimes,
          startDateYmd: input.startDateYmd,
          endDateYmd: input.endDateYmd,
        })
      ) {
        throw new Error(
          'An active schedule for this medicine with matching times and frequency already exists.',
        );
      }

      const session = await readSavedAuthSession();
      if (session && UUID_PREFIX_RE.test(input.patientMedicationId)) {
        try {
          const created = await createMedicationSchedule(
            input.patientMedicationId,
            session.token,
            {
              doseAmount: input.doseAmount,
              doseUnit: resolvedUnit,
              frequency: freqCode,
              intervalHours: resolvedInterval,
              weekdays: resolvedWeekdays,
              scheduledTimes: normalizedTimes,
              startDate: input.startDateYmd,
              endDate: input.endDateYmd || null,
              instructions: input.instructions?.trim() || null,
              remindersEnabled: Boolean(input.remindersEnabled),
            },
          );
          const mapped = mapApiScheduleToLocal(created);
          setSchedules((prev) => {
            const next = [...prev, mapped];
            void persistSchedules(next);
            return next;
          });
          void syncScheduleNotifications(mapped, med?.name ?? 'Medicine');
          return mapped;
        } catch (err) {
          if (err instanceof ApiRequestError && !err.isNetworkError) {
            throw err;
          }
          // Proceed with local save when offline
        }
      }

      const localSchedule: LocalScheduleRecord = {
        id: `sched-${Date.now()}`,
        patientMedicationId: input.patientMedicationId,
        doseAmount: input.doseAmount,
        doseUnit: resolvedUnit,
        frequency: freqCode,
        intervalHours: resolvedInterval,
        weekdays: resolvedWeekdays,
        scheduledTimes: normalizedTimes,
        startDateYmd: input.startDateYmd,
        endDateYmd: input.endDateYmd?.trim() ? input.endDateYmd.trim() : null,
        instructions: input.instructions?.trim() || null,
        remindersEnabled: Boolean(input.remindersEnabled),
        status: 'ACTIVE',
      };

      setSchedules((prev) => {
        const next = [...prev, localSchedule];
        void persistSchedules(next);
        return next;
      });
      void syncScheduleNotifications(localSchedule, med?.name ?? 'Medicine');
      return localSchedule;
    },
    [getMedicationById, persistSchedules, schedules],
  );

  const updateScheduleById = useCallback(
    async (
      scheduleId: string,
      updates: UpdateScheduleInput,
    ): Promise<LocalScheduleRecord | null> => {
      const nextFreq = updates.frequency
        ? normalizeScheduleFrequencyCode(updates.frequency)
        : undefined;
      const nextInterval =
        nextFreq !== undefined
          ? nextFreq === 'EVERY_X_HOURS' || nextFreq === 'EVERY_8_HOURS'
            ? (updates.intervalHours ?? 8)
            : null
          : updates.intervalHours;
      const nextWeekdays =
        nextFreq !== undefined
          ? nextFreq === 'SELECTED_WEEKDAYS'
            ? [...new Set(updates.weekdays ?? [])].sort((a, b) => a - b)
            : []
          : updates.weekdays;

      const session = await readSavedAuthSession();
      if (session && UUID_PREFIX_RE.test(scheduleId)) {
        try {
          const updatedRemote = await updateSchedule(scheduleId, session.token, {
            doseAmount: updates.doseAmount,
            doseUnit: updates.doseUnit,
            frequency: nextFreq,
            intervalHours: nextInterval,
            weekdays: nextWeekdays,
            scheduledTimes: updates.scheduledTimes?.map(normalizeTimeTo24Hour),
            startDate: updates.startDateYmd,
            endDate: updates.endDateYmd,
            instructions: updates.instructions,
            remindersEnabled: updates.remindersEnabled,
            status: updates.status,
          });
          const mapped = mapApiScheduleToLocal(updatedRemote);
          setSchedules((prev) => {
            const next = prev.map((s) => (s.id === scheduleId ? mapped : s));
            void persistSchedules(next);
            return next;
          });
          const medName = getMedicationById(mapped.patientMedicationId)?.name ?? 'Medicine';
          void syncScheduleNotifications(mapped, medName);
          return mapped;
        } catch (err) {
          if (err instanceof ApiRequestError && !err.isNetworkError) {
            throw err;
          }
          // Fall back to local state update
        }
      }

      let updatedItem: LocalScheduleRecord | null = null;
      setSchedules((prev) => {
        const next = prev.map((s) => {
          if (s.id !== scheduleId) return s;
          const resolvedFreq = nextFreq ?? s.frequency;
          updatedItem = {
            ...s,
            doseAmount: updates.doseAmount ?? s.doseAmount,
            doseUnit: updates.doseUnit ?? s.doseUnit,
            frequency: resolvedFreq,
            intervalHours:
              nextInterval !== undefined
                ? nextInterval
                : resolvedFreq === 'EVERY_X_HOURS' || resolvedFreq === 'EVERY_8_HOURS'
                  ? (s.intervalHours ?? 8)
                  : null,
            weekdays:
              nextWeekdays !== undefined
                ? nextWeekdays
                : resolvedFreq === 'SELECTED_WEEKDAYS'
                  ? (s.weekdays ?? [])
                  : [],
            scheduledTimes: updates.scheduledTimes
              ? [...new Set(updates.scheduledTimes.map(normalizeTimeTo24Hour))].sort()
              : s.scheduledTimes,
            startDateYmd: updates.startDateYmd ?? s.startDateYmd,
            endDateYmd:
              updates.endDateYmd !== undefined ? updates.endDateYmd : s.endDateYmd,
            instructions:
              updates.instructions !== undefined
                ? updates.instructions
                : s.instructions,
            remindersEnabled: updates.remindersEnabled ?? s.remindersEnabled,
            status: updates.status ?? s.status,
          };
          return updatedItem;
        });
        void persistSchedules(next);
        return next;
      });
      if (updatedItem) {
        const resolved: LocalScheduleRecord = updatedItem;
        const medName = getMedicationById(resolved.patientMedicationId)?.name ?? 'Medicine';
        void syncScheduleNotifications(resolved, medName);
      }
      return updatedItem;
    },
    [getMedicationById, persistSchedules],
  );

  const deleteScheduleById = useCallback(
    async (scheduleId: string): Promise<void> => {
      const session = await readSavedAuthSession();
      if (session && UUID_PREFIX_RE.test(scheduleId)) {
        try {
          await deleteSchedule(scheduleId, session.token);
        } catch {
          // Continue with local deletion
        }
      }
      void cancelScheduleNotifications(scheduleId);
      setSchedules((prev) => {
        const next = prev.filter((s) => s.id !== scheduleId);
        void persistSchedules(next);
        return next;
      });
    },
    [persistSchedules],
  );

  const recordDoseAction = useCallback(
    async (
      item: ScheduledDoseItemDto,
      action: 'TAKEN' | 'SKIPPED',
      note?: string,
    ): Promise<RecordDoseOutcome> => {
      const med = getMedicationById(item.patientMedicationId);
      const stockUnit = med?.stockUnit ?? item.doseUnit;

      if (item.status === 'taken') {
        return {
          status: 'taken',
          stockDeducted: false,
          deductedQuantity: 0,
          stockUnit,
          idempotentReplay: true,
        };
      }
      if (action === 'SKIPPED' && item.status === 'skipped') {
        return {
          status: 'skipped',
          stockDeducted: false,
          deductedQuantity: 0,
          stockUnit,
          idempotentReplay: true,
        };
      }

      if (inFlightKeysRef.current.has(item.occurrenceKey)) {
        return {
          status: action === 'TAKEN' ? 'taken' : 'skipped',
          stockDeducted: false,
          deductedQuantity: 0,
          stockUnit,
          idempotentReplay: true,
        };
      }

      inFlightKeysRef.current.add(item.occurrenceKey);
      setPendingOccurrenceKeys((prev) => ({ ...prev, [item.occurrenceKey]: true }));

      try {
        const session = await readSavedAuthSession();
        if (session && UUID_PREFIX_RE.test(item.scheduleId)) {
          try {
            const remoteRes = await recordDoseEvent(
              session.activePatientId,
              session.token,
              {
                scheduleId: item.scheduleId,
                scheduledFor: item.scheduledFor,
                action,
                note,
              },
            );

            const recordedStatus: 'taken' | 'skipped' =
              remoteRes.status === 'TAKEN' ? 'taken' : 'skipped';

            setDoseEvents((prev) => {
              const filtered = prev.filter(
                (e) => e.occurrenceKey !== item.occurrenceKey,
              );
              const next: LocalDoseEventRecord[] = [
                {
                  id: remoteRes.doseEventId,
                  occurrenceKey: item.occurrenceKey,
                  scheduleId: item.scheduleId,
                  patientMedicationId: item.patientMedicationId,
                  scheduledDateYmd: item.scheduledDateYmd,
                  scheduledTime24: item.scheduledTime24,
                  scheduledFor: item.scheduledFor,
                  status: recordedStatus,
                  recordedAt: remoteRes.recordedAt ?? new Date().toISOString(),
                  note: note ?? null,
                },
                ...filtered,
              ];
              void persistEvents(next);
              return next;
            });

            if (remoteRes.stockDeducted) {
              await adjustMedicationStock(
                item.patientMedicationId,
                'set',
                Number(remoteRes.newStockRemaining),
              );
            }

            return {
              status: recordedStatus,
              stockDeducted: remoteRes.stockDeducted,
              deductedQuantity: Number(remoteRes.deductedQuantity) || 0,
              stockUnit: remoteRes.stockUnit || stockUnit,
              idempotentReplay: remoteRes.idempotentReplay,
            };
          } catch {
            // Fall through to local persistence when network is unavailable
          }
        }

        const existingLocal = doseEvents.find(
          (e) => e.occurrenceKey === item.occurrenceKey,
        );
        if (existingLocal?.status === 'taken') {
          return {
            status: 'taken',
            stockDeducted: false,
            deductedQuantity: 0,
            stockUnit,
            idempotentReplay: true,
          };
        }

        const nextStatus: 'taken' | 'skipped' =
          action === 'TAKEN' ? 'taken' : 'skipped';
        const nowIso = new Date().toISOString();

        const nextEvent: LocalDoseEventRecord = {
          id: existingLocal?.id ?? `ev-${Date.now()}`,
          occurrenceKey: item.occurrenceKey,
          scheduleId: item.scheduleId,
          patientMedicationId: item.patientMedicationId,
          scheduledDateYmd: item.scheduledDateYmd,
          scheduledTime24: item.scheduledTime24,
          scheduledFor: item.scheduledFor,
          status: nextStatus,
          recordedAt: nowIso,
          note: note?.trim() || null,
        };

        setDoseEvents((prev) => {
          const withoutCurrent = prev.filter(
            (e) => e.occurrenceKey !== item.occurrenceKey,
          );
          const next = [nextEvent, ...withoutCurrent];
          void persistEvents(next);
          return next;
        });

        let stockDeducted = false;
        let deductedQuantity = 0;

        if (action === 'TAKEN' && med) {
          const calc = computeStockAfterDoseTaken(
            med.stockRemaining,
            Number(item.doseAmount) || 1,
            item.doseUnit,
            med.stockUnit,
          );
          if (calc.stockDeducted) {
            stockDeducted = true;
            deductedQuantity = calc.deductedQuantity;
            await adjustMedicationStock(med.id, 'set', calc.nextStock);
          }
        }

        return {
          status: nextStatus,
          stockDeducted,
          deductedQuantity,
          stockUnit,
          idempotentReplay: false,
        };
      } finally {
        inFlightKeysRef.current.delete(item.occurrenceKey);
        setPendingOccurrenceKeys((prev) => {
          const copy = { ...prev };
          delete copy[item.occurrenceKey];
          return copy;
        });
      }
    },
    [
      adjustMedicationStock,
      doseEvents,
      getMedicationById,
      persistEvents,
    ],
  );

  const queryDoseHistory = useCallback(
    async (query: {
      fromDate?: string;
      toDate?: string;
      status?: 'all' | 'taken' | 'skipped';
      medicationId?: string | null;
      cursor?: string | null;
      limit?: number;
    }): Promise<DoseHistoryResponseDto> => {
      const session = await readSavedAuthSession();
      if (
        session &&
        (!query.medicationId || UUID_PREFIX_RE.test(query.medicationId))
      ) {
        try {
          return await listPatientDoseHistory(
            session.activePatientId,
            session.token,
            {
              from: query.fromDate,
              to: query.toDate,
              status:
                query.status === 'taken'
                  ? 'TAKEN'
                  : query.status === 'skipped'
                    ? 'SKIPPED'
                    : 'ALL',
              medicationId: query.medicationId ?? undefined,
              cursor: query.cursor ?? undefined,
              limit: query.limit ?? 20,
            },
          );
        } catch {
          // Fall through to local filtered events
        }
      }

      return filterLocalDoseHistory(doseEvents, schedules, medications, {
        fromDate: query.fromDate,
        toDate: query.toDate,
        status: query.status ?? 'all',
        medicationId: query.medicationId,
      });
    },
    [doseEvents, medications, schedules],
  );

  const resetDemoSchedules = useCallback(async () => {
    const initialScheds = createInitialDemoSchedules();
    const initialEvents = createInitialDemoDoseEvents();
    setSchedules(initialScheds);
    setDoseEvents(initialEvents);
    await Promise.all([
      persistSchedules(initialScheds),
      persistEvents(initialEvents),
    ]);
  }, [persistEvents, persistSchedules]);

  return (
    <SchedulesContext.Provider
      value={{
        schedules,
        doseEvents,
        loading,
        pendingOccurrenceKeys,
        getLocalRangeDoses,
        fetchRemoteRangeDoses,
        createSchedule,
        updateScheduleById,
        deleteScheduleById,
        recordDoseAction,
        queryDoseHistory,
        refreshSchedules,
        resetDemoSchedules,
      }}
    >
      {children}
    </SchedulesContext.Provider>
  );
}

export function useSchedules(): SchedulesContextValue {
  const ctx = useContext(SchedulesContext);
  if (!ctx) {
    throw new Error('useSchedules must be used inside a SchedulesProvider.');
  }
  return ctx;
}
