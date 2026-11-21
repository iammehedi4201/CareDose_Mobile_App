import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  BottomSheet,
  DateField,
  DoseCard,
  FilterChips,
  FormCol,
  FormField,
  FormRow,
  ScreenContainer,
  SelectField,
  StatusVariant,
  SuccessToast,
  TimeField,
  ToggleField,
  validateRequiredFields,
} from '../src/components';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

type ViewMode = 'day' | 'week';

interface ScheduledDoseItem {
  id: string;
  group: 'Morning' | 'Afternoon' | 'Evening' | 'Bedtime';
  medicineName: string;
  strength: string;
  instruction: string;
  time: string;
  status: StatusVariant;
}

const INITIAL_SCHEDULE: ScheduledDoseItem[] = [
  {
    id: 's1',
    group: 'Morning',
    medicineName: 'Corvalen',
    strength: '5 mg',
    instruction: '1 tablet · After breakfast',
    time: '8:00 AM',
    status: 'missed',
  },
  {
    id: 's2',
    group: 'Morning',
    medicineName: 'Glymexa',
    strength: '500 mg',
    instruction: '1 tablet · With morning meal',
    time: '8:30 AM',
    status: 'missed',
  },
  {
    id: 's3',
    group: 'Afternoon',
    medicineName: 'Vitamin D3',
    strength: '1000 IU',
    instruction: '1 capsule · After lunch',
    time: '1:30 PM',
    status: 'upcoming',
  },
  {
    id: 's4',
    group: 'Afternoon',
    medicineName: 'Serenil',
    strength: '10 mg',
    instruction: '1 tablet · Afternoon',
    time: '4:00 PM',
    status: 'upcoming',
  },
  {
    id: 's5',
    group: 'Evening',
    medicineName: 'Lumigan Drops',
    strength: '0.01%',
    instruction: '1 drop · Affected eye',
    time: '8:00 PM',
    status: 'upcoming',
  },
];

const WEEK_DAYS = [
  { day: 'Mon', date: '16', fullLabel: 'Mon, November 16', count: 5 },
  { day: 'Tue', date: '17', fullLabel: 'Tue, November 17', count: 5 },
  { day: 'Wed', date: '18', fullLabel: 'Wed, November 18', count: 5 },
  { day: 'Thu', date: '19', fullLabel: 'Thu, November 19', count: 5 },
  { day: 'Fri', date: '20', fullLabel: 'Fri, November 20', count: 4 },
  { day: 'Sat', date: '21', fullLabel: 'Sat, November 21', count: 4 },
  { day: 'Sun', date: '22', fullLabel: 'Sun, November 22', count: 4 },
];

export default function ScheduleScreen(): React.JSX.Element {
  const layout = useResponsiveLayout();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDayIdx, setSelectedDayIdx] = useState(3);
  const [doses, setDoses] = useState<ScheduledDoseItem[]>(INITIAL_SCHEDULE);
  const [toast, setToast] = useState<string | null>(null);

  // Create Dose modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState('Corvalen 5 mg');
  const [doseAmount, setDoseAmount] = useState('1 tablet');
  const [frequency, setFrequency] = useState('Once daily');
  const [scheduledTime, setScheduledTime] = useState('09:00 AM');
  const [startDate, setStartDate] = useState('2026-11-21');
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [remindersOn, setRemindersOn] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentDay = WEEK_DAYS[selectedDayIdx] ?? WEEK_DAYS[3];

  const handleUpdateDose = (id: string, nextStatus: 'taken' | 'skipped'): void => {
    setDoses((prev) => prev.map((d) => (d.id === id ? { ...d, status: nextStatus } : d)));
    setToast(
      nextStatus === 'taken'
        ? 'Dose confirmed as taken.'
        : 'Dose marked as skipped (no stock deducted).',
    );
  };

  const handleCreateSchedule = (): void => {
    const errs = validateRequiredFields(
      { selectedMedicine, doseAmount, scheduledTime, startDate },
      {
        selectedMedicine: 'Medicine',
        doseAmount: 'Dose amount',
        scheduledTime: 'Scheduled time',
        startDate: 'Start date',
      },
    );
    if (endDate.trim().length > 0 && endDate.trim() < startDate.trim()) {
      setErrors({ ...errs, endDate: 'End date cannot be earlier than start date' });
      return;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    setDoses((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        group: 'Morning',
        medicineName: selectedMedicine,
        strength: '',
        instruction: instructions.trim() || `${doseAmount} · ${frequency}`,
        time: scheduledTime,
        status: 'upcoming',
      },
    ]);
    setCreateOpen(false);
    setInstructions('');
    setToast('Schedule saved from clinician instructions.');
  };

  const groups: Array<'Morning' | 'Afternoon' | 'Evening' | 'Bedtime'> = [
    'Morning',
    'Afternoon',
    'Evening',
    'Bedtime',
  ];

  return (
    <ScreenContainer
      title="Schedule"
      primaryAction={{
        label: 'Add Dose',
        iconName: 'plus',
        onPress: () => setCreateOpen(true),
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
            onPress={() => setSelectedDayIdx((idx) => Math.max(0, idx - 1))}
            style={styles.dateArrowBtn}
          >
            <Feather name="chevron-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
          <Text style={styles.dateNavTitle}>{currentDay.fullLabel}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next day"
            onPress={() => setSelectedDayIdx((idx) => Math.min(WEEK_DAYS.length - 1, idx + 1))}
            style={styles.dateArrowBtn}
          >
            <Feather name="chevron-right" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.weekCard, layout.isCompact ? styles.weekCardCompact : null]}>
          <Text style={styles.weekHeader}>Nov 16 – 22, 2026</Text>
          <View style={[styles.weekRow, layout.isCompact ? styles.weekRowCompact : null]}>
            {WEEK_DAYS.map((d, idx) => {
              const active = idx === selectedDayIdx;
              const dayLabel = layout.useShortWeekdayLabels ? d.day.slice(0, 2) : d.day;
              return (
                <Pressable
                  key={d.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.day} Nov ${d.date}, ${d.count} doses`}
                  onPress={() => setSelectedDayIdx(idx)}
                  style={[styles.dayTile, active ? styles.dayTileActive : null]}
                >
                  <Text style={[styles.dayName, active ? styles.dayTextActive : null]} numberOfLines={1}>
                    {dayLabel}
                  </Text>
                  <Text style={[styles.dayDate, active ? styles.dayTextActive : null]}>
                    {d.date}
                  </Text>
                  <Text style={[styles.dayCount, active ? styles.dayTextActive : null]} numberOfLines={1}>
                    {d.count}d
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {groups.map((group) => {
        const items = doses.filter((d) => d.group === group);
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
                key={item.id}
                medicineName={item.medicineName}
                strength={item.strength}
                doseInstruction={item.instruction}
                scheduledTime={item.time}
                status={item.status}
                onMarkTaken={() => handleUpdateDose(item.id, 'taken')}
                onSkip={() => handleUpdateDose(item.id, 'skipped')}
              />
            ))}
          </View>
        );
      })}

      <BottomSheet
        visible={createOpen}
        title="Create Dose / Schedule"
        iconName="clock"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSchedule}
        submitLabel="Save schedule"
      >
        <SelectField
          label="Medicine"
          value={selectedMedicine}
          options={[
            { label: 'Corvalen 5 mg (Tablet)', value: 'Corvalen 5 mg' },
            { label: 'Glymexa 500 mg (Tablet)', value: 'Glymexa 500 mg' },
            { label: 'Vitamin D3 1000 IU (Capsule)', value: 'Vitamin D3 1000 IU' },
          ]}
          onSelect={setSelectedMedicine}
          required
          errorMessage={errors.selectedMedicine}
        />
        <FormRow>
          <FormCol>
            <FormField
              label="Dose amount"
              value={doseAmount}
              onChangeText={setDoseAmount}
              placeholder="e.g. 1 tablet"
              required
              errorMessage={errors.doseAmount}
            />
          </FormCol>
          <FormCol>
            <TimeField
              label="Time"
              value={scheduledTime}
              onChangeTime={setScheduledTime}
              required
              errorMessage={errors.scheduledTime}
            />
          </FormCol>
        </FormRow>
        <SelectField
          label="Frequency"
          value={frequency}
          options={[
            { label: 'Once daily', value: 'Once daily' },
            { label: 'Twice daily', value: 'Twice daily' },
            { label: 'Every 8 hours', value: 'Every 8 hours' },
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
  dateNavTitle: {
    flex: 1,
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
  weekHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 10,
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
});
