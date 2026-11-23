import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  DateField,
  EmptyState,
  FilterChips,
  LoadingSkeleton,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
  StatusVariant,
} from '../src/components';
import type { DoseHistoryItemDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  formatHistoryDateLabel,
  getTodayLocalYmd,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';

type HistoryFilter = 'all' | 'taken' | 'skipped';

export default function DoseHistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const { medicationId } = useLocalSearchParams<{ medicationId?: string }>();
  const layout = useResponsiveLayout();
  const { getMedicationById } = useMedications();
  const { doseEvents, queryDoseHistory } = useSchedules();

  const today = getTodayLocalYmd();
  const [fromDate, setFromDate] = useState(addDaysYmd(today, -14));
  const [toDate, setToDate] = useState(today);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [activeMedFilter, setActiveMedFilter] = useState<string | null>(
    medicationId ?? null,
  );

  const [items, setItems] = useState<DoseHistoryItemDto[]>([]);
  const [counts, setCounts] = useState({ all: 0, taken: 0, skipped: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setActiveMedFilter(medicationId ?? null);
  }, [medicationId]);

  const loadHistory = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      if (opts.reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const res = await queryDoseHistory({
          fromDate: fromDate.trim() || undefined,
          toDate: toDate.trim() || undefined,
          status: filter,
          medicationId: activeMedFilter,
          cursor: opts.reset ? undefined : opts.cursor,
          limit: 20,
        });
        setCounts(res.counts);
        setHasMore(res.hasMore);
        setNextCursor(res.nextCursor);
        setItems((prev) => (opts.reset ? res.items : [...prev, ...res.items]));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeMedFilter, filter, fromDate, queryDoseHistory, toDate],
  );

  useEffect(() => {
    void loadHistory({ reset: true });
  }, [loadHistory, doseEvents]);

  const filteredMed = activeMedFilter ? getMedicationById(activeMedFilter) : undefined;

  return (
    <ScreenContainer
      title="Dose History"
      onBack={() =>
        activeMedFilter
          ? router.push(`/medicines/${activeMedFilter}`)
          : router.push('/profile')
      }
    >
      {activeMedFilter ? (
        <View className="flex-row items-center justify-between gap-2.5 bg-mint rounded-field border border-[#C5E8D8] px-3 py-2 mb-2.5">
          <Text className="flex-1 min-w-0 text-[12px] font-semibold text-main" numberOfLines={1}>
            Filtered to: {filteredMed?.name ?? 'Selected medicine'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveMedFilter(null)}
            className="shrink-0 px-2 py-1"
          >
            <Text className="text-[12px] font-bold text-primary">Show all</Text>
          </Pressable>
        </View>
      ) : null}

      <View className={layout.stackTwoCol ? 'flex-col' : 'flex-row gap-2.5'}>
        <View className={layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'}>
          <DateField label="From" value={fromDate} onChangeDate={setFromDate} allowClear />
        </View>
        <View className={layout.stackTwoCol ? 'w-full' : 'flex-1 min-w-0'}>
          <DateField label="To" value={toDate} onChangeDate={setToDate} allowClear />
        </View>
      </View>

      <FilterChips
        options={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'taken', label: 'Taken', count: counts.taken },
          { key: 'skipped', label: 'Skipped', count: counts.skipped },
        ]}
        selectedKey={filter}
        onSelect={setFilter}
      />

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No dose history for this filter"
          description="Confirmed Taken or Skipped doses appear here. Try widening the date range or switching filters."
          actionLabel="Show all"
          onAction={() => {
            setFilter('all');
            setActiveMedFilter(null);
            setFromDate('');
            setToDate('');
          }}
        />
      ) : (
        <>
          {items.map((item) => {
            const labelName =
              item.strength && item.strength.trim().length > 0
                ? `${item.medicineName} ${item.strength}`
                : item.medicineName;
            return (
              <View
                key={item.id}
                className="flex-row items-center justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mt-2.5"
              >
                <View className="flex-1 min-w-0">
                  <Text className="text-[14px] font-semibold text-main">{labelName}</Text>
                  <Text className="mt-0.5 text-[12px] text-[#5A706B]">
                    {formatHistoryDateLabel(item.scheduledDateYmd)} · {item.scheduledTime12}
                  </Text>
                </View>
                <StatusBadge variant={item.status as StatusVariant} />
              </View>
            );
          })}

          {hasMore && nextCursor ? (
            <View className="mt-3">
              <SecondaryButton
                fullWidth
                loading={loadingMore}
                label="Load More History"
                onPress={() => void loadHistory({ reset: false, cursor: nextCursor })}
              />
            </View>
          ) : null}
        </>
      )}
    </ScreenContainer>
  );
}
