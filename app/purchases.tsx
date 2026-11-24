import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EmptyState,
  FilterChips,
  RecordPurchaseModal,
  ScreenContainer,
  SearchInput,
  SuccessToast,
} from '../src/components';
import {
  filterPurchasesList,
  formatBdtAmount,
  formatPurchaseDateCompact,
  formatPurchasePackSummary,
} from '../src/features/expenses/expense-helpers';
import { usePurchases } from '../src/features/expenses/PurchasesContext';
import { useMedications } from '../src/features/medications/MedicationsContext';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

export default function PurchasesScreen(): React.JSX.Element {
  const router = useRouter();
  const { medicationId: paramMedicationId } = useLocalSearchParams<{
    medicationId?: string;
  }>();
  const { medications } = useMedications();
  const { purchases, loading } = usePurchases();

  const [selectedMedFilter, setSelectedMedFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (paramMedicationId && paramMedicationId.trim().length > 0) {
      setSelectedMedFilter(paramMedicationId);
    }
  }, [paramMedicationId]);

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [
      { key: 'ALL', label: 'All medicines' },
    ];
    const seen = new Set<string>();
    for (const item of purchases) {
      if (!seen.has(item.patientMedicationId)) {
        seen.add(item.patientMedicationId);
        chips.push({
          key: item.patientMedicationId,
          label: item.medication?.name ?? 'Medicine',
        });
      }
    }
    if (
      selectedMedFilter !== 'ALL' &&
      !seen.has(selectedMedFilter)
    ) {
      const med = medications.find((m) => m.id === selectedMedFilter);
      if (med) {
        chips.push({ key: med.id, label: med.name });
      }
    }
    return chips;
  }, [purchases, selectedMedFilter, medications]);

  const filteredPurchases = useMemo(
    () =>
      filterPurchasesList(purchases, {
        medicationId: selectedMedFilter,
        query: searchQuery,
      }),
    [purchases, selectedMedFilter, searchQuery],
  );

  const totalSpent = useMemo(
    () =>
      filteredPurchases.reduce(
        (sum, p) => sum + (Number(p.amountPaid) || 0),
        0,
      ),
    [filteredPurchases],
  );

  return (
    <ScreenContainer
      title="Purchase History"
      subtitle="Recorded packs & stock refills"
      onBack={() => router.back()}
      primaryAction={{
        label: '+ Record',
        onPress: () => setPurchaseOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      {/* Summary Banner */}
      <View className="mb-3.5 rounded-card border border-[#CBE7DB] bg-mint p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-medium text-[#3C5853]">
              {selectedMedFilter === 'ALL'
                ? 'Total recorded value'
                : 'Filtered medicine value'}
            </Text>
            <Text className="mt-1 text-2xl font-bold text-primary">
              {formatBdtAmount(totalSpent, { keepDecimals: true })}
            </Text>
          </View>
          <View className="shrink-0 items-end">
            <View className="rounded-full bg-white px-3 py-1.5 border border-[#CBE7DB]">
              <Text className="text-xs font-semibold text-main">
                {filteredPurchases.length}{' '}
                {filteredPurchases.length === 1 ? 'purchase' : 'purchases'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {purchases.length > 0 ? (
        <View className="mb-3">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by medicine, pharmacy, or note..."
            onClear={() => setSearchQuery('')}
          />
          {filterChips.length > 1 ? (
            <View className="mt-2.5">
              <FilterChips
                options={filterChips}
                selectedKey={selectedMedFilter}
                onSelect={setSelectedMedFilter}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {loading && purchases.length === 0 ? (
        <View className="rounded-card border border-border bg-white p-4">
          <Text className="text-xs text-[#5A706B]">Loading purchase records...</Text>
        </View>
      ) : filteredPurchases.length === 0 ? (
        <EmptyState
          iconName="shopping-bag"
          title={
            purchases.length === 0
              ? 'No purchases recorded yet'
              : 'No matching purchases'
          }
          description={
            purchases.length === 0
              ? 'Tap + Record in the header to save a purchase and update your medicine stock together.'
              : 'Try clearing the medicine filter or search query.'
          }
          actionLabel={purchases.length > 0 ? 'Clear filters' : undefined}
          onAction={
            purchases.length > 0
              ? () => {
                  setSelectedMedFilter('ALL');
                  setSearchQuery('');
                }
              : undefined
          }
        />
      ) : (
        <View className="gap-2.5">
          {filteredPurchases.map((item) => {
            const medName = item.medication?.name ?? 'Medicine';
            const strength = item.medication?.strength;
            const unitPriceNum = item.unitPrice !== null ? Number(item.unitPrice) : null;
            const stockUnit = item.medication?.stockUnit ?? 'units';

            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${medName}, ${formatPurchaseDateCompact(item.purchaseDateYmd)}, ${formatBdtAmount(item.amountPaid, { keepDecimals: true })}`}
                onPress={() => router.push(`/medicines/${item.patientMedicationId}`)}
                className="rounded-card border border-border bg-white p-3.5 active:bg-background"
              >
                <View className="flex-row items-start justify-between gap-2.5">
                  <View className="flex-1 min-w-0">
                    <Text className="text-[14px] font-bold text-main" numberOfLines={2}>
                      {medName}
                      {strength ? ` · ${strength}` : ''}
                    </Text>
                    <Text className="mt-1 text-xs font-medium text-[#5A706B]">
                      {formatPurchaseDateCompact(item.purchaseDateYmd)} ·{' '}
                      {formatPurchasePackSummary(item)}
                    </Text>
                  </View>
                  <View className="shrink-0 items-end">
                    <Text className="text-[15px] font-bold text-primary">
                      {formatBdtAmount(item.amountPaid, { keepDecimals: true })}
                    </Text>
                    {unitPriceNum !== null ? (
                      <Text className="mt-0.5 text-[11px] font-medium text-[#5A706B]">
                        {formatBdtAmount(unitPriceNum, { keepDecimals: true })}/{stockUnit.replace(/s$/, '')}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {item.vendor || item.note ? (
                  <View className="mt-2 flex-row items-center justify-between gap-2 border-t border-border pt-2">
                    <View className="flex-1 min-w-0 flex-row items-center gap-1.5">
                      <Feather
                        name="map-pin"
                        size={12}
                        color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                      />
                      <Text className="flex-1 min-w-0 text-[11px] text-[#5A706B]" numberOfLines={1}>
                        {item.vendor || item.note}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={14}
                      color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                    />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <RecordPurchaseModal
        visible={purchaseOpen}
        initialMedicationId={
          selectedMedFilter !== 'ALL' ? selectedMedFilter : undefined
        }
        onClose={() => setPurchaseOpen(false)}
        onSaved={(outcome) => {
          setToast(
            `Purchase saved for ${outcome.medicationName} (+${outcome.totalUnitsAdded} ${outcome.stockUnit}).`,
          );
        }}
      />
    </ScreenContainer>
  );
}
