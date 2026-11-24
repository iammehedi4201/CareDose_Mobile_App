import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AdjustStockModeDto } from '../api/inventory';
import { computeProjectedStockBalance } from '../features/expenses/expense-helpers';
import { PersonalMedicationRecord } from '../features/medications/medication-helpers';
import { useMedications } from '../features/medications/MedicationsContext';
import { formatStockWithUnit } from '../features/medications/stock-calculator';
import { FormField, SelectField } from './FormFields';
import { BottomSheet } from './Overlays';

export interface UpdateStockModalProps {
  visible: boolean;
  medication: PersonalMedicationRecord | null;
  onClose: () => void;
  onSaved?: (outcome: {
    nextStock: number;
    stockUnit: string;
    reason: string;
  }) => void;
}

const MODE_OPTIONS: Array<{
  mode: AdjustStockModeDto;
  label: string;
  defaultReason: string;
}> = [
  { mode: 'ADD', label: 'Add stock', defaultReason: 'Refill' },
  { mode: 'SET', label: 'Set balance', defaultReason: 'Physical count' },
  { mode: 'DEDUCT', label: 'Wastage / deduct', defaultReason: 'Damaged / wasted' },
];

const REASON_OPTIONS = [
  { label: 'Physical count', value: 'Physical count' },
  { label: 'Refill / extra pack', value: 'Refill' },
  { label: 'Damaged / wasted', value: 'Damaged / wasted' },
  { label: 'Expired', value: 'Expired' },
  { label: 'Correction', value: 'Correction' },
];

export function UpdateStockModal({
  visible,
  medication,
  onClose,
  onSaved,
}: UpdateStockModalProps): React.JSX.Element {
  const { adjustMedicationStock } = useMedications();

  const [mode, setMode] = useState<AdjustStockModeDto>('ADD');
  const [quantityInput, setQuantityInput] = useState('');
  const [entryUnitMode, setEntryUnitMode] = useState<'base' | 'strips'>('base');
  const [reason, setReason] = useState('Refill');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hasStripUnit =
    Boolean(medication?.stripUnits && medication.stripUnits > 1);

  useEffect(() => {
    if (!visible) return;
    setMode('ADD');
    setQuantityInput('');
    setEntryUnitMode('base');
    setReason('Refill');
    setNote('');
    setErrorMsg(null);
    setSubmitError(null);
    setSaving(false);
  }, [visible, medication?.id]);

  const handleModeChange = (nextMode: AdjustStockModeDto): void => {
    setMode(nextMode);
    if (nextMode === 'SET') {
      setEntryUnitMode('base');
    }
    const found = MODE_OPTIONS.find((o) => o.mode === nextMode);
    if (found) {
      setReason(found.defaultReason);
    }
    setErrorMsg(null);
    setSubmitError(null);
  };

  const currentStock = medication?.stockRemaining ?? 0;
  const stockUnit = medication?.stockUnit ?? 'units';
  const stripFactor =
    entryUnitMode === 'strips' && hasStripUnit && medication?.stripUnits && mode !== 'SET'
      ? medication.stripUnits
      : 1;

  const rawNum = Number(quantityInput.trim());
  const effectiveQuantityStr =
    quantityInput.trim().length > 0 && Number.isFinite(rawNum)
      ? String(Number((rawNum * stripFactor).toFixed(2)))
      : quantityInput;

  const projection = computeProjectedStockBalance(
    currentStock,
    mode,
    effectiveQuantityStr,
  );

  const handleSubmit = async (): Promise<void> => {
    if (!medication || saving) return;
    if (projection.error || projection.nextBalance === null || projection.quantityValue === null) {
      setErrorMsg(projection.error ?? 'Enter a valid quantity.');
      return;
    }

    setErrorMsg(null);
    setSubmitError(null);
    setSaving(true);
    try {
      const apiMode =
        mode === 'SET' ? 'set' : mode === 'DEDUCT' ? 'deduct' : 'add';
      const enteredQty =
        Number.isFinite(rawNum) && rawNum >= 0 ? Number(rawNum.toFixed(2)) : projection.quantityValue;

      await adjustMedicationStock(medication.id, apiMode, projection.quantityValue, {
        syncRemote: true,
        reason,
        note: note.trim() || undefined,
        enteredQuantity: enteredQty,
        enteredUnit: stripFactor > 1 ? 'strips' : stockUnit,
      });

      onClose();
      onSaved?.({
        nextStock: projection.nextBalance,
        stockUnit,
        reason,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to update stock balance.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      title="Update Stock"
      subtitle={medication ? `${medication.name} (${formatStockWithUnit(currentStock, stockUnit)})` : undefined}
      warningNote="Creates an auditable stock adjustment transaction."
      onClose={onClose}
      onSubmit={medication ? () => void handleSubmit() : undefined}
      submitLabel="Update stock"
      submitLoading={saving}
      submitDisabled={saving || !medication}
    >
      {submitError ? (
        <View className="mb-3 rounded-field border border-[#E8B4B0] bg-[#FDECEC] px-3 py-2.5">
          <Text className="text-xs font-medium text-error">{submitError}</Text>
        </View>
      ) : null}

      <Text className="mb-1.5 text-xs font-semibold text-main">Action</Text>
      <View className="mb-3.5 flex-row flex-wrap gap-2">
        {MODE_OPTIONS.map((opt) => {
          const active = mode === opt.mode;
          return (
            <Pressable
              key={opt.mode}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => handleModeChange(opt.mode)}
              className={`min-h-[38px] items-center justify-center rounded-full border px-3.5 py-2 ${
                active
                  ? 'border-primary bg-primary'
                  : 'border-border bg-white'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  active ? 'text-white' : 'text-main'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hasStripUnit && mode !== 'SET' ? (
        <View className="mb-3 flex-row items-center gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: entryUnitMode === 'base' }}
            onPress={() => setEntryUnitMode('base')}
            className={`min-h-[34px] flex-1 items-center justify-center rounded-field border px-3 py-1.5 ${
              entryUnitMode === 'base'
                ? 'border-primary bg-mint'
                : 'border-border bg-white'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                entryUnitMode === 'base' ? 'text-primary' : 'text-[#5A706B]'
              }`}
            >
              By {stockUnit}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: entryUnitMode === 'strips' }}
            onPress={() => setEntryUnitMode('strips')}
            className={`min-h-[34px] flex-1 items-center justify-center rounded-field border px-3 py-1.5 ${
              entryUnitMode === 'strips'
                ? 'border-primary bg-mint'
                : 'border-border bg-white'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                entryUnitMode === 'strips' ? 'text-primary' : 'text-[#5A706B]'
              }`}
            >
              By strips ({medication?.stripUnits} each)
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FormField
        label={
          mode === 'SET'
            ? `New stock balance (${stockUnit})`
            : stripFactor > 1
              ? `Quantity (strips · ${stripFactor} ${stockUnit} each)`
              : `Quantity (${stockUnit})`
        }
        value={quantityInput}
        onChangeText={(txt) => {
          setQuantityInput(txt);
          setErrorMsg(null);
        }}
        keyboardType="decimal-pad"
        placeholder={mode === 'SET' ? String(currentStock) : 'e.g. 10'}
        required
        errorMessage={errorMsg ?? undefined}
      />

      {projection.nextBalance !== null ? (
        <View className="mb-3 flex-row items-center justify-between rounded-card border border-[#CBE7DB] bg-mint px-3.5 py-2.5">
          <Text className="text-xs font-medium text-[#3C5853]">Projected stock</Text>
          <Text className="text-xs font-bold text-primary">
            {formatStockWithUnit(currentStock, stockUnit)} →{' '}
            {formatStockWithUnit(projection.nextBalance, stockUnit)}
          </Text>
        </View>
      ) : null}

      <SelectField
        label="Reason"
        value={reason}
        options={REASON_OPTIONS}
        onSelect={setReason}
        required
      />

      <FormField
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Verified cabinet count"
      />
    </BottomSheet>
  );
}
