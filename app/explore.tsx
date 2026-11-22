import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  BottomSheet,
  EmptyState,
  FilterChips,
  LoadingSkeleton,
  MedicineCard,
  ScreenContainer,
  SearchInput,
  SecondaryButton,
} from '../src/components';
import {
  CatalogueBrandSummaryDto,
  CatalogueGenericListItemDto,
  CatalogueSummaryResponse,
  getCatalogueSummary,
  searchCatalogueBrands,
  searchCatalogueGenerics,
} from '../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../src/features/catalogue/catalogue-helpers';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

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
      } catch (err) {
        if (reqId !== activeRequestRef.current) return;

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

        const msg = err instanceof Error ? err.message : 'Unable to connect to CareDose server';
        setOfflineFallback(msg);
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

  const brandsCountLabel = summary
    ? `${summary.counts.brands.toLocaleString()} brands · ${summary.counts.generics.toLocaleString()} generics`
    : '19,590 brands · 1,585 generics';

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

  return (
    <ScreenContainer title="Explore Medicines">
      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search brand, generic, strength or manufacturer"
      />

      <View style={styles.filterWrap}>
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

      {manufacturerFilter ? (
        <View style={styles.activeMfrPillRow}>
          <Text style={styles.activeMfrText}>
            Manufacturer filter: {manufacturerFilter}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setManufacturerFilter(null)}
            style={styles.clearMfrBtn}
          >
            <Text style={styles.clearMfrText}>Clear</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Feature Info Banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoIconCircle}>
          <Feather name="book-open" size={18} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View style={styles.infoTextCol}>
          <Text style={styles.infoTitle}>Bangladesh Medicine Directory</Text>
          <Text style={styles.infoBody}>{brandsCountLabel} · Reference (unverified)</Text>
        </View>
        <View style={styles.infoBadge}>
          <Text style={styles.infoBadgeText}>i</Text>
        </View>
      </View>

      {offlineFallback ? (
        <View style={styles.offlineBanner}>
          <Feather name="wifi-off" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
          <Text style={styles.offlineBannerText}>
            Showing offline sample records. Start the backend server to search the full catalogue.
          </Text>
        </View>
      ) : null}

      {/* Popular Searches */}
      <Text style={styles.sectionHeading}>Popular Searches</Text>
      <View style={styles.popularChipsWrap}>
        {POPULAR_SEARCHES.map((term) => (
          <Pressable
            key={term}
            accessibilityRole="button"
            onPress={() => setQuery(term)}
            style={styles.popularChip}
          >
            <Text style={styles.popularChipText}>{term}</Text>
          </Pressable>
        ))}
      </View>

      {/* Browse by Category */}
      <Text style={styles.sectionHeading}>Browse by Category</Text>
      <View style={[styles.categoryGrid, { gap: layout.gridGap }]}>
        <View
          style={[
            layout.stackTwoCol ? styles.categoryRowStacked : styles.categoryRow,
            { gap: layout.gridGap },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setGenericSheetOpen(true)}
            style={[styles.categoryCard, layout.stackTwoCol ? styles.categoryCardFull : null]}
          >
            <View style={styles.catIconBox}>
              <Feather name="disc" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.categoryTitle}>By Generic</Text>
              <Text style={styles.categorySub}>{genericsSubtitle}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setManufacturerFilter('Square')}
            style={[styles.categoryCard, layout.stackTwoCol ? styles.categoryCardFull : null]}
          >
            <View style={styles.catIconBox}>
              <Feather name="briefcase" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.categoryTitle}>By Manufacturer</Text>
              <Text style={styles.categorySub}>{mfrSubtitle}</Text>
            </View>
          </Pressable>
        </View>

        <View
          style={[
            layout.stackTwoCol ? styles.categoryRowStacked : styles.categoryRow,
            { gap: layout.gridGap },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setFormFilter('tablet')}
            style={[styles.categoryCard, layout.stackTwoCol ? styles.categoryCardFull : null]}
          >
            <View style={styles.catIconBox}>
              <Feather name="box" size={16} color={CAREDOSE_EXTENDED_COLORS.primary} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.categoryTitle}>By Form</Text>
              <Text style={styles.categorySub}>Tablet, Syrup &amp; more</Text>
            </View>
          </Pressable>

          <View
            style={[
              styles.categoryCard,
              styles.categoryCardDisabled,
              layout.stackTwoCol ? styles.categoryCardFull : null,
            ]}
          >
            <View style={[styles.catIconBox, styles.catIconDisabled]}>
              <Feather name="lock" size={15} color={CAREDOSE_EXTENDED_COLORS.mutedText} />
            </View>
            <View style={styles.catTextCol}>
              <Text style={styles.categoryTitleDisabled}>By Condition</Text>
              <Text style={styles.categorySub}>Unavailable</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Catalogue Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {isFiltered
            ? `Results (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`
            : `Catalogue Directory (${totalCount.toLocaleString()})${refreshing ? ' · Updating...' : ''}`}
        </Text>
        {isFiltered ? (
          <Pressable
            accessibilityRole="button"
            style={styles.seeAllBtn}
            onPress={handleResetFilters}
          >
            <Text style={styles.seeAllText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

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
                onPress={() => router.push(`/explore/brand/${item.sourceId}`)}
              />
            );
          })}

          {hasMore && nextCursor ? (
            <View style={styles.loadMoreWrap}>
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
        <View style={styles.genericListWrap}>
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
                style={styles.genericRow}
              >
                <View style={styles.genericTextCol}>
                  <Text style={styles.genericName}>{g.name}</Text>
                  <Text style={styles.genericCount}>{g.brandsCount} brands</Text>
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

const styles = StyleSheet.create({
  filterWrap: {
    marginTop: 8,
    marginBottom: 12,
  },
  activeMfrPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  activeMfrText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  clearMfrBtn: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearMfrText: {
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 14,
    marginBottom: 14,
  },
  infoIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  infoTextCol: {
    flex: 1,
    minWidth: 0,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  infoBody: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  infoBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  infoBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    borderRadius: CAREDOSE_RADIUS.field,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  offlineBannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.warning,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    marginBottom: 8,
  },
  popularChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  popularChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  popularChipText: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    fontWeight: '500',
  },
  categoryGrid: {
    gap: 8,
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryRowStacked: {
    flexDirection: 'column',
    gap: 8,
  },
  categoryCard: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    borderRadius: CAREDOSE_RADIUS.field,
    padding: 12,
  },
  categoryCardFull: {
    flex: undefined,
    width: '100%',
  },
  categoryCardDisabled: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    opacity: 0.75,
  },
  catIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  catIconDisabled: {
    backgroundColor: '#E2E8E5',
  },
  catTextCol: {
    flex: 1,
    minWidth: 0,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  categoryTitleDisabled: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  categorySub: {
    marginTop: 1,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flex: 1,
    minWidth: 0,
  },
  seeAllBtn: {
    flexShrink: 0,
    paddingVertical: 2,
    paddingLeft: 4,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  loadMoreWrap: {
    marginTop: 6,
    marginBottom: 12,
  },
  genericListWrap: {
    marginTop: 12,
    gap: 8,
  },
  genericRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    borderRadius: CAREDOSE_RADIUS.field,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  genericTextCol: {
    flex: 1,
    minWidth: 0,
  },
  genericName: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  genericCount: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
