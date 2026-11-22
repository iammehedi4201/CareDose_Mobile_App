import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  MedicineCard,
  ScreenContainer,
  SearchInput,
} from '../../../../src/components';
import {
  CatalogueBrandSummaryDto,
  getCatalogueBrandAlternatives,
} from '../../../../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  resolveBrandBadge,
} from '../../../../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../../../src/theme/tokens';

const INITIAL_PREVIEW_COUNT = 3;

type AlternativeScopeFilter = 'remaining' | 'all';

export default function BrandAlternativesListScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [targetBrand, setTargetBrand] = useState<CatalogueBrandSummaryDto | null>(null);
  const [allCandidates, setAllCandidates] = useState<CatalogueBrandSummaryDto[]>([]);
  const [warningNotice, setWarningNotice] = useState(
    'Potential matching brands only. Sharing the same generic, strength, and dosage form does not mean brands are automatically interchangeable. Always consult a qualified doctor or pharmacist before changing medicine brands.',
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<AlternativeScopeFilter>('remaining');

  const loadAlternatives = useCallback(
    async (forceRefresh = false) => {
      if (!id) return;
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await getCatalogueBrandAlternatives(id, { forceRefresh });
        setTargetBrand(res.brand);
        setAllCandidates(res.groups.flatMap((g) => g.candidateBrands));
        setWarningNotice(res.warningNotice);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Unable to load alternative brands.',
        );
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void loadAlternatives();
  }, [loadAlternatives]);

  const remainingCandidates = useMemo(
    () => allCandidates.slice(INITIAL_PREVIEW_COUNT),
    [allCandidates],
  );

  const effectivePool = useMemo(() => {
    // When searching, search across all candidates if user chose 'all' or remaining count is 0;
    // otherwise filter the selected scope cleanly.
    if (scopeFilter === 'all' || remainingCandidates.length === 0) {
      return allCandidates;
    }
    return remainingCandidates;
  }, [scopeFilter, allCandidates, remainingCandidates]);

  const filteredBrands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return effectivePool;
    return effectivePool.filter((alt) => {
      const hay = `${alt.name} ${alt.generic?.name ?? ''} ${alt.strength ?? ''} ${alt.manufacturer ?? ''} ${alt.dosageForm ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [effectivePool, query]);

  const subtitle = targetBrand
    ? `${targetBrand.generic?.name ?? 'Matching brands'} · ${targetBrand.strength ?? 'All strengths'} · ${targetBrand.dosageForm ?? ''}`
    : 'Remaining alternative brands';

  return (
    <ScreenContainer
      title={targetBrand ? `${targetBrand.name} Alternatives` : 'Alternative Brands'}
      subtitle={subtitle}
      onBack={() => router.push(`/explore/brand/${id ?? ''}`)}
    >
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>Pharmacist / Doctor Review Required</Text>
        <Text style={styles.warningBody}>{warningNotice}</Text>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search brand name or manufacturer..."
      />

      {remainingCandidates.length > 0 ? (
        <View style={styles.filterWrap}>
          <FilterChips
            options={[
              { key: 'remaining', label: `Remaining (${remainingCandidates.length})` },
              { key: 'all', label: `All matching (${allCandidates.length})` },
            ]}
            selectedKey={scopeFilter}
            onSelect={setScopeFilter}
          />
        </View>
      ) : null}

      <View style={styles.countHeaderRow}>
        <Text style={styles.countTitle}>
          {query.trim().length > 0
            ? `Matching results (${filteredBrands.length})`
            : scopeFilter === 'remaining' && remainingCandidates.length > 0
              ? `Remaining alternative brands (${filteredBrands.length})`
              : `All matching brands (${filteredBrands.length})`}
        </Text>
        <Text style={styles.sourceLabel}>MedEx (unverified)</Text>
      </View>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : errorMessage ? (
        <ErrorState
          title="Could not load alternative brands"
          message={errorMessage}
          onRetry={() => void loadAlternatives(true)}
        />
      ) : filteredBrands.length === 0 ? (
        <EmptyState
          title="No matching brands found"
          description={
            scopeFilter === 'remaining' && query.trim().length > 0
              ? 'No brands matched in the remaining list. Try searching across all matching brands or clear the filter.'
              : 'Try searching another brand name or manufacturer.'
          }
          actionLabel={
            scopeFilter === 'remaining' && query.trim().length > 0
              ? 'Search all matching'
              : 'Clear search'
          }
          onAction={() => {
            if (scopeFilter === 'remaining' && query.trim().length > 0) {
              setScopeFilter('all');
            } else {
              setQuery('');
            }
          }}
        />
      ) : (
        filteredBrands.map((alt) => {
          const badge = resolveBrandBadge(alt);
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
              statusVariant={badge.variant}
              statusLabel={badge.label}
              showStatusBadge={badge.showBadge}
              onPress={() => router.push(`/explore/brand/${alt.sourceId}`)}
            />
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  warningCard: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    padding: 12,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.warning,
  },
  warningBody: {
    marginTop: 2,
    fontSize: 11.5,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    lineHeight: 16,
  },
  filterWrap: {
    marginTop: 10,
  },
  countHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
  },
  countTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  sourceLabel: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.mutedText,
    flexShrink: 0,
  },
});
