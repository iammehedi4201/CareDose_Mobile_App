import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '../theme/responsive';
import { CAREDOSE_EXTENDED_COLORS } from '../theme/tokens';
import {
  BottomSheetScrollContext,
  computeKeyboardModalMetrics,
  MeasurableNode,
  SheetViewRef,
} from './BottomSheetContext';
import { DestructiveButton, PrimaryButton, SecondaryButton } from './Buttons';

type SheetScrollViewRef = React.ComponentRef<typeof ScrollView>;

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
  const { height: windowHeight } = useWindowDimensions();

  const backdropRef = useRef<SheetViewRef | null>(null);
  const scrollViewRef = useRef<SheetScrollViewRef | null>(null);
  const scrollOffsetRef = useRef(0);
  const focusedTargetRef = useRef<SheetViewRef | null>(null);
  const scrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [backdropHeight, setBackdropHeight] = useState(0);

  const clearScheduledScrolls = useCallback(() => {
    scrollTimersRef.current.forEach(clearTimeout);
    scrollTimersRef.current = [];
  }, []);

  const scrollTargetIntoView = useCallback((target: SheetViewRef | null) => {
    if (!target) return;

    if (Platform.OS === 'web') {
      const domEl = target as unknown as {
        scrollIntoView?: (options?: { block?: string; behavior?: string }) => void;
      };
      if (typeof domEl.scrollIntoView === 'function') {
        domEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      return;
    }

    const sv = scrollViewRef.current as (SheetScrollViewRef & MeasurableNode) | null;
    const targetNode = target as unknown as MeasurableNode;
    if (
      !sv ||
      typeof sv.measureInWindow !== 'function' ||
      typeof targetNode.measureInWindow !== 'function'
    ) {
      return;
    }

    sv.measureInWindow((_sx: number, svY: number, _sw: number, svH: number) => {
      targetNode.measureInWindow?.((_tx: number, targetY: number, _tw: number, targetH: number) => {
        if (svH <= 0) return;
        const topSafe = svY + 12;
        const bottomSafe = svY + svH - 20;
        const targetBottom = targetY + targetH;
        if (targetBottom > bottomSafe) {
          const delta = targetBottom - bottomSafe;
          sv.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + delta),
            animated: true,
          });
        } else if (targetY < topSafe) {
          const delta = topSafe - targetY;
          sv.scrollTo({
            y: Math.max(0, scrollOffsetRef.current - delta),
            animated: true,
          });
        }
      });
    });
  }, []);

  const scheduleScrollIntoView = useCallback(
    (target: SheetViewRef | null) => {
      if (!target) return;
      clearScheduledScrolls();
      scrollTimersRef.current.push(
        setTimeout(() => scrollTargetIntoView(target), 60),
        setTimeout(() => scrollTargetIntoView(target), 200),
      );
    },
    [clearScheduledScrolls, scrollTargetIntoView],
  );

  const handleInputFocus = useCallback(
    (target: SheetViewRef | null) => {
      focusedTargetRef.current = target;
      scheduleScrollIntoView(target);
    },
    [scheduleScrollIntoView],
  );

  useEffect(() => {
    if (!visible) {
      clearScheduledScrolls();
      setKeyboardInset(0);
      setBackdropHeight(0);
      focusedTargetRef.current = null;
      scrollOffsetRef.current = 0;
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.visualViewport) return;
      const vv = window.visualViewport;
      const onResize = () => {
        const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        setKeyboardInset(overlap > 40 ? overlap : 0);
      };
      vv.addEventListener('resize', onResize);
      return () => vv.removeEventListener('resize', onResize);
    }

    if (typeof Keyboard?.addListener !== 'function') {
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const updateKeyboardInset = (endCoordinates?: { screenY?: number; height?: number }) => {
      const kbHeight = Math.max(0, endCoordinates?.height ?? 0);
      const kbScreenY = endCoordinates?.screenY ?? 0;

      if (Platform.OS === 'ios') {
        setKeyboardInset(kbHeight);
        return;
      }

      const node = backdropRef.current as unknown as MeasurableNode | null;
      if (node && typeof node.measureInWindow === 'function' && kbScreenY > 0) {
        node.measureInWindow((_x: number, y: number, _w: number, h: number) => {
          const containerBottom = y + h;
          const overlap = Math.max(0, containerBottom - kbScreenY);
          setKeyboardInset(overlap > 0 ? overlap : 0);
        });
      } else {
        setKeyboardInset(kbHeight);
      }
    };

    const subShow = Keyboard.addListener(showEvent, (e) => {
      updateKeyboardInset(e?.endCoordinates);
    });
    const subHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
      clearScheduledScrolls();
    };
  }, [clearScheduledScrolls, visible]);

  useEffect(() => {
    if (visible && keyboardInset > 0 && focusedTargetRef.current) {
      scheduleScrollIntoView(focusedTargetRef.current);
    }
  }, [keyboardInset, scheduleScrollIntoView, visible]);

  const metrics = computeKeyboardModalMetrics({
    windowHeight: backdropHeight > 0 ? backdropHeight : windowHeight,
    safeTop: insets.top,
    safeBottom: insets.bottom,
    keyboardInset,
  });

  const handleClose = (): void => {
    if (typeof Keyboard?.dismiss === 'function') {
      Keyboard.dismiss();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View
        ref={backdropRef}
        onLayout={(e) => {
          const nextH = Math.round(e.nativeEvent.layout.height);
          if (nextH > 0) {
            setBackdropHeight((prev) => (Math.abs(prev - nextH) > 1 ? nextH : prev));
          }
        }}
        className="flex-1 bg-[rgba(24,49,45,0.48)] justify-end"
        style={{ paddingBottom: metrics.backdropPaddingBottom }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dialog"
          className="flex-1"
          onPress={submitLoading ? undefined : handleClose}
        />

        <View
          className="bg-white rounded-t-[22px] pt-2.5 self-center w-full"
          style={{
            paddingHorizontal: layout.modalHorizontalPadding,
            paddingBottom: metrics.sheetPaddingBottom,
            maxWidth: layout.modalMaxWidth,
            maxHeight: metrics.sheetMaxHeight,
          }}
        >
          <View className="w-10 h-1 rounded-[2px] bg-border self-center mb-3 shrink-0" />

          <View className="flex-row items-center justify-between gap-2.5 shrink-0">
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
              onPress={handleClose}
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
            ref={scrollViewRef}
            className="mt-3.5 shrink"
            contentContainerStyle={{ paddingBottom: keyboardInset > 0 ? 20 : 8 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <BottomSheetScrollContext.Provider value={handleInputFocus}>
              {children}
              {warningNote ? (
                <View className="mt-2 p-3 rounded-field bg-[#FDF5E6] border border-[#F3D9A4]">
                  <Text className="text-[12px] text-warning font-semibold leading-[17px]">
                    {warningNote}
                  </Text>
                </View>
              ) : null}
            </BottomSheetScrollContext.Provider>
          </ScrollView>

          {!hideFooter ? (
            <View className="mt-3.5 pt-3 border-t border-border flex-row gap-2.5 shrink-0">
              <SecondaryButton
                label={cancelLabel}
                onPress={handleClose}
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
      </View>
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
