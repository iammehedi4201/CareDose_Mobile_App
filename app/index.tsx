import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import homeHeaderImage from '../assets/home-header-illustration.jpg';
import {
  BottomSheet,
  DoseProgressCard,
  EmptyState,
  FormField,
  ScreenContainer,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import { isPersonalMedicationLowStock } from '../src/features/medications/medication-helpers';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  formatDoseActionFeedback,
  formatScheduleBarDateLabel,
  getTodayLocalYmd,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
  SCHEDULE_PERIOD_META,
} from '../src/theme/tokens';

const HOME_PERIODS: SchedulePeriodGroupDto[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Bedtime',
];

interface PeriodStatusSummary {
  label: string;
  bgClass: string;
  textClass: string;
}

function summarizePeriodStatus(periodDoses: ScheduledDoseItemDto[]): PeriodStatusSummary {
  let overdue = 0;
  let upcoming = 0;
  let taken = 0;
  for (const d of periodDoses) {
    if (d.status === 'missed') overdue += 1;
    else if (d.status === 'upcoming' || d.status === 'due') upcoming += 1;
    else if (d.status === 'taken') taken += 1;
  }
  if (overdue > 0) {
    return {
      label: `${overdue} overdue`,
      bgClass: 'bg-[#FDECEC]',
      textClass: 'text-error',
    };
  }
  if (upcoming > 0) {
    return {
      label: `${upcoming} upcoming`,
      bgClass: 'bg-[#EBF3FD]',
      textClass: 'text-info',
    };
  }
  if (taken === periodDoses.length) {
    return {
      label: `${taken} taken`,
      bgClass: 'bg-mint',
      textClass: 'text-success',
    };
  }
  return {
    label: `${periodDoses.length - taken} skipped`,
    bgClass: 'bg-[#FDF5E6]',
    textClass: 'text-warning',
  };
}

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const { getLocalRangeDoses, recordDoseAction, pendingOccurrenceKeys } = useSchedules();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickReadingOpen, setQuickReadingOpen] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [latestGlucoseValue, setLatestGlucoseValue] = useState('106');
  const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});

  const todayYmd = getTodayLocalYmd();
  const dailyDoses = useMemo(
    () => getLocalRangeDoses(todayYmd, 1),
    [getLocalRangeDoses, todayYmd],
  );
  const doses = dailyDoses.days[0]?.items ?? [];
  const totalScheduled = doses.length;
  const completedCount = doses.filter((d) => d.status === 'taken').length;
  const overdueCount = doses.filter((d) => d.status === 'missed').length;
  const upcomingCount = doses.filter(
    (d) => d.status === 'upcoming' || d.status === 'due',
  ).length;
  const nextDose = dailyDoses.nextDose;

  const markDoseStatus = async (
    item: ScheduledDoseItemDto,
    nextStatus: 'taken' | 'skipped',
  ): Promise<void> => {
    const outcome = await recordDoseAction(
      item,
      nextStatus === 'taken' ? 'TAKEN' : 'SKIPPED',
    );
    setToastMessage(formatDoseActionFeedback(outcome));
  };

  const handleSaveQuickReading = (): void => {
    const errs = validateRequiredFields(
      { readingValue },
      { readingValue: 'Glucose reading value' },
    );
    setReadingErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    setLatestGlucoseValue(readingValue.trim());
    setQuickReadingOpen(false);
    setReadingValue('');
    setToastMessage('Glucose reading saved to Health Log.');
  };

  const activeMeds = medications.filter((m) => !m.archived);
  const lowStockMeds = activeMeds.filter(isPersonalMedicationLowStock);
  const nextDoseBusy = nextDose ? Boolean(pendingOccurrenceKeys[nextDose.occurrenceKey]) : false;

  const visiblePeriods = HOME_PERIODS.filter((period) =>
    doses.some((d) => d.period === period),
  );

  return (
    <ScreenContainer title="Today" hideHeader>
      <SuccessToast message={toastMessage} />

      {/* Full-bleed Top Greeting Banner with botanical medication illustration + KH badge */}
      <View
        className="relative justify-start overflow-hidden bg-[#EBF7F1]"
        style={{
          marginHorizontal: -layout.screenPadding,
          marginTop: -layout.screenPadding,
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.screenPadding + 6,
          paddingBottom: 42,
          minHeight: 162,
        }}
      >
        <Image
          source={homeHeaderImage}
          resizeMode="cover"
          accessible={false}
          className="absolute inset-0 h-full w-full"
        />
        <View
          accessible={false}
          className="absolute bottom-0 left-0 right-0 h-5 bg-[#F7FAF8]/65"
        />
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0 pr-6">
            <Text className="text-[13px] font-semibold text-primary" numberOfLines={1}>
              Good Morning, Karim
            </Text>
            <Text className="mt-0.5 text-[28px] font-bold leading-[34px] text-main">
              Today
            </Text>
            <Text className="mt-0.5 text-xs text-[#5A706B]">
              {formatScheduleBarDateLabel(todayYmd)}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Profile"
            onPress={() => router.push('/profile')}
            className="h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C5E8D8] bg-white/95 active:bg-mint"
          >
            <Text className="text-[13px] font-bold text-primary-dark">KH</Text>
          </Pressable>
        </View>
      </View>

      {/* Progress Summary Card */}
      <View className="-mt-6">
        <DoseProgressCard
          variant="tiles"
          takenCount={completedCount}
          totalCount={totalScheduled}
          upcomingCount={upcomingCount}
          overdueCount={overdueCount}
          label="Today's progress"
        />
      </View>

      {/* Primary Dark-Green Next Dose Hero Card */}
      {nextDose ? (
        <View
          className="relative mt-3.5 overflow-hidden rounded-[20px] bg-primary"
          style={{ padding: layout.cardPadding + 2 }}
        >
          {/* Decorative emerald curves */}
          <View
            accessible={false}
            className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10"
          />
          <View
            accessible={false}
            className="absolute -bottom-12 right-8 h-28 w-28 rounded-full bg-primary-dark/45"
          />

          {/* Top row: Circular icon column + aligned text stack + right tablets artwork */}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 min-w-0 flex-row items-start gap-2.5">
              <View className="mt-0.5 h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Feather name="disc" size={16} color="#FFFFFF" />
              </View>

              <View className="flex-1 min-w-0">
                <Text className="text-xs font-medium text-white/90">Next dose</Text>
                <Text
                  className="mt-1 text-[19px] font-bold leading-[24px] text-white"
                  numberOfLines={2}
                >
                  {nextDose.strength
                    ? `${nextDose.medicineName} ${nextDose.strength}`
                    : nextDose.medicineName}
                </Text>
                <Text className="mt-0.5 text-xs leading-[17px] text-white/90" numberOfLines={2}>
                  {nextDose.doseInstruction}
                </Text>
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <Feather name="clock" size={13} color="#FFFFFF" />
                  <Text className="text-[13px] font-semibold text-white">
                    {nextDose.scheduledTime12}
                  </Text>
                </View>
              </View>
            </View>

            {!layout.isCompact ? (
              <View accessible={false} className="shrink-0 items-center justify-center pr-1">
                {/* Subtle accent rays above pills */}
                <View className="mb-1 flex-row items-end gap-1.5">
                  <View
                    className="h-2.5 w-[2px] rounded-full bg-white/70"
                    style={{ transform: [{ rotate: '-18deg' }] }}
                  />
                  <View className="h-3 w-[2px] rounded-full bg-white/85" />
                  <View
                    className="h-2.5 w-[2px] rounded-full bg-white/70"
                    style={{ transform: [{ rotate: '18deg' }] }}
                  />
                </View>
                <View className="flex-row items-end -space-x-2">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full border-2 border-[#DCEEE7] bg-white shadow-sm"
                    style={{ transform: [{ rotate: '-20deg' }] }}
                  >
                    <View className="h-[2px] w-7 bg-[#CBD8D3]" />
                  </View>
                  <View
                    className="h-9 w-9 items-center justify-center rounded-full border-2 border-[#DCEEE7] bg-white/95"
                    style={{ transform: [{ rotate: '18deg' }] }}
                  >
                    <View className="h-[1.5px] w-5 bg-[#CBD8D3]" />
                  </View>
                </View>
              </View>
            ) : null}
          </View>

          {/* Bottom row: Take now pill CTA + View schedule link aligned smoothly */}
          <View className="mt-4 flex-row flex-wrap items-center gap-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take now"
              disabled={nextDoseBusy}
              onPress={() => void markDoseStatus(nextDose, 'taken')}
              className="min-h-[40px] flex-row items-center justify-center rounded-full bg-white px-5 py-2 active:bg-mint"
            >
              {nextDoseBusy ? (
                <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
              ) : (
                <Text className="text-[13px] font-bold text-main">Take now</Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View schedule"
              onPress={() => router.push('/schedule')}
              className="min-h-[40px] flex-row items-center gap-1 px-1 py-2"
            >
              <Text className="text-xs font-semibold text-white">View schedule</Text>
              <Feather name="arrow-right" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <View
          className="mt-3.5 flex-row items-center justify-between gap-3 rounded-[18px] border border-[#CBE7DB] bg-mint"
          style={{ padding: layout.cardPadding }}
        >
          <View className="flex-1 min-w-0">
            <Text className="text-[15px] font-bold text-main">
              {totalScheduled > 0 ? 'All doses caught up for today' : 'No upcoming doses today'}
            </Text>
            <Text className="mt-0.5 text-xs text-[#5A706B]">
              {totalScheduled > 0
                ? 'Every scheduled dose for today has been addressed.'
                : 'Open Schedule to set a daily or timed medication plan.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Schedule"
            onPress={() => router.push('/schedule')}
            className="min-h-[38px] shrink-0 flex-row items-center gap-1 rounded-full bg-primary px-3.5 py-2"
          >
            <Text className="text-xs font-semibold text-white">Schedule</Text>
            <Feather name="arrow-right" size={13} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {/* Today's schedule compact summary card */}
      <View className="mt-4 mb-2 flex-row items-center justify-between gap-3">
        <Text className="flex-1 min-w-0 text-[16px] font-bold text-main">
          Today&apos;s schedule
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all ${totalScheduled} doses`}
          className="flex-row items-center gap-1 py-0.5 pl-1 shrink-0"
          onPress={() => router.push('/schedule')}
        >
          <Text className="text-[12px] font-semibold text-primary">
            See all {totalScheduled}
          </Text>
          <Feather name="arrow-right" size={13} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </Pressable>
      </View>

      {doses.length === 0 ? (
        <EmptyState
          title="No doses scheduled for today"
          description="Open Schedule to add your first daily or timed medicine schedule."
          actionLabel="Open Schedule"
          onAction={() => router.push('/schedule')}
          iconName="calendar"
        />
      ) : (
        <View className="overflow-hidden rounded-[18px] border border-border bg-white">
          {visiblePeriods.map((period, idx) => {
            const periodDoses = doses.filter((d) => d.period === period);
            const periodMeta = SCHEDULE_PERIOD_META[period];
            const statusSummary = summarizePeriodStatus(periodDoses);

            return (
              <Pressable
                key={period}
                accessibilityRole="button"
                accessibilityLabel={`${period}, ${periodDoses.length} scheduled doses, ${statusSummary.label}`}
                onPress={() => router.push('/schedule')}
                className={`min-h-[60px] flex-row items-center justify-between gap-2.5 px-3.5 py-3 active:bg-background ${
                  idx > 0 ? 'border-t border-border' : ''
                }`}
              >
                <View className="flex-1 min-w-0 flex-row items-center gap-3">
                  <View
                    className={`h-8 w-8 shrink-0 items-center justify-center rounded-full ${periodMeta.bgClass}`}
                  >
                    <Feather name={periodMeta.icon} size={15} color={periodMeta.color} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[14px] font-bold text-main" numberOfLines={1}>
                      {period}
                    </Text>
                    <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                      {periodDoses.length} scheduled {periodDoses.length === 1 ? 'dose' : 'doses'}
                    </Text>
                  </View>
                </View>

                <View className={`shrink-0 rounded-full px-2.5 py-1 ${statusSummary.bgClass}`}>
                  <Text className={`text-[11px] font-semibold ${statusSummary.textClass}`}>
                    {statusSummary.label}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Medicine supplies status banner */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          lowStockMeds.length > 0
            ? `Medicine supplies: ${lowStockMeds.length} low on stock`
            : 'Medicine supplies: No medicines are low on stock'
        }
        onPress={() => router.push('/medicines')}
        className={`mt-3.5 flex-row items-center justify-between gap-3 rounded-[18px] border px-3.5 py-3 active:opacity-90 ${
          lowStockMeds.length > 0
            ? 'border-[#F3D9A4] bg-[#FDF5E6]'
            : 'border-[#CBE7DB] bg-[#EEF8F3]'
        }`}
      >
        <View className="flex-1 min-w-0 flex-row items-center gap-3">
          <View
            className={`h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              lowStockMeds.length > 0 ? 'bg-white' : 'bg-[#DDF2E8]'
            }`}
          >
            <Feather
              name={lowStockMeds.length > 0 ? 'alert-triangle' : 'disc'}
              size={16}
              color={
                lowStockMeds.length > 0
                  ? CAREDOSE_EXTENDED_COLORS.warning
                  : CAREDOSE_EXTENDED_COLORS.primary
              }
            />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-[14px] font-bold text-main" numberOfLines={1}>
              Medicine supplies
            </Text>
            <Text
              className={`mt-0.5 text-xs font-medium ${
                lowStockMeds.length > 0 ? 'text-warning' : 'text-primary'
              }`}
              numberOfLines={2}
            >
              {lowStockMeds.length > 0
                ? `${lowStockMeds.length} ${lowStockMeds.length === 1 ? 'medicine is' : 'medicines are'} low on stock · ${lowStockMeds[0].name}`
                : activeMeds.length > 0
                  ? 'No medicines are low on stock.'
                  : 'Add your medicines to track stock levels.'}
            </Text>
          </View>
        </View>

        <View
          className={`h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            lowStockMeds.length > 0 ? 'bg-warning' : 'bg-primary'
          }`}
        >
          <Feather
            name={lowStockMeds.length > 0 ? 'chevron-right' : 'check'}
            size={13}
            color="#FFFFFF"
          />
        </View>
      </Pressable>

      {/* Quick overview: Latest glucose & Monthly spend */}
      <Text className="mt-4 mb-2.5 text-[16px] font-bold text-main">
        Quick overview
      </Text>
      <View
        className={layout.stackTwoCol ? 'flex-col' : 'flex-row items-stretch'}
        style={{ gap: layout.gridGap }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Latest glucose ${latestGlucoseValue} mg/dL`}
          onPress={() => setQuickReadingOpen(true)}
          className={`${
            layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'
          } justify-between rounded-[18px] border border-border bg-white p-3.5 active:bg-background`}
        >
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint">
              <Feather name="droplet" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <Text className="flex-1 min-w-0 text-xs font-medium text-[#5A706B]" numberOfLines={1}>
              Latest glucose
            </Text>
          </View>
          <Text className="mt-2 text-[20px] font-bold text-primary" numberOfLines={1}>
            {latestGlucoseValue} mg/dL
          </Text>
          <View className="mt-1.5 flex-row items-center justify-between gap-2">
            <Text className="flex-1 min-w-0 text-[11px] text-[#5A706B]" numberOfLines={1}>
              Fasting · 07:30 AM
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Monthly spend ৳ 720"
          onPress={() => router.push('/expenses')}
          className={`${
            layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'
          } justify-between rounded-[18px] border border-border bg-white p-3.5 active:bg-background`}
        >
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint">
              <Feather name="shopping-bag" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <Text className="flex-1 min-w-0 text-xs font-medium text-[#5A706B]" numberOfLines={1}>
              Monthly spend
            </Text>
          </View>
          <Text className="mt-2 text-[20px] font-bold text-primary" numberOfLines={1}>
            ৳ 720
          </Text>
          <View className="mt-1.5 flex-row items-center justify-between gap-2">
            <Text className="flex-1 min-w-0 text-[11px] text-[#5A706B]" numberOfLines={1}>
              This month
            </Text>
            <Feather
              name="arrow-right"
              size={14}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
          </View>
        </Pressable>
      </View>

      <BottomSheet
        visible={quickReadingOpen}
        title="Log Reading"
        onClose={() => setQuickReadingOpen(false)}
        onSubmit={handleSaveQuickReading}
        submitLabel="Save reading"
      >
        <FormField
          label="Reading value (mg/dL)"
          value={readingValue}
          onChangeText={setReadingValue}
          placeholder="e.g. 106"
          keyboardType="decimal-pad"
          required
          errorMessage={readingErrors.readingValue}
        />
      </BottomSheet>
    </ScreenContainer>
  );
}
