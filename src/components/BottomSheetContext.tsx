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
}): KeyboardModalMetrics {
  const safeWindowHeight = Math.max(320, params.windowHeight);
  const inset = Math.max(0, Math.round(params.keyboardInset));
  const topGuard = Math.max(params.safeTop, 16) + 8;

  if (inset > 0) {
    return {
      backdropPaddingBottom: inset,
      sheetPaddingBottom: 12,
      sheetMaxHeight: Math.max(220, safeWindowHeight - inset - topGuard),
    };
  }

  return {
    backdropPaddingBottom: 0,
    sheetPaddingBottom: Math.max(20, params.safeBottom + 12),
    sheetMaxHeight: Math.round(safeWindowHeight * 0.88),
  };
}

export type BottomSheetFocusHandler = (target: SheetViewRef | null) => void;

export const BottomSheetScrollContext = React.createContext<BottomSheetFocusHandler>(
  () => {},
);

export function useBottomSheetScroll(): BottomSheetFocusHandler {
  return useContext(BottomSheetScrollContext);
}
