import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import {
  CatalogueBrandDetailDto,
  CatalogueBrandSummaryDto,
  CataloguePackDto,
  getCatalogueBrandDetail,
  searchCatalogueBrands,
} from '../api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
  resolvePackQuantityUnit,
} from '../features/catalogue/catalogue-helpers';
import {
  inferStockUnit,
  parseNonNegativeNumberInput,
  PersonalMedicationRecord,
} from '../features/medications/medication-helpers';
import { useMedications } from '../features/medications/MedicationsContext';
import {
  calculateStockAndPrice,
  computeDefaultLowStockThreshold,
  extractPackInfo,
  formatBdtCurrency,
  formatUnitLabelForCount,
  formatUnitNounCapitalized,
  getAvailableStockModes,
  getDefaultStockMode,
  getEnteredQuantityUnit,
  resolveBrandPacks,
  StockEntryMode,
} from '../features/medications/stock-calculator';
import { getTodayLocalYmd } from '../features/schedule/dose-rules';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS, MIN_TOUCH_TARGET } from '../theme/tokens';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { DateField, FormCol, FormField, FormRow, SelectField, validateRequiredFields } from './FormFields';
import { MedicineFormThumbnail } from './MedicineFormThumbnail';
import { BottomSheet } from './Overlays';
import { SearchInput } from './SearchInput';
import { StatusBadge } from './StatusBadge';

const QUICK_SEARCH_TERMS = ['Napa', 'Seclo', 'Maxpro', 'Monas', 'Paracetamol', 'Omeprazole'];

const MANUAL_DOSAGE_FORM_OPTIONS = [
  { label: 'Tablet', value: 'Tablet' },
  { label: 'Capsule', value: 'Capsule' },
  { label: 'Syrup', value: 'Syrup' },
  { label: 'Oral Suspension', value: 'Oral Suspension' },
  { label: 'Suppository', value: 'Suppository' },
  { label: 'Injection', value: 'Injection' },
  { label: 'Eye Drops', value: 'Ophthalmic Solution' },
  { label: 'Pediatric Drops', value: 'Pediatric Drops' },
  { label: 'Inhaler', value: 'Metered-Dose Inhaler (MDI)' },
  { label: 'Cream / Ointment', value: 'Cream' },
  { label: 'Oral Powder (Sachet)', value: 'Oral Powder' },
];

const INJECTION_UNIT_OPTIONS = [
  { label: 'Vials', value: 'vials' },
  { label: 'Ampoules', value: 'ampoules' },
  { label: 'Pre-filled syringes', value: 'syringes' },
  { label: 'Bags / Bottles', value: 'bags' },
];

type ModalStage = 'search' | 'configure' | 'manual' | 'success';

export interface AddMedicineModalProps {
  visible: boolean;
  initialBrand?: CatalogueBrandDetailDto | CatalogueBrandSummaryDto | null;
  initialPackId?: string | null;
  onClose: () => void;
  onSaved: (created: PersonalMedicationRecord) => void;
}

export function AddMedicineModal({
  visible,
  initialBrand = null,
  initialPackId = null,
  onClose,
  onSaved,
}: AddMedicineModalProps): React.JSX.Element {
  const { addMedication } = useMedications();
  const router = useRouter();
  const pathname = usePathname();

  const [stage, setStage] = useState<ModalStage>(initialBrand ? 'configure' : 'search');

  // Catalogue search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CatalogueBrandSummaryDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOfflineNote, setSearchOfflineNote] = useState<string | null>(null);
  const searchReqIdRef = useRef(0);

  // Selected catalogue brand + pack detail
  const [selectedBrand, setSelectedBrand] = useState<CatalogueBrandSummaryDto | null>(
    initialBrand ?? null,
  );
  const [brandDetail, setBrandDetail] = useState<CatalogueBrandDetailDto | null>(
    initialBrand && 'packs' in initialBrand ? initialBrand : null,
  );
  const [selectedPackId, setSelectedPackId] = useState<string | null>(
    initialBrand?.primaryPack?.id ?? null,
  );
  const [loadingBrandDetail, setLoadingBrandDetail] = useState(false);
  const selectionReqIdRef = useRef(0);

  // Manual entry fallback states
  const [manualName, setManualName] = useState('');
  const [manualGeneric, setManualGeneric] = useState('');
  const [manualStrength, setManualStrength] = useState('');
  const [manualForm, setManualForm] = useState('Tablet');

  // Dynamic stock states
  const [stockMode, setStockMode] = useState<StockEntryMode>('direct');
  const [primaryQty, setPrimaryQty] = useState('');
  const primaryQtyRef = useRef('');
  primaryQtyRef.current = primaryQty;
  const [secondaryQty, setSecondaryQty] = useState('');
  const [injectionContainerUnit, setInjectionContainerUnit] = useState<string>('vials');

  // Unit toggle & optional purchase details (collapsed by default)
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showPurchaseDetails, setShowPurchaseDetails] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayLocalYmd());
  const [purchaseVendor, setPurchaseVendor] = useState('');

  // Validation, API error & save confirmation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedRecord, setSavedRecord] = useState<PersonalMedicationRecord | null>(null);
  const [savedSummaryText, setSavedSummaryText] = useState<string | null>(null);
  const [savedEstimatedPrice, setSavedEstimatedPrice] = useState<number | null>(null);
  const [savedPaidPrice, setSavedPaidPrice] = useState<number | null>(null);

  const availablePacks = useMemo(
    () => (stage === 'configure' ? resolveBrandPacks(selectedBrand, brandDetail) : []),
    [stage, selectedBrand, brandDetail],
  );

  const selectedPack: CataloguePackDto | null = useMemo(() => {
    if (availablePacks.length === 0) return null;
    return availablePacks.find((p) => p.id === selectedPackId) ?? availablePacks[0];
  }, [availablePacks, selectedPackId]);

  const activeDosageForm =
    stage === 'manual' ? manualForm : selectedBrand?.dosageForm ?? 'Tablet';

  const packInfo = useMemo(
    () => extractPackInfo(activeDosageForm, selectedPack, availablePacks),
    [activeDosageForm, selectedPack, availablePacks],
  );

  const availableModes = useMemo(() => getAvailableStockModes(packInfo), [packInfo]);

  const syncModeDefaults = useCallback(
    (nextInfo: ReturnType<typeof extractPackInfo>, nextMode: StockEntryMode) => {
      setStockMode(nextMode);
      if (nextMode === 'strips') {
        setSecondaryQty(nextInfo.stripUnits ? String(nextInfo.stripUnits) : '');
      } else if (nextMode === 'bottles') {
        setSecondaryQty(nextInfo.bottleVolumeMl ? String(nextInfo.bottleVolumeMl) : '');
      } else {
        setSecondaryQty('');
      }
      if (nextInfo.containerUnit) {
        setInjectionContainerUnit(nextInfo.containerUnit);
      } else {
        setInjectionContainerUnit('vials');
      }
    },
    [],
  );

  const resetFormEntries = useCallback(() => {
    setPrimaryQty('');
    setSecondaryQty('');
    setShowUnitPicker(false);
    setShowPurchaseDetails(false);
    setPurchaseAmount('');
    setPurchaseDate(getTodayLocalYmd());
    setPurchaseVendor('');
    setErrors({});
    setSaveError(null);
    setSavedRecord(null);
    setSavedSummaryText(null);
    setSavedEstimatedPrice(null);
    setSavedPaidPrice(null);
    setInjectionContainerUnit('vials');
  }, []);

  const applyBrandSelection = useCallback(
    async (
      brand: CatalogueBrandSummaryDto | CatalogueBrandDetailDto,
      preferredPackId: string | null = null,
    ) => {
      const selReqId = ++selectionReqIdRef.current;
      const initialPacks = resolveBrandPacks(
        brand,
        'packs' in brand ? brand : null,
      );
      const firstPack =
        (preferredPackId ? initialPacks.find((p) => p.id === preferredPackId) : null) ??
        initialPacks[0] ??
        brand.primaryPack ??
        null;
      const initialInfo = extractPackInfo(brand.dosageForm, firstPack, initialPacks);
      const defaultMode = getDefaultStockMode(initialInfo);

      setSelectedBrand(brand);
      setBrandDetail('packs' in brand ? brand : null);
      setSelectedPackId(firstPack?.id ?? null);
      setStage('configure');
      resetFormEntries();
      syncModeDefaults(initialInfo, defaultMode);

      // Fetch full pack variations in background if not already hydrated
      if (!('packs' in brand) || brand.packs.length === 0) {
        setLoadingBrandDetail(true);
        try {
          const detail = await getCatalogueBrandDetail(brand.sourceId);
          if (selReqId !== selectionReqIdRef.current) return;
          setBrandDetail(detail);
          const fullPacks = resolveBrandPacks(brand, detail);
          const nextFirst =
            (preferredPackId ? fullPacks.find((p) => p.id === preferredPackId) : null) ??
            fullPacks.find((p) => p.id === firstPack?.id) ??
            fullPacks[0] ??
            null;
          if (nextFirst) {
            setSelectedPackId(nextFirst.id);
            const fullInfo = extractPackInfo(detail.dosageForm, nextFirst, fullPacks);
            if (primaryQtyRef.current.trim().length === 0) {
              syncModeDefaults(fullInfo, getDefaultStockMode(fullInfo));
            } else if (fullInfo.containerUnit && fullInfo.containerUnit !== initialInfo.containerUnit) {
              setInjectionContainerUnit(fullInfo.containerUnit);
            }
          }
        } catch {
          // Summary pack already loaded; keep working seamlessly
        } finally {
          if (selReqId === selectionReqIdRef.current) {
            setLoadingBrandDetail(false);
          }
        }
      }
    },
    [resetFormEntries, syncModeDefaults],
  );

  // Reset modal whenever visibility toggles
  useEffect(() => {
    if (!visible) return;
    setSaving(false);
    resetFormEntries();
    setManualName('');
    setManualGeneric('');
    setManualStrength('');
    setManualForm('Tablet');
    setSearchQuery('');

    if (initialBrand) {
      void applyBrandSelection(initialBrand, initialPackId);
    } else {
      selectionReqIdRef.current += 1;
      setStage('search');
      setSelectedBrand(null);
      setBrandDetail(null);
      setSelectedPackId(null);
      setLoadingBrandDetail(false);
    }
  }, [visible, initialBrand, initialPackId, applyBrandSelection, resetFormEntries]);

  // Execute debounced catalogue search when in Search stage
  useEffect(() => {
    if (!visible || stage !== 'search') return;
    const reqId = ++searchReqIdRef.current;
    setSearching(true);

    const timer = setTimeout(() => {
      const q = searchQuery.trim();
      searchCatalogueBrands({
        q: q.length > 0 ? q : undefined,
        limit: q.length > 0 ? 30 : 15,
      })
        .then((res) => {
          if (reqId !== searchReqIdRef.current) return;
          setSearchOfflineNote(null);
          setSearchResults(res.items);
        })
        .catch(() => {
          if (reqId !== searchReqIdRef.current) return;
          const lower = q.toLowerCase();
          const fallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.filter((b) => {
            if (!lower) return true;
            const hay = `${b.name} ${b.generic?.name ?? ''} ${b.strength ?? ''} ${b.dosageForm ?? ''}`.toLowerCase();
            return hay.includes(lower);
          });
          setSearchOfflineNote('Offline preview records shown. Connect server to search all medicines.');
          setSearchResults(fallback);
        })
        .finally(() => {
          if (reqId === searchReqIdRef.current) {
            setSearching(false);
          }
        });
    }, searchQuery.trim().length === 0 ? 0 : 180);

    return () => clearTimeout(timer);
  }, [visible, stage, searchQuery]);

  const effectiveContainerUnit =
    packInfo.strategy === 'injection'
      ? packInfo.containerUnit ?? injectionContainerUnit
      : packInfo.containerUnit ?? packInfo.baseUnit;

  const stockCalc = useMemo(
    () =>
      calculateStockAndPrice({
        packInfo,
        mode: stockMode,
        primaryQty,
        secondaryQty,
        overrideContainerUnit: effectiveContainerUnit,
        hasCatalogSelection: stage === 'configure',
      }),
    [packInfo, stockMode, primaryQty, secondaryQty, effectiveContainerUnit, stage],
  );

  const handleChangeMedicine = (): void => {
    selectionReqIdRef.current += 1;
    setLoadingBrandDetail(false);
    setSelectedBrand(null);
    setBrandDetail(null);
    setSelectedPackId(null);
    resetFormEntries();
    setManualName('');
    setManualGeneric('');
    setManualStrength('');
    setManualForm('Tablet');
    setStage('search');
  };

  const handleSelectPack = (pack: CataloguePackDto): void => {
    setSelectedPackId(pack.id);
    setShowUnitPicker(false);
    setSaveError(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.primaryQty;
      delete next.secondaryQty;
      return next;
    });
    const nextInfo = extractPackInfo(selectedBrand?.dosageForm, pack, availablePacks);
    const currentAvailable = getAvailableStockModes(nextInfo);
    const stillValid = currentAvailable.some((m) => m.mode === stockMode);
    const nextMode =
      primaryQty.trim().length > 0 && stillValid
        ? stockMode
        : getDefaultStockMode(nextInfo);
    syncModeDefaults(nextInfo, nextMode);
  };

  const handleSelectMode = (nextMode: StockEntryMode): void => {
    setSaveError(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.primaryQty;
      delete next.secondaryQty;
      return next;
    });
    setPrimaryQty('');
    syncModeDefaults(packInfo, nextMode);
  };

  const handleSelectManualForm = (nextForm: string): void => {
    setManualForm(nextForm);
    const nextInfo = extractPackInfo(nextForm, null, []);
    const nextDefaultMode = getDefaultStockMode(nextInfo);
    setPrimaryQty('');
    setShowUnitPicker(false);
    setSaveError(null);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.primaryQty;
      delete next.secondaryQty;
      return next;
    });
    syncModeDefaults(nextInfo, nextDefaultMode);
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    setSaveError(null);
    const nextErrors: Record<string, string> = {};

    if (stage === 'manual') {
      Object.assign(
        nextErrors,
        validateRequiredFields({ manualName }, { manualName: 'Medicine name' }),
      );
    }

    const p1 = parseNonNegativeNumberInput(primaryQty);
    if (primaryQty.trim().length === 0) {
      nextErrors.primaryQty = 'Enter current quantity.';
    } else if (p1 === null || p1 <= 0) {
      nextErrors.primaryQty = 'Enter a quantity greater than 0.';
    }

    if (
      (stockMode === 'strips' && !packInfo.stripUnits) ||
      (stockMode === 'bottles' && packInfo.strategy === 'liquid' && !packInfo.bottleVolumeMl)
    ) {
      const p2 = parseNonNegativeNumberInput(secondaryQty);
      if (secondaryQty.trim().length === 0) {
        nextErrors.secondaryQty =
          stockMode === 'strips' ? 'Enter units per strip.' : 'Enter volume (ml) per bottle.';
      } else if (p2 === null || p2 <= 0) {
        nextErrors.secondaryQty = 'Must be greater than 0.';
      }
    }

    let parsedPurchaseAmount: number | null = null;
    if (showPurchaseDetails) {
      const trimmedAmount = purchaseAmount.trim();
      const trimmedVendor = purchaseVendor.trim();
      if (trimmedAmount.length > 0) {
        parsedPurchaseAmount = parseNonNegativeNumberInput(trimmedAmount);
        if (parsedPurchaseAmount === null) {
          nextErrors.purchaseAmount = 'Enter a valid non-negative amount.';
        }
      } else if (trimmedVendor.length > 0) {
        nextErrors.purchaseAmount = 'Enter the amount paid to record this purchase.';
      }
    }

    setErrors(nextErrors);
    if (
      Object.keys(nextErrors).length > 0 ||
      p1 === null ||
      !stockCalc.isValid ||
      stockCalc.stockRemaining === null
    ) {
      return;
    }

    const savedStock = stockCalc.stockRemaining;
    const savedUnit = stockCalc.stockUnit || inferStockUnit(activeDosageForm);
    const effectiveBottleVol =
      stockMode === 'bottles' && secondaryQty.trim().length > 0
        ? parseNonNegativeNumberInput(secondaryQty)
        : packInfo.bottleVolumeMl;

    const autoThreshold = computeDefaultLowStockThreshold(
      packInfo.strategy,
      savedUnit,
      savedStock,
      effectiveBottleVol,
    );

    const purchaseDetails =
      showPurchaseDetails && parsedPurchaseAmount !== null
        ? {
            amountPaid: parsedPurchaseAmount,
            purchaseDate: purchaseDate.trim() || undefined,
            vendor: purchaseVendor.trim() || undefined,
            ...(Number.isInteger(p1) && p1 >= 1 && savedStock > 0
              ? {
                  packCount: p1,
                  unitsPerPack: Math.max(0.01, Number((savedStock / p1).toFixed(2))),
                }
              : {}),
          }
        : undefined;

    setSaving(true);
    try {
      const created = await addMedication({
        catalogueBrandId: stage === 'configure' ? selectedBrand?.sourceId ?? null : null,
        genericSourceId: stage === 'configure' ? selectedBrand?.generic?.sourceId ?? null : null,
        name: stage === 'configure' ? selectedBrand?.name ?? 'Medicine' : manualName.trim(),
        genericName:
          stage === 'configure'
            ? selectedBrand?.generic?.name ?? null
            : manualGeneric.trim() || null,
        strength:
          stage === 'configure'
            ? selectedBrand?.strength ?? null
            : manualStrength.trim() || null,
        dosageForm: activeDosageForm,
        manufacturer: stage === 'configure' ? selectedBrand?.manufacturer ?? null : null,
        startingStock: savedStock,
        stockUnit: savedUnit,
        enteredQuantity: p1,
        enteredUnit: enteredUnitDisplay,
        selectedPackId: stage === 'configure' ? selectedPack?.id ?? null : null,
        stripUnits: packInfo.stripUnits ?? null,
        lowStockThreshold: autoThreshold,
        unitPriceText: stockCalc.referenceUnitPriceText,
        totalStockPrice: parsedPurchaseAmount,
        priceScopeLabel: parsedPurchaseAmount !== null ? 'Recorded purchase' : null,
        referencePackText: stockCalc.referencePackText,
        purchaseDetails,
      });

      onSaved(created);
      setSavedRecord(created);
      setSavedSummaryText(
        stockCalc.calculationSummary ?? `${savedStock} ${formatUnitLabelForCount(savedStock, savedUnit)}`,
      );
      setSavedEstimatedPrice(stockCalc.calculatedTotalPrice);
      setSavedPaidPrice(purchaseDetails ? parsedPurchaseAmount : null);
      setStage('success');
    } catch (err) {
      setSaveError(
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : 'Unable to save medicine. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPrimaryStockInput = (): React.JSX.Element => {
    if (stockMode === 'strips') {
      if (packInfo.stripUnits) {
        return (
          <FormField
            label="Number of strips"
            value={primaryQty}
            onChangeText={(txt) => {
              setPrimaryQty(txt);
              if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
            }}
            placeholder="e.g. 3"
            keyboardType="decimal-pad"
            required
            errorMessage={errors.primaryQty || undefined}
            helperText={`Verified: ${packInfo.stripUnits} ${packInfo.baseUnit} per strip`}
          />
        );
      }

      const perUnitLabel =
        packInfo.baseUnit === 'capsules'
          ? 'Capsules per strip'
          : packInfo.strategy === 'suppository'
            ? 'Pieces per strip'
            : 'Tablets per strip';
      return (
        <FormRow>
          <FormCol>
            <FormField
              label="Number of strips"
              value={primaryQty}
              onChangeText={(txt) => {
                setPrimaryQty(txt);
                if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
              }}
              placeholder="e.g. 3"
              keyboardType="decimal-pad"
              required
              errorMessage={errors.primaryQty || undefined}
            />
          </FormCol>
          <FormCol>
            <FormField
              label={perUnitLabel}
              value={secondaryQty}
              onChangeText={(txt) => {
                setSecondaryQty(txt);
                if (errors.secondaryQty) setErrors((e) => ({ ...e, secondaryQty: '' }));
              }}
              placeholder="e.g. 10"
              keyboardType="decimal-pad"
              required
              errorMessage={errors.secondaryQty || undefined}
              helperText="Enter units per strip"
            />
          </FormCol>
        </FormRow>
      );
    }

    if (stockMode === 'packs') {
      return (
        <FormField
          label="Number of packs"
          value={primaryQty}
          onChangeText={(txt) => {
            setPrimaryQty(txt);
            if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
          }}
          placeholder="e.g. 1"
          keyboardType="decimal-pad"
          required
          errorMessage={errors.primaryQty || undefined}
          helperText={
            packInfo.packTotalUnits
              ? `1 pack = ${packInfo.packTotalUnits} ${packInfo.baseUnit}`
              : undefined
          }
        />
      );
    }

    if (stockMode === 'bottles') {
      if (packInfo.strategy === 'liquid') {
        if (packInfo.bottleVolumeMl) {
          return (
            <FormField
              label="Number of bottles"
              value={primaryQty}
              onChangeText={(txt) => {
                setPrimaryQty(txt);
                if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
              }}
              placeholder="e.g. 2"
              keyboardType="decimal-pad"
              required
              errorMessage={errors.primaryQty || undefined}
              helperText={`Verified: ${packInfo.bottleVolumeMl} ml per bottle`}
            />
          );
        }

        return (
          <FormRow>
            <FormCol>
              <FormField
                label="Number of bottles"
                value={primaryQty}
                onChangeText={(txt) => {
                  setPrimaryQty(txt);
                  if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
                }}
                placeholder="e.g. 1"
                keyboardType="decimal-pad"
                required
                errorMessage={errors.primaryQty || undefined}
              />
            </FormCol>
            <FormCol>
              <FormField
                label="Volume per bottle (ml)"
                value={secondaryQty}
                onChangeText={(txt) => {
                  setSecondaryQty(txt);
                  if (errors.secondaryQty) setErrors((e) => ({ ...e, secondaryQty: '' }));
                }}
                placeholder="e.g. 100"
                keyboardType="decimal-pad"
                required
                errorMessage={errors.secondaryQty || undefined}
                helperText="Enter bottle ml"
              />
            </FormCol>
          </FormRow>
        );
      }

      return (
        <FormField
          label="Number of bottles"
          value={primaryQty}
          onChangeText={(txt) => {
            setPrimaryQty(txt);
            if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
          }}
          placeholder="e.g. 1"
          keyboardType="decimal-pad"
          required
          errorMessage={errors.primaryQty || undefined}
          helperText={
            packInfo.bottleVolumeMl
              ? `Bottle volume: ${packInfo.bottleVolumeMl} ml per bottle`
              : 'Tracked by bottle count'
          }
        />
      );
    }

    if (stockMode === 'ml') {
      return (
        <FormField
          label="Quantity (ml)"
          value={primaryQty}
          onChangeText={(txt) => {
            setPrimaryQty(txt);
            if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
          }}
          placeholder="e.g. 60"
          keyboardType="decimal-pad"
          required
          errorMessage={errors.primaryQty || undefined}
          helperText={
            packInfo.bottleVolumeMl
              ? `Standard bottle size: ${packInfo.bottleVolumeMl} ml`
              : undefined
          }
        />
      );
    }

    if (stockMode === 'containers') {
      const containerLabel = formatUnitLabelForCount(2, effectiveContainerUnit);
      return (
        <FormField
          label={`Number of ${containerLabel}`}
          value={primaryQty}
          onChangeText={(txt) => {
            setPrimaryQty(txt);
            if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
          }}
          placeholder="e.g. 2"
          keyboardType="decimal-pad"
          required
          errorMessage={errors.primaryQty || undefined}
          helperText={
            packInfo.strategy === 'inhaler' && packInfo.meteredDoses
              ? `Each inhaler contains ${packInfo.meteredDoses} puffs`
              : packInfo.packQuantityLabel
                ? `Packaging: ${packInfo.packQuantityLabel}`
                : undefined
          }
        />
      );
    }

    if (stockMode === 'puffs') {
      return (
        <FormField
          label="Remaining puffs"
          value={primaryQty}
          onChangeText={(txt) => {
            setPrimaryQty(txt);
            if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
          }}
          placeholder="e.g. 120"
          keyboardType="decimal-pad"
          required
          errorMessage={errors.primaryQty || undefined}
        />
      );
    }

    // 'direct'
    const nounPlural = formatUnitLabelForCount(2, packInfo.baseUnit);
    return (
      <FormField
        label={packInfo.strategy === 'suppository' ? 'Number of pieces' : `Quantity (${nounPlural})`}
        value={primaryQty}
        onChangeText={(txt) => {
          setPrimaryQty(txt);
          if (errors.primaryQty) setErrors((e) => ({ ...e, primaryQty: '' }));
        }}
        placeholder={packInfo.strategy === 'suppository' ? 'e.g. 6' : 'e.g. 20'}
        keyboardType="decimal-pad"
        required
        errorMessage={errors.primaryQty || undefined}
      />
    );
  };

  const modalTitle = stage === 'success' ? 'Medicine Added' : 'Add Medicine';
  const modalSubtitle =
    stage === 'success'
      ? 'Ready in My Medicines'
      : 'Select a medicine and enter your current stock.';

  const selectedBrandBadge = selectedBrand ? resolveBrandBadge(selectedBrand) : null;
  const selectedUnitDetails =
    stage === 'configure' && selectedBrand
      ? resolvePackQuantityUnit(selectedPack, selectedBrand.dosageForm, availablePacks)
      : null;
  const enteredUnitDisplay = getEnteredQuantityUnit({
    mode: stockMode,
    baseUnit: packInfo.baseUnit,
    containerUnit: effectiveContainerUnit,
  });
  const missingPackagingBannerText =
    stage === 'configure' &&
    (!packInfo.hasReliableDefaultPackaging || Boolean(stockCalc.missingPackagingNotice))
      ? 'Package information is unavailable. Enter your current quantity manually.'
      : null;

  const isSaveDisabled =
    saving ||
    !stockCalc.isValid ||
    (stage === 'manual' && manualName.trim().length === 0);

  return (
    <BottomSheet
      visible={visible}
      title={modalTitle}
      subtitle={modalSubtitle}
      iconName={
        stage === 'search' ? 'search' : stage === 'success' ? 'check-circle' : 'package'
      }
      onClose={onClose}
      onSubmit={
        stage === 'search' || stage === 'success' ? undefined : () => void handleSave()
      }
      submitLabel="Save Medicine"
      cancelLabel="Cancel"
      submitDisabled={isSaveDisabled}
      submitLoading={saving}
      hideFooter={stage === 'success'}
    >
      {stage === 'search' ? (
        <View style={styles.searchStage}>
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search brand or generic (e.g. Napa, Paracetamol)"
          />

          <View style={styles.quickRow}>
            {QUICK_SEARCH_TERMS.map((term) => {
              const active = searchQuery.trim().toLowerCase() === term.toLowerCase();
              return (
                <Pressable
                  key={term}
                  accessibilityRole="button"
                  onPress={() => setSearchQuery(term)}
                  style={[styles.quickChip, active ? styles.quickChipActive : null]}
                >
                  <Text
                    style={[
                      styles.quickChipText,
                      active ? styles.quickChipTextActive : null,
                    ]}
                  >
                    {term}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {searchOfflineNote ? (
            <View style={styles.offlineNotice}>
              <Feather name="wifi-off" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
              <Text style={styles.offlineNoticeText}>{searchOfflineNote}</Text>
            </View>
          ) : null}

          {searching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
              <Text style={styles.loadingText}>Searching medicines...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptySearchBox}>
              <Text style={styles.emptySearchTitle}>No matching medicine found</Text>
              <Text style={styles.emptySearchSub}>
                Try another brand or generic name, or enter medicine details manually.
              </Text>
            </View>
          ) : (
            <View style={styles.resultsList}>
              {searchResults.map((brand) => {
                const packSummary = formatPackSummary(brand.primaryPack);
                const priceSummary = formatUnitOrPackPrice(brand.primaryPack);
                return (
                  <Pressable
                    key={brand.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${brand.name}`}
                    onPress={() => void applyBrandSelection(brand)}
                    style={styles.resultRow}
                  >
                    <MedicineFormThumbnail
                      size="card"
                      dosageForm={brand.dosageForm}
                      imageUrl={brand.primaryImageUrl}
                    />
                    <View style={styles.resultTextCol}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {brand.name}
                      </Text>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {brand.generic?.name ? `${brand.generic.name} · ` : ''}
                        {brand.strength ?? 'Strength N/A'} · {brand.dosageForm ?? 'Medicine'}
                      </Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {packSummary} · {priceSummary}
                      </Text>
                    </View>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={CAREDOSE_EXTENDED_COLORS.primary}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              selectionReqIdRef.current += 1;
              setLoadingBrandDetail(false);
              setSelectedBrand(null);
              setBrandDetail(null);
              setSelectedPackId(null);
              resetFormEntries();
              setManualName(searchQuery.trim());
              setManualForm('Tablet');
              setStage('manual');
              const tabletInfo = extractPackInfo('Tablet', null, []);
              syncModeDefaults(tabletInfo, getDefaultStockMode(tabletInfo));
            }}
            style={styles.manualSwitchBtn}
          >
            <Feather name="edit-3" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text style={styles.manualSwitchText}>
              Can&apos;t find medicine? Enter details manually
            </Text>
          </Pressable>
        </View>
      ) : stage === 'success' && savedRecord ? (
        <View style={styles.successStage}>
          <View style={styles.successIconWrap}>
            <Feather name="check" size={26} color={CAREDOSE_EXTENDED_COLORS.primary} />
          </View>
          <Text style={styles.successTitle}>Medicine added successfully.</Text>
          <Text style={styles.successSub}>
            No schedule was created automatically. You can track doses anytime from schedules.
          </Text>

          <View style={styles.successSummaryCard}>
            <Text style={styles.successMedName}>{savedRecord.name}</Text>
            <Text style={styles.successMedMeta}>
              {[savedRecord.genericName, savedRecord.strength, savedRecord.dosageForm]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View style={styles.successStockBadge}>
              <Feather name="package" size={14} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
              <Text style={styles.successStockText}>
                {savedSummaryText ?? `${savedRecord.stockRemaining} ${savedRecord.stockUnit}`}
              </Text>
            </View>
            {savedPaidPrice !== null ? (
              <Text style={styles.successPriceNote}>
                Recorded purchase paid: ৳{formatBdtCurrency(savedPaidPrice)}
              </Text>
            ) : savedEstimatedPrice !== null ? (
              <Text style={styles.successPriceNote}>
                Estimated stock value: ৳{formatBdtCurrency(savedEstimatedPrice)}
              </Text>
            ) : null}
          </View>

          <View style={styles.successActionsCol}>
            <PrimaryButton
              fullWidth
              label="Create a Dose Schedule"
              onPress={() => {
                const targetId = savedRecord.id;
                onClose();
                router.push(`/medicines/${targetId}?openSchedule=1`);
              }}
            />
            <SecondaryButton
              fullWidth
              label="Go to My Medicines"
              onPress={() => {
                onClose();
                if (pathname !== '/medicines') {
                  router.push('/medicines');
                }
              }}
            />
          </View>
        </View>
      ) : (
        <View>
          {stage === 'configure' && selectedBrand ? (
            <View style={styles.selectedCard}>
              <View style={styles.selectedTopRow}>
                <MedicineFormThumbnail
                  size="card"
                  dosageForm={selectedBrand.dosageForm}
                  imageUrl={selectedBrand.primaryImageUrl}
                />
                <View style={styles.selectedInfoCol}>
                  <View style={styles.selectedTitleRow}>
                    <Text style={styles.selectedName} numberOfLines={2}>
                      {selectedBrand.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleChangeMedicine}
                      style={styles.changeBtn}
                    >
                      <Text style={styles.changeBtnText}>Change</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.selectedMeta}>
                    {selectedBrand.generic?.name ?? 'Generic: Not available'}
                  </Text>
                  <Text style={styles.selectedMeta}>
                    {(selectedBrand.strength ?? 'Strength: N/A')} ·{' '}
                    {selectedBrand.dosageForm ?? 'Form: N/A'}
                  </Text>
                  {selectedBrand.manufacturer ? (
                    <Text style={styles.selectedMfr} numberOfLines={1}>
                      {selectedBrand.manufacturer}
                    </Text>
                  ) : null}
                  {selectedBrandBadge ? (
                    <View style={styles.selectedBadgeRow}>
                      <StatusBadge
                        variant={selectedBrandBadge.variant}
                        label={selectedBrandBadge.label}
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              {loadingBrandDetail ? (
                <View style={styles.packLoadingRow}>
                  <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text style={styles.packLoadingText}>Checking packaging options...</Text>
                </View>
              ) : availablePacks.length > 1 ? (
                <View style={styles.packsSection}>
                  <Text style={styles.packsLabel}>
                    Package size ({availablePacks.length} options)
                  </Text>
                  <View style={styles.packChipsWrap}>
                    {availablePacks.map((pk) => {
                      const active = selectedPack?.id === pk.id;
                      const label = `${pk.packQuantity ?? (pk.packUnits ? `${pk.packUnits}'s pack` : 'Standard')}${
                        pk.packPrice ? ` · ৳${pk.packPrice}` : pk.unitPrice ? ` · ৳${pk.unitPrice}/unit` : ''
                      }`;
                      return (
                        <Pressable
                          key={pk.id}
                          accessibilityRole="button"
                          onPress={() => handleSelectPack(pk)}
                          style={[styles.packChip, active ? styles.packChipActive : null]}
                        >
                          <Text
                            style={[
                              styles.packChipText,
                              active ? styles.packChipTextActive : null,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : selectedPack ? (
                <View style={styles.singlePackBox}>
                  <Text style={styles.singlePackHint}>
                    {formatPackSummary(selectedPack)}
                    {selectedUnitDetails ? ` · ${selectedUnitDetails.value}` : ''}
                  </Text>
                  {selectedPack.packPrice || selectedPack.unitPrice ? (
                    <Text style={styles.refPriceCaption}>
                      Catalogue ref: {formatUnitOrPackPrice(selectedPack)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.manualCard}>
              <View style={styles.manualHeaderRow}>
                <Text style={styles.manualHeaderTitle}>Medicine details</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleChangeMedicine}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Search DB</Text>
                </Pressable>
              </View>
              <FormField
                label="Medicine name"
                value={manualName}
                onChangeText={(txt) => {
                  setManualName(txt);
                  if (errors.manualName) setErrors((e) => ({ ...e, manualName: '' }));
                }}
                placeholder="e.g. Napa 500 mg"
                required
                errorMessage={errors.manualName}
              />
              <FormRow>
                <FormCol>
                  <FormField
                    label="Generic name"
                    value={manualGeneric}
                    onChangeText={setManualGeneric}
                    placeholder="e.g. Paracetamol"
                  />
                </FormCol>
                <FormCol>
                  <FormField
                    label="Strength"
                    value={manualStrength}
                    onChangeText={setManualStrength}
                    placeholder="e.g. 500 mg"
                  />
                </FormCol>
              </FormRow>
              <SelectField
                label="Dosage form"
                value={manualForm}
                options={MANUAL_DOSAGE_FORM_OPTIONS}
                onSelect={handleSelectManualForm}
                required
              />
            </View>
          )}

          {/* Simplified Stock Entry Section */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>How much do you currently have?</Text>
              <View style={styles.unitTag}>
                <Text style={styles.unitTagText}>
                  {formatUnitNounCapitalized(enteredUnitDisplay)}
                </Text>
              </View>
            </View>

            {missingPackagingBannerText ? (
              <View style={styles.infoNoticeBox}>
                <Feather name="info" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                <Text style={styles.infoNoticeText}>{missingPackagingBannerText}</Text>
              </View>
            ) : null}

            {packInfo.strategy === 'injection' && !packInfo.containerUnit ? (
              <View style={styles.modeChipsWrap}>
                {INJECTION_UNIT_OPTIONS.map((opt) => {
                  const active = injectionContainerUnit === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      onPress={() => setInjectionContainerUnit(opt.value)}
                      style={[styles.modeChip, active ? styles.modeChipActive : null]}
                    >
                      <Text
                        style={[
                          styles.modeChipText,
                          active ? styles.modeChipTextActive : null,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {renderPrimaryStockInput()}

            {stockCalc.calculationSummary && primaryQty.trim().length > 0 && stockCalc.isValid ? (
              <View style={styles.calculatedStockPill}>
                <View style={styles.calculatedSummaryHeader}>
                  <Feather name="check-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text style={styles.calculatedStockText}>{stockCalc.calculationSummary}</Text>
                </View>
                {stockCalc.calculatedTotalPrice !== null ? (
                  <View style={styles.calculatedPriceRow}>
                    <View style={styles.calculatedPriceLeft}>
                      <Feather name="tag" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                      <Text style={styles.calculatedPriceText}>
                        Estimated price: ৳{formatBdtCurrency(stockCalc.calculatedTotalPrice)}
                      </Text>
                    </View>
                    {stockCalc.referenceUnitPriceText !== 'Not listed' ? (
                      <Text style={styles.calculatedRateText}>
                        {stockCalc.referenceUnitPriceText}
                      </Text>
                    ) : null}
                  </View>
                ) : stage === 'configure' ? (
                  <Text style={styles.calculatedPriceMissingText}>
                    Catalogue reference price unavailable
                  </Text>
                ) : null}
              </View>
            ) : null}

            {availableModes.length > 1 ? (
              <View style={styles.unitToggleArea}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowUnitPicker((v) => !v)}
                  style={styles.changeUnitLinkBtn}
                >
                  <Feather name="sliders" size={12} color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text style={styles.changeUnitLinkText}>
                    {showUnitPicker ? 'Hide unit options' : 'Change quantity unit'}
                  </Text>
                </Pressable>

                {showUnitPicker ? (
                  <View style={styles.modeChipsWrap}>
                    {availableModes.map((m) => {
                      const active = stockMode === m.mode;
                      return (
                        <Pressable
                          key={m.mode}
                          accessibilityRole="button"
                          onPress={() => handleSelectMode(m.mode)}
                          style={[styles.modeChip, active ? styles.modeChipActive : null]}
                        >
                          <Text
                            style={[
                              styles.modeChipText,
                              active ? styles.modeChipTextActive : null,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Optional Collapsible Purchase Details (hidden by default) */}
          <View style={styles.purchaseCard}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPurchaseDetails((prev) => !prev)}
              style={styles.purchaseToggleRow}
            >
              <View style={styles.purchaseToggleLeft}>
                <Feather
                  name={showPurchaseDetails ? 'chevron-up' : 'plus-circle'}
                  size={15}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
                <Text style={styles.purchaseToggleText}>Add purchase details (optional)</Text>
              </View>
              <Text style={styles.purchaseToggleHint}>
                {showPurchaseDetails
                  ? 'Hide'
                  : stockCalc.calculatedTotalPrice !== null
                    ? `Est. ৳${formatBdtCurrency(stockCalc.calculatedTotalPrice)}`
                    : 'Optional'}
              </Text>
            </Pressable>

            {showPurchaseDetails ? (
              <View style={styles.purchaseFieldsWrap}>
                {stockCalc.calculatedTotalPrice !== null ? (
                  <View style={styles.purchaseEstimateRow}>
                    <Text style={styles.purchaseEstimateText}>
                      Calculated catalogue price: ৳{formatBdtCurrency(stockCalc.calculatedTotalPrice)}
                    </Text>
                    {purchaseAmount.trim() !== formatBdtCurrency(stockCalc.calculatedTotalPrice) ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setPurchaseAmount(formatBdtCurrency(stockCalc.calculatedTotalPrice!));
                          if (errors.purchaseAmount) {
                            setErrors((e) => ({ ...e, purchaseAmount: '' }));
                          }
                        }}
                        style={styles.useEstimateChip}
                      >
                        <Text style={styles.useEstimateChipText}>
                          Use ৳{formatBdtCurrency(stockCalc.calculatedTotalPrice)}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
                <FormRow>
                  <FormCol>
                    <FormField
                      label="Amount paid (৳ BDT)"
                      value={purchaseAmount}
                      onChangeText={(txt) => {
                        setPurchaseAmount(txt);
                        if (errors.purchaseAmount) setErrors((e) => ({ ...e, purchaseAmount: '' }));
                      }}
                      placeholder={
                        stockCalc.calculatedTotalPrice !== null
                          ? `e.g. ${formatBdtCurrency(stockCalc.calculatedTotalPrice)}`
                          : 'e.g. 50.00'
                      }
                      keyboardType="decimal-pad"
                      errorMessage={errors.purchaseAmount || undefined}
                    />
                  </FormCol>
                  <FormCol>
                    <DateField
                      label="Purchase date"
                      value={purchaseDate}
                      onChangeDate={setPurchaseDate}
                    />
                  </FormCol>
                </FormRow>
                <FormField
                  label="Pharmacy / vendor"
                  value={purchaseVendor}
                  onChangeText={setPurchaseVendor}
                  placeholder="Optional (e.g. Lazz Pharma)"
                />
                <Text style={styles.purchaseDisclaimer}>
                  Records only what you paid. Catalogue reference prices are never copied automatically.
                </Text>
              </View>
            ) : null}
          </View>

          {saveError ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.error} />
              <Text style={styles.errorBannerText}>{saveError}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchStage: {
    paddingBottom: 6,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  quickChipActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  quickChipTextActive: {
    color: '#FFFFFF',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    marginBottom: 8,
  },
  offlineNoticeText: {
    flex: 1,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  loadingText: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  emptySearchBox: {
    padding: 16,
    borderRadius: CAREDOSE_RADIUS.field,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    alignItems: 'center',
    marginVertical: 8,
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  emptySearchSub: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    textAlign: 'center',
  },
  resultsList: {
    gap: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: CAREDOSE_RADIUS.field,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    minHeight: MIN_TOUCH_TARGET,
  },
  resultTextCol: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  resultMeta: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  resultSub: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
    fontWeight: '600',
  },
  manualSwitchBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: CAREDOSE_RADIUS.field,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: MIN_TOUCH_TARGET,
  },
  manualSwitchText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    textAlign: 'center',
  },
  selectedCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 12,
    marginBottom: 10,
  },
  selectedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  selectedTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectedName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  selectedMeta: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  selectedMfr: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
  },
  changeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  changeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  packLoadingRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packLoadingText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  packsSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#C5E8D8',
  },
  packsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
    marginBottom: 6,
  },
  packChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  packChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5E8D8',
  },
  packChipActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  packChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  packChipTextActive: {
    color: '#FFFFFF',
  },
  singlePackBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C5E8D8',
  },
  singlePackHint: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  refPriceCaption: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  selectedBadgeRow: {
    marginTop: 6,
    alignItems: 'flex-start',
  },
  unitToggleArea: {
    marginTop: 10,
  },
  changeUnitLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 4,
  },
  changeUnitLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  purchaseCard: {
    borderRadius: CAREDOSE_RADIUS.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  purchaseToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 36,
  },
  purchaseToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  purchaseToggleText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  purchaseToggleHint: {
    flexShrink: 0,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
    fontWeight: '600',
    textAlign: 'right',
  },
  purchaseFieldsWrap: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  purchaseDisclaimer: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.errorSurface,
    borderWidth: 1,
    borderColor: '#F2C6C6',
    marginBottom: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.error,
  },
  successStage: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  successIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    textAlign: 'center',
  },
  successSub: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  successSummaryCard: {
    width: '100%',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  successMedName: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  successMedMeta: {
    marginTop: 3,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  successStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    alignSelf: 'flex-start',
  },
  successStockText: {
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  successActionsCol: {
    width: '100%',
    gap: 10,
  },
  manualCard: {
    padding: 12,
    borderRadius: CAREDOSE_RADIUS.card,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    marginBottom: 12,
  },
  manualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  manualHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  sectionBox: {
    padding: 12,
    borderRadius: CAREDOSE_RADIUS.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeading: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  unitTag: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
  },
  unitTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  modeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  modeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  modeChipActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  modeChipTextActive: {
    color: '#FFFFFF',
  },
  infoNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 8,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    marginBottom: 10,
  },
  infoNoticeText: {
    flex: 1,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    lineHeight: 16,
  },
  calculatedStockPill: {
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    marginTop: 4,
  },
  calculatedSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calculatedStockText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  calculatedPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#D5EFE3',
  },
  calculatedPriceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  calculatedPriceText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  calculatedRateText: {
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  calculatedPriceMissingText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    paddingLeft: 20,
  },
  purchaseEstimateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    marginBottom: 10,
  },
  purchaseEstimateText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  useEstimateChip: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  useEstimateChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successPriceNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
