import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components';
import {
  CAREDOSE_EXTENDED_COLORS,
  SECONDARY_PROFILE_DESTINATIONS,
} from '../src/theme/tokens';

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <ScreenContainer
      title="Profile"
      subtitle="Manage your care profile and app settings"
    >
      {SECONDARY_PROFILE_DESTINATIONS.map((dest) => (
        <Pressable
          key={dest.key}
          accessibilityRole="button"
          accessibilityLabel={`${dest.label}: ${dest.subtitle}`}
          onPress={() => router.push(dest.route)}
          className="min-h-[62px] flex-row items-center bg-white rounded-card border border-border px-3.5 py-3 mb-2.5"
        >
          <View className="w-[38px] h-[38px] rounded-full bg-mint items-center justify-center mr-3">
            <Feather
              name={dest.icon as keyof typeof Feather.glyphMap}
              size={18}
              color={CAREDOSE_EXTENDED_COLORS.primary}
            />
          </View>
          <View className="flex-1 min-w-0 pr-2">
            <Text className="text-[14px] font-semibold text-main">{dest.label}</Text>
            <Text className="mt-0.5 text-[12px] text-[#5A706B]">{dest.subtitle}</Text>
          </View>
          <Feather
            name="chevron-right"
            size={18}
            color={CAREDOSE_EXTENDED_COLORS.secondaryText}
          />
        </Pressable>
      ))}
    </ScreenContainer>
  );
}
