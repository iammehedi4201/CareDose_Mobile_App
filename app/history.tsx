import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import historyHeaderImage from '../assets/history-header-illustration.jpg';
import {
  DateField,
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  ScreenContainer,
  SecondaryButton,
  StatusBadge,
  StatusVariant,
  useScreenWaveHeader,
} from '../src/components';
import type { DoseHistoryItemDto } from '../src/api/schedules';
import { useMedications } from '../src/features/medications/MedicationsContext';
import {
  addDaysYmd,
  formatDoseAmountDisplay,
  formatHistoryDateLabel,
  formatIsoTimestampTo12Hour,
  getTodayLocalYmd,
} from '../src/features/schedule/dose-rules';
import { useSchedules } from '../src/features/schedule/SchedulesContext';
import { useResponsiveLayout } from '../src/theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

type HistoryFilter = 'all' | 'taken' | 'skipped' | 'missed';

export default function DoseHistoryScreen(): React.JSX.Element {
  const router = useRouter();
  const { medicationId, from } = useLocalSearchParams<{
    medicationId?: string;
    from?: string;
  }>();
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
  const [counts, setCounts] = useState({ all: 0, taken: 0, skipped: 0, missed: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setActiveMedFilter(medicationId ?? null);
  }, [medicationId]);

  const loadHistory = useCallback(
    async (opts: { reset: boolean; cursor?: string | null }) => {
      setLoadError(null);
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
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : 'Unable to load dose history.',
        );
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

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'ADHERENCE',
    title: 'Dose History',
    imageSource: historyHeaderImage,
    onBack: () => {
      if (activeMedFilter) {
        router.push(`/medicines/${activeMedFilter}`);
        return;
      }
      if (from === 'schedule' || from === 'schedules') {
        const target = from === 'schedules' ? '/schedules' : '/schedule';
        if (typeof router.navigate === 'function') {
          router.navigate(target);
        } else {
          router.push(target);
        }
        return;
      }
      router.push('/profile');
    },
  });

  return (
    <ScreenContainer
      title="Dose History"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      {/* Floating Date Range Card */}
      <View
        style={{ marginTop: -overlapPx }}
        className="mb-3 rounded-card border border-border bg-white p-3.5 shadow-sm"
      >
        {activeMedFilter ? (
          <View className="mb-2.5 flex-row items-center justify-between gap-2.5 rounded-field border border-[#C5E8D8] bg-mint px-3 py-2">
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
      </View>

      <FilterChips
        options={[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'taken', label: 'Taken', count: counts.taken },
          { key: 'skipped', label: 'Skipped', count: counts.skipped },
          { key: 'missed', label: 'Missed', count: counts.missed },
        ]}
        selectedKey={filter}
        onSelect={setFilter}
      />

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : loadError ? (
        <ErrorState
          title="Unable to load dose history"
          message={loadError}
          onRetry={() => void loadHistory({ reset: true })}
        />
      ) : items.length === 0 ? (
        counts.all === 0 && !activeMedFilter && filter === 'all' ? (
          <EmptyState
            title="No dose history yet. Your recorded doses will appear here."
            description="Taken, skipped, and missed doses across your medication plans will appear here."
            iconName="clock"
          />
        ) : (
          <EmptyState
            title="No dose history matches this filter"
            description="Try widening the date range or switching back to All statuses."
            actionLabel="Show all"
            onAction={() => {
              setFilter('all');
              setActiveMedFilter(null);
              setFromDate('');
              setToDate('');
            }}
          />
        )
      ) : (
        <>
          {items.map((item) => {
            const labelName =
              item.strength && item.strength.trim().length > 0
                ? `${item.medicineName} ${item.strength}`
                : item.medicineName;
            const takenTime12 =
              item.status === 'taken'
                ? formatIsoTimestampTo12Hour(item.recordedAt)
                : null;
            const statusIcon =
              item.status === 'taken'
                ? 'check'
                : item.status === 'skipped'
                  ? 'skip-forward'
                  : 'alert-circle';
            const statusBg =
              item.status === 'taken'
                ? CAREDOSE_EXTENDED_COLORS.mintSurface
                : item.status === 'skipped'
                  ? CAREDOSE_EXTENDED_COLORS.warningSurface
                  : CAREDOSE_EXTENDED_COLORS.errorSurface;
            const statusColor =
              item.status === 'taken'
                ? CAREDOSE_EXTENDED_COLORS.primary
                : item.status === 'skipped'
                  ? CAREDOSE_EXTENDED_COLORS.warning
                  : CAREDOSE_EXTENDED_COLORS.error;
            return (
              <View
                key={item.id}
                className="flex-row items-start justify-between gap-2.5 bg-white rounded-card border border-border p-3.5 mt-2.5 shadow-sm"
              >
                <View className="flex-row flex-1 min-w-0 items-start gap-2.5">
                  <View
                    className="mt-0.5 h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: statusBg }}
                  >
                    <Feather name={statusIcon} size={15} color={statusColor} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-[14px] font-bold text-main">{labelName}</Text>
                    <Text className="mt-0.5 text-[12px] text-[#5A706B]">
                      {formatHistoryDateLabel(item.scheduledDateYmd)} · {item.scheduledTime12} ·{' '}
                      {formatDoseAmountDisplay(item.doseAmount, item.doseUnit)}
                    </Text>
                    {takenTime12 ? (
                      <Text className="mt-0.5 text-[11px] font-medium text-primary-dark">
                        Taken at {takenTime12}
                      </Text>
                    ) : null}
                    {item.note && item.note.trim().length > 0 ? (
                      <Text className="mt-0.5 text-[11px] text-[#5A706B]">
                        Note: {item.note.trim()}
                      </Text>
                    ) : null}
                  </View>
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
