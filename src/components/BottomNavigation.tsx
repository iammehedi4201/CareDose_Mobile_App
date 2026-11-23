import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useResponsiveLayout } from '../theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
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
    <View
      accessibilityRole="tablist"
      collapsable={false}
      className="z-10 border-t border-border bg-white px-1 pt-1.5 pb-2.5"
    >
      <View
        className="w-full flex-row items-center justify-around"
        style={
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth, alignSelf: 'center', width: '100%' }
            : undefined
        }
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
              className="flex-1 min-w-0 min-h-[44px] items-center justify-center px-0.5"
            >
              <View
                className={`mb-0.5 rounded-full py-[5px] ${isActive ? 'bg-mint' : ''}`}
                style={{ paddingHorizontal: layout.tabPillPaddingX }}
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
                className={`text-[11px] ${
                  isActive ? 'font-semibold text-primary' : 'font-medium text-[#5A706B]'
                }`}
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
