import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DoseCard,
  EmptyState,
  FormField,
  MedicineCard,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';
import type { ScheduledDoseItemDto, SchedulePeriodGroupDto } from '../src/api/schedules';
import {
  formatStockQuantity,
  isPersonalMedicationLowStock,
  resolveMedicationStatusVariant,
} from '../src/features/medications/medication-helpers';
import { formatStockWithUnit } from '../src/features/medications/stock-calculator';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  formatDayHeadingLabel,
  formatDoseActionFeedback,
  getTodayLocalYmd,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

const HOME_PERIODS: SchedulePeriodGroupDto[] = [
  'Morning',
  'Afternoon',
  'Evening',
  'Bedtime',
];

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();
  const { getLocalRangeDoses, recordDoseAction, pendingOccurrenceKeys } = useSchedules();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickReadingOpen, setQuickReadingOpen] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});

  const todayYmd = getTodayLocalYmd();
  const dailyDoses = useMemo(
    () => getLocalRangeDoses(todayYmd, 1),
    [getLocalRangeDoses, todayYmd],
  );
  const doses = dailyDoses.days[0]?.items ?? [];
  const totalScheduled = dailyDoses.summary.total;
  const completedCount = dailyDoses.summary.taken;
  const remainingCount = dailyDoses.summary.remaining;
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
    setQuickReadingOpen(false);
    setReadingValue('');
    setToastMessage('Glucose reading saved to Health Log.');
  };

  const activeMeds = medications.filter((m) => !m.archived);
  const lowStockMeds = activeMeds.filter(isPersonalMedicationLowStock);
  const supplyHighlight = lowStockMeds[0] ?? activeMeds[0] ?? null;

  return (
    <ScreenContainer
      eyebrow="GOOD MORNING, KARIM"
      title="Today"
      subtitle={formatDayHeadingLabel(todayYmd, todayYmd).replace(/^Today · /, '')}
      rightBadgeText="KH"
    >
      <SuccessToast message={toastMessage} />

      {/* Today's progress card */}
      <View
        className="bg-white rounded-card border border-border mb-3.5"
        style={{ padding: layout.cardPadding }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-[16px] font-semibold text-main flex-1 min-w-0">
            Today&apos;s progress
          </Text>
          <Pressable
            accessibilityRole="button"
            className="shrink-0 py-0.5 pl-1"
            onPress={() => router.push('/schedule')}
          >
            <Text className="text-[12px] font-semibold text-primary">View schedule</Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-1.5 mt-1.5">
          <Feather name="check-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
          <Text className="text-[12px] text-[#5A706B]">
            {completedCount} of {totalScheduled} doses completed
          </Text>
        </View>

        <View className="mt-3.5 flex-row" style={{ gap: layout.gridGap }}>
          <View
            className={`flex-1 min-w-0 bg-background rounded-field border border-border py-2.5 ${
              layout.isCompact ? 'px-1.5' : 'px-2.5'
            }`}
          >
            <Text className="text-[18px] font-bold text-main">{totalScheduled}</Text>
            <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={1}>
              Scheduled
            </Text>
          </View>
          <View
            className={`flex-1 min-w-0 bg-background rounded-field border border-border py-2.5 ${
              layout.isCompact ? 'px-1.5' : 'px-2.5'
            }`}
          >
            <Text className="text-[18px] font-bold text-main">{completedCount}</Text>
            <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={1}>
              Taken
            </Text>
          </View>
          <View
            className={`flex-1 min-w-0 bg-background rounded-field border border-border py-2.5 ${
              layout.isCompact ? 'px-1.5' : 'px-2.5'
            }`}
          >
            <Text className="text-[18px] font-bold text-main">{remainingCount}</Text>
            <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={1}>
              Remaining
            </Text>
          </View>
        </View>
      </View>

      {/* Next dose card — strictly nearest upcoming or due dose */}
      {nextDose ? (
        <View
          className="bg-mint rounded-card border border-[#C5E8D8] mb-3.5"
          style={{ padding: layout.cardPadding }}
        >
          <Text className="text-[10px] font-bold tracking-[0.7px] text-primary-dark">
            NEXT DOSE
          </Text>
          <View className="mt-1.5 flex-row items-center justify-between">
            <View className="flex-1 min-w-0">
              <Text className="text-[16px] font-bold text-main mb-0.5">
                {nextDose.strength
                  ? `${nextDose.medicineName} ${nextDose.strength}`
                  : nextDose.medicineName}
              </Text>
              <Text className="text-[12px] text-[#5A706B]">
                {nextDose.doseInstruction} · {nextDose.scheduledTime12}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add dose schedule"
              onPress={() => router.push('/schedule')}
              className="w-[30px] h-[30px] rounded-full bg-white items-center justify-center ml-2.5 shrink-0"
            >
              <Feather name="plus" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </Pressable>
          </View>
          <View className="mt-3">
            <PrimaryButton
              fullWidth
              label="✓ Mark as Taken"
              loading={Boolean(pendingOccurrenceKeys[nextDose.occurrenceKey])}
              onPress={() => void markDoseStatus(nextDose, 'taken')}
            />
          </View>
        </View>
      ) : null}

      {/* Today's schedule section */}
      <View className="flex-row items-center justify-between gap-3 mb-2.5 mt-1">
        <Text className="text-[16px] font-semibold text-main flex-1 min-w-0">
          Today&apos;s schedule
        </Text>
        <Pressable
          accessibilityRole="button"
          className="shrink-0 py-0.5 pl-1"
          onPress={() => router.push('/schedule')}
        >
          <Text className="text-[12px] font-semibold text-primary">See all</Text>
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
        HOME_PERIODS.map((period) => {
          const periodDoses = doses.filter((d) => d.period === period);
          if (periodDoses.length === 0) return null;
          return (
            <React.Fragment key={period}>
              <View className="flex-row items-center justify-between gap-2.5 mb-2 mt-1">
                <Text className="text-[14px] font-bold text-main flex-1 min-w-0">
                  {period}
                </Text>
                <View className="bg-[#EEF2F0] px-2.5 py-[3px] rounded-full shrink-0">
                  <Text className="text-[11px] font-semibold text-[#5A706B]">
                    {periodDoses.length} {periodDoses.length === 1 ? 'dose' : 'doses'}
                  </Text>
                </View>
              </View>
              {periodDoses.map((dose) => (
                <DoseCard
                  key={dose.occurrenceKey}
                  medicineName={dose.medicineName}
                  strength={dose.strength}
                  doseInstruction={dose.doseInstruction}
                  scheduledTime={dose.scheduledTime12}
                  status={dose.status}
                  actionLoading={Boolean(pendingOccurrenceKeys[dose.occurrenceKey])}
                  onMarkTaken={() => void markDoseStatus(dose, 'taken')}
                  onSkip={() => void markDoseStatus(dose, 'skipped')}
                />
              ))}
            </React.Fragment>
          );
        })
      )}

      {/* Low stock & medicine supplies snapshot */}
      <View className="flex-row items-center justify-between gap-3 mb-2.5 mt-1">
        <Text className="text-[16px] font-semibold text-main flex-1 min-w-0">
          Medicine supplies ({lowStockMeds.length} low stock)
        </Text>
        <Pressable
          accessibilityRole="button"
          className="shrink-0 py-0.5 pl-1"
          onPress={() => router.push('/medicines')}
        >
          <Text className="text-[12px] font-semibold text-primary">Manage</Text>
        </Pressable>
      </View>

      {supplyHighlight ? (
        <MedicineCard
          name={supplyHighlight.name}
          genericName={supplyHighlight.genericName}
          strength={supplyHighlight.strength}
          dosageForm={supplyHighlight.dosageForm}
          stockText={formatStockWithUnit(supplyHighlight.stockRemaining, supplyHighlight.stockUnit)}
          rightSubtext={supplyHighlight.unitPriceText}
          priceText={`Refill threshold: ${formatStockQuantity(supplyHighlight.lowStockThreshold)}`}
          statusVariant={resolveMedicationStatusVariant(supplyHighlight)}
          onPress={() => router.push(`/medicines/${supplyHighlight.id}`)}
        />
      ) : null}

      {/* Latest health reading & expenses shortcuts */}
      <View
        className={layout.stackTwoCol ? 'flex-col mt-1' : 'flex-row items-stretch mt-1'}
        style={{ gap: layout.gridGap }}
      >
        <View
          className={
            layout.stackTwoCol
              ? 'bg-white rounded-card border border-border mb-3.5'
              : 'flex-1 min-w-0 justify-between bg-white rounded-card border border-border mb-3.5'
          }
          style={{ padding: layout.effectiveWidth < 400 ? 12 : layout.cardPadding }}
        >
          <View>
            <Text
              className={
                layout.stackTwoCol
                  ? 'text-[16px] font-semibold text-main'
                  : 'text-[15px] font-semibold text-main'
              }
            >
              Latest glucose
            </Text>
            <Text className="mt-1.5 text-[19px] font-bold text-primary">106 mg/dL</Text>
            <Text className="text-[12px] text-[#5A706B]">Fasting · 07:30 AM</Text>
          </View>
          <View className="mt-3">
            <SecondaryButton
              compact
              fullWidth
              label="Log reading"
              onPress={() => setQuickReadingOpen(true)}
            />
          </View>
        </View>

        <View
          className={
            layout.stackTwoCol
              ? 'bg-white rounded-card border border-border mb-3.5'
              : 'flex-1 min-w-0 justify-between bg-white rounded-card border border-border mb-3.5'
          }
          style={{ padding: layout.effectiveWidth < 400 ? 12 : layout.cardPadding }}
        >
          <View>
            <Text
              className={
                layout.stackTwoCol
                  ? 'text-[16px] font-semibold text-main'
                  : 'text-[15px] font-semibold text-main'
              }
            >
              Monthly spend
            </Text>
            <Text className="mt-1.5 text-[19px] font-bold text-primary">৳ 720</Text>
            <Text className="text-[12px] text-[#5A706B]">This month</Text>
          </View>
          <View className="mt-3">
            <SecondaryButton
              compact
              fullWidth
              label="View expenses"
              onPress={() => router.push('/expenses')}
            />
          </View>
        </View>
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
