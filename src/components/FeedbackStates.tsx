import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryButton, SecondaryButton } from './Buttons';

export type LoadingSkeletonVariant =
  | 'list'
  | 'explore_results'
  | 'brand_details'
  | 'generic_details'
  | 'alternatives_groups'
  | 'schedule_timeline'
  | 'manage_schedules'
  | 'health_log'
  | 'dose_history'
  | 'generic_list';

export interface LoadingSkeletonProps {
  rows?: number;
  variant?: LoadingSkeletonVariant;
}

function useSkeletonPulse(): Animated.Value {
  const pulse = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    if (
      typeof Animated?.loop !== 'function' ||
      typeof Animated?.sequence !== 'function' ||
      typeof Animated?.timing !== 'function'
    ) {
      return;
    }

    pulse.setValue(0.55);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return pulse;
}

function SkeletonBlock({
  pulse,
  className = '',
  style,
  children,
}: {
  pulse: Animated.Value;
  className?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <Animated.View
      className={className}
      style={[{ opacity: pulse }, style]}
    >
      {children}
    </Animated.View>
  );
}

function MedicineResultSkeletonCard({
  padding,
  pulse,
}: {
  padding: number;
  pulse: Animated.Value;
}): React.JSX.Element {
  return (
    <View
      className="rounded-card bg-white shadow-sm"
      style={{
        padding,
        borderWidth: 1,
        borderColor: CAREDOSE_EXTENDED_COLORS.border,
      }}
    >
      <View className="flex-1 min-w-0">
        {/* Row 1: Brand name & primary price */}
        <View className="flex-row items-center justify-between gap-2">
          <SkeletonBlock pulse={pulse} className="h-4 w-[52%] rounded-md bg-[#E0EAE4]" />
          <SkeletonBlock pulse={pulse} className="h-3.5 w-[22%] rounded-md bg-[#D5ECE1]" />
        </View>

        {/* Row 2: Generic name & unit context */}
        <View className="mt-1.5 flex-row items-center justify-between gap-2">
          <SkeletonBlock pulse={pulse} className="h-3 w-[44%] rounded bg-[#EAF1ED]" />
          <SkeletonBlock pulse={pulse} className="h-2.5 w-[16%] rounded bg-[#F0F4F2]" />
        </View>

        {/* Row 3: Strength / badge pills matching MedicineCard highlightVariants */}
        <View className="mt-2 flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-1.5">
            <SkeletonBlock pulse={pulse} className="h-5 w-[64px] rounded-full bg-[#DFF1E8]" />
            <SkeletonBlock pulse={pulse} className="h-5 w-[56px] rounded-full bg-[#EDF3FB]" />
          </View>
          <SkeletonBlock pulse={pulse} className="h-5 w-[62px] rounded-full bg-[#EFF3F1]" />
        </View>

        {/* Row 4: Manufacturer & pack summary */}
        <View className="mt-2 flex-row items-center justify-between gap-2">
          <SkeletonBlock pulse={pulse} className="h-2.5 w-[48%] rounded bg-[#EFF3F1]" />
          <SkeletonBlock pulse={pulse} className="h-2.5 w-[24%] rounded bg-[#E8F0EC]" />
        </View>
      </View>
    </View>
  );
}

export function LoadingSkeleton({
  rows = 3,
  variant = 'list',
}: LoadingSkeletonProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const pulse = useSkeletonPulse();

  if (variant === 'explore_results') {
    return (
      <View accessibilityLabel="Loading medicines" className="gap-2.5">
        {Array.from({ length: rows }).map((_, idx) => (
          <MedicineResultSkeletonCard
            key={idx}
            padding={layout.cardPadding}
            pulse={pulse}
          />
        ))}
      </View>
    );
  }

  if (variant === 'brand_details') {
    return (
      <View accessibilityLabel="Loading medicine details" className="gap-3.5">
        {/* Identity & Action Card matching explore/brand/[id]/index.tsx */}
        <View
          className="rounded-card bg-white shadow-sm"
          style={{
            padding: layout.cardPadding + 4,
            borderWidth: 1,
            borderColor: '#CBE7DB',
          }}
        >
          <View className="min-w-0">
            <SkeletonBlock pulse={pulse} className="h-[20px] w-[58%] rounded-md bg-[#E0EAE4]" />
            <SkeletonBlock pulse={pulse} className="mt-1.5 h-3.5 w-[38%] rounded bg-[#D5ECE1]" />
            <View className="mt-2 flex-row flex-wrap gap-1.5">
              <SkeletonBlock pulse={pulse} className="h-5 w-[68px] rounded-full bg-[#DFF1E8]" />
              <SkeletonBlock pulse={pulse} className="h-5 w-[76px] rounded-full bg-[#EBF2FB]" />
            </View>
          </View>
          <View
            className="mt-3 gap-2 pt-2.5"
            style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
          >
            <View className="flex-row items-center justify-between gap-3">
              <SkeletonBlock pulse={pulse} className="h-3 w-[26%] rounded bg-[#EFF3F1]" />
              <SkeletonBlock pulse={pulse} className="h-3 w-[44%] rounded bg-[#E4ECE7]" />
            </View>
            <View className="flex-row items-center justify-between gap-3">
              <SkeletonBlock pulse={pulse} className="h-3 w-[32%] rounded bg-[#EFF3F1]" />
              <SkeletonBlock pulse={pulse} className="h-3 w-[38%] rounded bg-[#E4ECE7]" />
            </View>
          </View>
          <SkeletonBlock pulse={pulse} className="mt-3.5 h-[44px] w-full rounded-field bg-[#D6ECE1]" />
        </View>

        {/* Pack & Pricing Card */}
        <View
          className="rounded-card bg-white shadow-sm"
          style={{
            padding: layout.cardPadding + 4,
            borderWidth: 1,
            borderColor: CAREDOSE_EXTENDED_COLORS.border,
          }}
        >
          <View className="mb-2.5 flex-row items-center gap-2">
            <SkeletonBlock pulse={pulse} className="h-4 w-[108px] rounded-md bg-[#E0EAE4]" />
            <SkeletonBlock pulse={pulse} className="h-[18px] w-[60px] rounded-full bg-[#DFF1E8]" />
          </View>
          <View className="mb-3 flex-row flex-wrap gap-2">
            <View
              className="min-w-[104px] rounded-[10px] px-3 py-2"
              style={{
                backgroundColor: '#EDF7F2',
                borderWidth: 1,
                borderColor: '#CBE7DB',
              }}
            >
              <SkeletonBlock pulse={pulse} className="h-3 w-[68px] rounded bg-[#D4ECE0]" />
              <SkeletonBlock pulse={pulse} className="mt-1.5 h-2.5 w-[52px] rounded bg-[#DDF0E6]" />
            </View>
            <View
              className="min-w-[104px] rounded-[10px] px-3 py-2"
              style={{
                backgroundColor: '#F7FAF8',
                borderWidth: 1,
                borderColor: CAREDOSE_EXTENDED_COLORS.border,
              }}
            >
              <SkeletonBlock pulse={pulse} className="h-3 w-[72px] rounded bg-[#E4ECE7]" />
              <SkeletonBlock pulse={pulse} className="mt-1.5 h-2.5 w-[54px] rounded bg-[#EDF2EF]" />
            </View>
          </View>
          <View
            className="rounded-field bg-[#F6F9F7] p-3"
            style={{
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View
              className={layout.stackTwoCol ? 'flex-col' : 'flex-row items-center justify-between'}
              style={{ gap: 10 }}
            >
              <View className="flex-1 min-w-0 gap-1.5">
                <SkeletonBlock pulse={pulse} className="h-2.5 w-[52px] rounded bg-[#EAEFEE]" />
                <SkeletonBlock pulse={pulse} className="h-4 w-[84px] rounded bg-[#D5ECE1]" />
              </View>
              <View className="flex-1 min-w-0 gap-1.5">
                <SkeletonBlock pulse={pulse} className="h-2.5 w-[52px] rounded bg-[#EAEFEE]" />
                <SkeletonBlock pulse={pulse} className="h-4 w-[70px] rounded bg-[#E1EAE5]" />
              </View>
            </View>
            <View
              className="mt-2.5 gap-2 pt-2"
              style={{ borderTopWidth: 1, borderTopColor: '#E4ECE7' }}
            >
              <View className="flex-row justify-between">
                <SkeletonBlock pulse={pulse} className="h-3 w-[24%] rounded bg-[#EFF3F1]" />
                <SkeletonBlock pulse={pulse} className="h-3 w-[34%] rounded bg-[#E4ECE7]" />
              </View>
              <View className="flex-row justify-between">
                <SkeletonBlock pulse={pulse} className="h-3 w-[30%] rounded bg-[#EFF3F1]" />
                <SkeletonBlock pulse={pulse} className="h-3 w-[40%] rounded bg-[#E4ECE7]" />
              </View>
            </View>
          </View>
        </View>

        {/* Alternative Brands Section */}
        <View className="flex-row items-center justify-between">
          <SkeletonBlock pulse={pulse} className="h-4 w-[144px] rounded-md bg-[#E0EAE4]" />
          <SkeletonBlock pulse={pulse} className="h-3.5 w-[48px] rounded bg-[#D5ECE1]" />
        </View>
        <MedicineResultSkeletonCard padding={layout.cardPadding} pulse={pulse} />
        <MedicineResultSkeletonCard padding={layout.cardPadding} pulse={pulse} />
      </View>
    );
  }

  if (variant === 'generic_details') {
    return (
      <View accessibilityLabel="Loading generic brands" className="gap-3">
        <View
          className="flex-row items-center rounded-card bg-mint shadow-sm"
          style={{
            padding: layout.cardPadding + 2,
            borderWidth: 1,
            borderColor: '#C5E8D8',
          }}
        >
          <SkeletonBlock pulse={pulse} className="mr-3 h-[38px] w-[38px] shrink-0 rounded-full bg-white" />
          <View className="flex-1 min-w-0 gap-2">
            <SkeletonBlock pulse={pulse} className="h-4 w-[48%] rounded-md bg-[#D1EAD9]" />
            <SkeletonBlock pulse={pulse} className="h-3 w-[68%] rounded bg-[#DFEFE7]" />
          </View>
        </View>
        <View className="flex-row justify-between">
          <SkeletonBlock pulse={pulse} className="h-4 w-[132px] rounded-md bg-[#E0EAE4]" />
          <SkeletonBlock pulse={pulse} className="h-3.5 w-[64px] rounded bg-[#EFF3F1]" />
        </View>
        {Array.from({ length: rows }).map((_, idx) => (
          <MedicineResultSkeletonCard key={idx} padding={layout.cardPadding} pulse={pulse} />
        ))}
      </View>
    );
  }

  if (variant === 'alternatives_groups') {
    return (
      <View accessibilityLabel="Loading alternative groups" className="gap-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <View
            key={idx}
            className="rounded-card bg-white shadow-sm"
            style={{
              padding: layout.cardPadding + 2,
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View
              className="flex-row items-center justify-between gap-2 pb-2.5"
              style={{ borderBottomWidth: 1, borderBottomColor: CAREDOSE_EXTENDED_COLORS.border }}
            >
              <View className="flex-row flex-1 min-w-0 items-center gap-2.5">
                <SkeletonBlock
                  pulse={pulse}
                  className="h-8 w-8 shrink-0 rounded-full bg-[#E5F2EB]"
                />
                <View className="flex-1 min-w-0 gap-1.5">
                  <SkeletonBlock pulse={pulse} className="h-4 w-[52%] rounded-md bg-[#E0EAE4]" />
                  <SkeletonBlock pulse={pulse} className="h-3 w-[40%] rounded bg-[#EFF3F1]" />
                </View>
              </View>
              <SkeletonBlock pulse={pulse} className="h-5 w-[88px] rounded-full bg-[#EFF3F1]" />
            </View>
            {[0, 1].map((row) => (
              <View
                key={row}
                className={`flex-row items-center justify-between py-2.5 ${
                  row === 1 ? 'pb-0.5' : ''
                }`}
                style={
                  row === 0
                    ? { borderBottomWidth: 1, borderBottomColor: CAREDOSE_EXTENDED_COLORS.border }
                    : undefined
                }
              >
                <View className="flex-1 min-w-0 gap-1.5">
                  <SkeletonBlock pulse={pulse} className="h-3.5 w-[44%] rounded bg-[#E4ECE7]" />
                  <SkeletonBlock pulse={pulse} className="h-2.5 w-[56%] rounded bg-[#EFF3F1]" />
                </View>
                <SkeletonBlock pulse={pulse} className="h-3.5 w-[60px] rounded bg-[#D5ECE1]" />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'schedule_timeline') {
    const useTwoByTwo = layout.width < 460;
    const renderProgressTileSkeleton = (bg: string, pill: string, labelW: string) => (
      <View
        className="flex-1 min-w-0 flex-row items-center justify-between gap-2 rounded-field px-3 py-2"
        style={{ backgroundColor: bg }}
      >
        <SkeletonBlock pulse={pulse} className={`h-2.5 ${labelW} rounded bg-[#E2EAE6]`} />
        <SkeletonBlock pulse={pulse} className={`h-3.5 w-4 rounded ${pill}`} />
      </View>
    );

    return (
      <View accessibilityLabel="Loading schedule timeline" className="gap-3">
        {/* Progress Card matching DoseProgressCard */}
        <View
          className="rounded-card bg-white px-4 py-3.5 shadow-sm"
          style={{
            borderWidth: 1,
            borderColor: CAREDOSE_EXTENDED_COLORS.border,
          }}
        >
          <View className="flex-row items-center">
            <View
              className="h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#E3F1EA' }}
            >
              <View className="h-[44px] w-[44px] items-center justify-center rounded-full bg-white">
                <SkeletonBlock pulse={pulse} className="h-3 w-6 rounded bg-[#D5ECE1]" />
              </View>
            </View>

            <View
              className="mx-3.5 h-10 w-px"
              style={{ backgroundColor: CAREDOSE_EXTENDED_COLORS.border }}
            />

            <View className="flex-1 min-w-0">
              <SkeletonBlock pulse={pulse} className="h-2.5 w-[40%] rounded bg-[#EFF3F1]" />
              <SkeletonBlock pulse={pulse} className="mt-1.5 h-4 w-[66%] rounded bg-[#E0EAE4]" />
              <SkeletonBlock pulse={pulse} className="mt-2 h-2 w-full rounded-full bg-[#E3EAE7]" />
            </View>
          </View>

          <View
            className="mt-3 gap-2 pt-3"
            style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
          >
            {useTwoByTwo ? (
              <>
                <View className="flex-row gap-2">
                  {renderProgressTileSkeleton('#F4F7F5', 'bg-[#E1EAE5]', 'w-[58%]')}
                  {renderProgressTileSkeleton('#F1F9F5', 'bg-[#D5ECE1]', 'w-[44%]')}
                </View>
                <View className="flex-row gap-2">
                  {renderProgressTileSkeleton('#F1F6FC', 'bg-[#D6E4F7]', 'w-[56%]')}
                  {renderProgressTileSkeleton('#F4F7F5', 'bg-[#E1EAE5]', 'w-[50%]')}
                </View>
              </>
            ) : (
              <View className="flex-row gap-2">
                {renderProgressTileSkeleton('#F4F7F5', 'bg-[#E1EAE5]', 'w-[54%]')}
                {renderProgressTileSkeleton('#F1F9F5', 'bg-[#D5ECE1]', 'w-[44%]')}
                {renderProgressTileSkeleton('#F1F6FC', 'bg-[#D6E4F7]', 'w-[52%]')}
                {renderProgressTileSkeleton('#F4F7F5', 'bg-[#E1EAE5]', 'w-[48%]')}
              </View>
            )}
          </View>
        </View>

        {/* Period SectionHeader matching schedule.tsx */}
        <View
          className="mt-0.5 flex-row items-center justify-between rounded-card px-3.5 py-2.5"
          style={{
            backgroundColor: '#EAF7F0',
            borderWidth: 1,
            borderColor: '#CBE7DB',
          }}
        >
          <View className="flex-row items-center gap-2.5">
            <SkeletonBlock pulse={pulse} className="h-[34px] w-[34px] rounded-full bg-[#D2EADF]" />
            <View className="gap-1.5">
              <SkeletonBlock pulse={pulse} className="h-3.5 w-[82px] rounded bg-[#CBE5D9]" />
              <SkeletonBlock pulse={pulse} className="h-2.5 w-[124px] rounded bg-[#DCF0E6]" />
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <SkeletonBlock pulse={pulse} className="h-5 w-[72px] rounded-full bg-white" />
            <SkeletonBlock pulse={pulse} className="h-6 w-6 rounded-full bg-white" />
          </View>
        </View>

        {/* Dose Cards matching DoseCard */}
        {Array.from({ length: Math.min(rows, 2) }).map((_, idx) => (
          <View
            key={idx}
            className="rounded-card bg-white shadow-sm"
            style={{
              padding: layout.cardPadding,
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View className="flex-row items-start">
              <SkeletonBlock
                pulse={pulse}
                className="mt-0.5 mr-3 h-[34px] w-[34px] shrink-0 rounded-full bg-[#E6F4ED]"
              />
              <View className="flex-1 min-w-0">
                <View className="flex-row items-start justify-between gap-2">
                  <SkeletonBlock pulse={pulse} className="h-4 w-[58%] rounded bg-[#E0EAE4]" />
                  <SkeletonBlock pulse={pulse} className="h-5 w-[70px] rounded-full bg-[#EEF4FB]" />
                </View>
                <SkeletonBlock pulse={pulse} className="mt-1.5 h-3.5 w-[44%] rounded bg-[#EBF1EE]" />
                <View className="mt-1.5 flex-row items-center gap-1.5">
                  <SkeletonBlock pulse={pulse} className="h-3 w-3 rounded-full bg-[#D5ECE1]" />
                  <SkeletonBlock pulse={pulse} className="h-3 w-[26%] rounded bg-[#D5ECE1]" />
                </View>
              </View>
            </View>
            <View
              className="mt-3 pt-2.5"
              style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
            >
              <SkeletonBlock pulse={pulse} className="h-[44px] w-full rounded-field bg-[#D6ECE1]" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'manage_schedules') {
    return (
      <View accessibilityLabel="Loading saved schedules" className="gap-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <View
            key={idx}
            className="rounded-card bg-white shadow-sm"
            style={{
              padding: layout.cardPadding,
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View className="flex-row items-start justify-between gap-2.5">
              <View className="flex-row flex-1 min-w-0 items-start gap-2.5">
                <SkeletonBlock pulse={pulse} className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#E5F2EB]" />
                <View className="flex-1 min-w-0 gap-1.5">
                  <SkeletonBlock pulse={pulse} className="h-4 w-[54%] rounded bg-[#E0EAE4]" />
                  <SkeletonBlock pulse={pulse} className="h-3 w-[38%] rounded bg-[#EFF3F1]" />
                </View>
              </View>
              <SkeletonBlock pulse={pulse} className="h-5 w-[58px] rounded-full bg-[#DFF1E8]" />
            </View>

            <View
              className="mt-3 gap-2 pt-2.5"
              style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
            >
              <SkeletonBlock pulse={pulse} className="h-3 w-[64%] rounded bg-[#E6ECE9]" />
              <View className="flex-row gap-1.5">
                <SkeletonBlock pulse={pulse} className="h-[22px] w-[72px] rounded-full bg-[#E5F2EB]" />
                <SkeletonBlock pulse={pulse} className="h-[22px] w-[72px] rounded-full bg-[#E5F2EB]" />
              </View>
              <SkeletonBlock pulse={pulse} className="h-3 w-[50%] rounded bg-[#EFF3F1]" />
              <SkeletonBlock pulse={pulse} className="h-3 w-[44%] rounded bg-[#E3F1EA]" />
            </View>

            <View
              className={`mt-3 gap-2 pt-2.5 ${layout.stackTwoCol ? 'flex-col' : 'flex-row'}`}
              style={{ borderTopWidth: 1, borderTopColor: CAREDOSE_EXTENDED_COLORS.border }}
            >
              <SkeletonBlock
                pulse={pulse}
                className={`h-[40px] rounded-field bg-[#F3F7F5] ${layout.stackTwoCol ? 'w-full' : 'flex-1'}`}
              />
              <SkeletonBlock
                pulse={pulse}
                className={`h-[40px] rounded-field bg-[#F3F7F5] ${layout.stackTwoCol ? 'w-full' : 'flex-1'}`}
              />
              <SkeletonBlock
                pulse={pulse}
                className={`h-[40px] rounded-field bg-[#F9EFEF] ${layout.stackTwoCol ? 'w-full' : 'flex-1'}`}
              />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'health_log') {
    return (
      <View accessibilityLabel="Loading health logs" className="gap-2.5">
        {Array.from({ length: rows }).map((_, idx) => (
          <View
            key={idx}
            className="flex-row items-start justify-between rounded-card bg-white p-3.5 shadow-sm"
            style={{
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View className="flex-row flex-1 min-w-0 items-start gap-2.5">
              <SkeletonBlock pulse={pulse} className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#E5F2EB]" />
              <View className="flex-1 min-w-0 gap-1.5">
                <View className="flex-row items-center gap-2">
                  <SkeletonBlock pulse={pulse} className="h-[18px] w-[88px] rounded bg-[#E0EAE4]" />
                  <SkeletonBlock pulse={pulse} className="h-5 w-[66px] rounded-full bg-[#DFF1E8]" />
                </View>
                <SkeletonBlock pulse={pulse} className="h-3 w-[56%] rounded bg-[#EFF3F1]" />
                <SkeletonBlock pulse={pulse} className="h-3 w-[40%] rounded bg-[#F3F6F4]" />
              </View>
            </View>
            <SkeletonBlock pulse={pulse} className="h-9 w-9 shrink-0 rounded-full bg-[#F4F7F5]" />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'dose_history') {
    return (
      <View accessibilityLabel="Loading dose history" className="gap-2.5">
        {Array.from({ length: rows }).map((_, idx) => (
          <View
            key={idx}
            className="flex-row items-start justify-between gap-2.5 rounded-card bg-white p-3.5 shadow-sm"
            style={{
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View className="flex-row flex-1 min-w-0 items-start gap-2.5">
              <SkeletonBlock pulse={pulse} className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-[#E5F2EB]" />
              <View className="flex-1 min-w-0 gap-1.5">
                <SkeletonBlock pulse={pulse} className="h-4 w-[54%] rounded bg-[#E0EAE4]" />
                <SkeletonBlock pulse={pulse} className="h-3 w-[70%] rounded bg-[#EFF3F1]" />
                <SkeletonBlock pulse={pulse} className="h-2.5 w-[36%] rounded bg-[#E3F1EA]" />
              </View>
            </View>
            <SkeletonBlock pulse={pulse} className="h-5 w-[60px] rounded-full bg-[#DFF1E8]" />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'generic_list') {
    return (
      <View accessibilityLabel="Loading generic list" className="gap-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <View
            key={idx}
            className="flex-row items-center justify-between rounded-field bg-background px-3 py-2.5"
            style={{
              borderWidth: 1,
              borderColor: CAREDOSE_EXTENDED_COLORS.border,
            }}
          >
            <View className="flex-1 min-w-0 gap-1.5">
              <SkeletonBlock pulse={pulse} className="h-3.5 w-[50%] rounded bg-[#E0EAE4]" />
              <SkeletonBlock pulse={pulse} className="h-3 w-[28%] rounded bg-[#EFF3F1]" />
            </View>
            <SkeletonBlock pulse={pulse} className="h-4 w-4 rounded bg-[#E4ECE7]" />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View accessibilityLabel="Loading content" className="gap-2.5">
      {Array.from({ length: rows }).map((_, idx) => (
        <View
          key={idx}
          className="flex-row items-center rounded-card bg-white"
          style={{
            padding: layout.cardPadding,
            borderWidth: 1,
            borderColor: CAREDOSE_EXTENDED_COLORS.border,
          }}
        >
          <SkeletonBlock pulse={pulse} className="mr-3 h-[38px] w-[38px] shrink-0 rounded-full bg-[#EFF3F1]" />
          <View className="flex-1 min-w-0 gap-2">
            <SkeletonBlock pulse={pulse} className="h-3 w-[68%] rounded-md bg-[#E6ECE9]" />
            <SkeletonBlock pulse={pulse} className="h-2.5 w-[45%] rounded-[5px] bg-[#EFF3F1]" />
          </View>
        </View>
      ))}
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconName?: keyof typeof Feather.glyphMap;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  iconName = 'inbox',
}: EmptyStateProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View
      className="my-2 items-center rounded-card border border-border bg-white"
      style={{ padding: layout.isCompact ? 16 : 20 }}
    >
      <View className="mb-2.5 h-11 w-11 items-center justify-center rounded-full bg-mint">
        <Feather name={iconName} size={22} color={CAREDOSE_EXTENDED_COLORS.primary} />
      </View>
      <Text className="text-center text-[15px] font-bold text-main">{title}</Text>
      <Text className="mt-1 text-center text-xs leading-[18px] text-[#5A706B]">{description}</Text>
      {actionLabel && onAction ? (
        <View className="mt-3 max-w-full">
          <PrimaryButton compact label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Unable to load records',
  message,
  onRetry,
}: ErrorStateProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View
      className="my-2 items-center rounded-card bg-[#FDECEC]"
      style={{
        padding: layout.isCompact ? 16 : 20,
        borderWidth: 1,
        borderColor: '#F3C1BE',
      }}
    >
      <Feather name="alert-triangle" size={22} color={CAREDOSE_EXTENDED_COLORS.error} />
      <Text className="text-center text-[15px] font-bold text-error">{title}</Text>
      <Text className="mt-1 text-center text-xs leading-[18px] text-[#5A706B]">{message}</Text>
      {onRetry ? (
        <View className="mt-3 max-w-full">
          <SecondaryButton compact label="Retry" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export interface SuccessToastProps {
  message: string | null;
  toastKey?: string | number;
  onDismiss?: () => void;
  durationMs?: number;
  floating?: boolean;
}

export function SuccessToast({
  message,
  toastKey,
  onDismiss,
  durationMs = 4000,
  floating = false,
}: SuccessToastProps): React.JSX.Element | null {
  useEffect(() => {
    if (!message || !onDismiss || durationMs <= 0) {
      return;
    }
    const timer = setTimeout(() => {
      onDismiss();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, message, onDismiss, toastKey]);

  if (!message) {
    return null;
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`${floating ? '' : 'mb-3 '}flex-row items-center gap-2.5 rounded-card px-3.5 py-3`}
      style={{
        backgroundColor: CAREDOSE_EXTENDED_COLORS.success,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.24)',
        shadowColor: '#064E3D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 10,
      }}
    >
      <View
        className="h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.18)' }}
      >
        <Feather name="check-circle" size={15} color="#FFFFFF" />
      </View>
      <Text className="flex-1 min-w-0 text-[12.5px] font-semibold leading-[17px] text-white">
        {message}
      </Text>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          hitSlop={8}
          onPress={onDismiss}
          className="h-7 w-7 shrink-0 items-center justify-center rounded-full active:opacity-75"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.14)' }}
        >
          <Feather name="x" size={14} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function DemoModeBanner(): React.JSX.Element {
  return (
    <View
      className="mb-3 flex-row items-center gap-2 rounded-field bg-[#FDF5E6] px-3 py-2"
      style={{ borderWidth: 1, borderColor: '#F3D9A4' }}
    >
      <Feather name="info" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
      <Text className="flex-1 min-w-0 text-[11px] font-semibold text-warning">
        Demo preview data — fictional sample records, not clinical advice.
      </Text>
    </View>
  );
}
