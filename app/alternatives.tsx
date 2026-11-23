import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
      <View className="bg-[#FDF5E6] rounded-card border border-[#F3D9A4] p-3.5 mb-3">
        <Text className="text-[13px] font-bold text-warning">
          Pharmacist / Doctor Review Required
        </Text>
        <Text className="mt-[3px] text-[12px] text-main leading-[17px]">
          {warningNotice}
        </Text>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search brand or generic name..."
      />

      {loading ? (
        <View className="mt-3">
          <LoadingSkeleton rows={3} />
        </View>
      ) : errorMessage ? (
        <View className="mt-3">
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
            <View
              key={group.id}
              className="bg-white rounded-card border border-border p-3.5 mt-3"
            >
              <View className="flex-row items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-border">
                <View className="flex-1 min-w-0 pr-2">
                  <Text className="text-[15px] font-bold text-main">{group.generic.name}</Text>
                  <Text className="mt-0.5 text-[12px] text-[#5A706B]">
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
                  className={`flex-row items-center justify-between gap-2.5 py-2.5 ${
                    idx === group.brands.length - 1 ? 'pb-0.5' : 'border-b border-border'
                  }`}
                >
                  <View className="flex-1 min-w-0">
                    <Text className="text-[13px] font-semibold text-main">{brand.name}</Text>
                    <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                      {formatMissingCatalogueValue(brand.manufacturer)}
                    </Text>
                  </View>
                  <Text className="text-[12px] font-semibold text-primary shrink-0 text-right">
                    {formatUnitOrPackPrice(brand.primaryPack)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}

          {hasMore && nextCursor ? (
            <View className="mt-3 mb-2.5">
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
