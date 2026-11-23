import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setMockWindowWidth } from '../../test/mocks/react-native';
import { getResponsiveMetrics, VIEWPORT_BREAKPOINTS } from '../../theme/responsive';
import { computeKeyboardModalMetrics } from '../BottomSheetContext';
import { PrimaryButton, SecondaryButton } from '../Buttons';
import { DoseCard } from '../DoseCard';
import { EmptyState, ErrorState, LoadingSkeleton, SuccessToast } from '../FeedbackStates';
import { FormCol, FormRow } from '../FormFields';
import { MedicineCard } from '../MedicineCard';
import { BottomSheet, ConfirmDialog } from '../Overlays';
import { ScheduleModal } from '../ScheduleModal';
import { StatusBadge } from '../StatusBadge';
import { AppHeader } from '../AppHeader';
import { BottomNavigation } from '../BottomNavigation';
import { ScreenContainer } from '../ScreenContainer';
import ScheduleScreen from '../../../app/schedule';

const mockRouterPush = vi.fn();
const mockRouterNavigate = vi.fn();
const mockRouterBack = vi.fn();
const mockUpdateScheduleById = vi.fn(() => Promise.resolve(null));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const mockReact = {
    ...actual,
    useState: <T,>(init: T | (() => T)) =>
      [typeof init === 'function' ? (init as () => T)() : init, vi.fn()] as const,
    useRef: <T,>(init: T) => ({ current: init }),
    useEffect: vi.fn(),
    useCallback: <T,>(fn: T) => fn,
    useMemo: <T,>(fn: () => T) => fn(),
  };
  return {
    ...mockReact,
    default: mockReact,
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    navigate: mockRouterNavigate,
    back: mockRouterBack,
  }),
  usePathname: () => '/',
}));

vi.mock('../../features/medications/MedicationsContext', () => ({
  useMedications: () => ({
    medications: [
      {
        id: 'med-1',
        name: 'Napa',
        genericName: 'Paracetamol',
        strength: '500 mg',
        dosageForm: 'Tablet',
        instructions: 'After breakfast',
        stockRemaining: 30,
        stockUnit: 'tablets',
        unitPriceText: '৳1.20/tablet',
        lowStockThreshold: 5,
        archived: false,
      },
    ],
    loading: false,
  }),
}));

vi.mock('../../features/schedule/SchedulesContext', () => ({
  useSchedules: () => ({
    schedules: [
      {
        id: 'sched-1',
        patientMedicationId: 'med-1',
        doseAmount: 1,
        doseUnit: 'tablets',
        frequency: 'THREE_TIMES_DAILY',
        intervalHours: null,
        weekdays: [],
        scheduledTimes: ['08:00', '14:00', '22:00'],
        startDateYmd: '2026-11-23',
        endDateYmd: null,
        instructions: 'After breakfast',
        remindersEnabled: false,
        status: 'ACTIVE',
      },
    ],
    pendingOccurrenceKeys: {},
    getLocalRangeDoses: (startYmd: string, daysCount = 1) => ({
      startDate: startYmd,
      daysCount,
      timezone: 'Local',
      days: Array.from({ length: daysCount }, (_, idx) => ({
        date: idx === 0 ? startYmd : `2026-11-${23 + idx}`,
        totalCount: 1,
        takenCount: 0,
        skippedCount: 0,
        pendingCount: 1,
        items: [],
      })),
      summary: { total: 0, taken: 0, skipped: 0, remaining: 0 },
      nextDose: null,
    }),
    createSchedule: vi.fn(),
    updateScheduleById: mockUpdateScheduleById,
    recordDoseAction: vi.fn(),
  }),
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

function hasClass(el: ElementMatch, token: string): boolean {
  const raw = typeof el.props.className === 'string' ? el.props.className : '';
  return raw.split(/\s+/).includes(token);
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

  it('stacks FormRow vertically on 320px and keeps 2 columns side-by-side at >= 360px with min-w-0', () => {
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
    expect(hasClass(compactEls[0], 'flex-col')).toBe(true);
    expect(hasClass(compactEls[1], 'flex-1')).toBe(false);

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
      expect(hasClass(wideEls[0], 'flex-row')).toBe(true);
      expect(hasClass(wideEls[1], 'flex-1')).toBe(true);
      expect(hasClass(wideEls[1], 'min-w-0')).toBe(true);
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
      expect(headerEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);
      expect(headerEls.some((e) => hasClass(e, 'shrink-0'))).toBe(true);

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
    expect(medEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);
    expect(medEls.some((e) => hasClass(e, 'flex-wrap'))).toBe(true);
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
    expect(doseEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);
    expect(doseEls.some((e) => hasClass(e, 'min-h-[40px]'))).toBe(true);

    const badgeEls = collectElements(
      StatusBadge({ variant: 'unverified', label: 'Long Custom Status Badge' }),
    );
    expect(hasClass(badgeEls[0], 'max-w-full')).toBe(true);
    expect(badgeEls[1].props.numberOfLines).toBe(1);

    const primaryBtnEls = collectElements(
      PrimaryButton({ label: 'Save Long Action Label', compact: true, onPress: vi.fn() }),
    );
    const secondaryBtnEls = collectElements(
      SecondaryButton({ label: 'Cancel', compact: true, onPress: vi.fn() }),
    );
    expect(hasClass(primaryBtnEls[0], 'min-h-[40px]')).toBe(true);
    expect(hasClass(primaryBtnEls[0], 'px-2.5')).toBe(true);
    expect(hasClass(secondaryBtnEls[0], 'min-h-[40px]')).toBe(true);
    expect(hasClass(secondaryBtnEls[0], 'px-2.5')).toBe(true);
    expect(primaryBtnEls.some((e) => e.type === 'Text' && e.props.numberOfLines === 1)).toBe(true);
    expect(primaryBtnEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);

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
    expect(hasClass(scaledFormEls[0], 'flex-col')).toBe(true);
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

    expect(toastEls.some((e) => e.type === 'Text' && hasClass(e, 'min-w-0'))).toBe(true);
    expect(emptyEls[0].style.padding).toBe(16);
    expect(errorEls[0].style.padding).toBe(16);
    expect(skeletonEls.some((e) => e.style.padding === 12)).toBe(true);
    expect(skeletonEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);
  });

  it('computes keyboard-aware BottomSheet backdrop padding and maxHeight without overlap', () => {
    const closed = computeKeyboardModalMetrics({
      windowHeight: 800,
      safeTop: 28,
      safeBottom: 16,
      keyboardInset: 0,
    });
    expect(closed.backdropPaddingBottom).toBe(0);
    expect(closed.sheetPaddingBottom).toBe(28);
    expect(closed.sheetMaxHeight).toBe(704);

    const keyboardOpen = computeKeyboardModalMetrics({
      windowHeight: 800,
      safeTop: 28,
      safeBottom: 16,
      keyboardInset: 320,
    });
    expect(keyboardOpen.backdropPaddingBottom).toBe(320);
    expect(keyboardOpen.sheetPaddingBottom).toBe(12);
    expect(keyboardOpen.sheetMaxHeight).toBe(800 - 320 - 36);
    expect(keyboardOpen.backdropPaddingBottom + keyboardOpen.sheetMaxHeight).toBeLessThanOrEqual(800);
  });

  it('keeps ScheduleScreen Saved Schedules responsive across 320px-768px, wires Dose History navigation, and prevents automatic medicine selection in ScheduleModal', () => {
    mockRouterPush.mockClear();

    for (const width of [320, 360, 390, 768]) {
      __setMockWindowWidth(width);
      const metrics = getResponsiveMetrics(width);
      const screenEls = collectElements(ScheduleScreen());

      const doseHistoryBtn = screenEls.find(
        (e) => e.props.accessibilityLabel === 'Open Dose History',
      );
      expect(doseHistoryBtn).toBeDefined();
      expect(hasClass(doseHistoryBtn!, 'min-h-[38px]')).toBe(true);
      expect(doseHistoryBtn!.props.hitSlop).toBe(8);

      const editBtn = screenEls.find(
        (e) => e.props.accessibilityLabel === 'Edit Napa 500 mg schedule',
      );
      const pauseBtn = screenEls.find(
        (e) => e.props.accessibilityLabel === 'Pause Napa 500 mg schedule',
      );
      expect(editBtn).toBeDefined();
      expect(pauseBtn).toBeDefined();
      expect(hasClass(editBtn!, 'min-h-[40px]')).toBe(true);
      expect(hasClass(pauseBtn!, 'min-h-[40px]')).toBe(true);
      if (metrics.stackTwoCol) {
        expect(hasClass(editBtn!, 'w-full')).toBe(true);
      } else {
        expect(hasClass(editBtn!, 'flex-1')).toBe(true);
        expect(hasClass(editBtn!, 'min-w-0')).toBe(true);
      }
    }

    // Clicking Dose History navigates cleanly to /history?from=schedule
    const defaultEls = collectElements(ScheduleScreen());
    const historyBtn = defaultEls.find((e) => e.props.accessibilityLabel === 'Open Dose History');
    (historyBtn!.props.onPress as () => void)();
    expect(mockRouterPush).toHaveBeenCalledWith('/history?from=schedule');

    // ScheduleModal opened normally does not auto-select any medicine and gates Save
    const schedModalEls = collectElements(
      ScheduleModal({
        visible: true,
        onClose: vi.fn(),
        onSaved: vi.fn(),
      }),
    );
    const selectPlaceholderBtn = schedModalEls.find(
      (e) => e.props.accessibilityLabel === 'Select a medicine',
    );
    expect(selectPlaceholderBtn).toBeDefined();
    expect(
      schedModalEls.some((e) => e.props.accessibilityLabel === 'Change medicine'),
    ).toBe(false);
    const saveScheduleBtn = schedModalEls.find(
      (e) => e.props.accessibilityLabel === 'Save Schedule',
    );
    expect(saveScheduleBtn?.props.disabled).toBe(true);
  });
});
