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
import { CAREDOSE_EXTENDED_COLORS } from "../src/theme/tokens";

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
    overlapRatio: 0.34,
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
      {/* Floating Stock Overview Tiles matching Home & Schedule summary cards */}
      <View style={{ marginTop: -overlapPx }} className="mb-3 flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Active medicines ${counts.active}`}
          onPress={() =>
            setFilter((prev) => (prev === "active" ? "all" : "active"))
          }
          className="flex-1 min-w-0 rounded-card bg-white px-3 py-2.5 shadow-sm active:opacity-90"
          style={{
            borderWidth: 1,
            borderColor:
              filter === "active"
                ? CAREDOSE_EXTENDED_COLORS.primary
                : CAREDOSE_EXTENDED_COLORS.border,
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather
              name="package"
              size={13}
              color={CAREDOSE_EXTENDED_COLORS.primary}
            />
            <Text
              className="text-[11px] font-semibold text-[#5A706B]"
              numberOfLines={1}
            >
              Active
            </Text>
          </View>
          <Text className="mt-1 text-[20px] font-bold text-main">
            {counts.active}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Low stock medicines ${counts.lowStock}`}
          onPress={() =>
            setFilter((prev) => (prev === "low_stock" ? "all" : "low_stock"))
          }
          className="flex-1 min-w-0 rounded-card px-3 py-2.5 shadow-sm active:opacity-90"
          style={{
            backgroundColor:
              counts.lowStock > 0
                ? CAREDOSE_EXTENDED_COLORS.warningSurface
                : CAREDOSE_EXTENDED_COLORS.mintSurface,
            borderWidth: 1,
            borderColor:
              filter === "low_stock"
                ? CAREDOSE_EXTENDED_COLORS.primary
                : counts.lowStock > 0
                  ? "#F3D9A4"
                  : "#CBE7DB",
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather
              name={counts.lowStock > 0 ? "alert-triangle" : "check-circle"}
              size={13}
              color={
                counts.lowStock > 0
                  ? CAREDOSE_EXTENDED_COLORS.warning
                  : CAREDOSE_EXTENDED_COLORS.primary
              }
            />
            <Text
              className="text-[11px] font-semibold"
              style={{
                color:
                  counts.lowStock > 0
                    ? CAREDOSE_EXTENDED_COLORS.warning
                    : CAREDOSE_EXTENDED_COLORS.primary,
              }}
              numberOfLines={1}
            >
              Low stock
            </Text>
          </View>
          <Text
            className="mt-1 text-[20px] font-bold"
            style={{
              color:
                counts.lowStock > 0
                  ? CAREDOSE_EXTENDED_COLORS.warning
                  : CAREDOSE_EXTENDED_COLORS.primaryDark,
            }}
          >
            {counts.lowStock}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Archived medicines ${counts.archived}`}
          onPress={() =>
            setFilter((prev) => (prev === "archived" ? "all" : "archived"))
          }
          className="flex-1 min-w-0 rounded-card bg-white px-3 py-2.5 shadow-sm active:opacity-90"
          style={{
            borderWidth: 1,
            borderColor:
              filter === "archived"
                ? CAREDOSE_EXTENDED_COLORS.primary
                : CAREDOSE_EXTENDED_COLORS.border,
          }}
        >
          <View className="flex-row items-center gap-1.5">
            <Feather
              name="archive"
              size={13}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
            <Text
              className="text-[11px] font-semibold text-[#5A706B]"
              numberOfLines={1}
            >
              Archived
            </Text>
          </View>
          <Text className="mt-1 text-[20px] font-bold text-main">
            {counts.archived}
          </Text>
        </Pressable>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search medicines"
      />

      <View className="mt-2 mb-3">
        <FilterChips
          options={[
            { key: "all", label: "All", count: medications.length },
            { key: "active", label: "Active", count: counts.active },
            { key: "low_stock", label: "Low stock", count: counts.lowStock },
            { key: "archived", label: "Archived", count: counts.archived },
          ]}
          selectedKey={filter}
          onSelect={setFilter}
        />
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
