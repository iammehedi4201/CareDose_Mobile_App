import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import { DestructiveButton, PrimaryButton, SecondaryButton } from './Buttons';

export interface BottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  warningNote?: string;
  iconName?: keyof typeof Feather.glyphMap;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  submitLoading?: boolean;
  hideFooter?: boolean;
  children: React.ReactNode;
}

export function BottomSheet({
  visible,
  title,
  subtitle,
  warningNote,
  iconName,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  submitDisabled = false,
  submitLoading = false,
  hideFooter = false,
  children,
}: BottomSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-[rgba(24,49,45,0.48)] justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          className="flex-1"
          onPress={submitLoading ? undefined : onClose}
        />

        <View
          className="bg-white rounded-t-[22px] pt-2.5 max-h-[88%] self-center w-full"
          style={{
            paddingHorizontal: layout.modalHorizontalPadding,
            paddingBottom: Math.max(20, insets.bottom + 12),
            maxWidth: layout.modalMaxWidth,
          }}
        >
          <View className="w-10 h-1 rounded-[2px] bg-border self-center mb-3" />

          <View className="flex-row items-center justify-between gap-2.5">
            {iconName ? (
              <View className="w-[34px] h-[34px] rounded-[10px] bg-mint items-center justify-center">
                <Feather
                  name={iconName}
                  size={17}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
              </View>
            ) : null}
            <View className="flex-1 min-w-0">
              <Text className="text-[17px] font-bold text-main">{title}</Text>
              {subtitle ? (
                <Text className="mt-[3px] text-[12px] text-[#5A706B] leading-[17px]">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              disabled={submitLoading}
              onPress={onClose}
              className="w-9 h-9 rounded-full bg-background items-center justify-center"
            >
              <Feather
                name="x"
                size={18}
                color={CAREDOSE_EXTENDED_COLORS.secondaryText}
              />
            </Pressable>
          </View>

          <ScrollView
            className="mt-3.5"
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
            {warningNote ? (
              <View className="mt-2 p-3 rounded-field bg-[#FDF5E6] border border-[#F3D9A4]">
                <Text className="text-[12px] text-warning font-semibold leading-[17px]">
                  {warningNote}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {!hideFooter ? (
            <View className="mt-3.5 pt-3 border-t border-border flex-row gap-2.5">
              <SecondaryButton
                label={cancelLabel}
                onPress={onClose}
                disabled={submitLoading}
                className="flex-1"
              />
              {onSubmit ? (
                <PrimaryButton
                  label={submitLabel}
                  onPress={onSubmit}
                  disabled={submitDisabled}
                  loading={submitLoading}
                  className="flex-1"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  warningNote?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  description,
  warningNote,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-[rgba(24,49,45,0.48)] justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
          className="flex-1"
          onPress={loading ? undefined : onCancel}
        />

        <View
          className="bg-white rounded-t-[22px] pt-2.5 max-h-[88%] self-center w-full"
          style={{
            paddingHorizontal: layout.modalHorizontalPadding,
            paddingBottom: Math.max(20, insets.bottom + 12),
            maxWidth: layout.modalMaxWidth,
          }}
        >
          <View className="w-10 h-1 rounded-[2px] bg-border self-center mb-3" />
          <Text className="text-[17px] font-bold text-main">{title}</Text>
          <Text className="mt-[3px] text-[12px] text-[#5A706B] leading-[17px]">
            {description}
          </Text>

          {warningNote ? (
            <View className="mt-2 p-3 rounded-field bg-[#FDF5E6] border border-[#F3D9A4]">
              <Text className="text-[12px] text-warning font-semibold leading-[17px]">
                {warningNote}
              </Text>
            </View>
          ) : null}

          <View className="mt-3.5 pt-3 border-t border-border flex-row gap-2.5">
            <SecondaryButton
              label={cancelLabel}
              onPress={onCancel}
              disabled={loading}
              className="flex-1"
            />
            {destructive ? (
              <DestructiveButton
                label={confirmLabel}
                onPress={onConfirm}
                loading={loading}
                className="flex-1"
              />
            ) : (
              <PrimaryButton
                label={confirmLabel}
                onPress={onConfirm}
                loading={loading}
                className="flex-1"
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
