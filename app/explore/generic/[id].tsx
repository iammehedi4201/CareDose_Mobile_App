import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import exploreHeaderImage from '../../../assets/explore-header-illustration.jpg';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MedicineCard,
  ScreenContainer,
  SecondaryButton,
  useScreenWaveHeader,
} from '../../../src/components';
import {
  CatalogueBrandSummaryDto,
  getCatalogueGenericDetail,
  getOfflineCachedGenericDetail,
} from '../../../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../../../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS } from '../../../src/theme/tokens';

export default function GenericDetailsScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [genericName, setGenericName] = useState<string>('Generic Details');
  const [brands, setBrands] = useState<CatalogueBrandSummaryDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [warningNotice, setWarningNotice] = useState(
    'These records share the same generic name in the imported dataset. Products with a similar generic name are not automatically interchangeable. Always consult a qualified doctor or pharmacist before changing medicine brands.',
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadGeneric = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      if (!id) return;
      if (opts.reset) {
        setLoading(true);
        setErrorMessage(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await getCatalogueGenericDetail(id, {
          cursor: opts.reset ? undefined : opts.cursor ?? undefined,
          limit: 20,
        });
        setGenericName(res.generic.name);
        setWarningNotice(res.warningNotice);
        setTotalCount(res.brands.totalCount);
        setHasMore(res.brands.hasMore);
        setNextCursor(res.brands.nextCursor);
        setBrands((prev) => (opts.reset ? res.brands.items : [...prev, ...res.brands.items]));
      } catch (err) {
        if (opts.reset) {
          const sqliteGeneric = await getOfflineCachedGenericDetail(id);
          if (sqliteGeneric) {
            setGenericName(sqliteGeneric.generic.name);
            setWarningNotice(sqliteGeneric.warningNotice);
            setTotalCount(sqliteGeneric.brands.totalCount);
            setHasMore(false);
            setNextCursor(null);
            setBrands(sqliteGeneric.brands.items);
            return;
          }
        }

        const fallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.filter(
          (b) => b.generic?.sourceId === id || b.generic?.id === id,
        );
        if (fallback.length > 0 && opts.reset) {
          setGenericName(fallback[0].generic?.name ?? 'Aceclofenac');
          setBrands(fallback);
          setTotalCount(fallback.length);
          setHasMore(false);
          setNextCursor(null);
        } else {
          setErrorMessage(err instanceof Error ? err.message : 'Unable to load generic details.');
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadGeneric({ reset: true });
  }, [loadGeneric]);

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'GENERIC',
    title: loading || errorMessage ? 'Generic Details' : genericName,
    imageSource: exploreHeaderImage,
    onBack: () => {
      if (typeof router.canGoBack === 'function' && router.canGoBack()) {
        router.back();
      } else {
        router.push('/explore');
      }
    },
  });

  if (loading) {
    return (
      <ScreenContainer
        title="Generic Details"
        hideHeader
        topBanner={topBanner}
        topOverlay={topOverlay}
      >
        <View style={{ marginTop: -overlapPx }}>
          <LoadingSkeleton variant="generic_details" rows={4} />
        </View>
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer
        title="Generic Details"
        hideHeader
        topBanner={topBanner}
        topOverlay={topOverlay}
      >
        <View style={{ marginTop: -overlapPx }}>
          <ErrorState
            title="Could not load generic"
            message={errorMessage}
            onRetry={() => void loadGeneric({ reset: true })}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      title={genericName}
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      <View
        style={{ marginTop: -overlapPx }}
        className="flex-row items-center bg-mint rounded-card border border-[#C5E8D8] p-3.5 mb-4 shadow-sm"
      >
        <View className="w-[38px] h-[38px] rounded-full bg-white items-center justify-center mr-3 shrink-0">
          <Feather name="disc" size={18} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[15px] font-bold text-main">{genericName}</Text>
          <Text className="mt-0.5 text-[12px] text-[#5A706B]">
            {totalCount.toLocaleString()} brand records linked in the imported catalogue
          </Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2.5">
        <Text className="text-[15px] font-semibold text-main shrink min-w-0">
          Associated brands
        </Text>
        <Text className="text-[12px] text-[#5A706B] shrink-0">
          {totalCount.toLocaleString()} brands
        </Text>
      </View>

      {brands.length === 0 ? (
        <EmptyState
          title="No linked brands"
          description="No brands are currently linked to this generic in the imported dataset."
        />
      ) : (
        <>
          {brands.map((b) => {
            const badge = resolveBrandBadge(b);
            return (
              <MedicineCard
                key={b.id}
                name={b.name}
                genericName={genericName}
                strength={b.strength}
                dosageForm={b.dosageForm}
                manufacturer={b.manufacturer ?? 'Not available'}
                imageUrl={b.primaryImageUrl}
                stockText={formatUnitOrPackPrice(b.primaryPack)}
                priceText={formatPackSummary(b.primaryPack)}
                statusVariant={badge.variant}
                statusLabel={badge.label}
                showStatusBadge={badge.showBadge}
                onPress={() => router.push(`/explore/brand/${b.sourceId}`)}
              />
            );
          })}

          {hasMore && nextCursor ? (
            <View className="mt-1.5 mb-2.5">
              <SecondaryButton
                fullWidth
                label={loadingMore ? 'Loading more...' : 'Load more brands'}
                loading={loadingMore}
                onPress={() => void loadGeneric({ reset: false, cursor: nextCursor })}
              />
            </View>
          ) : null}
        </>
      )}

      <View className="bg-[#FDF5E6] rounded-field border border-[#F3D9A4] p-3 my-2.5">
        <Text className="text-[11px] text-warning font-semibold leading-4">
          {warningNotice}
        </Text>
      </View>
    </ScreenContainer>
  );
}
