import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { CAREDOSE_EXTENDED_COLORS, CAREDOSE_RADIUS, MIN_TOUCH_TARGET } from '../theme/tokens';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
}

export function isButtonInteractive(disabled?: boolean, loading?: boolean): boolean {
  return !disabled && !loading;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  compact = false,
  fullWidth = false,
  accessibilityLabel,
  style,
  leftIcon,
}: ActionButtonProps): React.JSX.Element {
  const interactive = isButtonInteractive(disabled, loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !interactive, busy: loading }}
      disabled={!interactive}
      onPress={() => {
        if (interactive) {
          onPress();
        }
      }}
      style={[
        styles.base,
        compact ? styles.compact : null,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: !interactive
            ? '#9BBFB7'
            : CAREDOSE_EXTENDED_COLORS.primary,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            style={[styles.primaryText, compact ? styles.compactText : null]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  compact = false,
  fullWidth = false,
  accessibilityLabel,
  style,
  leftIcon,
}: ActionButtonProps): React.JSX.Element {
  const interactive = isButtonInteractive(disabled, loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !interactive, busy: loading }}
      disabled={!interactive}
      onPress={() => {
        if (interactive) {
          onPress();
        }
      }}
      style={[
        styles.base,
        styles.secondaryBase,
        compact ? styles.compact : null,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: '#FFFFFF',
          borderColor: !interactive
            ? CAREDOSE_EXTENDED_COLORS.border
            : CAREDOSE_EXTENDED_COLORS.border,
          opacity: !interactive ? 0.55 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            style={[styles.secondaryText, compact ? styles.compactText : null]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function DestructiveButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  compact = false,
  fullWidth = false,
  accessibilityLabel,
  style,
  leftIcon,
}: ActionButtonProps): React.JSX.Element {
  const interactive = isButtonInteractive(disabled, loading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !interactive, busy: loading }}
      disabled={!interactive}
      onPress={() => {
        if (interactive) {
          onPress();
        }
      }}
      style={[
        styles.base,
        compact ? styles.compact : null,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: !interactive
            ? '#E2A6A3'
            : CAREDOSE_EXTENDED_COLORS.error,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View style={styles.contentRow}>
          {leftIcon ? <View style={styles.iconSlot}>{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            style={[styles.primaryText, compact ? styles.compactText : null]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: CAREDOSE_RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  compact: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  fullWidth: {
    width: '100%',
  },
  secondaryBase: {
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  iconSlot: {
    marginRight: 6,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  secondaryText: {
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  compactText: {
    fontSize: 12,
  },
});
