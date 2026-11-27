import React from 'react';
import { Image, ImageSourcePropType, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import type { AppHeaderAction, AppHeaderOverflowAction } from './AppHeader';
import { PrimaryButton } from './Buttons';

export interface ScreenWaveHeaderOptions {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  topBadge?: React.ReactNode;
  imageSource: ImageSourcePropType;
  onBack?: () => void;
  backLabel?: string;
  backButtonStyle?: 'pill' | 'circle';
  titleSize?: 'default' | 'compact';
  titleLines?: number;
  subtitleLines?: number;
  primaryAction?: AppHeaderAction;
  overflowAction?: AppHeaderOverflowAction;
  rightSlot?: React.ReactNode;
  contentMaxWidthPercent?: number;
  overlapRatio?: number;
}

export interface ScreenWaveHeaderResult {
  topBanner: React.JSX.Element;
  topOverlay: React.JSX.Element | null;
  overlapPx: number;
}

/**
 * Shared 2:1 edge-to-edge mint wave banner with status-bar guard overlay and smooth
 * background feather fade matching CareDose Home and Schedule screens.
 */
export function 
useScreenWaveHeader({
  title,
  subtitle,
  eyebrow,
  topBadge,
  imageSource,
  onBack,
  backLabel = 'Back',
  backButtonStyle = 'pill',
  titleSize = 'default',
  titleLines = 2,
  subtitleLines = 2,
  primaryAction,
  overflowAction,
  rightSlot,
  contentMaxWidthPercent,
  overlapRatio,
}: ScreenWaveHeaderOptions): ScreenWaveHeaderResult {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const hasBack = typeof onBack === 'function';
  const isWideViewport = layout.width > 500;
  const baseArtWidth = isWideViewport
    ? layout.width
    : Math.round(layout.width * (layout.isCompact ? 1.1 : 1.14));
  const baseArtHeight = isWideViewport
    ? Math.min(340, Math.max(240, Math.round(layout.width * 0.4)))
    : Math.round(baseArtWidth * 0.5);
  const topInset = Math.max(0, insets.top);
  const headerArtTop = topInset > 0 ? 0 : -Math.round(baseArtHeight * 0.14);

  const minBelowInset = hasBack
    ? topBadge
      ? layout.isCompact
        ? 188
        : 204
      : layout.isCompact
        ? 166
        : 180
    : layout.isCompact
      ? 140
      : 162;

  const minArtHeightForInset =
    topInset > 0
      ? Math.max(topInset + minBelowInset, Math.round(topInset / 0.21))
      : baseArtHeight;

  const headerArtHeight = Math.max(baseArtHeight, minArtHeightForInset);
  const headerArtWidth = isWideViewport
    ? layout.width
    : Math.max(baseArtWidth, Math.round(headerArtHeight * 2));
  const extraTopBreathing = !hasBack && !subtitle && !eyebrow ? (layout.isCompact ? 8 : 10) : 0;
  const headerTopPadding = topInset + (layout.isCompact ? 10 : 12) + extraTopBreathing;

  const minContentHeight = hasBack ? (topBadge ? 168 : 142) : 104;
  const headerHeight = Math.max(
    headerTopPadding + minContentHeight,
    headerArtHeight + headerArtTop,
  );
  const overlapFactor = overlapRatio ?? (hasBack ? 0.17 : 0.31);
  const overlapPx = Math.round(Math.max(120, headerHeight - topInset) * overlapFactor);
  // Confine the bottom surface feather within the card-overlap zone so right-side
  // artwork sitting above the card stays crisp and never washes out.
  const bottomFadeHeight = overlapPx > 0 ? Math.max(16, Math.min(32, overlapPx)) : 18;
  const bottomFadeSteps = [
    { height: bottomFadeHeight, alpha: 0.2 },
    { height: Math.round(bottomFadeHeight * 0.68), alpha: 0.42 },
    { height: Math.round(bottomFadeHeight * 0.38), alpha: 0.68 },
    { height: Math.max(5, Math.round(bottomFadeHeight * 0.18)), alpha: 0.92 },
  ];

  const topOverlay =
    topInset > 0 ? (
      <View
        accessible={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex: 20,
          overflow: 'hidden',
          backgroundColor: '#DFF6EC',
          height: topInset,
        }}
      >
        <Image
          source={imageSource}
          resizeMode="cover"
          accessible={false}
          style={{
            position: 'absolute',
            top: headerArtTop,
            right: 0,
            width: headerArtWidth,
            height: headerArtHeight,
          }}
        />
      </View>
    ) : null;

  const actionControls =
    primaryAction || overflowAction || rightSlot ? (
      <View className="shrink-0 flex-row items-center gap-2">
        {rightSlot}
        {primaryAction ? (
          <PrimaryButton
            compact
            pill={primaryAction.pill ?? true}
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
            leftIcon={
              primaryAction.iconName ? (
                <Feather name={primaryAction.iconName} size={14} color="#FFFFFF" />
              ) : undefined
            }
            style={{
              shadowColor: '#075D4E',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.16,
              shadowRadius: 6,
              elevation: 3,
            }}
          />
        ) : null}
        {overflowAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={overflowAction.accessibilityLabel ?? 'More options'}
            hitSlop={6}
            onPress={overflowAction.onPress}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-mint"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.94)',
              borderWidth: 1,
              borderColor: '#C5E8D8',
            }}
          >
            <Feather
              name={overflowAction.iconName ?? 'more-vertical'}
              size={18}
              color={CAREDOSE_EXTENDED_COLORS.mainText}
            />
          </Pressable>
        ) : null}
      </View>
    ) : null;

  const textWidthPercent = contentMaxWidthPercent ?? (layout.isCompact ? 55 : 57);
  const titleFontSize =
    titleSize === 'compact'
      ? layout.isCompact
        ? 20
        : 22
      : hasBack
        ? layout.isCompact
          ? 22
          : 24
        : layout.isCompact
          ? 25
          : 28;
  const titleLineHeight =
    titleSize === 'compact'
      ? layout.isCompact
        ? 25
        : 28
      : hasBack
        ? layout.isCompact
          ? 27
          : 30
        : layout.isCompact
          ? 30
          : 34;

  const topBanner = (
    <View
      className="relative w-full overflow-hidden"
      style={{
        height: headerHeight,
        paddingTop: headerTopPadding,
        backgroundColor: '#DFF6EC',
      }}
    >
      <Image
        source={imageSource}
        resizeMode="cover"
        accessible={false}
        style={{
          position: 'absolute',
          top: headerArtTop,
          right: 0,
          width: headerArtWidth,
          height: headerArtHeight,
        }}
      />
      {/* Feathered multi-step fade into #F7FAF8 surface confined to bottom overlap margin */}
      {bottomFadeSteps.map((step) => (
        <View
          key={step.alpha}
          accessible={false}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: step.height,
            backgroundColor: `rgba(247, 250, 248, ${step.alpha})`,
          }}
        />
      ))}

      <View
        className="w-full"
        style={[
          { paddingHorizontal: layout.screenPadding },
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : undefined,
        ]}
      >
        {hasBack ? (
          <View className="flex-row items-center justify-between gap-2">
            {backButtonStyle === 'circle' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={6}
                onPress={onBack}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-mint"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.94)',
                  borderWidth: 1,
                  borderColor: '#C5E8D8',
                  shadowColor: '#075D4E',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Feather name="arrow-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={6}
                onPress={onBack}
                className="flex-row items-center self-start rounded-full px-3 py-1.5 active:bg-mint"
                style={{
                  minHeight: 36,
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  borderWidth: 1,
                  borderColor: '#C5E8D8',
                }}
              >
                <Feather name="arrow-left" size={16} color={CAREDOSE_EXTENDED_COLORS.mainText} />
                <Text className="ml-1.5 text-[12.5px] font-semibold text-main">{backLabel}</Text>
              </Pressable>
            )}

            {actionControls}
          </View>
        ) : null}

        <View
          className={`flex-row items-start justify-between gap-2 ${hasBack ? 'mt-2.5' : ''}`}
        >
          <View className="min-w-0 flex-1 pr-2" style={{ maxWidth: `${textWidthPercent}%` }}>
            {topBadge ? <View className="mb-1.5 self-start">{topBadge}</View> : null}
            {eyebrow ? (
              <Text
                className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.7px] text-primary"
                numberOfLines={1}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text
              className="font-bold text-main"
              style={{
                fontSize: titleFontSize,
                lineHeight: titleLineHeight,
              }}
              numberOfLines={titleLines}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                className="mt-0.5 text-xs leading-[17px] text-[#5A706B]"
                numberOfLines={subtitleLines}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {!hasBack ? actionControls : null}
        </View>
      </View>
    </View>
  );

  return {
    topBanner,
    topOverlay,
    overlapPx,
  };
}
