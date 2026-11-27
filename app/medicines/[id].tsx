import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import medicinesHeaderImage from '../../assets/medicines-header-illustration.jpg';
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  FormField,
  MedicineCard,
  PrimaryButton,
  RecordPurchaseModal,
  ScheduleModal,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
  SuccessToast,
  UpdateStockModal,
  useScreenWaveHeader,
  validateRequiredFields,
} from '../../src/components';
import {
  formatBdtAmount,
  formatPurchaseDateCompact,
  formatPurchasePackSummary,
} from '../../src/features/expenses/expense-helpers';
import { usePurchases } from '../../src/features/expenses/PurchasesContext';
import {
  parseNonNegativeNumberInput,
  resolveMedicationStatusVariant,
} from '../../src/features/medications/medication-helpers';
import {
  classifyDosageFormStrategy,
  estimateCurrentStockValue,
  formatBdtCurrency,
  formatStockWithUnit,
} from '../../src/features/medications/stock-calculator';
import {
  formatStripUnitsValue,
  getStripUnitsLabel,
  isSolidDosageForm,
} from '../../src/features/catalogue/catalogue-helpers';
import { useMedications } from '../../src/features/medications/MedicationsContext';
import {
  format24To12Hour,
  formatDoseAmountDisplay,
  formatHistoryDateLabel,
  formatRecurrenceSummary,
  LocalScheduleRecord,
} from '../../src/features/schedule/dose-rules';
import { useSchedules } from '../../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../../src/theme/responsive';

export default function PersonalMedicineDetailsScreen(): React.JSX.Element {
  const { id, openSchedule } = useLocalSearchParams<{ id: string; openSchedule?: string }>();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    getMedicationById,
    updateMedication,
    archiveMedication,
    restoreMedication,
  } = useMedications();
  const {
    schedules,
    doseEvents,
  } = useSchedules();
  const { getPurchasesForMedication } = usePurchases();

  const medication = id ? getMedicationById(id) : undefined;
  const medSchedules = schedules.filter((s) => s.patientMedicationId === id);
  const recentMedPurchases = id ? getPurchasesForMedication(id).slice(0, 3) : [];
  const recentMedHistory = doseEvents
    .filter((ev) => ev.patientMedicationId === id)
    .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor))
    .slice(0, 3);

  // Edit modal controlled draft states synced from persisted record
  const [medName, setMedName] = useState(medication?.name ?? '');
  const [medGeneric, setMedGeneric] = useState(medication?.genericName ?? '');
  const [medStrength, setMedStrength] = useState(medication?.strength ?? '');
  const [medForm, setMedForm] = useState(medication?.dosageForm ?? 'Tablet');
  const [instructions, setInstructions] = useState(medication?.instructions ?? '');
  const [thresholdInput, setThresholdInput] = useState(
    medication ? String(medication.lowStockThreshold) : '5',
  );
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!medication) return;
    setMedName(medication.name);
    setMedGeneric(medication.genericName ?? '');
    setMedStrength(medication.strength ?? '');
    setMedForm(medication.dosageForm);
    setInstructions(medication.instructions);
    setThresholdInput(String(medication.lowStockThreshold));
  }, [medication]);

  // Modals
  const [createDoseOpen, setCreateDoseOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updateStockOpen, setUpdateStockOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const handledOpenScheduleRef = useRef(false);

  // Secondary modal form states
  const [editingSchedule, setEditingSchedule] = useState<LocalScheduleRecord | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    title: medication?.name ?? 'Medicine Details',
    subtitle: medication
      ? `${medication.strength ?? 'Strength: Not available'} · ${medication.dosageForm}`
      : undefined,
    imageSource: medicinesHeaderImage,
    onBack: () => router.push('/medicines'),
    primaryAction: medication
      ? {
          label: 'Edit',
          iconName: 'edit-2',
          pill: true,
          onPress: () => {
            setErrors({});
            setEditOpen(true);
          },
        }
      : undefined,
  });

  if (!medication) {
    return (
      <ScreenContainer
        title="Medicine Details"
        hideHeader
        topBanner={topBanner}
        topOverlay={topOverlay}
      >
        <View style={{ marginTop: -overlapPx }}>
          <EmptyState
            title="Medicine record not found"
            description="This medicine may have been removed or is not in your active patient list."
            actionLabel="Back to My Medicines"
            onAction={() => router.push('/medicines')}
          />
        </View>
      </ScreenContainer>
    );
  }

  const statusVariant = resolveMedicationStatusVariant(medication);

  const handleSaveEdit = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { medName, thresholdInput },
      {
        medName: 'Medicine name',
        thresholdInput: 'Low-stock threshold',
      },
    );
    const parsedThreshold = parseNonNegativeNumberInput(thresholdInput);
    if (parsedThreshold === null && !errs.thresholdInput) {
      errs.thresholdInput = 'Enter a valid non-negative number.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0 || parsedThreshold === null) {
      return;
    }

    await updateMedication(medication.id, {
      name: medName.trim(),
      genericName: medGeneric.trim() || null,
      strength: medStrength.trim() || null,
      dosageForm: medForm.trim() || 'Tablet',
      instructions: instructions.trim(),
      lowStockThreshold: parsedThreshold,
    });

    setEditOpen(false);
    setErrors({});
    setToast('Medicine details updated.');
  };

  const handleOpenGeneric = (): void => {
    if (medication.genericSourceId) {
      router.push(`/explore/generic/${medication.genericSourceId}`);
    } else {
      router.push('/explore');
    }
  };

  const openDoseScheduleModal = (
    target?: (typeof medSchedules)[number],
  ): void => {
    setErrors({});
    setEditingSchedule(target ?? null);
    setCreateDoseOpen(true);
  };

  useEffect(() => {
    if (openSchedule === '1' && medication && !handledOpenScheduleRef.current) {
      handledOpenScheduleRef.current = true;
      setErrors({});
      setEditingSchedule(null);
      setCreateDoseOpen(true);
    }
  }, [openSchedule, medication]);

  const estimatedCurrentStockValue = estimateCurrentStockValue({
    stockRemaining: medication.stockRemaining,
    stockUnit: medication.stockUnit,
    unitPriceText: medication.unitPriceText,
    referencePackText: medication.referencePackText,
  });

  return (
    <ScreenContainer
      title={medication.name}
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <SuccessToast message={toast} />

      {/* Top Contextual Actions matching Reference Sheet */}
      <View
        className={layout.stackTwoCol ? 'flex-col mb-3.5' : 'flex-row mb-3.5'}
        style={{ marginTop: -overlapPx, gap: layout.gridGap }}
      >
        <PrimaryButton
          compact
          fullWidth={layout.stackTwoCol}
          label={medSchedules.length > 0 ? 'Edit Schedule' : 'Create Dose'}
          onPress={() => openDoseScheduleModal(medSchedules[0])}
          className={layout.stackTwoCol ? '' : 'flex-1 min-w-0'}
        />
        <SecondaryButton
          compact
          fullWidth={layout.stackTwoCol}
          label="Record Purchase"
          onPress={() => setPurchaseOpen(true)}
          className={layout.stackTwoCol ? '' : 'flex-1 min-w-0'}
        />
      </View>

      {/* Medicine Information Card */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Medicine information
          </Text>
          <StatusBadge variant={statusVariant} />
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Brand name</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.name}
          </Text>
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Generic name</Text>
          {medication.genericName ? (
            <Pressable accessibilityRole="button" onPress={handleOpenGeneric}>
              <Text className="text-[12px] font-semibold text-primary shrink-0">
                {medication.genericName}
              </Text>
            </Pressable>
          ) : (
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              Not available
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Strength</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.strength || 'Not available'}
          </Text>
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Form</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.dosageForm}
          </Text>
        </View>
        {isSolidDosageForm(medication.dosageForm) && medication.stripUnits ? (
          <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              {getStripUnitsLabel(medication.dosageForm)}
            </Text>
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              {formatStripUnitsValue(medication.stripUnits, medication.dosageForm)}
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              Quantity unit
            </Text>
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              {classifyDosageFormStrategy(medication.dosageForm) === 'suppository'
                ? 'Pieces'
                : medication.stockUnit === 'ml'
                  ? 'ml (bottle volume)'
                  : medication.stockUnit}
            </Text>
          </View>
        )}
        <View className="flex-row items-center justify-between py-2 pb-0.5 gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Instructions</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.instructions.trim().length > 0
              ? medication.instructions
              : 'Not set (optional)'}
          </Text>
        </View>
      </View>

      {/* Stock Information Card */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Stock information
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setUpdateStockOpen(true)}
          >
            <Text className="text-[12px] font-semibold text-primary shrink-0">Adjust stock</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Current stock</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {formatStockWithUnit(medication.stockRemaining, medication.stockUnit)}
            {medication.stripUnits && medication.stockRemaining > 0 && medication.stripUnits > 1
              ? ` (${(medication.stockRemaining / medication.stripUnits).toFixed(1).replace(/\.0$/, '')} strips)`
              : ''}
          </Text>
        </View>
        {medication.openingEntryText ? (
          <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              Opening stock entry
            </Text>
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              {medication.openingEntryText}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between py-2 pb-0.5 gap-4">
          <View>
            <Text className="text-[12px] text-[#5A706B]">Low-stock alert at</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setErrors({});
                setEditOpen(true);
              }}
            >
              <Text className="text-[12px] font-semibold text-primary shrink-0">Edit alert</Text>
            </Pressable>
          </View>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {formatStockWithUnit(medication.lowStockThreshold, medication.stockUnit)}
          </Text>
        </View>
      </View>

      {/* Price Information Card */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-semibold text-main shrink min-w-0">
          Price information
        </Text>
        {estimatedCurrentStockValue != null ? (
          <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              Estimated stock value
            </Text>
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              ৳{formatBdtCurrency(estimatedCurrentStockValue)}
            </Text>
          </View>
        ) : null}
        {medication.totalStockPrice != null ? (
          <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              Actual amount paid
            </Text>
            <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
              ৳{formatBdtCurrency(medication.totalStockPrice)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
            Catalogue unit rate
          </Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.unitPriceText}
          </Text>
        </View>
        <View className="flex-row items-center justify-between py-2 pb-0.5 gap-4">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Reference pack</Text>
          <Text className="flex-1 min-w-0 text-right text-[13px] font-semibold text-main">
            {medication.referencePackText ?? 'Not available'}
          </Text>
        </View>
      </View>

      {/* Previous Purchases Section */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Previous purchases
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/purchases?medicationId=${medication.id}`)}
          >
            <Text className="text-[12px] font-semibold text-primary shrink-0">See all</Text>
          </Pressable>
        </View>
        {recentMedPurchases.length === 0 ? (
          <View className="py-2 pb-0.5">
            <Text className="text-[12px] text-[#5A706B]">
              No purchases recorded for this medicine yet.
            </Text>
          </View>
        ) : (
          recentMedPurchases.map((pur, idx) => (
            <View
              key={pur.id}
              className={`flex-row items-center justify-between py-2 gap-4 ${
                idx === recentMedPurchases.length - 1 ? 'pb-0.5' : 'border-b border-border'
              }`}
            >
              <View className="flex-1 min-w-0">
                <Text className="text-[12px] text-[#5A706B]" numberOfLines={1}>
                  {formatPurchaseDateCompact(pur.purchaseDateYmd)} ·{' '}
                  {formatPurchasePackSummary(pur)}
                </Text>
                {pur.vendor ? (
                  <Text className="text-[11px] text-[#7A8F8A]" numberOfLines={1}>
                    {pur.vendor}
                  </Text>
                ) : null}
              </View>
              <Text className="text-[13px] font-semibold text-main shrink-0">
                {formatBdtAmount(pur.amountPaid, { keepDecimals: true })}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Schedule Section */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">Schedule</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => openDoseScheduleModal(medSchedules[0])}
          >
            <Text className="text-[12px] font-semibold text-primary shrink-0">
              {medSchedules.length > 0 ? 'Edit' : 'Add'}
            </Text>
          </Pressable>
        </View>
        {medSchedules.length === 0 ? (
          <View className="flex-row items-center justify-between py-2 pb-0.5 gap-4">
            <Text className="text-[12px] text-[#5A706B]">No active schedule saved yet.</Text>
          </View>
        ) : (
          medSchedules.map((sched, idx) => (
            <View
              key={sched.id}
              className={`flex-row items-center justify-between py-2 gap-4 ${
                idx === medSchedules.length - 1 ? 'pb-0.5' : 'border-b border-border'
              }`}
            >
              <View className="flex-1 min-w-0 pr-2">
                <Text className="text-[13px] font-semibold text-main">
                  {sched.scheduledTimes.map(format24To12Hour).join(' · ')}
                </Text>
                <Text className="text-[12px] text-[#5A706B]">
                  {formatRecurrenceSummary(sched)} ·{' '}
                  {formatDoseAmountDisplay(sched.doseAmount, sched.doseUnit)}
                </Text>
              </View>
              <StatusBadge
                variant={
                  sched.status === 'ACTIVE'
                    ? 'active'
                    : sched.status === 'PAUSED'
                      ? 'paused'
                      : sched.status === 'COMPLETED'
                        ? 'completed'
                        : 'archived'
                }
              />
            </View>
          ))
        )}
      </View>

      {/* Recent Dose History */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
          <Text className="text-[15px] font-semibold text-main shrink min-w-0">
            Recent dose history
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/history?medicationId=${medication.id}`)}
          >
            <Text className="text-[12px] font-semibold text-primary shrink-0">See all</Text>
          </Pressable>
        </View>
        {recentMedHistory.length === 0 ? (
          <View className="flex-row items-center justify-between py-2 pb-0.5 gap-4">
            <Text className="text-[12px] text-[#5A706B]">
              No recorded doses for this medicine yet.
            </Text>
          </View>
        ) : (
          recentMedHistory.map((ev, idx) => (
            <View
              key={ev.id}
              className={`flex-row items-center justify-between py-2 gap-4 ${
                idx === recentMedHistory.length - 1 ? 'pb-0.5' : 'border-b border-border'
              }`}
            >
              <Text className="text-[12px] text-[#5A706B]">
                {formatHistoryDateLabel(ev.scheduledDateYmd)} ·{' '}
                {format24To12Hour(ev.scheduledTime24)}
              </Text>
              <StatusBadge variant={ev.status} />
            </View>
          ))
        )}
      </View>

      {/* Alternative Brands Comparison Preview */}
      <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
        <Text className="text-[15px] font-semibold text-main shrink min-w-0">
          Alternative brands
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            medication.catalogueBrandId
              ? router.push(`/explore/brand/${medication.catalogueBrandId}`)
              : router.push('/alternatives')
          }
        >
          <Text className="text-[12px] font-semibold text-primary shrink-0">Compare all</Text>
        </Pressable>
      </View>
      <View className="bg-[#FDF5E6] rounded-field border border-[#F3D9A4] p-2.5 mb-2.5">
        <Text className="text-[11px] text-warning font-semibold">
          Possible matches only. Ask a doctor or pharmacist before changing brands.
        </Text>
      </View>
      {medication.genericName === 'Ivabradine' || medication.genericName === 'Cardizen' ? (
        <MedicineCard
          name="Cardil 5 mg"
          genericName={medication.genericName}
          strength={medication.strength}
          dosageForm={medication.dosageForm}
          stockText="৳15/unit"
          statusVariant="unverified"
          showStatusBadge={false}
          onPress={() => router.push('/explore/brand/103')}
        />
      ) : (
        <View className="bg-white rounded-card border border-border p-4 mb-3.5">
          <Text className="text-[12px] text-[#5A706B] leading-[17px]">
            {medication.catalogueBrandId
              ? 'View potential matching brands sharing the same generic, strength, and dosage form.'
              : 'Open Compare all to review matching brands by generic, strength, and form.'}
          </Text>
          {medication.catalogueBrandId ? (
            <View className="mt-1 mb-2.5">
              <SecondaryButton
                fullWidth
                label="Load More matching brands"
                onPress={() =>
                  router.push(`/explore/brand/${medication.catalogueBrandId}/alternatives`)
                }
              />
            </View>
          ) : null}
        </View>
      )}

      <View className="my-2.5">
        <SecondaryButton
          fullWidth
          label={medication.archived ? 'Restore Medicine to Active' : 'Archive Medicine'}
          onPress={() => {
            if (medication.archived) {
              void restoreMedication(medication.id).then(() => {
                setToast(`${medication.name} restored to active list.`);
              });
            } else {
              setArchiveConfirmOpen(true);
            }
          }}
        />
      </View>

      {/* Create / Edit Dose Modal */}
      <ScheduleModal
        visible={createDoseOpen}
        initialMedicationId={medication.id}
        lockMedicineSelection
        editingSchedule={editingSchedule}
        onClose={() => {
          setCreateDoseOpen(false);
          setEditingSchedule(null);
        }}
        onSaved={(_, isEdit) => {
          setToast(isEdit ? 'Dose schedule updated.' : 'Dose schedule saved.');
        }}
      />

      {/* Record Purchase Modal */}
      <RecordPurchaseModal
        visible={purchaseOpen}
        initialMedicationId={medication.id}
        lockMedicineSelection
        onClose={() => setPurchaseOpen(false)}
        onSaved={(outcome) => {
          setToast(
            `Purchase saved (+${outcome.totalUnitsAdded} ${outcome.stockUnit} added to stock).`,
          );
        }}
      />

      {/* Edit Medicine Modal */}
      <BottomSheet
        visible={editOpen}
        title="Edit Medicine"
        warningNote="Changing product details does not change your saved dose schedule."
        onClose={() => setEditOpen(false)}
        onSubmit={() => void handleSaveEdit()}
        submitLabel="Save changes"
      >
        <FormField
          label="Medicine name"
          value={medName}
          onChangeText={setMedName}
          required
          errorMessage={errors.medName}
        />
        <FormField
          label="Generic / active ingredient"
          value={medGeneric}
          onChangeText={setMedGeneric}
        />
        <FormField label="Strength" value={medStrength} onChangeText={setMedStrength} />
        <FormField label="Form" value={medForm} onChangeText={setMedForm} />
        <FormField
          label="Personal instructions"
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Optional notes or take after meal"
        />
        <FormField
          label="Low-stock threshold"
          value={thresholdInput}
          onChangeText={setThresholdInput}
          keyboardType="numeric"
          required
          errorMessage={errors.thresholdInput}
        />
      </BottomSheet>

      {/* Update Stock Modal */}
      <UpdateStockModal
        visible={updateStockOpen}
        medication={medication}
        onClose={() => setUpdateStockOpen(false)}
        onSaved={(outcome) => {
          setToast(
            `Stock updated to ${outcome.nextStock} ${outcome.stockUnit} (${outcome.reason}).`,
          );
        }}
      />

      {/* Archive Confirmation */}
      <ConfirmDialog
        visible={archiveConfirmOpen}
        title="Archive Medicine?"
        description={`Archive ${medication.name}? It will move to Archived while keeping all past dose and purchase history.`}
        confirmLabel="Archive"
        onConfirm={() => {
          void archiveMedication(medication.id).then(() => {
            setArchiveConfirmOpen(false);
            setToast(`${medication.name} archived. Dose & purchase history preserved.`);
          });
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </ScreenContainer>
  );
}
