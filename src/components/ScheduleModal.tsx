import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatStockWithUnit } from '../features/medications/stock-calculator';
import { useMedications } from '../features/medications/MedicationsContext';
import {
  adaptDefaultDoseUnit,
  findDuplicateTimes,
  format24To12Hour,
  formatDoseAmountDisplay,
  formatRecurrenceSummary,
  getDoseUnitOptions,
  getTodayLocalYmd,
  LocalScheduleRecord,
  normalizeScheduleFrequencyCode,
  normalizeTimeTo24Hour,
  WEEKDAY_OPTIONS,
} from '../features/schedule/dose-rules';
import {
  checkDeviceNotificationSupport,
  NotificationCapabilityState,
  requestDeviceNotificationPermission,
} from '../features/schedule/notifications';
import { useSchedules } from '../features/schedule/SchedulesContext';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { PrimaryButton } from './Buttons';
import { DateField, FormField, TimeField, ToggleField } from './FormFields';
import { MedicineFormThumbnail } from './MedicineFormThumbnail';
import { BottomSheet } from './Overlays';
import { SearchInput } from './SearchInput';

const MAX_CUSTOM_TIMES = 8;

type BasicFrequencyCode = 'DAILY' | 'TWICE_DAILY' | 'THREE_TIMES_DAILY' | 'CUSTOM_TIMES';
type AdvancedFrequencyCode =
  | 'EVERY_X_HOURS'
  | 'ALTERNATE_DAYS'
  | 'SELECTED_WEEKDAYS'
  | 'WEEKLY';
type ScheduleFrequencyCode = BasicFrequencyCode | AdvancedFrequencyCode;

const BASIC_FREQUENCY_OPTIONS: Array<{
  code: BasicFrequencyCode;
  label: string;
  slotCount: number | null;
}> = [
  { code: 'DAILY', label: 'Once daily', slotCount: 1 },
  { code: 'TWICE_DAILY', label: 'Twice daily', slotCount: 2 },
  { code: 'THREE_TIMES_DAILY', label: 'Three times daily', slotCount: 3 },
  { code: 'CUSTOM_TIMES', label: 'Custom times', slotCount: null },
];

const ADVANCED_FREQUENCY_OPTIONS: Array<{
  code: AdvancedFrequencyCode;
  label: string;
  hint: string;
}> = [
  { code: 'EVERY_X_HOURS', label: 'Every X hours', hint: 'Repeat every N hours' },
  { code: 'ALTERNATE_DAYS', label: 'Alternate days', hint: 'Every 2 days' },
  { code: 'SELECTED_WEEKDAYS', label: 'Selected weekdays', hint: 'Specific days' },
  { code: 'WEEKLY', label: 'Weekly', hint: 'Once per week' },
];

export interface ScheduleModalProps {
  visible: boolean;
  initialMedicationId?: string | null;
  lockMedicineSelection?: boolean;
  editingSchedule?: LocalScheduleRecord | null;
  onClose: () => void;
  onSaved: (saved: LocalScheduleRecord, isEdit: boolean) => void;
}

function isAdvancedCode(code: string): code is AdvancedFrequencyCode {
  return (
    code === 'EVERY_X_HOURS' ||
    code === 'EVERY_8_HOURS' ||
    code === 'ALTERNATE_DAYS' ||
    code === 'SELECTED_WEEKDAYS' ||
    code === 'WEEKLY'
  );
}

function resizeTimeSlots(
  prev: string[],
  targetLength: number,
): string[] {
  const next = prev.slice(0, targetLength);
  while (next.length < targetLength) {
    next.push('');
  }
  return next;
}

function getTimeFieldLabel(
  frequencyCode: ScheduleFrequencyCode,
  idx: number,
  total: number,
): string {
  if (frequencyCode === 'EVERY_X_HOURS') {
    return 'First dose time';
  }
  if (total === 1) {
    return 'Reminder time';
  }
  if (idx === 0) return 'First time';
  if (idx === 1) return 'Second time';
  if (idx === 2) return 'Third time';
  return `Time ${idx + 1}`;
}

export function ScheduleModal({
  visible,
  initialMedicationId = null,
  lockMedicineSelection = false,
  editingSchedule = null,
  onClose,
  onSaved,
}: ScheduleModalProps): React.JSX.Element {
  const router = useRouter();
  const { medications, loading: medsLoading } = useMedications();
  const { createSchedule, updateScheduleById } = useSchedules();

  const activeMeds = useMemo(
    () => medications.filter((m) => !m.archived),
    [medications],
  );
  const activeMedsRef = useRef(activeMeds);
  activeMedsRef.current = activeMeds;
  const medicationsRef = useRef(medications);
  medicationsRef.current = medications;

  // Section 1: Medicine selection
  const [selectedMedId, setSelectedMedId] = useState('');
  const [selectingMed, setSelectingMed] = useState(false);
  const [medSearchQuery, setMedSearchQuery] = useState('');

  // Section 2: Prescribed dose amount & unit
  const [doseAmountInput, setDoseAmountInput] = useState('');
  const [doseUnit, setDoseUnit] = useState('tablets');

  // Section 3: Schedule frequency & user-selected times
  const [frequencyCode, setFrequencyCode] = useState<ScheduleFrequencyCode>('DAILY');
  const [timeSlots, setTimeSlots] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState(getTodayLocalYmd());
  const [showEndDate, setShowEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');

  // More Options (collapsed by default)
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [intervalHoursInput, setIntervalHoursInput] = useState('8');
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [instructions, setInstructions] = useState('');

  // Device notification permission state
  const [notifState, setNotifState] = useState<NotificationCapabilityState>({
    supported: false,
    granted: false,
    canAskAgain: false,
    statusText: 'Checking notification permission...',
  });
  const [remindersOn, setRemindersOn] = useState(false);
  const [requestingNotif, setRequestingNotif] = useState(false);

  // Submission & validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize state cleanly only when modal opens or editing target changes
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    setErrors({});
    setApiError(null);
    setSaving(false);
    setMedSearchQuery('');

    const initNotifs = async () => {
      const cap = await checkDeviceNotificationSupport();
      if (cancelled) return;
      setNotifState(cap);
      if (!cap.supported || !cap.granted) {
        setRemindersOn(false);
      } else if (editingSchedule) {
        setRemindersOn(Boolean(editingSchedule.remindersEnabled));
      } else {
        setRemindersOn(true);
      }
    };
    void initNotifs();

    const currentMeds = medicationsRef.current;
    const currentActiveMeds = activeMedsRef.current;

    if (editingSchedule) {
      const targetMed = currentMeds.find((m) => m.id === editingSchedule.patientMedicationId);
      setSelectedMedId(editingSchedule.patientMedicationId);
      setSelectingMed(false);
      setDoseAmountInput(String(editingSchedule.doseAmount));
      setDoseUnit(
        editingSchedule.doseUnit ||
          adaptDefaultDoseUnit(targetMed?.dosageForm, targetMed?.stockUnit),
      );

      const rawCode = normalizeScheduleFrequencyCode(editingSchedule.frequency);
      const mappedCode: ScheduleFrequencyCode =
        rawCode === 'EVERY_8_HOURS'
          ? 'EVERY_X_HOURS'
          : isAdvancedCode(rawCode) ||
              rawCode === 'TWICE_DAILY' ||
              rawCode === 'THREE_TIMES_DAILY' ||
              rawCode === 'CUSTOM_TIMES'
            ? (rawCode as ScheduleFrequencyCode)
            : 'DAILY';

      setFrequencyCode(mappedCode);
      const formattedTimes =
        editingSchedule.scheduledTimes.length > 0
          ? editingSchedule.scheduledTimes.map(format24To12Hour)
          : [''];
      if (mappedCode === 'DAILY') {
        setTimeSlots(resizeTimeSlots(formattedTimes, 1));
      } else if (mappedCode === 'TWICE_DAILY') {
        setTimeSlots(resizeTimeSlots(formattedTimes, 2));
      } else if (mappedCode === 'THREE_TIMES_DAILY') {
        setTimeSlots(resizeTimeSlots(formattedTimes, 3));
      } else if (mappedCode === 'EVERY_X_HOURS') {
        setTimeSlots(resizeTimeSlots(formattedTimes, 1));
      } else {
        setTimeSlots(formattedTimes);
      }

      setStartDate(editingSchedule.startDateYmd || getTodayLocalYmd());
      const hasEnd = Boolean(editingSchedule.endDateYmd);
      setShowEndDate(hasEnd);
      setEndDate(editingSchedule.endDateYmd ?? '');
      setIntervalHoursInput(String(editingSchedule.intervalHours ?? 8));
      setSelectedWeekdays(editingSchedule.weekdays ?? []);
      setInstructions(editingSchedule.instructions ?? '');
      setShowMoreOptions(
        isAdvancedCode(mappedCode) || Boolean(editingSchedule.instructions?.trim()),
      );
    } else {
      const preferredMed =
        (initialMedicationId
          ? currentActiveMeds.find((m) => m.id === initialMedicationId)
          : null) ??
        currentActiveMeds[0] ??
        null;

      setSelectedMedId(preferredMed?.id ?? '');
      setSelectingMed(!preferredMed && currentActiveMeds.length > 0);
      setDoseAmountInput('');
      setDoseUnit(
        preferredMed
          ? adaptDefaultDoseUnit(preferredMed.dosageForm, preferredMed.stockUnit)
          : 'tablets',
      );
      setFrequencyCode('DAILY');
      setTimeSlots(['']);
      setStartDate(getTodayLocalYmd());
      setShowEndDate(false);
      setEndDate('');
      setIntervalHoursInput('8');
      setSelectedWeekdays([]);
      setInstructions('');
      setShowMoreOptions(false);
    }

    return () => {
      cancelled = true;
    };
  }, [visible, editingSchedule, initialMedicationId]);

  const selectedMed = useMemo(
    () =>
      activeMeds.find((m) => m.id === selectedMedId) ??
      medications.find((m) => m.id === selectedMedId) ??
      null,
    [activeMeds, medications, selectedMedId],
  );

  const filteredMeds = useMemo(() => {
    const q = medSearchQuery.trim().toLowerCase();
    if (!q) return activeMeds;
    return activeMeds.filter((m) => {
      const hay = `${m.name} ${m.genericName ?? ''} ${m.strength ?? ''} ${m.dosageForm}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeMeds, medSearchQuery]);

  const doseUnitOptions = useMemo(
    () => getDoseUnitOptions(selectedMed?.dosageForm, selectedMed?.stockUnit),
    [selectedMed?.dosageForm, selectedMed?.stockUnit],
  );

  const parsedDoseNumber = useMemo(() => {
    const trimmed = doseAmountInput.trim();
    if (!trimmed) return null;
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val <= 0) return null;
    return Number(val.toFixed(2));
  }, [doseAmountInput]);

  const handleSelectMedicine = (medId: string): void => {
    const med = activeMeds.find((m) => m.id === medId);
    if (!med) return;
    setSelectedMedId(med.id);
    setSelectingMed(false);
    setMedSearchQuery('');
    // Clear dependent dose-unit values whenever medicine changes
    setDoseAmountInput('');
    setDoseUnit(adaptDefaultDoseUnit(med.dosageForm, med.stockUnit));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.selectedMedId;
      delete next.doseAmountInput;
      return next;
    });
    setApiError(null);
  };

  const handleSelectBasicFrequency = (opt: (typeof BASIC_FREQUENCY_OPTIONS)[number]): void => {
    setFrequencyCode(opt.code);
    setApiError(null);
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith('time_') || k === 'times' || k === 'intervalHours' || k === 'weekdays') {
          delete next[k];
        }
      });
      return next;
    });
    if (opt.slotCount !== null) {
      setTimeSlots((prev) => resizeTimeSlots(prev, opt.slotCount!));
    } else {
      setTimeSlots((prev) => (prev.length > 0 ? prev : ['']));
    }
  };

  const handleSelectAdvancedFrequency = (code: AdvancedFrequencyCode): void => {
    setFrequencyCode(code);
    setApiError(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.intervalHours;
      delete next.weekdays;
      delete next.times;
      return next;
    });
    if (code === 'EVERY_X_HOURS') {
      setTimeSlots((prev) => resizeTimeSlots(prev, 1));
    } else {
      setTimeSlots((prev) => (prev.length > 0 ? prev : ['']));
    }
  };

  const handleTimeChange = (idx: number, val: string): void => {
    setApiError(null);
    setTimeSlots((prev) => prev.map((t, i) => (i === idx ? val : t)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`time_${idx}`];
      delete next.times;
      return next;
    });
  };

  const handleAddCustomTime = (): void => {
    if (timeSlots.length >= MAX_CUSTOM_TIMES) return;
    setTimeSlots((prev) => [...prev, '']);
  };

  const handleRemoveTimeSlot = (idx: number): void => {
    if (timeSlots.length <= 1) return;
    setTimeSlots((prev) => prev.filter((_, i) => i !== idx));
    setErrors((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith('time_') || k === 'times') {
          delete next[k];
        }
      });
      return next;
    });
  };

  const handleToggleWeekday = (dayVal: number): void => {
    setSelectedWeekdays((prev) =>
      prev.includes(dayVal)
        ? prev.filter((d) => d !== dayVal)
        : [...prev, dayVal].sort((a, b) => a - b),
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next.weekdays;
      return next;
    });
  };

  const handleEnableNotifications = async (): Promise<void> => {
    if (requestingNotif) return;
    setRequestingNotif(true);
    try {
      const next = await requestDeviceNotificationPermission();
      setNotifState(next);
      setRemindersOn(next.supported && next.granted);
    } finally {
      setRequestingNotif(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    setApiError(null);

    const nextErrors: Record<string, string> = {};
    if (!selectedMed) {
      nextErrors.selectedMedId = 'Select an active medicine from My Medicines.';
    }

    if (doseAmountInput.trim().length === 0) {
      nextErrors.doseAmountInput = 'Enter the prescribed dose amount.';
    } else if (parsedDoseNumber === null) {
      nextErrors.doseAmountInput = 'Dose amount must be greater than 0.';
    }

    timeSlots.forEach((slot, idx) => {
      if (slot.trim().length === 0) {
        nextErrors[`time_${idx}`] = 'Select a reminder time.';
      }
    });

    if (
      timeSlots.every((t) => t.trim().length > 0) &&
      findDuplicateTimes(timeSlots)
    ) {
      nextErrors.times = 'Choose distinct reminder times so duplicate doses are not created.';
    }

    let parsedInterval: number | null = null;
    if (frequencyCode === 'EVERY_X_HOURS') {
      const num = Number(intervalHoursInput.trim());
      if (
        intervalHoursInput.trim().length === 0 ||
        !Number.isInteger(num) ||
        num < 1 ||
        num > 24
      ) {
        nextErrors.intervalHours = 'Enter a whole number between 1 and 24 hours.';
      } else {
        parsedInterval = num;
      }
    }

    if (frequencyCode === 'SELECTED_WEEKDAYS' && selectedWeekdays.length === 0) {
      nextErrors.weekdays = 'Select at least one weekday.';
    }

    const cleanStart = startDate.trim();
    if (!cleanStart) {
      nextErrors.startDate = 'Choose a start date.';
    }
    const cleanEnd = showEndDate ? endDate.trim() : '';
    if (cleanEnd && cleanStart && cleanEnd < cleanStart) {
      nextErrors.endDate = 'End date cannot be earlier than start date.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !selectedMed || parsedDoseNumber === null) {
      return;
    }

    const normalizedTimes = [
      ...new Set(timeSlots.map((t) => normalizeTimeTo24Hour(t))),
    ].sort();
    const effectiveReminders = notifState.supported && notifState.granted ? remindersOn : false;

    setSaving(true);
    try {
      const saved = editingSchedule
        ? await updateScheduleById(editingSchedule.id, {
            doseAmount: parsedDoseNumber,
            doseUnit,
            frequency: frequencyCode,
            intervalHours: parsedInterval,
            weekdays: frequencyCode === 'SELECTED_WEEKDAYS' ? selectedWeekdays : [],
            scheduledTimes: normalizedTimes,
            startDateYmd: cleanStart,
            endDateYmd: cleanEnd || null,
            instructions: instructions.trim() || null,
            remindersEnabled: effectiveReminders,
          })
        : await createSchedule({
            patientMedicationId: selectedMed.id,
            doseAmount: parsedDoseNumber,
            doseUnit,
            frequency: frequencyCode,
            intervalHours: parsedInterval,
            weekdays: frequencyCode === 'SELECTED_WEEKDAYS' ? selectedWeekdays : [],
            scheduledTimes: normalizedTimes,
            startDateYmd: cleanStart,
            endDateYmd: cleanEnd || null,
            instructions: instructions.trim() || null,
            remindersEnabled: effectiveReminders,
          });

      if (saved) {
        onSaved(saved, Boolean(editingSchedule));
      }
      onClose();
    } catch (err) {
      setApiError(
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : 'Unable to save schedule. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const canModifyMedicine = !lockMedicineSelection && !editingSchedule && activeMeds.length > 0;
  const isSaveDisabled =
    saving ||
    medsLoading ||
    activeMeds.length === 0 ||
    !selectedMed ||
    parsedDoseNumber === null ||
    timeSlots.some((t) => t.trim().length === 0);

  const moreOptionsSummary = useMemo(() => {
    const tags: string[] = [];
    if (isAdvancedCode(frequencyCode)) {
      tags.push(
        formatRecurrenceSummary({
          frequency: frequencyCode,
          intervalHours: Number(intervalHoursInput) || 8,
          weekdays: selectedWeekdays,
        }),
      );
    }
    if (instructions.trim().length > 0) {
      tags.push('Notes');
    }
    if (notifState.supported && notifState.granted && remindersOn) {
      tags.push('Alerts on');
    }
    return tags.length > 0 ? tags.join(' · ') : 'Optional';
  }, [
    frequencyCode,
    intervalHoursInput,
    selectedWeekdays,
    instructions,
    notifState.supported,
    notifState.granted,
    remindersOn,
  ]);

  return (
    <BottomSheet
      visible={visible}
      title={editingSchedule ? 'Edit Dose Schedule' : 'Create Dose Schedule'}
      subtitle="Select a medicine, enter each dose, and choose your reminder times."
      iconName="clock"
      onClose={onClose}
      onSubmit={activeMeds.length === 0 ? undefined : () => void handleSave()}
      submitLabel={editingSchedule ? 'Save Changes' : 'Save Schedule'}
      cancelLabel="Cancel"
      submitDisabled={isSaveDisabled}
      submitLoading={saving}
      hideFooter={activeMeds.length === 0 && !medsLoading}
    >
      {medsLoading ? (
        <View className="items-center rounded-card border border-border bg-background p-[18px]">
          <Text className="mt-2 text-center text-[15px] font-bold text-main">
            Loading My Medicines...
          </Text>
        </View>
      ) : activeMeds.length === 0 ? (
        <View className="items-center rounded-card border border-border bg-background p-[18px]">
          <Feather name="package" size={26} color={CAREDOSE_EXTENDED_COLORS.primary} />
          <Text className="mt-2 text-center text-[15px] font-bold text-main">
            No active medicines in My Medicines
          </Text>
          <Text className="mt-1 text-center text-xs leading-[17px] text-[#5A706B]">
            Add a medicine to your personal care list before creating a dose schedule.
          </Text>
          <View className="mt-3.5 w-full">
            <PrimaryButton
              fullWidth
              label="Go to My Medicines"
              onPress={() => {
                onClose();
                router.push('/medicines');
              }}
            />
          </View>
        </View>
      ) : (
        <View>
          {/* Section 1 — Which medicine? */}
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <Text className="mb-2.5 text-sm font-bold text-main">Which medicine?</Text>

            {selectedMed && !selectingMed ? (
              <View className="flex-row items-center gap-3 rounded-field border border-[#C5E8D8] bg-mint p-2.5">
                <MedicineFormThumbnail
                  size="card"
                  dosageForm={selectedMed.dosageForm}
                />
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 min-w-0 text-sm font-bold text-main" numberOfLines={2}>
                      {selectedMed.name}
                    </Text>
                    {canModifyMedicine ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Change medicine"
                        onPress={() => setSelectingMed(true)}
                        className="shrink-0 rounded-full border border-border bg-white px-2.5 py-1"
                      >
                        <Text className="text-[11px] font-semibold text-primary">Change</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={2}>
                    {[selectedMed.strength, selectedMed.dosageForm]
                      .filter(Boolean)
                      .join(' · ') || 'Dosage form N/A'}
                  </Text>
                  <Text className="mt-0.5 text-[11px] font-semibold text-primary-dark" numberOfLines={1}>
                    Current stock: {formatStockWithUnit(selectedMed.stockRemaining, selectedMed.stockUnit)}
                  </Text>
                </View>
              </View>
            ) : (
              <View>
                <SearchInput
                  value={medSearchQuery}
                  onChangeText={setMedSearchQuery}
                  placeholder="Search My Medicines by name, strength, or form"
                />
                <View className="mt-2 gap-1.5">
                  {filteredMeds.length === 0 ? (
                    <Text className="py-2.5 text-center text-xs text-[#5A706B]">
                      No active medicine matches &ldquo;{medSearchQuery.trim()}&rdquo;.
                    </Text>
                  ) : (
                    filteredMeds.map((med) => {
                      const active = med.id === selectedMedId;
                      return (
                        <Pressable
                          key={med.id}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${med.name}`}
                          onPress={() => handleSelectMedicine(med.id)}
                          className={`min-h-[44px] flex-row items-center gap-2.5 rounded-field border p-2.5 ${
                            active ? 'border-primary bg-mint' : 'border-border bg-background'
                          }`}
                        >
                          <MedicineFormThumbnail
                            size="card"
                            dosageForm={med.dosageForm}
                          />
                          <View className="flex-1 min-w-0">
                            <Text className="text-[13px] font-bold text-main" numberOfLines={1}>
                              {med.name}
                            </Text>
                            <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={1}>
                              {[med.strength, med.dosageForm].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <Feather
                            name={active ? 'check-circle' : 'chevron-right'}
                            size={17}
                            color={CAREDOSE_EXTENDED_COLORS.primary}
                          />
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
            )}
            {errors.selectedMedId ? (
              <Text className="mt-0.5 mb-2 text-[11px] font-semibold text-error">
                {errors.selectedMedId}
              </Text>
            ) : null}
          </View>

          {/* Section 2 — How much each time? */}
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <View className="mb-2.5 flex-row items-center justify-between gap-2">
              <Text className="flex-1 min-w-0 shrink text-sm font-bold text-main">
                How much each time?
              </Text>
              <View className="shrink-0 rounded-full bg-mint px-2.5 py-0.5">
                <Text className="text-[11px] font-bold text-primary-dark">{doseUnit}</Text>
              </View>
            </View>

            <FormField
              label={`Prescribed dose (${doseUnit})`}
              value={doseAmountInput}
              onChangeText={(txt) => {
                setDoseAmountInput(txt);
                setApiError(null);
                if (errors.doseAmountInput) {
                  setErrors((e) => ({ ...e, doseAmountInput: '' }));
                }
              }}
              placeholder={doseUnit === 'mL' ? 'e.g. 5' : 'e.g. 1'}
              keyboardType="decimal-pad"
              required
              errorMessage={errors.doseAmountInput || undefined}
            />

            {doseUnitOptions.length > 1 ? (
              <View className="mb-2">
                <Text className="mb-1.5 text-xs font-semibold text-[#5A706B]">Dose unit</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {doseUnitOptions.map((opt) => {
                    const active = doseUnit === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        accessibilityRole="button"
                        onPress={() => setDoseUnit(opt.value)}
                        className={`rounded-full border px-2.5 py-1.5 ${
                          active ? 'border-primary bg-primary' : 'border-border bg-background'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            active ? 'text-white' : 'text-main'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {parsedDoseNumber !== null ? (
              <View className="flex-row items-center gap-1.5 rounded-lg border border-[#C5E8D8] bg-mint px-2.5 py-2">
                <Feather name="check-circle" size={13} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text className="flex-1 min-w-0 text-xs font-bold text-primary-dark">
                  Each dose: {formatDoseAmountDisplay(parsedDoseNumber, doseUnit)}
                </Text>
              </View>
            ) : (
              <Text className="text-[11px] leading-4 text-[#5A706B]">
                Enter the exact amount prescribed by your doctor. Creating a schedule does not change current stock.
              </Text>
            )}
          </View>

          {/* Section 3 — When should it be taken? + Start / Optional End Dates */}
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <Text className="mb-2.5 text-sm font-bold text-main">When should it be taken?</Text>

            <View className="mb-2.5 flex-row flex-wrap gap-2">
              {BASIC_FREQUENCY_OPTIONS.map((opt) => {
                const active = frequencyCode === opt.code;
                return (
                  <Pressable
                    key={opt.code}
                    accessibilityRole="button"
                    accessibilityLabel={opt.label}
                    onPress={() => handleSelectBasicFrequency(opt)}
                    className={`min-h-[40px] min-w-[45%] flex-grow items-center justify-center rounded-field border px-2.5 py-2.5 ${
                      active ? 'border-primary bg-mint' : 'border-border bg-background'
                    }`}
                  >
                    <Text
                      className={`text-center text-xs ${
                        active ? 'font-bold text-primary-dark' : 'font-semibold text-main'
                      }`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {isAdvancedCode(frequencyCode) ? (
              <View className="mb-2.5 flex-row items-center gap-1.5 rounded-lg border border-[#C5E8D8] bg-mint px-2.5 py-2">
                <Feather name="repeat" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                <Text className="flex-1 min-w-0 text-xs font-semibold text-primary-dark">
                  Advanced pattern:{' '}
                  {formatRecurrenceSummary({
                    frequency: frequencyCode,
                    intervalHours: Number(intervalHoursInput) || 8,
                    weekdays: selectedWeekdays,
                  })}
                </Text>
              </View>
            ) : null}

            <View className="gap-0.5">
              {timeSlots.map((slot, idx) => (
                <View key={`time-slot-${idx}`} className="flex-row items-center gap-2">
                  <View className="flex-1 min-w-0">
                    <TimeField
                      label={getTimeFieldLabel(frequencyCode, idx, timeSlots.length)}
                      value={slot}
                      placeholder="Select time"
                      onChangeTime={(val) => handleTimeChange(idx, val)}
                      required
                      errorMessage={errors[`time_${idx}`] || undefined}
                    />
                  </View>
                  {(frequencyCode === 'CUSTOM_TIMES' ||
                    frequencyCode === 'ALTERNATE_DAYS' ||
                    frequencyCode === 'SELECTED_WEEKDAYS' ||
                    frequencyCode === 'WEEKLY') &&
                  timeSlots.length > 1 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove time ${idx + 1}`}
                      onPress={() => handleRemoveTimeSlot(idx)}
                      className="mt-3.5 h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#FDECEC]"
                    >
                      <Feather name="trash-2" size={15} color={CAREDOSE_EXTENDED_COLORS.error} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>

            {errors.times ? (
              <Text className="mt-0.5 mb-2 text-[11px] font-semibold text-error">
                {errors.times}
              </Text>
            ) : null}

            {(frequencyCode === 'CUSTOM_TIMES' ||
              frequencyCode === 'ALTERNATE_DAYS' ||
              frequencyCode === 'SELECTED_WEEKDAYS' ||
              frequencyCode === 'WEEKLY') &&
            timeSlots.length < MAX_CUSTOM_TIMES ? (
              <Pressable
                accessibilityRole="button"
                onPress={handleAddCustomTime}
                className="mb-2.5 flex-row items-center gap-1.5 self-start rounded-full border border-[#C5E8D8] bg-mint px-2.5 py-1.5"
              >
                <Feather name="plus" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text className="text-xs font-semibold text-primary-dark">Add another time</Text>
              </Pressable>
            ) : null}

            <View className="mt-1">
              <DateField
                label="Start date"
                value={startDate}
                onChangeDate={(ymd) => {
                  setStartDate(ymd);
                  setApiError(null);
                  if (errors.startDate || errors.endDate) {
                    setErrors((e) => ({ ...e, startDate: '', endDate: '' }));
                  }
                }}
                required
                errorMessage={errors.startDate || undefined}
              />

              {!showEndDate ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowEndDate(true)}
                  className="flex-row items-center gap-1.5 self-start py-1"
                >
                  <Feather name="calendar" size={13} color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text className="text-xs font-semibold text-primary">
                    Add end date (optional)
                  </Text>
                </Pressable>
              ) : (
                <View>
                  <DateField
                    label="End date (optional)"
                    value={endDate}
                    onChangeDate={(ymd) => {
                      setEndDate(ymd);
                      setApiError(null);
                      if (errors.endDate) {
                        setErrors((e) => ({ ...e, endDate: '' }));
                      }
                      if (!ymd) {
                        setShowEndDate(false);
                      }
                    }}
                    placeholder="No end date"
                    allowClear
                    errorMessage={errors.endDate || undefined}
                  />
                </View>
              )}
            </View>
          </View>

          {/* Expandable More options */}
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowMoreOptions((prev) => !prev)}
              className="min-h-[36px] flex-row items-center justify-between gap-2.5"
            >
              <View className="flex-1 min-w-0 flex-row items-center gap-2">
                <Feather
                  name={showMoreOptions ? 'chevron-up' : 'sliders'}
                  size={15}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
                <Text className="shrink text-[13px] font-semibold text-primary-dark">
                  More options
                </Text>
              </View>
              <Text
                className="max-w-[45%] shrink-0 text-right text-[11px] font-semibold text-[#7D928D]"
                numberOfLines={1}
              >
                {showMoreOptions ? 'Hide' : moreOptionsSummary}
              </Text>
            </Pressable>

            {showMoreOptions ? (
              <View className="mt-2.5 border-t border-border pt-2.5">
                <Text className="mb-1.5 text-xs font-semibold text-[#5A706B]">
                  Advanced recurrence
                </Text>
                <View className="flex-row flex-wrap gap-1.5">
                  {ADVANCED_FREQUENCY_OPTIONS.map((opt) => {
                    const active = frequencyCode === opt.code;
                    return (
                      <Pressable
                        key={opt.code}
                        accessibilityRole="button"
                        onPress={() => {
                          if (active) {
                            handleSelectBasicFrequency(BASIC_FREQUENCY_OPTIONS[0]);
                          } else {
                            handleSelectAdvancedFrequency(opt.code);
                          }
                        }}
                        className={`rounded-full border px-2.5 py-1.5 ${
                          active ? 'border-primary bg-primary' : 'border-border bg-background'
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            active ? 'text-white' : 'text-main'
                          }`}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {frequencyCode === 'EVERY_X_HOURS' ? (
                  <View className="mt-2.5">
                    <FormField
                      label="Hours between doses"
                      value={intervalHoursInput}
                      onChangeText={(txt) => {
                        setIntervalHoursInput(txt);
                        if (errors.intervalHours) {
                          setErrors((e) => ({ ...e, intervalHours: '' }));
                        }
                      }}
                      placeholder="e.g. 8"
                      keyboardType="number-pad"
                      required
                      errorMessage={errors.intervalHours || undefined}
                      helperText="Generates evenly spaced non-duplicate times starting from your First dose time."
                    />
                  </View>
                ) : null}

                {frequencyCode === 'SELECTED_WEEKDAYS' ? (
                  <View className="mt-2.5">
                    <Text className="mb-1.5 text-xs font-semibold text-[#5A706B]">
                      Choose days of the week
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const selected = selectedWeekdays.includes(day.value);
                        return (
                          <Pressable
                            key={day.value}
                            accessibilityRole="button"
                            accessibilityLabel={day.label}
                            onPress={() => handleToggleWeekday(day.value)}
                            className={`rounded-[10px] border px-2.5 py-2 ${
                              selected
                                ? 'border-primary bg-primary'
                                : 'border-border bg-background'
                            }`}
                          >
                            <Text
                              className={`text-xs font-semibold ${
                                selected ? 'text-white' : 'text-main'
                              }`}
                            >
                              {day.short}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    {errors.weekdays ? (
                      <Text className="mt-0.5 mb-2 text-[11px] font-semibold text-error">
                        {errors.weekdays}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View className="my-3 h-px bg-border" />

                <FormField
                  label="Instructions (optional)"
                  value={instructions}
                  onChangeText={setInstructions}
                  placeholder="e.g. After breakfast"
                />

                <View className="mt-0.5">
                  {notifState.supported && notifState.granted ? (
                    <ToggleField
                      label="Dose reminder alerts"
                      description="Alerts never mark doses Taken automatically."
                      value={remindersOn}
                      onValueChange={setRemindersOn}
                    />
                  ) : notifState.supported ? (
                    <View className="flex-row items-center gap-2.5 rounded-field border border-border bg-background p-2.5">
                      <View className="flex-1 min-w-0">
                        <Text className="text-xs font-bold text-main">
                          Dose reminder alerts are off
                        </Text>
                        <Text className="text-[11px] leading-4 text-[#5A706B]">
                          {notifState.statusText}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        disabled={requestingNotif}
                        onPress={() => void handleEnableNotifications()}
                        className="shrink-0 rounded-full bg-primary px-2.5 py-1.5"
                      >
                        <Text className="text-[11px] font-bold text-white">
                          {requestingNotif ? 'Checking...' : 'Allow'}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View className="flex-row items-center gap-2.5 rounded-field border border-border bg-background p-2.5">
                      <Feather
                        name="bell-off"
                        size={14}
                        color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                      />
                      <Text className="flex-1 text-[11px] leading-4 text-[#5A706B]">
                        {notifState.statusText}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>

          {apiError ? (
            <View className="mb-2 flex-row items-center gap-2 rounded-lg border border-[#F2C6C6] bg-[#FDECEC] p-2.5">
              <Feather name="alert-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.error} />
              <Text className="flex-1 text-xs font-semibold text-error">{apiError}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
