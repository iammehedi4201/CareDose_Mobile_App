import { describe, expect, it } from 'vitest';
import { getResponsiveMetrics, VIEWPORT_BREAKPOINTS } from './responsive';

describe('CareDose Responsive Viewport Metrics (320px - 768px+)', () => {
  it('adapts 320px very small screens by stacking 2-column grids and tightening padding', () => {
    const m320 = getResponsiveMetrics(320);
    expect(m320.tier).toBe('compact');
    expect(m320.isCompact).toBe(true);
    expect(m320.stackTwoCol).toBe(true);
    expect(m320.useShortWeekdayLabels).toBe(true);
    expect(m320.screenPadding).toBe(12);
    expect(m320.tabPillPaddingX).toBe(8);
    expect(m320.maxContentWidth).toBeUndefined();
  });

  it('uses side-by-side 2-column grids and standard padding across 360px, 375px, and 390px screens', () => {
    for (const width of [360, 375, 390]) {
      const m = getResponsiveMetrics(width);
      expect(m.tier).toBe('standard');
      expect(m.isCompact).toBe(false);
      expect(m.stackTwoCol).toBe(false);
      expect(m.useShortWeekdayLabels).toBe(false);
      expect(m.screenPadding).toBe(16);
      expect(m.cardPadding).toBe(14);
    }
  });

  it('scales spacing smoothly for 414px and 430px wide phones', () => {
    for (const width of [414, 430]) {
      const m = getResponsiveMetrics(width);
      expect(m.tier).toBe('large');
      expect(m.stackTwoCol).toBe(false);
      expect(m.screenPadding).toBe(18);
      expect(m.cardPadding).toBe(16);
      expect(m.tabPillPaddingX).toBe(16);
    }
  });

  it('caps readable content width on tablet and desktop viewports (>= 768px)', () => {
    const m768 = getResponsiveMetrics(768);
    expect(m768.tier).toBe('tablet');
    expect(m768.isTabletOrWide).toBe(true);
    expect(m768.maxContentWidth).toBe(VIEWPORT_BREAKPOINTS.tabletMaxContentWidth);
    expect(m768.modalMaxWidth).toBe(540);
  });

  it('falls back safely when invalid or zero dimensions are passed', () => {
    expect(getResponsiveMetrics(0).width).toBe(375);
    expect(getResponsiveMetrics(Number.NaN).tier).toBe('standard');
  });

  it('accounts for system fontScale so enlarged accessibility text stacks 2-col layouts cleanly', () => {
    const scaled360 = getResponsiveMetrics(360, 1.15);
    expect(scaled360.tier).toBe('compact');
    expect(scaled360.stackTwoCol).toBe(true);
    expect(scaled360.screenPadding).toBe(12);
    expect(scaled360.effectiveWidth).toBeLessThan(320);

    const normal360 = getResponsiveMetrics(360, 1);
    expect(normal360.tier).toBe('standard');
    expect(normal360.stackTwoCol).toBe(false);
  });
});
