import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DateField,
  DoseCard,
  EmptyState,
  FilterChips,
  FormCol,
  FormField,
  FormRow,
  ScreenContainer,
  SelectField,
  StatusBadge,
  SuccessToast,
  TimeField,
  ToggleField,
  validateRequiredFields,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  buildScheduledTimesForFrequency,
  format24To12Hour,
  formatDayHeadingLabel,
  formatDoseActionFeedback,
  formatFrequencyLabel,
  formatWeekRangeLabel,
  getMondayOfWeekYmd,
  getTodayLocalYmd,
  inferSingleDoseUnitFromStockUnit,
  parseDoseAmountInput,
  parseYmdToLocalDate,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

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
    createSchedule,
    updateScheduleById,
    recordDoseAction,
  } = useSchedules();

  const todayYmd = getTodayLocalYmd();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [toast, setToast] = useState<string | null>(null);

  const activeMeds = useMemo(
    () => medications.filter((m) => !m.archived),
    [medications],
  );

  // Create Dose / Schedule modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState<string>(activeMeds[0]?.id ?? '');
  const [doseAmountInput, setDoseAmountInput] = useState('1');
  const [frequency, setFrequency] = useState('Once daily');
  const [scheduledTime, setScheduledTime] = useState('08:00 AM');
  const [secondTime, setSecondTime] = useState('08:00 PM');
  const [startDate, setStartDate] = useState(todayYmd);
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [remindersOn, setRemindersOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeMeds.length > 0 && !activeMeds.some((m) => m.id === selectedMedId)) {
      setSelectedMedId(activeMeds[0].id);
    }
  }, [activeMeds, selectedMedId]);

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

  const handleCreateSchedule = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { selectedMedId, doseAmountInput, scheduledTime, startDate },
      {
        selectedMedId: 'Medicine',
        doseAmountInput: 'Dose amount',
        scheduledTime: 'Scheduled time',
        startDate: 'Start date',
      },
    );

    const med = activeMeds.find((m) => m.id === selectedMedId);
    const fallbackUnit = inferSingleDoseUnitFromStockUnit(med?.stockUnit);
    const parsedDose = parseDoseAmountInput(doseAmountInput, fallbackUnit);
    if (!parsedDose && !errs.doseAmountInput) {
      errs.doseAmountInput = 'Enter a positive dose amount (e.g. 1 or 1 tablet).';
    }

    if (endDate.trim().length > 0 && endDate.trim() < startDate.trim()) {
      errs.endDate = 'End date cannot be earlier than start date.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0 || !parsedDose || !med) {
      return;
    }

    setSaving(true);
    try {
      const scheduledTimes = buildScheduledTimesForFrequency(
        scheduledTime,
        frequency,
        secondTime,
      );
      await createSchedule({
        patientMedicationId: med.id,
        doseAmount: parsedDose.amount,
        doseUnit: parsedDose.unit,
        frequency,
        scheduledTimes,
        startDateYmd: startDate.trim(),
        endDateYmd: endDate.trim() || null,
        instructions: instructions.trim() || med.instructions,
        remindersEnabled: remindersOn,
      });

      setCreateOpen(false);
      setInstructions('');
      setEndDate('');
      setErrors({});
      setToast(`Schedule saved for ${med.name}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateModal = (): void => {
    if (activeMeds.length === 0) {
      setToast('Add an active medicine in My Medicines before creating a schedule.');
      router.push('/medicines');
      return;
    }
    setErrors({});
    setCreateOpen(true);
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
        <View style={styles.dateNavCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, -1))}
            style={styles.dateArrowBtn}
          >
            <Feather name="chevron-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to today"
            onPress={() => setSelectedYmd(todayYmd)}
            style={styles.dateTitlePress}
          >
            <Text style={styles.dateNavTitle}>
              {formatDayHeadingLabel(selectedYmd, todayYmd)}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            onPress={() => setSelectedYmd((d) => addDaysYmd(d, 1))}
            style={styles.dateArrowBtn}
          >
            <Feather name="chevron-right" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.weekCard, layout.isCompact ? styles.weekCardCompact : null]}>
          <View style={styles.weekHeaderRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous week"
              onPress={() => setSelectedYmd((d) => addDaysYmd(d, -7))}
              style={styles.weekArrowBtn}
            >
              <Feather name="chevron-left" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </Pressable>
            <Text style={styles.weekHeader}>{formatWeekRangeLabel(weekStartYmd)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next week"
              onPress={() => setSelectedYmd((d) => addDaysYmd(d, 7))}
              style={styles.weekArrowBtn}
            >
              <Feather name="chevron-right" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </Pressable>
          </View>
          <View style={[styles.weekRow, layout.isCompact ? styles.weekRowCompact : null]}>
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
                  style={[styles.dayTile, active ? styles.dayTileActive : null]}
                >
                  <Text
                    style={[styles.dayName, active ? styles.dayTextActive : null]}
                    numberOfLines={1}
                  >
                    {dayLabel}
                  </Text>
                  <Text style={[styles.dayDate, active ? styles.dayTextActive : null]}>
                    {dt.getDate()}
                  </Text>
                  <Text
                    style={[styles.dayCount, active ? styles.dayTextActive : null]}
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
            <View key={group} style={styles.groupBlock}>
              <View style={styles.groupTitleRow}>
                <Text style={styles.groupTitle}>{group}</Text>
                <View style={styles.countChip}>
                  <Text style={styles.groupCount}>
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

      {/* Saved Schedule Plans Summary (pause / resume) */}
      {schedules.length > 0 ? (
        <View style={styles.plansSection}>
          <View style={styles.plansHeader}>
            <Text style={styles.plansTitle}>Saved schedules ({schedules.length})</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history')}
            >
              <Text style={styles.linkText}>Dose history</Text>
            </Pressable>
          </View>
          {schedules.map((s) => {
            const med = medications.find((m) => m.id === s.patientMedicationId);
            if (!med) return null;
            const paused = s.status !== 'ACTIVE';
            return (
              <View key={s.id} style={styles.planRow}>
                <View style={styles.planInfoCol}>
                  <Text style={styles.planMedName} numberOfLines={1}>
                    {med.name}
                  </Text>
                  <Text style={styles.planMeta} numberOfLines={2}>
                    {formatFrequencyLabel(s.frequency)} ·{' '}
                    {s.scheduledTimes.map(format24To12Hour).join(', ')}
                  </Text>
                </View>
                <View style={styles.planRightCol}>
                  <StatusBadge
                    variant={paused ? 'archived' : 'active'}
                    label={paused ? 'Paused' : 'Active'}
                  />
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
                    style={styles.togglePlanBtn}
                  >
                    <Text style={styles.togglePlanText}>
                      {paused ? 'Resume' : 'Pause'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <BottomSheet
        visible={createOpen}
        title="Create Dose / Schedule"
        iconName="clock"
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void handleCreateSchedule()}
        submitLabel="Save schedule"
        submitLoading={saving}
      >
        <SelectField
          label="Medicine"
          value={selectedMedId}
          options={activeMeds.map((m) => ({
            label: m.strength ? `${m.name} (${m.strength} · ${m.dosageForm})` : `${m.name} (${m.dosageForm})`,
            value: m.id,
          }))}
          onSelect={setSelectedMedId}
          required
          errorMessage={errors.selectedMedId}
        />
        <FormRow>
          <FormCol>
            <FormField
              label="Dose amount"
              value={doseAmountInput}
              onChangeText={setDoseAmountInput}
              placeholder="e.g. 1 or 1 tablet"
              required
              errorMessage={errors.doseAmountInput}
            />
          </FormCol>
          <FormCol>
            <TimeField
              label={frequency === 'Twice daily' ? 'First dose time' : 'Time'}
              value={scheduledTime}
              onChangeTime={setScheduledTime}
              required
              errorMessage={errors.scheduledTime}
            />
          </FormCol>
        </FormRow>
        {frequency === 'Twice daily' ? (
          <TimeField
            label="Second dose time"
            value={secondTime}
            onChangeTime={setSecondTime}
            required
          />
        ) : null}
        <SelectField
          label="Frequency"
          value={frequency}
          options={[
            { label: 'Once daily', value: 'Once daily' },
            { label: 'Twice daily', value: 'Twice daily' },
            { label: 'Every 8 hours', value: 'Every 8 hours' },
            { label: 'Alternate days', value: 'Alternate days' },
            { label: 'Weekly', value: 'Weekly' },
          ]}
          onSelect={setFrequency}
          required
        />
        <FormRow>
          <FormCol>
            <DateField
              label="Start date"
              value={startDate}
              onChangeDate={setStartDate}
              required
              errorMessage={errors.startDate}
            />
          </FormCol>
          <FormCol>
            <DateField
              label="End date"
              value={endDate}
              onChangeDate={setEndDate}
              placeholder="Optional"
              allowClear
              errorMessage={errors.endDate}
            />
          </FormCol>
        </FormRow>
        <FormField
          label="Instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="e.g. After breakfast"
        />
        <ToggleField
          label="Dose reminder"
          value={remindersOn}
          onValueChange={setRemindersOn}
        />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dateNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 10,
  },
  dateArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTitlePress: {
    flex: 1,
    alignItems: 'center',
  },
  dateNavTitle: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  weekCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  weekCardCompact: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  weekRowCompact: {
    gap: 4,
  },
  dayTile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
  },
  dayTileActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  dayName: {
    fontSize: 10,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  dayDate: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginVertical: 2,
  },
  dayCount: {
    fontSize: 10,
    color: CAREDOSE_EXTENDED_COLORS.primary,
    fontWeight: '600',
  },
  dayTextActive: {
    color: '#FFFFFF',
  },
  groupBlock: {
    marginTop: 14,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flex: 1,
    minWidth: 0,
  },
  countChip: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  groupCount: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  plansSection: {
    marginTop: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
  },
  plansHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  plansTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  planInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  planMedName: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  planMeta: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  planRightCol: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  togglePlanBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  togglePlanText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
});
