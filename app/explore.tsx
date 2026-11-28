import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  SearchInput,
  SecondaryButton,
  useScreenWaveHeader,
} from '../src/components';
import {
  CatalogueBrandSummaryDto,
  CatalogueGenericListItemDto,
  CatalogueSummaryResponse,
  getCatalogueSummary,
  searchCatalogueBrands,
  searchCatalogueGenerics,
  searchCatalogueOfflineFallback,
} from '../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../src/features/catalogue/catalogue-helpers';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

type DosageFilter = 'all' | 'tablet' | 'capsule' | 'syrup' | 'injection';

const POPULAR_SEARCHES = [
  'Napa',
  'Seclo',
  'Aceclofenac',
  'Metformin',
  'Square',
];

export default function ExploreMedicinesScreen(): React.JSX.Element {
  const router = useRouter();
  const layout = useResponsiveLayout();
  const [query, setQuery] = useState('');
  const [formFilter, setFormFilter] = useState<DosageFilter>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string | null>(null);

  const [summary, setSummary] = useState<CatalogueSummaryResponse | null>(null);
  const [items, setItems] = useState<CatalogueBrandSummaryDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [offlineFallback, setOfflineFallback] = useState<string | null>(null);

  // Generic browser bottom sheet state
  const [genericSheetOpen, setGenericSheetOpen] = useState(false);
  const [genericQuery, setGenericQuery] = useState('');
  const [genericItems, setGenericItems] = useState<CatalogueGenericListItemDto[]>([]);
  const [genericsLoading, setGenericsLoading] = useState(false);

  const activeRequestRef = useRef(0);
  const didInitialMountRef = useRef(false);
  const hasItemsRef = useRef(false);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getCatalogueSummary();
      setSummary(data);
    } catch {
      // Summary falls back gracefully to default displayed dataset figures
    }
  }, []);

  const fetchBrands = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      const reqId = ++activeRequestRef.current;
      if (opts.reset) {
        if (!hasItemsRef.current) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await searchCatalogueBrands({
          q: query.trim() || undefined,
          form: formFilter !== 'all' ? formFilter : undefined,
          manufacturer: manufacturerFilter ?? undefined,
          cursor: opts.reset ? undefined : opts.cursor ?? undefined,
          limit: 15,
        });

        if (reqId !== activeRequestRef.current) return;

        setOfflineFallback(null);
        setTotalCount(res.totalCount);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        hasItemsRef.current = opts.reset ? res.items.length > 0 : hasItemsRef.current || res.items.length > 0;
        setItems((prev) => (opts.reset ? res.items : [...prev, ...res.items]));
      } catch {
        if (reqId !== activeRequestRef.current) return;

        const sqliteRes = await searchCatalogueOfflineFallback({
          q: query.trim() || undefined,
          form: formFilter !== 'all' ? formFilter : undefined,
          manufacturer: manufacturerFilter ?? undefined,
          limit: 20,
        });

        if (sqliteRes.source === 'sqlite' && sqliteRes.items.length > 0) {
          setOfflineFallback(
            `Showing offline cached catalogue (${sqliteRes.cachedBrandsCount} medicines saved in SQLite). Start the backend server to search all records.`,
          );
          hasItemsRef.current = true;
          setItems(sqliteRes.items);
          setTotalCount(sqliteRes.totalCount);
          setHasMore(false);
          setNextCursor(null);
          return;
        }

        // Fall back to sample offline records with an explicit indicator
        const q = query.trim().toLowerCase();
        const filteredFallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.filter((b) => {
          if (formFilter !== 'all' && !(b.dosageFormNorm ?? '').includes(formFilter)) {
            return false;
          }
          if (manufacturerFilter && !(b.manufacturer ?? '').toLowerCase().includes(manufacturerFilter.toLowerCase())) {
            return false;
          }
          if (q.length > 0) {
            const hay = `${b.name} ${b.generic?.name ?? ''} ${b.strength ?? ''} ${b.manufacturer ?? ''}`.toLowerCase();
            return hay.includes(q);
          }
          return true;
        });

        setOfflineFallback(
          'Showing offline sample records. Start the backend server to search the full catalogue.',
        );
        hasItemsRef.current = filteredFallback.length > 0;
        setItems(filteredFallback);
        setTotalCount(filteredFallback.length);
        setHasMore(false);
        setNextCursor(null);
      } finally {
        if (reqId === activeRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [query, formFilter, manufacturerFilter],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!didInitialMountRef.current) {
      didInitialMountRef.current = true;
      void fetchBrands({ reset: true });
      return;
    }
    const timer = setTimeout(() => {
      void fetchBrands({ reset: true });
    }, 180);
    return () => clearTimeout(timer);
  }, [fetchBrands]);

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

  const hasMultipleVariantsInResults = useMemo(() => {
    if (!isFiltered || items.length < 2) return false;
    const seenFormsByBrand = new Map<string, Set<string>>();
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      const variant = `${item.dosageForm ?? ''}|${item.strength ?? ''}`;
      const set = seenFormsByBrand.get(key) ?? new Set<string>();
      set.add(variant);
      if (set.size > 1) return true;
      seenFormsByBrand.set(key, set);
    }
    return false;
  }, [isFiltered, items]);

  const genericsSubtitle = summary
    ? `${summary.counts.generics.toLocaleString()} generics`
    : '1,585 generics';

  const mfrSubtitle = summary
    ? `${summary.counts.manufacturers.toLocaleString()} companies`
    : 'Pharmaceutical companies';

  const handleResetFilters = (): void => {
    setQuery('');
    setFormFilter('all');
    setManufacturerFilter(null);
  };

  const categoryCardSizeClass = layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0';

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
    >
      {/* Floating Search & Dosage Form Filter Container */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-3.5 rounded-card border border-border bg-white p-3 shadow-sm"
      >
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search brand, generic, strength or manufacturer"
        />

        <View className="mt-2">
          <FilterChips
            options={[
              { key: 'all', label: 'All' },
              { key: 'tablet', label: 'Tablet' },
              { key: 'capsule', label: 'Capsule' },
              { key: 'syrup', label: 'Syrup' },
              { key: 'injection', label: 'Injection' },
            ]}
            selectedKey={formFilter}
            onSelect={setFormFilter}
          />
        </View>
      </View>

      {manufacturerFilter ? (
        <View className="flex-row items-center justify-between gap-2.5 bg-mint rounded-field border border-[#C5E8D8] px-3 py-2 mb-3">
          <Text className="flex-1 min-w-0 text-[12px] font-semibold text-main">
            Manufacturer filter: {manufacturerFilter}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setManufacturerFilter(null)}
            className="shrink-0 px-2 py-1"
          >
            <Text className="text-[12px] font-bold text-primary">Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {!isFiltered ? (
        <View
          className="flex-row items-center gap-2.5 rounded-card px-3.5 py-2.5 mb-3.5"
          style={{
            backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
            borderWidth: 1,
            borderColor: '#C5E8D8',
          }}
        >
          <View className="w-8 h-8 rounded-full bg-white items-center justify-center shrink-0">
            <Feather name="book-open" size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
          </View>
          <Text className="flex-1 min-w-0 text-[12px] font-medium text-main">
            Bangladesh Medicine Directory · Reference records (unverified)
          </Text>
        </View>
      ) : null}

      {offlineFallback ? (
        <View className="flex-row items-center gap-2 bg-[#FDF5E6] border border-[#F3D9A4] rounded-field px-3 py-2 mb-3.5">
          <Feather name="wifi-off" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
          <Text className="flex-1 min-w-0 text-[11px] font-semibold text-warning">
            {offlineFallback}
          </Text>
        </View>
      ) : null}

      {!isFiltered ? (
        <>
          {/* Popular Searches */}
          <Text className="text-[15px] font-bold text-main mb-2">Popular Searches</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {POPULAR_SEARCHES.map((term) => (
              <Pressable
                key={term}
                accessibilityRole="button"
                onPress={() => setQuery(term)}
                className="flex-row items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1.5 shadow-sm active:bg-mint"
              >
                <Feather name="search" size={11} color={CAREDOSE_EXTENDED_COLORS.primary} />
                <Text className="text-[12px] text-main font-semibold">{term}</Text>
              </Pressable>
            ))}
          </View>

          {/* Browse by Category */}
          <Text className="text-[15px] font-bold text-main mb-2">Browse by Category</Text>
          <View className="mb-4" style={{ gap: layout.gridGap }}>
            <View
              className={layout.stackTwoCol ? 'flex-col' : 'flex-row'}
              style={{ gap: layout.gridGap }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setGenericSheetOpen(true)}
                className={`flex-row items-center bg-white border border-border rounded-card p-3.5 shadow-sm active:bg-mint ${categoryCardSizeClass}`}
              >
                <View className="w-9 h-9 rounded-full bg-mint items-center justify-center mr-2.5 shrink-0">
                  <Feather name="disc" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-bold text-main">By Generic</Text>
                  <Text className="mt-[1px] text-[11px] text-[#5A706B]">{genericsSubtitle}</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => setManufacturerFilter('Square')}
                className={`flex-row items-center bg-white border border-border rounded-card p-3.5 shadow-sm active:bg-mint ${categoryCardSizeClass}`}
              >
                <View className="w-9 h-9 rounded-full bg-mint items-center justify-center mr-2.5 shrink-0">
                  <Feather name="briefcase" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-bold text-main">By Manufacturer</Text>
                  <Text className="mt-[1px] text-[11px] text-[#5A706B]">{mfrSubtitle}</Text>
                </View>
              </Pressable>
            </View>

            <View
              className={layout.stackTwoCol ? 'flex-col' : 'flex-row'}
              style={{ gap: layout.gridGap }}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setFormFilter('tablet')}
                className={`flex-row items-center bg-white border border-border rounded-card p-3.5 shadow-sm active:bg-mint ${categoryCardSizeClass}`}
              >
                <View className="w-9 h-9 rounded-full bg-mint items-center justify-center mr-2.5 shrink-0">
                  <Feather name="box" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-bold text-main">By Form</Text>
                  <Text className="mt-[1px] text-[11px] text-[#5A706B]">Tablet, Syrup &amp; more</Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/alternatives')}
                className={`flex-row items-center bg-white border border-border rounded-card p-3.5 shadow-sm active:bg-mint ${categoryCardSizeClass}`}
              >
                <View className="w-9 h-9 rounded-full bg-mint items-center justify-center mr-2.5 shrink-0">
                  <Feather name="layers" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-[13px] font-bold text-main">Alternatives</Text>
                  <Text className="mt-[1px] text-[11px] text-[#5A706B]">Compare matching brands</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}

      {/* Catalogue Results Header */}
      <View className="flex-row items-center justify-between flex-wrap gap-2.5 mb-2">
        <Text className="text-[15px] font-semibold text-main flex-1 min-w-0">
          {isFiltered
            ? `Results (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`
            : `Catalogue Directory (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`}
        </Text>
        {isFiltered ? (
          <Pressable
            accessibilityRole="button"
            className="shrink-0 py-0.5 pl-1"
            onPress={handleResetFilters}
          >
            <Text className="text-[12px] font-semibold text-primary">Reset</Text>
          </Pressable>
        ) : null}
      </View>

      {hasMultipleVariantsInResults ? (
        <View className="mb-2.5 flex-row items-start gap-2 rounded-field border border-[#C5E8D8] bg-mint px-3 py-2">
          <Feather name="info" size={14} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
          <Text className="flex-1 min-w-0 text-[11px] leading-4 text-primary-dark">
            Multiple forms or strengths found — check the strength and form badges below to match your prescription, or filter by form above.
          </Text>
        </View>
      ) : null}

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No medicines found"
          description="Try clearing your search or changing filters."
          actionLabel="Clear search"
          onAction={handleResetFilters}
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

          {hasMore && nextCursor ? (
            <View className="mt-1.5 mb-3">
              <SecondaryButton
                fullWidth
                label={loadingMore ? 'Loading more...' : 'Load more brands'}
                loading={loadingMore}
                onPress={() => void fetchBrands({ reset: false, cursor: nextCursor })}
              />
            </View>
          ) : null}
        </>
      )}

      {/* Searchable Generic Directory BottomSheet */}
      <BottomSheet
        visible={genericSheetOpen}
        title="Browse by Generic"
        subtitle="Select an active ingredient to view associated brands"
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
            <LoadingSkeleton rows={3} />
          ) : genericItems.length === 0 ? (
            <EmptyState
              title="No generics loaded"
              description="Connect to the backend server to search all 1,585 generics, or open Aceclofenac preview."
              actionLabel="Open Aceclofenac"
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
                className="flex-row items-center justify-between gap-2.5 bg-background border border-border rounded-field px-3 py-2.5"
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
