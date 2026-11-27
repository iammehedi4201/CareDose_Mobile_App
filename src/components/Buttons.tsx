import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  pill?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  className?: string;
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
  pill = false,
  accessibilityLabel,
  style,
  className = '',
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
      className={`flex-row items-center justify-center ${
        pill ? 'rounded-full' : 'rounded-field'
      } ${
        compact
          ? pill
            ? 'min-h-[40px] px-4 py-2'
            : 'min-h-[40px] px-2.5 py-2'
          : 'min-h-[44px] px-3.5 py-2.5'
      } ${fullWidth ? 'w-full' : ''} ${
        interactive ? 'bg-primary' : 'bg-[#9BBFB7]'
      } ${className}`.trim()}
      style={style}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View className="min-w-0 shrink flex-row items-center justify-center">
          {leftIcon ? <View className="mr-1.5">{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            className={`shrink text-center font-semibold text-white ${
              compact ? 'text-xs' : 'text-[13px]'
            }`}
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
  pill = false,
  accessibilityLabel,
  style,
  className = '',
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
      className={`flex-row items-center justify-center ${
        pill ? 'rounded-full' : 'rounded-field'
      } border border-border bg-white ${
        compact
          ? pill
            ? 'min-h-[40px] px-4 py-2'
            : 'min-h-[40px] px-2.5 py-2'
          : 'min-h-[44px] px-3.5 py-2.5'
      } ${fullWidth ? 'w-full' : ''} ${interactive ? 'opacity-100' : 'opacity-55'} ${className}`.trim()}
      style={style}
    >
      {loading ? (
        <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
      ) : (
        <View className="min-w-0 shrink flex-row items-center justify-center">
          {leftIcon ? <View className="mr-1.5">{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            className={`shrink text-center font-semibold text-main ${
              compact ? 'text-xs' : 'text-[13px]'
            }`}
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
  className = '',
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
      className={`flex-row items-center justify-center rounded-field ${
        compact ? 'min-h-[40px] px-2.5 py-2' : 'min-h-[44px] px-3.5 py-2.5'
      } ${fullWidth ? 'w-full' : ''} ${
        interactive ? 'bg-error' : 'bg-[#E2A6A3]'
      } ${className}`.trim()}
      style={style}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View className="min-w-0 shrink flex-row items-center justify-center">
          {leftIcon ? <View className="mr-1.5">{leftIcon}</View> : null}
          <Text
            numberOfLines={1}
            className={`shrink text-center font-semibold text-white ${
              compact ? 'text-xs' : 'text-[13px]'
            }`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
