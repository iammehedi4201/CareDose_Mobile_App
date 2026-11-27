import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

export interface FilterChipOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

export interface FilterChipsProps<T extends string = string> {
  options: readonly FilterChipOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  compact?: boolean;
}

export function FilterChips<T extends string = string>({
  options,
  selectedKey,
  onSelect,
  compact = false,
}: FilterChipsProps<T>): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      bounces={false}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        paddingVertical: compact ? 2 : 4,
        paddingRight: 4,
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.key === selectedKey;
        const displayLabel =
          typeof opt.count === 'number' ? `${opt.label} (${opt.count})` : opt.label;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityLabel={displayLabel}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(opt.key)}
            className={`items-center justify-center rounded-full border ${
              compact ? 'min-h-[36px] px-3 py-1.5' : 'min-h-[38px] px-3.5 py-2'
            } ${isSelected ? 'border-primary bg-primary' : 'border-border bg-white'}`}
          >
            <Text
              numberOfLines={1}
              className={`text-xs font-semibold ${
                isSelected ? 'text-white' : 'text-main'
              }`}
            >
              {displayLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
