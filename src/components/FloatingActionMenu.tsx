import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface FloatingActionMenuItem {
  key: string;
  label: string;
  iconName: keyof typeof Feather.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
}

export interface FloatingActionMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: readonly FloatingActionMenuItem[];
  closedIconName?: keyof typeof Feather.glyphMap;
  toggleAccessibilityLabel?: string;
}

/**
 * Floating bottom-right CareDose action menu with animated expansion and outside-tap dismissal.
 */
export function FloatingActionMenu({
  open,
  onToggle,
  onClose,
  items,
  closedIconName = 'menu',
  toggleAccessibilityLabel = 'Schedule actions menu',
}: FloatingActionMenuProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [anim, open]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });
  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const iconRotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const menuContainer = (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: layout.screenPadding,
        bottom: 16,
        zIndex: 50,
        elevation: 10,
        alignItems: 'flex-end',
      }}
    >
      {open ? (
        <Animated.View
          style={{
            marginBottom: 12,
            alignItems: 'flex-end',
            gap: 10,
            opacity: anim,
            transform: [{ translateY }, { scale }],
            maxWidth: Math.max(220, layout.width - layout.screenPadding * 2),
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.accessibilityLabel ?? item.label}
              hitSlop={4}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              className="flex-row items-center rounded-full bg-white active:bg-mint"
              style={{
                alignSelf: 'flex-end',
                minHeight: 46,
                gap: 10,
                paddingLeft: 8,
                paddingRight: 16,
                paddingVertical: 7,
                borderWidth: 1,
                borderColor: '#DCE8E2',
                shadowColor: '#075D4E',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.14,
                shadowRadius: 8,
                elevation: 5,
              }}
            >
              <View
                className="h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
                  borderWidth: 1,
                  borderColor: '#CBE7DB',
                }}
              >
                <Feather
                  name={item.iconName}
                  size={15}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
              </View>
              <Text
                className="text-[13.5px] font-semibold text-main"
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close schedule actions menu' : toggleAccessibilityLabel}
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        onPress={onToggle}
        className="items-center justify-center active:opacity-90"
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: open
            ? CAREDOSE_EXTENDED_COLORS.primaryDark
            : CAREDOSE_EXTENDED_COLORS.primary,
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.9)',
          shadowColor: '#075D4E',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Animated.View style={{ transform: [{ rotate: iconRotate }] }}>
          <Feather name={open ? 'x' : closedIconName} size={22} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    </View>
  );

  if (!open) {
    return menuContainer;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 45,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close actions menu"
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: 'rgba(24, 49, 45, 0.26)',
        }}
      />
      {menuContainer}
    </View>
  );
}
