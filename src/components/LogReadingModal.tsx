import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type {
  GlucoseUnitDto,
  HealthReadingItemDto,
  ReadingContextDto,
} from '../api/health-logs';
import { ApiRequestError } from '../api/config';
import { useHealthLogs } from '../features/health/HealthLogsContext';
import {
  formatGlucoseUnitLabel,
  GLUCOSE_UNIT_OPTIONS,
  HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER,
  READING_CONTEXT_OPTIONS,
  validateHealthReadingDraft,
} from '../features/health/health-helpers';
import { useUserPreferences } from '../features/profile/UserPreferencesContext';
import { getTodayLocalYmd } from '../features/schedule/dose-rules';
import {
  DateField,
  FormCol,
  FormField,
  FormRow,
  SelectField,
  TimeField,
  formatTimeString,
} from './FormFields';
import { BottomSheet } from './Overlays';

export interface LogReadingModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: (saved: HealthReadingItemDto) => void;
  defaultContext?: ReadingContextDto;
}

export function LogReadingModal({
  visible,
  onClose,
  onSaved,
  defaultContext = 'FASTING',
}: LogReadingModalProps): React.JSX.Element {
  const { preferences } = useUserPreferences();
  const { logHealthReading, saving } = useHealthLogs();

  const [value, setValue] = useState('');
  const [unit, setUnit] = useState<GlucoseUnitDto>(preferences.glucoseUnit);
  const [context, setContext] = useState<ReadingContextDto>(defaultContext);
  const [date, setDate] = useState(getTodayLocalYmd());
  const [time, setTime] = useState(formatTimeString(new Date()));
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    setUnit(preferences.glucoseUnit);
    setContext(defaultContext);
    setDate(getTodayLocalYmd());
    setTime(formatTimeString(new Date()));
    setNote('');
    setErrors({});
    setSubmitError(null);
  }, [visible, preferences.glucoseUnit, defaultContext]);

  const handleSubmit = async (): Promise<void> => {
    setSubmitError(null);
    const validation = validateHealthReadingDraft({
      value,
      unit,
      context,
      date,
      time,
      note,
    });

    if (!validation.valid || !validation.parsed) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    try {
      const saved = await logHealthReading(validation.parsed);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setSubmitError(err.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Unable to save reading. Please try again.');
      }
    }
  };

  const activeUnitLabel = formatGlucoseUnitLabel(unit);

  return (
    <BottomSheet
      visible={visible}
      title="Log Reading"
      subtitle="Saved exactly as entered for your personal health log"
      onClose={onClose}
      onSubmit={() => void handleSubmit()}
      submitLabel="Save reading"
      submitLoading={saving}
      submitDisabled={saving}
    >
      {submitError ? (
        <View className="mb-3 rounded-field border border-[#E8B4B0] bg-[#FDECEC] px-3 py-2.5">
          <Text className="text-xs font-medium text-error">{submitError}</Text>
        </View>
      ) : null}

      <FormField
        label={`Reading value (${activeUnitLabel})`}
        value={value}
        onChangeText={(next) => {
          setValue(next);
          if (errors.value) {
            setErrors((prev) => ({ ...prev, value: '' }));
          }
        }}
        placeholder={unit === 'MMOL_L' ? 'e.g. 5.9' : 'e.g. 106'}
        keyboardType="decimal-pad"
        required
        errorMessage={errors.value || undefined}
      />

      <FormRow>
        <FormCol>
          <SelectField
            label="Unit"
            value={unit}
            options={GLUCOSE_UNIT_OPTIONS.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            onSelect={(next) => setUnit(next as GlucoseUnitDto)}
            required
          />
        </FormCol>
        <FormCol>
          <SelectField
            label="Context"
            value={context}
            options={READING_CONTEXT_OPTIONS.map((opt) => ({
              label: opt.label,
              value: opt.value,
            }))}
            onSelect={(next) => setContext(next as ReadingContextDto)}
            required
          />
        </FormCol>
      </FormRow>

      <FormRow>
        <FormCol>
          <DateField
            label="Date"
            value={date}
            onChangeDate={(next) => {
              setDate(next);
              if (errors.date) {
                setErrors((prev) => ({ ...prev, date: '' }));
              }
            }}
            required
            errorMessage={errors.date || undefined}
          />
        </FormCol>
        <FormCol>
          <TimeField
            label="Time"
            value={time}
            onChangeTime={(next) => {
              setTime(next);
              if (errors.time) {
                setErrors((prev) => ({ ...prev, time: '' }));
              }
            }}
            required
            errorMessage={errors.time || undefined}
          />
        </FormCol>
      </FormRow>

      <FormField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Before morning walk"
        multiline
        errorMessage={errors.note || undefined}
      />

      <View className="mt-1 rounded-field border border-border bg-background px-3 py-2.5">
        <Text className="text-[11px] leading-[16px] text-[#5A706B]">
          {HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER}
        </Text>
      </View>
    </BottomSheet>
  );
}
