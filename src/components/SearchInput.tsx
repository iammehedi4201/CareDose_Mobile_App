import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  CAREDOSE_EXTENDED_COLORS,
  CAREDOSE_RADIUS,
  MIN_TOUCH_TARGET,
} from '../theme/tokens';

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search by brand, generic or strength...',
  onClear,
}: SearchInputProps): React.JSX.Element {
  const handleClear = (): void => {
    onChangeText('');
    onClear?.();
  };

  return (
    <View style={styles.container}>
      <Feather
        name="search"
        size={16}
        color={CAREDOSE_EXTENDED_COLORS.secondaryText}
        style={styles.searchIcon}
      />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CAREDOSE_EXTENDED_COLORS.mutedText}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search query"
          onPress={handleClear}
          style={styles.clearButton}
        >
          <Feather name="x-circle" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CAREDOSE_EXTENDED_COLORS.border,
    borderRadius: CAREDOSE_RADIUS.field,
    paddingLeft: 12,
    paddingRight: 4,
    minHeight: MIN_TOUCH_TARGET,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: CAREDOSE_EXTENDED_COLORS.mainText,
    paddingVertical: 8,
  },
  clearButton: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
