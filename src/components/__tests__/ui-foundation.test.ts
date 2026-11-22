import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MIN_TOUCH_TARGET,
  PRIMARY_BOTTOM_TABS,
  resolveActiveBottomTab,
  SECONDARY_PROFILE_DESTINATIONS,
} from '../../theme/tokens';
import { getStatusBadgeConfig } from '../StatusBadge';
import { isButtonInteractive } from '../Buttons';
import { formatMedicineMeta, resolveDosageFormIcon } from '../MedicineCard';
import {
  formatDisplayDate,
  formatIsoDateString,
  formatTimeString,
  parseIsoDateString,
  parseTimeString,
  validateRequiredFields,
} from '../FormFields';

describe('Phase 2 — Mobile UI Foundation & Design System Component Logic', () => {
  it('resolves the active bottom tab accurately for all primary and secondary routes', () => {
    expect(resolveActiveBottomTab('/')).toBe('home');
    expect(resolveActiveBottomTab('/index')).toBe('home');
    expect(resolveActiveBottomTab('/schedule')).toBe('schedule');
    expect(resolveActiveBottomTab('/medicines')).toBe('medicines');
    expect(resolveActiveBottomTab('/medicines/m1')).toBe('medicines');
    expect(resolveActiveBottomTab('/explore')).toBe('explore');
    expect(resolveActiveBottomTab('/explore/brands/1')).toBe('explore');

    // All 6 secondary destinations highlight Profile in the 5-tab bar
    for (const dest of SECONDARY_PROFILE_DESTINATIONS) {
      expect(resolveActiveBottomTab(dest.route)).toBe('profile');
    }
  });

  it('always pairs status colours with a non-empty visible text label', () => {
    const variants = [
      'in_stock',
      'low_stock',
      'out_of_stock',
      'taken',
      'skipped',
      'missed',
      'upcoming',
      'due',
      'unverified',
      'verified',
      'active',
      'archived',
    ] as const;

    for (const variant of variants) {
      const cfg = getStatusBadgeConfig(variant);
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(cfg.textColor).toMatch(/^#[0-9A-F]{6}$/i);
    }

    expect(getStatusBadgeConfig('unverified', 'Custom Unverified').label).toBe(
      'Custom Unverified',
    );
  });

  it('prevents duplicate button submission when disabled or loading', () => {
    expect(isButtonInteractive(false, false)).toBe(true);
    expect(isButtonInteractive(true, false)).toBe(false);
    expect(isButtonInteractive(false, true)).toBe(false);
    expect(isButtonInteractive(true, true)).toBe(false);
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });

  it('formats medicine metadata with explicit "Not available" when strength or form is missing', () => {
    expect(formatMedicineMeta('100 mg', 'Tablet', 'Aceclofenac')).toBe(
      'Aceclofenac · 100 mg · Tablet',
    );
    expect(formatMedicineMeta(null, 'IV Infusion', 'Dextrose')).toBe(
      'Dextrose · Strength: Not available · IV Infusion',
    );
    expect(formatMedicineMeta('', null, null)).toBe(
      'Strength: Not available · Form: Not available',
    );
  });

  it('maps dosage forms to distinct accessible icon names', () => {
    expect(resolveDosageFormIcon('Syrup')).toBe('droplet');
    expect(resolveDosageFormIcon('Eye Drops')).toBe('droplet');
    expect(resolveDosageFormIcon('IV Infusion')).toBe('thermometer');
    expect(resolveDosageFormIcon('Cream')).toBe('feather');
    expect(resolveDosageFormIcon('Tablet')).toBe('disc');
  });

  it('validates required form fields and preserves errors per field key', () => {
    const errors = validateRequiredFields(
      { medName: '  ', medInstructions: '1 tablet after meal', startingStock: '' },
      {
        medName: 'Medicine name',
        medInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
      },
    );

    expect(errors).toEqual({
      medName: 'Medicine name is required',
      startingStock: 'Starting stock is required',
    });

    const clean = validateRequiredFields(
      { medName: 'Celofen', medInstructions: '1 tablet', startingStock: 10 },
      {
        medName: 'Medicine name',
        medInstructions: 'Personal instructions',
        startingStock: 'Starting stock',
      },
    );
    expect(clean).toEqual({});
  });

  it('enforces the 5-tab navigation structure with zero duplicate tabs', () => {
    expect(PRIMARY_BOTTOM_TABS).toHaveLength(5);
    const routes = PRIMARY_BOTTOM_TABS.map((t) => t.route);
    expect(new Set(routes).size).toBe(5);
  });

  it('parses and formats ISO dates and 12-hour times for DateField and TimeField pickers', () => {
    const parsedDate = parseIsoDateString('2026-11-21');
    expect(formatIsoDateString(parsedDate)).toBe('2026-11-21');
    expect(formatDisplayDate('2026-11-21')).toBe('21 Nov 2026');
    expect(formatDisplayDate('')).toBe('');

    const morning = parseTimeString('08:30 AM');
    expect(formatTimeString(morning)).toBe('08:30 AM');
    const evening = parseTimeString('09:15 PM');
    expect(formatTimeString(evening)).toBe('09:15 PM');
    const noon = parseTimeString('12:00 PM');
    expect(formatTimeString(noon)).toBe('12:00 PM');
  });

  it('registers conflict-free Expo Router paths for all tabs and nested screens', () => {
    const req = createRequire(import.meta.url);
    const { getRoutes } = req('expo-router/build/getRoutes');
    const { getLinkingConfig } = req('expo-router/build/getLinkingConfig');
    const navCore = req('expo-router/build/react-navigation/core/index.js');

    const appDir = path.resolve(__dirname, '../../../app');
    const walkAppFiles = (dir: string, prefix = '.'): string[] => {
      let out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) {
          out = out.concat(walkAppFiles(path.join(dir, entry.name), rel));
        } else {
          out.push(rel);
        }
      }
      return out;
    };

    const files = walkAppFiles(appDir);
    const ctx = Object.assign(() => ({}), { keys: () => files });
    const routes = getRoutes(ctx, { skipGenerated: true });
    const linking = getLinkingConfig(routes, ctx, { metaOnly: false });

    expect(() => navCore.validatePathConfig(linking.config)).not.toThrow();

    const expectedPaths = [
      '/',
      '/schedule',
      '/medicines',
      '/medicines/med-1',
      '/explore',
      '/explore/brand/10452',
      '/explore/brand/10452/alternatives',
      '/explore/generic/3',
      '/profile',
      '/health',
      '/expenses',
      '/purchases',
      '/alternatives',
      '/history',
      '/settings',
    ];
    for (const targetPath of expectedPaths) {
      const state = navCore.getStateFromPath(targetPath, linking.config);
      expect(state).toBeDefined();
      expect(navCore.getPathFromState(state, linking.config)).toBe(targetPath);
    }
  });
});
