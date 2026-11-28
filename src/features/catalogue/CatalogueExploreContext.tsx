import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CatalogueBrandSummaryDto,
  CatalogueSummaryResponse,
  getCatalogueSummary,
  searchCatalogueBrands,
  searchCatalogueOfflineFallback,
} from '../../api/catalogue';
import { OFFLINE_FALLBACK_CATALOGUE_BRANDS } from './catalogue-helpers';

export type ExploreDosageFilter = 'all' | 'tablet' | 'capsule' | 'syrup' | 'injection';

export interface ExploreFilterState {
  query: string;
  formFilter: ExploreDosageFilter;
  manufacturerFilter: string | null;
}

export const EXPLORE_SEARCH_STALE_MS = 2 * 60 * 1000;

export function buildExploreFilterKey(state: ExploreFilterState): string {
  return `${state.query.trim().toLowerCase()}|${state.formFilter}|${(state.manufacturerFilter ?? '').trim().toLowerCase()}`;
}

export type ExploreCacheDecision = 'skip' | 'background_refresh' | 'fetch';

/**
 * Pure decision helper determining whether an Explore fetch is needed for `currentKey`.
 * Ensures valid cached results (including empty result sets) and in-flight searches
 * are reused cleanly on back navigation until stale.
 */
export function shouldFetchExploreResults(params: {
  currentKey: string;
  resolvedKey: string | null;
  resolvedAt: number | null;
  inFlightKey: string | null;
  now?: number;
  staleMs?: number;
  forceRefresh?: boolean;
}): ExploreCacheDecision {
  const {
    currentKey,
    resolvedKey,
    resolvedAt,
    inFlightKey,
    now = Date.now(),
    staleMs = EXPLORE_SEARCH_STALE_MS,
    forceRefresh = false,
  } = params;

  if (inFlightKey === currentKey && !forceRefresh) {
    return 'skip';
  }

  if (!forceRefresh && resolvedKey === currentKey && resolvedAt !== null) {
    return now - resolvedAt < staleMs ? 'skip' : 'background_refresh';
  }

  return 'fetch';
}

export interface CatalogueExploreContextValue {
  query: string;
  formFilter: ExploreDosageFilter;
  manufacturerFilter: string | null;
  summary: CatalogueSummaryResponse | null;
  items: CatalogueBrandSummaryDto[];
  totalCount: number;
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  offlineFallback: string | null;
  activeFilterKey: string;
  setQuery: (next: string) => void;
  setFormFilter: (next: ExploreDosageFilter) => void;
  setManufacturerFilter: (next: string | null) => void;
  resetFilters: () => void;
  loadMore: () => Promise<void>;
  refreshIfStale: () => void;
  refreshNow: () => Promise<void>;
  getScrollOffset: () => number;
  setScrollOffset: (y: number) => void;
}

const DEFAULT_EXPLORE_CONTEXT: CatalogueExploreContextValue = {
  query: '',
  formFilter: 'all',
  manufacturerFilter: null,
  summary: null,
  items: [],
  totalCount: 0,
  nextCursor: null,
  hasMore: false,
  loading: false,
  refreshing: false,
  loadingMore: false,
  offlineFallback: null,
  activeFilterKey: buildExploreFilterKey({
    query: '',
    formFilter: 'all',
    manufacturerFilter: null,
  }),
  setQuery: () => {},
  setFormFilter: () => {},
  setManufacturerFilter: () => {},
  resetFilters: () => {},
  loadMore: async () => {},
  refreshIfStale: () => {},
  refreshNow: async () => {},
  getScrollOffset: () => 0,
  setScrollOffset: () => {},
};

const CatalogueExploreContext = createContext<CatalogueExploreContextValue>(DEFAULT_EXPLORE_CONTEXT);

export function CatalogueExploreProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [query, setQueryState] = useState('');
  const [formFilter, setFormFilterState] = useState<ExploreDosageFilter>('all');
  const [manufacturerFilter, setManufacturerFilterState] = useState<string | null>(null);

  const [summary, setSummary] = useState<CatalogueSummaryResponse | null>(null);
  const [items, setItems] = useState<CatalogueBrandSummaryDto[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [offlineFallback, setOfflineFallback] = useState<string | null>(null);

  const activeRequestRef = useRef(0);
  const didInitialMountRef = useRef(false);
  const resolvedKeyRef = useRef<string | null>(null);
  const resolvedAtRef = useRef<number | null>(null);
  const inFlightKeyRef = useRef<string | null>(null);
  const pendingDebounceKeyRef = useRef<string | null>(null);
  const scrollOffsetRef = useRef(0);
  const itemsRef = useRef<CatalogueBrandSummaryDto[]>([]);

  const activeFilterKey = useMemo(
    () => buildExploreFilterKey({ query, formFilter, manufacturerFilter }),
    [query, formFilter, manufacturerFilter],
  );

  const filtersRef = useRef<ExploreFilterState>({
    query,
    formFilter,
    manufacturerFilter,
  });
  filtersRef.current = { query, formFilter, manufacturerFilter };

  const setQuery = useCallback(
    (next: string) => {
      if (next !== filtersRef.current.query) {
        scrollOffsetRef.current = 0;
      }
      setQueryState(next);
    },
    [],
  );

  const setFormFilter = useCallback(
    (next: ExploreDosageFilter) => {
      if (next !== filtersRef.current.formFilter) {
        scrollOffsetRef.current = 0;
      }
      setFormFilterState(next);
    },
    [],
  );

  const setManufacturerFilter = useCallback(
    (next: string | null) => {
      if (next !== filtersRef.current.manufacturerFilter) {
        scrollOffsetRef.current = 0;
      }
      setManufacturerFilterState(next);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    scrollOffsetRef.current = 0;
    setQueryState('');
    setFormFilterState('all');
    setManufacturerFilterState(null);
  }, []);

  const getScrollOffset = useCallback(() => scrollOffsetRef.current, []);
  const setScrollOffset = useCallback((y: number) => {
    scrollOffsetRef.current = Math.max(0, y);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await getCatalogueSummary();
      setSummary(data);
    } catch {
      // Summary falls back gracefully to default displayed counts
    }
  }, []);

  const runSearch = useCallback(
    async (opts: {
      reset: boolean;
      cursor?: string | null;
      forceRefresh?: boolean;
      backgroundRefresh?: boolean;
      filters?: ExploreFilterState;
    }) => {
      const activeFilters = opts.filters ?? filtersRef.current;
      const targetKey = buildExploreFilterKey(activeFilters);
      const reqId = ++activeRequestRef.current;
      inFlightKeyRef.current = targetKey;

      if (opts.reset) {
        const keepVisibleResults =
          opts.backgroundRefresh ||
          (resolvedKeyRef.current === targetKey && itemsRef.current.length > 0);
        if (keepVisibleResults) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await searchCatalogueBrands({
          q: activeFilters.query.trim() || undefined,
          form: activeFilters.formFilter !== 'all' ? activeFilters.formFilter : undefined,
          manufacturer: activeFilters.manufacturerFilter ?? undefined,
          cursor: opts.reset ? undefined : opts.cursor ?? undefined,
          limit: 15,
          forceRefresh: opts.forceRefresh,
        });

        if (reqId !== activeRequestRef.current) return;

        setOfflineFallback(null);
        setTotalCount(res.totalCount);
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
        const nextItems = opts.reset ? res.items : [...itemsRef.current, ...res.items];
        itemsRef.current = nextItems;
        setItems(nextItems);
        resolvedKeyRef.current = targetKey;
        resolvedAtRef.current = Date.now();
      } catch {
        if (reqId !== activeRequestRef.current) return;

        const sqliteRes = await searchCatalogueOfflineFallback({
          q: activeFilters.query.trim() || undefined,
          form: activeFilters.formFilter !== 'all' ? activeFilters.formFilter : undefined,
          manufacturer: activeFilters.manufacturerFilter ?? undefined,
          limit: 20,
        });

        if (reqId !== activeRequestRef.current) return;

        if (sqliteRes.source === 'sqlite' && sqliteRes.items.length > 0) {
          setOfflineFallback(
            `Showing offline cached catalogue (${sqliteRes.cachedBrandsCount} medicines saved).`,
          );
          itemsRef.current = sqliteRes.items;
          setItems(sqliteRes.items);
          setTotalCount(sqliteRes.totalCount);
          setHasMore(false);
          setNextCursor(null);
          resolvedKeyRef.current = targetKey;
          resolvedAtRef.current = Date.now();
          return;
        }

        const qLower = activeFilters.query.trim().toLowerCase();
        const filteredFallback = OFFLINE_FALLBACK_CATALOGUE_BRANDS.filter((b) => {
          if (
            activeFilters.formFilter !== 'all' &&
            !(b.dosageFormNorm ?? '').includes(activeFilters.formFilter)
          ) {
            return false;
          }
          if (
            activeFilters.manufacturerFilter &&
            !(b.manufacturer ?? '')
              .toLowerCase()
              .includes(activeFilters.manufacturerFilter.toLowerCase())
          ) {
            return false;
          }
          if (qLower.length > 0) {
            const hay = `${b.name} ${b.generic?.name ?? ''} ${b.strength ?? ''} ${b.manufacturer ?? ''}`.toLowerCase();
            return hay.includes(qLower);
          }
          return true;
        });

        setOfflineFallback('Showing offline sample records.');
        itemsRef.current = filteredFallback;
        setItems(filteredFallback);
        setTotalCount(filteredFallback.length);
        setHasMore(false);
        setNextCursor(null);
        resolvedKeyRef.current = targetKey;
        resolvedAtRef.current = Date.now();
      } finally {
        if (inFlightKeyRef.current === targetKey && reqId === activeRequestRef.current) {
          inFlightKeyRef.current = null;
        }
        if (reqId === activeRequestRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    const decision = shouldFetchExploreResults({
      currentKey: activeFilterKey,
      resolvedKey: resolvedKeyRef.current,
      resolvedAt: resolvedAtRef.current,
      inFlightKey: inFlightKeyRef.current,
    });

    if (decision === 'skip') {
      return;
    }

    const filtersSnapshot = { query, formFilter, manufacturerFilter };

    if (!didInitialMountRef.current) {
      didInitialMountRef.current = true;
      pendingDebounceKeyRef.current = null;
      void runSearch({
        reset: true,
        backgroundRefresh: decision === 'background_refresh',
        filters: filtersSnapshot,
      });
      return;
    }

    pendingDebounceKeyRef.current = activeFilterKey;
    const timer = setTimeout(() => {
      pendingDebounceKeyRef.current = null;
      void runSearch({
        reset: true,
        backgroundRefresh: decision === 'background_refresh',
        filters: filtersSnapshot,
      });
    }, 180);

    return () => {
      clearTimeout(timer);
      if (pendingDebounceKeyRef.current === activeFilterKey) {
        pendingDebounceKeyRef.current = null;
      }
    };
  }, [activeFilterKey, formFilter, manufacturerFilter, query, runSearch]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    await runSearch({ reset: false, cursor: nextCursor });
  }, [hasMore, loadingMore, nextCursor, runSearch]);

  const refreshIfStale = useCallback(() => {
    if (!didInitialMountRef.current || pendingDebounceKeyRef.current === activeFilterKey) {
      return;
    }
    const decision = shouldFetchExploreResults({
      currentKey: activeFilterKey,
      resolvedKey: resolvedKeyRef.current,
      resolvedAt: resolvedAtRef.current,
      inFlightKey: inFlightKeyRef.current,
    });
    if (decision === 'skip') {
      return;
    }
    void runSearch({
      reset: true,
      backgroundRefresh: decision === 'background_refresh',
    });
  }, [activeFilterKey, runSearch]);

  const refreshNow = useCallback(async () => {
    await runSearch({
      reset: true,
      forceRefresh: true,
      backgroundRefresh: itemsRef.current.length > 0,
    });
  }, [runSearch]);

  const value = useMemo<CatalogueExploreContextValue>(
    () => ({
      query,
      formFilter,
      manufacturerFilter,
      summary,
      items,
      totalCount,
      nextCursor,
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
      refreshNow,
      getScrollOffset,
      setScrollOffset,
    }),
    [
      activeFilterKey,
      formFilter,
      getScrollOffset,
      hasMore,
      items,
      loading,
      loadingMore,
      loadMore,
      manufacturerFilter,
      nextCursor,
      offlineFallback,
      query,
      refreshIfStale,
      refreshNow,
      refreshing,
      resetFilters,
      setFormFilter,
      setManufacturerFilter,
      setQuery,
      setScrollOffset,
      summary,
      totalCount,
    ],
  );

  return (
    <CatalogueExploreContext.Provider value={value}>
      {children}
    </CatalogueExploreContext.Provider>
  );
}

export function useCatalogueExplore(): CatalogueExploreContextValue {
  return useContext(CatalogueExploreContext);
}
