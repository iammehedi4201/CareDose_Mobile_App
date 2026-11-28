import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import {
  CatalogueBrandSummaryDto,
  searchCatalogueBrands,
  searchCatalogueOfflineFallback,
} from '../api/catalogue';
import {
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  rankMedicineSuggestions,
} from '../features/catalogue/catalogue-helpers';
import { useResponsiveLayout } from '../theme/responsive';
import { SearchInput, SearchSuggestionItem } from './SearchInput';

export interface CatalogueSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  formFilter?: string;
  manufacturerFilter?: string;
  placeholder?: string;
  compactPlaceholder?: string;
  seedItems?: CatalogueBrandSummaryDto[];
  onSelectBrand: (brand: CatalogueBrandSummaryDto) => void;
  onFillBrandQuery?: (brand: CatalogueBrandSummaryDto) => void;
}

const SUGGESTION_DEBOUNCE_MS = 110;
const EMPTY_SEED_ITEMS: CatalogueBrandSummaryDto[] = [];

export function CatalogueSearchInput({
  value,
  onChangeText,
  formFilter,
  manufacturerFilter,
  placeholder = 'Search medicine, generic, or strength...',
  compactPlaceholder = 'Search medicine or generic...',
  seedItems = EMPTY_SEED_ITEMS,
  onSelectBrand,
  onFillBrandQuery,
}: CatalogueSearchInputProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const [focused, setFocused] = useState(false);
  const [dismissedQuery, setDismissedQuery] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CatalogueBrandSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSeqRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const normalizedForm = formFilter && formFilter !== 'all' ? formFilter : undefined;
  const normalizedMfr = manufacturerFilter?.trim() || undefined;

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (trimmed.length === 0) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;

    const immediateRanked = rankMedicineSuggestions(
      [...seedItems, ...OFFLINE_FALLBACK_CATALOGUE_BRANDS],
      trimmed,
      8,
    );
    if (immediateRanked.length > 0) {
      setCandidates(immediateRanked);
    }

    void searchCatalogueOfflineFallback({
      q: trimmed,
      form: normalizedForm,
      manufacturer: normalizedMfr,
      limit: 14,
    })
      .then((offlineRes) => {
        if (seq !== requestSeqRef.current) return;
        if (offlineRes.items.length > 0) {
          setCandidates((prev) =>
            rankMedicineSuggestions(
              [...offlineRes.items, ...prev, ...seedItems],
              trimmed,
              8,
            ),
          );
        }
      })
      .catch(() => {
        // Ignore offline SQLite prefill failure
      });

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void searchCatalogueBrands({
        q: trimmed,
        form: normalizedForm,
        manufacturer: normalizedMfr,
        limit: 16,
      })
        .then((res) => {
          if (seq !== requestSeqRef.current) return;
          setCandidates((prev) =>
            rankMedicineSuggestions([...res.items, ...prev, ...seedItems], trimmed, 6),
          );
        })
        .catch(() => {
          // Keep any local SQLite or cached matches visible when offline
        })
        .finally(() => {
          if (seq === requestSeqRef.current) {
            setLoading(false);
          }
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [normalizedForm, normalizedMfr, seedItems, trimmed]);

  const rankedBrands = useMemo(
    () => rankMedicineSuggestions(candidates, trimmed, 6),
    [candidates, trimmed],
  );

  const brandById = useMemo(() => {
    const map = new Map<string, CatalogueBrandSummaryDto>();
    for (const brand of rankedBrands) {
      map.set(brand.id, brand);
    }
    return map;
  }, [rankedBrands]);

  const suggestionItems = useMemo<SearchSuggestionItem[]>(
    () =>
      rankedBrands.map((brand) => ({
        id: brand.id,
        title: brand.strength ? `${brand.name} ${brand.strength}` : brand.name,
        subtitle:
          [brand.generic?.name, brand.manufacturer].filter(Boolean).join(' · ') ||
          undefined,
        badge: brand.dosageForm ?? undefined,
        meta: formatUnitOrPackPrice(brand.primaryPack),
      })),
    [rankedBrands],
  );

  const handleChangeText = (next: string): void => {
    setDismissedQuery(null);
    onChangeText(next);
  };

  const handleSelectSuggestion = (item: SearchSuggestionItem): void => {
    const brand = brandById.get(item.id);
    setDismissedQuery(value);
    setFocused(false);
    if (typeof Keyboard?.dismiss === 'function') {
      Keyboard.dismiss();
    }
    if (brand) {
      onSelectBrand(brand);
    }
  };

  const handleFillSuggestion = (item: SearchSuggestionItem): void => {
    const brand = brandById.get(item.id);
    if (!brand) return;
    setDismissedQuery(brand.name);
    setFocused(false);
    if (typeof Keyboard?.dismiss === 'function') {
      Keyboard.dismiss();
    }
    if (onFillBrandQuery) {
      onFillBrandQuery(brand);
    } else {
      onChangeText(brand.name);
    }
  };

  return (
    <SearchInput
      value={value}
      onChangeText={handleChangeText}
      placeholder={layout.isCompact ? compactPlaceholder : placeholder}
      onClear={() => setDismissedQuery(null)}
      onFocusChange={setFocused}
      onSubmitEditing={() => setDismissedQuery(value)}
      suggestions={suggestionItems}
      showSuggestions={focused && trimmed.length > 0 && dismissedQuery !== value}
      suggestionsLoading={loading}
      suggestionsHeader="Matching Medicines"
      onSelectSuggestion={handleSelectSuggestion}
      onFillSuggestion={handleFillSuggestion}
    />
  );
}
