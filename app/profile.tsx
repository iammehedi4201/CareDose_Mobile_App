import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '../src/components';
import {
  CAREDOSE_EXTENDED_COLORS,
  CAREDOSE_RADIUS,
  MIN_TOUCH_TARGET,
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
          style={styles.menuRow}
        >
          <View style={styles.menuIconCircle}>
            <Feather
              name={dest.icon as keyof typeof Feather.glyphMap}
              size={18}
              color={CAREDOSE_EXTENDED_COLORS.primary}
            />
          </View>
          <View style={styles.menuTextCol}>
            <Text style={styles.menuLabel}>{dest.label}</Text>
            <Text style={styles.menuSubtitle}>{dest.subtitle}</Text>
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

const styles = StyleSheet.create({
  menuRow: {
    minHeight: MIN_TOUCH_TARGET + 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CAREDOSE_RADIUS.card,
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  menuSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
  },
});
