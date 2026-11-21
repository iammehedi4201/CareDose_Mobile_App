import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ConfirmDialog,
  DestructiveButton,
  FormField,
  PrimaryButton,
  ScreenContainer,
  SelectField,
  SuccessToast,
  ToggleField,
} from '../src/components';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [leadTime, setLeadTime] = useState('10');
  const [glucoseUnit, setGlucoseUnit] = useState('mg/dL');
  const [monthlyBudget, setMonthlyBudget] = useState('2500');
  const [displayName, setDisplayName] = useState('Karim');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSaveSettings = (): void => {
    setToast('Care preferences saved.');
  };

  const handleConfirmResetDemo = (): void => {
    setNotificationsEnabled(true);
    setSoundEnabled(true);
    setLeadTime('10');
    setGlucoseUnit('mg/dL');
    setMonthlyBudget('2500');
    setDisplayName('Karim');
    setResetConfirmOpen(false);
    setToast('Fictional demo data restored to defaults.');
  };

  return (
    <ScreenContainer
      title="Settings"
      subtitle="Reminders, units & demo data"
      onBack={() => router.push('/profile')}
    >
      <SuccessToast message={toast} />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Reminders</Text>
        <ToggleField
          label="Notifications"
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
        />
        <ToggleField
          label="Reminder sound"
          value={soundEnabled}
          onValueChange={setSoundEnabled}
        />
        <SelectField
          label="Reminder lead time"
          value={leadTime}
          options={[
            { label: 'At scheduled time', value: '0' },
            { label: '10 minutes before', value: '10' },
            { label: '15 minutes before', value: '15' },
            { label: '30 minutes before', value: '30' },
          ]}
          onSelect={setLeadTime}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Units & Profile</Text>
        <SelectField
          label="Glucose unit"
          value={glucoseUnit}
          options={[
            { label: 'mg/dL', value: 'mg/dL' },
            { label: 'mmol/L', value: 'mmol/L' },
          ]}
          onSelect={setGlucoseUnit}
        />
        <FormField
          label="Currency"
          value="Taka (৳ BDT)"
          onChangeText={() => undefined}
          editable={false}
        />
        <FormField
          label="Monthly medicine budget (৳ BDT)"
          value={monthlyBudget}
          onChangeText={setMonthlyBudget}
          keyboardType="numeric"
        />
        <FormField
          label="Your name"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <PrimaryButton
          fullWidth
          label="Save settings"
          onPress={handleSaveSettings}
        />
      </View>

      <View style={[styles.sectionCard, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>Demo Data</Text>
        <Text style={styles.dangerBody}>
          Restore fictional sample medicines, schedules, readings, purchases, and dose history to
          their initial preview state.
        </Text>
        <View style={styles.dangerBtnWrap}>
          <DestructiveButton
            fullWidth
            label="Reset demo data"
            onPress={() => setResetConfirmOpen(true)}
          />
        </View>
      </View>

      <ConfirmDialog
        visible={resetConfirmOpen}
        title="Reset Demo Data?"
        description="This will restore the fictional sample records and remove changes made in the current demo session."
        warningNote="This action cannot be undone for the current demo session."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={handleConfirmResetDemo}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 8,
  },
  dangerCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.errorSurface,
    borderColor: '#F3C1BE',
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.error,
  },
  dangerBody: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    lineHeight: 17,
  },
  dangerBtnWrap: {
    marginTop: 12,
  },
});
