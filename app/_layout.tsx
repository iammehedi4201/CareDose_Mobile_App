import '../global.css';
import React, { useCallback, useEffect } from 'react';
import { StatusBar, View } from 'react-native';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CareDoseSplashOverlay } from '../src/components/CareDoseSplashOverlay';
import { PurchasesProvider } from '../src/features/expenses/PurchasesContext';
import { HealthLogsProvider } from '../src/features/health/HealthLogsContext';
import {
  MedicationsProvider,
  useMedications,
} from '../src/features/medications/MedicationsContext';
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

try {
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    String(Constants.executionEnvironment ?? '') === 'storeClient';
  if (!isExpoGo) {
    SplashScreen.setOptions({
      duration: 220,
      fade: true,
    });
  }
} catch {
  // Ignore on platforms where native splash options are not registered (e.g., web/tests)
}

void SplashScreen.preventAutoHideAsync().catch(() => {});

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

function SplashCoordinator(): React.JSX.Element {
  const { loading: prefsLoading } = useUserPreferences();
  const { loading: medsLoading } = useMedications();
  const { loading: schedsLoading } = useSchedules();

  const appReady = !prefsLoading && !medsLoading && !schedsLoading;

  const handleFirstPaint = useCallback(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return <CareDoseSplashOverlay appReady={appReady} onFirstPaint={handleFirstPaint} />;
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
                <View className="flex-1 bg-background" style={{ flex: 1 }}>
                  <NotificationRuntimeBridge />
                  <Slot />
                  <SplashCoordinator />
                </View>
              </HealthLogsProvider>
            </PurchasesProvider>
          </SchedulesProvider>
        </MedicationsProvider>
      </UserPreferencesProvider>
    </SafeAreaProvider>
  );
}
