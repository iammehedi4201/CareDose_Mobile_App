import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

interface PurchaseRecordItem {
  id: string;
  medicineName: string;
  date: string;
  packs: number;
  units: number;
  amountBdt: number;
}

const INITIAL_PURCHASES: PurchaseRecordItem[] = [
  { id: 'p1', medicineName: 'Glymexa 500 mg', date: '2026-11-18', packs: 1, units: 30, amountBdt: 270 },
  { id: 'p2', medicineName: 'Vitamin D3 1000 IU', date: '2026-11-12', packs: 1, units: 60, amountBdt: 450 },
  { id: 'p3', medicineName: 'Corvalen 5 mg', date: '2026-10-25', packs: 1, units: 30, amountBdt: 555 },
  { id: 'p4', medicineName: 'Serenil 10 mg', date: '2026-10-14', packs: 1, units: 20, amountBdt: 240 },
];

export default function PurchaseHistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const [purchases, setPurchases] = useState<PurchaseRecordItem[]>(INITIAL_PURCHASES);
  const [modalOpen, setModalOpen] = useState(false);
  const [medicineName, setMedicineName] = useState('Corvalen 5 mg');
  const [date, setDate] = useState('2026-11-21');
  const [packs, setPacks] = useState('1');
  const [units, setUnits] = useState('30');
  const [amount, setAmount] = useState('555');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const totalBdt = purchases.reduce((acc, p) => acc + p.amountBdt, 0);

  const handleRecordPurchase = (): void => {
    const errs = validateRequiredFields(
      { medicineName, date, packs, units, amount },
      {
        medicineName: 'Medicine',
        date: 'Purchase date',
        packs: 'Number of packs',
        units: 'Units per pack',
        amount: 'Amount paid',
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    setPurchases((prev) => [
      {
        id: `p-${Date.now()}`,
        medicineName,
        date,
        packs: Number(packs) || 1,
        units: Number(units) || 1,
        amountBdt: Number(amount) || 0,
      },
      ...prev,
    ]);
    setModalOpen(false);
    setVendor('');
    setNote('');
    setToast('Purchase saved and stock updated.');
  };

  return (
    <ScreenContainer
      title="Purchase History"
      onBack={() => router.push('/profile')}
      primaryAction={{
        label: 'Record',
        iconName: 'plus',
        onPress: () => setModalOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      <View style={styles.summaryBanner}>
        <View>
          <Text style={styles.summaryCount}>{purchases.length} records</Text>
          <Text style={styles.summarySub}>Total recorded purchases</Text>
        </View>
        <Text style={styles.summaryTotal}>৳ {totalBdt}</Text>
      </View>

      {purchases.map((item) => {
        const unitCost =
          item.units > 0 ? `৳${(item.amountBdt / item.units).toFixed(1)}/unit` : '';
        return (
          <View key={item.id} style={styles.rowCard}>
            <View style={styles.leftCol}>
              <Text style={styles.medTitle}>{item.medicineName}</Text>
              <Text style={styles.metaText}>
                {item.date} · {item.packs} pack(s) · {item.units} units
                {unitCost ? ` · ${unitCost}` : ''}
              </Text>
            </View>
            <Text style={styles.priceText}>৳ {item.amountBdt}</Text>
          </View>
        );
      })}

      <BottomSheet
        visible={modalOpen}
        title="Record Purchase"
        onClose={() => setModalOpen(false)}
        onSubmit={handleRecordPurchase}
        submitLabel="Save purchase"
      >
        <SelectField
          label="Medicine"
          value={medicineName}
          options={[
            { label: 'Corvalen 5 mg', value: 'Corvalen 5 mg' },
            { label: 'Glymexa 500 mg', value: 'Glymexa 500 mg' },
            { label: 'Vitamin D3 1000 IU', value: 'Vitamin D3 1000 IU' },
          ]}
          onSelect={setMedicineName}
          required
        />
        <DateField
          label="Purchase date"
          value={date}
          onChangeDate={setDate}
          required
          errorMessage={errors.date}
        />
        <FormRow>
          <FormCol>
            <FormField
              label="Number of packs"
              value={packs}
              onChangeText={setPacks}
              keyboardType="number-pad"
              required
              errorMessage={errors.packs}
            />
          </FormCol>
          <FormCol>
            <FormField
              label="Units per pack"
              value={units}
              onChangeText={setUnits}
              keyboardType="number-pad"
              required
              errorMessage={errors.units}
            />
          </FormCol>
        </FormRow>
        <FormField
          label="Amount paid (৳ BDT)"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          required
          errorMessage={errors.amount}
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
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 16,
    marginBottom: 14,
  },
  summaryCount: {
    fontSize: 16,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  summarySub: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  summaryTotal: {
    fontSize: 20,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  rowCard: {
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
  leftCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  medTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  metaText: {
    marginTop: 3,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
  },
});
