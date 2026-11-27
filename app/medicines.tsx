import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import medicinesHeaderImage from "../assets/medicines-header-illustration.jpg";
import {
  AddMedicineModal,
  EmptyState,
  FilterChips,
  MedicineCard,
  ScreenContainer,
  SearchInput,
  useScreenWaveHeader,
} from "../src/components";
import {
  filterPersonalMedications,
  isPersonalMedicationLowStock,
  MedFilter,
  resolveMedicationStatusVariant,
} from "../src/features/medications/medication-helpers";
import {
  estimateCurrentStockValue,
  formatBdtCurrency,
  formatStockWithUnit,
} from "../src/features/medications/stock-calculator";
import { useMedications } from "../src/features/medications/MedicationsContext";
import { useResponsiveLayout } from "../src/theme/responsive";

export default function MyMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const { medications } = useMedications();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MedFilter>("all");
  const [toast, setToast] = useState<{ key: number; message: string } | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);

  const showToast = (message: string): void => {
    setToast({ key: Date.now(), message });
  };

  const counts = useMemo(() => {
    let active = 0;
    let lowStock = 0;
    let archived = 0;
    for (const m of medications) {
      if (m.archived) {
        archived += 1;
      } else {
        active += 1;
        if (isPersonalMedicationLowStock(m)) {
          lowStock += 1;
        }
      }
    }
    return { active, lowStock, archived };
  }, [medications]);

  const filteredMeds = useMemo(
    () => filterPersonalMedications(medications, { query, filter }),
    [medications, query, filter],
  );

  const { topBanner, topOverlay, overlapPx } = useScreenWaveHeader({
    title: "My Medicines",
    imageSource: medicinesHeaderImage,
    titleSize: "compact",
    titleLines: 1,
    contentMaxWidthPercent: layout.isCompact ? 58 : 60,
    overlapRatio: 0.18,
  });

  const floatingAddButton = (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom: 14,
        left: layout.screenPadding,
        right: layout.screenPadding,
        zIndex: 40,
        alignItems: "center",
      }}
    >
      <View
        pointerEvents="box-none"
        className="w-full flex-row justify-end"
        style={
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth }
            : undefined
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add"
          onPress={() => setAddOpen(true)}
          className="flex-row items-center justify-center rounded-full bg-primary px-5 active:opacity-90"
          style={{
            minHeight: 48,
            shadowColor: "#075D4E",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.24,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text className="ml-1.5 text-[15px] font-bold text-white">Add</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScreenContainer
      title="My Medicines"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
      floatingOverlay={floatingAddButton}
      toastMessage={toast?.message ?? null}
      toastKey={toast?.key}
      onDismissToast={() => setToast(null)}
    >
      {/* Compact Search & Horizontally Scrollable Status Filter Chips directly below header */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-2.5 rounded-card border border-border bg-white p-2.5 shadow-sm"
      >
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search medicines"
        />

        <View className="mt-2">
          <FilterChips
            compact
            options={[
              { key: "all", label: "All", count: medications.length },
              { key: "active", label: "Active", count: counts.active },
              { key: "low_stock", label: "Low Stock", count: counts.lowStock },
              { key: "archived", label: "Archived", count: counts.archived },
            ]}
            selectedKey={filter}
            onSelect={setFilter}
          />
        </View>
      </View>

      {filteredMeds.length === 0 ? (
        <EmptyState
          title="No matching medicines"
          description="Tap '+ Add' below to search the medicine database and add to your care list."
          actionLabel={
            query.trim().length > 0 || filter !== "all"
              ? "Clear filters"
              : "Add medicine"
          }
          onAction={() => {
            if (query.trim().length > 0 || filter !== "all") {
              setQuery("");
              setFilter("all");
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
              imageUrl={med.imageUrl}
              stockText={formatStockWithUnit(med.stockRemaining, med.stockUnit)}
              rightSubtext={
                med.unitPriceText !== "Not listed"
                  ? med.unitPriceText
                  : undefined
              }
              priceText={
                estValue != null
                  ? `Est. ৳${formatBdtCurrency(estValue)}`
                  : med.totalStockPrice != null
                    ? `Paid ৳${formatBdtCurrency(med.totalStockPrice)}`
                    : undefined
              }
              statusVariant={resolveMedicationStatusVariant(med)}
              showStatusIcon
              stackedMetrics
              onPress={() => router.push(`/medicines/${med.id}`)}
            />
          );
        })
      )}

      <AddMedicineModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(created) =>
          showToast(`${created.name} added to My Medicines.`)
        }
      />
    </ScreenContainer>
  );
}
