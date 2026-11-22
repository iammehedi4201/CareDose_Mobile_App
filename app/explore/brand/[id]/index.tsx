import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheet,
  EmptyState,
  ErrorState,
  FormField,
  LoadingSkeleton,
  MedicineCard,
  MedicineFormThumbnail,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
  SuccessToast,
  validateRequiredFields,
} from '../../../../src/components';
import {
  AlternativeGroupWithCandidatesDto,
  CatalogueBrandDetailDto,
  getCatalogueBrandAlternatives,
  getCatalogueBrandDetail,
} from '../../../../src/api/catalogue';
import {
  formatCurrencyAmount,
  formatMissingCatalogueValue,
  formatPackSummary,
  formatPackWarningReason,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../../../../src/features/catalogue/catalogue-helpers';
import {
  inferStockUnit,
  parseNonNegativeNumberInput,
} from '../../../../src/features/medications/medication-helpers';
import { useMedications } from '../../../../src/features/medications/MedicationsContext';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../../../src/theme/tokens';

const INITIAL_ALTERNATIVES_LIMIT = 3;

export default function CatalogueBrandDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addMedication } = useMedications();

  const [brand, setBrand] = useState<CatalogueBrandDetailDto | null>(null);
  const [altGroups, setAltGroups] = useState<AlternativeGroupWithCandidatesDto[]>([]);
  const [warningNotice, setWarningNotice] = useState(
    'Potential matching brands only. Sharing the same generic, strength, and dosage form does not make brands automatically interchangeable. Always consult a qualified doctor or pharmacist before changing medicine brands.',
  );
  const [loading, setLoading] = useState(true);
  const [altLoading, setAltLoading] = useState(true);
  const [altError, setAltError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [personalInstructions, setPersonalInstructions] = useState('');
  const [startingStock, setStartingStock] = useState('10');
  const [threshold, setThreshold] = useState('5');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const loadAlternatives = useCallback(
    async (brandRef: string, forceRefresh = false) => {
      setAltLoading(true);
      setAltError(null);
      try {
        const altRes = await getCatalogueBrandAlternatives(brandRef, { forceRefresh });
        setAltGroups(altRes.groups);
        setWarningNotice(altRes.warningNotice);
      } catch (err) {
        setAltGroups([]);
        setAltError(
          err instanceof Error ? err.message : 'Unable to load matching brand candidates.',
        );
      } finally {
        setAltLoading(false);
      }
    },
    [],
  );

  const loadBrand = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      setLoading(true);
      setErrorMessage(null);

      // Start alternatives fetch independently so it never blocks Brand Details rendering
      void loadAlternatives(id, forceRefresh);

      try {
        const detailRes = await getCatalogueBrandDetail(id, { forceRefresh });
        setBrand(detailRes);
      } catch (err) {
        const fallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.find(
          (b) => b.sourceId === id || b.id === id,
        );
        if (fallback) {
          setBrand({
            ...fallback,
            productUrl: null,
            collectedAt: null,
            packs: fallback.primaryPack ? [fallback.primaryPack] : [],
            images: [],
            safetyNotice: 'Offline preview data. Start the CareDose backend to view live records.',
          });
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to load medicine details.');
        }
      } finally {
        setLoading(false);
      }
    },
    [id, loadAlternatives],
  );

  useEffect(() => {
    void loadBrand();
  }, [loadBrand]);

  const handleAddToMyMedicines = async (): Promise<void> => {
    const errs = validateRequiredFields(
      { personalInstructions, startingStock, threshold },
      {
        personalInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
        threshold: 'Low-stock threshold',
      },
    );
    const parsedStock = parseNonNegativeNumberInput(startingStock);
    if (parsedStock === null && !errs.startingStock) {
      errs.startingStock = 'Enter a valid non-negative number.';
    }
    const parsedThreshold = parseNonNegativeNumberInput(threshold);
    if (parsedThreshold === null && !errs.threshold) {
      errs.threshold = 'Enter a valid non-negative number.';
    }

    setErrors(errs);
    if (
      Object.keys(errs).length > 0 ||
      !brand ||
      parsedStock === null ||
      parsedThreshold === null
    ) {
      return;
    }

    const pack = brand.packs[0] ?? brand.primaryPack;
    const unitPriceText = pack?.unitPrice
      ? `৳${pack.unitPrice}/unit`
      : pack?.packPrice
        ? `৳${pack.packPrice}/pack`
        : 'Not listed';
    const referencePackText =
      pack?.packQuantity && pack?.packPrice
        ? `${pack.packQuantity} · ৳${pack.packPrice}`
        : null;

    await addMedication({
      catalogueBrandId: brand.sourceId,
      genericSourceId: brand.generic?.sourceId ?? null,
      name: brand.name,
      genericName: brand.generic?.name ?? null,
      strength: brand.strength,
      dosageForm: brand.dosageForm ?? 'Tablet',
      manufacturer: brand.manufacturer,
      personalInstructions: personalInstructions.trim(),
      startingStock: parsedStock,
      stockUnit: inferStockUnit(brand.dosageForm),
      lowStockThreshold: parsedThreshold,
      unitPriceText,
      referencePackText,
    });

    setAddOpen(false);
    setPersonalInstructions('');
    setErrors({});
    setToast(`${brand.name} added to My Medicines.`);
  };

  if (loading) {
    return (
      <ScreenContainer
        title="Medicine Details"
        subtitle="Loading catalogue record..."
        onBack={() => router.push('/explore')}
      >
        <LoadingSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (errorMessage || !brand) {
    return (
      <ScreenContainer
        title="Medicine Details"
        onBack={() => router.push('/explore')}
      >
        <ErrorState
          title="Could not load brand details"
          message={errorMessage ?? 'Brand record not found.'}
          onRetry={() => void loadBrand(true)}
        />
      </ScreenContainer>
    );
  }

  const primaryImage = brand.images[0] ?? null;
  const allCandidateBrands = altGroups.flatMap((g) => g.candidateBrands);
  const initialMatchingBrands = allCandidateBrands.slice(0, INITIAL_ALTERNATIVES_LIMIT);
  const remainingMatchingCount = Math.max(0, allCandidateBrands.length - INITIAL_ALTERNATIVES_LIMIT);
  const isCombination = altGroups.some((g) => g.isCombination);

  return (
    <ScreenContainer
      title={brand.name}
      subtitle={`${brand.strength ?? 'Strength: Not available'} · ${brand.dosageForm ?? 'Form: Not available'}`}
      onBack={() => router.push('/explore')}
    >
      <SuccessToast message={toast} />

      {/* Top Hero + Dosage Form Thumbnail / Packaging Photo + Primary CTA */}
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <MedicineFormThumbnail
            size="hero"
            dosageForm={brand.dosageForm}
            imageUrl={primaryImage?.imageUrl}
            accessibilityLabel={`${brand.name} ${brand.dosageForm ?? 'medicine'}`}
          />
          <View style={styles.heroTextCol}>
            <Text style={styles.heroName}>{brand.name}</Text>
            {brand.generic ? (
              <Text style={styles.heroGeneric} numberOfLines={1}>
                {brand.generic.name}
              </Text>
            ) : null}
            <Text style={styles.heroMeta}>{formatMissingCatalogueValue(brand.manufacturer)}</Text>
            <Text style={styles.sourceCaption}>
              MedEx reference data (unverified)
            </Text>
          </View>
        </View>

        {primaryImage ? (
          <Text style={styles.imageNotice}>
            Photo source: {primaryImage.sourceName} · Unverified match · Permission unrecorded
          </Text>
        ) : null}

        <View style={styles.heroActionWrap}>
          <PrimaryButton
            fullWidth
            label="+ Add to My Medicines"
            onPress={() => setAddOpen(true)}
          />
        </View>
      </View>

      {/* Catalogue Details */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Medicine details</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Generic</Text>
          {brand.generic ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
            >
              <Text style={styles.linkText}>{brand.generic.name}</Text>
            </Pressable>
          ) : (
            <Text style={styles.infoValue}>Not available</Text>
          )}
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Strength</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.strength)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Dosage form</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.dosageForm)}</Text>
        </View>
        <View style={[styles.infoRow, brand.releaseMarker ? null : styles.lastRow]}>
          <Text style={styles.infoLabel}>Manufacturer</Text>
          <Text style={styles.infoValue}>{formatMissingCatalogueValue(brand.manufacturer)}</Text>
        </View>
        {brand.releaseMarker ? (
          <View style={[styles.infoRow, styles.lastRow]}>
            <Text style={styles.infoLabel}>Release marker</Text>
            <Text style={styles.infoValue}>{brand.releaseMarker}</Text>
          </View>
        ) : null}
      </View>

      {/* Pack & Pricing Details */}
      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <View style={styles.packTitleCol}>
            <Text style={styles.sectionTitle}>Pack &amp; price ({brand.packs.length})</Text>
            <Text style={styles.packSourceHint}>MedEx reference price (unverified)</Text>
          </View>
          {brand.hasPriceWarning ? (
            <StatusBadge variant="low_stock" label="Price warning" />
          ) : null}
        </View>

        {brand.packs.length === 0 ? (
          <Text style={styles.supportingEmpty}>No pack pricing records available in catalogue.</Text>
        ) : (
          brand.packs.map((pack, idx) => (
            <View
              key={pack.id}
              style={[
                styles.packBlock,
                idx === brand.packs.length - 1 ? styles.lastPackBlock : null,
              ]}
            >
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Pack size</Text>
                <Text style={styles.infoValue}>{formatPackSummary(pack)}</Text>
              </View>
              <View
                style={[
                  styles.infoRow,
                  !pack.unitPrice && pack.warnings.length === 0 ? styles.lastRow : null,
                ]}
              >
                <Text style={styles.infoLabel}>Pack price</Text>
                <Text style={styles.infoValue}>
                  {formatCurrencyAmount(pack.packPrice, pack.currency)}
                </Text>
              </View>
              {pack.unitPrice ? (
                <View style={[styles.infoRow, pack.warnings.length === 0 ? styles.lastRow : null]}>
                  <Text style={styles.infoLabel}>Unit price</Text>
                  <Text style={styles.infoValue}>
                    {formatCurrencyAmount(pack.unitPrice, pack.currency)}
                  </Text>
                </View>
              ) : null}
              {pack.warnings.length > 0 ? (
                <View style={styles.packWarningRow}>
                  <Feather name="alert-triangle" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
                  <Text style={styles.packWarningText}>
                    {pack.warnings.map(formatPackWarningReason).join(' ')}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      {/* Potential Matching Brands — Initially 3 + "Load More" to Searchable Alternatives Screen */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.matchingTitleCol}>
          <Text style={styles.sectionTitle}>
            Potential matching brands{!altLoading ? ` (${allCandidateBrands.length})` : ''}
          </Text>
          <Text style={styles.matchingSubtitle}>
            Same generic, {brand.strength ?? 'strength'} · {brand.dosageForm ?? 'form'}
          </Text>
        </View>
        {allCandidateBrands.length > INITIAL_ALTERNATIVES_LIMIT ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/brand/${brand.sourceId}/alternatives`)}
          >
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        ) : brand.generic && brand.sameGenericBrandsCount ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
          >
            <Text style={styles.linkText}>All {brand.sameGenericBrandsCount} generic brands</Text>
          </Pressable>
        ) : null}
      </View>

      {altLoading ? (
        <LoadingSkeleton rows={2} />
      ) : altError ? (
        <ErrorState
          title="Unable to load matching brands"
          message={altError}
          onRetry={() => id && void loadAlternatives(id, true)}
        />
      ) : initialMatchingBrands.length === 0 ? (
        <EmptyState
          title="No matching brands listed"
          description="No other imported catalogue brands share this exact generic, strength, and dosage form."
        />
      ) : (
        <View style={styles.altGroupWrap}>
          {isCombination ? (
            <Text style={styles.comboNote}>
              Combination product · {brand.strength ?? 'Multiple ingredients'} · {brand.dosageForm}
            </Text>
          ) : null}
          {initialMatchingBrands.map((alt) => {
            const altBadge = resolveBrandBadge(alt);
            return (
              <MedicineCard
                key={alt.id}
                name={alt.name}
                genericName={alt.generic?.name}
                strength={alt.strength}
                dosageForm={alt.dosageForm}
                manufacturer={alt.manufacturer ?? 'Not available'}
                imageUrl={alt.primaryImageUrl}
                stockText={formatUnitOrPackPrice(alt.primaryPack)}
                priceText={formatPackSummary(alt.primaryPack)}
                statusVariant={altBadge.variant}
                statusLabel={altBadge.label}
                showStatusBadge={altBadge.showBadge}
                onPress={() => router.push(`/explore/brand/${alt.sourceId}`)}
              />
            );
          })}

          {remainingMatchingCount > 0 ? (
            <View style={styles.loadMoreAltWrap}>
              <SecondaryButton
                fullWidth
                label={`Load More (${remainingMatchingCount} remaining)`}
                onPress={() => router.push(`/explore/brand/${brand.sourceId}/alternatives`)}
              />
            </View>
          ) : null}
        </View>
      )}

      {brand.generic &&
      typeof brand.sameGenericBrandsCount === 'number' &&
      brand.sameGenericBrandsCount > allCandidateBrands.length + 1 ? (
        <View style={styles.viewGenericWrap}>
          <SecondaryButton
            fullWidth
            label={`View all ${brand.sameGenericBrandsCount.toLocaleString()} ${brand.generic.name} brands (all strengths & forms)`}
            onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
          />
        </View>
      ) : null}

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{warningNotice}</Text>
      </View>

      <BottomSheet
        visible={addOpen}
        title="Add to My Medicines"
        subtitle={`${brand.name} · ${brand.dosageForm ?? 'Medicine'}`}
        onClose={() => setAddOpen(false)}
        onSubmit={() => void handleAddToMyMedicines()}
        submitLabel="Add medicine"
      >
        <FormField
          label="Personal instructions"
          value={personalInstructions}
          onChangeText={setPersonalInstructions}
          placeholder="Enter as prescribed"
          required
          errorMessage={errors.personalInstructions}
          helperText="Does not auto-create a schedule."
        />
        <FormField
          label="Starting stock"
          value={startingStock}
          onChangeText={setStartingStock}
          keyboardType="numeric"
          required
          errorMessage={errors.startingStock}
        />
        <FormField
          label="Low-stock threshold"
          value={threshold}
          onChangeText={setThreshold}
          keyboardType="numeric"
          required
          errorMessage={errors.threshold}
        />
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTextCol: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  heroGeneric: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primaryDark,
  },
  heroMeta: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  sourceCaption: {
    marginTop: 4,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
  },
  imageNotice: {
    marginTop: 8,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  heroActionWrap: {
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  packTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  packSourceHint: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  matchingTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  matchingSubtitle: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 2,
  },
  supportingEmpty: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    paddingVertical: 6,
  },
  packBlock: {
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  lastPackBlock: {
    paddingBottom: 0,
    marginBottom: 0,
    borderBottomWidth: 0,
  },
  packWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  packWarningText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
    gap: 12,
  },
  lastRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 0,
    maxWidth: '46%',
  },
  infoValue: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    textAlign: 'right',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
  },
  altGroupWrap: {
    marginBottom: 4,
  },
  comboNote: {
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    marginBottom: 6,
  },
  loadMoreAltWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  viewGenericWrap: {
    marginTop: 4,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
    lineHeight: 16,
  },
});
