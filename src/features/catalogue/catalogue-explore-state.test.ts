import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CatalogueBrandSummaryDto,
  CatalogueSummaryResponse,
  PaginatedCatalogueResponse,
} from '../../api/catalogue';

type FiberState = {
  hooks: unknown[];
  cleanups: Map<number, (() => void) | undefined>;
  effectDeps: Map<number, unknown[] | undefined>;
};

const harness = vi.hoisted(() => {
  const fiberMap = new Map<string, FiberState>();
  const pendingEffects: Array<{ fiberId: string; idx: number; fn: () => void | (() => void) }> = [];
  const contextValues = new Map<symbol, unknown>();

  const getFiber = (id: string): FiberState => {
    let f = fiberMap.get(id);
    if (!f) {
      f = { hooks: [], cleanups: new Map(), effectDeps: new Map() };
      fiberMap.set(id, f);
    }
    return f;
  };

  return {
    fiberMap,
    pendingEffects,
    contextValues,
    currentFiberId: 'root',
    hookIndex: 0,
    getFiber,
    unmountFiber(id: string): void {
      const f = fiberMap.get(id);
      if (!f) return;
      for (const cleanup of f.cleanups.values()) {
        cleanup?.();
      }
      fiberMap.delete(id);
    },
    mockSearchCatalogueBrands: vi.fn<
      (params: {
        q?: string;
        form?: string;
        manufacturer?: string;
        cursor?: string;
        limit?: number;
        forceRefresh?: boolean;
      }) => Promise<PaginatedCatalogueResponse<CatalogueBrandSummaryDto>>
    >(),
    mockGetCatalogueSummary: vi.fn<() => Promise<CatalogueSummaryResponse>>(),
    mockSearchOfflineFallback: vi.fn(async () => ({
      items: [],
      totalCount: 0,
      cachedBrandsCount: 0,
      source: 'none' as const,
    })),
  };
});

vi.mock('react', () => {
  const ReactMock = {
    createContext<T>(defaultValue: T) {
      const token = Symbol('ctx');
      harness.contextValues.set(token, defaultValue);
      return {
        _token: token,
        _currentValue: defaultValue,
        Provider: ({ value, children }: { value: T; children: React.ReactNode }) => {
          harness.contextValues.set(token, value);
          return children;
        },
      };
    },
    useContext<T>(ctx: { _token: symbol; _currentValue: T }): T {
      return harness.contextValues.has(ctx._token)
        ? (harness.contextValues.get(ctx._token) as T)
        : ctx._currentValue;
    },
    useState<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
      const fiber = harness.getFiber(harness.currentFiberId);
      const idx = harness.hookIndex++;
      if (!(idx in fiber.hooks)) {
        fiber.hooks[idx] =
          typeof initial === 'function' ? (initial as () => T)() : initial;
      }
      const setState = (next: T | ((prev: T) => T)) => {
        const cur = fiber.hooks[idx] as T;
        fiber.hooks[idx] =
          typeof next === 'function' ? (next as (prev: T) => T)(cur) : next;
      };
      return [fiber.hooks[idx] as T, setState];
    },
    useRef<T>(initial: T): { current: T } {
      const fiber = harness.getFiber(harness.currentFiberId);
      const idx = harness.hookIndex++;
      if (!(idx in fiber.hooks)) {
        fiber.hooks[idx] = { current: initial };
      }
      return fiber.hooks[idx] as { current: T };
    },
    useCallback<T>(fn: T): T {
      return fn;
    },
    useMemo<T>(fn: () => T): T {
      return fn();
    },
    useEffect(fn: () => void | (() => void), deps?: unknown[]): void {
      const fiber = harness.getFiber(harness.currentFiberId);
      const idx = harness.hookIndex++;
      const prevDeps = fiber.effectDeps.get(idx);
      const changed =
        !deps ||
        !prevDeps ||
        deps.length !== prevDeps.length ||
        deps.some((d, i) => !Object.is(d, prevDeps[i]));
      if (changed) {
        fiber.effectDeps.set(idx, deps ? [...deps] : undefined);
        harness.pendingEffects.push({ fiberId: harness.currentFiberId, idx, fn });
      }
    },
    isValidElement: (v: unknown): boolean =>
      Boolean(v && typeof v === 'object' && 'type' in (v as Record<string, unknown>)),
    createElement: (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => ({
      type,
      props: { ...(props ?? {}), children: children.length === 1 ? children[0] : children },
    }),
  };
  return {
    ...ReactMock,
    default: ReactMock,
  };
});

vi.mock('../../api/catalogue', () => ({
  getCatalogueSummary: () => harness.mockGetCatalogueSummary(),
  searchCatalogueBrands: (params: {
    q?: string;
    form?: string;
    manufacturer?: string;
    cursor?: string;
    limit?: number;
    forceRefresh?: boolean;
  }) => harness.mockSearchCatalogueBrands(params),
  searchCatalogueOfflineFallback: () => harness.mockSearchOfflineFallback(),
}));

import {
  buildExploreFilterKey,
  CatalogueExploreProvider,
  EXPLORE_SEARCH_STALE_MS,
  shouldFetchExploreResults,
  useCatalogueExplore,
} from './CatalogueExploreContext';

function makeBrand(sourceId: string, name: string, genericName: string): CatalogueBrandSummaryDto {
  return {
    id: `brand-${sourceId}`,
    sourceId,
    name,
    strength: '500 mg',
    strengthNorm: '500mg',
    dosageForm: 'Tablet',
    dosageFormNorm: 'tablet',
    manufacturer: 'Beximco Pharmaceuticals Ltd.',
    category: 'allopathic',
    releaseMarker: null,
    verification: 'UNVERIFIED',
    fieldStatus: {
      generic: 'PRESENT',
      strength: 'PRESENT',
      dosageForm: 'PRESENT',
      manufacturer: 'PRESENT',
      price: 'PRESENT',
    },
    warnings: [],
    hasPriceWarning: false,
    generic: { id: 'gen-1', sourceId: '1', name: genericName, slug: genericName.toLowerCase() },
    primaryPack: null,
    primaryImageUrl: null,
    primaryImageStatus: null,
  };
}

function flushEffects(): void {
  while (harness.pendingEffects.length > 0) {
    const next = harness.pendingEffects.shift()!;
    const f = harness.getFiber(next.fiberId);
    f.cleanups.get(next.idx)?.();
    const cleanup = next.fn();
    f.cleanups.set(next.idx, typeof cleanup === 'function' ? cleanup : undefined);
  }
}

function renderWithProvider<T>(useScreenHook: () => T, showChild = true): T | null {
  harness.currentFiberId = 'provider';
  harness.hookIndex = 0;
  const el = CatalogueExploreProvider({ children: null }) as unknown as {
    type?: (props: Record<string, unknown>) => unknown;
    props?: Record<string, unknown>;
  };
  if (el && typeof el.type === 'function' && el.props) {
    el.type(el.props);
  }

  let childResult: T | null = null;
  if (showChild) {
    harness.currentFiberId = 'explore-screen';
    harness.hookIndex = 0;
    childResult = useScreenHook();
  } else {
    harness.unmountFiber('explore-screen');
  }
  flushEffects();
  return childResult;
}

describe('Explore Search State Persistence & Caching Architecture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    harness.fiberMap.clear();
    harness.contextValues.clear();
    harness.pendingEffects.length = 0;
    harness.mockSearchCatalogueBrands.mockReset();
    harness.mockGetCatalogueSummary.mockReset();
    harness.mockSearchOfflineFallback.mockClear();

    harness.mockGetCatalogueSummary.mockResolvedValue({
      sourceName: 'MedEx',
      schemaVersion: '1',
      generatedAt: null,
      importedAt: null,
      verificationNotice: '',
      counts: {
        generics: 1585,
        brands: 19590,
        packs: 24000,
        alternativeGroups: 1200,
        manufacturers: 200,
        brandsWithImages: 50,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes normalized filter keys and pure cache reuse decisions accurately', () => {
    expect(buildExploreFilterKey({ query: '  Napa ', formFilter: 'tablet', manufacturerFilter: 'Square' })).toBe(
      'napa|tablet|square',
    );

    const now = 1_000_000;
    expect(
      shouldFetchExploreResults({
        currentKey: 'napa|all|',
        resolvedKey: 'napa|all|',
        resolvedAt: now - 30_000,
        inFlightKey: null,
        now,
      }),
    ).toBe('skip');

    expect(
      shouldFetchExploreResults({
        currentKey: 'seclo|all|',
        resolvedKey: 'napa|all|',
        resolvedAt: now - 30_000,
        inFlightKey: 'seclo|all|',
        now,
      }),
    ).toBe('skip');

    expect(
      shouldFetchExploreResults({
        currentKey: 'napa|all|',
        resolvedKey: 'napa|all|',
        resolvedAt: now - EXPLORE_SEARCH_STALE_MS - 1,
        inFlightKey: null,
        now,
      }),
    ).toBe('background_refresh');

    expect(
      shouldFetchExploreResults({
        currentKey: 'monas|all|',
        resolvedKey: 'napa|all|',
        resolvedAt: now - 10_000,
        inFlightKey: null,
        now,
      }),
    ).toBe('fetch');
  });

  it('preserves search query, results, filters, scroll offset, empty states, and in-flight requests across unmount/remount', async () => {
    const initialList = [makeBrand('1', 'Ace', 'Paracetamol')];
    const napaList = [
      makeBrand('101', 'Napa', 'Paracetamol'),
      makeBrand('102', 'Napa Extra', 'Paracetamol + Caffeine'),
    ];
    const secloList = [makeBrand('201', 'Seclo', 'Omeprazole')];

    harness.mockSearchCatalogueBrands.mockImplementation(async (params) => {
      if (params.q === 'Napa') {
        return { items: napaList, totalCount: 2, limit: 15, hasMore: false, nextCursor: null };
      }
      if (params.q === 'Seclo') {
        return { items: secloList, totalCount: 1, limit: 15, hasMore: false, nextCursor: null };
      }
      if (params.q === 'NoSuchMedicine') {
        return { items: [], totalCount: 0, limit: 15, hasMore: false, nextCursor: null };
      }
      return { items: initialList, totalCount: 1, limit: 15, hasMore: false, nextCursor: null };
    });

    const useExploreView = () => useCatalogueExplore();

    // 1. Initial mount loads baseline results
    let state = renderWithProvider(useExploreView, true)!;
    await vi.runAllTimersAsync();
    state = renderWithProvider(useExploreView, true)!;
    expect(state.items.map((i) => i.name)).toEqual(['Ace']);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(1);

    // 2. Search for "Napa" + set filter + scroll down
    state.setQuery('Napa');
    state.setFormFilter('tablet');
    state = renderWithProvider(useExploreView, true)!;
    await vi.advanceTimersByTimeAsync(200);
    state = renderWithProvider(useExploreView, true)!;
    state.setScrollOffset(340);

    expect(state.query).toBe('Napa');
    expect(state.formFilter).toBe('tablet');
    expect(state.items.map((i) => i.name)).toEqual(['Napa', 'Napa Extra']);
    expect(state.getScrollOffset()).toBe(340);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(2);

    // 3. Navigate to Brand Details -> Explore unmounts completely
    renderWithProvider(useExploreView, false);

    // 4. Press Back -> Explore remounts -> preserves query, results, filter, scroll, and makes ZERO extra API calls
    const restored = renderWithProvider(useExploreView, true)!;
    restored.refreshIfStale();
    await vi.runAllTimersAsync();
    expect(restored.query).toBe('Napa');
    expect(restored.formFilter).toBe('tablet');
    expect(restored.items.map((i) => i.name)).toEqual(['Napa', 'Napa Extra']);
    expect(restored.getScrollOffset()).toBe(340);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(2);

    // 5. Repeat with another medicine query ("Seclo") -> scroll resets to 0 on filter change
    restored.setFormFilter('all');
    restored.setQuery('Seclo');
    state = renderWithProvider(useExploreView, true)!;
    expect(state.getScrollOffset()).toBe(0);
    await vi.advanceTimersByTimeAsync(200);
    state = renderWithProvider(useExploreView, true)!;
    expect(state.items.map((i) => i.name)).toEqual(['Seclo']);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(3);

    renderWithProvider(useExploreView, false);
    const restoredSeclo = renderWithProvider(useExploreView, true)!;
    restoredSeclo.refreshIfStale();
    expect(restoredSeclo.query).toBe('Seclo');
    expect(restoredSeclo.items.map((i) => i.name)).toEqual(['Seclo']);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(3);

    // 6. Empty search results ("NoSuchMedicine") stay preserved on Back navigation without extra fetches
    restoredSeclo.setQuery('NoSuchMedicine');
    renderWithProvider(useExploreView, true);
    await vi.advanceTimersByTimeAsync(200);
    let emptyState = renderWithProvider(useExploreView, true)!;
    expect(emptyState.items).toEqual([]);
    expect(emptyState.totalCount).toBe(0);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(4);

    renderWithProvider(useExploreView, false);
    emptyState = renderWithProvider(useExploreView, true)!;
    emptyState.refreshIfStale();
    expect(emptyState.query).toBe('NoSuchMedicine');
    expect(emptyState.items).toEqual([]);
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(4);

    // 7. Navigating away while an async request is still loading completes cleanly without duplicating
    let resolveDelayed!: (v: PaginatedCatalogueResponse<CatalogueBrandSummaryDto>) => void;
    harness.mockSearchCatalogueBrands.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveDelayed = res;
        }),
    );
    emptyState.setQuery('Monas');
    renderWithProvider(useExploreView, true);
    await vi.advanceTimersByTimeAsync(180);
    renderWithProvider(useExploreView, false);
    let midFlightState = renderWithProvider(useExploreView, true)!;
    midFlightState.refreshIfStale();
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(5);
    expect(midFlightState.loading).toBe(true);

    resolveDelayed({
      items: [makeBrand('301', 'Monas', 'Montelukast')],
      totalCount: 1,
      limit: 15,
      hasMore: false,
      nextCursor: null,
    });
    await vi.runAllTimersAsync();
    midFlightState = renderWithProvider(useExploreView, true)!;
    expect(midFlightState.loading).toBe(false);
    expect(midFlightState.items.map((i) => i.name)).toEqual(['Monas']);

    // 8. After stale TTL elapses, returning triggers a single refresh without wiping visible results
    vi.advanceTimersByTime(EXPLORE_SEARCH_STALE_MS + 1000);
    renderWithProvider(useExploreView, false);
    const staleReturn = renderWithProvider(useExploreView, true)!;
    expect(staleReturn.items.map((i) => i.name)).toEqual(['Monas']);
    staleReturn.refreshIfStale();
    await vi.runAllTimersAsync();
    expect(harness.mockSearchCatalogueBrands).toHaveBeenCalledTimes(6);
  });
});
