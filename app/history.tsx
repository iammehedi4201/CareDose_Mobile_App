import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../src/theme/tokens';

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
        <View style={styles.medFilterBanner}>
          <Text style={styles.medFilterText} numberOfLines={1}>
            Filtered to: {filteredMed?.name ?? 'Selected medicine'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveMedFilter(null)}
            style={styles.clearFilterBtn}
          >
            <Text style={styles.clearFilterText}>Show all</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={layout.stackTwoCol ? styles.dateRangeStacked : styles.dateRangeRow}>
        <View style={layout.stackTwoCol ? styles.dateColFull : styles.dateCol}>
          <DateField label="From" value={fromDate} onChangeDate={setFromDate} allowClear />
        </View>
        <View style={layout.stackTwoCol ? styles.dateColFull : styles.dateCol}>
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
              <View key={item.id} style={styles.rowCard}>
                <View style={styles.rowTextCol}>
                  <Text style={styles.medName}>{labelName}</Text>
                  <Text style={styles.metaText}>
                    {formatHistoryDateLabel(item.scheduledDateYmd)} · {item.scheduledTime12}
                  </Text>
                </View>
                <StatusBadge variant={item.status as StatusVariant} />
              </View>
            );
          })}

          {hasMore && nextCursor ? (
            <View style={styles.loadMoreWrap}>
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

const styles = StyleSheet.create({
  medFilterBanner: {
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
    marginBottom: 10,
  },
  medFilterText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  clearFilterBtn: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  dateRangeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateRangeStacked: {
    flexDirection: 'column',
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
  },
  dateColFull: {
    width: '100%',
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    marginTop: 10,
  },
  rowTextCol: {
    flex: 1,
    minWidth: 0,
  },
  medName: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  metaText: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
  loadMoreWrap: {
    marginTop: 12,
  },
});
