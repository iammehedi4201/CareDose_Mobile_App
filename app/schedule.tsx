import React, { useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import scheduleHeaderImage from '../assets/schedule-header-illustration.jpg';
import {
  DoseCard,
  DoseProgressCard,
  EmptyState,
  ErrorState,
  FloatingActionMenu,
  LoadingSkeleton,
  ScheduleModal,
  ScreenContainer,
  SectionHeader,
  useScreenWaveHeader,
} from '../src/components';
import type { ScheduledDoseItemDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  formatDayHeadingLabel,
  formatDoseActionFeedback,
  formatDoseAmountDisplay,
  formatIsoTimestampTo12Hour,
  getCurrentDayPeriod,
  getMondayOfWeekYmd,
  getMsUntilNextPeriodBoundary,
  getTodayLocalYmd,
  parseYmdToLocalDate,
  resolveDefaultExpandedPeriod,
  resolveSectionTimelineState,
  resolveTimelinePeriod,
  summarizePeriodStatus,
  TIMELINE_PERIOD_ORDER,
  TimelinePeriodGroup,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PERIOD_SECTION_META: Record<
  TimelinePeriodGroup,
  {
    icon: keyof typeof Feather.glyphMap;
    timeRange: string;
    compactTimeRange: string;
  }
> = {
  Morning: {
    icon: 'sun',
    timeRange: '06:00 AM – 12:00 PM',
    compactTimeRange: '6 AM – 12 PM',
  },
  Afternoon: {
    icon: 'clock',
    timeRange: '12:00 PM – 06:00 PM',
    compactTimeRange: '12 PM – 6 PM',
  },
  Bedtime: {
    icon: 'moon',
    timeRange: '06:00 PM – 11:00 PM',
    compactTimeRange: '6 PM – 11 PM',
  },
};

function stripLeadingAmountPrefix(doseInstruction: string, amountLabel: string): string | null {
  const trimmed = doseInstruction.trim();
  const prefix = `${amountLabel} ·`;
  if (trimmed.startsWith(prefix)) {
    const remainder = trimmed.slice(prefix.length).trim();
    return remainder || null;
  }
  const parts = trimmed
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(' · ') : null;
}

export default function ScheduleScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const {
    schedules,
    loading,
    pendingOccurrenceKeys,
    getLocalRangeDoses,
    recordDoseAction,
    refreshSchedules,
  } = useSchedules();

  const [selectedYmd, setSelectedYmd] = useState(() => getTodayLocalYmd());
  const [toastState, setToastState] = useState<
    string | { id: number; message: string } | null
  >(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);

  const showToast = (message: string): void => {
    setToastState({ id: Date.now(), message });
  };
  const toastMessage =
    typeof toastState === 'string' ? toastState : toastState?.message ?? null;
  const toastKey =
    typeof toastState === 'object' && toastState !== null ? toastState.id : undefined;
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manualPeriodOverrides, setManualPeriodOverrides] = useState<Record<string, boolean>>({});
  const [nowTs, setNowTs] = useState(() => Date.now());

  const todayYmd = useMemo(() => getTodayLocalYmd(new Date(nowTs)), [nowTs]);

  const currentPeriod = useMemo(
    () => getCurrentDayPeriod(new Date(nowTs)),
    [nowTs],
  );

  // Tick every 30s, schedule an exact period-boundary wakeup (12 PM / 6 PM / 12 AM),
  // and refresh on foreground so active section highlighting & Missed states update live
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 30_000);
    let boundaryTimeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleBoundaryWakeup = () => {
      const delay = getMsUntilNextPeriodBoundary(new Date());
      boundaryTimeout = setTimeout(() => {
        setNowTs(Date.now());
        scheduleBoundaryWakeup();
      }, delay);
    };
    scheduleBoundaryWakeup();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNowTs(Date.now());
      }
    });
    return () => {
      clearInterval(interval);
      if (boundaryTimeout) {
        clearTimeout(boundaryTimeout);
      }
      sub.remove();
    };
  }, []);

  // Reset manual accordion overrides whenever time of day transitions or selected day changes
  useEffect(() => {
    setManualPeriodOverrides({});
  }, [currentPeriod, selectedYmd]);

  const weekStartYmd = useMemo(
    () => getMondayOfWeekYmd(selectedYmd),
    [selectedYmd],
  );

  const weekData = useMemo(
    () => getLocalRangeDoses(weekStartYmd, 7, new Date(nowTs)),
    [getLocalRangeDoses, nowTs, weekStartYmd],
  );

  const selectedDayBucket = useMemo(() => {
    return (
      weekData.days.find((d) => d.date === selectedYmd) ??
      getLocalRangeDoses(selectedYmd, 1, new Date(nowTs)).days[0]
    );
  }, [getLocalRangeDoses, nowTs, selectedYmd, weekData]);

  const dayDoses = selectedDayBucket?.items ?? [];

  const defaultExpandedPeriod = useMemo(
    () => resolveDefaultExpandedPeriod(dayDoses, new Date(nowTs)),
    [dayDoses, nowTs],
  );

  const progressCounts = useMemo(() => {
    let taken = 0;
    let upcoming = 0;
    let overdue = 0;
    for (const d of dayDoses) {
      if (d.status === 'taken') taken += 1;
      else if (d.status === 'upcoming' || d.status === 'due') upcoming += 1;
      else if (d.status === 'missed') overdue += 1;
    }
    return {
      total: dayDoses.length,
      taken,
      upcoming,
      overdue,
    };
  }, [dayDoses]);

  const handleMarkDoseTaken = async (item: ScheduledDoseItemDto): Promise<void> => {
    setActionError(null);
    try {
      const outcome = await recordDoseAction(item, 'TAKEN');
      const medLabel = item.strength
        ? `${item.medicineName} ${item.strength}`
        : item.medicineName;
      showToast(formatDoseActionFeedback(outcome, medLabel));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to record dose right now.',
      );
    }
  };

  const handleTogglePeriod = (
    period: TimelinePeriodGroup,
    currentlyExpanded: boolean,
  ): void => {
    setManualPeriodOverrides((prev) => ({
      ...prev,
      [period]: !currentlyExpanded,
    }));
  };

  const {
    topBanner: scheduleHeaderBanner,
    topOverlay: statusBarGuardOverlay,
    overlapPx: headerOverlapPx,
  } = useScreenWaveHeader({
    title: 'Schedule',
    imageSource: scheduleHeaderImage,
    overlapRatio: 0.34,
  });

  const floatingMenu = (
    <FloatingActionMenu
      open={optionsMenuOpen}
      onToggle={() => setOptionsMenuOpen((prev) => !prev)}
      onClose={() => setOptionsMenuOpen(false)}
      toggleAccessibilityLabel="Open schedule actions menu"
      items={[
        {
          key: 'add-dose',
          label: 'Add Dose',
          iconName: 'plus',
          accessibilityLabel: 'Add Dose',
          onPress: () => setScheduleModalOpen(true),
        },
        {
          key: 'manage-schedules',
          label: 'Manage Schedules',
          iconName: 'sliders',
          accessibilityLabel: 'Open Manage Schedules',
          onPress: () => router.push('/schedules'),
        },
        {
          key: 'dose-history',
          label: 'Dose History',
          iconName: 'clock',
          accessibilityLabel: 'Open Dose History',
          onPress: () => router.push('/history?from=schedule'),
        },
      ]}
    />
  );

  return (
    <ScreenContainer
      title="Schedule"
      hideHeader
      topBanner={scheduleHeaderBanner}
      topOverlay={statusBarGuardOverlay}
      floatingOverlay={floatingMenu}
      toastMessage={toastMessage}
      toastKey={toastKey}
      onDismissToast={() => setToastState(null)}
      toastDurationMs={4000}
    >
      {actionError ? (
        <ErrorState
          title="Could not update schedule"
          message={actionError}
          onRetry={() => {
            setActionError(null);
            void refreshSchedules();
          }}
        />
      ) : null}

      {/* Unified Week Calendar Selector floating smoothly over header wave */}
      <View
        className="rounded-card border border-border bg-white shadow-sm"
        style={{
          marginTop: -headerOverlapPx,
          padding: layout.cardPadding,
        }}
      >
        <View className="mb-2.5 flex-row items-center justify-between gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous week"
            hitSlop={6}
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, -7))}
            className="h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
          >
            <Feather name="chevron-left" size={17} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>

          <View className="flex-1 min-w-0 items-center px-1">
            <Text className="text-center text-[15px] font-bold text-main" numberOfLines={1}>
              {formatDayHeadingLabel(selectedYmd, todayYmd)}
            </Text>
          </View>

          {selectedYmd !== todayYmd ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to today"
              hitSlop={4}
              onPress={() => setSelectedYmd(todayYmd)}
              className="shrink-0 rounded-full px-2.5 py-1 active:opacity-80"
              style={{
                backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
                borderWidth: 1,
                borderColor: '#CBE7DB',
              }}
            >
              <Text className="text-[11px] font-semibold text-primary">Today</Text>
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next week"
            hitSlop={6}
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, 7))}
            className="h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
          >
            <Feather name="chevron-right" size={17} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
        </View>

        <View className={`flex-row justify-between ${layout.isCompact ? 'gap-1' : 'gap-1.5'}`}>
          {weekData.days.map((bucket) => {
            const dt = parseYmdToLocalDate(bucket.date);
            const shortDay = SHORT_WEEKDAYS[dt.getDay()];
            const dayLabel = layout.useShortWeekdayLabels ? shortDay.slice(0, 2) : shortDay;
            const active = bucket.date === selectedYmd;
            const isToday = bucket.date === todayYmd;

            return (
              <Pressable
                key={bucket.date}
                accessibilityRole="button"
                accessibilityLabel={`${shortDay} ${dt.getDate()}, ${bucket.totalCount} doses`}
                accessibilityState={{ selected: active }}
                onPress={() => setSelectedYmd(bucket.date)}
                className="min-h-[68px] flex-1 min-w-0 items-center justify-between rounded-field px-1 py-2"
                style={{
                  borderWidth: 1,
                  borderColor: active
                    ? CAREDOSE_EXTENDED_COLORS.primary
                    : isToday
                      ? '#BCE3D1'
                      : CAREDOSE_EXTENDED_COLORS.border,
                  backgroundColor: active
                    ? CAREDOSE_EXTENDED_COLORS.primary
                    : isToday
                      ? CAREDOSE_EXTENDED_COLORS.mintSurface
                      : CAREDOSE_EXTENDED_COLORS.background,
                  ...(active
                    ? {
                        shadowColor: '#075D4E',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.18,
                        shadowRadius: 4,
                        elevation: 2,
                      }
                    : null),
                }}
              >
                <Text
                  className="text-[10px] font-semibold"
                  style={{
                    color: active
                      ? 'rgba(255, 255, 255, 0.92)'
                      : isToday
                        ? CAREDOSE_EXTENDED_COLORS.primaryDark
                        : CAREDOSE_EXTENDED_COLORS.secondaryText,
                  }}
                  numberOfLines={1}
                >
                  {dayLabel}
                </Text>
                <Text
                  className="text-[14px] font-bold"
                  style={{
                    color: active
                      ? '#FFFFFF'
                      : isToday
                        ? CAREDOSE_EXTENDED_COLORS.primaryDark
                        : CAREDOSE_EXTENDED_COLORS.mainText,
                  }}
                >
                  {dt.getDate()}
                </Text>
                <View
                  className="min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5"
                  style={{
                    backgroundColor: active
                      ? 'rgba(255, 255, 255, 0.22)'
                      : bucket.totalCount > 0
                        ? '#DFF1E8'
                        : 'transparent',
                  }}
                >
                  <Text
                    className="text-[10px] font-bold"
                    style={{
                      color: active
                        ? '#FFFFFF'
                        : bucket.totalCount > 0
                          ? CAREDOSE_EXTENDED_COLORS.primaryDark
                          : CAREDOSE_EXTENDED_COLORS.mutedText,
                    }}
                    numberOfLines={1}
                  >
                    {bucket.totalCount}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Daily Progress Summary */}
      {dayDoses.length > 0 ? (
        <DoseProgressCard
          takenCount={progressCounts.taken}
          totalCount={progressCounts.total}
          upcomingCount={progressCounts.upcoming}
          overdueCount={progressCounts.overdue}
          label={selectedYmd === todayYmd ? "Today's progress" : 'Daily progress'}
        />
      ) : null}

      {/* Loading / Empty / Chronological Period Timelines */}
      {loading && dayDoses.length === 0 ? (
        <View className="mt-3">
          <LoadingSkeleton rows={3} />
        </View>
      ) : dayDoses.length === 0 ? (
        <View className="mt-3">
          <EmptyState
            title={
              schedules.length === 0
                ? 'No schedules set up yet'
                : 'No scheduled doses for this day'
            }
            description={
              schedules.length === 0
                ? 'Tap the green menu button in the bottom-right corner and select Add Dose to create your medication routine.'
                : 'Try switching days above or tap the green menu button to add a dose or manage schedules.'
            }
            actionLabel={selectedYmd !== todayYmd ? 'Return to today' : undefined}
            onAction={selectedYmd !== todayYmd ? () => setSelectedYmd(todayYmd) : undefined}
            iconName="calendar"
          />
        </View>
      ) : (
        TIMELINE_PERIOD_ORDER.map((group) => {
          const items = dayDoses
            .filter((d) => resolveTimelinePeriod(d) === group)
            .sort(
              (a, b) =>
                a.scheduledTime24.localeCompare(b.scheduledTime24) ||
                a.medicineName.localeCompare(b.medicineName),
            );
          if (items.length === 0) {
            return null;
          }

          const meta = PERIOD_SECTION_META[group];
          const timelineState = resolveSectionTimelineState(
            group,
            selectedYmd,
            todayYmd,
            new Date(nowTs),
          );
          const periodSummary = summarizePeriodStatus(items);
          const expanded =
            manualPeriodOverrides[group] ?? (group === defaultExpandedPeriod);
          const doseCountLabel = `${items.length} ${items.length === 1 ? 'dose' : 'doses'}`;
          const rangeLabel = layout.isCompact ? meta.compactTimeRange : meta.timeRange;

          return (
            <View key={group} className="mt-3.5">
              <SectionHeader
                title={group}
                subtitle={`${rangeLabel} · ${doseCountLabel}`}
                iconName={meta.icon}
                statusLabel={periodSummary.label}
                statusBgClass={periodSummary.bgClass}
                statusTextClass={periodSummary.textClass}
                timelineState={timelineState}
                expanded={expanded}
                onToggle={() => handleTogglePeriod(group, expanded)}
              />

              {expanded ? (
                <View className="mt-2.5">
                  {items.map((item) => {
                    const amountText = formatDoseAmountDisplay(
                      item.doseAmount,
                      item.doseUnit,
                    );
                    const instructionsText = stripLeadingAmountPrefix(
                      item.doseInstruction,
                      amountText,
                    );
                    const recordedAtText = item.recordedAt
                      ? formatIsoTimestampTo12Hour(item.recordedAt)
                      : null;

                    return (
                      <DoseCard
                        key={item.occurrenceKey}
                        medicineName={item.medicineName}
                        strength={item.strength}
                        dosageForm={item.dosageForm}
                        doseAmountText={amountText}
                        instructions={instructionsText}
                        doseInstruction={item.doseInstruction}
                        scheduledTime={item.scheduledTime12}
                        status={item.status}
                        recordedAtText={recordedAtText}
                        actionLoading={Boolean(pendingOccurrenceKeys[item.occurrenceKey])}
                        onMarkTaken={() => void handleMarkDoseTaken(item)}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <ScheduleModal
        visible={scheduleModalOpen}
        editingSchedule={null}
        onClose={() => {
          setScheduleModalOpen(false);
        }}
        onSaved={(saved, isEdit) => {
          const med = medications.find((m) => m.id === saved.patientMedicationId);
          showToast(
            isEdit
              ? `Schedule updated for ${med?.name ?? 'medicine'}.`
              : `Schedule saved for ${med?.name ?? 'medicine'}.`,
          );
        }}
      />
    </ScreenContainer>
  );
}
