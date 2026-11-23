import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DoseCard,
  DoseProgressCard,
  EmptyState,
  ScheduleModal,
  ScreenContainer,
  SuccessToast,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  formatDoseActionFeedback,
  formatScheduleBarDateLabel,
  formatWeekRangeLabel,
  getMondayOfWeekYmd,
  getTodayLocalYmd,
  parseYmdToLocalDate,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
  SCHEDULE_PERIOD_META,
} from '../src/theme/tokens';

type ViewMode = 'day' | 'week';

const SHORT_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIOD_GROUPS: SchedulePeriodGroupDto[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Bedtime',
];

export default function ScheduleScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const {
    pendingOccurrenceKeys,
    getLocalRangeDoses,
    recordDoseAction,
  } = useSchedules();

  const todayYmd = getTodayLocalYmd();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [toast, setToast] = useState<string | null>(null);

  // Create Dose Schedule & overflow options menu state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

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
    const outcome = await recordDoseAction(item, action);
    setToast(formatDoseActionFeedback(outcome));
  };

  const handleOpenCreateModal = (): void => {
    setScheduleModalOpen(true);
  };

  return (
    <ScreenContainer
      title="Schedule"
      primaryAction={{
        label: 'Add Dose',
        iconName: 'plus',
        pill: true,
        onPress: handleOpenCreateModal,
      }}
      overflowAction={{
        accessibilityLabel: 'Schedule options',
        onPress: () => setOptionsMenuOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      {/* Day / Week segmented control */}
      <View className="flex-row items-center rounded-full border border-border bg-white p-1">
        {(
          [
            { key: 'day', label: 'Day' },
            { key: 'week', label: 'Week' },
          ] as const
        ).map((tab) => {
          const active = viewMode === tab.key;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityLabel={`${tab.label} view`}
              accessibilityState={{ selected: active }}
              onPress={() => setViewMode(tab.key)}
              className={`min-h-[40px] flex-1 min-w-0 flex-row items-center justify-center gap-1.5 rounded-full px-3 py-2 ${
                active ? 'bg-primary' : 'bg-transparent'
              }`}
            >
              <Feather
                name="calendar"
                size={15}
                color={active ? '#FFFFFF' : CAREDOSE_EXTENDED_COLORS.primary}
              />
              <Text
                numberOfLines={1}
                className={`text-[13px] font-semibold ${
                  active ? 'text-white' : 'text-main'
                }`}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {viewMode === 'day' ? (
        <View className="mt-3 flex-row items-center justify-between rounded-full border border-border bg-white px-2.5 py-1.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, -1))}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Feather name="chevron-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => setSelectedYmd(todayYmd)}
            className="flex-1 min-w-0 flex-row items-center justify-center gap-2 px-2"
          >
            <Feather name="calendar" size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="text-center text-sm font-semibold text-main" numberOfLines={1}>
              {formatScheduleBarDateLabel(selectedYmd)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, 1))}
            className="h-9 w-9 items-center justify-center rounded-full"
          >
            <Feather name="chevron-right" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
        </View>
      ) : (
        <View
          className={`mt-2.5 mb-2 rounded-card border border-border bg-white ${
            layout.isCompact ? 'px-2.5 py-3' : 'p-3.5'
          }`}
        >
          <View className="mb-2.5 flex-row items-center justify-between">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              onPress={() => setSelectedYmd((d) => addDaysYmd(d, -7))}
              className="h-8 w-8 items-center justify-center rounded-lg"
            >
              <Feather name="chevron-left" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </Pressable>
            <Text className="text-[13px] font-semibold text-main">
              {formatWeekRangeLabel(weekStartYmd)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next week"
              onPress={() => setSelectedYmd((d) => addDaysYmd(d, 7))}
              className="h-8 w-8 items-center justify-center rounded-lg"
            >
              <Feather name="chevron-right" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </Pressable>
          </View>
          <View className={`flex-row justify-between ${layout.isCompact ? 'gap-1' : 'gap-1.5'}`}>
            {weekData.days.map((bucket) => {
              const dt = parseYmdToLocalDate(bucket.date);
              const shortDay = SHORT_WEEKDAYS[dt.getDay()];
              const dayLabel = layout.useShortWeekdayLabels ? shortDay.slice(0, 2) : shortDay;
              const active = bucket.date === selectedYmd;
              return (
                <Pressable
                  key={bucket.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDay} ${dt.getDate()}, ${bucket.totalCount} doses`}
                  onPress={() => setSelectedYmd(bucket.date)}
                  className={`flex-1 min-w-0 items-center rounded-[10px] border px-0.5 py-2 ${
                    active ? 'border-primary bg-primary' : 'border-border bg-background'
                  }`}
                >
                  <Text
                    className={`text-[10px] ${active ? 'text-white' : 'text-[#5A706B]'}`}
                    numberOfLines={1}
                  >
                    {dayLabel}
                  </Text>
                  <Text className={`my-0.5 text-[13px] font-semibold ${active ? 'text-white' : 'text-main'}`}>
                    {dt.getDate()}
                  </Text>
                  <Text
                    className={`text-[10px] font-semibold ${active ? 'text-white' : 'text-primary'}`}
                    numberOfLines={1}
                  >
                    {bucket.totalCount}d
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {dayDoses.length > 0 ? (
        <DoseProgressCard
          takenCount={progressCounts.taken}
          totalCount={progressCounts.total}
          upcomingCount={progressCounts.upcoming}
          overdueCount={progressCounts.overdue}
          label={selectedYmd === todayYmd ? "Today's progress" : 'Daily progress'}
        />
      ) : null}

      {dayDoses.length === 0 ? (
        <EmptyState
          title="No scheduled doses for this day"
          description="Add a recurring or timed schedule based on your prescription instructions."
          actionLabel="Add Dose"
          onAction={handleOpenCreateModal}
          iconName="calendar"
        />
      ) : (
        PERIOD_GROUPS.map((group) => {
          const items = dayDoses.filter((d) => d.period === group);
          if (items.length === 0) {
            return null;
          }
          const periodMeta = SCHEDULE_PERIOD_META[group];
          return (
            <View key={group} className="mt-4">
              <View className="mb-2 flex-row items-center justify-between gap-2.5">
                <View className="flex-1 min-w-0 flex-row items-center gap-2">
                  <View
                    className={`h-7 w-7 shrink-0 items-center justify-center rounded-full ${periodMeta.bgClass}`}
                  >
                    <Feather name={periodMeta.icon} size={14} color={periodMeta.color} />
                  </View>
                  <Text className="flex-1 min-w-0 text-[15px] font-semibold text-main" numberOfLines={1}>
                    {group}
                  </Text>
                </View>
                <View className="shrink-0 rounded-full bg-[#EAF1EE] px-2.5 py-1">
                  <Text className="text-[11px] font-semibold text-[#5A706B]">
                    {items.length} {items.length === 1 ? 'dose' : 'doses'}
                  </Text>
                </View>
              </View>
              {items.map((item) => (
                <DoseCard
                  key={item.occurrenceKey}
                  medicineName={item.medicineName}
                  strength={item.strength}
                  doseInstruction={item.doseInstruction}
                  scheduledTime={item.scheduledTime12}
                  status={item.status}
                  actionLoading={Boolean(pendingOccurrenceKeys[item.occurrenceKey])}
                  onMarkTaken={() => void handleUpdateDose(item, 'TAKEN')}
                  onSkip={() => void handleUpdateDose(item, 'SKIPPED')}
                />
              ))}
            </View>
          );
        })
      )}

      {/* Overflow menu bottom sheet for secondary navigation */}
      <BottomSheet
        visible={optionsMenuOpen}
        onClose={() => setOptionsMenuOpen(false)}
        title="Schedule Options"
        subtitle="Manage your recurring schedules or inspect dose history."
        iconName="sliders"
        hideFooter
      >
        <View className="overflow-hidden rounded-card border border-border bg-white">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Manage Schedules"
            hitSlop={6}
            onPress={() => {
              setOptionsMenuOpen(false);
              router.push('/schedules');
            }}
            className="min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-3 active:bg-mint"
          >
            <View className="flex-1 min-w-0 flex-row items-center gap-3">
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mint">
                <Feather name="sliders" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[14px] font-semibold text-main" numberOfLines={1}>
                  Manage Schedules
                </Text>
                <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                  Edit, pause, or archive recurring plans
                </Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={16}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
          </Pressable>
          <View className="h-px bg-border" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Dose History"
            hitSlop={6}
            onPress={() => {
              setOptionsMenuOpen(false);
              router.push('/history?from=schedule');
            }}
            className="min-h-[56px] flex-row items-center justify-between gap-3 px-4 py-3 active:bg-mint"
          >
            <View className="flex-1 min-w-0 flex-row items-center gap-3">
              <View className="h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-mint">
                <Feather name="clock" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[14px] font-semibold text-main" numberOfLines={1}>
                  Dose History
                </Text>
                <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                  View taken, skipped, and missed doses
                </Text>
              </View>
            </View>
            <Feather
              name="chevron-right"
              size={16}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
          </Pressable>
        </View>
      </BottomSheet>

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
