import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheet,
  ConfirmDialog,
  DateField,
  EmptyState,
  FormCol,
  FormField,
  FormRow,
  MedicineCard,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SelectField,
  StatusBadge,
  SuccessToast,
  TimeField,
  validateRequiredFields,
} from '../../src/components';
import {
  formatStockQuantity,
  parseNonNegativeNumberInput,
  resolveMedicationStatusVariant,
} from '../../src/features/medications/medication-helpers';
import { useMedications } from '../../src/features/medications/MedicationsContext';
import { useResponsiveLayout } from '../../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../src/theme/tokens';

export default function PersonalMedicineDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    getMedicationById,
    updateMedication,
    archiveMedication,
    restoreMedication,
    adjustMedicationStock,
  } = useMedications();

  const medication = id ? getMedicationById(id) : undefined;

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

  // Secondary modal form states
  const [doseAmount, setDoseAmount] = useState('1 tablet');
  const [scheduledTime, setScheduledTime] = useState('08:00 AM');
  const [purchaseDate, setPurchaseDate] = useState('2026-11-21');
  const [packCount, setPackCount] = useState('1');
  const [unitsPerPack, setUnitsPerPack] = useState('30');
  const [amountPaid, setAmountPaid] = useState('555');
  const [stockAction, setStockAction] = useState('Add stock');
  const [stockDelta, setStockDelta] = useState('10');
  const [stockReason, setStockReason] = useState('Physical count');
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!medication) {
    return (
      <ScreenContainer
        title="Medicine Details"
        onBack={() => router.push('/medicines')}
      >
        <EmptyState
          title="Medicine record not found"
          description="This medicine may have been removed or is not in your active patient list."
          actionLabel="Back to My Medicines"
          onAction={() => router.push('/medicines')}
        />
      </ScreenContainer>
    );
  }

  const statusVariant = resolveMedicationStatusVariant(medication);

  const handleSaveEdit = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { medName, instructions, thresholdInput },
      {
        medName: 'Medicine name',
        instructions: 'Personal instructions',
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

  const handleSavePurchase = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { purchaseDate, packCount, unitsPerPack, amountPaid },
      {
        purchaseDate: 'Purchase date',
        packCount: 'Number of packs',
        unitsPerPack: 'Units per pack',
        amountPaid: 'Amount paid',
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const added = Math.max(0, (Number(packCount) || 1) * (Number(unitsPerPack) || 0));
    await adjustMedicationStock(medication.id, 'add', added);
    setPurchaseOpen(false);
    setErrors({});
    setToast(`Purchase saved (+${added} ${medication.stockUnit} added to stock).`);
  };

  const handleUpdateStock = async (): Promise<void> => {
    const qty = parseNonNegativeNumberInput(stockDelta);
    if (qty === null) {
      setErrors({ stockDelta: 'Enter a valid non-negative number.' });
      return;
    }
    await adjustMedicationStock(
      medication.id,
      stockAction === 'Set balance' ? 'set' : 'add',
      qty,
    );
    setUpdateStockOpen(false);
    setErrors({});
    setToast(`Stock updated (${stockReason}).`);
  };

  const handleOpenGeneric = (): void => {
    if (medication.genericSourceId) {
      router.push(`/explore/generic/${medication.genericSourceId}`);
    } else {
      router.push('/explore');
    }
  };

  return (
    <ScreenContainer
      title={medication.name}
      subtitle={`${medication.strength ?? 'Strength: Not available'} · ${medication.dosageForm}`}
      onBack={() => router.push('/medicines')}
      primaryAction={{
        label: 'Edit',
        onPress: () => {
          setErrors({});
          setEditOpen(true);
        },
      }}
    >
      <SuccessToast message={toast} />

      {/* Top Contextual Actions matching Reference Sheet */}
      <View
        style={
          layout.stackTwoCol
            ? [styles.topActionStacked, { gap: layout.gridGap }]
            : [styles.topActionRow, { gap: layout.gridGap }]
        }
      >
        <PrimaryButton
          compact
          fullWidth={layout.stackTwoCol}
          label="Create Dose"
          onPress={() => setCreateDoseOpen(true)}
          style={layout.stackTwoCol ? undefined : styles.halfBtn}
        />
        <SecondaryButton
          compact
          fullWidth={layout.stackTwoCol}
          label="Record Purchase"
          onPress={() => setPurchaseOpen(true)}
          style={layout.stackTwoCol ? undefined : styles.halfBtn}
        />
      </View>

      {/* Medicine Information Card */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Medicine information</Text>
          <StatusBadge variant={statusVariant} />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Brand name</Text>
          <Text style={styles.infoValue}>{medication.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Generic name</Text>
          {medication.genericName ? (
            <Pressable accessibilityRole="button" onPress={handleOpenGeneric}>
              <Text style={styles.linkText}>{medication.genericName}</Text>
            </Pressable>
          ) : (
            <Text style={styles.infoValue}>Not available</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Strength</Text>
          <Text style={styles.infoValue}>{medication.strength || 'Not available'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Form</Text>
          <Text style={styles.infoValue}>{medication.dosageForm}</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Instructions</Text>
          <Text style={styles.infoValue}>{medication.instructions}</Text>
        </View>
      </View>

      {/* Stock Information Card */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Stock information</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setUpdateStockOpen(true)}
          >
            <Text style={styles.linkText}>Adjust stock</Text>
          </Pressable>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Current stock</Text>
          <Text style={styles.infoValue}>
            {formatStockQuantity(medication.stockRemaining)} {medication.stockUnit}
          </Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Low-stock alert at</Text>
          <Text style={styles.infoValue}>
            {formatStockQuantity(medication.lowStockThreshold)} {medication.stockUnit}
          </Text>
        </View>
      </View>

      {/* Price Information Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Price information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Unit price</Text>
          <Text style={styles.infoValue}>{medication.unitPriceText}</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Reference pack</Text>
          <Text style={styles.infoValue}>
            {medication.referencePackText ?? 'Not available'}
          </Text>
        </View>
      </View>

      {/* Previous Purchases Section */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Previous purchases</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/purchases')}
          >
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>25 Oct 2026 · 30 tablets</Text>
          <Text style={styles.infoValue}>৳555</Text>
        </View>
      </View>

      {/* Schedule Section */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCreateDoseOpen(true)}
          >
            <Text style={styles.linkText}>Edit</Text>
          </Pressable>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <View style={styles.scheduleTextCol}>
            <Text style={styles.scheduleTimeText}>8:00 AM</Text>
            <Text style={styles.infoLabel}>{medication.instructions}</Text>
          </View>
          <StatusBadge variant="active" />
        </View>
      </View>

      {/* Recent Dose History */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>Recent dose history</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/history')}
          >
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>18 Nov 2026 · 8:00 AM</Text>
          <StatusBadge variant="taken" />
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>17 Nov 2026 · 8:00 AM</Text>
          <StatusBadge variant="taken" />
        </View>
      </View>

      {/* Alternative Brands Comparison Preview */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Alternative brands</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            medication.catalogueBrandId
              ? router.push(`/explore/brand/${medication.catalogueBrandId}`)
              : router.push('/alternatives')
          }
        >
          <Text style={styles.linkText}>Compare all</Text>
        </Pressable>
      </View>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
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
        <View style={styles.sectionCard}>
          <Text style={styles.infoLabel}>
            {medication.catalogueBrandId
              ? 'View potential matching brands sharing the same generic, strength, and dosage form.'
              : 'Open Compare all to review matching brands by generic, strength, and form.'}
          </Text>
          {medication.catalogueBrandId ? (
            <View style={styles.loadMoreWrap}>
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

      <View style={styles.archiveWrap}>
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

      {/* Create Dose Modal */}
      <BottomSheet
        visible={createDoseOpen}
        title="Create Dose / Schedule"
        subtitle={medication.name}
        iconName="clock"
        onClose={() => setCreateDoseOpen(false)}
        onSubmit={() => {
          setCreateDoseOpen(false);
          setToast('Schedule saved.');
        }}
        submitLabel="Save schedule"
      >
        <FormRow>
          <FormCol>
            <FormField
              label="Dose amount"
              value={doseAmount}
              onChangeText={setDoseAmount}
              required
            />
          </FormCol>
          <FormCol>
            <TimeField
              label="Scheduled time"
              value={scheduledTime}
              onChangeTime={setScheduledTime}
              required
            />
          </FormCol>
        </FormRow>
      </BottomSheet>

      {/* Record Purchase Modal */}
      <BottomSheet
        visible={purchaseOpen}
        title="Record Purchase"
        subtitle={`Record a pack purchase for ${medication.name}`}
        onClose={() => setPurchaseOpen(false)}
        onSubmit={() => void handleSavePurchase()}
        submitLabel="Save purchase"
      >
        <DateField
          label="Purchase date"
          value={purchaseDate}
          onChangeDate={setPurchaseDate}
          required
          errorMessage={errors.purchaseDate}
        />
        <FormField
          label="Number of packs"
          value={packCount}
          onChangeText={setPackCount}
          keyboardType="numeric"
          required
          errorMessage={errors.packCount}
        />
        <FormField
          label="Units per pack"
          value={unitsPerPack}
          onChangeText={setUnitsPerPack}
          keyboardType="numeric"
          required
          errorMessage={errors.unitsPerPack}
        />
        <FormField
          label="Amount paid (৳ BDT)"
          value={amountPaid}
          onChangeText={setAmountPaid}
          keyboardType="numeric"
          required
          errorMessage={errors.amountPaid}
        />
      </BottomSheet>

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
          required
          errorMessage={errors.instructions}
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
      <BottomSheet
        visible={updateStockOpen}
        title="Update Stock"
        warningNote="Creates an auditable stock adjustment transaction."
        onClose={() => setUpdateStockOpen(false)}
        onSubmit={() => void handleUpdateStock()}
        submitLabel="Update stock"
      >
        <SelectField
          label="Action"
          value={stockAction}
          options={[
            { label: 'Add stock', value: 'Add stock' },
            { label: 'Set balance', value: 'Set balance' },
          ]}
          onSelect={setStockAction}
          required
        />
        <FormField
          label="Quantity"
          value={stockDelta}
          onChangeText={setStockDelta}
          keyboardType="numeric"
          required
          errorMessage={errors.stockDelta}
        />
        <SelectField
          label="Reason"
          value={stockReason}
          options={[
            { label: 'Physical count', value: 'Physical count' },
            { label: 'Damaged / wasted', value: 'Damaged / wasted' },
            { label: 'Correction', value: 'Correction' },
          ]}
          onSelect={setStockReason}
          required
        />
      </BottomSheet>

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

const styles = StyleSheet.create({
  topActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  topActionStacked: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 14,
  },
  halfBtn: {
    flex: 1,
    minWidth: 0,
  },
  scheduleTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  scheduleTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flexShrink: 1,
    minWidth: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
    gap: 16,
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 0,
    maxWidth: '46%',
  },
  infoValue: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
  },
  warningBox: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    padding: 10,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
  },
  archiveWrap: {
    marginVertical: 10,
  },
  loadMoreWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
});
