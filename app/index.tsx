import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DoseCard,
  FormField,
  MedicineCard,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusVariant,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

interface HomeDoseItem {
  id: string;
  period: 'Morning' | 'Afternoon';
  medicineName: string;
  strength: string;
  instruction: string;
  time: string;
  status: StatusVariant;
}

const INITIAL_HOME_DOSES: HomeDoseItem[] = [
  {
    id: 'd1',
    period: 'Morning',
    medicineName: 'Corvalen',
    strength: '5 mg',
    instruction: '1 tablet · After breakfast',
    time: '8:00 AM',
    status: 'missed',
  },
  {
    id: 'd2',
    period: 'Morning',
    medicineName: 'Glymexa',
    strength: '500 mg',
    instruction: '1 tablet · With morning meal',
    time: '8:30 AM',
    status: 'missed',
  },
  {
    id: 'd3',
    period: 'Afternoon',
    medicineName: 'Vitamin D3',
    strength: '1000 IU',
    instruction: '1 capsule · After lunch',
    time: '1:30 PM',
    status: 'upcoming',
  },
  {
    id: 'd4',
    period: 'Afternoon',
    medicineName: 'Serenil',
    strength: '10 mg',
    instruction: '1 tablet · Afternoon',
    time: '4:00 PM',
    status: 'upcoming',
  },
];

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [doses, setDoses] = useState<HomeDoseItem[]>(INITIAL_HOME_DOSES);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickReadingOpen, setQuickReadingOpen] = useState(false);
  const [readingValue, setReadingValue] = useState('');
  const [readingErrors, setReadingErrors] = useState<Record<string, string>>({});

  const totalScheduled = doses.length;
  const completedCount = doses.filter((d) => d.status === 'taken').length;
  const remainingCount = doses.filter((d) => d.status === 'upcoming' || d.status === 'due').length;
  const nextDose = doses.find((d) => d.status === 'upcoming' || d.status === 'due');

  const markDoseStatus = (id: string, nextStatus: 'taken' | 'skipped'): void => {
    setDoses((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: nextStatus } : d)),
    );
    setToastMessage(
      nextStatus === 'taken'
        ? 'Dose marked as taken.'
        : 'Dose marked as skipped (stock unchanged).',
    );
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

  const morningDoses = doses.filter((d) => d.period === 'Morning');
  const afternoonDoses = doses.filter((d) => d.period === 'Afternoon');

  return (
    <ScreenContainer
      eyebrow="GOOD MORNING, KARIM"
      title="Today"
      subtitle="Wed, 18 Nov 2026"
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

      {/* Next dose card */}
      {nextDose ? (
        <View style={[styles.sectionCard, styles.mintCard, { padding: layout.cardPadding }]}>
          <Text style={styles.eyebrowMint}>NEXT DOSE</Text>
          <View style={styles.nextDoseRow}>
            <View style={styles.nextDoseInfo}>
              <Text style={styles.nextDoseTitle}>
                {nextDose.medicineName} {nextDose.strength}
              </Text>
              <Text style={styles.supportingText}>
                {nextDose.instruction} · {nextDose.time}
              </Text>
            </View>
            <View style={styles.nextDosePlusCircle}>
              <Feather name="plus" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
          </View>
          <View style={styles.nextDoseBtnWrap}>
            <PrimaryButton
              fullWidth
              label="✓ Mark as Taken"
              onPress={() => markDoseStatus(nextDose.id, 'taken')}
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

      <View style={styles.periodHeaderRow}>
        <Text style={[styles.periodTitle, styles.headerTitleFlex]}>Morning</Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{morningDoses.length} doses</Text>
        </View>
      </View>
      {morningDoses.map((dose) => (
        <DoseCard
          key={dose.id}
          medicineName={dose.medicineName}
          strength={dose.strength}
          doseInstruction={dose.instruction}
          scheduledTime={dose.time}
          status={dose.status}
          onMarkTaken={() => markDoseStatus(dose.id, 'taken')}
          onSkip={() => markDoseStatus(dose.id, 'skipped')}
        />
      ))}

      <View style={styles.periodHeaderRow}>
        <Text style={[styles.periodTitle, styles.headerTitleFlex]}>Afternoon</Text>
        <View style={styles.countChip}>
          <Text style={styles.countChipText}>{afternoonDoses.length} doses</Text>
        </View>
      </View>
      {afternoonDoses.map((dose) => (
        <DoseCard
          key={dose.id}
          medicineName={dose.medicineName}
          strength={dose.strength}
          doseInstruction={dose.instruction}
          scheduledTime={dose.time}
          status={dose.status}
          onMarkTaken={() => markDoseStatus(dose.id, 'taken')}
          onSkip={() => markDoseStatus(dose.id, 'skipped')}
        />
      ))}

      {/* Low stock & medicine supplies snapshot */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, styles.headerTitleFlex]}>
          Medicine supplies (1 low stock)
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.linkBtn}
          onPress={() => router.push('/medicines')}
        >
          <Text style={styles.linkText}>Manage</Text>
        </Pressable>
      </View>

      <MedicineCard
        name="Glymexa 500 mg"
        genericName="Metformin"
        strength="500 mg"
        dosageForm="Tablet"
        stockText="5 tablets"
        rightSubtext="৳9/unit"
        priceText="Refill threshold: 7"
        statusVariant="low_stock"
        onPress={() => router.push('/medicines/m2')}
      />

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
