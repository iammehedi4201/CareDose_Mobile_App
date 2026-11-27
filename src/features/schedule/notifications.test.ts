import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalScheduleRecord } from './dose-rules';
import { buildLocalOccurrenceDate, getTodayLocalYmd } from './dose-rules';
import {
  __setNotificationsClientForTesting,
  buildDoseNotificationOccurrenceKey,
  CAREDOSE_REMINDER_CHANNEL_ID,
  CAREDOSE_SILENT_CHANNEL_ID,
  checkDeviceNotificationSupport,
  configureCareDoseNotificationRuntime,
  describeScheduleReminderStatus,
  reconcileScheduleNotifications,
  sendTestDoseNotification,
  snoozeDoseNotification,
  syncScheduleNotifications,
} from './notifications';

interface ScheduledItem {
  identifier: string;
  content: {
    title?: string;
    body?: string;
    sound?: boolean | string;
    data?: Record<string, unknown>;
  };
  trigger: { date?: Date; seconds?: number; channelId?: string };
}

describe('Expo local dose notification lifecycle', () => {
  let scheduledStore: ScheduledItem[] = [];
  let seq = 0;
  let permissionStatus: 'granted' | 'denied' = 'granted';
  let scheduleSpy: ReturnType<typeof vi.fn>;
  let setChannelSpy: ReturnType<typeof vi.fn>;
  let setHandlerSpy: ReturnType<typeof vi.fn>;
  let setCategorySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scheduledStore = [];
    seq = 0;
    permissionStatus = 'granted';
    setChannelSpy = vi.fn(async () => null);
    setHandlerSpy = vi.fn();
    setCategorySpy = vi.fn(async () => ({}));
    scheduleSpy = vi.fn(async (req: unknown) => {
      seq += 1;
      const r = req as {
        content: ScheduledItem['content'];
        trigger: ScheduledItem['trigger'];
      };
      const identifier = `notif-${seq}`;
      scheduledStore.push({
        identifier,
        content: r.content,
        trigger: r.trigger,
      });
      return identifier;
    });

    __setNotificationsClientForTesting({
      getPermissionsAsync: vi.fn(async () => ({
        status: permissionStatus,
        canAskAgain: permissionStatus !== 'granted',
        granted: permissionStatus === 'granted',
        expires: 'never',
      })) as never,
      requestPermissionsAsync: vi.fn(async () => ({
        status: permissionStatus,
        canAskAgain: false,
        granted: permissionStatus === 'granted',
        expires: 'never',
      })) as never,
      getAllScheduledNotificationsAsync: vi.fn(async () => [...scheduledStore]) as never,
      cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
        scheduledStore = scheduledStore.filter((item) => item.identifier !== id);
      }) as never,
      scheduleNotificationAsync: scheduleSpy as never,
      setNotificationHandler: setHandlerSpy as never,
      setNotificationChannelAsync: setChannelSpy as never,
      setNotificationCategoryAsync: setCategorySpy as never,
      SchedulableTriggerInputTypes: {
        DATE: 'date' as never,
        TIME_INTERVAL: 'timeInterval' as never,
      },
    });
  });

  afterEach(() => {
    __setNotificationsClientForTesting(null);
  });

  it('schedules future active notifications only, isolates schedules on pause/archive/edit, and never marks taken', async () => {
    const today = getTodayLocalYmd();
    const now = buildLocalOccurrenceDate(today, '09:00');

    const schedA: LocalScheduleRecord = {
      id: 'sched-a',
      patientMedicationId: 'med-a',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'TWICE_DAILY',
      scheduledTimes: ['08:00', '20:00'],
      startDateYmd: today,
      endDateYmd: null,
      instructions: 'After meal',
      remindersEnabled: true,
      status: 'ACTIVE',
    };

    const schedB: LocalScheduleRecord = {
      id: 'sched-b',
      patientMedicationId: 'med-b',
      doseAmount: 2,
      doseUnit: 'capsule',
      frequency: 'DAILY',
      scheduledTimes: ['21:00'],
      startDateYmd: today,
      endDateYmd: null,
      instructions: null,
      remindersEnabled: true,
      status: 'ACTIVE',
    };

    const resA = await syncScheduleNotifications(schedA, 'Napa', now);
    const resB = await syncScheduleNotifications(schedB, 'Seclo', now);

    // 7 days for schedA twice daily minus today 08:00 (already in past relative to 09:00) = 13
    expect(resA.scheduledCount).toBe(13);
    expect(resB.scheduledCount).toBe(7);
    expect(
      scheduledStore.every((item) => item.content.data?.autoMarkTaken === false),
    ).toBe(true);

    // Editing schedA time updates only schedA alerts and leaves schedB untouched
    await syncScheduleNotifications(
      { ...schedA, scheduledTimes: ['22:00'], frequency: 'DAILY' },
      'Napa',
      now,
    );
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-a')).toHaveLength(7);
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-b')).toHaveLength(7);

    // Pausing schedA cancels only schedA alerts; schedB alerts remain intact
    await syncScheduleNotifications({ ...schedA, status: 'PAUSED' }, 'Napa', now);
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-a')).toHaveLength(0);
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-b')).toHaveLength(7);

    // Resuming schedA restores alerts cleanly
    const resumedRes = await syncScheduleNotifications(
      { ...schedA, scheduledTimes: ['22:00'], frequency: 'DAILY', status: 'ACTIVE' },
      'Napa',
      now,
    );
    expect(resumedRes.scheduledCount).toBe(7);

    // Turning remindersEnabled false or archiving cancels schedA alerts without affecting schedB
    await syncScheduleNotifications({ ...schedA, remindersEnabled: false }, 'Napa', now);
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-a')).toHaveLength(0);
    expect(scheduledStore.filter((s) => s.content.data?.scheduleId === 'sched-b')).toHaveLength(7);

    // Reconcile cancels archived schedB while leaving expired schedules unscheduled
    await reconcileScheduleNotifications(
      [
        { ...schedA, status: 'ARCHIVED' },
        { ...schedB, status: 'ARCHIVED' },
      ],
      () => 'Med',
      now,
    );
    expect(scheduledStore).toHaveLength(0);
  });

  it('never displays reminders as active when device permission is denied', async () => {
    permissionStatus = 'denied';
    const cap = await checkDeviceNotificationSupport();
    expect(cap.supported).toBe(true);
    expect(cap.granted).toBe(false);

    const status = describeScheduleReminderStatus(true, 'ACTIVE', cap);
    expect(status.active).toBe(false);
    expect(status.label).toContain('Permission needed');

    const globalOffStatus = describeScheduleReminderStatus(
      true,
      'ACTIVE',
      { ...cap, granted: true },
      false,
    );
    expect(globalOffStatus.active).toBe(false);
    expect(globalOffStatus.label).toContain('Off globally');
  });

  it('prevents duplicates across repeated reconciliations, applies lead time & privacy mode, and isolates non-CareDose alerts', async () => {
    const today = getTodayLocalYmd();
    const now = buildLocalOccurrenceDate(today, '10:00');

    // Unrelated system/external notification that CareDose must never cancel
    scheduledStore.push({
      identifier: 'external-1',
      content: { title: 'System update', body: 'Keep intact', data: { origin: 'other' } },
      trigger: { date: buildLocalOccurrenceDate(today, '23:00') },
    });

    const sched: LocalScheduleRecord = {
      id: 'sched-lead',
      patientMedicationId: 'med-lead',
      doseAmount: 1,
      doseUnit: 'tablet',
      frequency: 'DAILY',
      scheduledTimes: ['20:00'],
      startDateYmd: today,
      endDateYmd: null,
      instructions: null,
      remindersEnabled: true,
      status: 'ACTIVE',
    };

    await configureCareDoseNotificationRuntime(true);
    expect(setHandlerSpy).toHaveBeenCalledTimes(1);
    expect(setChannelSpy).toHaveBeenCalledWith(
      CAREDOSE_REMINDER_CHANNEL_ID,
      expect.objectContaining({ name: 'Medicine Reminders' }),
    );
    expect(setChannelSpy).toHaveBeenCalledWith(
      CAREDOSE_SILENT_CHANNEL_ID,
      expect.any(Object),
    );
    expect(setCategorySpy).toHaveBeenCalledTimes(1);

    const first = await syncScheduleNotifications(
      sched,
      { name: 'Napa', strength: '500 mg' },
      now,
      {
        globalRemindersEnabled: true,
        soundEnabled: false,
        reminderLeadMins: 15,
        hideMedicineDetails: true,
      },
    );
    expect(first.scheduledCount).toBe(7);
    expect(first.reusedCount).toBe(0);

    const schedAlerts = scheduledStore.filter(
      (s) => s.content.data?.scheduleId === 'sched-lead',
    );
    expect(schedAlerts).toHaveLength(7);
    expect(schedAlerts[0].trigger.date?.getHours()).toBe(19);
    expect(schedAlerts[0].trigger.date?.getMinutes()).toBe(45);
    expect(schedAlerts[0].trigger.channelId).toBe(CAREDOSE_SILENT_CHANNEL_ID);
    expect(schedAlerts[0].content.sound).toBe(false);
    expect(schedAlerts[0].content.body).not.toContain('Napa');
    expect(schedAlerts[0].content.data?.occurrenceKey).toBe(
      buildDoseNotificationOccurrenceKey('sched-lead', today, '20:00'),
    );

    // Second reconciliation with identical inputs reuses all 7 without duplicate schedule calls
    const countBefore = scheduleSpy.mock.calls.length;
    const second = await syncScheduleNotifications(
      sched,
      { name: 'Napa', strength: '500 mg' },
      now,
      {
        globalRemindersEnabled: true,
        soundEnabled: false,
        reminderLeadMins: 15,
        hideMedicineDetails: true,
      },
    );
    expect(second.scheduledCount).toBe(0);
    expect(second.reusedCount).toBe(7);
    expect(scheduleSpy.mock.calls.length).toBe(countBefore);

    // Snooze creates separate alert without marking dose taken
    const snoozeRes = await snoozeDoseNotification(
      {
        occurrenceKey: `sched-lead:${buildLocalOccurrenceDate(today, '20:00').toISOString()}`,
        scheduleId: 'sched-lead',
        patientMedicationId: 'med-lead',
        medicineName: 'Napa',
        strength: '500 mg',
        doseAmount: '1',
        doseUnit: 'tablet',
        scheduledDateYmd: today,
        scheduledTime24: '20:00',
      },
      10,
      { soundEnabled: true, hideMedicineDetails: false },
      now,
    );
    expect(snoozeRes.scheduled).toBe(true);
    const snoozed = scheduledStore.find((s) => s.content.data?.isSnooze === true);
    expect(snoozed?.content.data?.autoMarkTaken).toBe(false);
    expect(snoozed?.content.body).toContain('Napa 500 mg');

    // Global reminders OFF cancels CareDose alerts while leaving external-1 untouched
    await reconcileScheduleNotifications(
      [sched],
      () => ({ name: 'Napa', strength: '500 mg' }),
      now,
      { globalRemindersEnabled: false },
    );
    expect(scheduledStore.map((s) => s.identifier)).toEqual(['external-1']);

    // Test notification schedules cleanly
    const testRes = await sendTestDoseNotification({ soundEnabled: true });
    expect(testRes.sent).toBe(true);
    expect(scheduledStore.some((s) => s.content.data?.isTest === true)).toBe(true);
  });
});
