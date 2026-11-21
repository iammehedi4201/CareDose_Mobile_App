import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import {
  CAREDOSE_EXTENDED_COLORS,
  CAREDOSE_RADIUS,
  MIN_TOUCH_TARGET,
} from '../theme/tokens';
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
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          style={styles.backdropDismiss}
          onPress={submitLoading ? undefined : onClose}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              paddingHorizontal: layout.modalHorizontalPadding,
              paddingBottom: Math.max(20, insets.bottom + 12),
              maxWidth: layout.modalMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            {iconName ? (
              <View style={styles.headerIconBadge}>
                <Feather
                  name={iconName}
                  size={17}
                  color={CAREDOSE_EXTENDED_COLORS.primary}
                />
              </View>
            ) : null}
            <View style={styles.headerTextCol}>
              <Text style={styles.sheetTitle}>{title}</Text>
              {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              disabled={submitLoading}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <Feather
                name="x"
                size={18}
                color={CAREDOSE_EXTENDED_COLORS.secondaryText}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
            {warningNote ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>{warningNote}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footerRow}>
            <SecondaryButton
              label={cancelLabel}
              onPress={onClose}
              disabled={submitLoading}
              style={styles.footerBtn}
            />
            {onSubmit ? (
              <PrimaryButton
                label={submitLabel}
                onPress={onSubmit}
                disabled={submitDisabled}
                loading={submitLoading}
                style={styles.footerBtn}
              />
            ) : null}
          </View>
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
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
          style={styles.backdropDismiss}
          onPress={loading ? undefined : onCancel}
        />

        <View
          style={[
            styles.sheetContainer,
            {
              paddingHorizontal: layout.modalHorizontalPadding,
              paddingBottom: Math.max(20, insets.bottom + 12),
              maxWidth: layout.modalMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetSubtitle}>{description}</Text>

          {warningNote ? (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>{warningNote}</Text>
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <SecondaryButton
              label={cancelLabel}
              onPress={onCancel}
              disabled={loading}
              style={styles.footerBtn}
            />
            {destructive ? (
              <DestructiveButton
                label={confirmLabel}
                onPress={onConfirm}
                loading={loading}
                style={styles.footerBtn}
              />
            ) : (
              <PrimaryButton
                label={confirmLabel}
                onPress={onConfirm}
                loading={loading}
                style={styles.footerBtn}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(24, 49, 45, 0.48)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.mintSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  closeBtn: {
    width: MIN_TOUCH_TARGET - 8,
    height: MIN_TOUCH_TARGET - 8,
    borderRadius: 18,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: CAREDOSE_EXTENDED_COLORS.mainText,
  },
  sheetSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.secondaryText,
    lineHeight: 17,
  },
  bodyScroll: {
    marginTop: 14,
  },
  bodyContent: {
    paddingBottom: 8,
  },
  warningBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: CAREDOSE_RADIUS.field,
    backgroundColor: CAREDOSE_EXTENDED_COLORS.warningSurface,
    borderWidth: 1,
    borderColor: '#F3D9A4',
  },
  warningText: {
    fontSize: 12,
    color: CAREDOSE_EXTENDED_COLORS.warning,
    fontWeight: '600',
    lineHeight: 17,
  },
  footerRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CAREDOSE_EXTENDED_COLORS.border,
    flexDirection: 'row',
    gap: 10,
  },
  footerBtn: {
    flex: 1,
  },
});
