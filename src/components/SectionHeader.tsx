import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  iconName: keyof typeof Feather.glyphMap;
  statusLabel?: string;
  statusBgClass?: string;
  statusTextClass?: string;
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * Reusable CareDose timeline section header keeping uniform green & mint visual hierarchy.
 */
export function SectionHeader({
  title,
  subtitle,
  iconName,
  statusLabel,
  statusBgClass = 'bg-mint',
  statusTextClass = 'text-primary-dark',
  expanded = true,
  onToggle,
}: SectionHeaderProps): React.JSX.Element {
  const inner = (
    <View
      className="flex-row items-center justify-between gap-2.5 rounded-field px-3 py-2.5"
      style={{
        backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
        borderColor: '#CBE7DB',
        borderWidth: 1,
      }}
    >
      <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
        <View
          className="h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: CAREDOSE_EXTENDED_COLORS.surface,
            borderColor: '#CBE7DB',
            borderWidth: 1,
          }}
        >
          <Feather name={iconName} size={15} color={CAREDOSE_EXTENDED_COLORS.primary} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[15px] font-bold text-main" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[11px] font-medium text-[#5A706B]" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="shrink-0 flex-row items-center gap-2">
        {statusLabel ? (
          <View className={`rounded-full px-2.5 py-1 ${statusBgClass}`}>
            <Text className={`text-[11px] font-semibold ${statusTextClass}`} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        ) : null}
        {onToggle ? (
          <View
            className="h-7 w-7 items-center justify-center rounded-full"
            style={{
              backgroundColor: CAREDOSE_EXTENDED_COLORS.surface,
              borderColor: '#CBE7DB',
              borderWidth: 1,
            }}
          >
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={CAREDOSE_EXTENDED_COLORS.mainText}
            />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onToggle) {
    return inner;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title} section`}
      accessibilityState={{ expanded }}
      onPress={onToggle}
      className="active:opacity-90"
    >
      {inner}
    </Pressable>
  );
}
