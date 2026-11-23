import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  DoseCard,
  EmptyState,
  FilterChips,
  ScheduleModal,
  ScreenContainer,
  StatusBadge,
  SuccessToast,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  format24To12Hour,
  formatDayHeadingLabel,
  formatDoseActionFeedback,
  formatRecurrenceSummary,
  formatWeekRangeLabel,
  getMondayOfWeekYmd,
  getTodayLocalYmd,
  LocalScheduleRecord,
  parseYmdToLocalDate,
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

export default function ScheduleScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const {
    schedules,
    pendingOccurrenceKeys,
    getLocalRangeDoses,
    updateScheduleById,
    recordDoseAction,
  } = useSchedules();

  const todayYmd = getTodayLocalYmd();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [toast, setToast] = useState<string | null>(null);

  // Create / Edit Dose Schedule modal state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LocalScheduleRecord | null>(null);

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

  const handleUpdateDose = async (
    item: ScheduledDoseItemDto,
    action: 'TAKEN' | 'SKIPPED',
  ): Promise<void> => {
    const outcome = await recordDoseAction(item, action);
    setToast(formatDoseActionFeedback(outcome));
  };

  const handleOpenCreateModal = (): void => {
    setEditingSchedule(null);
    setScheduleModalOpen(true);
  };

  return (
    <ScreenContainer
      title="Schedule"
      primaryAction={{
        label: 'Add Dose',
        iconName: 'plus',
        onPress: handleOpenCreateModal,
      }}
    >
      <SuccessToast message={toast} />

      <FilterChips
        options={[
          { key: 'day', label: 'Day' },
          { key: 'week', label: 'Week' },
        ]}
        selectedKey={viewMode}
        onSelect={setViewMode}
      />

      {viewMode === 'day' ? (
        <View className="mt-2.5 flex-row items-center justify-between rounded-card border border-border bg-white px-2.5 py-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, -1))}
            className="h-9 w-9 items-center justify-center rounded-[10px]"
          >
            <Feather name="chevron-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => setSelectedYmd(todayYmd)}
            className="flex-1 items-center"
          >
            <Text className="text-center text-sm font-bold text-main">
              {formatDayHeadingLabel(selectedYmd, todayYmd)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, 1))}
            className="h-9 w-9 items-center justify-center rounded-[10px]"
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
            <Text className="text-[13px] font-bold text-main">
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
                  <Text className={`my-0.5 text-[13px] font-bold ${active ? 'text-white' : 'text-main'}`}>
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
          return (
            <View key={group} className="mt-3.5">
              <View className="mb-2 flex-row items-center justify-between gap-2.5">
                <Text className="flex-1 min-w-0 text-[15px] font-semibold text-main">
                  {group}
                </Text>
                <View className="shrink-0 rounded-full bg-[#EEF2F0] px-2.5 py-0.5">
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

      {/* Saved Schedule Plans Summary (edit / pause / resume) */}
      {schedules.length > 0 ? (
        <View className="mt-5 rounded-card border border-border bg-white p-3.5">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-main">
              Saved schedules ({schedules.length})
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history')}
            >
              <Text className="text-xs font-semibold text-primary">Dose history</Text>
            </Pressable>
          </View>
          {schedules.map((s) => {
            const med = medications.find((m) => m.id === s.patientMedicationId);
            if (!med) return null;
            const paused = s.status !== 'ACTIVE';
            return (
              <View
                key={s.id}
                className="flex-row items-center justify-between gap-2.5 border-t border-border py-2"
              >
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-semibold text-main" numberOfLines={1}>
                    {med.name}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={2}>
                    {formatRecurrenceSummary(s)} ·{' '}
                    {s.scheduledTimes.map(format24To12Hour).join(', ')}
                  </Text>
                </View>
                <View className="shrink-0 items-end gap-1">
                  <StatusBadge
                    variant={paused ? 'archived' : 'active'}
                    label={paused ? 'Paused' : 'Active'}
                  />
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditingSchedule(s);
                        setScheduleModalOpen(true);
                      }}
                      className="px-1.5 py-0.5"
                    >
                      <Text className="text-[11px] font-semibold text-primary">Edit</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        void updateScheduleById(s.id, {
                          status: paused ? 'ACTIVE' : 'PAUSED',
                        }).then(() =>
                          setToast(
                            paused
                              ? `${med.name} schedule resumed.`
                              : `${med.name} schedule paused.`,
                          ),
                        )
                      }
                      className="px-1.5 py-0.5"
                    >
                      <Text className="text-[11px] font-semibold text-primary">
                        {paused ? 'Resume' : 'Pause'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

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
