import React, { useContext } from 'react';
import type { View } from 'react-native';

export type SheetViewRef = React.ComponentRef<typeof View>;

export interface MeasurableNode {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

export interface KeyboardModalMetrics {
  backdropPaddingBottom: number;
  sheetPaddingBottom: number;
  sheetMaxHeight: number;
}

/**
 * Computes consistent BottomSheet geometry with or without the mobile soft keyboard.
 * Caps sheet height inside the remaining viewport above the keyboard so header,
 * scrollable body, and footer actions remain visible and accessible without jumps.
 */
export function computeKeyboardModalMetrics(params: {
  windowHeight: number;
  safeTop: number;
  safeBottom: number;
  keyboardInset: number;
  keyboardVisible?: boolean;
  windowTopClip?: number;
}): KeyboardModalMetrics {
  const safeWindowHeight = Math.max(320, params.windowHeight);
  const rawInset = Math.max(0, Math.round(params.keyboardInset));
  const topClip = Math.max(0, Math.round(params.windowTopClip ?? 0));
  const topGuard = Math.max(params.safeTop, 16) + 8 + topClip;
  const isKeyboardOpen = rawInset > 0 || Boolean(params.keyboardVisible);

  if (isKeyboardOpen) {
    const maxSafeInset = Math.max(0, safeWindowHeight - topGuard - 180);
    const inset = Math.min(rawInset, maxSafeInset);
    return {
      backdropPaddingBottom: inset,
      sheetPaddingBottom: 12,
      sheetMaxHeight: Math.max(180, safeWindowHeight - inset - topGuard),
    };
  }

  return {
    backdropPaddingBottom: 0,
    sheetPaddingBottom: Math.max(16, params.safeBottom + 12),
    sheetMaxHeight: Math.round(safeWindowHeight * 0.88),
  };
}

/**
 * Prevents double bottom-padding inside Android Modals when the OS already confines
 * the Modal above a 3-button/2-button navigation bar while SafeAreaInsets still
 * reports the system nav-bar height.
 */
export function computeEffectiveModalSafeBottom(params: {
  platformOs: string;
  safeBottom: number;
  screenHeight: number;
  modalBottomInScreen: number;
}): number {
  const safeBottom = Math.max(0, params.safeBottom);
  if (params.platformOs !== 'android') {
    return safeBottom;
  }
  if (params.screenHeight <= 0 || params.modalBottomInScreen <= 0) {
    return safeBottom;
  }
  const excludedBySystemBar = Math.max(
    0,
    Math.round(params.screenHeight - params.modalBottomInScreen),
  );
  return Math.max(0, safeBottom - excludedBySystemBar);
}

export type BottomSheetFocusHandler = (target: SheetViewRef | null) => void;

export const BottomSheetScrollContext = React.createContext<BottomSheetFocusHandler>(
  () => {},
);

export function useBottomSheetScroll(): BottomSheetFocusHandler {
  return useContext(BottomSheetScrollContext);
}
