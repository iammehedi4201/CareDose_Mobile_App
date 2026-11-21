import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheet,
  ConfirmDialog,
  DateField,
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
import { useResponsiveLayout } from '../../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../src/theme/tokens';
import { INITIAL_PERSONAL_MEDS } from '../medicines';

export default function PersonalMedicineDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const baseMed =
    INITIAL_PERSONAL_MEDS.find((m) => m.id === id) ?? INITIAL_PERSONAL_MEDS[0];

  const [medName, setMedName] = useState(baseMed.name);
  const [medStrength, setMedStrength] = useState(baseMed.strength ?? '5 mg');
  const [medForm, setMedForm] = useState(baseMed.dosageForm);
  const [instructions, setInstructions] = useState(baseMed.instructions);
  const [stock, setStock] = useState(baseMed.stockRemaining);
  const [threshold, setThreshold] = useState(String(baseMed.lowStockThreshold));
  const [archived, setArchived] = useState(baseMed.archived);
  const [toast, setToast] = useState<string | null>(null);

  // Modals
  const [createDoseOpen, setCreateDoseOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updateStockOpen, setUpdateStockOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Form states
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

  const isLow = !archived && stock <= Number(threshold);

  const handleSavePurchase = (): void => {
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

    const added = (Number(packCount) || 1) * (Number(unitsPerPack) || 0);
    setStock((prev) => prev + added);
    setPurchaseOpen(false);
    setToast(`Purchase saved (+${added} ${baseMed.stockUnit} added to stock).`);
  };

  const handleUpdateStock = (): void => {
    const qty = Number(stockDelta) || 0;
    if (stockAction === 'Set balance') {
      setStock(Math.max(0, qty));
    } else {
      setStock((prev) => Math.max(0, prev + qty));
    }
    setUpdateStockOpen(false);
    setToast(`Stock updated (${stockReason}).`);
  };

  return (
    <ScreenContainer
      title={medName}
      subtitle={`${medStrength} · ${medForm}`}
      onBack={() => router.push('/medicines')}
      primaryAction={{
        label: 'Edit',
        onPress: () => setEditOpen(true),
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
          <StatusBadge
            variant={archived ? 'archived' : isLow ? 'low_stock' : 'in_stock'}
          />
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Brand name</Text>
          <Text style={styles.infoValue}>{medName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Generic name</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/explore/generic/g-cardizen')}
          >
            <Text style={styles.linkText}>{baseMed.genericName ?? 'Cardizen'}</Text>
          </Pressable>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Strength</Text>
          <Text style={styles.infoValue}>{medStrength || 'Not available'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Form</Text>
          <Text style={styles.infoValue}>{medForm}</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Instructions</Text>
          <Text style={styles.infoValue}>{instructions}</Text>
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
            {stock} {baseMed.stockUnit}
          </Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Low-stock alert at</Text>
          <Text style={styles.infoValue}>
            {threshold} {baseMed.stockUnit}
          </Text>
        </View>
      </View>

      {/* Price Information Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Price information</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Unit price</Text>
          <Text style={styles.infoValue}>{baseMed.unitPriceText}</Text>
        </View>
        <View style={[styles.infoRow, styles.lastRow]}>
          <Text style={styles.infoLabel}>Reference pack</Text>
          <Text style={styles.infoValue}>30 tablets · ৳555.00</Text>
        </View>
      </View>

      {/* Previous Purchases Section (Scroll continuation) */}
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
        <View style={styles.infoRow}>
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
        <View style={styles.infoRow}>
          <View style={styles.scheduleTextCol}>
            <Text style={styles.scheduleTimeText}>8:00 AM</Text>
            <Text style={styles.infoLabel}>{instructions}</Text>
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
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>17 Nov 2026 · 8:00 AM</Text>
          <StatusBadge variant="taken" />
        </View>
      </View>

      {/* Alternative Brands Comparison Preview */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Alternative brands</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/alternatives')}
        >
          <Text style={styles.linkText}>Compare all</Text>
        </Pressable>
      </View>
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Possible matches only. Ask a doctor or pharmacist before changing brands.
        </Text>
      </View>
      {baseMed.genericName === 'Ivabradine' || baseMed.genericName === 'Cardizen' ? (
        <MedicineCard
          name="Cardil 5 mg"
          genericName={baseMed.genericName}
          strength={medStrength}
          dosageForm={medForm}
          stockText="৳15/unit"
          statusVariant="unverified"
          onPress={() => router.push('/explore/brand/103')}
        />
      ) : (
        <View style={styles.sectionCard}>
          <Text style={styles.infoLabel}>
            Open Compare all to review matching brands by generic, strength, and form.
          </Text>
        </View>
      )}

      <View style={styles.archiveWrap}>
        <SecondaryButton
          fullWidth
          label={archived ? 'Restore Medicine to Active' : 'Archive Medicine'}
          onPress={() => {
            if (archived) {
              setArchived(false);
              setToast('Medicine restored to active list.');
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
        subtitle={medName}
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
        subtitle={`Record a pack purchase for ${medName}`}
        onClose={() => setPurchaseOpen(false)}
        onSubmit={handleSavePurchase}
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
        onSubmit={() => {
          setEditOpen(false);
          setToast('Medicine details updated.');
        }}
        submitLabel="Save changes"
      >
        <FormField label="Medicine name" value={medName} onChangeText={setMedName} required />
        <FormField label="Strength" value={medStrength} onChangeText={setMedStrength} />
        <FormField label="Form" value={medForm} onChangeText={setMedForm} />
        <FormField
          label="Personal instructions"
          value={instructions}
          onChangeText={setInstructions}
          required
        />
        <FormField
          label="Low-stock threshold"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          required
        />
      </BottomSheet>

      {/* Update Stock Modal */}
      <BottomSheet
        visible={updateStockOpen}
        title="Update Stock"
        warningNote="Creates an auditable stock adjustment transaction."
        onClose={() => setUpdateStockOpen(false)}
        onSubmit={handleUpdateStock}
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
        description={`Archive ${medName}? It will move to Archived while keeping all past dose and purchase history.`}
        confirmLabel="Archive"
        onConfirm={() => {
          setArchived(true);
          setArchiveConfirmOpen(false);
          setToast('Medicine archived.');
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
});
