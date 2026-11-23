import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DateField,
  FormCol,
  FormField,
  FormRow,
  ScreenContainer,
  SelectField,
  SuccessToast,
  TimeField,
  validateRequiredFields,
} from '../src/components';
import { useResponsiveLayout } from '../src/theme/responsive';

interface GlucoseEntry {
  id: string;
  value: number;
  unit: 'mg/dL' | 'mmol/L';
  context: string;
  date: string;
  time: string;
}

const INITIAL_READINGS: GlucoseEntry[] = [
  { id: 'r1', value: 106, unit: 'mg/dL', context: 'Fasting', date: '2026-11-21', time: '07:30 AM' },
  { id: 'r2', value: 101, unit: 'mg/dL', context: 'Fasting', date: '2026-11-20', time: '07:40 AM' },
  { id: 'r3', value: 108, unit: 'mg/dL', context: 'Before meal', date: '2026-11-19', time: '12:45 PM' },
  { id: 'r4', value: 99, unit: 'mg/dL', context: 'Fasting', date: '2026-11-18', time: '07:20 AM' },
  { id: 'r5', value: 112, unit: 'mg/dL', context: 'After meal', date: '2026-11-17', time: '02:30 PM' },
  { id: 'r6', value: 104, unit: 'mg/dL', context: 'Fasting', date: '2026-11-16', time: '07:35 AM' },
  { id: 'r7', value: 110, unit: 'mg/dL', context: 'Fasting', date: '2026-11-15', time: '07:50 AM' },
];

export default function HealthLogScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [readings, setReadings] = useState<GlucoseEntry[]>(INITIAL_READINGS);
  const [logOpen, setLogOpen] = useState(false);
  const [val, setVal] = useState('');
  const [unit, setUnit] = useState<'mg/dL' | 'mmol/L'>('mg/dL');
  const [context, setContext] = useState('Fasting');
  const [date, setDate] = useState('2026-11-21');
  const [time, setTime] = useState('07:30 AM');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const handleSaveReading = (): void => {
    const errs = validateRequiredFields(
      { val, date, time },
      { val: 'Glucose value', date: 'Date', time: 'Time' },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    const numeric = Number(val);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setErrors({ val: 'Glucose value must be a positive number' });
      return;
    }
    setReadings((prev) => [
      {
        id: `r-${Date.now()}`,
        value: numeric,
        unit,
        context,
        date,
        time,
      },
      ...prev,
    ]);
    setLogOpen(false);
    setVal('');
    setToast('Glucose reading recorded.');
  };

  const chartPoints = readings.slice(0, 7).reverse();
  const maxVal = Math.max(...chartPoints.map((p) => p.value), 120);

  return (
    <ScreenContainer
      eyebrow="BLOOD GLUCOSE"
      title="Health Log"
      onBack={() => router.push('/profile')}
      primaryAction={{
        label: 'Log Reading',
        iconName: 'plus',
        onPress: () => setLogOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      {/* 7-Day Blood Glucose Bar Chart */}
      <View
        className="bg-white rounded-card border border-border mb-4"
        style={{ padding: layout.cardPadding }}
      >
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2.5">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Last 7 glucose readings
          </Text>
          <Text className="text-[11px] font-semibold text-[#5A706B] shrink-0">{unit}</Text>
        </View>
        <View className="flex-row items-end justify-between h-[124px] pt-3">
          {chartPoints.map((pt) => {
            const barHeight = Math.max(18, Math.round((pt.value / maxVal) * 88));
            return (
              <View key={pt.id} className="flex-1 min-w-0 px-[1px] items-center">
                <Text className="text-[10px] font-semibold text-[#5A706B] mb-1">
                  {pt.value}
                </Text>
                <View
                  className="rounded-[6px] bg-primary"
                  style={{
                    height: barHeight,
                    width: layout.isCompact ? 14 : 18,
                  }}
                />
                <Text className="mt-1.5 text-[10px] text-[#5A706B]" numberOfLines={1}>
                  {pt.date.slice(5)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text className="text-[15px] font-semibold text-main mb-2.5">
        Glucose readings ({readings.length})
      </Text>
      {readings.map((r) => (
        <View
          key={r.id}
          className="flex-row items-center justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mb-2.5"
        >
          <View className="flex-1 min-w-0">
            <Text className="text-[15px] font-bold text-main">
              {r.value} {r.unit}
            </Text>
            <Text className="mt-0.5 text-[12px] text-[#5A706B]">
              {r.date} · {r.time}
            </Text>
          </View>
          <View className="bg-mint px-2.5 py-1 rounded-full">
            <Text className="text-[11px] font-semibold text-primary">{r.context}</Text>
          </View>
        </View>
      ))}

      <BottomSheet
        visible={logOpen}
        title="Log Glucose Reading"
        iconName="activity"
        onClose={() => setLogOpen(false)}
        onSubmit={handleSaveReading}
        submitLabel="Save reading"
      >
        <FormRow>
          <FormCol>
            <FormField
              label="Glucose value"
              value={val}
              onChangeText={setVal}
              placeholder="e.g. 106"
              keyboardType="decimal-pad"
              required
              errorMessage={errors.val}
            />
          </FormCol>
          <FormCol>
            <SelectField
              label="Unit"
              value={unit}
              options={[
                { label: 'mg/dL', value: 'mg/dL' },
                { label: 'mmol/L', value: 'mmol/L' },
              ]}
              onSelect={(v) => setUnit(v as 'mg/dL' | 'mmol/L')}
              required
            />
          </FormCol>
        </FormRow>
        <SelectField
          label="Context"
          value={context}
          options={[
            { label: 'Fasting', value: 'Fasting' },
            { label: 'Before meal', value: 'Before meal' },
            { label: 'After meal', value: 'After meal' },
            { label: 'Other', value: 'Other' },
          ]}
          onSelect={setContext}
          required
        />
        <FormRow>
          <FormCol>
            <DateField
              label="Date"
              value={date}
              onChangeDate={setDate}
              required
              errorMessage={errors.date}
            />
          </FormCol>
          <FormCol>
            <TimeField
              label="Time"
              value={time}
              onChangeTime={setTime}
              required
              errorMessage={errors.time}
            />
          </FormCol>
        </FormRow>
        <FormField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Add note"
        />
      </BottomSheet>
    </ScreenContainer>
  );
}
