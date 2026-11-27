import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components';
import {
  computeInitials,
  formatGlucoseUnitLabel,
} from '../src/features/health/health-helpers';
import { useUserPreferences } from '../src/features/profile/UserPreferencesContext';
import {
  CAREDOSE_EXTENDED_COLORS,
  SECONDARY_PROFILE_DESTINATIONS,
} from '../src/theme/tokens';

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const initials = computeInitials(preferences.displayName);
  const unitLabel = formatGlucoseUnitLabel(preferences.glucoseUnit);

  return (
    <ScreenContainer
      title="Profile"
      subtitle="Manage your care profile and app settings"
    >
      {/* Care Profile Summary Card */}
      <View className="mb-3.5 rounded-card border border-border bg-white p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row flex-1 min-w-0 items-center gap-3">
            <View className="h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#C5E8D8] bg-mint">
              <Text className="text-[16px] font-bold text-primary-dark">{initials}</Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-[17px] font-bold text-main" numberOfLines={1}>
                {preferences.displayName}
              </Text>
              <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                Care recipient: {preferences.activePatientName} ({preferences.activePatientRelationship})
              </Text>
              <Text className="mt-0.5 text-[11px] text-[#5A706B]" numberOfLines={1}>
                Timezone: {preferences.activePatientTimezone}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit preferences in Settings"
            onPress={() => router.push('/settings')}
            className="shrink-0 rounded-full border border-[#CBE7DB] bg-mint px-3 py-1.5 active:opacity-80"
          >
            <Text className="text-xs font-semibold text-primary">Edit</Text>
          </Pressable>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2 border-t border-border pt-3">
          <View className="rounded-full border border-border bg-background px-2.5 py-1">
            <Text className="text-[11px] font-semibold text-main">
              Glucose unit: {unitLabel}
            </Text>
          </View>
          <View className="rounded-full border border-border bg-background px-2.5 py-1">
            <Text className="text-[11px] font-semibold text-main">
              {preferences.remindersEnabled
                ? `Reminders: ${preferences.reminderLeadMins}m lead`
                : 'Reminders: Paused'}
            </Text>
          </View>
        </View>
      </View>

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
