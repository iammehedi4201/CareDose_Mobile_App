import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import exploreHeaderImage from '../assets/explore-header-illustration.jpg';
import {
  BottomSheet,
  EmptyState,
  FilterChips,
  LoadingSkeleton,
  MedicineCard,
  ScreenContainer,
  CatalogueSearchInput,
  SearchInput,
  SecondaryButton,
  useScreenWaveHeader,
} from '../src/components';
import {
  CatalogueGenericListItemDto,
  searchCatalogueGenerics,
} from '../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  resolveBrandBadge,
} from '../src/features/catalogue/catalogue-helpers';
import {
  ExploreDosageFilter,
  useCatalogueExplore,
} from '../src/features/catalogue/CatalogueExploreContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

const POPULAR_SEARCHES = [
  'Napa',
  'Seclo',
  'Aceclofenac',
  'Metformin',
  'Square',
];

const DOSAGE_FILTER_OPTIONS: Array<{ key: ExploreDosageFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'tablet', label: 'Tablet' },
  { key: 'capsule', label: 'Capsule' },
  { key: 'syrup', label: 'Syrup' },
  { key: 'injection', label: 'Injection' },
];

export default function ExploreMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const {
    query,
    formFilter,
    manufacturerFilter,
    summary,
    items,
    totalCount,
    hasMore,
    loading,
    refreshing,
    loadingMore,
    offlineFallback,
    activeFilterKey,
    setQuery,
    setFormFilter,
    setManufacturerFilter,
    resetFilters,
    loadMore,
    refreshIfStale,
    getScrollOffset,
    setScrollOffset,
  } = useCatalogueExplore();

  // Generic browser bottom sheet state
  const [genericSheetOpen, setGenericSheetOpen] = useState(false);
  const [genericQuery, setGenericQuery] = useState('');
  const [genericItems, setGenericItems] = useState<CatalogueGenericListItemDto[]>([]);
  const [genericsLoading, setGenericsLoading] = useState(false);

  // Sync only when cached results become stale on return (never drops valid cached results)
  useEffect(() => {
    refreshIfStale();
  }, [refreshIfStale]);

  useEffect(() => {
    if (!genericSheetOpen) return;
    let cancelled = false;
    setGenericsLoading(true);
    const timer = setTimeout(() => {
      searchCatalogueGenerics({ q: genericQuery.trim() || undefined, limit: 20 })
        .then((res) => {
          if (!cancelled) {
            setGenericItems(res.items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setGenericItems([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setGenericsLoading(false);
          }
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [genericSheetOpen, genericQuery]);

  const isFiltered =
    query.trim().length > 0 || formFilter !== 'all' || manufacturerFilter !== null;

  const genericsSubtitle = summary
    ? `${summary.counts.generics.toLocaleString()} generics`
    : '1,585 generics';

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'CATALOGUE',
    title: 'Explore Medicines',
    imageSource: exploreHeaderImage,
  });

  return (
    <ScreenContainer
      title="Explore Medicines"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
      initialScrollOffset={getScrollOffset()}
      onScrollOffsetChange={setScrollOffset}
      scrollResetKey={activeFilterKey}
    >
      {/* Prominent Search & Form Filter Card */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-3 rounded-card border border-border bg-white p-3 shadow-sm"
      >
        <CatalogueSearchInput
          value={query}
          onChangeText={setQuery}
          formFilter={formFilter}
          onSelectBrand={(brand) => router.push(`/explore/brand/${brand.sourceId}`)}
        />

        <View className="mt-2.5">
          <FilterChips
            compact
            options={DOSAGE_FILTER_OPTIONS}
            selectedKey={formFilter}
            onSelect={setFormFilter}
          />
        </View>
      </View>

      {manufacturerFilter ? (
        <View className="mb-3 flex-row items-center justify-between gap-2.5 rounded-field border border-[#C5E8D8] bg-mint px-3 py-2">
          <Text className="flex-1 min-w-0 text-[12px] font-semibold text-main" numberOfLines={1}>
            Company: {manufacturerFilter}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear manufacturer filter"
            onPress={() => setManufacturerFilter(null)}
            className="shrink-0 px-2 py-0.5"
          >
            <Text className="text-[12px] font-bold text-primary">Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {offlineFallback ? (
        <View className="mb-3 flex-row items-center gap-2 rounded-field border border-[#F3D9A4] bg-[#FDF5E6] px-3 py-2">
          <Feather name="wifi-off" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
          <Text className="flex-1 min-w-0 text-[11px] font-semibold text-warning">
            {offlineFallback}
          </Text>
        </View>
      ) : null}

      {!isFiltered ? (
        <View className="mb-3.5">
          <Text className="mb-2 text-[13.5px] font-bold text-main">Popular Searches</Text>
          <View className="mb-3 flex-row flex-wrap gap-1.5">
            {POPULAR_SEARCHES.map((term) => (
              <Pressable
                key={term}
                accessibilityRole="button"
                onPress={() => setQuery(term)}
                className="flex-row items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 active:bg-mint"
              >
                <Feather name="search" size={11} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text className="text-[12px] font-semibold text-main">{term}</Text>
              </Pressable>
            ))}
          </View>

          <View
            className={layout.stackTwoCol ? 'flex-col' : 'flex-row'}
            style={{ gap: layout.gridGap }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse Generics"
              onPress={() => setGenericSheetOpen(true)}
              className={`flex-row items-center rounded-card border border-border bg-white px-3 py-2.5 shadow-sm active:bg-mint ${
                layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'
              }`}
            >
              <View className="mr-2.5 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint">
                <Feather name="disc" size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[13px] font-bold text-main" numberOfLines={1}>
                  Browse Generics
                </Text>
                <Text className="text-[11px] text-[#5A706B]" numberOfLines={1}>
                  {genericsSubtitle}
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alternatives"
              onPress={() => router.push('/alternatives')}
              className={`flex-row items-center rounded-card border border-border bg-white px-3 py-2.5 shadow-sm active:bg-mint ${
                layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'
              }`}
            >
              <View className="mr-2.5 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mint">
                <Feather name="layers" size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-[13px] font-bold text-main" numberOfLines={1}>
                  Alternatives
                </Text>
                <Text className="text-[11px] text-[#5A706B]" numberOfLines={1}>
                  Compare generics
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Clean Results Header */}
      <View className="mb-2 flex-row items-center justify-between gap-2.5">
        <Text className="flex-1 min-w-0 text-[14.5px] font-bold text-main" numberOfLines={1}>
          {isFiltered
            ? `Results (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`
            : `All Medicines (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`}
        </Text>
        {isFiltered ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search and filters"
            className="shrink-0 px-1 py-0.5"
            onPress={resetFilters}
          >
            <Text className="text-[12px] font-semibold text-primary">Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <LoadingSkeleton variant="explore_results" rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No medicines found"
          description="Try clearing your search or switching dosage form filters."
          actionLabel={isFiltered ? 'Clear search' : undefined}
          onAction={isFiltered ? resetFilters : undefined}
        />
      ) : (
        <>
          {items.map((item) => {
            const badge = resolveBrandBadge(item);
            return (
              <MedicineCard
                key={item.id}
                name={item.name}
                genericName={item.generic?.name}
                strength={item.strength}
                dosageForm={item.dosageForm}
                manufacturer={item.manufacturer ?? 'Manufacturer: Not available'}
                imageUrl={item.primaryImageUrl}
                stockText={formatUnitOrPackPrice(item.primaryPack)}
                priceText={formatPackSummary(item.primaryPack)}
                statusVariant={badge.variant}
                statusLabel={badge.label}
                showStatusBadge={badge.showBadge}
                highlightVariants
                onPress={() => router.push(`/explore/brand/${item.sourceId}`)}
              />
            );
          })}

          {hasMore ? (
            <View className="mt-1.5 mb-3">
              <SecondaryButton
                fullWidth
                label={loadingMore ? 'Loading more...' : 'Load more medicines'}
                loading={loadingMore}
                onPress={() => void loadMore()}
              />
            </View>
          ) : null}
        </>
      )}

      {/* Searchable Generic Directory BottomSheet */}
      <BottomSheet
        visible={genericSheetOpen}
        title="Browse Generics"
        subtitle="Select an active ingredient to view matching brands"
        cancelLabel="Close"
        onClose={() => setGenericSheetOpen(false)}
      >
        <SearchInput
          value={genericQuery}
          onChangeText={setGenericQuery}
          placeholder="Search generic name (e.g. Paracetamol, Metformin)"
        />
        <View className="mt-3 gap-2">
          {genericsLoading ? (
            <LoadingSkeleton variant="generic_list" rows={4} />
          ) : genericItems.length === 0 ? (
            <EmptyState
              title="No generics loaded"
              description="Connect to the backend server to search all generics."
              actionLabel="Preview Aceclofenac"
              onAction={() => {
                setGenericSheetOpen(false);
                router.push('/explore/generic/3');
              }}
            />
          ) : (
            genericItems.map((g) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                onPress={() => {
                  setGenericSheetOpen(false);
                  router.push(`/explore/generic/${g.sourceId}`);
                }}
                className="flex-row items-center justify-between gap-2.5 rounded-field border border-border bg-background px-3 py-2.5 active:bg-mint"
              >
                <View className="flex-1 min-w-0">
                  <Text className="text-[14px] font-semibold text-main">{g.name}</Text>
                  <Text className="mt-0.5 text-[12px] text-[#5A706B]">
                    {g.brandsCount} brands
                  </Text>
                </View>
                <Feather
                  name="chevron-right"
                  size={16}
                  color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                />
              </Pressable>
            ))
          )}
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}
