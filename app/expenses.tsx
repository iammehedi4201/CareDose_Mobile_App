import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import expensesHeaderImage from '../assets/expenses-header-illustration.jpg';
import {
  BottomSheet,
  EmptyState,
  FormField,
  RecordPurchaseModal,
  ScreenContainer,
  SuccessToast,
  useScreenWaveHeader,
} from '../src/components';
import {
  formatBdtAmount,
  formatMonthHeading,
  formatPurchaseDateCompact,
  formatPurchasePackSummary,
  getCurrentMonthYm,
  shiftMonthYm,
} from '../src/features/expenses/expense-helpers';
import { usePurchases } from '../src/features/expenses/PurchasesContext';
import { formatStockWithUnit } from '../src/features/medications/stock-calculator';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

export default function ExpensesScreen(): React.JSX.Element {
  const router = useRouter();
  const {
    expensesSummary,
    selectedMonth,
    setSelectedMonth,
    monthlyBudget,
    updateMonthlyBudget,
    loading,
  } = usePurchases();

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState(
    monthlyBudget !== null ? String(monthlyBudget) : '',
  );
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const currentYm = getCurrentMonthYm();
  const actualSpentNum = Number(expensesSummary.actualSpent) || 0;
  const maxBarAmount = useMemo(() => {
    const highest = Math.max(
      ...expensesSummary.monthlySeries.map((m) => Number(m.totalSpent) || 0),
      1,
    );
    return highest;
  }, [expensesSummary.monthlySeries]);

  const budgetVal =
    expensesSummary.monthlyBudget !== null
      ? Number(expensesSummary.monthlyBudget)
      : null;
  const utilizationPct = expensesSummary.budgetUtilizationPercent ?? 0;
  const overBudget = budgetVal !== null && actualSpentNum > budgetVal;

  const openBudgetModal = (): void => {
    setBudgetInput(budgetVal !== null ? String(budgetVal) : '');
    setBudgetError(null);
    setBudgetModalOpen(true);
  };

  const handleSaveBudget = async (): Promise<void> => {
    if (savingBudget) return;
    const trimmed = budgetInput.trim();
    let nextBudget: number | null = null;
    if (trimmed.length > 0) {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000000) {
        setBudgetError('Enter a valid non-negative monthly budget.');
        return;
      }
      nextBudget = Number(parsed.toFixed(2));
    }

    setSavingBudget(true);
    try {
      await updateMonthlyBudget(nextBudget);
      setBudgetModalOpen(false);
      setToast(
        nextBudget !== null
          ? `Monthly budget updated to ${formatBdtAmount(nextBudget)}.`
          : 'Monthly budget cleared.',
      );
    } catch (err) {
      setBudgetError(
        err instanceof Error ? err.message : 'Unable to save monthly budget.',
      );
    } finally {
      setSavingBudget(false);
    }
  };

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    title: 'Medicine Expenses',
    subtitle: 'Actual monthly spend & future cost estimate.',
    imageSource: expensesHeaderImage,
    onBack: () => router.back(),
    primaryAction: {
      label: '+ Purchase',
      pill: true,
      onPress: () => setPurchaseOpen(true),
    },
  });

  return (
    <ScreenContainer
      title="Medicine Expenses"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <SuccessToast message={toast} />

      {/* Month Navigator floating over header wave */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-3.5 flex-row items-center justify-between rounded-card border border-border bg-white px-3 py-2.5 shadow-sm"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => setSelectedMonth(shiftMonthYm(selectedMonth, -1))}
          className="h-9 w-9 items-center justify-center rounded-full border border-border bg-background active:bg-mint"
        >
          <Feather name="chevron-left" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
        </Pressable>

        <View className="items-center px-2">
          <Text className="text-[15px] font-bold text-main">
            {formatMonthHeading(selectedMonth)}
          </Text>
          <Text className="text-[11px] font-medium text-[#5A706B]">
            {selectedMonth === currentYm ? 'Current month' : 'Historical month'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          disabled={selectedMonth >= currentYm}
          onPress={() => setSelectedMonth(shiftMonthYm(selectedMonth, 1))}
          className={`h-9 w-9 items-center justify-center rounded-full border border-border ${
            selectedMonth >= currentYm ? 'bg-background opacity-40' : 'bg-background active:bg-mint'
          }`}
        >
          <Feather name="chevron-right" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
        </Pressable>
      </View>

      {/* Actual Monthly Spending vs Budget Card */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4 shadow-sm">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 min-w-0">
            <Text className="text-xs font-medium text-[#5A706B]">
              Actual spending ({formatMonthHeading(selectedMonth)})
            </Text>
            <Text className="mt-1 text-[26px] font-bold text-primary">
              {formatBdtAmount(actualSpentNum, { keepDecimals: true })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={openBudgetModal}
            className="shrink-0 rounded-full border border-[#CBE7DB] bg-mint px-3 py-1.5"
          >
            <Text className="text-xs font-semibold text-primary">
              {budgetVal !== null ? 'Edit budget' : 'Set budget'}
            </Text>
          </Pressable>
        </View>

        {budgetVal !== null ? (
          <View className="mt-3 pt-3 border-t border-border">
            <View className="flex-row items-center justify-between gap-2 mb-1.5">
              <Text className="text-xs text-[#5A706B]">
                Monthly budget: {formatBdtAmount(budgetVal)}
              </Text>
              <Text
                className={`text-xs font-semibold ${
                  overBudget ? 'text-error' : 'text-main'
                }`}
              >
                {budgetVal > 0
                  ? `${Math.min(Math.round(utilizationPct), 999)}% used`
                  : 'Budget ৳0'}
              </Text>
            </View>

            <View className="h-2.5 w-full overflow-hidden rounded-full bg-border">
              <View
                className={`h-full rounded-full ${overBudget ? 'bg-error' : 'bg-primary'}`}
                style={{
                  width: `${Math.min(100, Math.max(0, utilizationPct))}%`,
                }}
              />
            </View>

            {expensesSummary.budgetRemaining !== null ? (
              <Text
                className={`mt-1.5 text-[11px] font-medium ${
                  overBudget ? 'text-error' : 'text-[#5A706B]'
                }`}
              >
                {overBudget
                  ? `Over budget by ${formatBdtAmount(Math.abs(Number(expensesSummary.budgetRemaining)), { keepDecimals: true })}`
                  : `${formatBdtAmount(expensesSummary.budgetRemaining, { keepDecimals: true })} remaining this month`}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="mt-2 text-xs text-[#5A706B]">
            No monthly budget set yet. Tap Set budget to compare spending against your target.
          </Text>
        )}
      </View>

      {/* 6-Month Spending Trend */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[15px] font-semibold text-main">
            Monthly spending trend
          </Text>
          <Text className="text-[11px] font-medium text-[#5A706B]">
            Actual purchases
          </Text>
        </View>

        <View className="flex-row items-end justify-between gap-2 pt-2">
          {expensesSummary.monthlySeries.map((point) => {
            const val = Number(point.totalSpent) || 0;
            const heightPct = val > 0 ? Math.max(12, Math.round((val / maxBarAmount) * 76)) : 4;
            return (
              <Pressable
                key={point.month}
                accessibilityRole="button"
                accessibilityLabel={`${point.shortLabel} ${point.yearLabel}: ${formatBdtAmount(val)}`}
                onPress={() => setSelectedMonth(point.month)}
                className="flex-1 min-w-0 items-center"
              >
                <Text
                  className={`mb-1 text-[10px] font-semibold ${
                    point.isSelected ? 'text-primary' : 'text-[#5A706B]'
                  }`}
                  numberOfLines={1}
                >
                  {val > 0 ? formatBdtAmount(val) : '৳0'}
                </Text>
                <View className="h-[82px] w-full items-center justify-end px-1">
                  <View
                    className={`w-full max-w-[30px] rounded-t-[6px] ${
                      point.isSelected
                        ? 'bg-primary'
                        : val > 0
                          ? 'bg-[#A7D7C8]'
                          : 'bg-border'
                    }`}
                    style={{ height: heightPct }}
                  />
                </View>
                <Text
                  className={`mt-1.5 text-[11px] ${
                    point.isSelected
                      ? 'font-bold text-primary'
                      : 'font-medium text-[#5A706B]'
                  }`}
                >
                  {point.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Estimated Monthly Cost (Strictly Separate from Actual Spending) */}
      <View className="mb-3.5 rounded-card border border-[#CFE0F5] bg-[#F4F8FD] p-4 shadow-sm">
        <View className="flex-row items-center justify-between gap-2 flex-wrap">
          <Text className="text-[15px] font-semibold text-main">
            Estimated future monthly cost
          </Text>
          <View className="rounded-full bg-white px-2.5 py-0.5 border border-[#CFE0F5]">
            <Text className="text-[10px] font-semibold text-info">Estimate only</Text>
          </View>
        </View>

        {expensesSummary.estimatedMonthlyCost.hasEstimate &&
        expensesSummary.estimatedMonthlyCost.totalEstimatedCost ? (
          <>
            <Text className="mt-2 text-2xl font-bold text-main">
              {formatBdtAmount(expensesSummary.estimatedMonthlyCost.totalEstimatedCost, {
                keepDecimals: true,
              })}
              <Text className="text-xs font-normal text-[#5A706B]"> / 30 days</Text>
            </Text>
            <Text className="mt-1 text-[11px] leading-[16px] text-[#5A706B]">
              {expensesSummary.estimatedMonthlyCost.disclaimer}
            </Text>

            <View className="mt-3 gap-2">
              {expensesSummary.estimatedMonthlyCost.items.map((est) => (
                <View
                  key={est.medicationId}
                  className="rounded-field border border-[#DCE8F7] bg-white px-3 py-2"
                >
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="flex-1 min-w-0 text-xs font-semibold text-main" numberOfLines={1}>
                      {est.medicationName}
                      {est.strength ? ` ${est.strength}` : ''}
                    </Text>
                    <Text className="text-xs font-bold text-primary shrink-0">
                      {formatBdtAmount(est.estimatedCost, { keepDecimals: true })}
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                    {est.scheduleSummary} · {formatStockWithUnit(est.monthlyUnits, est.stockUnit)} ×{' '}
                    {formatBdtAmount(est.unitPriceUsed, { keepDecimals: true })} (
                    {est.priceSource === 'confirmed_purchase'
                      ? 'Confirmed purchase price'
                      : 'Catalogue reference'}
                    )
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text className="mt-2 text-xs leading-[18px] text-[#5A706B]">
            No future estimate available yet. CareDose only calculates a monthly cost estimate when a medicine has a fixed active schedule and a confirmed purchase or known reference unit price.
          </Text>
        )}

        {expensesSummary.estimatedMonthlyCost.excludedItems.length > 0 ? (
          <View className="mt-2.5 border-t border-[#DCE8F7] pt-2">
            <Text className="text-[11px] font-semibold text-[#5A706B] mb-1">
              Excluded from estimate ({expensesSummary.estimatedMonthlyCost.excludedItems.length}):
            </Text>
            {expensesSummary.estimatedMonthlyCost.excludedItems.map((ex) => (
              <Text key={ex.medicationId} className="text-[11px] text-[#5A706B]">
                • {ex.medicationName}: {ex.reason}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Per-Medicine Cost Breakdown (Selected Month) */}
      {expensesSummary.medicationBreakdown.length > 0 ? (
        <View className="mb-3.5 rounded-card border border-border bg-white p-4 shadow-sm">
          <Text className="text-[15px] font-semibold text-main mb-2">
            Cost by medicine ({formatMonthHeading(selectedMonth)})
          </Text>
          {expensesSummary.medicationBreakdown.map((entry, idx) => (
            <Pressable
              key={entry.medicationId}
              accessibilityRole="button"
              onPress={() => router.push(`/medicines/${entry.medicationId}`)}
              className={`flex-row items-center justify-between py-2.5 gap-3 ${
                idx === expensesSummary.medicationBreakdown.length - 1
                  ? 'pb-0.5'
                  : 'border-b border-border'
              }`}
            >
              <View className="flex-1 min-w-0">
                <Text className="text-[13px] font-semibold text-main" numberOfLines={1}>
                  {entry.medicationName}
                  {entry.strength ? ` · ${entry.strength}` : ''}
                </Text>
                <Text className="text-[11px] text-[#5A706B]">
                  {entry.purchaseCount}{' '}
                  {entry.purchaseCount === 1 ? 'purchase' : 'purchases'} ·{' '}
                  {formatStockWithUnit(entry.totalUnitsAdded, entry.stockUnit)}
                </Text>
              </View>
              <Text className="text-[14px] font-bold text-primary shrink-0">
                {formatBdtAmount(entry.totalSpent, { keepDecimals: true })}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Recent Purchases Section */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between gap-2 mb-2">
          <Text className="text-[15px] font-semibold text-main">
            Recent purchases
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/purchases')}
          >
            <Text className="text-xs font-semibold text-primary">See all</Text>
          </Pressable>
        </View>

        {loading && expensesSummary.recentPurchases.length === 0 ? (
          <Text className="text-xs text-[#5A706B]">Loading purchases...</Text>
        ) : expensesSummary.recentPurchases.length === 0 ? (
          <EmptyState
            iconName="shopping-bag"
            title="No purchases recorded yet"
            description="Tap + Purchase in the header to log your first medicine purchase."
          />
        ) : (
          expensesSummary.recentPurchases.map((item, idx) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => router.push(`/purchases?medicationId=${item.patientMedicationId}`)}
              className={`flex-row items-center justify-between py-2.5 gap-3 ${
                idx === expensesSummary.recentPurchases.length - 1
                  ? 'pb-0.5'
                  : 'border-b border-border'
              }`}
            >
              <View className="flex-1 min-w-0">
                <Text className="text-[13px] font-semibold text-main" numberOfLines={1}>
                  {item.medication?.name ?? 'Medicine'}
                  {item.medication?.strength ? ` ${item.medication.strength}` : ''}
                </Text>
                <Text className="text-[11px] text-[#5A706B]" numberOfLines={1}>
                  {formatPurchaseDateCompact(item.purchaseDateYmd)} ·{' '}
                  {formatPurchasePackSummary(item)}
                  {item.vendor ? ` · ${item.vendor}` : ''}
                </Text>
              </View>
              <Text className="text-[13px] font-bold text-primary shrink-0">
                {formatBdtAmount(item.amountPaid, { keepDecimals: true })}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Edit Budget Modal */}
      <BottomSheet
        visible={budgetModalOpen}
        title="Monthly Medicine Budget"
        subtitle="Compare actual monthly spending against your target budget (BDT)"
        onClose={() => setBudgetModalOpen(false)}
        onSubmit={() => void handleSaveBudget()}
        submitLabel="Save budget"
        submitLoading={savingBudget}
        submitDisabled={savingBudget}
      >
        <FormField
          label="Monthly budget (৳ BDT, leave empty to clear)"
          value={budgetInput}
          onChangeText={(txt) => {
            setBudgetInput(txt);
            setBudgetError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="e.g. 2500"
          errorMessage={budgetError ?? undefined}
        />
      </BottomSheet>

      <RecordPurchaseModal
        visible={purchaseOpen}
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
