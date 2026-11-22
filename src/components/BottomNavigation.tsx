import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useResponsiveLayout } from '../theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
  MIN_TOUCH_TARGET,
  PRIMARY_BOTTOM_TABS,
  PrimaryTabKey,
  resolveActiveBottomTab,
} from '../theme/tokens';

export interface BottomNavigationProps {
  activeTabOverride?: PrimaryTabKey;
}

export function BottomNavigation({ activeTabOverride }: BottomNavigationProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const layout = useResponsiveLayout();
  const activeKey = activeTabOverride ?? resolveActiveBottomTab(pathname);

  return (
    <View accessibilityRole="tablist" collapsable={false} style={styles.bar}>
      <View
        style={[
          styles.barInner,
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : null,
        ]}
      >
        {PRIMARY_BOTTOM_TABS.map((tab) => {
          const isActive = tab.key === activeKey;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
              hitSlop={4}
              onPress={() => {
                if (!isActive || pathname !== tab.route) {
                  if (typeof router.navigate === 'function') {
                    router.navigate(tab.route);
                  } else {
                    router.push(tab.route);
                  }
                }
              }}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.iconPill,
                  { paddingHorizontal: layout.tabPillPaddingX },
                  isActive ? styles.iconPillActive : null,
                ]}
              >
                <Feather
                  name={tab.icon as keyof typeof Feather.glyphMap}
                  size={18}
                  color={
                    isActive
                      ? CAREDOSE_EXTENDED_COLORS.primary
                      : CAREDOSE_EXTENDED_COLORS.secondaryText
                  }
                />
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isActive ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: CAREDOSE_EXTENDED_COLORS.border,
    paddingTop: 6,
    paddingBottom: 10,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
  },
  tabItem: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  iconPill: {
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 2,
  },
  iconPillActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: CAREDOSE_EXTENDED_COLORS.primary,
  },
  labelInactive: {
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    fontWeight: '500',
  },
});
