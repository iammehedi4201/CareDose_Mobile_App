import React, { useState } from 'react';
import { Text, View } from 'react-native';
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

      <View className="flex-row items-center justify-between flex-wrap gap-2.5 bg-mint rounded-card border border-[#C5E8D8] p-4 mb-3.5">
        <View>
          <Text className="text-[16px] font-bold text-main">{purchases.length} records</Text>
          <Text className="mt-0.5 text-[12px] text-[#5A706B]">Total recorded purchases</Text>
        </View>
        <Text className="text-[20px] font-bold text-primary">৳ {totalBdt}</Text>
      </View>

      {purchases.map((item) => {
        const unitCost =
          item.units > 0 ? `৳${(item.amountBdt / item.units).toFixed(1)}/unit` : '';
        return (
          <View
            key={item.id}
            className="flex-row items-center justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mb-2.5"
          >
            <View className="flex-1 min-w-0 pr-1">
              <Text className="text-[14px] font-semibold text-main">{item.medicineName}</Text>
              <Text className="mt-[3px] text-[12px] text-[#5A706B]">
                {item.date} · {item.packs} pack(s) · {item.units} units
                {unitCost ? ` · ${unitCost}` : ''}
              </Text>
            </View>
            <Text className="text-[15px] font-bold text-primary shrink-0">
              ৳ {item.amountBdt}
            </Text>
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
