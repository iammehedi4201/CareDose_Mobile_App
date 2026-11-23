import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';

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
    <View className="min-h-[44px] flex-row items-center rounded-field border border-border bg-white pr-1 pl-3">
      <Feather
        name="search"
        size={16}
        color={CAREDOSE_EXTENDED_COLORS.secondaryText}
        style={{ marginRight: 8 }}
      />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={CAREDOSE_EXTENDED_COLORS.mutedText}
        className="flex-1 py-2 text-[13px] text-main"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search query"
          onPress={handleClear}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Feather name="x-circle" size={16} color={CAREDOSE_EXTENDED_COLORS.secondaryText} />
        </Pressable>
      ) : null}
    </View>
  );
}
