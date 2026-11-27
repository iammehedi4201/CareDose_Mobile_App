import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import brandLogo from '../../assets/brand-logo.png';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface CareDoseSplashOverlayProps {
  /** True once initial local storage/context hydration has completed. */
  appReady: boolean;
  /** Invoked as soon as the mint overlay has laid out so native splash can hide without flash. */
  onFirstPaint?: () => void;
  /** Optional callback invoked once the splash overlay has faded out and unmounted. */
  onDismissed?: () => void;
}

const MIN_ENTRANCE_MS = 320;
const FAILSAFE_TIMEOUT_MS = 1200;
const FADE_OUT_MS = 240;

export function CareDoseSplashOverlay({
  appReady,
  onFirstPaint,
  onDismissed,
}: CareDoseSplashOverlayProps): React.JSX.Element | null {
  const layout = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const [entranceSettled, setEntranceSettled] = useState(false);
  const [failsafeReady, setFailsafeReady] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const hasReportedPaintRef = useRef(false);
  const hasStartedFadeRef = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const brandOpacity = useRef(new Animated.Value(0.3)).current;
  const brandScale = useRef(new Animated.Value(0.95)).current;

  const useNativeDriver = Platform.OS !== 'web';

  // Run lightweight entrance animation without blocking initialization
  useEffect(() => {
    Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver,
      }),
      Animated.timing(brandScale, {
        toValue: 1,
        duration: 260,
        useNativeDriver,
      }),
    ]).start();

    const minTimer = setTimeout(() => {
      setEntranceSettled(true);
    }, MIN_ENTRANCE_MS);

    const failsafeTimer = setTimeout(() => {
      setFailsafeReady(true);
    }, FAILSAFE_TIMEOUT_MS);

    return () => {
      clearTimeout(minTimer);
      clearTimeout(failsafeTimer);
    };
  }, [brandOpacity, brandScale, useNativeDriver]);

  const canDismiss = (appReady || failsafeReady) && entranceSettled;

  useEffect(() => {
    if (!canDismiss || hasStartedFadeRef.current) {
      return;
    }
    hasStartedFadeRef.current = true;
    setIsDismissing(true);

    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      useNativeDriver,
    }).start(() => {
      setDismissed(true);
      onDismissed?.();
    });
  }, [canDismiss, onDismissed, overlayOpacity, useNativeDriver]);

  if (dismissed) {
    return null;
  }

  const badgeSize = layout.isCompact ? 88 : layout.isTabletOrWide ? 120 : 104;
  const logoSize = layout.isCompact ? 66 : layout.isTabletOrWide ? 90 : 78;
  const titleFontSize = layout.isCompact ? 30 : layout.isTabletOrWide ? 38 : 34;
  const taglineFontSize = layout.isCompact ? 13.5 : layout.isTabletOrWide ? 16 : 15;
  const ambientOrbSize = Math.round(Math.min(layout.width, 460) * 0.78);

  return (
    <Animated.View
      accessible
      accessibilityLabel="CareDose launch screen"
      pointerEvents={isDismissing ? 'none' : 'auto'}
      onLayout={() => {
        if (!hasReportedPaintRef.current) {
          hasReportedPaintRef.current = true;
          onFirstPaint?.();
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 100,
        backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
        opacity: overlayOpacity,
      }}
    >
      {/* Gentle mint-green organic ambient waves matching CareDose Home/Schedule */}
      <View
        accessible={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -Math.round(ambientOrbSize * 0.34),
          right: -Math.round(ambientOrbSize * 0.28),
          width: ambientOrbSize,
          height: ambientOrbSize,
          borderRadius: ambientOrbSize / 2,
          backgroundColor: 'rgba(8, 126, 103, 0.08)',
        }}
      />
      <View
        accessible={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -Math.round(ambientOrbSize * 0.32),
          left: -Math.round(ambientOrbSize * 0.3),
          width: ambientOrbSize,
          height: ambientOrbSize,
          borderRadius: ambientOrbSize / 2,
          backgroundColor: 'rgba(203, 231, 219, 0.52)',
        }}
      />
      <View
        accessible={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: '18%',
          bottom: '18%',
          left: '6%',
          right: '6%',
          borderRadius: 999,
          backgroundColor: 'rgba(255, 255, 255, 0.62)',
        }}
      />

      {/* Safe-area-aware centered brand identity */}
      <View
        className="flex-1 items-center justify-center"
        style={{
          paddingHorizontal: layout.screenPadding,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View
          className="items-center"
          style={{
            opacity: brandOpacity,
            transform: [{ scale: brandScale }],
          }}
        >
          <View
            className="items-center justify-center rounded-[28px] bg-white"
            style={{
              width: badgeSize,
              height: badgeSize,
              borderWidth: 1,
              borderColor: '#CBE7DB',
              shadowColor: '#075D4E',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.14,
              shadowRadius: 22,
              elevation: 6,
            }}
          >
            <Image
              source={brandLogo}
              resizeMode="contain"
              accessibilityLabel="CareDose emblem"
              style={{
                width: logoSize,
                height: logoSize,
              }}
            />
          </View>

          <Text
            accessibilityRole="header"
            accessibilityLabel="CareDose"
            className="mt-5 text-center font-extrabold tracking-[-0.6px]"
            style={{
              fontSize: titleFontSize,
              lineHeight: titleFontSize + 8,
            }}
          >
            <Text style={{ color: CAREDOSE_EXTENDED_COLORS.mainText }}>Care</Text>
            <Text style={{ color: CAREDOSE_EXTENDED_COLORS.primary }}>Dose</Text>
          </Text>

          <View
            accessible={false}
            className="mt-2.5 h-[3px] w-10 rounded-full"
            style={{ backgroundColor: 'rgba(8, 126, 103, 0.28)' }}
          />

          <Text
            className="mt-3 text-center font-medium"
            style={{
              fontSize: taglineFontSize,
              lineHeight: taglineFontSize + 7,
              color: '#46635D',
              maxWidth: 280,
            }}
          >
            Your health, one dose at a time.
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

