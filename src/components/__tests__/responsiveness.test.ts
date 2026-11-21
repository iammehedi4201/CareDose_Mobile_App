import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setMockWindowWidth } from '../../test/mocks/react-native';
import { getResponsiveMetrics, VIEWPORT_BREAKPOINTS } from '../../theme/responsive';
import { PrimaryButton, SecondaryButton } from '../Buttons';
import { DoseCard } from '../DoseCard';
import { EmptyState, ErrorState, LoadingSkeleton, SuccessToast } from '../FeedbackStates';
import { FormCol, FormRow } from '../FormFields';
import { MedicineCard } from '../MedicineCard';
import { BottomSheet, ConfirmDialog } from '../Overlays';
import { StatusBadge } from '../StatusBadge';
import { AppHeader } from '../AppHeader';
import { BottomNavigation } from '../BottomNavigation';
import { ScreenContainer } from '../ScreenContainer';

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

type StyleRecord = Record<string, unknown>;

function flattenStyle(style: unknown): StyleRecord {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<StyleRecord>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
  }
  if (typeof style === 'object') {
    return style as StyleRecord;
  }
  return {};
}

interface ElementMatch {
  type: unknown;
  props: Record<string, unknown>;
  style: StyleRecord;
}

function collectElements(node: unknown, out: ElementMatch[] = []): ElementMatch[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') {
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      collectElements(child, out);
    }
    return out;
  }
  if (React.isValidElement(node)) {
    const props = (node.props ?? {}) as Record<string, unknown>;
    if (typeof node.type === 'function') {
      const fnType = node.type as (p: Record<string, unknown>) => React.ReactNode;
      collectElements(fnType(props), out);
      return out;
    }
    out.push({
      type: node.type,
      props,
      style: flattenStyle(props.style),
    });
    if (props.children !== undefined) {
      collectElements(props.children, out);
    }
  }
  return out;
}

const REQUIRED_VIEWPORTS = [320, 360, 375, 390, 414, 430, 768] as const;

afterEach(() => {
  __setMockWindowWidth(375);
});

describe('CareDose Multi-Viewport UI Responsiveness (320px - 768px)', () => {
  it('computes monotonic horizontal spacing and proper breakpoints across all target widths', () => {
    const metricsByWidth = REQUIRED_VIEWPORTS.map((w) => getResponsiveMetrics(w));
    expect(metricsByWidth[0].stackTwoCol).toBe(true);
    expect(metricsByWidth[0].useShortWeekdayLabels).toBe(true);
    expect(metricsByWidth[0].screenPadding).toBe(12);

    for (const m of metricsByWidth.slice(1)) {
      expect(m.stackTwoCol).toBe(false);
      expect(m.useShortWeekdayLabels).toBe(false);
      expect(m.screenPadding).toBeGreaterThanOrEqual(16);
    }

    const tablet = metricsByWidth[metricsByWidth.length - 1];
    expect(tablet.maxContentWidth).toBe(VIEWPORT_BREAKPOINTS.tabletMaxContentWidth);
  });

  it('stacks FormRow vertically on 320px and keeps 2 columns side-by-side at >= 360px with minWidth: 0', () => {
    __setMockWindowWidth(320);
    const compactEls = collectElements(
      FormRow({
        children: [
          React.createElement(FormCol, {
            key: 'a',
            children: React.createElement('Text', null, 'Left'),
          }),
          React.createElement(FormCol, {
            key: 'b',
            children: React.createElement('Text', null, 'Right'),
          }),
        ],
      }),
    );
    expect(compactEls[0].style.flexDirection).toBe('column');
    expect(compactEls[1].style.flex).toBeUndefined();

    for (const width of [360, 375, 390, 414, 430, 768]) {
      __setMockWindowWidth(width);
      const wideEls = collectElements(
        FormRow({
          children: [
            React.createElement(FormCol, {
              key: 'a',
              children: React.createElement('Text', null, 'Left'),
            }),
            React.createElement(FormCol, {
              key: 'b',
              children: React.createElement('Text', null, 'Right'),
            }),
          ],
        }),
      );
      expect(wideEls[0].style.flexDirection).toBe('row');
      expect(wideEls[1].style.flex).toBe(1);
      expect(wideEls[1].style.minWidth).toBe(0);
    }
  });

  it('adapts ScreenContainer, AppHeader, and BottomNavigation across narrow (320px) and tablet (768px) viewports', () => {
    for (const width of REQUIRED_VIEWPORTS) {
      __setMockWindowWidth(width);
      const expected = getResponsiveMetrics(width);

      const headerEls = collectElements(
        AppHeader({
          eyebrow: 'VERY LONG EYEBROW SECTION HEADER LABEL',
          title: 'Very Long Screen Heading Title For Small Screens',
          primaryAction: { label: 'Add Medicine', onPress: vi.fn(), iconName: 'plus' },
        }),
      );
      const scrollScreenEls = collectElements(
        ScreenContainer({
          title: 'Today',
          children: React.createElement('Text', null, 'Body content'),
        }),
      );
      const navEls = collectElements(BottomNavigation({}));

      expect(headerEls.some((e) => e.props.numberOfLines === 1)).toBe(true);
      expect(headerEls.some((e) => e.style.minWidth === 0)).toBe(true);
      expect(headerEls.some((e) => e.style.flexShrink === 0)).toBe(true);

      const hasPaddingMatch = scrollScreenEls.some(
        (e) => e.style.paddingHorizontal === expected.screenPadding,
      );
      expect(hasPaddingMatch).toBe(true);

      if (width >= 768) {
        expect(
          scrollScreenEls.some((e) => e.style.maxWidth === VIEWPORT_BREAKPOINTS.tabletMaxContentWidth),
        ).toBe(true);
        expect(
          navEls.some((e) => e.style.maxWidth === VIEWPORT_BREAKPOINTS.tabletMaxContentWidth),
        ).toBe(true);
      }

      const tabLabelsWithClipGuard = navEls.filter(
        (e) => e.type === 'Text' && e.props.numberOfLines === 1,
      );
      expect(tabLabelsWithClipGuard.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('keeps MedicineCard, DoseCard, Buttons, and StatusBadge shrink-safe and wrapped cleanly on 320px', () => {
    __setMockWindowWidth(320);

    const medEls = collectElements(
      MedicineCard({
        name: 'Amoxicillin + Clavulanic Acid Extra Long Brand 625 mg',
        genericName: 'Co-amoxiclav Trihydrate Extended Release',
        strength: '625 mg',
        dosageForm: 'Tablet',
        manufacturer: 'Square Pharmaceuticals PLC',
        stockText: '24 tablets',
        rightSubtext: '৳ 35.00 / unit',
        statusVariant: 'low_stock',
        onPress: vi.fn(),
      }),
    );
    expect(medEls.some((e) => e.style.minWidth === 0)).toBe(true);
    expect(medEls.some((e) => e.style.flexWrap === 'wrap')).toBe(true);
    expect(medEls.some((e) => e.style.padding === 12)).toBe(true);

    const doseEls = collectElements(
      DoseCard({
        medicineName: 'Escitalopram Oxalate 10 mg Extended Release Tablet',
        strength: '10 mg',
        doseInstruction: '1 tablet · After dinner with water',
        scheduledTime: '09:00 PM',
        status: 'upcoming',
        onMarkTaken: vi.fn(),
        onSkip: vi.fn(),
      }),
    );
    expect(doseEls.some((e) => e.style.minWidth === 0)).toBe(true);
    expect(doseEls.some((e) => e.style.minHeight === 40)).toBe(true);

    const badgeEls = collectElements(
      StatusBadge({ variant: 'unverified', label: 'Long Custom Status Badge' }),
    );
    expect(badgeEls[0].style.maxWidth).toBe('100%');
    expect(badgeEls[1].props.numberOfLines).toBe(1);

    const primaryBtnEls = collectElements(
      PrimaryButton({ label: 'Save Long Action Label', compact: true, onPress: vi.fn() }),
    );
    const secondaryBtnEls = collectElements(
      SecondaryButton({ label: 'Cancel', compact: true, onPress: vi.fn() }),
    );
    expect(primaryBtnEls[0].style.minHeight).toBe(40);
    expect(primaryBtnEls[0].style.paddingHorizontal).toBe(10);
    expect(secondaryBtnEls[0].style.minHeight).toBe(40);
    expect(secondaryBtnEls[0].style.paddingHorizontal).toBe(10);
    expect(primaryBtnEls.some((e) => e.type === 'Text' && e.props.numberOfLines === 1)).toBe(true);
    expect(primaryBtnEls.some((e) => e.style.minWidth === 0)).toBe(true);

    // Enlarged system fontScale on a 360px device stacks 2-column form rows automatically
    __setMockWindowWidth(360, 812, 1.15);
    const scaledFormEls = collectElements(
      FormRow({
        children: [
          React.createElement(FormCol, {
            key: 'a',
            children: React.createElement('Text', null, 'Left'),
          }),
          React.createElement(FormCol, {
            key: 'b',
            children: React.createElement('Text', null, 'Right'),
          }),
        ],
      }),
    );
    expect(scaledFormEls[0].style.flexDirection).toBe('column');
  });

  it('bounds BottomSheet, ConfirmDialog, and FeedbackStates within viewport padding and maxWidth', () => {
    for (const width of [320, 430, 768]) {
      __setMockWindowWidth(width);
      const expected = getResponsiveMetrics(width);

      const sheetEls = collectElements(
        BottomSheet({
          visible: true,
          title: 'Create Dose / Schedule',
          onClose: vi.fn(),
          onSubmit: vi.fn(),
          children: React.createElement('Text', null, 'Form body'),
        }),
      );
      const dialogEls = collectElements(
        ConfirmDialog({
          visible: true,
          title: 'Archive Medicine?',
          description: 'History records will stay preserved.',
          confirmLabel: 'Archive',
          onConfirm: vi.fn(),
          onCancel: vi.fn(),
        }),
      );

      expect(
        sheetEls.some((e) => e.style.paddingHorizontal === expected.modalHorizontalPadding),
      ).toBe(true);
      expect(sheetEls.some((e) => e.style.maxWidth === expected.modalMaxWidth)).toBe(true);
      expect(
        dialogEls.some((e) => e.style.paddingHorizontal === expected.modalHorizontalPadding),
      ).toBe(true);
      expect(dialogEls.some((e) => e.style.maxWidth === expected.modalMaxWidth)).toBe(true);
    }

    __setMockWindowWidth(320);
    const toastEls = collectElements(
      SuccessToast({ message: 'Dose logged for Glymexa 500 mg and stock updated automatically.' }),
    );
    const emptyEls = collectElements(
      EmptyState({
        title: 'No logs',
        description: 'No scheduled doses yet.',
        actionLabel: 'Add Dose',
        onAction: vi.fn(),
      }),
    );
    const errorEls = collectElements(ErrorState({ message: 'Network error', onRetry: vi.fn() }));
    const skeletonEls = collectElements(LoadingSkeleton({ rows: 2 }));

    expect(toastEls.some((e) => e.type === 'Text' && e.style.minWidth === 0)).toBe(true);
    expect(emptyEls[0].style.padding).toBe(16);
    expect(errorEls[0].style.padding).toBe(16);
    expect(skeletonEls.some((e) => e.style.padding === 12)).toBe(true);
    expect(skeletonEls.some((e) => e.style.minWidth === 0)).toBe(true);
  });
});
