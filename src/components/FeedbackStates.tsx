import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS } from '../theme/tokens';
import { useResponsiveLayout } from '../theme/responsive';
import { PrimaryButton, SecondaryButton } from './Buttons';

export interface LoadingSkeletonProps {
  rows?: number;
}

export function LoadingSkeleton({ rows = 3 }: LoadingSkeletonProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  return (
    <View accessibilityLabel="Loading content" style={styles.skeletonList}>
      {Array.from({ length: rows }).map((_, idx) => (
        <View key={idx} style={[styles.skeletonCard, { padding: layout.cardPadding }]}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonLines}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineMedium} />
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
    <View style={[styles.stateBox, { padding: layout.isCompact ? 16 : 20 }]}>
      <View style={styles.iconCircle}>
        <Feather name={iconName} size={22} color={CAREDOSE_EXTENDED_COLORS.primary} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateDesc}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
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
    <View style={[styles.stateBox, styles.errorBox, { padding: layout.isCompact ? 16 : 20 }]}>
      <Feather name="alert-triangle" size={22} color={CAREDOSE_EXTENDED_COLORS.error} />
      <Text style={[styles.stateTitle, { color: CAREDOSE_EXTENDED_COLORS.error }]}>{title}</Text>
      <Text style={styles.stateDesc}>{message}</Text>
      {onRetry ? (
        <View style={styles.actionWrap}>
          <SecondaryButton compact label="Retry" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export interface SuccessToastProps {
  message: string | null;
  onDismiss?: () => void;
}

export function SuccessToast({ message }: SuccessToastProps): React.JSX.Element | null {
  if (!message) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={styles.toast}>
      <Feather name="check-circle" size={16} color="#FFFFFF" />
      <Text style={styles.toastText}>{message}</Text>
    </View>
  );
}

export function DemoModeBanner(): React.JSX.Element {
  return (
    <View style={styles.demoBanner}>
      <Feather name="info" size={14} color={CAREDOSE_EXTENDED_COLORS.warning} />
      <Text style={styles.demoBannerText}>
        Demo preview data — fictional sample records, not clinical advice.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonList: {
    gap: 10,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    marginRight: 12,
    flexShrink: 0,
  },
  skeletonLines: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  skeletonLineWide: {
    height: 12,
    width: '68%',
    borderRadius: 6,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
  },
  skeletonLineMedium: {
    height: 10,
    width: '45%',
    borderRadius: 5,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
  },
  stateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8,
  },
  errorBox: {
    borderColor: '#F3C1BE',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.errorSurface,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  stateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    textAlign: 'center',
  },
  stateDesc: {
    marginTop: 4,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionWrap: {
    marginTop: 12,
    maxWidth: '100%',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: CAREDOSE_RADIUS.field,
    marginBottom: 12,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderWidth: 1,
    borderColor: '#F3D9A4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: CAREDOSE_RADIUS.field,
    marginBottom: 12,
  },
  demoBannerText: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.warning,
  },
});
