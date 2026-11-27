import React from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface DoseProgressCardProps {
  takenCount: number;
  totalCount: number;
  upcomingCount?: number;
  overdueCount?: number;
  label?: string;
  variant?: 'compact' | 'tiles';
}

export function DoseProgressCard({
  takenCount,
  totalCount,
  upcomingCount,
  overdueCount,
  label = "Today's progress",
  variant = 'compact',
}: DoseProgressCardProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const safeTotal = Math.max(0, totalCount);
  const safeTaken = Math.min(safeTotal, Math.max(0, takenCount));
  const safeUpcoming = Math.max(0, upcomingCount ?? Math.max(0, safeTotal - safeTaken));
  const safeOverdue = Math.max(0, overdueCount ?? 0);
  const ratio = safeTotal > 0 ? safeTaken / safeTotal : 0;
  const percent = Math.round(ratio * 100);
  const rightDeg = -135 + Math.min(ratio, 0.5) * 360;
  const leftDeg = 45 + Math.max(0, ratio - 0.5) * 360;
  const useTwoByTwoCompactGrid = layout.width < 460;

  const renderCompactMetricTile = (opts: {
    accessibilityLabel: string;
    value: number;
    metricLabel: string;
    bgColor: string;
    borderColor: string;
    valueColor: string;
  }): React.JSX.Element => (
    <View
      key={opts.accessibilityLabel}
      accessibilityLabel={opts.accessibilityLabel}
      className="flex-1 min-w-0 flex-row items-center justify-between gap-2 rounded-field px-3 py-2"
      style={{
        backgroundColor: opts.bgColor,
        borderColor: opts.borderColor,
        borderWidth: 1,
      }}
    >
      <Text
        className="text-[11.5px] font-medium text-[#5A706B] flex-1 min-w-0"
        numberOfLines={1}
      >
        {opts.metricLabel}
      </Text>
      <Text className="text-[14px] font-bold shrink-0" style={{ color: opts.valueColor }}>
        {opts.value}
      </Text>
    </View>
  );

  const totalTile = renderCompactMetricTile({
    accessibilityLabel: `Total scheduled doses ${safeTotal}`,
    value: safeTotal,
    metricLabel: 'Scheduled',
    bgColor: CAREDOSE_EXTENDED_COLORS.background,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    valueColor: CAREDOSE_EXTENDED_COLORS.mainText,
  });

  const takenTile = renderCompactMetricTile({
    accessibilityLabel: `Taken doses ${safeTaken}`,
    value: safeTaken,
    metricLabel: 'Taken',
    bgColor: '#F1F9F5',
    borderColor: '#DCEFE6',
    valueColor: CAREDOSE_EXTENDED_COLORS.success,
  });

  const upcomingTile = renderCompactMetricTile({
    accessibilityLabel: `Upcoming doses ${safeUpcoming}`,
    value: safeUpcoming,
    metricLabel: 'Upcoming',
    bgColor: '#F1F6FC',
    borderColor: '#D4E3F6',
    valueColor: CAREDOSE_EXTENDED_COLORS.info,
  });

  const overdueTile = renderCompactMetricTile({
    accessibilityLabel: `Overdue doses ${safeOverdue}`,
    value: safeOverdue,
    metricLabel: 'Overdue',
    bgColor: safeOverdue > 0 ? '#FDF3F3' : CAREDOSE_EXTENDED_COLORS.background,
    borderColor: safeOverdue > 0 ? '#F7D7D6' : CAREDOSE_EXTENDED_COLORS.border,
    valueColor: safeOverdue > 0 ? CAREDOSE_EXTENDED_COLORS.error : CAREDOSE_EXTENDED_COLORS.secondaryText,
  });

  return (
    <View
      accessibilityLabel={`${label}: ${safeTaken} of ${safeTotal} doses taken`}
      className="mt-3 rounded-card border border-border bg-white px-4 py-3.5 shadow-sm"
    >
      <View className="flex-row items-center">
        {/* Circular progress indicator: Completed (Taken) / Total */}
        <View className="relative h-[54px] w-[54px] shrink-0 items-center justify-center">
          <View
            className="absolute inset-0 rounded-full"
            style={{ borderWidth: 5, borderColor: '#DCEEE7' }}
          />
          {ratio > 0 ? (
            <View className="absolute right-0 top-0 h-[54px] w-[27px] overflow-hidden">
              <View
                className="absolute -left-[27px] top-0 h-[54px] w-[54px] rounded-full border-[5px] border-transparent border-r-primary border-t-primary"
                style={{ transform: [{ rotate: `${rightDeg}deg` }] }}
              />
            </View>
          ) : null}
          {ratio > 0.5 ? (
            <View className="absolute left-0 top-0 h-[54px] w-[27px] overflow-hidden">
              <View
                className="absolute left-0 top-0 h-[54px] w-[54px] rounded-full border-[5px] border-transparent border-r-primary border-t-primary"
                style={{ transform: [{ rotate: `${leftDeg}deg` }] }}
              />
            </View>
          ) : null}
          <Text className="text-[13px] font-semibold text-primary">
            {safeTaken}/{safeTotal}
          </Text>
        </View>

        <View className="mx-3.5 h-10 w-px bg-border" />

        <View className="flex-1 min-w-0">
          <Text className="text-xs font-medium text-[#5A706B]" numberOfLines={1}>
            {label}
          </Text>
          <Text className="mt-0.5 text-[15px] font-semibold text-main" numberOfLines={1}>
            {safeTaken} of {safeTotal} {safeTotal === 1 ? 'dose' : 'doses'} taken
          </Text>
          <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#E3EAE7]">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${percent}%` }}
            />
          </View>
        </View>
      </View>

      {variant === 'tiles' ? (
        <View className="mt-3.5 flex-row flex-wrap gap-1.5">
          <View
            accessibilityLabel={`Total scheduled doses ${safeTotal}`}
            className="flex-1 min-w-[78px] rounded-field border border-[#DCEFE6] bg-[#F1F9F5] px-2.5 py-2"
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={14} color={CAREDOSE_EXTENDED_COLORS.primary} />
              <Text className="text-[15px] font-bold leading-[18px] text-primary">
                {safeTotal}
              </Text>
            </View>
            <Text className="mt-0.5 text-[11px] font-medium text-[#5A706B]" numberOfLines={1}>
              Scheduled
            </Text>
          </View>

          <View
            accessibilityLabel={`Overdue doses ${safeOverdue}`}
            className="flex-1 min-w-[78px] rounded-field border border-[#F7D7D6] bg-[#FDF3F3] px-2.5 py-2"
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="alert-triangle" size={14} color={CAREDOSE_EXTENDED_COLORS.error} />
              <Text className="text-[15px] font-bold leading-[18px] text-error">
                {safeOverdue}
              </Text>
            </View>
            <Text className="mt-0.5 text-[11px] font-medium text-[#5A706B]" numberOfLines={1}>
              Overdue
            </Text>
          </View>

          <View
            accessibilityLabel={`Upcoming doses ${safeUpcoming}`}
            className="flex-1 min-w-[78px] rounded-field border border-[#D4E3F6] bg-[#F1F6FC] px-2.5 py-2"
          >
            <View className="flex-row items-center gap-1.5">
              <Feather name="clock" size={14} color={CAREDOSE_EXTENDED_COLORS.info} />
              <Text className="text-[15px] font-bold leading-[18px] text-info">
                {safeUpcoming}
              </Text>
            </View>
            <Text className="mt-0.5 text-[11px] font-medium text-[#5A706B]" numberOfLines={1}>
              Upcoming
            </Text>
          </View>
        </View>
      ) : (
        <View
          className="mt-3 pt-3 gap-2"
          style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
        >
          {useTwoByTwoCompactGrid ? (
            <>
              <View className="flex-row gap-2">
                {totalTile}
                {takenTile}
              </View>
              <View className="flex-row gap-2">
                {upcomingTile}
                {overdueTile}
              </View>
            </>
          ) : (
            <View className="flex-row gap-2">
              {totalTile}
              {takenTile}
              {upcomingTile}
              {overdueTile}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
