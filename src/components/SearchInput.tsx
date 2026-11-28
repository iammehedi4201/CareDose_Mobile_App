import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { SheetViewRef, useBottomSheetScroll } from './BottomSheetContext';

export interface SearchSuggestionItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  meta?: string;
}

export interface SearchInputMetrics {
  height: number;
  borderRadius: number;
  paddingLeft: number;
  paddingRight: number;
  iconSize: number;
  iconGap: number;
  fontSize: number;
  clearButtonSize: number;
}

/** Computes responsive geometry metrics for SearchInput across narrow and tablet widths. */
export function computeSearchInputMetrics(
  width: number,
  compact?: boolean,
): SearchInputMetrics {
  const isNarrow = width < 360 || Boolean(compact);
  return {
    height: isNarrow ? 44 : 48,
    borderRadius: isNarrow ? 12 : 14,
    paddingLeft: isNarrow ? 12 : 14,
    paddingRight: isNarrow ? 6 : 8,
    iconSize: isNarrow ? 15 : 16,
    iconGap: isNarrow ? 8 : 10,
    fontSize: isNarrow ? 13.5 : 14.5,
    clearButtonSize: isNarrow ? 24 : 26,
  };
}

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  compact?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onSubmitEditing?: () => void;
  rightAccessory?: React.ReactNode;
  suggestions?: SearchSuggestionItem[];
  showSuggestions?: boolean;
  suggestionsLoading?: boolean;
  suggestionsHeader?: string;
  onSelectSuggestion?: (item: SearchSuggestionItem) => void;
  onFillSuggestion?: (item: SearchSuggestionItem) => void;
}

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search by brand, generic or strength...',
  onClear,
  compact = false,
  onFocusChange,
  onSubmitEditing,
  rightAccessory,
  suggestions,
  showSuggestions = false,
  suggestionsLoading = false,
  suggestionsHeader = 'Suggestions',
  onSelectSuggestion,
  onFillSuggestion,
}: SearchInputProps): React.JSX.Element {
  const layout = useResponsiveLayout();
  const metrics = computeSearchInputMetrics(layout.effectiveWidth, compact);
  const wrapperRef = useRef<SheetViewRef | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactingWithDropdownRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const notifySheetScroll = useBottomSheetScroll();
  const hasQuery = value.trim().length > 0;
  const isActive = focused || value.length > 0;

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) {
        clearTimeout(blurTimerRef.current);
      }
    };
  }, []);

  const clearBlurTimer = (): void => {
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  };

  const handleFocus = (): void => {
    clearBlurTimer();
    setFocused(true);
    onFocusChange?.(true);
    notifySheetScroll(wrapperRef.current);
  };

  const handleBlur = (): void => {
    clearBlurTimer();
    blurTimerRef.current = setTimeout(() => {
      if (interactingWithDropdownRef.current) {
        interactingWithDropdownRef.current = false;
        return;
      }
      setFocused(false);
      onFocusChange?.(false);
    }, 160);
  };

  const handleClear = (): void => {
    clearBlurTimer();
    onChangeText('');
    onClear?.();
  };

  const suggestionList = suggestions ?? [];
  const shouldRenderDropdown =
    Boolean(showSuggestions) &&
    hasQuery &&
    (Boolean(suggestionsLoading) || suggestionList.length > 0);

  return (
    <View ref={wrapperRef} className="w-full">
      <View
        className="flex-row items-center"
        style={{
          minHeight: metrics.height,
          borderRadius: metrics.borderRadius,
          paddingLeft: metrics.paddingLeft,
          paddingRight: metrics.paddingRight,
          backgroundColor: isActive ? '#FFFFFF' : '#F3F8F6',
          borderWidth: 1,
          borderColor: isActive ? CAREDOSE_EXTENDED_COLORS.primary : '#D7E5DD',
        }}
      >
        <View
          className="shrink-0 items-center justify-center"
          style={{ marginRight: metrics.iconGap }}
        >
          <Feather
            name="search"
            size={metrics.iconSize}
            color={
              isActive
                ? CAREDOSE_EXTENDED_COLORS.primary
                : CAREDOSE_EXTENDED_COLORS.secondaryText
            }
          />
        </View>

        <TextInput
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={CAREDOSE_EXTENDED_COLORS.mutedText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={onSubmitEditing}
          className="flex-1 min-w-0 font-medium text-main"
          style={{
            fontSize: metrics.fontSize,
            paddingVertical: layout.isCompact || compact ? 8 : 10,
            color: CAREDOSE_EXTENDED_COLORS.mainText,
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {rightAccessory}

        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search query"
            hitSlop={8}
            onPress={handleClear}
            style={{
              minHeight: 34,
              minWidth: 34,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: metrics.clearButtonSize,
                height: metrics.clearButtonSize,
                backgroundColor: '#E5EFEA',
              }}
            >
              <Feather name="x" size={13} color={CAREDOSE_EXTENDED_COLORS.mainText} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {shouldRenderDropdown ? (
        <View
          accessibilityLabel="Medicine search suggestions"
          className="mt-2 overflow-hidden"
          style={{
            borderRadius: metrics.borderRadius,
            borderWidth: 1,
            borderColor: '#CBE7DB',
            backgroundColor: '#FFFFFF',
          }}
        >
          <View
            className="flex-row items-center justify-between px-3 py-1.5"
            style={{
              backgroundColor: '#F3F9F6',
              borderBottomWidth: 1,
              borderBottomColor: '#E6F0EB',
            }}
          >
            <Text className="text-[11px] font-bold uppercase tracking-wider text-secondary">
              {suggestionsHeader}
            </Text>
            {suggestionsLoading ? (
              <ActivityIndicator size="small" color={CAREDOSE_EXTENDED_COLORS.primary} />
            ) : (
              <Text className="text-[11px] font-semibold text-primary">
                {suggestionList.length} match{suggestionList.length === 1 ? '' : 'es'}
              </Text>
            )}
          </View>

          {suggestionList.map((item, idx) => (
            <View
              key={item.id}
              className="flex-row items-center"
              style={
                idx < suggestionList.length - 1
                  ? { borderBottomWidth: 1, borderBottomColor: '#EEF4F1' }
                  : undefined
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.title}`}
                onPressIn={() => {
                  interactingWithDropdownRef.current = true;
                  clearBlurTimer();
                }}
                onPress={() => {
                  interactingWithDropdownRef.current = false;
                  setFocused(false);
                  onFocusChange?.(false);
                  onSelectSuggestion?.(item);
                }}
                className="min-w-0 flex-1 flex-row items-center justify-between gap-2 px-3 py-2.5 active:bg-[#F3F9F6]"
              >
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text
                      numberOfLines={1}
                      className="min-w-0 shrink text-[13.5px] font-bold text-main"
                    >
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View
                        className="shrink-0 rounded-full px-2 py-0.5"
                        style={{ backgroundColor: '#EAF6F0' }}
                      >
                        <Text className="text-[10.5px] font-semibold text-primary">
                          {item.badge}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.subtitle ? (
                    <Text
                      numberOfLines={1}
                      className="mt-0.5 text-[11.5px] text-secondary"
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>

                {item.meta ? (
                  <Text className="shrink-0 text-[12px] font-bold text-primary">
                    {item.meta}
                  </Text>
                ) : null}
              </Pressable>

              {onFillSuggestion ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Search ${item.title}`}
                  hitSlop={6}
                  onPressIn={() => {
                    interactingWithDropdownRef.current = true;
                    clearBlurTimer();
                  }}
                  onPress={() => {
                    interactingWithDropdownRef.current = false;
                    setFocused(false);
                    onFocusChange?.(false);
                    onFillSuggestion(item);
                  }}
                  className="items-center justify-center px-2.5 py-2.5 active:bg-[#F3F9F6]"
                >
                  <Feather
                    name="arrow-up-left"
                    size={14}
                    color={CAREDOSE_EXTENDED_COLORS.secondaryText}
                  />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
