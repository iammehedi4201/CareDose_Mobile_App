import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { usePurchases } from '../features/expenses/PurchasesContext';
import {
  computePurchaseTotalUnits,
  computePurchaseUnitPrice,
  formatBdtAmount,
  getPurchaseRefillSuggestion,
  validatePurchaseDraft,
} from '../features/expenses/expense-helpers';
import { useMedications } from '../features/medications/MedicationsContext';
import { formatStockWithUnit } from '../features/medications/stock-calculator';
import { getTodayLocalYmd } from '../features/schedule/dose-rules';
import { PrimaryButton } from './Buttons';
import { DateField, FormCol, FormField, FormRow, SelectField } from './FormFields';
import { BottomSheet } from './Overlays';

export interface RecordPurchaseModalProps {
  visible: boolean;
  initialMedicationId?: string | null;
  lockMedicineSelection?: boolean;
  onClose: () => void;
  onSaved?: (outcome: {
    medicationName: string;
    totalUnitsAdded: number;
    stockUnit: string;
    amountPaid: number;
  }) => void;
}

function inferDefaultUnitsPerPack(
  stripUnits?: number | null,
  referencePackText?: string | null,
  lastPurchasedUnitsPerPack?: number | null,
): string {
  if (stripUnits && stripUnits > 0) {
    return String(stripUnits);
  }
  if (lastPurchasedUnitsPerPack && lastPurchasedUnitsPerPack > 0) {
    return String(Number(lastPurchasedUnitsPerPack.toFixed(2)));
  }
  const ref = referencePackText ?? '';
  const match = /(\d+(?:\.\d+)?)\s*(tablet|capsule|piece|sachet|ml|vial|ampoule|bottle)/i.exec(ref);
  if (match && Number(match[1]) > 0) {
    return match[1];
  }
  return '10';
}

export function RecordPurchaseModal({
  visible,
  initialMedicationId,
  lockMedicineSelection = false,
  onClose,
  onSaved,
}: RecordPurchaseModalProps): React.JSX.Element {
  const router = useRouter();
  const { medications } = useMedications();
  const { purchases, recordPurchase } = usePurchases();
  const purchasesRef = useRef(purchases);
  purchasesRef.current = purchases;

  const availableMeds = useMemo(() => {
    const active = medications.filter((m) => !m.archived);
    if (active.length > 0) {
      if (initialMedicationId && !active.some((m) => m.id === initialMedicationId)) {
        const extra = medications.find((m) => m.id === initialMedicationId);
        return extra ? [extra, ...active] : active;
      }
      return active;
    }
    return medications;
  }, [medications, initialMedicationId]);

  const [selectedMedId, setSelectedMedId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayLocalYmd());
  const [packCount, setPackCount] = useState('1');
  const [unitsPerPack, setUnitsPerPack] = useState('10');
  const [amountPaid, setAmountPaid] = useState('');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedMed = useMemo(
    () =>
      availableMeds.find((m) => m.id === selectedMedId) ??
      availableMeds[0] ??
      null,
    [availableMeds, selectedMedId],
  );

  const refillSuggestion = useMemo(
    () => (selectedMed ? getPurchaseRefillSuggestion(purchases, selectedMed.id) : null),
    [purchases, selectedMed],
  );

  useEffect(() => {
    if (!visible) return;
    const targetMed =
      (initialMedicationId && availableMeds.find((m) => m.id === initialMedicationId)) ||
      availableMeds[0] ||
      null;
    const suggestion = targetMed
      ? getPurchaseRefillSuggestion(purchasesRef.current, targetMed.id)
      : null;
    setSelectedMedId(targetMed?.id ?? '');
    setPurchaseDate(getTodayLocalYmd());
    setPackCount('1');
    setUnitsPerPack(
      inferDefaultUnitsPerPack(
        targetMed?.stripUnits,
        targetMed?.referencePackText,
        suggestion?.lastUnitsPerPack,
      ),
    );
    setAmountPaid('');
    setVendor(suggestion?.lastVendor ?? '');
    setNote('');
    setErrors({});
    setSubmitError(null);
    setSaving(false);
  }, [visible, initialMedicationId, availableMeds]);

  const handleSelectMedication = (medId: string): void => {
    setSelectedMedId(medId);
    const med = availableMeds.find((m) => m.id === medId);
    const suggestion = getPurchaseRefillSuggestion(purchasesRef.current, medId);
    if (med) {
      setUnitsPerPack(
        inferDefaultUnitsPerPack(
          med.stripUnits,
          med.referencePackText,
          suggestion.lastUnitsPerPack,
        ),
      );
    }
    setVendor(suggestion.lastVendor ?? '');
  };

  const livePackCount = Number(packCount);
  const liveUnitsPerPack = Number(unitsPerPack);
  const liveAmountPaid = Number(amountPaid);
  const previewTotalUnits = computePurchaseTotalUnits(livePackCount, liveUnitsPerPack);
  const previewUnitPrice =
    amountPaid.trim().length > 0
      ? computePurchaseUnitPrice(liveAmountPaid, previewTotalUnits)
      : null;

  const handleSubmit = async (): Promise<void> => {
    if (saving) return;
    const { valid, errors: validationErrors } = validatePurchaseDraft({
      medicationId: selectedMed?.id ?? selectedMedId,
      purchaseDate,
      packCount,
      unitsPerPack,
      amountPaid,
      vendor,
      note,
    });
    setErrors(validationErrors);
    setSubmitError(null);
    if (!valid) return;

    setSaving(true);
    try {
      await recordPurchase(valid);
      onClose();
      onSaved?.({
        medicationName: selectedMed?.name ?? 'Medicine',
        totalUnitsAdded: valid.totalUnitsAdded,
        stockUnit: selectedMed?.stockUnit ?? 'units',
        amountPaid: valid.amountPaid,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Could not record purchase. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const medOptions = useMemo(
    () =>
      availableMeds.map((m) => ({
        label: m.strength ? `${m.name} (${m.strength})` : m.name,
        value: m.id,
      })),
    [availableMeds],
  );

  return (
    <BottomSheet
      visible={visible}
      title="Record Purchase"
      subtitle={
        selectedMed
          ? `Adds purchased packs and updates ${selectedMed.name} stock together`
          : 'Log a medicine purchase and update stock automatically'
      }
      onClose={onClose}
      onSubmit={availableMeds.length > 0 ? () => void handleSubmit() : undefined}
      submitLabel="Save purchase"
      submitLoading={saving}
      submitDisabled={saving || availableMeds.length === 0}
      hideFooter={availableMeds.length === 0}
    >
      {availableMeds.length === 0 ? (
        <View className="rounded-card border border-border bg-mint p-4">
          <Text className="text-sm font-semibold text-main">No medicines added yet</Text>
          <Text className="mt-1 text-xs leading-[18px] text-[#5A706B]">
            Add a medicine to My Medicines first so CareDose can record purchases and update its stock balance together.
          </Text>
          <View className="mt-3">
            <PrimaryButton
              label="Go to My Medicines"
              onPress={() => {
                onClose();
                router.push('/medicines');
              }}
              fullWidth
            />
          </View>
        </View>
      ) : (
        <>
          {submitError ? (
            <View className="mb-3 rounded-field border border-[#E8B4B0] bg-[#FDECEC] px-3 py-2.5">
              <Text className="text-xs font-medium text-error">{submitError}</Text>
            </View>
          ) : null}

          {lockMedicineSelection && selectedMed ? (
            <View className="mb-3 rounded-field border border-border bg-background px-3 py-2.5">
              <Text className="text-[11px] font-medium text-[#5A706B]">Medicine</Text>
              <Text className="mt-0.5 text-sm font-semibold text-main">
                {selectedMed.name}
                {selectedMed.strength ? ` · ${selectedMed.strength}` : ''}
              </Text>
            </View>
          ) : (
            <SelectField
              label="Medicine"
              value={selectedMed?.id ?? ''}
              options={medOptions}
              onSelect={handleSelectMedication}
              required
              errorMessage={errors.medicationId}
            />
          )}

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
                placeholder="e.g. 2"
                required
                errorMessage={errors.packCount}
              />
            </FormCol>
            <FormCol>
              <FormField
                label={`Units per pack (${selectedMed?.stockUnit ?? 'units'})`}
                value={unitsPerPack}
                onChangeText={setUnitsPerPack}
                keyboardType="decimal-pad"
                placeholder="e.g. 10"
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
            placeholder={
              refillSuggestion?.lastAmountPaid !== null &&
              refillSuggestion?.lastAmountPaid !== undefined
                ? `e.g. ${refillSuggestion.lastAmountPaid}`
                : 'e.g. 370'
            }
            required
            errorMessage={errors.amountPaid}
          />

          {refillSuggestion?.lastAmountPaid !== null &&
          refillSuggestion?.lastAmountPaid !== undefined &&
          amountPaid.trim() !== String(refillSuggestion.lastAmountPaid) ? (
            <View className="-mt-1.5 mb-3 flex-row flex-wrap items-center justify-between gap-2 rounded-field border border-border bg-background px-3 py-2">
              <Text className="flex-1 min-w-0 shrink text-[11px] text-[#5A706B]">
                Last recorded: {formatBdtAmount(refillSuggestion.lastAmountPaid)}
                {refillSuggestion.lastPackCount
                  ? ` (${refillSuggestion.lastPackCount} ${
                      refillSuggestion.lastPackCount === 1 ? 'pack' : 'packs'
                    })`
                  : ''}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAmountPaid(String(refillSuggestion.lastAmountPaid))}
                className="shrink-0 rounded-full border border-[#C5E8D8] bg-mint px-2.5 py-1"
              >
                <Text className="text-[11px] font-semibold text-primary-dark">
                  Use {formatBdtAmount(refillSuggestion.lastAmountPaid)}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {selectedMed && previewTotalUnits > 0 ? (
            <View className="mb-3 rounded-card border border-[#CBE7DB] bg-mint px-3.5 py-2.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-xs font-medium text-[#3C5853]">Stock added</Text>
                <Text className="text-xs font-bold text-primary">
                  +{formatStockWithUnit(previewTotalUnits, selectedMed.stockUnit)}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between gap-2">
                <Text className="text-[11px] text-[#5A706B]">
                  New balance:{' '}
                  {formatStockWithUnit(
                    selectedMed.stockRemaining + previewTotalUnits,
                    selectedMed.stockUnit,
                  )}
                </Text>
                {previewUnitPrice !== null ? (
                  <Text className="text-[11px] font-semibold text-main">
                    {formatBdtAmount(previewUnitPrice, { keepDecimals: true })} /{' '}
                    {selectedMed.stockUnit}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <FormField
            label="Pharmacy / vendor (optional)"
            value={vendor}
            onChangeText={setVendor}
            placeholder="Enter pharmacy name"
            helperText={
              refillSuggestion?.lastVendor && vendor.trim() === refillSuggestion.lastVendor
                ? 'Suggested from previous purchase'
                : undefined
            }
          />
          {refillSuggestion && refillSuggestion.recentVendors.length > 0 ? (
            <View className="-mt-1.5 mb-3 flex-row flex-wrap items-center gap-1.5">
              <Text className="text-[11px] text-[#5A706B]">Recent:</Text>
              {refillSuggestion.recentVendors.map((pharmacy) => {
                const selected = vendor.trim().toLowerCase() === pharmacy.toLowerCase();
                return (
                  <Pressable
                    key={pharmacy}
                    accessibilityRole="button"
                    onPress={() => setVendor(pharmacy)}
                    className={`rounded-full border px-2.5 py-1 ${
                      selected
                        ? 'border-primary bg-primary'
                        : 'border-[#C5E8D8] bg-mint'
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        selected ? 'text-white' : 'text-primary-dark'
                      }`}
                    >
                      {pharmacy}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <FormField
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="Batch, expiry, or receipt note"
          />
        </>
      )}
    </BottomSheet>
  );
}
