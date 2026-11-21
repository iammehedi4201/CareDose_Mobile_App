import { describe, expect, it } from 'vitest';
import {
  CAREDOSE_COLORS,
  CAREDOSE_RADIUS,
  CAREDOSE_SPACING,
  CAREDOSE_TYPOGRAPHY,
  PRIMARY_BOTTOM_TABS,
  SECONDARY_PROFILE_DESTINATIONS,
} from './tokens';

describe('CareDose Design System Tokens & Navigation Rules', () => {
  it('defines the exact CareDose v1.5 colour palette', () => {
    expect(CAREDOSE_COLORS).toEqual({
      primary: '#087E67',
      primaryDark: '#075D4E',
      mintSurface: '#EAF7F1',
      background: '#F7FAF8',
      success: '#16815B',
      warning: '#CB881F',
      error: '#CC5650',
      info: '#538BCF',
      border: '#E4ECE7',
      mainText: '#18312D',
    });
  });

  it('enforces the exact 5-tab bottom navigation order (Home -> Schedule -> Medicines -> Explore -> Profile)', () => {
    expect(PRIMARY_BOTTOM_TABS.map((t) => t.label)).toEqual([
      'Home',
      'Schedule',
      'Medicines',
      'Explore',
      'Profile',
    ]);
  });

  it('keeps Health Log, Dose History, Expenses, Purchases, Alternatives, and Settings as secondary destinations', () => {
    const primaryKeys = new Set(PRIMARY_BOTTOM_TABS.map((t) => t.key));
    for (const dest of SECONDARY_PROFILE_DESTINATIONS) {
      expect(primaryKeys.has(dest.key as never)).toBe(false);
    }
    expect(SECONDARY_PROFILE_DESTINATIONS).toHaveLength(6);
  });

  it('uses the approved spacing scale and radii', () => {
    expect(CAREDOSE_SPACING).toEqual([4, 8, 12, 16, 24, 32]);
    expect(CAREDOSE_RADIUS.card).toBeGreaterThanOrEqual(14);
    expect(CAREDOSE_RADIUS.card).toBeLessThanOrEqual(18);
    expect(CAREDOSE_RADIUS.field).toBeGreaterThanOrEqual(10);
    expect(CAREDOSE_RADIUS.field).toBeLessThanOrEqual(12);
    expect(CAREDOSE_TYPOGRAPHY.screenTitle.fontSize).toBe(24);
  });
});
