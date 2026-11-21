import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export type StatusVariant =
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'taken'
  | 'skipped'
  | 'missed'
  | 'upcoming'
  | 'due'
  | 'unverified'
  | 'verified'
  | 'active'
  | 'archived';

export interface StatusStyleConfig {
  label: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

const STATUS_MAP: Record<StatusVariant, StatusStyleConfig> = {
  in_stock: {
    label: 'In stock',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.success,
    borderColor: '#C5E8D8',
  },
  low_stock: {
    label: 'Low stock',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.warning,
    borderColor: '#F3D9A4',
  },
  out_of_stock: {
    label: 'Out of stock',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.errorSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.error,
    borderColor: '#F3C1BE',
  },
  taken: {
    label: 'Taken',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.success,
    borderColor: '#C5E8D8',
  },
  skipped: {
    label: 'Skipped',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.warning,
    borderColor: '#F3D9A4',
  },
  missed: {
    label: 'Missed',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.errorSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.error,
    borderColor: '#F3C1BE',
  },
  upcoming: {
    label: 'Upcoming',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.infoSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.info,
    borderColor: '#C4DBF5',
  },
  due: {
    label: 'Due now',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.warning,
    borderColor: '#F3D9A4',
  },
  unverified: {
    label: 'Unverified',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.secondaryText,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  verified: {
    label: 'Verified',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: '#C5E8D8',
  },
  active: {
    label: 'Active',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: '#C5E8D8',
  },
  archived: {
    label: 'Archived',
    backgroundColor: CAREDOSE_EXTENDED_COLORS.neutralSurface,
    textColor: CAREDOSE_EXTENDED_COLORS.secondaryText,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
};

export function getStatusBadgeConfig(variant: StatusVariant, customLabel?: string): StatusStyleConfig {
  const base = STATUS_MAP[variant] ?? STATUS_MAP.unverified;
  const trimmed = customLabel?.trim();
  return {
    ...base,
    label: trimmed && trimmed.length > 0 ? trimmed : base.label,
  };
}

export interface StatusBadgeProps {
  variant: StatusVariant;
  label?: string;
}

export function StatusBadge({ variant, label }: StatusBadgeProps): React.JSX.Element {
  const cfg = getStatusBadgeConfig(variant, label);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${cfg.label}`}
      style={[
        styles.badge,
        {
          backgroundColor: cfg.backgroundColor,
          borderColor: cfg.borderColor,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.text, { color: cfg.textColor }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexShrink: 0,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
