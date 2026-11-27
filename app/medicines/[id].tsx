import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import medicinesHeaderImage from '../../assets/medicines-header-illustration.jpg';
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  FormField,
  formatSimplifiedDosageForm,
  MedicineCard,
  PrimaryButton,
  RecordPurchaseModal,
  resolveDosageFormIcon,
  ScheduleModal,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
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
  estimateStockDurationForMedication,
  format24To12Hour,
  formatDoseAmountDisplay,
  formatHistoryDateLabel,
  formatRecurrenceSummary,
  LocalScheduleRecord,
} from '../../src/features/schedule/dose-rules';
import { useSchedules } from '../../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../../src/theme/tokens';

type AccordionSectionKey =
  | 'info'
  | 'price'
  | 'schedule'
  | 'purchases'
  | 'history'
  | 'alternatives';

interface DetailAccordionCardProps {
  title: string;
  iconName: keyof typeof Feather.glyphMap;
  expanded: boolean;
  onToggle: () => void;
  pillText?: string | null;
  pillTone?: 'mint' | 'neutral';
  children: React.ReactNode;
}

function DetailAccordionCard({
  title,
  iconName,
  expanded,
  onToggle,
  pillText,
  pillTone = 'neutral',
  children,
}: DetailAccordionCardProps): React.JSX.Element {
  const isMintPill = pillTone === 'mint';
  return (
    <View className="mb-2.5 overflow-hidden rounded-card border border-border bg-white shadow-sm">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}${pillText ? `, ${pillText}` : ''}`}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        className="flex-row items-center justify-between gap-2 px-3.5 py-3 active:bg-[#F7FBF9]"
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
          <View className="h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D4EDE2] bg-mint">
            <Feather name={iconName} size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
          </View>
          <Text className="shrink text-[14.5px] font-bold text-main" numberOfLines={1}>
            {title}
          </Text>
        </View>

        <View className="shrink-0 flex-row items-center gap-2">
          {pillText ? (
            <View
              className={`max-w-[165px] rounded-full border px-2.5 py-1 ${
                isMintPill
                  ? 'border-[#C5E8D8] bg-mint'
                  : 'border-border bg-[#F2F6F4]'
              }`}
            >
              <Text
                numberOfLines={1}
                className={`text-[11px] font-semibold ${
                  isMintPill ? 'text-success' : 'text-[#5A706B]'
                }`}
              >
                {pillText}
              </Text>
            </View>
          ) : null}
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={CAREDOSE_EXTENDED_COLORS.secondaryText}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View className="border-t border-[#EFF4F1] px-4 pt-1.5 pb-3.5">{children}</View>
      ) : null}
    </View>
  );
}

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
  const { schedules, doseEvents } = useSchedules();
  const { getPurchasesForMedication } = usePurchases();

  const medication = id ? getMedicationById(id) : undefined;
  const medSchedules = useMemo(
    () => schedules.filter((s) => s.patientMedicationId === id),
    [schedules, id],
  );
  const allMedPurchases = useMemo(
    () => (id ? getPurchasesForMedication(id) : []),
    [getPurchasesForMedication, id],
  );
  const recentMedPurchases = useMemo(
    () => allMedPurchases.slice(0, 3),
    [allMedPurchases],
  );
  const allMedHistory = useMemo(
    () =>
      doseEvents
        .filter((ev) => ev.patientMedicationId === id)
        .sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor)),
    [doseEvents, id],
  );
  const recentMedHistory = useMemo(() => allMedHistory.slice(0, 3), [allMedHistory]);

  // Edit modal controlled draft states synced from persisted record
  const [medName, setMedName] = useState(medication?.name ?? '');
  const [medGeneric, setMedGeneric] = useState(medication?.genericName ?? '');
  const [medStrength, setMedStrength] = useState(medication?.strength ?? '');
  const [medForm, setMedForm] = useState(medication?.dosageForm ?? 'Tablet');
  const [instructions, setInstructions] = useState(medication?.instructions ?? '');
  const [thresholdInput, setThresholdInput] = useState(
    medication ? String(medication.lowStockThreshold) : '5',
  );
  const [toast, setToast] = useState<{ key: number; message: string } | null>(null);

  const showToast = (message: string): void => {
    setToast({ key: Date.now(), message });
  };

  useEffect(() => {
    if (!medication) return;
    setMedName(medication.name);
    setMedGeneric(medication.genericName ?? '');
    setMedStrength(medication.strength ?? '');
    setMedForm(medication.dosageForm);
    setInstructions(medication.instructions);
    setThresholdInput(String(medication.lowStockThreshold));
  }, [medication]);

  // Accordion & modal states (kept above conditional returns)
  const [expandedSections, setExpandedSections] = useState<
    Record<AccordionSectionKey, boolean>
  >({
    info: true,
    price: false,
    schedule: false,
    purchases: false,
    history: false,
    alternatives: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [createDoseOpen, setCreateDoseOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [updateStockOpen, setUpdateStockOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const handledOpenScheduleRef = useRef(false);

  // Secondary modal form states
  const [editingSchedule, setEditingSchedule] = useState<LocalScheduleRecord | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (openSchedule === '1' && medication && !handledOpenScheduleRef.current) {
      handledOpenScheduleRef.current = true;
      setErrors({});
      setEditingSchedule(null);
      setCreateDoseOpen(true);
    }
  }, [openSchedule, medication]);

  const toggleSection = (key: AccordionSectionKey): void => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const simplifiedFormLabel = medication
    ? (formatSimplifiedDosageForm(medication.dosageForm) ?? medication.dosageForm)
    : undefined;

  const headerSubtitleLines = medication
    ? [medication.genericName?.trim(), medication.strength?.trim()].filter(
        (v): v is string => Boolean(v && v.length > 0),
      )
    : [];

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    title: medication?.name ?? 'Medicine Details',
    subtitle:
      headerSubtitleLines.length > 0
        ? headerSubtitleLines.join('\n')
        : medication?.dosageForm,
    subtitleLines: 3,
    topBadge: medication ? (
      <View
        className="flex-row items-center rounded-full border border-[#C5E8D8] px-2.5 py-1"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.92)' }}
      >
        <Feather
          name={resolveDosageFormIcon(medication.dosageForm)}
          size={12}
          color={CAREDOSE_EXTENDED_COLORS.primary}
        />
        <Text className="ml-1.5 text-[11.5px] font-bold text-main">
          {simplifiedFormLabel}
        </Text>
      </View>
    ) : undefined,
    imageSource: medicinesHeaderImage,
    onBack: () => router.push('/medicines'),
    backButtonStyle: 'circle',
    overlapRatio: 0.14,
    contentMaxWidthPercent: layout.isCompact ? 58 : 60,
    overflowAction: medication
      ? {
          iconName: 'more-vertical',
          accessibilityLabel: 'Medicine options',
          onPress: () => setMenuOpen(true),
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
    showToast('Medicine details updated.');
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

  const estimatedCurrentStockValue = estimateCurrentStockValue({
    stockRemaining: medication.stockRemaining,
    stockUnit: medication.stockUnit,
    unitPriceText: medication.unitPriceText,
    referencePackText: medication.referencePackText,
  });

  const stockEstimate = estimateStockDurationForMedication({
    stockRemaining: medication.stockRemaining,
    stockUnit: medication.stockUnit,
    lowStockThreshold: medication.lowStockThreshold,
    archived: medication.archived,
    schedules: medSchedules,
  });

  const stockSurfaceColors =
    statusVariant === 'low_stock'
      ? {
          bg: CAREDOSE_EXTENDED_COLORS.warningSurface,
          border: '#F3D9A4',
          text: CAREDOSE_EXTENDED_COLORS.warning,
          track: '#F6E6C6',
        }
      : statusVariant === 'out_of_stock'
        ? {
            bg: CAREDOSE_EXTENDED_COLORS.errorSurface,
            border: '#F3C1BE',
            text: CAREDOSE_EXTENDED_COLORS.error,
            track: '#F6D6D4',
          }
        : statusVariant === 'archived'
          ? {
              bg: CAREDOSE_EXTENDED_COLORS.neutralSurface,
              border: CAREDOSE_EXTENDED_COLORS.border,
              text: CAREDOSE_EXTENDED_COLORS.secondaryText,
              track: '#DCE3E0',
            }
          : {
              bg: CAREDOSE_EXTENDED_COLORS.mintSurface,
              border: '#CBE7DB',
              text: CAREDOSE_EXTENDED_COLORS.primary,
              track: '#D1EBDF',
            };

  const priceSummaryPill =
    medication.unitPriceText && medication.unitPriceText !== 'Not listed'
      ? medication.unitPriceText
      : estimatedCurrentStockValue != null
        ? `Est. ৳${formatBdtCurrency(estimatedCurrentStockValue)}`
        : medication.totalStockPrice != null
          ? `Paid ৳${formatBdtCurrency(medication.totalStockPrice)}`
          : 'Not listed';

  const purchaseCountLabel =
    allMedPurchases.length === 0
      ? 'No records yet'
      : `${allMedPurchases.length} ${allMedPurchases.length === 1 ? 'record' : 'records'}`;

  const historyCountLabel =
    allMedHistory.length === 0
      ? 'No records yet'
      : `${allMedHistory.length} ${allMedHistory.length === 1 ? 'record' : 'records'}`;

  return (
    <ScreenContainer
      title={medication.name}
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
      toastMessage={toast?.message ?? null}
      toastKey={toast?.key}
      onDismissToast={() => setToast(null)}
    >
      {/* Top Pill Action Buttons matching Medicine Details hierarchy */}
      <View
        className={layout.stackTwoCol ? 'mb-3.5 flex-col' : 'mb-3.5 flex-row'}
        style={{ marginTop: -overlapPx, gap: layout.gridGap }}
      >
        <PrimaryButton
          pill
          compact
          fullWidth={layout.stackTwoCol}
          label={medSchedules.length > 0 ? 'Edit Schedule' : 'Create Dose'}
          leftIcon={<Feather name="calendar" size={15} color="#FFFFFF" />}
          onPress={() => openDoseScheduleModal(medSchedules[0])}
          className={layout.stackTwoCol ? '' : 'flex-1 min-w-0'}
          style={{
            shadowColor: '#075D4E',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.16,
            shadowRadius: 8,
            elevation: 3,
          }}
        />
        <SecondaryButton
          pill
          compact
          fullWidth={layout.stackTwoCol}
          label="Record Purchase"
          leftIcon={
            <Feather
              name="shopping-cart"
              size={15}
              color={CAREDOSE_EXTENDED_COLORS.primary}
            />
          }
          onPress={() => setPurchaseOpen(true)}
          className={layout.stackTwoCol ? '' : 'flex-1 min-w-0'}
          style={{
            borderColor: '#C5E8D8',
            shadowColor: '#075D4E',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
          }}
        />
      </View>

      {/* Current Stock Hero Card */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current stock ${formatStockWithUnit(medication.stockRemaining, medication.stockUnit)}. Tap to adjust stock`}
        onPress={() => setUpdateStockOpen(true)}
        className="mb-3.5 rounded-card p-4 shadow-sm active:opacity-95"
        style={{
          backgroundColor: stockSurfaceColors.bg,
          borderWidth: 1,
          borderColor: stockSurfaceColors.border,
        }}
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <View
              className="h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.72)',
                borderWidth: 1,
                borderColor: stockSurfaceColors.border,
              }}
            >
              <Feather name="package" size={20} color={stockSurfaceColors.text} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[12px] font-medium text-[#3C5853]">Current Stock</Text>
              <Text
                className="mt-0.5 text-[21px] font-bold leading-[26px]"
                style={{ color: stockSurfaceColors.text }}
                numberOfLines={1}
              >
                {formatStockWithUnit(medication.stockRemaining, medication.stockUnit)}
              </Text>
              {medication.stripUnits &&
              medication.stockRemaining > 0 &&
              medication.stripUnits > 1 ? (
                <Text className="text-[11px] font-medium text-[#5A706B]">
                  ≈{' '}
                  {(medication.stockRemaining / medication.stripUnits)
                    .toFixed(1)
                    .replace(/\.0$/, '')}{' '}
                  strips
                </Text>
              ) : null}
            </View>
          </View>

          <StatusBadge
            variant={statusVariant}
            showIcon
            iconName={statusVariant === 'in_stock' ? 'check-circle' : undefined}
          />
        </View>

        <View className="mt-3.5 flex-row items-center gap-3">
          <View
            className="h-2 flex-1 overflow-hidden rounded-full"
            style={{ backgroundColor: stockSurfaceColors.track }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${Math.round(stockEstimate.fillRatio * 100)}%`,
                backgroundColor: stockSurfaceColors.text,
              }}
            />
          </View>
          <View className="shrink-0 flex-row items-center gap-1">
            <Text className="text-[12px] font-semibold text-[#3C5853]">
              {stockEstimate.daysLabel ??
                `Alert ≤ ${formatStockWithUnit(medication.lowStockThreshold, medication.stockUnit)}`}
            </Text>
            <Feather name="info" size={13} color="#5A706B" />
          </View>
        </View>
      </Pressable>

      {/* Accordion: Medicine Information (expanded by default) */}
      <DetailAccordionCard
        title="Medicine Information"
        iconName="file-text"
        expanded={expandedSections.info}
        onToggle={() => toggleSection('info')}
      >
        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Brand name</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.name}
          </Text>
        </View>

        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Generic name</Text>
          {medication.genericName ? (
            <Pressable accessibilityRole="button" onPress={handleOpenGeneric}>
              <Text className="shrink-0 text-[13px] font-semibold text-primary">
                {medication.genericName}
              </Text>
            </Pressable>
          ) : (
            <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
              Not available
            </Text>
          )}
        </View>

        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Strength</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.strength || 'Not available'}
          </Text>
        </View>

        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Dosage form</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.dosageForm}
          </Text>
        </View>

        {isSolidDosageForm(medication.dosageForm) && medication.stripUnits ? (
          <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
            <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">
              {getStripUnitsLabel(medication.dosageForm)}
            </Text>
            <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
              {formatStripUnitsValue(medication.stripUnits, medication.dosageForm)}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Quantity unit</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {classifyDosageFormStrategy(medication.dosageForm) === 'suppository'
              ? 'Pieces'
              : medication.stockUnit === 'ml'
                ? 'ml (bottle volume)'
                : medication.stockUnit}
          </Text>
        </View>

        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Low-stock alert</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-[13px] font-semibold text-main">
              {formatStockWithUnit(medication.lowStockThreshold, medication.stockUnit)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit alert"
              onPress={() => {
                setErrors({});
                setEditOpen(true);
              }}
            >
              <Text className="text-[12px] font-semibold text-primary">Edit</Text>
            </Pressable>
          </View>
        </View>

        {medication.openingEntryText ? (
          <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
            <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">
              Opening stock
            </Text>
            <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
              {medication.openingEntryText}
            </Text>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between gap-4 py-2 pb-0.5">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Instructions</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.instructions.trim().length > 0 ? medication.instructions : '—'}
          </Text>
        </View>
      </DetailAccordionCard>

      {/* Accordion: Price Information */}
      <DetailAccordionCard
        title="Price Information"
        iconName="tag"
        expanded={expandedSections.price}
        onToggle={() => toggleSection('price')}
        pillText={priceSummaryPill}
        pillTone={
          medication.unitPriceText && medication.unitPriceText !== 'Not listed'
            ? 'mint'
            : 'neutral'
        }
      >
        {estimatedCurrentStockValue != null ? (
          <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
            <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">
              Estimated stock value
            </Text>
            <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
              ৳{formatBdtCurrency(estimatedCurrentStockValue)}
            </Text>
          </View>
        ) : null}
        {medication.totalStockPrice != null ? (
          <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
            <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">
              Actual amount paid
            </Text>
            <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
              ৳{formatBdtCurrency(medication.totalStockPrice)}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between gap-4 border-b border-border py-2">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">
            Catalogue unit rate
          </Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.unitPriceText}
          </Text>
        </View>
        <View className="flex-row items-center justify-between gap-4 py-2 pb-0.5">
          <Text className="max-w-[46%] shrink-0 text-[12px] text-[#5A706B]">Reference pack</Text>
          <Text className="min-w-0 flex-1 text-right text-[13px] font-semibold text-main">
            {medication.referencePackText ?? 'Not available'}
          </Text>
        </View>
      </DetailAccordionCard>

      {/* Accordion: Schedule */}
      <DetailAccordionCard
        title="Schedule"
        iconName="calendar"
        expanded={expandedSections.schedule}
        onToggle={() => toggleSection('schedule')}
        pillText={stockEstimate.schedulePillText}
        pillTone={medSchedules.length > 0 ? 'mint' : 'neutral'}
      >
        {medSchedules.length === 0 ? (
          <View className="flex-row items-center justify-between gap-3 py-2 pb-0.5">
            <Text className="flex-1 text-[12px] text-[#5A706B]">
              No active schedule saved yet.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => openDoseScheduleModal()}
            >
              <Text className="text-[12px] font-semibold text-primary">Add</Text>
            </Pressable>
          </View>
        ) : (
          medSchedules.map((sched, idx) => (
            <View
              key={sched.id}
              className={`flex-row items-center justify-between gap-3 py-2.5 ${
                idx === medSchedules.length - 1 ? 'pb-0.5' : 'border-b border-border'
              }`}
            >
              <View className="min-w-0 flex-1 pr-2">
                <Text className="text-[13px] font-semibold text-main">
                  {sched.scheduledTimes.map(format24To12Hour).join(' · ')}
                </Text>
                <Text className="mt-0.5 text-[12px] text-[#5A706B]">
                  {formatRecurrenceSummary(sched)} ·{' '}
                  {formatDoseAmountDisplay(sched.doseAmount, sched.doseUnit)}
                </Text>
              </View>
              <View className="shrink-0 flex-row items-center gap-2">
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit dose schedule"
                  onPress={() => openDoseScheduleModal(sched)}
                  className="pl-1"
                >
                  <Text className="text-[12px] font-semibold text-primary">Edit</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </DetailAccordionCard>

      {/* Accordion: Purchase History */}
      <DetailAccordionCard
        title="Purchase History"
        iconName="shopping-cart"
        expanded={expandedSections.purchases}
        onToggle={() => toggleSection('purchases')}
        pillText={purchaseCountLabel}
        pillTone={allMedPurchases.length > 0 ? 'mint' : 'neutral'}
      >
        {recentMedPurchases.length === 0 ? (
          <View className="flex-row items-center justify-between gap-3 py-2 pb-0.5">
            <Text className="flex-1 text-[12px] text-[#5A706B]">
              No purchases recorded for this medicine yet.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setPurchaseOpen(true)}>
              <Text className="text-[12px] font-semibold text-primary">Record</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {recentMedPurchases.map((pur, idx) => (
              <View
                key={pur.id}
                className={`flex-row items-center justify-between gap-4 py-2 ${
                  idx === recentMedPurchases.length - 1 ? '' : 'border-b border-border'
                }`}
              >
                <View className="min-w-0 flex-1">
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
                <Text className="shrink-0 text-[13px] font-semibold text-main">
                  {formatBdtAmount(pur.amountPaid, { keepDecimals: true })}
                </Text>
              </View>
            ))}
            <View className="mt-2 border-t border-border pt-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/purchases?medicationId=${medication.id}`)}
                className="self-end"
              >
                <Text className="text-[12px] font-semibold text-primary">
                  See all purchases
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </DetailAccordionCard>

      {/* Accordion: Dose History */}
      <DetailAccordionCard
        title="Dose History"
        iconName="clock"
        expanded={expandedSections.history}
        onToggle={() => toggleSection('history')}
        pillText={historyCountLabel}
        pillTone={allMedHistory.length > 0 ? 'mint' : 'neutral'}
      >
        {recentMedHistory.length === 0 ? (
          <View className="py-2 pb-0.5">
            <Text className="text-[12px] text-[#5A706B]">
              No recorded doses for this medicine yet.
            </Text>
          </View>
        ) : (
          <>
            {recentMedHistory.map((ev, idx) => (
              <View
                key={ev.id}
                className={`flex-row items-center justify-between gap-4 py-2 ${
                  idx === recentMedHistory.length - 1 ? '' : 'border-b border-border'
                }`}
              >
                <Text className="text-[12px] text-[#5A706B]">
                  {formatHistoryDateLabel(ev.scheduledDateYmd)} ·{' '}
                  {format24To12Hour(ev.scheduledTime24)}
                </Text>
                <StatusBadge variant={ev.status} />
              </View>
            ))}
            <View className="mt-2 border-t border-border pt-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/history?medicationId=${medication.id}`)}
                className="self-end"
              >
                <Text className="text-[12px] font-semibold text-primary">See all history</Text>
              </Pressable>
            </View>
          </>
        )}
      </DetailAccordionCard>

      {/* Accordion: Alternative Brands */}
      <DetailAccordionCard
        title="Alternative Brands"
        iconName="layers"
        expanded={expandedSections.alternatives}
        onToggle={() => toggleSection('alternatives')}
        pillText="View matching brands"
        pillTone="mint"
      >
        <View className="mt-1.5 mb-2.5 rounded-field border border-[#F3D9A4] bg-[#FDF5E6] p-2.5">
          <Text className="text-[11px] font-semibold text-warning">
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
          <View className="pb-1">
            <Text className="text-[12px] leading-[17px] text-[#5A706B]">
              {medication.catalogueBrandId
                ? 'View potential matching brands sharing the same generic, strength, and dosage form.'
                : 'Open Compare all to review matching brands by generic, strength, and form.'}
            </Text>
            {medication.catalogueBrandId ? (
              <View className="mt-2.5">
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
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            medication.catalogueBrandId
              ? router.push(`/explore/brand/${medication.catalogueBrandId}`)
              : router.push('/alternatives')
          }
          className="mt-1 self-end"
        >
          <Text className="text-[12px] font-semibold text-primary">Compare all brands</Text>
        </Pressable>
      </DetailAccordionCard>

      {/* Bottom Archive / Restore Medicine Pill Card */}
      <View className="mt-2 mb-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            medication.archived ? 'Restore Medicine to Active' : 'Archive Medicine'
          }
          onPress={() => {
            if (medication.archived) {
              void restoreMedication(medication.id).then(() => {
                showToast(`${medication.name} restored to active list.`);
              });
            } else {
              setArchiveConfirmOpen(true);
            }
          }}
          className="flex-row items-center justify-center rounded-card px-4 py-3.5 shadow-sm active:opacity-90"
          style={{
            backgroundColor: medication.archived ? CAREDOSE_EXTENDED_COLORS.mintSurface : '#FFF7F7',
            borderWidth: 1,
            borderColor: medication.archived ? '#CBE7DB' : '#F3C1BE',
            minHeight: 48,
          }}
        >
          <Feather
            name={medication.archived ? 'rotate-ccw' : 'archive'}
            size={16}
            color={
              medication.archived
                ? CAREDOSE_EXTENDED_COLORS.primary
                : CAREDOSE_EXTENDED_COLORS.error
            }
          />
          <Text
            className="ml-2 text-[14px] font-bold"
            style={{
              color: medication.archived
                ? CAREDOSE_EXTENDED_COLORS.primary
                : CAREDOSE_EXTENDED_COLORS.error,
            }}
          >
            {medication.archived ? 'Restore Medicine to Active' : 'Archive Medicine'}
          </Text>
        </Pressable>
      </View>

      {/* Header Overflow Action Sheet */}
      <BottomSheet
        visible={menuOpen}
        title="Medicine Options"
        subtitle={medication.name}
        iconName="more-vertical"
        hideFooter
        onClose={() => setMenuOpen(false)}
      >
        <View className="gap-2 pb-1">
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false);
              setErrors({});
              setEditOpen(true);
            }}
            className="flex-row items-center rounded-field border border-border bg-white px-3.5 py-3 active:bg-mint"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-mint">
              <Feather name="edit-2" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[14px] font-semibold text-main">Edit Medicine</Text>
              <Text className="text-[11.5px] text-[#5A706B]">
                Update name, strength, instructions, or alert level
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false);
              setUpdateStockOpen(true);
            }}
            className="flex-row items-center rounded-field border border-border bg-white px-3.5 py-3 active:bg-mint"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-mint">
              <Feather name="sliders" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[14px] font-semibold text-main">Adjust Stock</Text>
              <Text className="text-[11.5px] text-[#5A706B]">
                Add units, set exact count, or record wastage
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMenuOpen(false);
              if (medication.archived) {
                void restoreMedication(medication.id).then(() => {
                  showToast(`${medication.name} restored to active list.`);
                });
              } else {
                setArchiveConfirmOpen(true);
              }
            }}
            className="flex-row items-center rounded-field border px-3.5 py-3 active:opacity-90"
            style={{
              backgroundColor: medication.archived ? CAREDOSE_EXTENDED_COLORS.mintSurface : '#FFF7F7',
              borderColor: medication.archived ? '#CBE7DB' : '#F3C1BE',
            }}
          >
            <View
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{
                backgroundColor: medication.archived ? '#FFFFFF' : '#FDECEC',
              }}
            >
              <Feather
                name={medication.archived ? 'rotate-ccw' : 'archive'}
                size={16}
                color={
                  medication.archived
                    ? CAREDOSE_EXTENDED_COLORS.primary
                    : CAREDOSE_EXTENDED_COLORS.error
                }
              />
            </View>
            <View className="ml-3 flex-1">
              <Text
                className="text-[14px] font-semibold"
                style={{
                  color: medication.archived
                    ? CAREDOSE_EXTENDED_COLORS.primary
                    : CAREDOSE_EXTENDED_COLORS.error,
                }}
              >
                {medication.archived ? 'Restore to Active' : 'Archive Medicine'}
              </Text>
              <Text className="text-[11.5px] text-[#5A706B]">
                {medication.archived
                  ? 'Move back to your active medicines list'
                  : 'Keep history while hiding from active tracking'}
              </Text>
            </View>
          </Pressable>
        </View>
      </BottomSheet>

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
          showToast(isEdit ? 'Dose schedule updated.' : 'Dose schedule saved.');
        }}
      />

      {/* Record Purchase Modal */}
      <RecordPurchaseModal
        visible={purchaseOpen}
        initialMedicationId={medication.id}
        lockMedicineSelection
        onClose={() => setPurchaseOpen(false)}
        onSaved={(outcome) => {
          showToast(
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
          showToast(
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
            showToast(`${medication.name} archived. Dose & purchase history preserved.`);
          });
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </ScreenContainer>
  );
}
