import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import exploreHeaderImage from '../../../../assets/explore-header-illustration.jpg';
import {
  AddMedicineModal,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MedicineCard,
  MedicineFormThumbnail,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
  SuccessToast,
  useScreenWaveHeader,
} from '../../../../src/components';
import {
  AlternativeGroupWithCandidatesDto,
  CatalogueBrandDetailDto,
  getCatalogueBrandAlternatives,
  getCatalogueBrandDetail,
  getOfflineCachedBrandDetail,
} from '../../../../src/api/catalogue';
import {
  formatCurrencyAmount,
  formatMissingCatalogueValue,
  formatPackSummary,
  formatPackWarningReason,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
  resolvePackQuantityUnit,
} from '../../../../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS } from '../../../../src/theme/tokens';

const INITIAL_ALTERNATIVES_LIMIT = 3;

export default function CatalogueBrandDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

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
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
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
        setSelectedPackId(detailRes.packs[0]?.id ?? null);
      } catch (err) {
        const cachedBrand = await getOfflineCachedBrandDetail(id);
        if (cachedBrand) {
          const isFullDetail = 'packs' in cachedBrand && Array.isArray(cachedBrand.packs);
          const detailObj: CatalogueBrandDetailDto = isFullDetail
            ? (cachedBrand as CatalogueBrandDetailDto)
            : {
                ...cachedBrand,
                productUrl: null,
                collectedAt: null,
                packs: cachedBrand.primaryPack ? [cachedBrand.primaryPack] : [],
                images: [],
                safetyNotice:
                  'Showing locally cached SQLite record. Connect to the backend server for live updates.',
              };
          setBrand(detailObj);
          setSelectedPackId(detailObj.packs[0]?.id ?? null);
          return;
        }

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
          setSelectedPackId(fallback.primaryPack?.id ?? null);
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

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    title: loading || !brand ? 'Medicine Details' : brand.name,
    subtitle: loading
      ? 'Loading catalogue record...'
      : brand
        ? `${brand.strength ?? 'Strength: Not available'} · ${brand.dosageForm ?? 'Form: Not available'}`
        : undefined,
    imageSource: exploreHeaderImage,
    onBack: () => router.push('/explore'),
  });

  if (loading) {
    return (
      <ScreenContainer
        title="Medicine Details"
        hideHeader
        topBanner={topBanner}
        topOverlay={topOverlay}
      >
        <View style={{ marginTop: -overlapPx }}>
          <LoadingSkeleton rows={4} />
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage || !brand) {
    return (
      <ScreenContainer
        title="Medicine Details"
        hideHeader
        topBanner={topBanner}
        topOverlay={topOverlay}
      >
        <View style={{ marginTop: -overlapPx }}>
          <ErrorState
            title="Could not load brand details"
            message={errorMessage ?? 'Brand record not found.'}
            onRetry={() => void loadBrand(true)}
          />
        </View>
      </ScreenContainer>
    );
  }

  const primaryImage = brand.images[0] ?? null;
  const allCandidateBrands = altGroups.flatMap((g) => g.candidateBrands);
  const initialMatchingBrands = allCandidateBrands.slice(0, INITIAL_ALTERNATIVES_LIMIT);
  const remainingMatchingCount = Math.max(0, allCandidateBrands.length - INITIAL_ALTERNATIVES_LIMIT);
  const isCombination = altGroups.some((g) => g.isCombination);
  const activePack =
    brand.packs.find((p) => p.id === selectedPackId) ?? brand.packs[0] ?? null;
  const activeUnitDetails = resolvePackQuantityUnit(
    activePack,
    brand.dosageForm,
    brand.packs,
    { includeStripsInPack: false },
  );
  const activePackUnitDetails = resolvePackQuantityUnit(
    activePack,
    brand.dosageForm,
    brand.packs,
    { includeStripsInPack: true },
  );

  return (
    <ScreenContainer
      title={brand.name}
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <SuccessToast message={toast} />

      {/* Top Hero + Dosage Form Thumbnail / Packaging Photo + Primary CTA */}
      <View
        style={{ marginTop: -overlapPx }}
        className="bg-mint rounded-card border border-[#C5E8D8] p-4 mb-3.5 shadow-sm"
      >
        <View className="flex-row items-center gap-3">
          <MedicineFormThumbnail
            size="hero"
            dosageForm={brand.dosageForm}
            imageUrl={primaryImage?.imageUrl}
            accessibilityLabel={`${brand.name} ${brand.dosageForm ?? 'medicine'}`}
          />
          <View className="flex-1 min-w-0">
            <Text className="text-[17px] font-bold text-main">{brand.name}</Text>
            {brand.generic ? (
              <Text className="mt-0.5 text-[13px] font-semibold text-primary-dark" numberOfLines={1}>
                {brand.generic.name}
              </Text>
            ) : null}
            <Text className="mt-0.5 text-[12px] text-[#5A706B]">
              {formatMissingCatalogueValue(brand.manufacturer)}
            </Text>
            <Text className="mt-1 text-[11px] text-[#7D928D]">
              MedEx reference data (unverified)
            </Text>
          </View>
        </View>

        {primaryImage ? (
          <Text className="mt-2 text-[11px] text-[#5A706B]">
            Photo source: {primaryImage.sourceName} · Unverified match · Permission unrecorded
          </Text>
        ) : null}

        <View className="mt-3.5">
          <PrimaryButton
            fullWidth
            label="+ Add to My Medicines"
            onPress={() => setAddOpen(true)}
          />
        </View>
      </View>

      {/* Catalogue Details */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <Text className="text-[15px] font-semibold text-main mb-0.5">Medicine details</Text>

        <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Generic</Text>
          {brand.generic ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
            >
              <Text className="text-[13px] font-semibold text-primary shrink-0">
                {brand.generic.name}
              </Text>
            </Pressable>
          ) : (
            <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
              Not available
            </Text>
          )}
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Strength</Text>
          <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
            {formatMissingCatalogueValue(brand.strength)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Dosage form</Text>
          <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
            {formatMissingCatalogueValue(brand.dosageForm)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
            {activeUnitDetails.label}
          </Text>
          <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
            {activeUnitDetails.value}
          </Text>
        </View>
        <View
          className={`flex-row items-center justify-between py-2 gap-3 ${
            brand.releaseMarker ? 'border-b border-border' : 'pb-0.5'
          }`}
        >
          <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Manufacturer</Text>
          <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
            {formatMissingCatalogueValue(brand.manufacturer)}
          </Text>
        </View>
        {brand.releaseMarker ? (
          <View className="flex-row items-center justify-between py-2 pb-0.5 gap-3">
            <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
              Release marker
            </Text>
            <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
              {brand.releaseMarker}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Pack & Pricing Details */}
      <View className="bg-white rounded-card border border-border p-4 mb-3.5 shadow-sm">
        <View className="flex-row items-center justify-between flex-wrap gap-2 mb-2">
          <View className="flex-1 min-w-0">
            <Text className="text-[15px] font-semibold text-main mb-0.5">
              Pack &amp; price{brand.packs.length > 1 ? ` (${brand.packs.length} options)` : ''}
            </Text>
            <Text className="text-[11px] text-[#7D928D]">MedEx reference price (unverified)</Text>
          </View>
          {brand.hasPriceWarning ? (
            <StatusBadge variant="low_stock" label="Price warning" />
          ) : null}
        </View>

        {!activePack ? (
          <Text className="text-[12px] text-[#5A706B] py-1.5">
            No pack pricing records available in catalogue.
          </Text>
        ) : (
          <View>
            {brand.packs.length > 1 ? (
              <View className="mt-1 mb-2.5">
                <Text className="text-[11px] font-semibold text-[#5A706B] mb-2">
                  Select a pack size to inspect:
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {brand.packs.map((pack) => {
                    const isSelected = pack.id === activePack.id;
                    const pricePreview = pack.packPrice
                      ? formatCurrencyAmount(pack.packPrice, pack.currency)
                      : pack.unitPrice
                        ? `${formatCurrencyAmount(pack.unitPrice, pack.currency)}/unit`
                        : 'Price N/A';
                    return (
                      <Pressable
                        key={pack.id}
                        accessibilityRole="button"
                        onPress={() => setSelectedPackId(pack.id)}
                        className={`px-3 py-2 rounded-[10px] border min-w-[104px] ${
                          isSelected
                            ? 'border-primary bg-[#EAF5F1]'
                            : 'border-[#CBD5E1] bg-[#F8FAFC]'
                        }`}
                      >
                        <Text
                          className={`text-[12px] font-semibold ${
                            isSelected ? 'text-primary-dark' : 'text-main'
                          }`}
                        >
                          {formatPackSummary(pack)}
                        </Text>
                        <Text
                          className={`mt-0.5 text-[11px] font-semibold ${
                            isSelected ? 'text-primary' : 'text-[#5A706B]'
                          }`}
                        >
                          {pricePreview}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View className="border-t border-border pt-1">
              <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
                <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">Pack size</Text>
                <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
                  {formatPackSummary(activePack)}
                </Text>
              </View>
              <View className="flex-row items-center justify-between py-2 border-b border-border gap-3">
                <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
                  {activePackUnitDetails.label}
                </Text>
                <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
                  {activePackUnitDetails.value}
                </Text>
              </View>
              <View
                className={`flex-row items-center justify-between py-2 gap-3 ${
                  !activePack.unitPrice && activePack.warnings.length === 0
                    ? 'pb-0.5'
                    : 'border-b border-border'
                }`}
              >
                <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
                  Pack price
                </Text>
                <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
                  {formatCurrencyAmount(activePack.packPrice, activePack.currency)}
                </Text>
              </View>
              {activePack.unitPrice ? (
                <View
                  className={`flex-row items-center justify-between py-2 gap-3 ${
                    activePack.warnings.length === 0 ? 'pb-0.5' : 'border-b border-border'
                  }`}
                >
                  <Text className="text-[12px] text-[#5A706B] shrink-0 max-w-[46%]">
                    Unit price
                  </Text>
                  <Text className="flex-1 min-w-0 text-[13px] font-semibold text-main text-right">
                    {formatCurrencyAmount(activePack.unitPrice, activePack.currency)}
                  </Text>
                </View>
              ) : null}
              {activePack.warnings.length > 0 ? (
                <View className="flex-row items-start gap-1.5 bg-[#FDF5E6] p-2 rounded-[8px] mt-1.5">
                  <Feather name="alert-triangle" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
                  <Text className="flex-1 min-w-0 text-[11px] text-warning font-semibold">
                    {activePack.warnings.map(formatPackWarningReason).join(' ')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>

      {/* Potential Matching Brands — Initially 3 + "Load More" to Searchable Alternatives Screen */}
      <View className="flex-row items-center justify-between gap-2.5 mb-2">
        <View className="flex-1 min-w-0">
          <Text className="text-[15px] font-semibold text-main mb-0.5">
            Potential matching brands{!altLoading ? ` (${allCandidateBrands.length})` : ''}
          </Text>
          <Text className="text-[11px] text-[#5A706B] mt-[1px]">
            Same generic, {brand.strength ?? 'strength'} · {brand.dosageForm ?? 'form'}
          </Text>
        </View>
        {allCandidateBrands.length > INITIAL_ALTERNATIVES_LIMIT ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/brand/${brand.sourceId}/alternatives`)}
          >
            <Text className="text-[13px] font-semibold text-primary shrink-0">See all</Text>
          </Pressable>
        ) : brand.generic && brand.sameGenericBrandsCount ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
          >
            <Text className="text-[13px] font-semibold text-primary shrink-0">
              All {brand.sameGenericBrandsCount} generic brands
            </Text>
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
        <View className="mb-1">
          {isCombination ? (
            <Text className="text-[11px] font-semibold text-[#5A706B] mb-1.5">
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
            <View className="mt-1 mb-2.5">
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
        <View className="mt-1 mb-2.5">
          <SecondaryButton
            fullWidth
            label={`View all ${brand.sameGenericBrandsCount.toLocaleString()} ${brand.generic.name} brands (all strengths & forms)`}
            onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
          />
        </View>
      ) : null}

      <View className="bg-[#FDF5E6] rounded-field border border-[#F3D9A4] p-3 mt-1 mb-2.5">
        <Text className="text-[11px] text-warning font-semibold leading-4">
          {warningNotice}
        </Text>
      </View>

      <AddMedicineModal
        visible={addOpen}
        initialBrand={brand}
        initialPackId={activePack?.id ?? null}
        onClose={() => setAddOpen(false)}
        onSaved={(created) => setToast(`${created.name} added to My Medicines.`)}
      />
    </ScreenContainer>
  );
}
