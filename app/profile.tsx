import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import profileHeaderImage from '../assets/profile-header-illustration.jpg';
import { ScreenContainer, useScreenWaveHeader } from '../src/components';
import {
  computeInitials,
  formatGlucoseUnitLabel,
} from '../src/features/health/health-helpers';
import { useUserPreferences } from '../src/features/profile/UserPreferencesContext';
import {
  CAREDOSE_EXTENDED_COLORS,
  SECONDARY_PROFILE_DESTINATIONS,
} from '../src/theme/tokens';

const TRACKING_KEYS = new Set(['health-log', 'expenses', 'purchases']);

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();
  const { preferences } = useUserPreferences();
  const initials = computeInitials(preferences.displayName);
  const unitLabel = formatGlucoseUnitLabel(preferences.glucoseUnit);

  const trackingDestinations = SECONDARY_PROFILE_DESTINATIONS.filter((d) =>
    TRACKING_KEYS.has(d.key),
  );
  const toolsDestinations = SECONDARY_PROFILE_DESTINATIONS.filter(
    (d) => !TRACKING_KEYS.has(d.key),
  );

  const {
    topBanner,
    topOverlay,
    overlapPx,
  } = useScreenWaveHeader({
    eyebrow: 'CARE HUB',
    title: 'Profile',
    subtitle: 'Manage your care profile and tools.',
    imageSource: profileHeaderImage,
    overlapRatio: 0.25,
    rightSlot: (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Settings"
        hitSlop={6}
        onPress={() => router.push('/settings')}
        className="h-10 w-10 shrink-0 items-center justify-center rounded-full shadow-sm active:bg-mint"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          borderWidth: 1,
          borderColor: '#C5E8D8',
        }}
      >
        <Feather name="settings" size={18} color={CAREDOSE_EXTENDED_COLORS.primaryDark} />
      </Pressable>
    ),
  });

  const renderDestinationGroup = (
    heading: string,
    items: readonly (typeof SECONDARY_PROFILE_DESTINATIONS)[number][],
  ): React.JSX.Element => (
    <View className="mt-4">
      <Text className="mb-2 text-[15px] font-bold text-main">{heading}</Text>
      <View className="overflow-hidden rounded-[18px] border border-border bg-white shadow-sm">
        {items.map((dest, idx) => (
          <Pressable
            key={dest.key}
            accessibilityRole="button"
            accessibilityLabel={`${dest.label}: ${dest.subtitle}`}
            onPress={() => router.push(dest.route)}
            className={`min-h-[62px] flex-row items-center px-3.5 py-3 active:bg-background ${
              idx > 0 ? 'border-t border-border' : ''
            }`}
          >
            <View
              className="mr-3 h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint"
              style={{ borderWidth: 1, borderColor: '#CBE7DB' }}
            >
              <Feather
                name={dest.icon as keyof typeof Feather.glyphMap}
                size={18}
                color={CAREDOSE_EXTENDED_COLORS.primary}
              />
            </View>
            <View className="flex-1 min-w-0 pr-2">
              <Text className="text-[14px] font-bold text-main" numberOfLines={1}>
                {dest.label}
              </Text>
              <Text className="mt-0.5 text-xs text-[#5A706B]" numberOfLines={1}>
                {dest.subtitle}
              </Text>
            </View>
            <Feather
              name="chevron-right"
              size={18}
              color={CAREDOSE_EXTENDED_COLORS.secondaryText}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ScreenContainer
      title="Profile"
      hideHeader
      topBanner={topBanner}
      topOverlay={topOverlay}
    >
      {/* Floating Care Profile Summary Card */}
      <View
        style={{ marginTop: -overlapPx }}
        className="rounded-card border border-border bg-white p-4 shadow-sm"
      >
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row flex-1 min-w-0 items-center gap-3">
            <View
              className="h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"
              style={{ borderWidth: 1, borderColor: '#C5E8D8' }}
            >
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
            className="shrink-0 rounded-full bg-mint px-3 py-1.5 active:opacity-80"
            style={{ borderWidth: 1, borderColor: '#CBE7DB' }}
          >
            <Text className="text-xs font-semibold text-primary">Edit</Text>
          </Pressable>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2 border-t border-border pt-3">
          <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Feather name="droplet" size={11} color={CAREDOSE_EXTENDED_COLORS.primary} />
            <Text className="text-[11px] font-semibold text-main">
              Glucose unit: {unitLabel}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
            <Feather
              name={preferences.remindersEnabled ? 'bell' : 'bell-off'}
              size={11}
              color={
                preferences.remindersEnabled
                  ? CAREDOSE_EXTENDED_COLORS.primary
                  : CAREDOSE_EXTENDED_COLORS.secondaryText
              }
            />
            <Text className="text-[11px] font-semibold text-main">
              {preferences.remindersEnabled
                ? `Reminders: ${preferences.reminderLeadMins}m lead`
                : 'Reminders: Paused'}
            </Text>
          </View>
        </View>
      </View>

      {renderDestinationGroup('Health & Spending', trackingDestinations)}
      {renderDestinationGroup('Care Tools & History', toolsDestinations)}
    </ScreenContainer>
  );
}
