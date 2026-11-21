import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MedicineCard,
  ScreenContainer,
  SecondaryButton,
} from '../../../src/components';
import {
  CatalogueBrandSummaryDto,
  getCatalogueGenericDetail,
} from '../../../src/api/catalogue';
import {
  formatPackSummary,
  formatUnitOrPackPrice,
  OFFLINE_FALLBACK_CATALOGUE_BRANDS,
  resolveBrandBadge,
} from '../../../src/features/catalogue/catalogue-helpers';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../../../src/theme/tokens';

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

  if (loading) {
    return (
      <ScreenContainer
        title="Generic Details"
        subtitle="Loading linked catalogue brands..."
        onBack={() => router.push('/explore')}
      >
        <LoadingSkeleton rows={4} />
      </ScreenContainer>
    );
  }

  if (errorMessage) {
    return (
      <ScreenContainer
        title="Generic Details"
        onBack={() => router.push('/explore')}
      >
        <ErrorState
          title="Could not load generic"
          message={errorMessage}
          onRetry={() => void loadGeneric({ reset: true })}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      title={genericName}
      subtitle="Generic · Catalogue brands"
      onBack={() => router.push('/explore')}
    >
      <View style={styles.summaryCard}>
        <View style={styles.iconCircle}>
          <Feather name="disc" size={18} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View style={styles.summaryTextCol}>
          <Text style={styles.summaryTitle}>{genericName}</Text>
          <Text style={styles.summarySub}>
            {totalCount.toLocaleString()} brand records linked in the imported catalogue
          </Text>
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Associated brands</Text>
        <Text style={styles.countText}>{totalCount.toLocaleString()} brands</Text>
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
                stockText={formatUnitOrPackPrice(b.primaryPack)}
                priceText={formatPackSummary(b.primaryPack)}
                statusVariant={badge.variant}
                statusLabel={badge.label}
                onPress={() => router.push(`/explore/brand/${b.sourceId}`)}
              />
            );
          })}

          {hasMore && nextCursor ? (
            <View style={styles.loadMoreWrap}>
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

      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{warningNotice}</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: '#C5E8D8',
    padding: 14,
    marginBottom: 16,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  summaryTextCol: {
    flex: 1,
    minWidth: 0,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  summarySub: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    flexShrink: 1,
    minWidth: 0,
  },
  countText: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    flexShrink: 0,
  },
  loadMoreWrap: {
    marginTop: 6,
    marginBottom: 10,
  },
  warningBox: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderRadius: CAREDOSE_RADIUS.field,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    padding: 12,
    marginVertical: 10,
  },
  warningText: {
    fontSize: 11,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
    lineHeight: 16,
  },
});
