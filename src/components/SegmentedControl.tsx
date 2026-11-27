import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

export interface SegmentedControlOption<T extends string = string> {
  key: T;
  label: string;
  iconName?: keyof typeof Feather.glyphMap;
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedControlOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
}

/**
 * Reusable two-or-multi-option CareDose segmented switcher using card & field radii.
 */
export function SegmentedControl<T extends string = string>({
  options,
  selectedKey,
  onSelect,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <View className="flex-row items-center gap-1 rounded-card border border-border bg-white p-1">
      {options.map((opt) => {
        const active = opt.key === selectedKey;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(opt.key)}
            className={`min-h-[42px] flex-1 min-w-0 flex-row items-center justify-center gap-1.5 rounded-field px-3 py-2 ${
              active ? 'bg-primary' : 'bg-white active:bg-mint'
            }`}
          >
            {opt.iconName ? (
              <Feather
                name={opt.iconName}
                size={15}
                color={active ? '#FFFFFF' : CAREDOSE_EXTENDED_COLORS.primary}
              />
            ) : null}
            <Text
              numberOfLines={1}
              className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-main'}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
