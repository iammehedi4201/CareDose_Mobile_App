import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryButton, SecondaryButton } from './Buttons';

export interface LoadingSkeletonProps {
  rows?: number;
}

export function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View accessibilityLabel="Loading content" className="gap-2.5">
      {Array.from({ length: rows }).map((_, idx) => (
        <View
          key={idx}
          className="flex-row items-center rounded-card border border-border bg-white"
          style={{ padding: layout.cardPadding }}
        >
          <View className="mr-3 h-[38px] w-[38px] shrink-0 rounded-full bg-[#EEF2F0]" />
          <View className="flex-1 min-w-0 gap-2">
            <View className="h-3 w-[68%] rounded-md bg-[#EEF2F0]" />
            <View className="h-2.5 w-[45%] rounded-[5px] bg-[#EEF2F0]" />
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
      className="my-2 items-center rounded-card border border-[#F3C1BE] bg-[#FDECEC]"
      style={{ padding: layout.isCompact ? 16 : 20 }}
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
    <View className="mb-3 flex-row items-center gap-2 rounded-field border border-[#F3D9A4] bg-[#FDF5E6] px-3 py-2">
      <Feather name="info" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
      <Text className="flex-1 min-w-0 text-[11px] font-semibold text-warning">
        Demo preview data — fictional sample records, not clinical advice.
      </Text>
    </View>
  );
}
