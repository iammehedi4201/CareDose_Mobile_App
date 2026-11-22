import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  EmptyState,
  FilterChips,
  FormCol,
  FormField,
  FormRow,
  MedicineCard,
  ScreenContainer,
  SearchInput,
  SelectField,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';
import {
  filterPersonalMedications,
  formatStockQuantity,
  inferStockUnit,
  MedFilter,
  parseNonNegativeNumberInput,
  resolveMedicationStatusVariant,
} from '../src/features/medications/medication-helpers';
import { useMedications } from '../src/features/medications/MedicationsContext';

export default function MyMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const { medications, addMedication } = useMedications();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MedFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Add Medicine — Manual Entry Modal
  const [addOpen, setAddOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medGeneric, setMedGeneric] = useState('');
  const [medStrength, setMedStrength] = useState('');
  const [medForm, setMedForm] = useState('Tablet');
  const [medInstructions, setMedInstructions] = useState('');
  const [startingStock, setStartingStock] = useState('10');
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filteredMeds = useMemo(
    () => filterPersonalMedications(medications, { query, filter }),
    [medications, query, filter],
  );

  const handleSaveManualMedicine = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { medName, medInstructions, startingStock, threshold },
      {
        medName: 'Medicine name',
        medInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
        threshold: 'Low-stock threshold',
      },
    );

    const parsedStock = parseNonNegativeNumberInput(startingStock);
    if (parsedStock === null && !errs.startingStock) {
      errs.startingStock = 'Enter a valid non-negative number.';
    }
    const parsedThreshold = parseNonNegativeNumberInput(threshold);
    if (parsedThreshold === null && !errs.threshold) {
      errs.threshold = 'Enter a valid non-negative number.';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0 || parsedStock === null || parsedThreshold === null) {
      return;
    }

    setSaving(true);
    try {
      const created = await addMedication({
        name: medName.trim(),
        genericName: medGeneric.trim() || null,
        strength: medStrength.trim() || null,
        dosageForm: medForm,
        personalInstructions: medInstructions.trim(),
        startingStock: parsedStock,
        stockUnit: inferStockUnit(medForm),
        lowStockThreshold: parsedThreshold,
      });

      setAddOpen(false);
      setMedName('');
      setMedGeneric('');
      setMedStrength('');
      setMedForm('Tablet');
      setMedInstructions('');
      setStartingStock('10');
      setThreshold('5');
      setErrors({});
      setToast(`${created.name} added to My Medicines.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer
      eyebrow="MY CARE"
      title="My Medicines"
      primaryAction={{
        label: 'Add',
        iconName: 'plus',
        onPress: () => setAddOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, brand or generic"
      />

      <View style={styles.filterWrap}>
        <FilterChips
          options={[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Active' },
            { key: 'low_stock', label: 'Low Stock' },
            { key: 'archived', label: 'Archived' },
          ]}
          selectedKey={filter}
          onSelect={setFilter}
        />
      </View>

      {filteredMeds.length === 0 ? (
        <EmptyState
          title="No matching medicines"
          description="Add a medicine from your prescription or clear your search filters."
          actionLabel="Clear filters"
          onAction={() => {
            setQuery('');
            setFilter('all');
          }}
        />
      ) : (
        filteredMeds.map((med) => (
          <MedicineCard
            key={med.id}
            name={med.name}
            genericName={med.genericName}
            strength={med.strength}
            dosageForm={med.dosageForm}
            stockText={`${formatStockQuantity(med.stockRemaining)} ${med.stockUnit}`}
            rightSubtext={med.unitPriceText}
            statusVariant={resolveMedicationStatusVariant(med)}
            onPress={() => router.push(`/medicines/${med.id}`)}
          />
        ))
      )}

      {/* Add Medicine — Manual Entry Modal */}
      <BottomSheet
        visible={addOpen}
        title="Add Medicine"
        warningNote="Product details do not auto-create a schedule. Add dose times separately."
        onClose={() => setAddOpen(false)}
        onSubmit={() => void handleSaveManualMedicine()}
        submitLabel="Save medicine"
        submitLoading={saving}
      >
        <FormField
          label="Medicine name"
          value={medName}
          onChangeText={setMedName}
          placeholder="e.g. Napa 500 mg"
          required
          errorMessage={errors.medName}
        />
        <FormField
          label="Generic / active ingredient"
          value={medGeneric}
          onChangeText={setMedGeneric}
          placeholder="Optional (e.g. Paracetamol)"
        />
        <FormField
          label="Strength"
          value={medStrength}
          onChangeText={setMedStrength}
          placeholder="e.g. 500 mg"
        />
        <SelectField
          label="Dosage form"
          value={medForm}
          options={[
            { label: 'Tablet', value: 'Tablet' },
            { label: 'Capsule', value: 'Capsule' },
            { label: 'Syrup', value: 'Syrup' },
            { label: 'Injection', value: 'Injection' },
            { label: 'Eye Drops', value: 'Eye Drops' },
          ]}
          onSelect={setMedForm}
          required
        />
        <FormField
          label="Personal instructions"
          value={medInstructions}
          onChangeText={setMedInstructions}
          placeholder="e.g. 1 tablet after meal"
          required
          errorMessage={errors.medInstructions}
        />
        <FormRow>
          <FormCol>
            <FormField
              label="Starting stock"
              value={startingStock}
              onChangeText={setStartingStock}
              keyboardType="numeric"
              required
              errorMessage={errors.startingStock}
            />
          </FormCol>
          <FormCol>
            <FormField
              label="Low-stock alert"
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="numeric"
              required
              errorMessage={errors.threshold}
            />
          </FormCol>
        </FormRow>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    marginTop: 8,
    marginBottom: 10,
  },
});
