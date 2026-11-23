import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
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
        <View className="pb-1.5">
          <SearchInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search brand or generic (e.g. Napa, Paracetamol)"
          />

          <View className="my-2.5 flex-row flex-wrap gap-1.5">
            {QUICK_SEARCH_TERMS.map((term) => {
              const active = searchQuery.trim().toLowerCase() === term.toLowerCase();
              return (
                <Pressable
                  key={term}
                  accessibilityRole="button"
                  onPress={() => setSearchQuery(term)}
                  className={`rounded-full border px-2.5 py-1.5 ${
                    active ? 'border-primary bg-primary' : 'border-border bg-white'
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? 'text-white' : 'text-main'
                    }`}
                  >
                    {term}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {searchOfflineNote ? (
            <View className="mb-2 flex-row items-center gap-1.5 rounded-lg bg-[#FDF5E6] p-2">
              <Feather name="wifi-off" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
              <Text className="flex-1 text-[11px] font-semibold text-warning">
                {searchOfflineNote}
              </Text>
            </View>
          ) : null}

          {searching ? (
            <View className="flex-row items-center justify-center gap-2 py-5">
              <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
              <Text className="text-xs text-[#5A706B]">Searching medicines...</Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View className="my-2 items-center rounded-field border border-border bg-background p-4">
              <Text className="text-sm font-semibold text-main">No matching medicine found</Text>
              <Text className="mt-1 text-center text-xs text-[#5A706B]">
                Try another brand or generic name, or enter medicine details manually.
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {searchResults.map((brand) => {
                const packSummary = formatPackSummary(brand.primaryPack);
                const priceSummary = formatUnitOrPackPrice(brand.primaryPack);
                return (
                  <Pressable
                    key={brand.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${brand.name}`}
                    onPress={() => void applyBrandSelection(brand)}
                    className="min-h-[44px] flex-row items-center gap-2.5 rounded-field border border-border bg-white p-2.5"
                  >
                    <MedicineFormThumbnail
                      size="card"
                      dosageForm={brand.dosageForm}
                      imageUrl={brand.primaryImageUrl}
                    />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-main" numberOfLines={1}>
                        {brand.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                        {brand.generic?.name ? `${brand.generic.name} · ` : ''}
                        {brand.strength ?? 'Strength N/A'} · {brand.dosageForm ?? 'Medicine'}
                      </Text>
                      <Text className="mt-0.5 text-[11px] font-semibold text-primary-dark" numberOfLines={1}>
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
            className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-field border border-[#C5E8D8] bg-mint px-3 py-2.5"
          >
            <Feather name="edit-3" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="shrink text-center text-xs font-semibold text-primary">
              Can&apos;t find medicine? Enter details manually
            </Text>
          </Pressable>
        </View>
      ) : stage === 'success' && savedRecord ? (
        <View className="items-center py-2.5">
          <View className="mb-3 h-[54px] w-[54px] items-center justify-center rounded-full border border-[#C5E8D8] bg-mint">
            <Feather name="check" size={26} color={CAREDOSE_EXTENDED_COLORS.primary} />
          </View>
          <Text className="text-center text-[17px] font-bold text-main">
            Medicine added successfully.
          </Text>
          <Text className="mt-1 mb-3.5 text-center text-xs leading-[18px] text-[#5A706B]">
            No schedule was created automatically. You can track doses anytime from schedules.
          </Text>

          <View className="mb-4 w-full rounded-card border border-border bg-background p-3.5">
            <Text className="text-[15px] font-bold text-main">{savedRecord.name}</Text>
            <Text className="mt-0.5 text-xs text-[#5A706B]">
              {[savedRecord.genericName, savedRecord.strength, savedRecord.dosageForm]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View className="mt-2.5 flex-row items-center gap-1.5 self-start rounded-lg border border-[#C5E8D8] bg-mint px-2.5 py-2">
              <Feather name="package" size={14} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
              <Text className="text-xs font-bold text-primary-dark">
                {savedSummaryText ?? `${savedRecord.stockRemaining} ${savedRecord.stockUnit}`}
              </Text>
            </View>
            {savedPaidPrice !== null ? (
              <Text className="mt-1.5 text-xs font-semibold text-[#5A706B]">
                Recorded purchase paid: ৳{formatBdtCurrency(savedPaidPrice)}
              </Text>
            ) : savedEstimatedPrice !== null ? (
              <Text className="mt-1.5 text-xs font-semibold text-[#5A706B]">
                Estimated stock value: ৳{formatBdtCurrency(savedEstimatedPrice)}
              </Text>
            ) : null}
          </View>

          <View className="w-full gap-2.5">
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
            <View className="mb-2.5 rounded-card border border-[#C5E8D8] bg-mint p-3">
              <View className="flex-row items-center gap-3">
                <MedicineFormThumbnail
                  size="card"
                  dosageForm={selectedBrand.dosageForm}
                  imageUrl={selectedBrand.primaryImageUrl}
                />
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="flex-1 min-w-0 text-[15px] font-bold text-main" numberOfLines={2}>
                      {selectedBrand.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleChangeMedicine}
                      className="rounded-full border border-border bg-white px-2.5 py-1"
                    >
                      <Text className="text-[11px] font-semibold text-primary">Change</Text>
                    </Pressable>
                  </View>
                  <Text className="mt-0.5 text-xs text-[#5A706B]">
                    {selectedBrand.generic?.name ?? 'Generic: Not available'}
                  </Text>
                  <Text className="mt-0.5 text-xs text-[#5A706B]">
                    {(selectedBrand.strength ?? 'Strength: N/A')} ·{' '}
                    {selectedBrand.dosageForm ?? 'Form: N/A'}
                  </Text>
                  {selectedBrand.manufacturer ? (
                    <Text className="mt-0.5 text-[11px] text-[#7D928D]" numberOfLines={1}>
                      {selectedBrand.manufacturer}
                    </Text>
                  ) : null}
                  {selectedBrandBadge ? (
                    <View className="mt-1.5 items-start">
                      <StatusBadge
                        variant={selectedBrandBadge.variant}
                        label={selectedBrandBadge.label}
                      />
                    </View>
                  ) : null}
                </View>
              </View>

              {loadingBrandDetail ? (
                <View className="mt-2 flex-row items-center gap-1.5">
                  <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text className="text-[11px] text-[#5A706B]">Checking packaging options...</Text>
                </View>
              ) : availablePacks.length > 1 ? (
                <View className="mt-2.5 border-t border-[#C5E8D8] pt-2.5">
                  <Text className="mb-1.5 text-[11px] font-bold text-primary-dark">
                    Package size ({availablePacks.length} options)
                  </Text>
                  <View className="flex-row flex-wrap gap-1.5">
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
                          className={`rounded-full border px-2.5 py-1.5 ${
                            active
                              ? 'border-primary bg-primary'
                              : 'border-[#C5E8D8] bg-white'
                          }`}
                        >
                          <Text
                            className={`text-[11px] font-semibold ${
                              active ? 'text-white' : 'text-main'
                            }`}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : selectedPack ? (
                <View className="mt-2 border-t border-[#C5E8D8] pt-2">
                  <Text className="text-[11px] font-semibold text-primary-dark">
                    {formatPackSummary(selectedPack)}
                    {selectedUnitDetails ? ` · ${selectedUnitDetails.value}` : ''}
                  </Text>
                  {selectedPack.packPrice || selectedPack.unitPrice ? (
                    <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                      Catalogue ref: {formatUnitOrPackPrice(selectedPack)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : (
            <View className="mb-3 rounded-card border border-border bg-background p-3">
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="text-[13px] font-bold text-main">Medicine details</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleChangeMedicine}
                  className="rounded-full border border-border bg-white px-2.5 py-1"
                >
                  <Text className="text-[11px] font-semibold text-primary">Search DB</Text>
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
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <View className="mb-2 flex-row items-center justify-between gap-2">
              <Text className="flex-1 min-w-0 shrink text-[13px] font-bold text-main">
                How much do you currently have?
              </Text>
              <View className="shrink-0 rounded-full bg-mint px-2 py-0.5">
                <Text className="text-[11px] font-bold text-primary-dark">
                  {formatUnitNounCapitalized(enteredUnitDisplay)}
                </Text>
              </View>
            </View>

            {missingPackagingBannerText ? (
              <View className="mb-2.5 flex-row items-start gap-1.5 rounded-lg border border-border bg-background p-2">
                <Feather name="info" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                <Text className="flex-1 text-[11px] leading-4 text-[#5A706B]">
                  {missingPackagingBannerText}
                </Text>
              </View>
            ) : null}

            {packInfo.strategy === 'injection' && !packInfo.containerUnit ? (
              <View className="mb-2.5 flex-row flex-wrap gap-1.5">
                {INJECTION_UNIT_OPTIONS.map((opt) => {
                  const active = injectionContainerUnit === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      accessibilityRole="button"
                      onPress={() => setInjectionContainerUnit(opt.value)}
                      className={`rounded-full border px-2.5 py-1.5 ${
                        active ? 'border-primary bg-primary' : 'border-border bg-background'
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          active ? 'text-white' : 'text-main'
                        }`}
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
              <View className="mt-1 gap-1.5 rounded-lg border border-[#C5E8D8] bg-mint px-2.5 py-2">
                <View className="flex-row items-center gap-1.5">
                  <Feather name="check-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text className="flex-1 text-xs font-bold text-primary-dark">
                    {stockCalc.calculationSummary}
                  </Text>
                </View>
                {stockCalc.calculatedTotalPrice !== null ? (
                  <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-[#D5EFE3] pt-1.5">
                    <View className="flex-1 min-w-0 flex-row items-center gap-1.5">
                      <Feather name="tag" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                      <Text className="shrink text-xs font-bold text-main">
                        Estimated price: ৳{formatBdtCurrency(stockCalc.calculatedTotalPrice)}
                      </Text>
                    </View>
                    {stockCalc.referenceUnitPriceText !== 'Not listed' ? (
                      <Text className="shrink-0 text-[11px] font-semibold text-[#5A706B]">
                        {stockCalc.referenceUnitPriceText}
                      </Text>
                    ) : null}
                  </View>
                ) : stage === 'configure' ? (
                  <Text className="pl-5 text-[11px] text-[#5A706B]">
                    Catalogue reference price unavailable
                  </Text>
                ) : null}
              </View>
            ) : null}

            {availableModes.length > 1 ? (
              <View className="mt-2.5">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowUnitPicker((v) => !v)}
                  className="mb-1 flex-row items-center gap-1.5 self-start py-1"
                >
                  <Feather name="sliders" size={12} color={CAREDOSE_EXTENDED_COLORS.primary} />
                  <Text className="text-xs font-semibold text-primary">
                    {showUnitPicker ? 'Hide unit options' : 'Change quantity unit'}
                  </Text>
                </Pressable>

                {showUnitPicker ? (
                  <View className="mb-2.5 flex-row flex-wrap gap-1.5">
                    {availableModes.map((m) => {
                      const active = stockMode === m.mode;
                      return (
                        <Pressable
                          key={m.mode}
                          accessibilityRole="button"
                          onPress={() => handleSelectMode(m.mode)}
                          className={`rounded-full border px-2.5 py-1.5 ${
                            active ? 'border-primary bg-primary' : 'border-border bg-background'
                          }`}
                        >
                          <Text
                            className={`text-xs font-semibold ${
                              active ? 'text-white' : 'text-main'
                            }`}
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
          <View className="mb-2.5 rounded-card border border-border bg-white p-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPurchaseDetails((prev) => !prev)}
              className="flex-row items-center justify-between gap-2.5 min-h-[36px]"
            >
              <View className="flex-1 min-w-0 flex-row items-center gap-2">
                <Feather
                  name={showPurchaseDetails ? 'chevron-up' : 'plus-circle'}
                  size={15}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
                <Text className="flex-1 min-w-0 shrink text-[13px] font-semibold text-primary-dark">
                  Add purchase details (optional)
                </Text>
              </View>
              <Text className="shrink-0 text-right text-[11px] font-semibold text-[#7D928D]">
                {showPurchaseDetails
                  ? 'Hide'
                  : stockCalc.calculatedTotalPrice !== null
                    ? `Est. ৳${formatBdtCurrency(stockCalc.calculatedTotalPrice)}`
                    : 'Optional'}
              </Text>
            </Pressable>

            {showPurchaseDetails ? (
              <View className="mt-2.5 border-t border-border pt-2.5">
                {stockCalc.calculatedTotalPrice !== null ? (
                  <View className="mb-2.5 flex-row flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C5E8D8] bg-mint px-2.5 py-1.5">
                    <Text className="flex-1 min-w-0 shrink text-[11px] font-semibold text-primary-dark">
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
                        className="shrink-0 rounded-full bg-primary px-2.5 py-1"
                      >
                        <Text className="text-[11px] font-bold text-white">
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
                <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                  Records only what you paid. Catalogue reference prices are never copied automatically.
                </Text>
              </View>
            ) : null}
          </View>

          {saveError ? (
            <View className="mb-2 flex-row items-center gap-2 rounded-lg border border-[#F2C6C6] bg-[#FDECEC] p-2.5">
              <Feather name="alert-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.error} />
              <Text className="flex-1 text-xs font-semibold text-error">{saveError}</Text>
            </View>
          ) : null}
        </View>
      )}
    </BottomSheet>
  );
}
