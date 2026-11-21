import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
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
import {
  CAREDOSE_EXTENDED_COLORS,
  CAREDOSE_RADIUS,
  MIN_TOUCH_TARGET,
} from '../theme/tokens';

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
    <View style={layout.stackTwoCol ? styles.formRowStacked : styles.formRow}>
      {children}
    </View>
  );
}

export function FormCol({ children }: { children: React.ReactNode }): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View style={layout.stackTwoCol ? styles.formColStacked : styles.formCol}>
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

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CAREDOSE_EXTENDED_COLORS.mutedText}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline ? styles.multilineInput : null,
          focused ? styles.inputFocused : null,
          errorMessage ? styles.inputError : null,
          !editable ? styles.inputDisabled : null,
        ]}
      />
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
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

  return (
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${currentOption?.label ?? 'Select'}`}
        onPress={() => setOpen(true)}
        style={[
          styles.pickerTrigger,
          open ? styles.inputFocused : null,
          errorMessage ? styles.inputError : null,
        ]}
      >
        <Text style={styles.pickerValueText} numberOfLines={1}>
          {currentOption ? currentOption.label : 'Select'}
        </Text>
        <View style={styles.chevronBadge}>
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
        <View style={styles.pickerBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close selection"
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>{label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close selection"
                onPress={() => setOpen(false)}
                style={styles.pickerCloseBtn}
              >
                <Feather name="x" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
              </Pressable>
            </View>

            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
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
                    style={[
                      styles.pickerOption,
                      isSelected ? styles.pickerOptionActive : null,
                      isLast ? styles.pickerOptionLast : null,
                    ]}
                  >
                    <View style={styles.pickerOptionTextCol}>
                      <Text
                        style={[
                          styles.pickerOptionLabel,
                          isSelected ? styles.pickerOptionLabelActive : null,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text style={styles.pickerOptionSub}>{opt.subtitle}</Text>
                      ) : null}
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected ? styles.radioCircleActive : null,
                      ]}
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

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>

      <View
        style={[
          styles.pickerTrigger,
          errorMessage ? styles.inputError : null,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${displayText || placeholder}`}
          onPress={handleOpen}
          style={styles.pickerMainTap}
        >
          <Feather
            name="calendar"
            size={15}
            color={CAREDOSE_EXTENDED_COLORS.primary}
            style={styles.leadingIcon}
          />
          <Text
            style={[
              styles.pickerValueText,
              !displayText ? styles.placeholderText : null,
            ]}
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
            style={styles.clearIconBtn}
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
          <View style={styles.pickerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} />
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <Pressable onPress={() => setShowPicker(false)} style={styles.pickerCloseBtn}>
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
                <View style={styles.webDateBox}>
                  <Text style={styles.webDateCurrent}>
                    {formatDisplayDate(value || formatIsoDateString(new Date()))}
                  </Text>
                  <View style={styles.webDateActions}>
                    <Pressable onPress={() => adjustDays(-1)} style={styles.webStepBtn}>
                      <Text style={styles.webStepText}>-1 Day</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onChangeDate(formatIsoDateString(new Date()))}
                      style={styles.webStepBtn}
                    >
                      <Text style={styles.webStepText}>Today</Text>
                    </Pressable>
                    <Pressable onPress={() => adjustDays(1)} style={styles.webStepBtn}>
                      <Text style={styles.webStepText}>+1 Day</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={styles.iosPickerFooter}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      onChangeDate(formatIsoDateString(iosDraft));
                    }
                    setShowPicker(false);
                  }}
                  style={styles.pickerDoneBtn}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    <View style={styles.fieldWrapper}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={handleOpen}
        style={[
          styles.pickerTrigger,
          errorMessage ? styles.inputError : null,
        ]}
      >
        <Feather
          name="clock"
          size={15}
          color={CAREDOSE_EXTENDED_COLORS.primary}
          style={styles.leadingIcon}
        />
        <Text
          style={[
            styles.pickerValueText,
            !value ? styles.placeholderText : null,
          ]}
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
          <View style={styles.pickerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPicker(false)} />
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{label}</Text>
                <Pressable onPress={() => setShowPicker(false)} style={styles.pickerCloseBtn}>
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
                <View style={styles.webDateBox}>
                  <Text style={styles.webDateCurrent}>{value || '09:00 AM'}</Text>
                  <View style={styles.webDateActions}>
                    <Pressable onPress={() => adjustMinutes(-30)} style={styles.webStepBtn}>
                      <Text style={styles.webStepText}>-30m</Text>
                    </Pressable>
                    <Pressable onPress={() => adjustMinutes(30)} style={styles.webStepBtn}>
                      <Text style={styles.webStepText}>+30m</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={styles.iosPickerFooter}>
                <Pressable
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      onChangeTime(formatTimeString(iosDraft));
                    }
                    setShowPicker(false);
                  }}
                  style={styles.pickerDoneBtn}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
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
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextCol}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
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

const styles = StyleSheet.create({
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formRowStacked: {
    flexDirection: 'column',
  },
  formCol: {
    flex: 1,
    minWidth: 0,
  },
  formColStacked: {
    width: '100%',
  },
  fieldWrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginBottom: 5,
  },
  requiredStar: {
    color: CAREDOSE_EXTENDED_COLORS.error,
  },
  input: {
    minHeight: 42,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: '#D6E3DC',
    borderRadius: CAREDOSE_RADIUS.field,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: CAREDOSE_EXTENDED_COLORS.error,
  },
  inputDisabled: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  errorText: {
    marginTop: 4,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.error,
    fontWeight: '500',
  },
  helperText: {
    marginTop: 4,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  pickerTrigger: {
    minHeight: 42,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: '#D6E3DC',
    borderRadius: CAREDOSE_RADIUS.field,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerMainTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  leadingIcon: {
    marginRight: 8,
  },
  pickerValueText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  placeholderText: {
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
    fontWeight: '400',
  },
  clearIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E5EFEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  chevronBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 38, 35, 0.52)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    overflow: 'hidden',
    elevation: 14,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  pickerCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerList: {
    paddingVertical: 6,
  },
  pickerOption: {
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  pickerOptionLast: {
    borderBottomWidth: 0,
  },
  pickerOptionActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
  },
  pickerOptionTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  pickerOptionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  pickerOptionLabelActive: {
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  pickerOptionSub: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#C5D6CE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  webDateBox: {
    padding: 18,
    alignItems: 'center',
  },
  webDateCurrent: {
    fontSize: 18,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 14,
  },
  webDateActions: {
    flexDirection: 'row',
    gap: 10,
  },
  webStepBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
  },
  webStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  iosPickerFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: CAREDOSE_EXTENDED_COLORS.border,
    alignItems: 'flex-end',
  },
  pickerDoneBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  pickerDoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  toggleDescription: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
