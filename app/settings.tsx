import React, { useState } from 'react';
import { Text, View } from 'react-native';
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
import { useMedications } from '../src/features/medications/MedicationsContext';
import { useSchedules } from '../src/features/schedule/SchedulesContext';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { resetDemoMedications } = useMedications();
  const { resetDemoSchedules } = useSchedules();
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

  const handleConfirmResetDemo = async (): Promise<void> => {
    setNotificationsEnabled(true);
    setSoundEnabled(true);
    setLeadTime('10');
    setGlucoseUnit('mg/dL');
    setMonthlyBudget('2500');
    setDisplayName('Karim');
    await Promise.all([resetDemoMedications(), resetDemoSchedules()]);
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

      <View className="bg-white rounded-card border border-border p-4 mb-3.5">
        <Text className="text-[15px] font-semibold text-main mb-2">Reminders</Text>
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

      <View className="bg-white rounded-card border border-border p-4 mb-3.5">
        <Text className="text-[15px] font-semibold text-main mb-2">Units & Profile</Text>
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

      <View className="bg-[#FDECEC] rounded-card border border-[#F3C1BE] p-4 mb-3.5">
        <Text className="text-[15px] font-bold text-error">Demo Data</Text>
        <Text className="mt-1 text-[12px] text-main leading-[17px]">
          Restore fictional sample medicines, schedules, readings, purchases, and dose history to
          their initial preview state.
        </Text>
        <View className="mt-3">
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
        onConfirm={() => void handleConfirmResetDemo()}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </ScreenContainer>
  );
}
