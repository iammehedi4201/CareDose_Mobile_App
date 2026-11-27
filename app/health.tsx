import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { HealthReadingItemDto } from '../src/api/health-logs';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  LogReadingModal,
  ScreenContainer,
  SuccessToast,
} from '../src/components';
import {
  convertGlucoseValue,
  formatGlucoseUnitLabel,
  HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER,
  READING_CONTEXT_FILTER_CHIPS,
} from '../src/features/health/health-helpers';
import { useHealthLogs } from '../src/features/health/HealthLogsContext';
import { useUserPreferences } from '../src/features/profile/UserPreferencesContext';
import { CAREDOSE_EXTENDED_COLORS } from '../src/theme/tokens';

export default function HealthLogScreen(): React.JSX.Element {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const {
    readings,
    filteredLatestReading,
    chartPoints,
    contextFilter,
    setContextFilter,
    hasSampleReadings,
    disclaimer,
    loading,
    deletingId,
    error,
    refreshHealthLogs,
    deleteHealthReading,
    loadSampleDemoReadings,
  } = useHealthLogs();

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HealthReadingItemDto | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const preferredUnitLabel = formatGlucoseUnitLabel(preferences.glucoseUnit);

  const maxChartValue = useMemo(() => {
    const baseline = preferences.glucoseUnit === 'MMOL_L' ? 10 : 180;
    const highest = Math.max(
      ...chartPoints.map((point) => point.convertedValue),
      baseline,
      1,
    );
    return highest;
  }, [chartPoints, preferences.glucoseUnit]);

  const handleBack = (): void => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/profile');
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    const removed = deleteTarget;
    try {
      await deleteHealthReading(removed.id);
      setDeleteTarget(null);
      setToast(`Deleted ${removed.displayValue} ${removed.unitLabel} reading.`);
    } catch (err) {
      setDeleteTarget(null);
      setToast(err instanceof Error ? err.message : 'Unable to delete reading.');
    }
  };

  return (
    <ScreenContainer
      title="Health Log"
      subtitle="Personal blood glucose tracking & history"
      onBack={handleBack}
      primaryAction={{
        label: '+ Log Reading',
        onPress: () => setLogModalOpen(true),
      }}
    >
      <SuccessToast message={toast} />

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => void refreshHealthLogs()}
        />
      ) : null}

      {hasSampleReadings ? (
        <View className="mb-3 flex-row items-center gap-2 rounded-card border border-[#CFE0F5] bg-[#F4F8FD] px-3.5 py-2.5">
          <Feather name="info" size={14} color={CAREDOSE_EXTENDED_COLORS.info} />
          <Text className="flex-1 text-[11px] font-medium leading-[16px] text-main">
            Sample demo readings are currently shown. Log your own reading anytime or clear in Settings → Reset demo data.
          </Text>
        </View>
      ) : null}

      {/* Latest Reading Overview Card */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="text-xs font-semibold text-[#5A706B]">
            {contextFilter === 'ALL' ? 'Latest logged reading' : 'Latest in selected context'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Preferred unit ${preferredUnitLabel}. Open Settings to change`}
            onPress={() => router.push('/settings')}
            className="rounded-full border border-[#CBE7DB] bg-mint px-2.5 py-1 active:opacity-80"
          >
            <Text className="text-[11px] font-semibold text-primary">
              Chart unit: {preferredUnitLabel}
            </Text>
          </Pressable>
        </View>

        {filteredLatestReading ? (
          <View className="mt-2">
            <View className="flex-row flex-wrap items-baseline gap-2">
              <Text className="text-[26px] font-bold text-primary">
                {filteredLatestReading.displayValue} {filteredLatestReading.unitLabel}
              </Text>
              <View className="rounded-full border border-border bg-background px-2.5 py-0.5">
                <Text className="text-[11px] font-semibold text-main">
                  {filteredLatestReading.contextLabel}
                </Text>
              </View>
              {filteredLatestReading.isSample ? (
                <View className="rounded-full border border-[#CFE0F5] bg-[#F4F8FD] px-2 py-0.5">
                  <Text className="text-[10px] font-semibold text-info">Sample</Text>
                </View>
              ) : null}
            </View>

            <Text className="mt-1 text-xs text-[#5A706B]">
              {filteredLatestReading.measuredDateYmd} · {filteredLatestReading.measuredTime12}
              {filteredLatestReading.unit !== preferences.glucoseUnit
                ? ` · ≈ ${convertGlucoseValue(
                    Number(filteredLatestReading.value),
                    filteredLatestReading.unit,
                    preferences.glucoseUnit,
                  )} ${preferredUnitLabel}`
                : ''}
            </Text>

            {filteredLatestReading.note ? (
              <Text className="mt-1.5 text-xs text-main">
                {filteredLatestReading.note}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text className="mt-2 text-xs leading-[18px] text-[#5A706B]">
            No blood glucose readings saved yet for this view.
          </Text>
        )}
      </View>

      {/* 7-Reading Trend Chart Card */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4">
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text className="text-[15px] font-semibold text-main">
            Recent trend (up to 7 readings)
          </Text>
          <Text className="text-[11px] font-medium text-[#5A706B]">
            {preferredUnitLabel}
          </Text>
        </View>

        {chartPoints.length > 0 ? (
          <>
            <View className="flex-row items-end justify-between gap-1.5 pt-2">
              {chartPoints.map((point, index) => {
                const isLatestPoint = index === chartPoints.length - 1;
                const heightPx =
                  point.convertedValue > 0
                    ? Math.max(14, Math.round((point.convertedValue / maxChartValue) * 84))
                    : 6;
                return (
                  <View
                    key={point.id}
                    accessibilityLabel={`${point.measuredDateYmd} ${point.contextLabel}: ${point.convertedValue} ${point.unitLabel}`}
                    className="flex-1 min-w-0 items-center"
                  >
                    <Text
                      className={`mb-1 text-[10px] font-semibold ${
                        isLatestPoint ? 'text-primary' : 'text-[#5A706B]'
                      }`}
                      numberOfLines={1}
                    >
                      {point.convertedValue}
                    </Text>
                    <View className="h-[88px] w-full items-center justify-end px-0.5">
                      <View
                        className={`w-full max-w-[28px] rounded-t-[6px] ${
                          isLatestPoint ? 'bg-primary' : 'bg-[#A7D7C8]'
                        }`}
                        style={{ height: heightPx }}
                      />
                    </View>
                    <Text
                      className={`mt-1.5 text-[10px] ${
                        isLatestPoint ? 'font-bold text-primary' : 'font-medium text-[#5A706B]'
                      }`}
                      numberOfLines={1}
                    >
                      {point.shortDateLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text className="mt-2.5 text-[11px] leading-[16px] text-[#5A706B]">
              Chart bars normalize mixed entries to {preferredUnitLabel}. Saved rows below keep your exact entered values.
            </Text>
          </>
        ) : (
          <View className="rounded-field border border-border bg-background px-3 py-3">
            <Text className="text-xs leading-[18px] text-[#5A706B]">
              Your 7-reading bar chart updates automatically once you save glucose entries.
            </Text>
          </View>
        )}
      </View>

      {/* Meal Context Filters */}
      <View className="mb-3">
        <FilterChips
          options={READING_CONTEXT_FILTER_CHIPS}
          selectedKey={contextFilter}
          onSelect={setContextFilter}
        />
      </View>

      {/* Readings List / Empty / Loading */}
      {loading && readings.length === 0 ? (
        <LoadingSkeleton rows={3} />
      ) : readings.length === 0 ? (
        <View>
          <EmptyState
            iconName="activity"
            title={
              contextFilter === 'ALL'
                ? 'No health readings logged yet'
                : 'No readings match this filter'
            }
            description={
              contextFilter === 'ALL'
                ? 'Tap + Log Reading in the top header to record your first glucose check.'
                : 'Switch filter chips above or log a new reading in the top header.'
            }
          />
          {contextFilter === 'ALL' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Load labelled sample demo readings"
              onPress={() => {
                void loadSampleDemoReadings().then(() => {
                  setToast('Labelled sample demo readings loaded.');
                });
              }}
              className="mt-1 items-center py-2"
            >
              <Text className="text-xs font-semibold text-primary">
                Preview with labelled sample demo readings
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View className="mb-3.5 gap-2.5">
          {readings.map((item) => {
            const convertedDiffers = item.unit !== preferences.glucoseUnit;
            const convertedVal = convertedDiffers
              ? convertGlucoseValue(
                  Number(item.value),
                  item.unit,
                  preferences.glucoseUnit,
                )
              : null;

            return (
              <View
                key={item.id}
                className="rounded-card border border-border bg-white p-3.5"
              >
                <View className="flex-row items-start justify-between gap-2.5">
                  <View className="flex-1 min-w-0">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-[17px] font-bold text-main">
                        {item.displayValue} {item.unitLabel}
                      </Text>
                      <View className="rounded-full border border-[#CBE7DB] bg-mint px-2.5 py-0.5">
                        <Text className="text-[11px] font-semibold text-primary">
                          {item.contextLabel}
                        </Text>
                      </View>
                      {item.isSample ? (
                        <View className="rounded-full border border-[#CFE0F5] bg-[#F4F8FD] px-2 py-0.5">
                          <Text className="text-[10px] font-semibold text-info">Sample</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text className="mt-1 text-xs text-[#5A706B]">
                      {item.measuredDateYmd} · {item.measuredTime12}
                      {convertedVal !== null ? ` · ≈ ${convertedVal} ${preferredUnitLabel}` : ''}
                    </Text>

                    {item.note ? (
                      <Text className="mt-1.5 text-xs leading-[17px] text-main">
                        {item.note}
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Delete reading ${item.displayValue} ${item.unitLabel}`}
                    disabled={deletingId === item.id}
                    onPress={() => setDeleteTarget(item)}
                    className="h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background active:bg-[#FDECEC]"
                  >
                    <Feather
                      name="trash-2"
                      size={15}
                      color={CAREDOSE_EXTENDED_COLORS.error}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Non-Interpretation Notice */}
      <View className="mb-3 rounded-card border border-border bg-white px-3.5 py-3">
        <View className="flex-row items-start gap-2">
          <Feather
            name="shield"
            size={15}
            color={CAREDOSE_EXTENDED_COLORS.secondaryText}
          />
          <Text className="flex-1 text-[11px] leading-[16px] text-[#5A706B]">
            {disclaimer || HEALTH_LOG_NON_INTERPRETATION_DISCLAIMER}
          </Text>
        </View>
      </View>

      <LogReadingModal
        visible={logModalOpen}
        defaultContext={contextFilter !== 'ALL' ? contextFilter : 'FASTING'}
        onClose={() => setLogModalOpen(false)}
        onSaved={(saved) =>
          setToast(`Saved ${saved.displayValue} ${saved.unitLabel} (${saved.contextLabel}).`)
        }
      />

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete health reading?"
        description={
          deleteTarget
            ? `Remove ${deleteTarget.displayValue} ${deleteTarget.unitLabel} (${deleteTarget.contextLabel}) from ${deleteTarget.measuredDateYmd}?`
            : 'Remove this blood glucose entry?'
        }
        confirmLabel="Delete reading"
        destructive
        loading={deleteTarget !== null && deletingId === deleteTarget.id}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScreenContainer>
  );
}
