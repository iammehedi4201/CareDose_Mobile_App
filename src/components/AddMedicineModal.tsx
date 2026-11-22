import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
  getPriceUnitBasis,
  getSuggestedInstructionPlaceholder,
  resolveBrandPacks,
  StockEntryMode,
} from '../features/medications/stock-calculator';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS, MIN_TOUCH_TARGET } from '../theme/tokens';
import { FormCol, FormField, FormRow, SelectField, validateRequiredFields } from './FormFields';
import { MedicineFormThumbnail } from './MedicineFormThumbnail';
import { BottomSheet } from './Overlays';
import { SearchInput } from './SearchInput';

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

type ModalStage = 'search' | 'configure' | 'manual';
type PriceInputScope = 'total' | 'per_unit_or_pack';

export interface AddMedicineModalProps {
  visible: boolean;
  initialBrand?: CatalogueBrandDetailDto | CatalogueBrandSummaryDto | null;
  onClose: () => void;
  onSaved: (created: PersonalMedicationRecord) => void;
}

export function AddMedicineModal({
  visible,
  initialBrand = null,
  onClose,
  onSaved,
}: AddMedicineModalProps): React.JSX.Element {
  const { addMedication } = useMedications();

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
  const [secondaryQty, setSecondaryQty] = useState('');
  const [injectionContainerUnit, setInjectionContainerUnit] = useState<string>('vials');

  // Price states
  const [priceInput, setPriceInput] = useState('');
  const [priceEditedManually, setPriceEditedManually] = useState(false);
  const [priceScope, setPriceScope] = useState<PriceInputScope>('total');

  // Instructions + save state
  const [instructions, setInstructions] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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
    (
      nextInfo: ReturnType<typeof extractPackInfo>,
      nextMode: StockEntryMode,
      preserveManualPrice = false,
    ) => {
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
      if (!preserveManualPrice) {
        setPriceEditedManually(false);
        setPriceScope('total');
      }
    },
    [],
  );

  const applyBrandSelection = useCallback(
    async (brand: CatalogueBrandSummaryDto | CatalogueBrandDetailDto) => {
      const selReqId = ++selectionReqIdRef.current;
      const initialPacks = resolveBrandPacks(
        brand,
        'packs' in brand ? brand : null,
      );
      const firstPack = initialPacks[0] ?? brand.primaryPack ?? null;
      const initialInfo = extractPackInfo(brand.dosageForm, firstPack, initialPacks);
      const defaultMode = getDefaultStockMode(initialInfo);

      setSelectedBrand(brand);
      setBrandDetail('packs' in brand ? brand : null);
      setSelectedPackId(firstPack?.id ?? null);
      setStage('configure');
      setPrimaryQty('');
      setPriceInput('');
      setErrors({});
      syncModeDefaults(initialInfo, defaultMode, false);

      // Fetch full pack variations in background if not already hydrated
      if (!('packs' in brand) || brand.packs.length === 0) {
        setLoadingBrandDetail(true);
        try {
          const detail = await getCatalogueBrandDetail(brand.sourceId);
          if (selReqId !== selectionReqIdRef.current) return;
          setBrandDetail(detail);
          const fullPacks = resolveBrandPacks(brand, detail);
          const nextFirst =
            fullPacks.find((p) => p.id === firstPack?.id) ?? fullPacks[0] ?? null;
          if (nextFirst) {
            setSelectedPackId(nextFirst.id);
            const fullInfo = extractPackInfo(detail.dosageForm, nextFirst, fullPacks);
            if (
              fullInfo.containerUnit !== initialInfo.containerUnit &&
              fullInfo.containerUnit
            ) {
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
    [syncModeDefaults],
  );

  // Reset modal whenever visibility toggles
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setInstructions('');
    setSaving(false);
    setPriceInput('');
    setPriceEditedManually(false);
    setPriceScope('total');
    setPrimaryQty('');
    setSecondaryQty('');
    setManualName('');
    setManualGeneric('');
    setManualStrength('');
    setManualForm('Tablet');
    setSearchQuery('');

    if (initialBrand) {
      void applyBrandSelection(initialBrand);
    } else {
      selectionReqIdRef.current += 1;
      setStage('search');
      setSelectedBrand(null);
      setBrandDetail(null);
      setSelectedPackId(null);
      setLoadingBrandDetail(false);
    }
  }, [visible, initialBrand, applyBrandSelection]);

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

  // Auto-populate Price whenever calculatedTotalPrice updates (unless user edited price manually)
  useEffect(() => {
    if (priceEditedManually) return;
    if (stockCalc.calculatedTotalPrice !== null) {
      setPriceScope('total');
      setPriceInput(formatBdtCurrency(stockCalc.calculatedTotalPrice));
    } else if (stage === 'configure') {
      setPriceInput('');
    }
  }, [stockCalc.calculatedTotalPrice, priceEditedManually, stage]);

  const handleSelectPack = (pack: CataloguePackDto): void => {
    setSelectedPackId(pack.id);
    const nextInfo = extractPackInfo(selectedBrand?.dosageForm, pack, availablePacks);
    const currentAvailable = getAvailableStockModes(nextInfo);
    const stillValid = currentAvailable.some((m) => m.mode === stockMode);
    const nextMode = stillValid ? stockMode : getDefaultStockMode(nextInfo);
    setPriceEditedManually(false);
    syncModeDefaults(nextInfo, nextMode, false);
  };

  const handleSelectMode = (nextMode: StockEntryMode): void => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.primaryQty;
      delete next.secondaryQty;
      return next;
    });
    setPrimaryQty('');
    syncModeDefaults(packInfo, nextMode, priceEditedManually);
  };

  const handleSelectManualForm = (nextForm: string): void => {
    setManualForm(nextForm);
    const nextInfo = extractPackInfo(nextForm, null, []);
    const nextDefaultMode = getDefaultStockMode(nextInfo);
    setPrimaryQty('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.primaryQty;
      delete next.secondaryQty;
      return next;
    });
    syncModeDefaults(nextInfo, nextDefaultMode, false);
  };

  const priceBasis = useMemo(
    () =>
      getPriceUnitBasis({
        mode: stockMode,
        primaryQty,
        stockRemaining: stockCalc.stockRemaining,
        containerUnit: effectiveContainerUnit,
        stockUnit: stockCalc.stockUnit,
      }),
    [stockMode, primaryQty, stockCalc.stockRemaining, effectiveContainerUnit, stockCalc.stockUnit],
  );

  const handleSwitchPriceScope = (nextScope: PriceInputScope): void => {
    if (nextScope === priceScope) return;
    const currentNum = parseNonNegativeNumberInput(priceInput);
    const mult = priceBasis.multiplier;
    if (nextScope === 'per_unit_or_pack') {
      setPriceScope('per_unit_or_pack');
      setPriceEditedManually(true);
      if (currentNum !== null && mult !== null && mult > 0) {
        setPriceInput(formatBdtCurrency(currentNum / mult));
      }
      return;
    }

    setPriceScope('total');
    if (currentNum !== null && mult !== null && mult > 0) {
      setPriceEditedManually(true);
      setPriceInput(formatBdtCurrency(currentNum * mult));
    } else {
      setPriceEditedManually(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    const nextErrors: Record<string, string> = {};

    if (stage === 'manual') {
      Object.assign(
        nextErrors,
        validateRequiredFields(
          { manualName, instructions },
          {
            manualName: 'Medicine name',
            instructions: 'Personal instructions',
          },
        ),
      );
    } else {
      Object.assign(
        nextErrors,
        validateRequiredFields({ instructions }, { instructions: 'Personal instructions' }),
      );
    }

    const p1 = parseNonNegativeNumberInput(primaryQty);
    if (primaryQty.trim().length === 0) {
      nextErrors.primaryQty = 'Enter current quantity.';
    } else if (p1 === null) {
      nextErrors.primaryQty = 'Enter a valid non-negative number.';
    }

    if (stockMode === 'strips' || (stockMode === 'bottles' && packInfo.strategy === 'liquid')) {
      const p2 = parseNonNegativeNumberInput(secondaryQty);
      if (secondaryQty.trim().length === 0) {
        nextErrors.secondaryQty =
          stockMode === 'strips' ? 'Enter units per strip.' : 'Enter volume (ml) per bottle.';
      } else if (p2 === null || p2 <= 0) {
        nextErrors.secondaryQty = 'Must be greater than 0.';
      }
    }

    let parsedPrice: number | null = null;
    if (priceInput.trim().length > 0) {
      parsedPrice = parseNonNegativeNumberInput(priceInput);
      if (parsedPrice === null) {
        nextErrors.priceInput = 'Enter a valid non-negative price.';
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !stockCalc.isValid || stockCalc.stockRemaining === null) {
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

    let totalStockPrice: number | null = null;
    let priceScopeLabel: string | null = null;
    let unitPriceText = stockCalc.referenceUnitPriceText;

    if (parsedPrice !== null) {
      if (priceScope === 'total') {
        totalStockPrice = parsedPrice;
        priceScopeLabel = 'Total stock value';
        const formattedTotal = `৳${formatBdtCurrency(totalStockPrice)} total`;
        unitPriceText =
          stockCalc.referenceUnitPriceText !== 'Not listed'
            ? `${formattedTotal} (${stockCalc.referenceUnitPriceText})`
            : formattedTotal;
      } else {
        const count = priceBasis.multiplier ?? 1;
        totalStockPrice = Number((parsedPrice * count).toFixed(2));
        priceScopeLabel = `৳${formatBdtCurrency(parsedPrice)}/${priceBasis.unitLabel}`;
        unitPriceText = `৳${formatBdtCurrency(totalStockPrice)} total (৳${formatBdtCurrency(parsedPrice)}/${priceBasis.unitLabel})`;
      }
    }

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
        personalInstructions: instructions.trim(),
        startingStock: savedStock,
        stockUnit: savedUnit,
        stripUnits: packInfo.stripUnits ?? null,
        lowStockThreshold: autoThreshold,
        unitPriceText,
        totalStockPrice,
        priceScopeLabel,
        referencePackText: stockCalc.referencePackText,
      });

      onSaved(created);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const renderPrimaryStockInput = (): React.JSX.Element => {
    if (stockMode === 'strips') {
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
              placeholder={packInfo.stripUnits ? String(packInfo.stripUnits) : 'e.g. 10'}
              keyboardType="decimal-pad"
              required
              errorMessage={errors.secondaryQty || undefined}
              helperText={
                packInfo.stripUnits
                  ? packInfo.stripsInPack
                    ? `${packInfo.stripsInPack} strips in pack (${packInfo.packQuantityLabel})`
                    : packInfo.packQuantityLabel
                      ? `Catalogue: ${packInfo.stripUnits}/strip (${packInfo.packQuantityLabel})`
                      : `Catalogue: ${packInfo.stripUnits} per strip`
                  : 'Enter your strip count'
              }
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
                placeholder={packInfo.bottleVolumeMl ? String(packInfo.bottleVolumeMl) : 'e.g. 100'}
                keyboardType="decimal-pad"
                required
                errorMessage={errors.secondaryQty || undefined}
                helperText={
                  packInfo.bottleVolumeMl
                    ? `From pack (${packInfo.packQuantityLabel})`
                    : 'Enter bottle ml'
                }
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
          label="Available quantity (ml)"
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
              ? `Each pack contains ${packInfo.meteredDoses} puffs`
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
        label={`Quantity (${nounPlural})`}
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

  const pricePerUnitHint = useMemo(() => {
    const numPrice = parseNonNegativeNumberInput(priceInput);
    if (priceScope === 'total') {
      if (priceBasis.multiplier !== null && priceBasis.multiplier > 0 && numPrice !== null) {
        const computedUnit = numPrice / priceBasis.multiplier;
        const unitPart =
          computedUnit > 0
            ? `৳${formatBdtCurrency(computedUnit)}/${priceBasis.unitLabel}`
            : null;
        return `Total stock value${unitPart ? ` (${unitPart})` : ''}${
          stockCalc.referenceUnitPriceText !== 'Not listed'
            ? ` · Catalogue: ${stockCalc.referenceUnitPriceText}`
            : ''
        }`;
      }
      return stockCalc.referenceUnitPriceText !== 'Not listed'
        ? `Total stock value · Catalogue ref: ${stockCalc.referenceUnitPriceText}`
        : 'Represents the total value of the stock you entered above';
    }

    if (numPrice !== null && priceBasis.multiplier !== null && priceBasis.multiplier > 0) {
      return `Equals ৳${formatBdtCurrency(numPrice * priceBasis.multiplier)} total stock value`;
    }
    return `Represents the price of 1 ${priceBasis.unitLabel}`;
  }, [priceInput, priceScope, priceBasis, stockCalc.referenceUnitPriceText]);

  const modalTitle =
    stage === 'search'
      ? 'Add Medicine'
      : stage === 'manual'
        ? 'Add Medicine (Manual)'
        : 'Add Medicine';

  const modalSubtitle =
    stage === 'search'
      ? 'Search by brand or generic name to auto-fill details'
      : stage === 'manual'
        ? 'Enter medicine details when unavailable in database'
        : 'Confirm quantity, price & personal instructions';

  return (
    <BottomSheet
      visible={visible}
      title={modalTitle}
      subtitle={modalSubtitle}
      iconName={stage === 'search' ? 'search' : 'package'}
      warningNote={
        stage === 'search'
          ? undefined
          : 'Adding a medicine does not auto-create a schedule. Add dose times separately.'
      }
      onClose={onClose}
      onSubmit={stage === 'search' ? undefined : () => void handleSave()}
      submitLabel="Save medicine"
      cancelLabel="Cancel"
      submitLoading={saving}
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
              setManualName(searchQuery.trim());
              setStage('manual');
              setErrors({});
              syncModeDefaults(extractPackInfo(manualForm, null, []), 'direct', false);
            }}
            style={styles.manualSwitchBtn}
          >
            <Feather name="edit-3" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text style={styles.manualSwitchText}>
              Can&apos;t find medicine? Enter details manually
            </Text>
          </Pressable>
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
                    {!initialBrand ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          selectionReqIdRef.current += 1;
                          setLoadingBrandDetail(false);
                          setStage('search');
                        }}
                        style={styles.changeBtn}
                      >
                        <Text style={styles.changeBtnText}>Change</Text>
                      </Pressable>
                    ) : null}
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
                    Select packaging ({availablePacks.length} options)
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
                <Text style={styles.singlePackHint}>
                  Packaging: {formatPackSummary(selectedPack)} · {formatUnitOrPackPrice(selectedPack)}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.manualCard}>
              <View style={styles.manualHeaderRow}>
                <Text style={styles.manualHeaderTitle}>Medicine details</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStage('search')}
                  style={styles.changeBtn}
                >
                  <Text style={styles.changeBtnText}>Search DB</Text>
                </Pressable>
              </View>
              <FormField
                label="Medicine name"
                value={manualName}
                onChangeText={setManualName}
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

          {/* Dynamic Stock Section */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Quantity you have</Text>
              <View style={styles.unitTag}>
                <Text style={styles.unitTagText}>
                  {formatUnitNounCapitalized(stockCalc.stockUnit)}
                </Text>
              </View>
            </View>

            {availableModes.length > 1 ? (
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

            {stockCalc.missingPackagingNotice ? (
              <View style={styles.infoNoticeBox}>
                <Feather name="info" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
                <Text style={styles.infoNoticeText}>{stockCalc.missingPackagingNotice}</Text>
              </View>
            ) : null}

            {renderPrimaryStockInput()}

            {stockCalc.calculationSummary && primaryQty.trim().length > 0 ? (
              <View style={styles.calculatedStockPill}>
                <Feather name="check-circle" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text style={styles.calculatedStockText}>{stockCalc.calculationSummary}</Text>
              </View>
            ) : null}
          </View>

          {/* Price Section */}
          <View style={styles.sectionBox}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Price (৳ BDT)</Text>
              <View style={styles.priceScopeRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSwitchPriceScope('total')}
                  style={[
                    styles.scopeChip,
                    priceScope === 'total' ? styles.scopeChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      priceScope === 'total' ? styles.scopeChipTextActive : null,
                    ]}
                  >
                    Total stock
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSwitchPriceScope('per_unit_or_pack')}
                  style={[
                    styles.scopeChip,
                    priceScope === 'per_unit_or_pack' ? styles.scopeChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeChipText,
                      priceScope === 'per_unit_or_pack' ? styles.scopeChipTextActive : null,
                    ]}
                  >
                    Per {priceBasis.unitLabel}
                  </Text>
                </Pressable>
              </View>
            </View>

            <FormField
              label={
                priceScope === 'total'
                  ? 'Total stock value (৳)'
                  : `Price per ${priceBasis.unitLabel} (৳)`
              }
              value={priceInput}
              onChangeText={(txt) => {
                setPriceEditedManually(true);
                setPriceInput(txt);
                if (errors.priceInput) setErrors((e) => ({ ...e, priceInput: '' }));
              }}
              placeholder={
                stockCalc.calculatedTotalPrice !== null
                  ? formatBdtCurrency(stockCalc.calculatedTotalPrice)
                  : 'Optional (e.g. 50.00)'
              }
              keyboardType="decimal-pad"
              errorMessage={errors.priceInput || undefined}
              helperText={pricePerUnitHint}
            />

            {priceEditedManually && stockCalc.calculatedTotalPrice !== null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPriceScope('total');
                  setPriceEditedManually(false);
                  setPriceInput(formatBdtCurrency(stockCalc.calculatedTotalPrice!));
                }}
                style={styles.resetPriceBtn}
              >
                <Feather name="rotate-ccw" size={12} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text style={styles.resetPriceText}>
                  Reset to calculated ৳{formatBdtCurrency(stockCalc.calculatedTotalPrice)}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Instructions */}
          <FormField
            label="Personal instructions"
            value={instructions}
            onChangeText={(txt) => {
              setInstructions(txt);
              if (errors.instructions) setErrors((e) => ({ ...e, instructions: '' }));
            }}
            placeholder={getSuggestedInstructionPlaceholder(packInfo.strategy)}
            required
            errorMessage={errors.instructions || undefined}
            helperText="Low-stock alerts can be customized later in Medicine Details."
          />
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
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  selectedCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 12,
    marginBottom: 12,
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
  singlePackHint: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C5E8D8',
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
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
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  unitTag: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    marginTop: 4,
  },
  calculatedStockText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  priceScopeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  scopeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  scopeChipActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  scopeChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  scopeChipTextActive: {
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  resetPriceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  resetPriceText: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
});
