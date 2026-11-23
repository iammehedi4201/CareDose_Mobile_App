import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { PrimaryButton } from './Buttons';

export interface AppHeaderAction {
  label: string;
  onPress: () => void;
  iconName?: keyof typeof Feather.glyphMap;
  disabled?: boolean;
}

export interface AppHeaderProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  primaryAction?: AppHeaderAction;
  rightBadgeText?: string;
}

export function AppHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  primaryAction,
  rightBadgeText,
}: AppHeaderProps): React.JSX.Element {
  const layout = useResponsiveLayout();

  return (
    <View
      className="border-b border-border bg-background pt-2.5 pb-3"
      style={{ paddingHorizontal: layout.screenPadding }}
    >
      <View
        className="w-full"
        style={
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : undefined
        }
      >
        <View className="flex-row items-center justify-between gap-2.5">
          <View className="flex-1 min-w-0">
            {onBack ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                onPress={onBack}
                className="mb-0.5 min-h-[44px] flex-row items-center self-start pr-3"
              >
                <Feather name="arrow-left" size={18} color={CAREDOSE_EXTENDED_COLORS.mainText} />
                <Text className="ml-1.5 text-[13px] font-semibold text-main">Back</Text>
              </Pressable>
            ) : null}
            {eyebrow ? (
              <Text
                className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.8px] text-[#5A706B]"
                numberOfLines={1}
              >
                {eyebrow}
              </Text>
            ) : null}
            <Text className="text-[24px] font-bold leading-[30px] text-main">{title}</Text>
            {subtitle ? (
              <Text className="mt-0.5 text-xs leading-[17px] text-[#5A706B]">{subtitle}</Text>
            ) : null}
          </View>

          {primaryAction ? (
            <View className="shrink-0">
              <PrimaryButton
                compact
                label={primaryAction.label}
                onPress={primaryAction.onPress}
                disabled={primaryAction.disabled}
                leftIcon={
                  primaryAction.iconName ? (
                    <Feather name={primaryAction.iconName} size={14} color="#FFFFFF" />
                  ) : undefined
                }
              />
            </View>
          ) : rightBadgeText ? (
            <View className="h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-[#C5E8D8] bg-mint">
              <Text className="text-[13px] font-bold text-primary">{rightBadgeText}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
