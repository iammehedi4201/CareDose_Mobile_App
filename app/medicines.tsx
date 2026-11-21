import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  FilterChips,
  FormCol,
  FormField,
  FormRow,
  MedicineCard,
  ScreenContainer,
  SearchInput,
  SelectField,
  StatusVariant,
  SuccessToast,
  validateRequiredFields,
} from '../src/components';

type MedFilter = 'all' | 'active' | 'low_stock' | 'archived';

export interface PersonalMedItem {
  id: string;
  name: string;
  genericName?: string;
  strength?: string | null;
  dosageForm: string;
  instructions: string;
  stockRemaining: number;
  stockUnit: string;
  unitPriceText: string;
  lowStockThreshold: number;
  archived: boolean;
}

export const INITIAL_PERSONAL_MEDS: PersonalMedItem[] = [
  {
    id: 'm1',
    name: 'Corvalen 5 mg',
    genericName: 'Ivabradine',
    strength: '5 mg',
    dosageForm: 'Tablet',
    instructions: '1 tablet twice daily after meal',
    stockRemaining: 24,
    stockUnit: 'tablets',
    unitPriceText: '৳18.5/unit',
    lowStockThreshold: 7,
    archived: false,
  },
  {
    id: 'm2',
    name: 'Glymexa 500 mg',
    genericName: 'Metformin',
    strength: '500 mg',
    dosageForm: 'Tablet',
    instructions: '1 tablet with morning meal',
    stockRemaining: 5,
    stockUnit: 'tablets',
    unitPriceText: '৳9/unit',
    lowStockThreshold: 7,
    archived: false,
  },
  {
    id: 'm3',
    name: 'Vitamin D3 1000 IU',
    genericName: 'Cholecalciferol',
    strength: '1000 IU',
    dosageForm: 'Capsule',
    instructions: '1 capsule after lunch',
    stockRemaining: 18,
    stockUnit: 'capsules',
    unitPriceText: '৳7.5/unit',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'm4',
    name: 'Serenil 10 mg',
    genericName: 'Escitalopram',
    strength: '10 mg',
    dosageForm: 'Tablet',
    instructions: '1 tablet before sleep',
    stockRemaining: 12,
    stockUnit: 'tablets',
    unitPriceText: '৳12/unit',
    lowStockThreshold: 5,
    archived: false,
  },
  {
    id: 'm5',
    name: 'Lumigan Drops 0.01%',
    genericName: 'Bimatoprost',
    strength: '0.01%',
    dosageForm: 'Eye Drops',
    instructions: '1 drop every evening',
    stockRemaining: 1,
    stockUnit: 'bottle',
    unitPriceText: '৳320/bottle',
    lowStockThreshold: 1,
    archived: false,
  },
  {
    id: 'm6',
    name: 'Amoxilox 250 mg',
    genericName: 'Amoxicillin',
    strength: '250 mg',
    dosageForm: 'Capsule',
    instructions: 'Completed 7-day course',
    stockRemaining: 0,
    stockUnit: 'capsules',
    unitPriceText: '৳6/unit',
    lowStockThreshold: 5,
    archived: true,
  },
];

export default function MyMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const [meds, setMeds] = useState<PersonalMedItem[]>(INITIAL_PERSONAL_MEDS);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MedFilter>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Add Medicine — Manual Entry Modal
  const [addOpen, setAddOpen] = useState(false);
  const [medName, setMedName] = useState('');
  const [medStrength, setMedStrength] = useState('');
  const [medForm, setMedForm] = useState('Tablet');
  const [medInstructions, setMedInstructions] = useState('');
  const [startingStock, setStartingStock] = useState('10');
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Archive Confirmation Dialog
  const [archiveTarget, setArchiveTarget] = useState<PersonalMedItem | null>(null);

  const filteredMeds = meds.filter((m) => {
    if (filter === 'active' && m.archived) return false;
    if (filter === 'archived' && !m.archived) return false;
    if (filter === 'low_stock' && (m.archived || m.stockRemaining > m.lowStockThreshold)) {
      return false;
    }
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      const hay = `${m.name} ${m.genericName ?? ''} ${m.strength ?? ''} ${m.dosageForm}`.toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  const handleSaveManualMedicine = (): void => {
    const errs = validateRequiredFields(
      { medName, medInstructions, startingStock, threshold },
      {
        medName: 'Medicine name',
        medInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
        threshold: 'Low-stock threshold',
      },
    );
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      return;
    }
    const newMed: PersonalMedItem = {
      id: `m-${Date.now()}`,
      name: medName.trim(),
      strength: medStrength.trim() || null,
      dosageForm: medForm,
      instructions: medInstructions.trim(),
      stockRemaining: Math.max(0, Number(startingStock) || 0),
      stockUnit: medForm.toLowerCase().includes('capsule') ? 'capsules' : 'tablets',
      unitPriceText: 'Not listed',
      lowStockThreshold: Math.max(0, Number(threshold) || 0),
      archived: false,
    };
    setMeds((prev) => [newMed, ...prev]);
    setAddOpen(false);
    setMedName('');
    setMedStrength('');
    setMedInstructions('');
    setToast(`${newMed.name} added to My Medicines.`);
  };

  const handleConfirmArchive = (): void => {
    if (!archiveTarget) return;
    setMeds((prev) =>
      prev.map((m) => (m.id === archiveTarget.id ? { ...m, archived: true } : m)),
    );
    setToast(`${archiveTarget.name} archived. Dose & purchase history preserved.`);
    setArchiveTarget(null);
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
        filteredMeds.map((med) => {
          const isLow = !med.archived && med.stockRemaining <= med.lowStockThreshold;
          const statusVariant: StatusVariant = med.archived
            ? 'archived'
            : isLow
              ? 'low_stock'
              : 'in_stock';
          return (
            <MedicineCard
              key={med.id}
              name={med.name}
              genericName={med.genericName}
              strength={med.strength}
              dosageForm={med.dosageForm}
              stockText={`${med.stockRemaining} ${med.stockUnit}`}
              rightSubtext={med.unitPriceText}
              statusVariant={statusVariant}
              onPress={() => router.push(`/medicines/${med.id}`)}
            />
          );
        })
      )}

      {/* Add Medicine — Manual Entry Modal */}
      <BottomSheet
        visible={addOpen}
        title="Add Medicine"
        onClose={() => setAddOpen(false)}
        onSubmit={handleSaveManualMedicine}
        submitLabel="Save medicine"
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
              keyboardType="number-pad"
              required
              errorMessage={errors.startingStock}
            />
          </FormCol>
          <FormCol>
            <FormField
              label="Low-stock alert"
              value={threshold}
              onChangeText={setThreshold}
              keyboardType="number-pad"
              required
              errorMessage={errors.threshold}
            />
          </FormCol>
        </FormRow>
      </BottomSheet>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        visible={Boolean(archiveTarget)}
        title="Archive Medicine?"
        description={
          archiveTarget
            ? `Archive ${archiveTarget.name}? It will move out of your active list while preserving all past dose history and purchase records.`
            : ''
        }
        confirmLabel="Archive"
        onConfirm={handleConfirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filterWrap: {
    marginTop: 8,
    marginBottom: 10,
  },
});
