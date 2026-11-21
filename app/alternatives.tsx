import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  ScreenContainer,
  SearchInput,
  SecondaryButton,
  StatusBadge,
} from '../src/components';
import {
  AlternativeGroupSearchItemDto,
  searchAlternativeGroups,
} from '../src/api/catalogue';
import {
  formatMissingCatalogueValue,
  formatUnitOrPackPrice,
} from '../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

export default function AlternativeBrandsScreen(): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<AlternativeGroupSearchItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [warningNotice, setWarningNotice] = useState(
    'Groups below only list catalogue records sharing the same generic name, strength, and dosage form. They are not recommendations to replace a prescribed medicine.',
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reqSeqRef = useRef(0);

  const fetchGroups = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      const seq = ++reqSeqRef.current;
      if (opts.reset) {
        setLoading(true);
        setErrorMessage(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await searchAlternativeGroups({
          q: query.trim() || undefined,
          cursor: opts.reset ? undefined : opts.cursor ?? undefined,
          limit: 12,
        });
        if (seq !== reqSeqRef.current) return;

        setWarningNotice(res.warningNotice);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
        setGroups((prev) => (opts.reset ? res.items : [...prev, ...res.items]));
      } catch (err) {
        if (seq !== reqSeqRef.current) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Unable to load matching groups from CareDose server.',
        );
      } finally {
        if (seq === reqSeqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [query],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchGroups({ reset: true });
    }, 240);
    return () => clearTimeout(timer);
  }, [fetchGroups]);

  return (
    <ScreenContainer
      title="Alternative Brands"
      onBack={() => router.push('/profile')}
    >
      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>Pharmacist / Doctor Review Required</Text>
        <Text style={styles.warningBody}>{warningNotice}</Text>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search brand or generic name..."
      />

      {loading ? (
        <View style={styles.stateWrap}>
          <LoadingSkeleton rows={3} />
        </View>
      ) : errorMessage ? (
        <View style={styles.stateWrap}>
          <ErrorState
            title="Could not load comparison groups"
            message={errorMessage}
            onRetry={() => void fetchGroups({ reset: true })}
          />
        </View>
      ) : groups.length === 0 ? (
        <EmptyState
          title="No matching comparison groups"
          description="Try searching another generic or brand name."
          actionLabel="Clear search"
          onAction={() => setQuery('')}
        />
      ) : (
        <>
          {groups.map((group) => (
            <View key={group.id} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleCol}>
                  <Text style={styles.groupGeneric}>{group.generic.name}</Text>
                  <Text style={styles.groupMeta}>
                    {group.strengthNorm} · {group.dosageFormNorm}
                    {group.isCombination ? ' · Combination' : ''}
                  </Text>
                </View>
                <StatusBadge variant="unverified" label="Unverified group" />
              </View>

              {group.brands.map((brand, idx) => (
                <Pressable
                  key={brand.id}
                  accessibilityRole="button"
                  onPress={() => router.push(`/explore/brand/${brand.sourceId}`)}
                  style={[
                    styles.brandRow,
                    idx === group.brands.length - 1 ? styles.lastBrandRow : null,
                  ]}
                >
                  <View style={styles.brandInfoCol}>
                    <Text style={styles.brandName}>{brand.name}</Text>
                    <Text style={styles.brandMfr}>
                      {formatMissingCatalogueValue(brand.manufacturer)}
                    </Text>
                  </View>
                  <Text style={styles.brandPrice}>
                    {formatUnitOrPackPrice(brand.primaryPack)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}

          {hasMore && nextCursor ? (
            <View style={styles.loadMoreWrap}>
              <SecondaryButton
                fullWidth
                label={loadingMore ? 'Loading more...' : 'Load more groups'}
                loading={loadingMore}
                onPress={() => void fetchGroups({ reset: false, cursor: nextCursor })}
              />
            </View>
          ) : null}
        </>
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
    padding: 14,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.warning,
  },
  warningBody: {
    marginTop: 3,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    lineHeight: 17,
  },
  stateWrap: {
    marginTop: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginTop: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  groupTitleCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  groupGeneric: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  groupMeta: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  lastBrandRow: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  brandInfoCol: {
    flex: 1,
    minWidth: 0,
  },
  brandName: {
    fontSize: 13,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  brandMfr: {
    marginTop: 2,
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  brandPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.primary,
    flexShrink: 0,
    textAlign: 'right',
  },
  loadMoreWrap: {
    marginTop: 12,
    marginBottom: 10,
  },
});
