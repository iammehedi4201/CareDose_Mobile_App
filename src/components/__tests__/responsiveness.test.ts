import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setMockWindowWidth } from '../../test/mocks/react-native';
import { getResponsiveMetrics, VIEWPORT_BREAKPOINTS } from '../../theme/responsive';
import { computeKeyboardModalMetrics } from '../BottomSheetContext';
import { PrimaryButton, SecondaryButton } from '../Buttons';
import { DoseCard } from '../DoseCard';
import { DoseProgressCard } from '../DoseProgressCard';
import { EmptyState, ErrorState, LoadingSkeleton, SuccessToast } from '../FeedbackStates';
import { FormCol, FormRow } from '../FormFields';
import { MedicineCard } from '../MedicineCard';
import { BottomSheet, ConfirmDialog } from '../Overlays';
import { ScheduleModal } from '../ScheduleModal';
import { StatusBadge } from '../StatusBadge';
import { AppHeader } from '../AppHeader';
import { BottomNavigation } from '../BottomNavigation';
import { ScreenContainer } from '../ScreenContainer';
import HomeScreen from '../../../app/index';
import ScheduleScreen from '../../../app/schedule';
import ManageSchedulesScreen from '../../../app/schedules';
import DoseHistoryScreen from '../../../app/history';

const mockRouterPush = vi.fn();
const mockRouterNavigate = vi.fn();
const mockRouterBack = vi.fn();
const mockUpdateScheduleById = vi.fn(() => Promise.resolve(null));
const mockArchiveScheduleById = vi.fn(() => Promise.resolve(null));
const mockRecordDoseAction = vi.fn(async () => ({
  status: 'taken' as const,
  stockDeducted: true,
  deductedQuantity: 1,
  stockUnit: 'tablet',
  idempotentReplay: false,
}));
const mockQueryDoseHistory = vi.fn(async () => ({
  items: [],
  counts: { all: 0, taken: 0, skipped: 0, missed: 0 },
  hasMore: false,
  nextCursor: null,
}));
let mockSchedulesOverride: unknown[] | null = null;
let mockDayItemsOverride: unknown[] | null = null;
let mockUseStateOverrides: unknown[] | null = null;
let mockUseStateIndex = 0;

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const mockReact = {
    ...actual,
    useState: <T,>(init: T | (() => T)) => {
      if (mockUseStateOverrides && mockUseStateIndex < mockUseStateOverrides.length) {
        const val = mockUseStateOverrides[mockUseStateIndex] as T;
        mockUseStateIndex += 1;
        return [val, vi.fn()] as const;
      }
      return [typeof init === 'function' ? (init as () => T)() : init, vi.fn()] as const;
    },
    useRef: <T,>(init: T) => ({ current: init }),
    useEffect: vi.fn(),
    useCallback: <T,>(fn: T) => fn,
    useMemo: <T,>(fn: () => T) => fn(),
    useContext: <T,>(ctx: React.Context<T>) =>
      (ctx as unknown as { _currentValue: T })._currentValue,
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
  useLocalSearchParams: () => ({}),
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
      {
        id: 'med-2',
        name: 'Seclo',
        genericName: 'Omeprazole',
        strength: '20 mg',
        dosageForm: 'Capsule',
        instructions: 'Before breakfast',
        stockRemaining: 14,
        stockUnit: 'capsules',
        unitPriceText: '৳7.00/capsule',
        lowStockThreshold: 5,
        archived: false,
      },
    ],
    loading: false,
  }),
}));

vi.mock('../../features/schedule/SchedulesContext', () => ({
  useSchedules: () => ({
    schedules: mockSchedulesOverride ?? [
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
    doseEvents: [],
    loading: false,
    pendingOccurrenceKeys: {},
    getLocalRangeDoses: (startYmd: string, daysCount = 1) => ({
      startDate: startYmd,
      daysCount,
      timezone: 'Local',
      days: Array.from({ length: daysCount }, (_, idx) => {
        const items = idx === 0 && mockDayItemsOverride ? mockDayItemsOverride : [];
        return {
          date: idx === 0 ? startYmd : `2026-11-${23 + idx}`,
          totalCount: items.length || 1,
          takenCount: 0,
          skippedCount: 0,
          pendingCount: items.length || 1,
          items,
        };
      }),
      summary: { total: 0, taken: 0, skipped: 0, remaining: 0 },
      nextDose:
        (mockDayItemsOverride as Array<{ status?: string }> | null)?.find(
          (i) => i.status === 'due' || i.status === 'upcoming',
        ) ?? null,
    }),
    createSchedule: vi.fn(),
    updateScheduleById: mockUpdateScheduleById,
    archiveScheduleById: mockArchiveScheduleById,
    recordDoseAction: mockRecordDoseAction,
    queryDoseHistory: mockQueryDoseHistory,
    refreshSchedules: vi.fn(async () => {}),
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
    if (node.type === 'Modal' && props.visible === false) {
      return out;
    }
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

    const doseCases = [
      {
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseInstruction: '1 tablet · After breakfast',
        scheduledTime: '09:00 AM',
        expectedAmount: '1 tablet',
      },
      {
        medicineName: 'Escitalopram Oxalate Extended Release Coated Tablet',
        strength: '10 mg',
        dosageForm: 'Capsule',
        doseInstruction:
          '2 capsules · Take after dinner with a full glass of lukewarm water and avoid lying down',
        scheduledTime: '10:30 PM',
        expectedAmount: '2 capsules',
      },
      {
        medicineName: '3-C Syrup',
        strength: '100 mg/5 ml',
        dosageForm: 'Syrup',
        doseInstruction: '2.5 mL · Shake bottle thoroughly before measuring',
        scheduledTime: '02:00 PM',
        expectedAmount: '2.5 mL',
      },
    ];

    for (const c of doseCases) {
      const doseEls = collectElements(
        DoseCard({
          medicineName: c.medicineName,
          strength: c.strength,
          doseInstruction: c.doseInstruction,
          scheduledTime: c.scheduledTime,
          status: 'upcoming',
          onMarkTaken: vi.fn(),
          onSkip: vi.fn(),
        }),
      );
      expect(doseEls.some((e) => hasClass(e, 'min-w-0'))).toBe(true);
      expect(doseEls.some((e) => hasClass(e, 'min-h-[40px]'))).toBe(true);
      expect(doseEls.some((e) => e.type === 'Image')).toBe(false);
      // Calm aligned text block beside 34px clock icon, without oversized bold/pills
      expect(doseEls.some((e) => hasClass(e, 'h-[34px]') && hasClass(e, 'w-[34px]'))).toBe(true);
      const fullTitle = `${c.medicineName} ${c.strength}`;
      const titleEl = doseEls.find((e) => e.props.children === fullTitle);
      const detailsEl = doseEls.find(
        (e) => e.props.accessibilityLabel === `Dose details ${c.doseInstruction}`,
      );
      const timeEl = doseEls.find(
        (e) => e.props.accessibilityLabel === `Scheduled time ${c.scheduledTime}`,
      );
      expect(Boolean(titleEl && hasClass(titleEl, 'font-semibold'))).toBe(true);
      expect(detailsEl).toBeDefined();
      expect(Boolean(timeEl && hasClass(timeEl, 'text-primary'))).toBe(true);
      expect(hasClass(timeEl!, 'bg-mint')).toBe(false);

      const takenAction = doseEls.find(
        (e) => e.props.accessibilityLabel === `Mark ${fullTitle} as taken`,
      );
      const skipAction = doseEls.find(
        (e) => e.props.accessibilityLabel === `Skip ${fullTitle}`,
      );
      expect(takenAction).toBeDefined();
      expect(skipAction).toBeDefined();
      expect(hasClass(takenAction!, 'flex-1')).toBe(true);
      expect(hasClass(takenAction!, 'bg-white')).toBe(true);
      expect(hasClass(skipAction!, 'flex-1')).toBe(true);
      expect(hasClass(skipAction!, 'bg-white')).toBe(true);
    }

    const progressEls = collectElements(
      DoseProgressCard({
        takenCount: 2,
        totalCount: 5,
        upcomingCount: 1,
        overdueCount: 2,
        label: "Today's progress",
      }),
    );
    expect(
      progressEls.some(
        (e) => e.props.accessibilityLabel === "Today's progress: 2 of 5 doses taken",
      ),
    ).toBe(true);
    expect(
      progressEls.some((e) => e.props.accessibilityLabel === 'Total scheduled doses 5'),
    ).toBe(true);
    expect(progressEls.some((e) => e.props.accessibilityLabel === 'Taken doses 2')).toBe(true);
    expect(progressEls.some((e) => e.props.accessibilityLabel === 'Upcoming doses 1')).toBe(
      true,
    );
    expect(progressEls.some((e) => e.props.accessibilityLabel === 'Overdue doses 2')).toBe(true);
    expect(progressEls.some((e) => Array.isArray(e.props.children) && e.props.children.join('') === '2/5')).toBe(true);

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

  it('keeps ScheduleScreen focused on daily doses with Manage Schedules and Dose History secondary links, and validates ManageSchedulesScreen + DoseHistoryScreen', () => {
    mockRouterPush.mockClear();

    for (const width of [320, 360, 390, 768]) {
      __setMockWindowWidth(width);
      const metrics = getResponsiveMetrics(width);

      // ScheduleScreen has Add Dose + overflow menu button, Day/Week toggle, and NO bottom Manage Schedules/Dose History cards when menu is closed
      const scheduleEls = collectElements(ScheduleScreen());
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Schedule options'),
      ).toBe(true);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Day view'),
      ).toBe(true);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Week view'),
      ).toBe(true);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Open Manage Schedules'),
      ).toBe(false);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Open Dose History'),
      ).toBe(false);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Edit Napa 500 mg schedule'),
      ).toBe(false);
      expect(
        scheduleEls.some((e) => e.props.accessibilityLabel === 'Pause Napa 500 mg schedule'),
      ).toBe(false);

      // ManageSchedulesScreen renders summary + Edit/Pause/Archive cleanly across breakpoints without Taken/Skip
      const manageScreenEls = collectElements(ManageSchedulesScreen());
      expect(
        manageScreenEls.some((e) => e.props.accessibilityLabel === 'Total schedules 1'),
      ).toBe(true);
      expect(
        manageScreenEls.some((e) => e.props.accessibilityLabel === 'Active schedules 1'),
      ).toBe(true);
      const editBtn = manageScreenEls.find(
        (e) => e.props.accessibilityLabel === 'Edit Napa schedule',
      );
      const pauseBtn = manageScreenEls.find(
        (e) => e.props.accessibilityLabel === 'Pause Napa schedule',
      );
      const archiveBtn = manageScreenEls.find(
        (e) => e.props.accessibilityLabel === 'Archive Napa schedule',
      );
      expect(editBtn).toBeDefined();
      expect(pauseBtn).toBeDefined();
      expect(archiveBtn).toBeDefined();
      expect(manageScreenEls.some((e) => e.props.children === 'Taken')).toBe(false);
      expect(manageScreenEls.some((e) => e.props.children === 'Skip')).toBe(false);
      if (metrics.stackTwoCol) {
        expect(hasClass(editBtn!, 'w-full')).toBe(true);
      } else {
        expect(hasClass(editBtn!, 'flex-1')).toBe(true);
      }
    }

    // Opening Schedule Options overflow menu displays Manage Schedules & Dose History and navigates cleanly
    mockUseStateIndex = 0;
    mockUseStateOverrides = ['day', '2026-11-23', null, false, true];
    const openMenuScheduleEls = collectElements(ScheduleScreen());
    mockUseStateOverrides = null;
    mockUseStateIndex = 0;

    expect(
      openMenuScheduleEls.some((e) => e.props.children === 'Schedule Options'),
    ).toBe(true);
    const manageMenuItem = openMenuScheduleEls.find(
      (e) => e.props.accessibilityLabel === 'Open Manage Schedules',
    );
    const historyMenuItem = openMenuScheduleEls.find(
      (e) => e.props.accessibilityLabel === 'Open Dose History',
    );
    expect(manageMenuItem).toBeDefined();
    expect(historyMenuItem).toBeDefined();
    const backdropClose = openMenuScheduleEls.find(
      (e) => e.props.accessibilityLabel === 'Close dialog',
    );
    const activeModal = openMenuScheduleEls.find(
      (e) => e.type === 'Modal' && e.props.visible === true,
    );
    expect(backdropClose).toBeDefined();
    expect(activeModal).toBeDefined();
    expect(() => (backdropClose!.props.onPress as () => void)()).not.toThrow();
    expect(() => (activeModal!.props.onRequestClose as () => void)()).not.toThrow();

    (manageMenuItem!.props.onPress as () => void)();
    expect(mockRouterPush).toHaveBeenCalledWith('/schedules');
    (historyMenuItem!.props.onPress as () => void)();
    expect(mockRouterPush).toHaveBeenCalledWith('/history?from=schedule');

    // Empty state on ManageSchedulesScreen renders exact required copy
    mockSchedulesOverride = [];
    const emptyManageEls = collectElements(ManageSchedulesScreen());
    mockSchedulesOverride = null;
    expect(
      emptyManageEls.some(
        (e) =>
          e.props.children ===
          'No schedules yet. Create a medication schedule to organise your daily doses.',
      ),
    ).toBe(true);

    // DoseHistoryScreen renders All / Taken / Skipped / Missed filter chips and exact empty state copy
    mockUseStateIndex = 0;
    mockUseStateOverrides = [
      '2026-11-09',
      '2026-11-23',
      'all',
      null,
      [],
      { all: 0, taken: 0, skipped: 0, missed: 0 },
      false,
      null,
      false,
      false,
      null,
    ];
    const historyEls = collectElements(DoseHistoryScreen());
    mockUseStateOverrides = null;
    mockUseStateIndex = 0;
    expect(historyEls.some((e) => String(e.props.children ?? '').startsWith('Missed'))).toBe(true);
    expect(
      historyEls.some(
        (e) => e.props.children === 'No dose history yet. Your recorded doses will appear here.',
      ),
    ).toBe(true);

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

    // Clicking "Select a medicine" lists only unscheduled medicines (Seclo), never booked Napa
    const openedListEls = collectElements(
      ScheduleModal({
        visible: true,
        onClose: vi.fn(),
        onSaved: vi.fn(),
      }),
    );
    expect(
      openedListEls.some((e) => e.props.accessibilityLabel === 'Select Napa'),
    ).toBe(false);
    // Editing the booked Napa schedule still renders Napa cleanly
    const editNapaEls = collectElements(
      ScheduleModal({
        visible: true,
        editingSchedule: {
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
        onClose: vi.fn(),
        onSaved: vi.fn(),
      }),
    );
    expect(editNapaEls.some((e) => e.props.children === 'Napa')).toBe(true);
  });

  it('verifies all 5 DoseCard statuses, single/multi-dose Schedule progress counters without counting skipped/missed as completed, Week view, and overflow menu closing', () => {
    const sampleStatuses = ['upcoming', 'due', 'taken', 'skipped', 'missed'] as const;
    const expectedLabels: Record<(typeof sampleStatuses)[number], string> = {
      upcoming: 'Status: Upcoming',
      due: 'Status: Due now',
      taken: 'Status: Taken',
      skipped: 'Status: Skipped',
      missed: 'Status: Missed',
    };

    for (const st of sampleStatuses) {
      const cardEls = collectElements(
        DoseCard({
          medicineName: 'Napa',
          strength: '500 mg',
          doseInstruction: '1 tablet · After breakfast',
          scheduledTime: '09:00 AM',
          status: st,
          onMarkTaken: vi.fn(),
          onSkip: vi.fn(),
        }),
      );
      expect(cardEls.some((e) => e.props.accessibilityLabel === expectedLabels[st])).toBe(true);
      const showsButtons = st !== 'taken' && st !== 'skipped';
      expect(
        cardEls.some((e) => e.props.accessibilityLabel === 'Mark Napa 500 mg as taken'),
      ).toBe(showsButtons);
      expect(
        cardEls.some((e) => e.props.accessibilityLabel === 'Skip Napa 500 mg'),
      ).toBe(showsButtons);
    }

    // Multi-dose schedule day: 1 taken, 1 skipped, 1 missed, 1 due, 1 upcoming -> Total 5, Taken 1 (NOT 2), Upcoming 2, Overdue 1
    mockDayItemsOverride = [
      {
        occurrenceKey: 'k1',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet · After breakfast',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '08:00',
        scheduledTime12: '08:00 AM',
        scheduledFor: '2026-11-23T02:00:00.000Z',
        period: 'Morning',
        status: 'taken',
        recordedAt: '2026-11-23T02:05:00.000Z',
        note: null,
      },
      {
        occurrenceKey: 'k2',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet · After breakfast',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '09:00',
        scheduledTime12: '09:00 AM',
        scheduledFor: '2026-11-23T03:00:00.000Z',
        period: 'Morning',
        status: 'skipped',
        recordedAt: '2026-11-23T03:05:00.000Z',
        note: null,
      },
      {
        occurrenceKey: 'k3',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Seclo',
        strength: '20 mg',
        dosageForm: 'Capsule',
        doseAmount: '1',
        doseUnit: 'capsule',
        doseInstruction: '1 capsule · Before lunch',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '13:00',
        scheduledTime12: '01:00 PM',
        scheduledFor: '2026-11-23T07:00:00.000Z',
        period: 'Afternoon',
        status: 'missed',
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'k4',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '18:00',
        scheduledTime12: '06:00 PM',
        scheduledFor: '2026-11-23T12:00:00.000Z',
        period: 'Evening',
        status: 'due',
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'k5',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet · Bedtime',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '22:00',
        scheduledTime12: '10:00 PM',
        scheduledFor: '2026-11-23T16:00:00.000Z',
        period: 'Bedtime',
        status: 'upcoming',
        recordedAt: null,
        note: null,
      },
    ];
    mockUseStateIndex = 0;
    mockUseStateOverrides = ['day', '2026-11-23', null, false, false];
    const multiDayEls = collectElements(ScheduleScreen());
    mockUseStateOverrides = null;
    mockUseStateIndex = 0;

    expect(
      multiDayEls.some((e) => e.props.accessibilityLabel === 'Daily progress: 1 of 5 doses taken'),
    ).toBe(true);
    expect(multiDayEls.some((e) => e.props.accessibilityLabel === 'Total scheduled doses 5')).toBe(
      true,
    );
    expect(multiDayEls.some((e) => e.props.accessibilityLabel === 'Taken doses 1')).toBe(true);
    expect(multiDayEls.some((e) => e.props.accessibilityLabel === 'Upcoming doses 2')).toBe(true);
    expect(multiDayEls.some((e) => e.props.accessibilityLabel === 'Overdue doses 1')).toBe(true);

    // Single-dose schedule day stays clean without bottom Manage Schedules / Dose History cards
    mockDayItemsOverride = [mockDayItemsOverride[0]];
    mockUseStateIndex = 0;
    mockUseStateOverrides = ['week', '2026-11-23', null, false, false];
    const weekSingleEls = collectElements(ScheduleScreen());
    mockUseStateOverrides = null;
    mockUseStateIndex = 0;
    mockDayItemsOverride = null;

    expect(
      weekSingleEls.some((e) => e.props.accessibilityLabel === 'Previous week'),
    ).toBe(true);
    expect(
      weekSingleEls.some((e) => e.props.accessibilityLabel === 'Open Manage Schedules'),
    ).toBe(false);
    expect(
      weekSingleEls.some((e) => e.props.accessibilityLabel === 'Open Dose History'),
    ).toBe(false);
  });

  it('renders redesigned HomeScreen with progress tiles, Next dose hero, compact Today schedule summary, supplies banner, and Quick overview across 320px-768px', () => {
    mockRouterPush.mockClear();
    mockRecordDoseAction.mockClear();

    mockDayItemsOverride = [
      {
        occurrenceKey: 'h1',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet · After breakfast',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '08:00',
        scheduledTime12: '08:00 AM',
        scheduledFor: '2026-11-23T02:00:00.000Z',
        period: 'Morning',
        status: 'missed',
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'h2',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Napa',
        strength: '500 mg',
        dosageForm: 'Tablet',
        doseAmount: '1',
        doseUnit: 'tablet',
        doseInstruction: '1 tablet · After breakfast',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '14:00',
        scheduledTime12: '02:00 PM',
        scheduledFor: '2026-11-23T08:00:00.000Z',
        period: 'Afternoon',
        status: 'upcoming',
        recordedAt: null,
        note: null,
      },
      {
        occurrenceKey: 'h3',
        scheduleId: 'sched-1',
        patientMedicationId: 'med-1',
        medicineName: 'Seclo',
        strength: '20 mg',
        dosageForm: 'Capsule',
        doseAmount: '1',
        doseUnit: 'capsule',
        doseInstruction: '1 capsule · Bedtime',
        scheduledDateYmd: '2026-11-23',
        scheduledTime24: '22:00',
        scheduledTime12: '10:00 PM',
        scheduledFor: '2026-11-23T16:00:00.000Z',
        period: 'Bedtime',
        status: 'upcoming',
        recordedAt: null,
        note: null,
      },
    ];

    for (const width of [320, 360, 390, 768]) {
      __setMockWindowWidth(width);
      const els = collectElements(HomeScreen());

      // Header illustration image renders on HomeScreen
      expect(els.some((e) => e.type === 'Image')).toBe(true);

      // Progress tiles: Scheduled 3, Overdue 1, Upcoming 2
      expect(
        els.some((e) => e.props.accessibilityLabel === "Today's progress: 0 of 3 doses taken"),
      ).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'Total scheduled doses 3')).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'Overdue doses 1')).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'Upcoming doses 2')).toBe(true);

      // Next dose hero + Take now + View schedule
      const takeNowBtn = els.find((e) => e.props.accessibilityLabel === 'Take now');
      expect(takeNowBtn).toBeDefined();
      expect(hasClass(takeNowBtn!, 'rounded-full')).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'View schedule')).toBe(true);

      // Compact Today's schedule period rows + See all 3
      expect(els.some((e) => e.props.accessibilityLabel === 'See all 3 doses')).toBe(true);
      expect(
        els.some((e) => e.props.accessibilityLabel === 'Morning, 1 scheduled doses, 1 overdue'),
      ).toBe(true);
      expect(
        els.some(
          (e) => e.props.accessibilityLabel === 'Afternoon, 1 scheduled doses, 1 upcoming',
        ),
      ).toBe(true);

      // Supplies banner + Quick overview cards
      expect(
        els.some(
          (e) => e.props.accessibilityLabel === 'Medicine supplies: No medicines are low on stock',
        ),
      ).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'Latest glucose 106 mg/dL')).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'Monthly spend ৳ 720')).toBe(true);
    }

    // Trigger interactions on HomeScreen
    const homeEls = collectElements(HomeScreen());
    (homeEls.find((e) => e.props.accessibilityLabel === 'Take now')!.props.onPress as () => void)();
    expect(mockRecordDoseAction).toHaveBeenCalledTimes(1);

    (
      homeEls.find((e) => e.props.accessibilityLabel === 'See all 3 doses')!.props
        .onPress as () => void
    )();
    expect(mockRouterPush).toHaveBeenCalledWith('/schedule');

    (
      homeEls.find(
        (e) => e.props.accessibilityLabel === 'Medicine supplies: No medicines are low on stock',
      )!.props.onPress as () => void
    )();
    expect(mockRouterPush).toHaveBeenCalledWith('/medicines');

    (
      homeEls.find((e) => e.props.accessibilityLabel === 'Monthly spend ৳ 720')!.props
        .onPress as () => void
    )();
    expect(mockRouterPush).toHaveBeenCalledWith('/expenses');

    mockDayItemsOverride = null;
  });
});
