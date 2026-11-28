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
import { formatSimplifiedDosageForm } from '../../../../src/components/MedicineFormThumbnail';
import { useResponsiveLayout } from '../../../../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../../../../src/theme/tokens';

const INITIAL_ALTERNATIVES_LIMIT = 3;

export default function CatalogueBrandDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const layout = useResponsiveLayout();

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

  const handleBack = (): void => {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
    } else {
      router.push('/explore');
    }
  };

  const simplifiedForm = formatSimplifiedDosageForm(brand?.dosageForm);
  const headerSubtitle = brand
    ? [brand.strength?.trim(), simplifiedForm].filter(Boolean).join(' · ') || undefined
    : undefined;

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'BRAND DETAILS',
    title: loading || !brand ? 'Medicine Details' : brand.name,
    subtitle: headerSubtitle,
    imageSource: exploreHeaderImage,
    onBack: handleBack,
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
          <LoadingSkeleton variant="brand_details" />
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
  const combinedSafetyNotice =
    brand.safetyNotice && brand.safetyNotice !== warningNotice
      ? `${brand.safetyNotice} ${warningNotice}`
      : warningNotice;
  const hasMoreGenericBrands =
    Boolean(brand.generic) &&
    typeof brand.sameGenericBrandsCount === 'number' &&
    brand.sameGenericBrandsCount > allCandidateBrands.length + 1;

  return (
    <ScreenContainer
      title={brand.name}
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <SuccessToast message={toast} />

      {/* Unified Primary Identity & Action Card */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-3 rounded-card border border-[#CBE7DB] bg-white p-4 shadow-sm"
      >
        <View className="flex-row items-start gap-3">
          <MedicineFormThumbnail
            size="hero"
            dosageForm={brand.dosageForm}
            imageUrl={primaryImage?.imageUrl}
            accessibilityLabel={`${brand.name} ${brand.dosageForm ?? 'medicine'}`}
          />
          <View className="flex-1 min-w-0">
            <Text className="text-[18px] font-bold leading-6 text-main">{brand.name}</Text>

            {brand.generic ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View all ${brand.generic.name} brands`}
                onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
                className="mt-1 flex-row items-center self-start active:opacity-80"
              >
                <Text className="text-[13px] font-semibold text-primary" numberOfLines={1}>
                  {brand.generic.name}
                </Text>
                <Feather name="chevron-right" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
              </Pressable>
            ) : (
              <Text className="mt-1 text-[12.5px] text-[#5A706B]">Generic: Not available</Text>
            )}

            <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
              <View className="rounded-full border border-[#CBE7DB] bg-mint px-2.5 py-0.5">
                <Text className="text-[11px] font-bold text-primary-dark">
                  {formatMissingCatalogueValue(brand.strength)}
                </Text>
              </View>
              {brand.releaseMarker ? (
                <View className="rounded-full border border-[#CFE0F5] bg-[#F4F8FD] px-2.5 py-0.5">
                  <Text className="text-[11px] font-semibold text-info">
                    {brand.releaseMarker}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View className="mt-3 border-t border-border pt-2.5 gap-1.5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[12px] text-[#5A706B] shrink-0">Manufacturer</Text>
            <Text className="flex-1 min-w-0 text-right text-[12.5px] font-semibold text-main" numberOfLines={1}>
              {formatMissingCatalogueValue(brand.manufacturer)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[12px] text-[#5A706B] shrink-0">{activeUnitDetails.label}</Text>
            <Text className="flex-1 min-w-0 text-right text-[12.5px] font-semibold text-main" numberOfLines={1}>
              {activeUnitDetails.value}
            </Text>
          </View>
          {primaryImage ? (
            <View className="flex-row items-center justify-between gap-3">
              <Text className="text-[11px] text-[#7D928D] shrink-0">Photo attribution</Text>
              <Text className="flex-1 min-w-0 text-right text-[11px] text-[#5A706B]" numberOfLines={1}>
                {primaryImage.sourceName} (unverified match)
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-3.5">
          <PrimaryButton
            fullWidth
            label="+ Add to My Medicines"
            onPress={() => setAddOpen(true)}
          />
        </View>
      </View>

      {/* Pack & Pricing Options Card */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4 shadow-sm">
        <View className="mb-2 flex-row items-center justify-between flex-wrap gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-[15px] font-bold text-main">Pack &amp; Pricing</Text>
            {brand.packs.length > 1 ? (
              <View className="rounded-full border border-[#CBE7DB] bg-mint px-2 py-0.5">
                <Text className="text-[10.5px] font-bold text-primary-dark">
                  {brand.packs.length} options
                </Text>
              </View>
            ) : null}
          </View>
          {brand.hasPriceWarning ? (
            <StatusBadge variant="low_stock" label="Price warning" />
          ) : null}
        </View>

        {!activePack ? (
          <Text className="py-1 text-[12.5px] text-[#5A706B]">
            No pack pricing records available in catalogue.
          </Text>
        ) : (
          <View>
            {brand.packs.length > 1 ? (
              <View className="mb-3 flex-row flex-wrap gap-2">
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
                      className={`min-w-[104px] rounded-[10px] border px-3 py-2 ${
                        isSelected
                          ? 'border-primary bg-mint'
                          : 'border-border bg-background'
                      }`}
                    >
                      <Text
                        className={`text-[12px] font-bold ${
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
            ) : null}

            <View className="rounded-field border border-border bg-background p-3">
              <View
                className={layout.stackTwoCol ? 'flex-col' : 'flex-row items-center justify-between'}
                style={{ gap: 10 }}
              >
                <View className="flex-1 min-w-0">
                  <Text className="text-[11px] text-[#5A706B]">Pack price</Text>
                  <Text className="mt-0.5 text-[16px] font-bold text-primary">
                    {formatCurrencyAmount(activePack.packPrice, activePack.currency)}
                  </Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[11px] text-[#5A706B]">Unit price</Text>
                  <Text className="mt-0.5 text-[14px] font-bold text-main">
                    {activePack.unitPrice
                      ? formatCurrencyAmount(activePack.unitPrice, activePack.currency)
                      : 'Not listed'}
                  </Text>
                </View>
              </View>

              <View className="mt-2.5 border-t border-border pt-2 gap-1.5">
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-[12px] text-[#5A706B] shrink-0">Pack size</Text>
                  <Text className="flex-1 min-w-0 text-right text-[12.5px] font-semibold text-main">
                    {formatPackSummary(activePack)}
                  </Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="text-[12px] text-[#5A706B] shrink-0">
                    {activePackUnitDetails.label}
                  </Text>
                  <Text className="flex-1 min-w-0 text-right text-[12.5px] font-semibold text-main">
                    {activePackUnitDetails.value}
                  </Text>
                </View>
              </View>
            </View>

            <Text className="mt-2 text-[11px] text-[#7D928D]">
              MedEx reference pricing (unverified)
            </Text>

            {activePack.warnings.length > 0 ? (
              <View className="mt-2 flex-row items-start gap-1.5 rounded-[8px] border border-[#F3D9A4] bg-[#FDF5E6] p-2.5">
                <Feather name="alert-triangle" size={13} color={CAREDOSE_EXTENDED_COLORS.warning} />
                <Text className="flex-1 min-w-0 text-[11px] font-semibold text-warning">
                  {activePack.warnings.map(formatPackWarningReason).join(' ')}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {/* Alternative Brands Section */}
      <View className="mb-2 flex-row items-center justify-between gap-2.5">
        <Text className="flex-1 min-w-0 text-[15px] font-bold text-main">
          Alternative Brands{!altLoading ? ` (${allCandidateBrands.length})` : ''}
        </Text>
        {allCandidateBrands.length > INITIAL_ALTERNATIVES_LIMIT ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/brand/${brand.sourceId}/alternatives`)}
          >
            <Text className="shrink-0 text-[13px] font-semibold text-primary">See all</Text>
          </Pressable>
        ) : hasMoreGenericBrands && brand.generic ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
          >
            <Text className="shrink-0 text-[12.5px] font-semibold text-primary">
              All {brand.generic.name} brands
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isCombination ? (
        <View className="mb-2 flex-row items-center gap-1.5 rounded-field border border-[#CBE7DB] bg-mint px-3 py-1.5">
          <Feather name="alert-circle" size={13} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
          <Text className="flex-1 min-w-0 text-[11.5px] font-semibold text-primary-dark">
            Combination product — verify every active ingredient carefully.
          </Text>
        </View>
      ) : null}

      {altLoading ? (
        <LoadingSkeleton variant="explore_results" rows={2} />
      ) : altError ? (
        <ErrorState
          title="Unable to load matching brands"
          message={altError}
          onRetry={() => id && void loadAlternatives(id, true)}
        />
      ) : initialMatchingBrands.length === 0 ? (
        <EmptyState
          title="No exact matching brands"
          description="No other imported brands share this exact generic, strength, and dosage form."
          actionLabel={
            hasMoreGenericBrands && brand.generic
              ? `View all ${brand.sameGenericBrandsCount} ${brand.generic.name} brands`
              : undefined
          }
          onAction={
            hasMoreGenericBrands && brand.generic
              ? () => router.push(`/explore/generic/${brand.generic?.sourceId}`)
              : undefined
          }
        />
      ) : (
        <View className="mb-1">
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
                highlightVariants
                onPress={() => router.push(`/explore/brand/${alt.sourceId}`)}
              />
            );
          })}

          {remainingMatchingCount > 0 ? (
            <View className="mt-1 mb-2.5">
              <SecondaryButton
                fullWidth
                label={`View all ${allCandidateBrands.length} matching brands`}
                onPress={() => router.push(`/explore/brand/${brand.sourceId}/alternatives`)}
              />
            </View>
          ) : hasMoreGenericBrands && brand.generic ? (
            <View className="mt-1 mb-2.5">
              <SecondaryButton
                fullWidth
                label={`View all ${brand.sameGenericBrandsCount?.toLocaleString()} ${brand.generic.name} brands`}
                onPress={() => router.push(`/explore/generic/${brand.generic?.sourceId}`)}
              />
            </View>
          ) : null}
        </View>
      )}

      {/* Safety & Interchangeability Notice (preserved verbatim for clinical safety) */}
      <View className="mt-1 mb-2.5 flex-row items-start gap-2 rounded-field border border-[#F3D9A4] bg-[#FDF5E6] p-3">
        <Feather name="alert-triangle" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
        <Text className="flex-1 min-w-0 text-[11px] font-semibold leading-4 text-warning">
          {combinedSafetyNotice}
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
