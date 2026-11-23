import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export function validateRequiredFields(
  values: Record<string, string | number | undefined | null>,
  requiredLabels: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, label] of Object.entries(requiredLabels)) {
    const raw = values[key];
    const str = raw === undefined || raw === null ? '' : String(raw).trim();
    if (str.length === 0) {
      errors[key] = `${label} is required`;
    }
  }
  return errors;
}

export function parseIsoDateString(value?: string): Date {
  if (value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]) - 1;
      const day = Number(m[3]);
      const d = new Date(year, month, day, 12, 0, 0);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
  }
  return new Date();
}

export function formatIsoDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDisplayDate(value?: string): string {
  if (!value || !value.trim()) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return value.trim();
  const monthIdx = Number(m[2]) - 1;
  const day = Number(m[3]);
  const monthName = SHORT_MONTHS[monthIdx] ?? m[2];
  return `${day} ${monthName} ${m[1]}`;
}

export function parseTimeString(value?: string): Date {
  const base = new Date();
  base.setSeconds(0, 0);
  if (!value) {
    base.setHours(9, 0, 0, 0);
    return base;
  }
  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (m12) {
    let hour = Number(m12[1]);
    const min = Number(m12[2]);
    const period = m12[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    base.setHours(hour, min, 0, 0);
    return base;
  }
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (m24) {
    base.setHours(Number(m24[1]), Number(m24[2]), 0, 0);
    return base;
  }
  base.setHours(9, 0, 0, 0);
  return base;
}

export function formatTimeString(date: Date): string {
  const hours24 = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, '0');
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, '0')}:${mins} ${period}`;
}

export function FormRow({ children }: { children: React.ReactNode }): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View className={layout.stackTwoCol ? 'flex-col' : 'flex-row gap-2.5'}>
      {children}
    </View>
  );
}

export function FormCol({ children }: { children: React.ReactNode }): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View className={layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'}>
      {children}
    </View>
  );
}

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  required?: boolean;
  errorMessage?: string;
  helperText?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  required = false,
  errorMessage,
  helperText,
  keyboardType = 'default',
  multiline = false,
  editable = true,
}: FormFieldProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  const borderClass = errorMessage
    ? focused
      ? 'border-[1.5px] border-error'
      : 'border border-error'
    : focused
      ? 'border-[1.5px] border-primary'
      : 'border border-[#D6E3DC]';
  const editableClass = editable
    ? 'bg-background text-main'
    : 'bg-[#EEF2F0] text-[#5A706B]';

  return (
    <View className="mb-3">
      <Text className="text-[12px] font-semibold text-[#5A706B] mb-[5px]">
        {label}
        {required ? <Text className="text-error"> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CAREDOSE_EXTENDED_COLORS.mutedText}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : undefined}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={[
          'min-h-[42px] rounded-field px-3 py-2 text-[13px]',
          multiline ? 'min-h-[72px]' : '',
          borderClass,
          editableClass,
        ]
          .filter(Boolean)
          .join(' ')}
      />
      {errorMessage ? (
        <Text className="mt-1 text-[11px] text-error font-medium">{errorMessage}</Text>
      ) : helperText ? (
        <Text className="mt-1 text-[11px] text-[#5A706B]">{helperText}</Text>
      ) : null}
    </View>
  );
}

export interface SelectOption {
  label: string;
  value: string;
  subtitle?: string;
}

export interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onSelect: (value: string) => void;
  required?: boolean;
  errorMessage?: string;
}

export function SelectField({
  label,
  value,
  options,
  onSelect,
  required = false,
  errorMessage,
}: SelectFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const currentOption = options.find((o) => o.value === value);

  const triggerBorderClass = errorMessage
    ? open
      ? 'border-[1.5px] border-error'
      : 'border border-error'
    : open
      ? 'border-[1.5px] border-primary'
      : 'border border-[#D6E3DC]';

  return (
    <View className="mb-3">
      <Text className="text-[12px] font-semibold text-[#5A706B] mb-[5px]">
        {label}
        {required ? <Text className="text-error"> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${currentOption?.label ?? 'Select'}`}
        onPress={() => setOpen(true)}
        className={`min-h-[42px] bg-background rounded-field px-[11px] flex-row items-center justify-between ${triggerBorderClass}`}
      >
        <Text className="flex-1 text-[13px] font-medium text-main" numberOfLines={1}>
          {currentOption ? currentOption.label : 'Select'}
        </Text>
        <View className="w-6 h-6 rounded-[7px] bg-mint items-center justify-center ml-1.5">
          <Feather
            name="chevron-down"
            size={15}
            color={CAREDOSE_EXTENDED_COLORS.primary}
          />
        </View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-[rgba(18,38,35,0.52)] justify-center items-center px-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close selection"
            className="absolute inset-0"
            onPress={() => setOpen(false)}
          />
          <View className="w-full max-w-[380px] max-h-[70%] bg-white rounded-[20px] border border-border overflow-hidden shadow-lg">
            <View className="flex-row items-center justify-between bg-background px-4 py-3 border-b border-border">
              <Text className="text-[15px] font-bold text-main">{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close selection"
                onPress={() => setOpen(false)}
                className="w-[30px] h-[30px] rounded-[15px] bg-white border border-border items-center justify-center"
              >
                <Feather name="x" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
              </Pressable>
            </View>

            <ScrollView className="py-1.5" showsVerticalScrollIndicator={false}>
              {options.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isLast = idx === options.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="menuitem"
                    onPress={() => {
                      onSelect(opt.value);
                      setOpen(false);
                    }}
                    className={[
                      'min-h-[46px] px-4 py-2.5 flex-row items-center justify-between',
                      isSelected ? 'bg-mint' : '',
                      isLast ? '' : 'border-b border-border',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <View className="flex-1 pr-2.5">
                      <Text
                        className={
                          isSelected
                            ? 'text-[14px] font-bold text-primary-dark'
                            : 'text-[14px] font-medium text-main'
                        }
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                          {opt.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <View
                      className={`w-[22px] h-[22px] rounded-full border-[1.5px] items-center justify-center ${
                        isSelected
                          ? 'bg-primary border-primary'
                          : 'border-[#C5D6CE] bg-white'
                      }`}
                    >
                      {isSelected ? (
                        <Feather name="check" size={12} color="#FFFFFF" />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {errorMessage ? (
        <Text className="mt-1 text-[11px] text-error font-medium">{errorMessage}</Text>
      ) : null}
    </View>
  );
}

export interface DateFieldProps {
  label: string;
  value: string;
  onChangeDate: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  allowClear?: boolean;
  errorMessage?: string;
}

export function DateField({
  label,
  value,
  onChangeDate,
  placeholder = 'Select date',
  required = false,
  allowClear = false,
  errorMessage,
}: DateFieldProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => parseIsoDateString(value));

  const displayText = formatDisplayDate(value);

  const handleOpen = (): void => {
    setIosDraft(parseIsoDateString(value));
    setShowPicker(true);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) {
        onChangeDate(formatIsoDateString(selected));
      }
      return;
    }
    if (selected) {
      setIosDraft(selected);
    }
  };

  const adjustDays = (delta: number): void => {
    const base = parseIsoDateString(value);
    base.setDate(base.getDate() + delta);
    onChangeDate(formatIsoDateString(base));
  };

  return (
    <View className="mb-3">
      <Text className="text-[12px] font-semibold text-[#5A706B] mb-[5px]">
        {label}
        {required ? <Text className="text-error"> *</Text> : null}
      </Text>

      <View
        className={`min-h-[42px] bg-background border rounded-field px-[11px] flex-row items-center justify-between ${
          errorMessage ? 'border-error' : 'border-[#D6E3DC]'
        }`}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${displayText || placeholder}`}
          onPress={handleOpen}
          className="flex-1 flex-row items-center py-2"
        >
          <View className="mr-2">
            <Feather
              name="calendar"
              size={15}
              color={CAREDOSE_EXTENDED_COLORS.primary}
            />
          </View>
          <Text
            className={
              displayText
                ? 'flex-1 text-[13px] font-medium text-main'
                : 'flex-1 text-[13px] font-normal text-[#7D928D]'
            }
            numberOfLines={1}
          >
            {displayText || placeholder}
          </Text>
        </Pressable>

        {allowClear && value.trim().length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChangeDate('')}
            className="w-[26px] h-[26px] rounded-full bg-[#E5EFEA] items-center justify-center ml-1.5"
          >
            <Feather name="x" size={14} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
          </Pressable>
        ) : null}
      </View>

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseIsoDateString(value)}
          mode="date"
          display="default"
          onChange={handlePickerChange}
        />
      ) : null}

      {showPicker && Platform.OS !== 'android' ? (
        <Modal
          visible={showPicker}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}
        >
          <View className="flex-1 bg-[rgba(18,38,35,0.52)] justify-center items-center px-5">
            <Pressable className="absolute inset-0" onPress={() => setShowPicker(false)} />
            <View className="w-full max-w-[380px] max-h-[70%] bg-white rounded-[20px] border border-border overflow-hidden shadow-lg">
              <View className="flex-row items-center justify-between bg-background px-4 py-3 border-b border-border">
                <Text className="text-[15px] font-bold text-main">{label}</Text>
                <Pressable
                  onPress={() => setShowPicker(false)}
                  className="w-[30px] h-[30px] rounded-[15px] bg-white border border-border items-center justify-center"
                >
                  <Feather name="x" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
                </Pressable>
              </View>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="spinner"
                  onChange={handlePickerChange}
                />
              ) : (
                <View className="p-[18px] items-center">
                  <Text className="text-[18px] font-bold text-main mb-3.5">
                    {formatDisplayDate(value || formatIsoDateString(new Date()))}
                  </Text>
                  <View className="flex-row gap-2.5">
                    <Pressable
                      onPress={() => adjustDays(-1)}
                      className="px-3.5 py-2 rounded-[10px] bg-mint border border-[#C5E8D8]"
                    >
                      <Text className="text-[12px] font-semibold text-primary-dark">-1 Day</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChangeDate(formatIsoDateString(new Date()))}
                      className="px-3.5 py-2 rounded-[10px] bg-mint border border-[#C5E8D8]"
                    >
                      <Text className="text-[12px] font-semibold text-primary-dark">Today</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => adjustDays(1)}
                      className="px-3.5 py-2 rounded-[10px] bg-mint border border-[#C5E8D8]"
                    >
                      <Text className="text-[12px] font-semibold text-primary-dark">+1 Day</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View className="px-4 py-3 border-t border-border items-end">
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      onChangeDate(formatIsoDateString(iosDraft));
                    }
                    setShowPicker(false);
                  }}
                  className="px-5 py-[9px] rounded-[10px] bg-primary"
                >
                  <Text className="text-white text-[13px] font-semibold">Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {errorMessage ? (
        <Text className="mt-1 text-[11px] text-error font-medium">{errorMessage}</Text>
      ) : null}
    </View>
  );
}

export interface TimeFieldProps {
  label: string;
  value: string;
  onChangeTime: (timeStr: string) => void;
  placeholder?: string;
  required?: boolean;
  errorMessage?: string;
}

export function TimeField({
  label,
  value,
  onChangeTime,
  placeholder = 'Select time',
  required = false,
  errorMessage,
}: TimeFieldProps): React.JSX.Element {
  const [showPicker, setShowPicker] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => parseTimeString(value));

  const handleOpen = (): void => {
    setIosDraft(parseTimeString(value));
    setShowPicker(true);
  };

  const handlePickerChange = (event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) {
        onChangeTime(formatTimeString(selected));
      }
      return;
    }
    if (selected) {
      setIosDraft(selected);
    }
  };

  const adjustMinutes = (deltaMins: number): void => {
    const base = parseTimeString(value);
    base.setMinutes(base.getMinutes() + deltaMins);
    onChangeTime(formatTimeString(base));
  };

  return (
    <View className="mb-3">
      <Text className="text-[12px] font-semibold text-[#5A706B] mb-[5px]">
        {label}
        {required ? <Text className="text-error"> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={handleOpen}
        className={`min-h-[42px] bg-background border rounded-field px-[11px] flex-row items-center justify-between ${
          errorMessage ? 'border-error' : 'border-[#D6E3DC]'
        }`}
      >
        <View className="mr-2">
          <Feather
            name="clock"
            size={15}
            color={CAREDOSE_EXTENDED_COLORS.primary}
          />
        </View>
        <Text
          className={
            value
              ? 'flex-1 text-[13px] font-medium text-main'
              : 'flex-1 text-[13px] font-normal text-[#7D928D]'
          }
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
      </Pressable>

      {showPicker && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseTimeString(value)}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={handlePickerChange}
        />
      ) : null}

      {showPicker && Platform.OS !== 'android' ? (
        <Modal
          visible={showPicker}
          transparent
          statusBarTranslucent
          animationType="fade"
          onRequestClose={() => setShowPicker(false)}
        >
          <View className="flex-1 bg-[rgba(18,38,35,0.52)] justify-center items-center px-5">
            <Pressable className="absolute inset-0" onPress={() => setShowPicker(false)} />
            <View className="w-full max-w-[380px] max-h-[70%] bg-white rounded-[20px] border border-border overflow-hidden shadow-lg">
              <View className="flex-row items-center justify-between bg-background px-4 py-3 border-b border-border">
                <Text className="text-[15px] font-bold text-main">{label}</Text>
                <Pressable
                  onPress={() => setShowPicker(false)}
                  className="w-[30px] h-[30px] rounded-[15px] bg-white border border-border items-center justify-center"
                >
                  <Feather name="x" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
                </Pressable>
              </View>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={iosDraft}
                  mode="time"
                  is24Hour={false}
                  display="spinner"
                  onChange={handlePickerChange}
                />
              ) : (
                <View className="p-[18px] items-center">
                  <Text className="text-[18px] font-bold text-main mb-3.5">
                    {value || formatTimeString(iosDraft)}
                  </Text>
                  <View className="flex-row gap-2.5">
                    <Pressable
                      onPress={() => adjustMinutes(-30)}
                      className="px-3.5 py-2 rounded-[10px] bg-mint border border-[#C5E8D8]"
                    >
                      <Text className="text-[12px] font-semibold text-primary-dark">-30m</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => adjustMinutes(30)}
                      className="px-3.5 py-2 rounded-[10px] bg-mint border border-[#C5E8D8]"
                    >
                      <Text className="text-[12px] font-semibold text-primary-dark">+30m</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View className="px-4 py-3 border-t border-border items-end">
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios' || !value) {
                      onChangeTime(formatTimeString(iosDraft));
                    }
                    setShowPicker(false);
                  }}
                  className="px-5 py-[9px] rounded-[10px] bg-primary"
                >
                  <Text className="text-white text-[13px] font-semibold">Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {errorMessage ? (
        <Text className="mt-1 text-[11px] text-error font-medium">{errorMessage}</Text>
      ) : null}
    </View>
  );
}

export interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}

export function ToggleField({
  label,
  description,
  value,
  onValueChange,
}: ToggleFieldProps): React.JSX.Element {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between py-2">
      <View className="flex-1 pr-3">
        <Text className="text-[13px] font-semibold text-main">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[11px] text-[#5A706B]">{description}</Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: CAREDOSE_EXTENDED_COLORS.border,
          true: '#90CEBF',
        }}
        thumbColor={value ? CAREDOSE_EXTENDED_COLORS.primary : '#FFFFFF'}
      />
    </View>
  );
}
