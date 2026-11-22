import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

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
      <View style={[styles.sectionCard, { padding: layout.cardPadding }]}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.sectionTitle, styles.headerTitleFlex]}>Today&apos;s progress</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.linkBtn}
            onPress={() => router.push('/schedule')}
          >
            <Text style={styles.linkText}>View schedule</Text>
          </Pressable>
        </View>

        <View style={styles.progressTextRow}>
          <Feather name="check-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
          <Text style={styles.supportingText}>
            {completedCount} of {totalScheduled} doses completed
          </Text>
        </View>

        <View style={[styles.statsGrid, { gap: layout.gridGap }]}>
          <View style={[styles.statBox, layout.isCompact ? styles.statBoxCompact : null]}>
            <Text style={styles.statNumber}>{totalScheduled}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Scheduled</Text>
          </View>
          <View style={[styles.statBox, layout.isCompact ? styles.statBoxCompact : null]}>
            <Text style={styles.statNumber}>{completedCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Taken</Text>
          </View>
          <View style={[styles.statBox, layout.isCompact ? styles.statBoxCompact : null]}>
            <Text style={styles.statNumber}>{remainingCount}</Text>
            <Text style={styles.statLabel} numberOfLines={1}>Remaining</Text>
          </View>
        </View>
      </View>

      {/* Next dose card — strictly nearest upcoming or due dose */}
      {nextDose ? (
        <View style={[styles.sectionCard, styles.mintCard, { padding: layout.cardPadding }]}>
          <Text style={styles.eyebrowMint}>NEXT DOSE</Text>
          <View style={styles.nextDoseRow}>
            <View style={styles.nextDoseInfo}>
              <Text style={styles.nextDoseTitle}>
                {nextDose.strength
                  ? `${nextDose.medicineName} ${nextDose.strength}`
                  : nextDose.medicineName}
              </Text>
              <Text style={styles.supportingText}>
                {nextDose.doseInstruction} · {nextDose.scheduledTime12}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add dose schedule"
              onPress={() => router.push('/schedule')}
              style={styles.nextDosePlusCircle}
            >
              <Feather name="plus" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </Pressable>
          </View>
          <View style={styles.nextDoseBtnWrap}>
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
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, styles.headerTitleFlex]}>Today&apos;s schedule</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.linkBtn}
          onPress={() => router.push('/schedule')}
        >
          <Text style={styles.linkText}>See all</Text>
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
              <View style={styles.periodHeaderRow}>
                <Text style={[styles.periodTitle, styles.headerTitleFlex]}>{period}</Text>
                <View style={styles.countChip}>
                  <Text style={styles.countChipText}>
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
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, styles.headerTitleFlex]}>
          Medicine supplies ({lowStockMeds.length} low stock)
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.linkBtn}
          onPress={() => router.push('/medicines')}
        >
          <Text style={styles.linkText}>Manage</Text>
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
        style={[
          layout.stackTwoCol ? styles.twoColStacked : styles.twoColRow,
          { gap: layout.gridGap },
        ]}
      >
        <View
          style={[
            styles.sectionCard,
            layout.stackTwoCol ? null : styles.halfCard,
            { padding: layout.effectiveWidth < 400 ? 12 : layout.cardPadding },
          ]}
        >
          <View>
            <Text style={layout.stackTwoCol ? styles.sectionTitle : styles.halfCardTitle}>
              Latest glucose
            </Text>
            <Text style={styles.highlightNumber}>106 mg/dL</Text>
            <Text style={styles.supportingText}>Fasting · 07:30 AM</Text>
          </View>
          <View style={styles.cardActionTop}>
            <SecondaryButton
              compact
              fullWidth
              label="Log reading"
              onPress={() => setQuickReadingOpen(true)}
            />
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            layout.stackTwoCol ? null : styles.halfCard,
            { padding: layout.effectiveWidth < 400 ? 12 : layout.cardPadding },
          ]}
        >
          <View>
            <Text style={layout.stackTwoCol ? styles.sectionTitle : styles.halfCardTitle}>
              Monthly spend
            </Text>
            <Text style={styles.highlightNumber}>৳ 720</Text>
            <Text style={styles.supportingText}>This month</Text>
          </View>
          <View style={styles.cardActionTop}>
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

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  mintCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderColor: '#C5E8D8',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTitleFlex: {
    flex: 1,
    minWidth: 0,
  },
  linkBtn: {
    flexShrink: 0,
    paddingVertical: 2,
    paddingLeft: 4,
  },
  progressTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  supportingText: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  statsGrid: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statBoxCompact: {
    paddingHorizontal: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  statLabel: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  eyebrowMint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  nextDoseRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextDoseInfo: {
    flex: 1,
    minWidth: 0,
  },
  nextDosePlusCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    flexShrink: 0,
  },
  nextDoseTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 2,
  },
  nextDoseBtnWrap: {
    marginTop: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
    marginTop: 4,
  },
  periodHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  periodTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  countChip: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  countChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  twoColRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginTop: 4,
  },
  twoColStacked: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  halfCard: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'space-between',
  },
  halfCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  highlightNumber: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  cardActionTop: {
    marginTop: 12,
  },
});
