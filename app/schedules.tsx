import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChips,
  formatDisplayDate,
  LoadingSkeleton,
  resolveDosageFormIcon,
  ScheduleModal,
  ScreenContainer,
  StatusBadge,
  StatusVariant,
  SuccessToast,
} from '../src/components';
import type { ScheduleStatusDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import { useUserPreferences } from '../src/features/profile/UserPreferencesContext';
import {
  format24To12Hour,
  formatDoseAmountDisplay,
  formatRecurrenceSummary,
  getTodayLocalYmd,
  LocalScheduleRecord,
  resolveEffectiveScheduleStatus,
} from '../src/features/schedule/dose-rules';
import {
  checkDeviceNotificationSupport,
  describeScheduleReminderStatus,
  NotificationCapabilityState,
} from '../src/features/schedule/notifications';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

type ScheduleFilter = 'ALL' | ScheduleStatusDto;

type PendingLifecycleAction =
  | { kind: 'pause'; schedule: LocalScheduleRecord; medName: string }
  | { kind: 'archive'; schedule: LocalScheduleRecord; medName: string }
  | null;

const INITIAL_NOTIF_CAP: NotificationCapabilityState = {
  supported: false,
  granted: false,
  canAskAgain: false,
  statusText: 'Checking device notification status...',
};

export default function ManageSchedulesScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const { preferences } = useUserPreferences();
  const {
    schedules,
    loading,
    updateScheduleById,
    archiveScheduleById,
    refreshSchedules,
  } = useSchedules();

  const todayYmd = getTodayLocalYmd();
  const [filter, setFilter] = useState<ScheduleFilter>('ALL');
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LocalScheduleRecord | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingLifecycleAction>(null);
  const [notifCapability, setNotifCapability] =
    useState<NotificationCapabilityState>(INITIAL_NOTIF_CAP);

  useEffect(() => {
    let active = true;
    void checkDeviceNotificationSupport().then((cap) => {
      if (active) setNotifCapability(cap);
    });
    return () => {
      active = false;
    };
  }, []);

  const enrichedSchedules = useMemo(() => {
    const medMap = new Map(medications.map((m) => [m.id, m]));
    return schedules
      .map((schedule) => ({
        schedule,
        med: medMap.get(schedule.patientMedicationId) ?? null,
        effectiveStatus: resolveEffectiveScheduleStatus(schedule, todayYmd),
      }))
      .sort((a, b) => {
        const order: Record<ScheduleStatusDto, number> = {
          ACTIVE: 0,
          PAUSED: 1,
          COMPLETED: 2,
          ARCHIVED: 3,
        };
        const diff = order[a.effectiveStatus] - order[b.effectiveStatus];
        if (diff !== 0) return diff;
        return (a.med?.name ?? '').localeCompare(b.med?.name ?? '');
      });
  }, [medications, schedules, todayYmd]);

  const counts = useMemo(() => {
    let active = 0;
    let paused = 0;
    let completed = 0;
    let archived = 0;
    for (const entry of enrichedSchedules) {
      if (entry.effectiveStatus === 'ACTIVE') active += 1;
      else if (entry.effectiveStatus === 'PAUSED') paused += 1;
      else if (entry.effectiveStatus === 'COMPLETED') completed += 1;
      else archived += 1;
    }
    return {
      all: enrichedSchedules.length,
      active,
      paused,
      completed,
      archived,
    };
  }, [enrichedSchedules]);

  const filteredSchedules = useMemo(() => {
    if (filter === 'ALL') return enrichedSchedules;
    return enrichedSchedules.filter((entry) => entry.effectiveStatus === filter);
  }, [enrichedSchedules, filter]);

  const handleOpenCreate = (): void => {
    setEditingSchedule(null);
    setScheduleModalOpen(true);
  };

  const handleOpenEdit = (schedule: LocalScheduleRecord): void => {
    setEditingSchedule(schedule);
    setScheduleModalOpen(true);
  };

  const handleResume = async (
    schedule: LocalScheduleRecord,
    medName: string,
  ): Promise<void> => {
    setActionError(null);
    setMutatingId(schedule.id);
    try {
      await updateScheduleById(schedule.id, { status: 'ACTIVE' });
      setToast(`${medName} schedule resumed.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to resume schedule.',
      );
    } finally {
      setMutatingId(null);
    }
  };

  const handleConfirmLifecycleAction = async (): Promise<void> => {
    if (!pendingAction) return;
    const { kind, schedule, medName } = pendingAction;
    setActionError(null);
    setMutatingId(schedule.id);
    try {
      if (kind === 'pause') {
        await updateScheduleById(schedule.id, { status: 'PAUSED' });
        setToast(`${medName} schedule paused.`);
      } else {
        await archiveScheduleById(schedule.id);
        setToast(`${medName} schedule archived.`);
      }
      setPendingAction(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to update schedule.',
      );
    } finally {
      setMutatingId(null);
    }
  };

  const statusToBadgeVariant = (status: ScheduleStatusDto): StatusVariant => {
    if (status === 'ACTIVE') return 'active';
    if (status === 'PAUSED') return 'paused';
    if (status === 'COMPLETED') return 'completed';
    return 'archived';
  };

  return (
    <ScreenContainer
      title="Manage Schedules"
      subtitle="Manage your recurring medicine schedules."
      onBack={() => {
        if (typeof router.navigate === 'function') {
          router.navigate('/schedule');
        } else {
          router.push('/schedule');
        }
      }}
      primaryAction={{
        label: 'Add Schedule',
        iconName: 'plus',
        onPress: handleOpenCreate,
      }}
    >
      <SuccessToast message={toast} />

      {actionError ? (
        <ErrorState
          title="Schedule update failed"
          message={actionError}
          onRetry={() => {
            setActionError(null);
            void refreshSchedules();
          }}
        />
      ) : null}

      {/* Summary bar */}
      <View className="mb-3 flex-row flex-wrap gap-2">
        <View
          className="flex-1 min-w-[84px] rounded-card border border-border bg-white px-3 py-2.5 shadow-sm"
          accessibilityLabel={`Total schedules ${counts.all}`}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather name="calendar" size={13} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
            <Text className="text-[11px] font-semibold text-[#5A706B]" numberOfLines={1}>
              Total
            </Text>
          </View>
          <Text className="mt-1 text-[20px] font-bold text-main">{counts.all}</Text>
        </View>
        <View
          className="flex-1 min-w-[84px] rounded-card border border-[#C5E8D8] bg-mint px-3 py-2.5 shadow-sm"
          accessibilityLabel={`Active schedules ${counts.active}`}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather name="check-circle" size={13} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="text-[11px] font-semibold text-primary" numberOfLines={1}>
              Active
            </Text>
          </View>
          <Text className="mt-1 text-[20px] font-bold text-primary-dark">
            {counts.active}
          </Text>
        </View>
        <View
          className="flex-1 min-w-[84px] rounded-card border border-border bg-white px-3 py-2.5 shadow-sm"
          accessibilityLabel={`Paused schedules ${counts.paused}`}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather name="pause-circle" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
            <Text className="text-[11px] font-semibold text-[#5A706B]" numberOfLines={1}>
              Paused
            </Text>
          </View>
          <Text className="mt-1 text-[20px] font-bold text-main">{counts.paused}</Text>
        </View>
      </View>

      <View className="mb-2.5">
        <FilterChips<ScheduleFilter>
          options={[
            { key: 'ALL', label: 'All', count: counts.all },
            { key: 'ACTIVE', label: 'Active', count: counts.active },
            { key: 'PAUSED', label: 'Paused', count: counts.paused },
            { key: 'COMPLETED', label: 'Completed', count: counts.completed },
            { key: 'ARCHIVED', label: 'Archived', count: counts.archived },
          ]}
          selectedKey={filter}
          onSelect={setFilter}
        />
      </View>

      {loading && schedules.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : enrichedSchedules.length === 0 ? (
        <EmptyState
          title="No schedules yet. Create a medication schedule to organise your daily doses."
          description="Set your dose amount, times, and reminder preferences for any saved medicine."
          actionLabel="Add Schedule"
          onAction={handleOpenCreate}
          iconName="sliders"
        />
      ) : filteredSchedules.length === 0 ? (
        <EmptyState
          title="No schedules match this filter"
          description="Switch to another status tab or view all saved schedules."
          actionLabel="Show all"
          onAction={() => setFilter('ALL')}
          iconName="filter"
        />
      ) : (
        <View className="gap-3">
          {filteredSchedules.map(({ schedule, med, effectiveStatus }) => {
            const medName = med?.name ?? 'Medication';
            const subSpecs = [med?.strength, med?.dosageForm].filter(Boolean).join(' · ');
            const formattedTimes = schedule.scheduledTimes.map(format24To12Hour);
            const reminderInfo = describeScheduleReminderStatus(
              schedule.remindersEnabled,
              effectiveStatus,
              notifCapability,
              preferences.remindersEnabled,
            );
            const busy = mutatingId === schedule.id;
            const formIcon = resolveDosageFormIcon(med?.dosageForm);

            return (
              <View
                key={schedule.id}
                className="rounded-card border border-border bg-white shadow-sm"
                style={{ padding: layout.cardPadding }}
              >
                <View className="flex-row items-start justify-between gap-2.5">
                  <View className="flex-row flex-1 min-w-0 items-start gap-2.5">
                    <View
                      accessible={false}
                      className="mt-0.5 h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-mint"
                    >
                      <Feather
                        name={formIcon}
                        size={16}
                        color={CAREDOSE_EXTENDED_COLORS.primary}
                      />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text
                        className="text-[15px] font-bold leading-[20px] text-main"
                        numberOfLines={2}
                      >
                        {medName}
                      </Text>
                      {subSpecs ? (
                        <Text
                          className="mt-0.5 text-xs font-medium text-[#5A706B]"
                          numberOfLines={1}
                        >
                          {subSpecs}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <StatusBadge variant={statusToBadgeVariant(effectiveStatus)} />
                </View>

                <View className="mt-3 gap-2 border-t border-border pt-2.5">
                  <View className="flex-row items-center gap-1.5">
                    <Feather
                      name="repeat"
                      size={12}
                      color={CAREDOSE_EXTENDED_COLORS.primary}
                    />
                    <Text className="flex-1 min-w-0 text-xs font-semibold text-main">
                      {formatDoseAmountDisplay(schedule.doseAmount, schedule.doseUnit)} ·{' '}
                      {formatRecurrenceSummary(schedule)}
                    </Text>
                  </View>

                  <View className="flex-row flex-wrap items-center gap-1.5">
                    {formattedTimes.map((timeLabel, idx) => (
                      <View
                        key={`${schedule.id}-time-${idx}`}
                        className="flex-row items-center gap-1 rounded-full border border-[#CBE7DB] bg-mint px-2.5 py-0.5"
                      >
                        <Feather
                          name="clock"
                          size={11}
                          color={CAREDOSE_EXTENDED_COLORS.primary}
                        />
                        <Text className="text-[11px] font-semibold text-primary-dark">
                          {timeLabel}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View className="flex-row items-center gap-1.5">
                    <Feather
                      name="calendar"
                      size={12}
                      color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                    />
                    <Text className="text-xs leading-[17px] text-[#5A706B]">
                      Starts {formatDisplayDate(schedule.startDateYmd)}
                      {schedule.endDateYmd
                        ? ` · Ends ${formatDisplayDate(schedule.endDateYmd)}`
                        : ''}
                    </Text>
                  </View>

                  {schedule.instructions ? (
                    <View className="rounded-field border border-border bg-background px-2.5 py-2">
                      <Text className="text-xs leading-[17px] text-[#5A706B]">
                        Instructions: {schedule.instructions}
                      </Text>
                    </View>
                  ) : null}

                  <View className="flex-row items-center gap-1.5">
                    <Feather
                      name={reminderInfo.active ? 'bell' : 'bell-off'}
                      size={12}
                      color={
                        reminderInfo.active
                          ? CAREDOSE_EXTENDED_COLORS.primary
                          : CAREDOSE_EXTENDED_COLORS.secondaryText
                      }
                    />
                    <Text
                      className={`text-xs font-medium ${
                        reminderInfo.active ? 'text-primary-dark' : 'text-[#5A706B]'
                      }`}
                    >
                      {reminderInfo.label}
                    </Text>
                  </View>
                </View>

                {effectiveStatus !== 'ARCHIVED' ? (
                  <View
                    className={`mt-3 gap-2 border-t border-border pt-2.5 ${
                      layout.stackTwoCol ? 'flex-col' : 'flex-row flex-wrap'
                    }`}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${medName} schedule`}
                      disabled={busy}
                      hitSlop={4}
                      onPress={() => handleOpenEdit(schedule)}
                      className={`min-h-[42px] flex-row items-center justify-center gap-1.5 rounded-field border border-border bg-background px-3 py-2 active:bg-mint ${
                        layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-[82px]'
                      }`}
                    >
                      <Feather
                        name="edit-2"
                        size={13}
                        color={CAREDOSE_EXTENDED_COLORS.primary}
                      />
                      <Text className="text-xs font-semibold text-main" numberOfLines={1}>
                        Edit
                      </Text>
                    </Pressable>

                    {effectiveStatus === 'ACTIVE' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pause ${medName} schedule`}
                        disabled={busy}
                        hitSlop={4}
                        onPress={() =>
                          setPendingAction({
                            kind: 'pause',
                            schedule,
                            medName,
                          })
                        }
                        className={`min-h-[42px] flex-row items-center justify-center gap-1.5 rounded-field border border-border bg-white px-3 py-2 active:bg-background ${
                          layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-[82px]'
                        }`}
                      >
                        <Feather
                          name="pause-circle"
                          size={13}
                          color={CAREDOSE_EXTENDED_COLORS.warning}
                        />
                        <Text className="text-xs font-semibold text-main" numberOfLines={1}>
                          Pause
                        </Text>
                      </Pressable>
                    ) : null}

                    {effectiveStatus === 'PAUSED' ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Resume ${medName} schedule`}
                        disabled={busy}
                        hitSlop={4}
                        onPress={() => void handleResume(schedule, medName)}
                        className={`min-h-[42px] flex-row items-center justify-center gap-1.5 rounded-field border border-[#C5E8D8] bg-mint px-3 py-2 active:opacity-90 ${
                          layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-[82px]'
                        }`}
                      >
                        <Feather
                          name="play-circle"
                          size={13}
                          color={CAREDOSE_EXTENDED_COLORS.primary}
                        />
                        <Text
                          className="text-xs font-semibold text-primary-dark"
                          numberOfLines={1}
                        >
                          Resume
                        </Text>
                      </Pressable>
                    ) : null}

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Archive ${medName} schedule`}
                      disabled={busy}
                      hitSlop={4}
                      onPress={() =>
                        setPendingAction({
                          kind: 'archive',
                          schedule,
                          medName,
                        })
                      }
                      className={`min-h-[42px] flex-row items-center justify-center gap-1.5 rounded-field border border-[#F3C1BE] bg-white px-3 py-2 active:bg-[#FDECEC] ${
                        layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-[82px]'
                      }`}
                    >
                      <Feather
                        name="archive"
                        size={13}
                        color={CAREDOSE_EXTENDED_COLORS.error}
                      />
                      <Text className="text-xs font-semibold text-error" numberOfLines={1}>
                        Archive
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Text className="mt-2.5 border-t border-border pt-2 text-[11px] text-[#5A706B]">
                    Archived schedule · Dose history preserved
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <ConfirmDialog
        visible={pendingAction !== null}
        title={
          pendingAction?.kind === 'pause'
            ? `Pause ${pendingAction.medName} schedule?`
            : `Archive ${pendingAction?.medName ?? ''} schedule?`
        }
        description={
          pendingAction?.kind === 'pause'
            ? 'Daily dose reminders and future doses will pause until you resume this schedule.'
            : 'Archiving stops future doses and reminders for this schedule. Past dose history remains preserved.'
        }
        warningNote={
          pendingAction?.kind === 'archive'
            ? 'You can still view past Taken and Skipped records in Dose History.'
            : undefined
        }
        confirmLabel={pendingAction?.kind === 'pause' ? 'Pause Schedule' : 'Archive Schedule'}
        destructive={pendingAction?.kind === 'archive'}
        loading={pendingAction ? mutatingId === pendingAction.schedule.id : false}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void handleConfirmLifecycleAction()}
      />

      <ScheduleModal
        visible={scheduleModalOpen}
        editingSchedule={editingSchedule}
        onClose={() => {
          setScheduleModalOpen(false);
          setEditingSchedule(null);
        }}
        onSaved={(saved, isEdit) => {
          const med = medications.find((m) => m.id === saved.patientMedicationId);
          setToast(
            isEdit
              ? `Schedule updated for ${med?.name ?? 'medicine'}.`
              : `Schedule saved for ${med?.name ?? 'medicine'}.`,
          );
        }}
      />
    </ScreenContainer>
  );
}
