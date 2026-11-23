import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalScheduleRecord } from './dose-rules';
import { buildLocalOccurrenceDate, getTodayLocalYmd } from './dose-rules';
import {
  __setNotificationsClientForTesting,
  checkDeviceNotificationSupport,
  describeScheduleReminderStatus,
  reconcileScheduleNotifications,
  syncScheduleNotifications,
} from './notifications';

interface ScheduledItem {
  identifier: string;
  content: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
  };
  trigger: { date: Date };
}

describe('Expo local dose notification lifecycle', () => {
  let scheduledStore: ScheduledItem[] = [];
  let seq = 0;
  let permissionStatus: 'granted' | 'denied' = 'granted';

  beforeEach(() => {
    scheduledStore = [];
    seq = 0;
    permissionStatus = 'granted';

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
      scheduleNotificationAsync: vi.fn(async (req: unknown) => {
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
      }) as never,
      SchedulableTriggerInputTypes: { DATE: 'date' as never },
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
  });
});
