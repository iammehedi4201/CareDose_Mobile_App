import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';

export interface FloatingAddButtonProps {
  label?: string;
  accessibilityLabel?: string;
  iconName?: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

/**
 * Bottom-right floating emerald pill CTA consistent with the My Medicines "+ Add" button.
 */
export function FloatingAddButton({
  label = 'Add',
  accessibilityLabel,
  iconName = 'plus',
  onPress,
}: FloatingAddButtonProps): React.JSX.Element {
  const layout = useResponsiveLayout();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: 14,
        left: layout.screenPadding,
        right: layout.screenPadding,
        zIndex: 40,
        alignItems: 'center',
      }}
    >
      <View
        pointerEvents="box-none"
        className="w-full flex-row justify-end"
        style={
          layout.maxContentWidth
            ? { maxWidth: layout.maxContentWidth }
            : undefined
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          onPress={onPress}
          className="flex-row items-center justify-center rounded-full bg-primary px-5 active:opacity-90"
          style={{
            minHeight: 48,
            shadowColor: '#075D4E',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.24,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <Feather name={iconName} size={18} color="#FFFFFF" />
          <Text className="ml-1.5 text-[15px] font-bold text-white">{label}</Text>
        </Pressable>
      </View>
    </View>
  );
}
