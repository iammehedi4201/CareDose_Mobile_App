import { Platform } from 'react-native';
import type { ScheduleStatusDto } from '../../api/schedules';
import {
  addDaysYmd,
  buildLocalOccurrenceDate,
  formatDoseAmountDisplay,
  getLocalScheduleTimesForDate,
  getTodayLocalYmd,
  LocalScheduleRecord,
  resolveEffectiveScheduleStatus,
} from './dose-rules';

export interface NotificationCapabilityState {
  supported: boolean;
  granted: boolean;
  canAskAgain: boolean;
  statusText: string;
}

type NotificationsModule = typeof import('expo-notifications');
type MinimalNotificationsClient = Pick<
  NotificationsModule,
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'getAllScheduledNotificationsAsync'
  | 'cancelScheduledNotificationAsync'
  | 'scheduleNotificationAsync'
> & {
  SchedulableTriggerInputTypes: { DATE: NotificationsModule['SchedulableTriggerInputTypes']['DATE'] };
};

let testNotificationsClient: MinimalNotificationsClient | null = null;

export function __setNotificationsClientForTesting(
  client: MinimalNotificationsClient | null,
): void {
  testNotificationsClient = client;
}

function loadNotificationsModule(): MinimalNotificationsClient | null {
  if (testNotificationsClient) {
    return testNotificationsClient;
  }
  if (Platform.OS === 'web') {
    return null;
  }
  try {
    // Lazy require avoids crashing Vitest / Web SSR runtimes without native bindings
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as MinimalNotificationsClient;
    if (typeof mod?.getPermissionsAsync === 'function') {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkDeviceNotificationSupport(): Promise<NotificationCapabilityState> {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      statusText: 'Device dose notifications are only available in the Android and iOS app.',
    };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      statusText: 'Device notification service is unavailable on this runtime.',
    };
  }

  try {
    const perms = await Notifications.getPermissionsAsync();
    const granted = perms.status === 'granted';
    return {
      supported: true,
      granted,
      canAskAgain: Boolean(perms.canAskAgain ?? !granted),
      statusText: granted
        ? 'Notification permission granted on this device.'
        : 'Notification permission is not granted yet.',
    };
  } catch {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      statusText: 'Unable to check device notification permission.',
    };
  }
}

export async function requestDeviceNotificationPermission(): Promise<NotificationCapabilityState> {
  const baseline = await checkDeviceNotificationSupport();
  if (!baseline.supported) {
    return baseline;
  }
  if (baseline.granted) {
    return baseline;
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return baseline;
  }

  try {
    const res = await Notifications.requestPermissionsAsync();
    const granted = res.status === 'granted';
    return {
      supported: true,
      granted,
      canAskAgain: Boolean(res.canAskAgain ?? false),
      statusText: granted
        ? 'Notification permission granted on this device.'
        : 'Permission denied. Enable notifications in device settings to receive reminders.',
    };
  } catch {
    return baseline;
  }
}

export async function cancelScheduleNotifications(scheduleId: string): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((item) => item.content?.data?.scheduleId === scheduleId)
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
  } catch {
    // Ignore local cancellation failures safely
  }
}

export function describeScheduleReminderStatus(
  remindersEnabled: boolean,
  effectiveStatus: ScheduleStatusDto,
  capability: NotificationCapabilityState,
): { active: boolean; label: string } {
  if (effectiveStatus === 'ARCHIVED') {
    return { active: false, label: 'Reminders: Off (archived)' };
  }
  if (effectiveStatus === 'COMPLETED') {
    return { active: false, label: 'Reminders: Off (completed)' };
  }
  if (effectiveStatus === 'PAUSED') {
    return { active: false, label: 'Reminders: Paused' };
  }
  if (!remindersEnabled) {
    return { active: false, label: 'Reminders: Off' };
  }
  if (!capability.supported) {
    return { active: false, label: 'Reminders: Unavailable on web' };
  }
  if (!capability.granted) {
    return { active: false, label: 'Reminders: Permission needed' };
  }
  return { active: true, label: 'Reminders: On' };
}

/**
 * Schedules real local device notification alerts for upcoming doses when supported & granted.
 * Notifications ONLY alert the user and never mark doses as Taken automatically.
 */
export async function syncScheduleNotifications(
  schedule: LocalScheduleRecord,
  medicineName: string,
  now: Date = new Date(),
): Promise<{ scheduledCount: number }> {
  await cancelScheduleNotifications(schedule.id);

  const todayYmd = getTodayLocalYmd(now);
  const effectiveStatus = resolveEffectiveScheduleStatus(schedule, todayYmd);
  if (!schedule.remindersEnabled || effectiveStatus !== 'ACTIVE') {
    return { scheduledCount: 0 };
  }

  const cap = await checkDeviceNotificationSupport();
  if (!cap.supported || !cap.granted) {
    return { scheduledCount: 0 };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return { scheduledCount: 0 };
  }

  let scheduledCount = 0;

  try {
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const ymd = addDaysYmd(todayYmd, dayOffset);
      const times = getLocalScheduleTimesForDate(schedule, ymd);
      for (const time24 of times) {
        const triggerDate = buildLocalOccurrenceDate(ymd, time24);
        if (triggerDate.getTime() <= now.getTime() + 10_000) {
          continue;
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Time for ${medicineName}`,
            body: `Scheduled dose: ${formatDoseAmountDisplay(schedule.doseAmount, schedule.doseUnit)}`,
            sound: true,
            data: {
              scheduleId: schedule.id,
              patientMedicationId: schedule.patientMedicationId,
              autoMarkTaken: false,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        scheduledCount += 1;
      }
    }
  } catch {
    return { scheduledCount };
  }

  return { scheduledCount };
}

export async function reconcileScheduleNotifications(
  schedules: LocalScheduleRecord[],
  resolveMedName: (medicationId: string) => string,
  now: Date = new Date(),
): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  const todayYmd = getTodayLocalYmd(now);
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const orphanedIds = new Set<string>();
    for (const item of existing) {
      const rawId = item.content?.data?.scheduleId;
      if (typeof rawId !== 'string') continue;
      const sched = scheduleMap.get(rawId);
      const eff = sched ? resolveEffectiveScheduleStatus(sched, todayYmd) : null;
      if (!sched || !sched.remindersEnabled || eff !== 'ACTIVE') {
        orphanedIds.add(rawId);
      }
    }
    for (const scheduleId of orphanedIds) {
      await cancelScheduleNotifications(scheduleId);
    }
  } catch {
    // Ignore read/cancel errors cleanly
  }

  for (const sched of schedules) {
    const eff = resolveEffectiveScheduleStatus(sched, todayYmd);
    if (eff === 'ACTIVE' && sched.remindersEnabled) {
      await syncScheduleNotifications(
        sched,
        resolveMedName(sched.patientMedicationId),
        now,
      );
    }
  }
}
