import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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

      <View
        className="bg-mint rounded-card border border-[#C5E8D8] mb-3.5"
        style={{ padding: layout.cardPadding }}
      >
        <Text className="text-[10px] font-bold tracking-[0.7px] text-primary-dark">
          SPENT THIS MONTH
        </Text>
        <Text className="mt-1 text-[26px] font-bold text-primary">৳ {actualSpentBdt}</Text>
        <View className="mt-2.5 h-1.5 rounded-[3px] bg-[#D4EDE4] overflow-hidden">
          <View
            className="h-1.5 rounded-[3px] bg-primary"
            style={{ width: `${budgetPct}%` }}
          />
        </View>
        <Text className="mt-1.5 text-[12px] text-main">
          {budgetPct}% of ৳ {monthlyBudgetBdt} monthly budget
        </Text>
      </View>

      {/* Monthly Spending Chart */}
      <View
        className="bg-white rounded-card border border-border mb-3.5"
        style={{ padding: layout.cardPadding }}
      >
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2.5">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Monthly spending
          </Text>
          <Text className="text-[11px] font-semibold text-[#5A706B] shrink-0">BDT (৳)</Text>
        </View>
        <View className="flex-row items-end justify-between h-[114px] pt-2.5">
          {series.map((pt) => {
            const h = Math.max(18, Math.round((pt.amount / maxSpend) * 76));
            const isCurrent = pt.month === 'Nov';
            return (
              <View key={pt.month} className="flex-1 min-w-0 px-0.5 items-center">
                <Text numberOfLines={1} className="text-[10px] font-semibold text-[#5A706B] mb-1">
                  ৳{pt.amount}
                </Text>
                <View
                  className={isCurrent ? 'rounded-[6px] bg-primary' : 'rounded-[6px] bg-[#9FD4C6]'}
                  style={{
                    width: layout.isCompact ? 18 : 24,
                    height: h,
                  }}
                />
                <Text numberOfLines={1} className="mt-1.5 text-[11px] font-semibold text-[#5A706B]">
                  {pt.month}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View
        className="bg-white rounded-card border border-border mb-3.5"
        style={{ padding: layout.cardPadding }}
      >
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2.5">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Estimated monthly cost
          </Text>
          <Text className="text-[16px] font-bold text-main shrink-0">৳ 1,185</Text>
        </View>
        <Text className="mt-1 text-[12px] text-[#5A706B]">
          Based on active schedules &amp; confirmed prices
        </Text>
      </View>

      <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2.5">
        <Text className="text-[15px] font-semibold text-main shrink min-w-0">
          Recent purchases
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/purchases')}
        >
          <Text className="text-[12px] font-semibold text-primary shrink-0">See all</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mb-2.5">
        <View className="flex-1 min-w-0">
          <Text className="text-[14px] font-semibold text-main">Glymexa 500 mg</Text>
          <Text className="mt-0.5 text-[12px] text-[#5A706B]">18 Nov 2026 · 30 tablets</Text>
        </View>
        <Text className="text-[15px] font-bold text-primary shrink-0">৳ 270</Text>
      </View>

      <View className="flex-row items-center justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mb-2.5">
        <View className="flex-1 min-w-0">
          <Text className="text-[14px] font-semibold text-main">Vitamin D3 1000 IU</Text>
          <Text className="mt-0.5 text-[12px] text-[#5A706B]">12 Nov 2026 · 60 capsules</Text>
        </View>
        <Text className="text-[15px] font-bold text-primary shrink-0">৳ 450</Text>
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
