import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  DateField,
  FormCol,
  FormField,
  FormRow,
  ScreenContainer,
  SelectField,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';
import { useResponsiveLayout } from '../src/theme/responsive';

const MONTHLY_SERIES = [
  { month: 'Aug', amount: 610 },
  { month: 'Sep', amount: 890 },
  { month: 'Oct', amount: 795 },
  { month: 'Nov', amount: 720 },
];

export default function MedicineExpensesScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [medicine, setMedicine] = useState('Glymexa 500 mg');
  const [purchaseDate, setPurchaseDate] = useState('2026-11-21');
  const [packCount, setPackCount] = useState('1');
  const [unitsPerPack, setUnitsPerPack] = useState('30');
  const [amountPaid, setAmountPaid] = useState('270');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [actualSpentBdt, setActualSpentBdt] = useState(720);

  const monthlyBudgetBdt = 2500;
  const budgetPct = Math.min(100, Math.round((actualSpentBdt / monthlyBudgetBdt) * 100));
  const series = MONTHLY_SERIES.map((m) =>
    m.month === 'Nov' ? { ...m, amount: actualSpentBdt } : m,
  );
  const maxSpend = Math.max(...series.map((s) => s.amount), 1000);

  const handleSavePurchase = (): void => {
    const errs = validateRequiredFields(
      { medicine, purchaseDate, packCount, unitsPerPack, amountPaid },
      {
        medicine: 'Medicine',
        purchaseDate: 'Purchase date',
        packCount: 'Number of packs',
        unitsPerPack: 'Units per pack',
        amountPaid: 'Amount paid',
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    const paid = Number(amountPaid) || 0;
    setActualSpentBdt((prev) => prev + paid);
    setPurchaseOpen(false);
    setVendor('');
    setNote('');
    setToast(`Purchase recorded (৳ ${paid}).`);
  };

  return (
    <ScreenContainer
      title="Medicine Expenses"
      onBack={() => router.push('/profile')}
      primaryAction={{
        label: 'Purchase',
        iconName: 'plus',
        onPress: () => setPurchaseOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      <View style={[styles.summaryCard, { padding: layout.cardPadding }]}>
        <Text style={styles.eyebrowMint}>SPENT THIS MONTH</Text>
        <Text style={styles.bigAmount}>৳ {actualSpentBdt}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${budgetPct}%` }]} />
        </View>
        <Text style={styles.budgetText}>
          {budgetPct}% of ৳ {monthlyBudgetBdt} monthly budget
        </Text>
      </View>

      {/* Monthly Spending Chart */}
      <View style={[styles.chartCard, { padding: layout.cardPadding }]}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Monthly spending</Text>
          <Text style={styles.unitTag}>BDT (৳)</Text>
        </View>
        <View style={styles.barsRow}>
          {series.map((pt) => {
            const h = Math.max(18, Math.round((pt.amount / maxSpend) * 76));
            const isCurrent = pt.month === 'Nov';
            return (
              <View key={pt.month} style={styles.barCol}>
                <Text numberOfLines={1} style={styles.barValue}>
                  ৳{pt.amount}
                </Text>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: layout.isCompact ? 18 : 24,
                      height: h,
                      backgroundColor: isCurrent
                        ? CAREDOSE_EXTENDED_COLORS.primary
                        : '#9FD4C6',
                    },
                  ]}
                />
                <Text numberOfLines={1} style={styles.barLabel}>
                  {pt.month}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={[styles.estimateCard, { padding: layout.cardPadding }]}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Estimated monthly cost</Text>
          <Text style={styles.estimateValue}>৳ 1,185</Text>
        </View>
        <Text style={styles.estimateNote}>Based on active schedules &amp; confirmed prices</Text>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Recent purchases</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/purchases')}
        >
          <Text style={styles.linkText}>See all</Text>
        </Pressable>
      </View>

      <View style={styles.purchaseCard}>
        <View style={styles.purchaseTextCol}>
          <Text style={styles.itemTitle}>Glymexa 500 mg</Text>
          <Text style={styles.itemSub}>18 Nov 2026 · 30 tablets</Text>
        </View>
        <Text style={styles.itemPrice}>৳ 270</Text>
      </View>

      <View style={styles.purchaseCard}>
        <View style={styles.purchaseTextCol}>
          <Text style={styles.itemTitle}>Vitamin D3 1000 IU</Text>
          <Text style={styles.itemSub}>12 Nov 2026 · 60 capsules</Text>
        </View>
        <Text style={styles.itemPrice}>৳ 450</Text>
      </View>

      <BottomSheet
        visible={purchaseOpen}
        title="Record Purchase"
        onClose={() => setPurchaseOpen(false)}
        onSubmit={handleSavePurchase}
        submitLabel="Save purchase"
      >
        <SelectField
          label="Medicine"
          value={medicine}
          options={[
            { label: 'Glymexa 500 mg', value: 'Glymexa 500 mg' },
            { label: 'Corvalen 5 mg', value: 'Corvalen 5 mg' },
            { label: 'Vitamin D3 1000 IU', value: 'Vitamin D3 1000 IU' },
          ]}
          onSelect={setMedicine}
          required
        />
        <DateField
          label="Purchase date"
          value={purchaseDate}
          onChangeDate={setPurchaseDate}
          required
          errorMessage={errors.purchaseDate}
        />
        <FormRow>
          <FormCol>
            <FormField
              label="Number of packs"
              value={packCount}
              onChangeText={setPackCount}
              keyboardType="number-pad"
              required
              errorMessage={errors.packCount}
            />
          </FormCol>
          <FormCol>
            <FormField
              label="Units per pack"
              value={unitsPerPack}
              onChangeText={setUnitsPerPack}
              keyboardType="number-pad"
              required
              errorMessage={errors.unitsPerPack}
            />
          </FormCol>
        </FormRow>
        <FormField
          label="Amount paid (৳ BDT)"
          value={amountPaid}
          onChangeText={setAmountPaid}
          keyboardType="decimal-pad"
          required
          errorMessage={errors.amountPaid}
        />
        <FormField
          label="Pharmacy / vendor (optional)"
          value={vendor}
          onChangeText={setVendor}
          placeholder="Enter pharmacy name"
        />
        <FormField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Add note"
        />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 16,
    marginBottom: 14,
  },
  eyebrowMint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  bigAmount: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  progressTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D4EDE4',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  budgetText: {
    marginTop: 6,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  unitTag: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 0,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 114,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginBottom: 4,
  },
  barFill: {
    width: 24,
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  estimateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flexShrink: 1,
    minWidth: 0,
  },
  estimateValue: {
    fontSize: 16,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flexShrink: 0,
  },
  estimateNote: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
  },
  purchaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  purchaseTextCol: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  itemSub: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
  },
});
