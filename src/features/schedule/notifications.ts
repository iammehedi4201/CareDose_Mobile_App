import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import type { ScheduledDoseItemDto, ScheduleStatusDto } from '../../api/schedules';
import {
  addDaysYmd,
  buildLocalOccurrenceDate,
  format24To12Hour,
  formatDoseAmountDisplay,
  getLocalScheduleTimesForDate,
  getTodayLocalYmd,
  LocalScheduleRecord,
  resolveEffectiveScheduleStatus,
} from './dose-rules';

export const CAREDOSE_REMINDER_CHANNEL_ID = 'caredose_medicine_reminders_v1';
export const CAREDOSE_SILENT_CHANNEL_ID = 'caredose_medicine_reminders_silent_v1';
export const CAREDOSE_DOSE_CATEGORY_ID = 'caredose_dose_reminder';
export const CAREDOSE_ACTION_OPEN = 'OPEN_SCHEDULE';
export const CAREDOSE_ACTION_SNOOZE_10 = 'SNOOZE_10';
export const NOTIFICATION_REGISTRY_STORAGE_KEY = 'caredose:notif-registry:v1';

export interface ReminderDeliveryPreferences {
  globalRemindersEnabled?: boolean;
  soundEnabled?: boolean;
  reminderLeadMins?: number;
  hideMedicineDetails?: boolean;
}

export interface NotificationCapabilityState {
  supported: boolean;
  granted: boolean;
  canAskAgain: boolean;
  statusText: string;
  permissionStatus?: 'granted' | 'denied' | 'undetermined' | 'unsupported';
  soundPermitted?: boolean;
}

export type NotificationMedicineDescriptor =
  | string
  | {
      name: string;
      strength?: string | null;
    };

export interface NotificationRegistryEntry {
  occurrenceKey: string;
  scheduleId: string;
  notificationId: string;
  scheduledDateYmd: string;
  scheduledTime24: string;
  triggerAtMs: number;
  channelId: string;
  body: string;
  timezone: string;
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
  SchedulableTriggerInputTypes: {
    DATE: NotificationsModule['SchedulableTriggerInputTypes']['DATE'];
    TIME_INTERVAL?: NotificationsModule['SchedulableTriggerInputTypes']['TIME_INTERVAL'];
  };
  setNotificationHandler?: NotificationsModule['setNotificationHandler'];
  setNotificationChannelAsync?: NotificationsModule['setNotificationChannelAsync'];
  setNotificationCategoryAsync?: NotificationsModule['setNotificationCategoryAsync'];
  addNotificationResponseReceivedListener?: NotificationsModule['addNotificationResponseReceivedListener'];
};

let testNotificationsClient: MinimalNotificationsClient | null = null;
let lastConfiguredHandlerSound: boolean | null = null;
let configuredChannelsAndCategories = false;

export function __setNotificationsClientForTesting(
  client: MinimalNotificationsClient | null,
): void {
  testNotificationsClient = client;
  lastConfiguredHandlerSound = null;
  configuredChannelsAndCategories = false;
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

export function buildDoseNotificationOccurrenceKey(
  scheduleId: string,
  localDateYmd: string,
  scheduledTime24: string,
): string {
  return `dose:${scheduleId}:${localDateYmd}:${scheduledTime24}`;
}

async function readNotificationRegistry(): Promise<NotificationRegistryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_REGISTRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NotificationRegistryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeNotificationRegistry(
  entries: NotificationRegistryEntry[],
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      NOTIFICATION_REGISTRY_STORAGE_KEY,
      JSON.stringify(entries),
    );
  } catch {
    // Ignore registry storage errors safely
  }
}

function resolveMedDisplay(descriptor: NotificationMedicineDescriptor): string {
  if (typeof descriptor === 'string') {
    return descriptor.trim() || 'Medicine';
  }
  const name = descriptor.name.trim() || 'Medicine';
  const strength = descriptor.strength?.trim();
  return strength ? `${name} ${strength}` : name;
}

function resolveTriggerTimestampMs(trigger: unknown): number | null {
  if (!trigger || typeof trigger !== 'object') return null;
  const obj = trigger as { date?: unknown; value?: unknown };
  if (obj.date instanceof Date) return obj.date.getTime();
  if (typeof obj.date === 'number') return obj.date;
  if (typeof obj.date === 'string') {
    const ms = new Date(obj.date).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof obj.value === 'number') return obj.value;
  return null;
}

function isCareDoseNotificationItem(item: {
  content?: { data?: Record<string, unknown> };
}): boolean {
  const data = item.content?.data;
  if (!data || typeof data !== 'object') return false;
  return (
    data.source === 'caredose' ||
    typeof data.scheduleId === 'string' ||
    typeof data.occurrenceKey === 'string'
  );
}

/**
 * Registers Android notification channels ('Medicine Reminders' audible + silent channels),
 * notification action categories, and foreground presentation handler.
 */
export async function configureCareDoseNotificationRuntime(
  soundEnabled = true,
): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  try {
    if (
      typeof Notifications.setNotificationHandler === 'function' &&
      lastConfiguredHandlerSound !== soundEnabled
    ) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: soundEnabled,
          shouldSetBadge: false,
        }),
      });
      lastConfiguredHandlerSound = soundEnabled;
    }

    if (!configuredChannelsAndCategories) {
      if (
        Platform.OS === 'android' &&
        typeof Notifications.setNotificationChannelAsync === 'function'
      ) {
        await Notifications.setNotificationChannelAsync(
          CAREDOSE_REMINDER_CHANNEL_ID,
          {
            name: 'Medicine Reminders',
            description: 'Scheduled medication dose alerts with reminder sound',
            importance: 6, // AndroidImportance.HIGH
            sound: 'default',
            enableVibrate: true,
            vibrationPattern: [0, 250, 200, 250],
            lightColor: '#087E67',
          },
        );
        await Notifications.setNotificationChannelAsync(
          CAREDOSE_SILENT_CHANNEL_ID,
          {
            name: 'Medicine Reminders (Silent)',
            description: 'Silent medication dose reminders without alert tone',
            importance: 5, // AndroidImportance.DEFAULT
            sound: null,
            enableVibrate: false,
          },
        );
      }

      if (typeof Notifications.setNotificationCategoryAsync === 'function') {
        await Notifications.setNotificationCategoryAsync(
          CAREDOSE_DOSE_CATEGORY_ID,
          [
            {
              identifier: CAREDOSE_ACTION_OPEN,
              buttonTitle: 'Open Schedule',
              options: { opensAppToForeground: true },
            },
            {
              identifier: CAREDOSE_ACTION_SNOOZE_10,
              buttonTitle: 'Snooze 10 min',
              options: { opensAppToForeground: true },
            },
          ],
        );
      }

      configuredChannelsAndCategories = true;
    }
  } catch {
    // Keep non-fatal fallback if OS channel/category setup fails
  }
}

export async function checkDeviceNotificationSupport(): Promise<NotificationCapabilityState> {
  if (Platform.OS === 'web') {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      permissionStatus: 'unsupported',
      soundPermitted: false,
      statusText:
        'Device dose notifications are only available in the Android and iOS app.',
    };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      permissionStatus: 'unsupported',
      soundPermitted: false,
      statusText: 'Device notification service is unavailable on this runtime.',
    };
  }

  try {
    const perms = await Notifications.getPermissionsAsync();
    const rawStatus = perms.status;
    // On iOS, status 3 = PROVISIONAL (quiet only, not audible alerts)
    const iosStatus = perms.ios?.status;
    const isProvisional = iosStatus === 3;
    const granted = rawStatus === 'granted' && !isProvisional;
    const soundPermitted =
      perms.ios?.allowsSound === false ? false : granted;

    const permissionStatus: NotificationCapabilityState['permissionStatus'] =
      granted
        ? 'granted'
        : rawStatus === 'denied' || perms.canAskAgain === false
          ? 'denied'
          : 'undetermined';

    let statusText = 'Notification permission has not been requested yet.';
    if (granted && !soundPermitted) {
      statusText =
        'Alerts are enabled, but notification sound is turned off in device settings.';
    } else if (granted) {
      statusText = 'Notification permission granted on this device.';
    } else if (isProvisional) {
      statusText =
        'Quiet provisional notifications only. Enable full alerts in iOS Settings for audible reminders.';
    } else if (permissionStatus === 'denied') {
      statusText =
        'Notification permission is denied. Enable notifications in device Settings.';
    }

    return {
      supported: true,
      granted,
      canAskAgain: Boolean(perms.canAskAgain ?? !granted),
      permissionStatus,
      soundPermitted,
      statusText,
    };
  } catch {
    return {
      supported: false,
      granted: false,
      canAskAgain: false,
      permissionStatus: 'unsupported',
      soundPermitted: false,
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

  await configureCareDoseNotificationRuntime(true);

  try {
    await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: false,
      },
    });
    return await checkDeviceNotificationSupport();
  } catch {
    return baseline;
  }
}

export async function openDeviceNotificationSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Ignore runtime environments without system settings support
  }
}

export function buildDoseReminderContent(params: {
  medicine: NotificationMedicineDescriptor;
  doseAmount: number | string;
  doseUnit: string;
  scheduledTime24: string;
  scheduleId: string;
  patientMedicationId: string;
  occurrenceKey: string;
  prefs?: ReminderDeliveryPreferences;
  isSnooze?: boolean;
}): {
  title: string;
  body: string;
  sound: 'default' | false;
  categoryIdentifier: string;
  data: Record<string, unknown>;
} {
  const soundOn = params.prefs?.soundEnabled !== false;
  const hideDetails = Boolean(params.prefs?.hideMedicineDetails);
  const time12 = format24To12Hour(params.scheduledTime24);
  const medDisplay = resolveMedDisplay(params.medicine);

  const title = hideDetails
    ? params.isSnooze
      ? 'Snoozed CareDose reminder'
      : 'CareDose medicine reminder'
    : params.isSnooze
      ? `Snoozed reminder: ${medDisplay}`
      : 'Time for your medicine!';

  const body = hideDetails
    ? `Time for your scheduled dose (${time12}). Open CareDose to review details.`
    : `${medDisplay} — Take ${formatDoseAmountDisplay(
        params.doseAmount,
        params.doseUnit,
      )}. Scheduled time: ${time12}.`;

  return {
    title,
    body,
    sound: soundOn ? 'default' : false,
    categoryIdentifier: CAREDOSE_DOSE_CATEGORY_ID,
    data: {
      source: 'caredose',
      scheduleId: params.scheduleId,
      patientMedicationId: params.patientMedicationId,
      occurrenceKey: params.occurrenceKey,
      scheduledTime24: params.scheduledTime24,
      isSnooze: Boolean(params.isSnooze),
      autoMarkTaken: false,
    },
  };
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
    const registry = await readNotificationRegistry();
    const filtered = registry.filter((entry) => entry.scheduleId !== scheduleId);
    if (filtered.length !== registry.length) {
      await writeNotificationRegistry(filtered);
    }
  } catch {
    // Ignore local cancellation failures safely
  }
}

export async function cancelDoseOccurrenceNotification(
  occurrenceKey: string,
  scheduleId?: string,
  scheduledDateYmd?: string,
  scheduledTime24?: string,
): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  const deterministicKey =
    scheduleId && scheduledDateYmd && scheduledTime24
      ? buildDoseNotificationOccurrenceKey(scheduleId, scheduledDateYmd, scheduledTime24)
      : null;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((item) => {
          const itemOcc = item.content?.data?.occurrenceKey;
          const itemLegacyOcc = item.content?.data?.slotOccurrenceKey;
          return (
            itemOcc === occurrenceKey ||
            (deterministicKey !== null && itemOcc === deterministicKey) ||
            itemLegacyOcc === occurrenceKey
          );
        })
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );

    const registry = await readNotificationRegistry();
    const nextReg = registry.filter(
      (entry) =>
        entry.occurrenceKey !== occurrenceKey &&
        (deterministicKey === null || entry.occurrenceKey !== deterministicKey),
    );
    if (nextReg.length !== registry.length) {
      await writeNotificationRegistry(nextReg);
    }
  } catch {
    // Ignore cancellation failures cleanly
  }
}

export async function cancelAllCareDoseNotifications(): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter(isCareDoseNotificationItem)
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );
    await writeNotificationRegistry([]);
  } catch {
    // Ignore bulk cancellation errors
  }
}

export function describeScheduleReminderStatus(
  remindersEnabled: boolean,
  effectiveStatus: ScheduleStatusDto,
  capability: NotificationCapabilityState,
  globalRemindersEnabled = true,
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
  if (!globalRemindersEnabled) {
    return { active: false, label: 'Reminders: Off globally' };
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
 * Synchronizes local scheduled reminders over a rolling 7-day window using deterministic
 * occurrence keys to prevent duplicates while cancelling obsolete or disabled alerts.
 */
export async function syncScheduleNotifications(
  schedule: LocalScheduleRecord,
  medicine: NotificationMedicineDescriptor,
  now: Date = new Date(),
  prefs: ReminderDeliveryPreferences = {},
): Promise<{ scheduledCount: number; reusedCount: number }> {
  const todayYmd = getTodayLocalYmd(now);
  const effectiveStatus = resolveEffectiveScheduleStatus(schedule, todayYmd);
  const globalEnabled = prefs.globalRemindersEnabled !== false;
  const soundEnabled = prefs.soundEnabled !== false;
  const leadMins = Math.max(0, Math.min(120, Math.round(prefs.reminderLeadMins ?? 0)));

  if (!globalEnabled || !schedule.remindersEnabled || effectiveStatus !== 'ACTIVE') {
    await cancelScheduleNotifications(schedule.id);
    return { scheduledCount: 0, reusedCount: 0 };
  }

  const cap = await checkDeviceNotificationSupport();
  if (!cap.supported || !cap.granted) {
    return { scheduledCount: 0, reusedCount: 0 };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return { scheduledCount: 0, reusedCount: 0 };
  }

  await configureCareDoseNotificationRuntime(soundEnabled);

  const channelId = soundEnabled
    ? CAREDOSE_REMINDER_CHANNEL_ID
    : CAREDOSE_SILENT_CHANNEL_ID;
  const localTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  type DesiredOccurrence = {
    occurrenceKey: string;
    ymd: string;
    time24: string;
    triggerDate: Date;
    content: ReturnType<typeof buildDoseReminderContent>;
  };

  const desiredMap = new Map<string, DesiredOccurrence>();

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const ymd = addDaysYmd(todayYmd, dayOffset);
    const times = getLocalScheduleTimesForDate(schedule, ymd);
    for (const time24 of times) {
      const scheduledDate = buildLocalOccurrenceDate(ymd, time24);
      const triggerDate = new Date(scheduledDate.getTime() - leadMins * 60_000);
      if (triggerDate.getTime() <= now.getTime() + 10_000) {
        continue;
      }
      const occurrenceKey = buildDoseNotificationOccurrenceKey(
        schedule.id,
        ymd,
        time24,
      );
      const content = buildDoseReminderContent({
        medicine,
        doseAmount: schedule.doseAmount,
        doseUnit: schedule.doseUnit,
        scheduledTime24: time24,
        scheduleId: schedule.id,
        patientMedicationId: schedule.patientMedicationId,
        occurrenceKey,
        prefs,
      });
      desiredMap.set(occurrenceKey, {
        occurrenceKey,
        ymd,
        time24,
        triggerDate,
        content,
      });
    }
  }

  let scheduledCount = 0;
  let reusedCount = 0;
  const nextScheduleRegistry: NotificationRegistryEntry[] = [];

  try {
    const existingAll = await Notifications.getAllScheduledNotificationsAsync();
    const existingForSchedule = existingAll.filter(
      (item) =>
        item.content?.data?.scheduleId === schedule.id &&
        item.content?.data?.isSnooze !== true,
    );

    const activeExistingByKey = new Map<string, typeof existingForSchedule[number]>();

    for (const existing of existingForSchedule) {
      const occKey = existing.content?.data?.occurrenceKey;
      const existingTriggerMs = resolveTriggerTimestampMs(existing.trigger);
      const desired = typeof occKey === 'string' ? desiredMap.get(occKey) : undefined;
      const existingChannel =
        (existing.trigger as { channelId?: string } | undefined)?.channelId ??
        CAREDOSE_REMINDER_CHANNEL_ID;
      const matchesTrigger =
        desired !== undefined &&
        existingTriggerMs !== null &&
        Math.abs(existingTriggerMs - desired.triggerDate.getTime()) <= 1000;
      const matchesContent =
        desired !== undefined &&
        existing.content?.body === desired.content.body &&
        existing.content?.title === desired.content.title &&
        existingChannel === channelId;

      if (
        desired &&
        matchesTrigger &&
        matchesContent &&
        !activeExistingByKey.has(desired.occurrenceKey)
      ) {
        activeExistingByKey.set(desired.occurrenceKey, existing);
        reusedCount += 1;
        nextScheduleRegistry.push({
          occurrenceKey: desired.occurrenceKey,
          scheduleId: schedule.id,
          notificationId: existing.identifier,
          scheduledDateYmd: desired.ymd,
          scheduledTime24: desired.time24,
          triggerAtMs: desired.triggerDate.getTime(),
          channelId,
          body: desired.content.body,
          timezone: localTimezone,
        });
      } else {
        await Notifications.cancelScheduledNotificationAsync(existing.identifier);
      }
    }

    for (const desired of desiredMap.values()) {
      if (activeExistingByKey.has(desired.occurrenceKey)) {
        continue;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: desired.content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: desired.triggerDate,
          channelId,
        },
      });
      scheduledCount += 1;
      nextScheduleRegistry.push({
        occurrenceKey: desired.occurrenceKey,
        scheduleId: schedule.id,
        notificationId,
        scheduledDateYmd: desired.ymd,
        scheduledTime24: desired.time24,
        triggerAtMs: desired.triggerDate.getTime(),
        channelId,
        body: desired.content.body,
        timezone: localTimezone,
      });
    }

    const existingReg = await readNotificationRegistry();
    const otherEntries = existingReg.filter((e) => e.scheduleId !== schedule.id);
    await writeNotificationRegistry([...otherEntries, ...nextScheduleRegistry]);
  } catch {
    return { scheduledCount, reusedCount };
  }

  return { scheduledCount, reusedCount };
}

export async function reconcileScheduleNotifications(
  schedules: LocalScheduleRecord[],
  resolveMed: (medicationId: string) => NotificationMedicineDescriptor,
  now: Date = new Date(),
  prefs: ReminderDeliveryPreferences = {},
): Promise<void> {
  const Notifications = loadNotificationsModule();
  if (!Notifications) return;

  const globalEnabled = prefs.globalRemindersEnabled !== false;
  if (!globalEnabled) {
    await cancelAllCareDoseNotifications();
    return;
  }

  const todayYmd = getTodayLocalYmd(now);
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const orphanedIds = new Set<string>();
    for (const item of existing) {
      if (!isCareDoseNotificationItem(item)) continue;
      if (item.content?.data?.isSnooze === true) continue;
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
        resolveMed(sched.patientMedicationId),
        now,
        prefs,
      );
    }
  }
}

/**
 * Creates a standalone snoozed reminder without altering recurrence rules or marking Taken.
 */
export async function snoozeDoseNotification(
  dose: Pick<
    ScheduledDoseItemDto,
    | 'occurrenceKey'
    | 'scheduleId'
    | 'patientMedicationId'
    | 'medicineName'
    | 'strength'
    | 'doseAmount'
    | 'doseUnit'
    | 'scheduledDateYmd'
    | 'scheduledTime24'
  >,
  snoozeMinutes = 10,
  prefs: ReminderDeliveryPreferences = {},
  now: Date = new Date(),
): Promise<{ scheduled: boolean; triggerAtIso: string | null }> {
  const cap = await checkDeviceNotificationSupport();
  if (!cap.supported || !cap.granted) {
    return { scheduled: false, triggerAtIso: null };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return { scheduled: false, triggerAtIso: null };
  }

  const soundEnabled = prefs.soundEnabled !== false;
  await configureCareDoseNotificationRuntime(soundEnabled);

  const channelId = soundEnabled
    ? CAREDOSE_REMINDER_CHANNEL_ID
    : CAREDOSE_SILENT_CHANNEL_ID;
  const snoozeOccKey = `${dose.occurrenceKey}:snooze`;

  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing
        .filter((item) => item.content?.data?.occurrenceKey === snoozeOccKey)
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );

    const mins = Math.max(1, Math.min(120, Math.round(snoozeMinutes)));
    const triggerDate = new Date(now.getTime() + mins * 60_000);
    const content = buildDoseReminderContent({
      medicine: { name: dose.medicineName, strength: dose.strength },
      doseAmount: dose.doseAmount,
      doseUnit: dose.doseUnit,
      scheduledTime24: dose.scheduledTime24,
      scheduleId: dose.scheduleId,
      patientMedicationId: dose.patientMedicationId,
      occurrenceKey: snoozeOccKey,
      prefs,
      isSnooze: true,
    });
    content.data.slotOccurrenceKey = dose.occurrenceKey;

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId,
      },
    });
    return { scheduled: true, triggerAtIso: triggerDate.toISOString() };
  } catch {
    return { scheduled: false, triggerAtIso: null };
  }
}

export async function sendTestDoseNotification(
  prefs: ReminderDeliveryPreferences = {},
): Promise<{
  sent: boolean;
  message: string;
  capability: NotificationCapabilityState;
}> {
  let cap = await checkDeviceNotificationSupport();
  if (!cap.supported) {
    return { sent: false, message: cap.statusText, capability: cap };
  }
  if (!cap.granted && cap.canAskAgain) {
    cap = await requestDeviceNotificationPermission();
  }
  if (!cap.granted) {
    return {
      sent: false,
      message: 'Enable notification permission in device settings to test alerts.',
      capability: cap,
    };
  }

  const Notifications = loadNotificationsModule();
  if (!Notifications) {
    return {
      sent: false,
      message: 'Notification module unavailable on this runtime.',
      capability: cap,
    };
  }

  const soundEnabled = prefs.soundEnabled !== false;
  await configureCareDoseNotificationRuntime(soundEnabled);
  const channelId = soundEnabled
    ? CAREDOSE_REMINDER_CHANNEL_ID
    : CAREDOSE_SILENT_CHANNEL_ID;

  try {
    const content = buildDoseReminderContent({
      medicine: { name: 'Napa', strength: '500 mg' },
      doseAmount: 1,
      doseUnit: 'tablet',
      scheduledTime24: '08:00',
      scheduleId: 'test-reminder',
      patientMedicationId: 'test-med',
      occurrenceKey: 'dose:test:preview',
      prefs,
    });
    content.data.isTest = true;

    const triggerDate = new Date(Date.now() + 2000);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 2,
            channelId,
          }
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId,
          },
    });
    return {
      sent: true,
      message: soundEnabled
        ? 'Test notification scheduled in 2 seconds with sound enabled.'
        : 'Silent test notification scheduled in 2 seconds.',
      capability: cap,
    };
  } catch {
    return {
      sent: false,
      message: 'Could not schedule test notification on this device.',
      capability: cap,
    };
  }
}

export function subscribeNotificationResponses(
  handler: (payload: {
    actionIdentifier: string;
    occurrenceKey?: string;
    scheduleId?: string;
    slotOccurrenceKey?: string;
  }) => void,
): () => void {
  const Notifications = loadNotificationsModule();
  if (
    !Notifications ||
    typeof Notifications.addNotificationResponseReceivedListener !== 'function'
  ) {
    return () => {};
  }

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification?.request?.content?.data ?? {};
    handler({
      actionIdentifier: response.actionIdentifier,
      occurrenceKey:
        typeof data.occurrenceKey === 'string' ? data.occurrenceKey : undefined,
      scheduleId:
        typeof data.scheduleId === 'string' ? data.scheduleId : undefined,
      slotOccurrenceKey:
        typeof data.slotOccurrenceKey === 'string'
          ? data.slotOccurrenceKey
          : undefined,
    });
  });

  return () => {
    sub.remove();
  };
}
