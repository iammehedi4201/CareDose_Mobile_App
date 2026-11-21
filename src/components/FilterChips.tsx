import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CAREDOSE_EXTENDED_COLORS, MIN_TOUCH_TARGET } from '../theme/tokens';

export interface FilterChipOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

export interface FilterChipsProps<T extends string = string> {
  options: readonly FilterChipOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
}

export function FilterChips<T extends string = string>({
  options,
  selectedKey,
  onSelect,
}: FilterChipsProps<T>): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
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
            style={[
              styles.chip,
              isSelected ? styles.chipActive : styles.chipInactive,
            ]}
          >
            <Text style={[styles.chipText, isSelected ? styles.textActive : styles.textInactive]}>
              {displayLabel}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET - 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: CAREDOSE_EXTENDED_COLORS.primary,
    borderColor: CAREDOSE_EXTENDED_COLORS.primary,
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textActive: {
    color: '#FFFFFF',
  },
  textInactive: {
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
});
