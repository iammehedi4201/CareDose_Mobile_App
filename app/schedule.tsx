import React, { useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  SegmentedControl,
  SuccessToast,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  formatDoseActionFeedback,
  formatDoseAmountDisplay,
  formatIsoTimestampTo12Hour,
  formatScheduleBarDateLabel,
  formatWeekRangeLabel,
  getMondayOfWeekYmd,
  getTodayLocalYmd,
  parseYmdToLocalDate,
  summarizePeriodStatus,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

type ViewMode = 'day' | 'week';

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIOD_GROUPS: SchedulePeriodGroupDto[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Bedtime',
];

const PERIOD_SECTION_ICON: Record<SchedulePeriodGroupDto, keyof typeof Feather.glyphMap> = {
  Morning: 'sun',
  Afternoon: 'clock',
  Evening: 'sunset',
  Bedtime: 'moon',
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
  const insets = useSafeAreaInsets();
  const { medications } = useMedications();
  const {
    schedules,
    loading,
    pendingOccurrenceKeys,
    getLocalRangeDoses,
    recordDoseAction,
    refreshSchedules,
  } = useSchedules();

  const todayYmd = getTodayLocalYmd();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [toast, setToast] = useState<string | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [collapsedPeriods, setCollapsedPeriods] = useState<Record<string, boolean>>({});

  const weekStartYmd = useMemo(
    () => getMondayOfWeekYmd(selectedYmd),
    [selectedYmd],
  );

  const weekData = useMemo(
    () => getLocalRangeDoses(weekStartYmd, 7),
    [getLocalRangeDoses, weekStartYmd],
  );

  const selectedDayBucket = useMemo(() => {
    return (
      weekData.days.find((d) => d.date === selectedYmd) ??
      getLocalRangeDoses(selectedYmd, 1).days[0]
    );
  }, [getLocalRangeDoses, selectedYmd, weekData]);

  const dayDoses = selectedDayBucket?.items ?? [];

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

  const handleUpdateDose = async (
    item: ScheduledDoseItemDto,
    action: 'TAKEN' | 'SKIPPED',
  ): Promise<void> => {
    setActionError(null);
    try {
      const outcome = await recordDoseAction(item, action);
      setToast(formatDoseActionFeedback(outcome));
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to record dose right now.',
      );
    }
  };

  const handleTogglePeriod = (period: SchedulePeriodGroupDto): void => {
    setCollapsedPeriods((prev) => ({
      ...prev,
      [period]: !prev[period],
    }));
  };

  // Full-bleed header proportions matched identically to HomeScreen (2:1 artwork),
  // extending seamlessly from y = 0 behind the status bar down behind the top selector card.
  const isWideViewport = layout.width > 500;
  const baseArtWidth = isWideViewport
    ? layout.width
    : Math.round(layout.width * (layout.isCompact ? 1.1 : 1.14));
  const baseArtHeight = isWideViewport ? 220 : Math.round(baseArtWidth * 0.5);
  const topInset = Math.max(0, insets.top);
  const headerArtTop = topInset > 0 ? 0 : -Math.round(baseArtHeight * 0.14);
  const minArtHeightForInset =
    topInset > 0
      ? Math.max(
          topInset + (layout.isCompact ? 140 : 162),
          Math.round(topInset / 0.21),
        )
      : baseArtHeight;
  const headerArtHeight = Math.max(baseArtHeight, minArtHeightForInset);
  const headerArtWidth = isWideViewport
    ? layout.width
    : Math.max(baseArtWidth, Math.round(headerArtHeight * 2));
  const headerTopPadding = topInset + (layout.isCompact ? 10 : 12);
  const headerHeight = Math.max(
    headerTopPadding + 104,
    headerArtHeight + headerArtTop,
  );
  const headerOverlapPx = Math.round(Math.max(120, headerHeight - topInset) * 0.31);

  const statusBarGuardOverlay =
    topInset > 0 ? (
      <View
        accessible={false}
        pointerEvents="none"
        className="absolute left-0 right-0 top-0 z-20 overflow-hidden bg-[#DFF6EC]"
        style={{ height: topInset }}
      >
        <Image
          source={scheduleHeaderImage}
          resizeMode="cover"
          accessible={false}
          style={{
            position: 'absolute',
            top: headerArtTop,
            right: 0,
            width: headerArtWidth,
            height: headerArtHeight,
          }}
        />
      </View>
    ) : null;

  const scheduleHeaderBanner = (
    <View
      className="relative w-full overflow-hidden bg-[#DFF6EC]"
      style={{
        height: headerHeight,
        paddingTop: headerTopPadding,
      }}
    >
      <Image
        source={scheduleHeaderImage}
        resizeMode="cover"
        accessible={false}
        style={{
          position: 'absolute',
          top: headerArtTop,
          right: 0,
          width: headerArtWidth,
          height: headerArtHeight,
        }}
      />
      {/* Feathered multi-step transition into #F7FAF8 background matching HomeScreen */}
      <View
        accessible={false}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          backgroundColor: 'rgba(247, 250, 248, 0.20)',
        }}
      />
      <View
        accessible={false}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          backgroundColor: 'rgba(247, 250, 248, 0.40)',
        }}
      />
      <View
        accessible={false}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 24,
          backgroundColor: 'rgba(247, 250, 248, 0.65)',
        }}
      />
      <View
        accessible={false}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 12,
          backgroundColor: 'rgba(247, 250, 248, 0.90)',
        }}
      />

      <View
        className="w-full"
        style={[
          { paddingHorizontal: layout.screenPadding },
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : undefined,
        ]}
      >
        <View
          className="min-w-0 pr-3"
          style={{ maxWidth: layout.isCompact ? '54%' : '56%' }}
        >
          <Text
            className="font-bold text-main"
            style={{
              fontSize: layout.isCompact ? 25 : 28,
              lineHeight: layout.isCompact ? 30 : 34,
            }}
            numberOfLines={1}
          >
            Schedule
          </Text>
          <Text className="mt-1 text-xs leading-[17px] text-[#5A706B]" numberOfLines={2}>
            Your medicine plan and daily routine.
          </Text>
        </View>
      </View>
    </View>
  );

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
    >
      <SuccessToast message={toast} />

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

      {/* Day / Week segmented selector floating cleanly over banner fade just like Home */}
      <View style={{ marginTop: -headerOverlapPx }}>
        <SegmentedControl<ViewMode>
          options={[
            {
              key: 'day',
              label: 'Day',
              iconName: 'clock',
              accessibilityLabel: 'Day view',
            },
            {
              key: 'week',
              label: 'Week',
              iconName: 'calendar',
              accessibilityLabel: 'Week view',
            },
          ]}
          selectedKey={viewMode}
          onSelect={setViewMode}
        />
      </View>

      {/* Date Navigation */}
      {viewMode === 'day' ? (
        <View className="mt-3 flex-row items-center justify-between gap-2 rounded-card border border-border bg-white px-3 py-2.5 shadow-sm">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            hitSlop={6}
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, -1))}
            className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
          >
            <Feather name="chevron-left" size={17} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => setSelectedYmd(todayYmd)}
            className="flex-1 min-w-0 flex-row items-center justify-center gap-1.5 px-1"
          >
            <Feather name="calendar" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="text-center text-[15px] font-bold text-main" numberOfLines={1}>
              {formatScheduleBarDateLabel(selectedYmd)}
            </Text>
          </Pressable>

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
            accessibilityLabel="Next day"
            hitSlop={6}
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, 1))}
            className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
          >
            <Feather name="chevron-right" size={17} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
        </View>
      ) : (
        <View
          className="mt-3 rounded-card border border-border bg-white shadow-sm"
          style={{ padding: layout.cardPadding }}
        >
          <View className="mb-3 flex-row items-center justify-between gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              hitSlop={6}
              onPress={() => setSelectedYmd((d) => addDaysYmd(d, -7))}
              className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
            >
              <Feather name="chevron-left" size={17} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </Pressable>

            <View className="flex-1 min-w-0 flex-row items-center justify-center gap-1.5 px-1">
              <Feather name="calendar" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
              <Text className="text-center text-[14px] font-bold text-main" numberOfLines={1}>
                {formatWeekRangeLabel(weekStartYmd)}
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
              className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
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
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold"
                    style={{
                      color: active
                        ? 'rgba(255, 255, 255, 0.9)'
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
      )}

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
                : 'Try switching dates above or tap the green menu button to add a dose or manage schedules.'
            }
            actionLabel={selectedYmd !== todayYmd ? 'Return to today' : undefined}
            onAction={selectedYmd !== todayYmd ? () => setSelectedYmd(todayYmd) : undefined}
            iconName="calendar"
          />
        </View>
      ) : (
        PERIOD_GROUPS.map((group) => {
          const items = dayDoses
            .filter((d) => d.period === group)
            .sort(
              (a, b) =>
                a.scheduledTime24.localeCompare(b.scheduledTime24) ||
                a.medicineName.localeCompare(b.medicineName),
            );
          if (items.length === 0) {
            return null;
          }

          const periodSummary = summarizePeriodStatus(items);
          const expanded = !collapsedPeriods[group];

          return (
            <View key={group} className="mt-4">
              <SectionHeader
                title={group}
                subtitle={`${items.length} ${items.length === 1 ? 'dose' : 'doses'}`}
                iconName={PERIOD_SECTION_ICON[group]}
                statusLabel={periodSummary.label}
                statusBgClass={periodSummary.bgClass}
                statusTextClass={periodSummary.textClass}
                expanded={expanded}
                onToggle={() => handleTogglePeriod(group)}
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
                        onMarkTaken={() => void handleUpdateDose(item, 'TAKEN')}
                        onSkip={() => void handleUpdateDose(item, 'SKIPPED')}
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
