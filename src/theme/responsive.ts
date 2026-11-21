import { useWindowDimensions } from 'react-native';

export type ViewportTier = 'compact' | 'standard' | 'large' | 'tablet';

export interface ResponsiveMetrics {
  width: number;
  fontScale: number;
  effectiveWidth: number;
  tier: ViewportTier;
  isCompact: boolean;
  isTabletOrWide: boolean;
  screenPadding: number;
  cardPadding: number;
  gridGap: number;
  stackTwoCol: boolean;
  tabPillPaddingX: number;
  modalHorizontalPadding: number;
  modalMaxWidth: number;
  maxContentWidth?: number;
  useShortWeekdayLabels: boolean;
}

export const VIEWPORT_BREAKPOINTS = {
  compactMax: 359,
  standardMax: 413,
  largeMax: 767,
  tabletMaxContentWidth: 720,
} as const;

export function getResponsiveMetrics(width: number, fontScale = 1): ResponsiveMetrics {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 375;
  const safeFontScale =
    Number.isFinite(fontScale) && fontScale > 0 ? Math.max(1, fontScale) : 1;
  const effectiveWidth = safeWidth / safeFontScale;

  if (effectiveWidth <= VIEWPORT_BREAKPOINTS.compactMax) {
    return {
      width: safeWidth,
      fontScale: safeFontScale,
      effectiveWidth,
      tier: 'compact',
      isCompact: true,
      isTabletOrWide: false,
      screenPadding: 12,
      cardPadding: 12,
      gridGap: 8,
      stackTwoCol: true,
      tabPillPaddingX: 8,
      modalHorizontalPadding: 12,
      modalMaxWidth: 480,
      useShortWeekdayLabels: true,
    };
  }

  if (effectiveWidth <= VIEWPORT_BREAKPOINTS.standardMax) {
    return {
      width: safeWidth,
      fontScale: safeFontScale,
      effectiveWidth,
      tier: 'standard',
      isCompact: false,
      isTabletOrWide: false,
      screenPadding: 16,
      cardPadding: 14,
      gridGap: 10,
      stackTwoCol: false,
      tabPillPaddingX: 12,
      modalHorizontalPadding: 16,
      modalMaxWidth: 480,
      useShortWeekdayLabels: false,
    };
  }

  if (effectiveWidth <= VIEWPORT_BREAKPOINTS.largeMax) {
    return {
      width: safeWidth,
      fontScale: safeFontScale,
      effectiveWidth,
      tier: 'large',
      isCompact: false,
      isTabletOrWide: false,
      screenPadding: 18,
      cardPadding: 16,
      gridGap: 12,
      stackTwoCol: false,
      tabPillPaddingX: 16,
      modalHorizontalPadding: 18,
      modalMaxWidth: 500,
      useShortWeekdayLabels: false,
    };
  }

  return {
    width: safeWidth,
    fontScale: safeFontScale,
    effectiveWidth,
    tier: 'tablet',
    isCompact: false,
    isTabletOrWide: true,
    screenPadding: 24,
    cardPadding: 16,
    gridGap: 14,
    stackTwoCol: false,
    tabPillPaddingX: 18,
    modalHorizontalPadding: 24,
    modalMaxWidth: 540,
    maxContentWidth: VIEWPORT_BREAKPOINTS.tabletMaxContentWidth,
    useShortWeekdayLabels: false,
  };
}

export function useResponsiveLayout(): ResponsiveMetrics {
  const { width, fontScale } = useWindowDimensions();
  return getResponsiveMetrics(width, fontScale);
}
