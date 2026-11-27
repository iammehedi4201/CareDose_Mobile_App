import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export type TimelineVisualState = 'active' | 'past' | 'future';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  iconName: keyof typeof Feather.glyphMap;
  statusLabel?: string;
  statusBgClass?: string;
  statusTextClass?: string;
  timelineState?: TimelineVisualState;
  expanded?: boolean;
  onToggle?: () => void;
}

/**
 * Reusable CareDose timeline section header with clear visual priority between
 * the active time period, muted past periods, and light future periods.
 */
export function SectionHeader({
  title,
  subtitle,
  iconName,
  statusLabel,
  statusBgClass = 'bg-mint',
  statusTextClass = 'text-primary-dark',
  timelineState = 'future',
  expanded = true,
  onToggle,
}: SectionHeaderProps): React.JSX.Element {
  const isActive = timelineState === 'active';
  const isPast = timelineState === 'past';

  const containerStyle = isActive
    ? {
        backgroundColor: '#D6EFE3',
        borderColor: CAREDOSE_EXTENDED_COLORS.primary,
        borderWidth: 1.5,
        shadowColor: '#075D4E',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 3,
      }
    : isPast
      ? {
          backgroundColor: '#EFF3F1',
          borderColor: '#DCE4E0',
          borderWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        }
      : {
          backgroundColor: CAREDOSE_EXTENDED_COLORS.surface,
          borderColor: CAREDOSE_EXTENDED_COLORS.border,
          borderWidth: 1,
          shadowColor: '#075D4E',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 3,
          elevation: 1,
        };

  const iconBadgeStyle = isActive
    ? {
        backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
        borderColor: CAREDOSE_EXTENDED_COLORS.primaryDark,
        borderWidth: 1,
      }
    : isPast
      ? {
          backgroundColor: '#E3EAE6',
          borderColor: '#D4DED9',
          borderWidth: 1,
        }
      : {
          backgroundColor: '#F3FAF6',
          borderColor: '#D4EDE2',
          borderWidth: 1,
        };

  const iconColor = isActive
    ? '#FFFFFF'
    : isPast
      ? CAREDOSE_EXTENDED_COLORS.secondaryText
      : CAREDOSE_EXTENDED_COLORS.primary;

  const titleColor = isActive
    ? CAREDOSE_EXTENDED_COLORS.primaryDark
    : isPast
      ? CAREDOSE_EXTENDED_COLORS.secondaryText
      : CAREDOSE_EXTENDED_COLORS.mainText;

  const subtitleColor = isActive
    ? '#2D584F'
    : isPast
      ? '#738782'
      : CAREDOSE_EXTENDED_COLORS.secondaryText;

  const chevronContainerStyle = isActive
    ? {
        backgroundColor: CAREDOSE_EXTENDED_COLORS.surface,
        borderColor: '#78C2AA',
        borderWidth: 1,
      }
    : isPast
      ? {
          backgroundColor: '#E6ECE9',
          borderColor: '#D4DED9',
          borderWidth: 1,
        }
      : {
          backgroundColor: '#F7FAF8',
          borderColor: CAREDOSE_EXTENDED_COLORS.border,
          borderWidth: 1,
        };

  const inner = (
    <View
      className="flex-row items-center justify-between gap-2.5 rounded-card px-3.5 py-2.5"
      style={containerStyle}
    >
      <View className="flex-1 min-w-0 flex-row items-center gap-2.5">
        <View
          className="h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={iconBadgeStyle}
        >
          <Feather name={iconName} size={15} color={iconColor} />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center gap-1.5">
            <Text
              className={`shrink text-[15px] ${isActive ? 'font-bold' : 'font-semibold'}`}
              style={{ color: titleColor }}
              numberOfLines={1}
            >
              {title}
            </Text>
            {isActive ? (
              <View className="rounded-full bg-primary px-2 py-0.5">
                <Text className="text-[9.5px] font-bold uppercase tracking-[0.4px] text-white">
                  Now
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text
              className="mt-0.5 text-[11px] font-medium"
              style={{ color: subtitleColor }}
              numberOfLines={1}
            >
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
            style={chevronContainerStyle}
          >
            <Feather
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={isActive ? CAREDOSE_EXTENDED_COLORS.primaryDark : CAREDOSE_EXTENDED_COLORS.mainText}
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
      accessibilityHint={
        isActive
          ? 'Current active time period'
          : isPast
            ? 'Past time period'
            : 'Future time period'
      }
      accessibilityState={{ expanded }}
      onPress={onToggle}
      className="active:opacity-90"
    >
      {inner}
    </Pressable>
  );
}
