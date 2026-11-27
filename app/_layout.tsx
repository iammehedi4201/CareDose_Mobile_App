import '../global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PurchasesProvider } from '../src/features/expenses/PurchasesContext';
import { HealthLogsProvider } from '../src/features/health/HealthLogsContext';
import { MedicationsProvider } from '../src/features/medications/MedicationsContext';
import {
  UserPreferencesProvider,
  useUserPreferences,
} from '../src/features/profile/UserPreferencesContext';
import { getTodayLocalYmd } from '../src/features/schedule/dose-rules';
import {
  CAREDOSE_ACTION_SNOOZE_10,
  configureCareDoseNotificationRuntime,
  subscribeNotificationResponses,
} from '../src/features/schedule/notifications';
import {
  SchedulesProvider,
  useSchedules,
} from '../src/features/schedule/SchedulesContext';

function NotificationRuntimeBridge(): null {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const { getLocalRangeDoses, snoozeDoseReminder } = useSchedules();

  useEffect(() => {
    void configureCareDoseNotificationRuntime(preferences.soundEnabled);
  }, [preferences.soundEnabled]);

  useEffect(() => {
    return subscribeNotificationResponses((payload) => {
      if (payload.actionIdentifier === CAREDOSE_ACTION_SNOOZE_10) {
        const targetKey = payload.slotOccurrenceKey ?? payload.occurrenceKey;
        const todayDoses = getLocalRangeDoses(getTodayLocalYmd(), 2).days.flatMap(
          (day) => day.items,
        );
        const match = todayDoses.find(
          (d) =>
            d.occurrenceKey === targetKey ||
            (payload.scheduleId &&
              d.scheduleId === payload.scheduleId &&
              payload.occurrenceKey?.endsWith(`:${d.scheduledTime24}`)),
        );
        if (match) {
          void snoozeDoseReminder(match, 10);
        }
      }
      router.push('/schedule');
    });
  }, [getLocalRangeDoses, router, snoozeDoseReminder]);

  return null;
}

export default function RootLayout(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <UserPreferencesProvider>
        <MedicationsProvider>
          <SchedulesProvider>
            <PurchasesProvider>
              <HealthLogsProvider>
                <NotificationRuntimeBridge />
                <Slot />
              </HealthLogsProvider>
            </PurchasesProvider>
          </SchedulesProvider>
        </MedicationsProvider>
      </UserPreferencesProvider>
    </SafeAreaProvider>
  );
}
