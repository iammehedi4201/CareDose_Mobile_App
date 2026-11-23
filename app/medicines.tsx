import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AddMedicineModal,
  EmptyState,
  FilterChips,
  MedicineCard,
  ScreenContainer,
  SearchInput,
  SuccessToast,
} from '../src/components';
import {
  filterPersonalMedications,
  MedFilter,
  resolveMedicationStatusVariant,
} from '../src/features/medications/medication-helpers';
import {
  estimateCurrentStockValue,
  formatBdtCurrency,
  formatStockWithUnit,
} from '../src/features/medications/stock-calculator';
import { useMedications } from '../src/features/medications/MedicationsContext';

export default function MyMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const { medications } = useMedications();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MedFilter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filteredMeds = useMemo(
    () => filterPersonalMedications(medications, { query, filter }),
    [medications, query, filter],
  );

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
          description="Tap '+ Add' above to search the medicine database and add to your care list."
          actionLabel={query.trim().length > 0 || filter !== 'all' ? 'Clear filters' : 'Add medicine'}
          onAction={() => {
            if (query.trim().length > 0 || filter !== 'all') {
              setQuery('');
              setFilter('all');
            } else {
              setAddOpen(true);
            }
          }}
        />
      ) : (
        filteredMeds.map((med) => {
          const estValue = estimateCurrentStockValue({
            stockRemaining: med.stockRemaining,
            stockUnit: med.stockUnit,
            unitPriceText: med.unitPriceText,
            referencePackText: med.referencePackText,
          });
          return (
            <MedicineCard
              key={med.id}
              name={med.name}
              genericName={med.genericName}
              strength={med.strength}
              dosageForm={med.dosageForm}
              stockText={formatStockWithUnit(med.stockRemaining, med.stockUnit)}
              rightSubtext={med.unitPriceText !== 'Not listed' ? med.unitPriceText : undefined}
              priceText={
                estValue != null
                  ? `Est. ৳${formatBdtCurrency(estValue)}`
                  : med.totalStockPrice != null
                    ? `Paid ৳${formatBdtCurrency(med.totalStockPrice)}`
                    : undefined
              }
              statusVariant={resolveMedicationStatusVariant(med)}
              onPress={() => router.push(`/medicines/${med.id}`)}
            />
          );
        })
      )}

      <AddMedicineModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(created) => setToast(`${created.name} added to My Medicines.`)}
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
