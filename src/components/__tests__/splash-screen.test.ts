import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { __setMockWindowWidth } from '../../test/mocks/react-native';
import { CareDoseSplashOverlay } from '../CareDoseSplashOverlay';

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: 'SafeAreaProvider',
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const mockReact = {
    ...actual,
    useState: <T,>(init: T | (() => T)) => [
      typeof init === 'function' ? (init as () => T)() : init,
      vi.fn(),
    ] as const,
    useRef: <T,>(init: T) => ({ current: init }),
    useEffect: vi.fn(),
    useCallback: <T,>(fn: T) => fn,
  };
  return {
    ...mockReact,
    default: mockReact,
  };
});

interface ElementMatch {
  type: unknown;
  props: Record<string, unknown>;
}

function collectElements(node: unknown): ElementMatch[] {
  const out: ElementMatch[] = [];
  const walk = (n: unknown): void => {
    if (n == null || typeof n === 'boolean' || typeof n === 'string' || typeof n === 'number') {
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    if (React.isValidElement(n)) {
      const props = (n.props ?? {}) as Record<string, unknown>;
      out.push({ type: n.type, props });
      walk(props.children);
    }
  };
  walk(node);
  return out;
}

describe('CareDose Splash Screen & Native Branding Configuration', () => {
  it('configures unified mint-green splash and branding icons across Android, iOS, and Web in app.json', () => {
    const mobileRoot = path.resolve(__dirname, '../../..');
    const appJson = JSON.parse(
      fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8'),
    ) as { expo: Record<string, unknown> };
    const expo = appJson.expo as {
      icon?: string;
      backgroundColor?: string;
      splash?: unknown;
      ios?: { supportsTablet?: boolean; icon?: string };
      android?: {
        icon?: string;
        adaptiveIcon?: { foregroundImage?: string; backgroundColor?: string };
      };
      web?: { favicon?: string };
      plugins?: unknown[];
    };

    expect(expo.icon).toBe('./assets/icon.png');
    expect(expo.backgroundColor).toBe('#EAF7F1');
    expect(expo.splash).toBeUndefined();
    expect(expo.ios?.supportsTablet).toBe(true);
    expect(expo.ios?.icon).toBe('./assets/icon.png');
    expect(expo.android?.icon).toBe('./assets/icon.png');
    expect(expo.android?.adaptiveIcon).toEqual({
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#EAF7F1',
    });
    expect(expo.web?.favicon).toBe('./assets/favicon.png');

    const splashPluginEntry = (expo.plugins ?? []).find(
      (entry) => Array.isArray(entry) && entry[0] === 'expo-splash-screen',
    ) as [string, Record<string, unknown>] | undefined;
    expect(splashPluginEntry).toBeDefined();
    expect(splashPluginEntry?.[1].backgroundColor).toBe('#EAF7F1');
    expect(splashPluginEntry?.[1].resizeMode).toBe('contain');
    expect(splashPluginEntry?.[1].image).toBe('./assets/splash-icon.png');
    expect(splashPluginEntry?.[1].imageWidth).toBe(180);

    for (const rel of [
      './assets/icon.png',
      './assets/adaptive-icon.png',
      './assets/splash-icon.png',
      './assets/brand-logo.png',
      './assets/favicon.png',
    ]) {
      const fullPath = path.join(mobileRoot, rel);
      expect(fs.existsSync(fullPath)).toBe(true);
      const header = fs.readFileSync(fullPath).subarray(0, 4);
      expect([...header]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  });

  it('renders responsive CareDose splash branding without stretching or fake loading bars across 320px-768px', () => {
    for (const width of [320, 360, 390, 412, 768]) {
      __setMockWindowWidth(width);
      const onFirstPaint = vi.fn();
      const tree = CareDoseSplashOverlay({
        appReady: false,
        onFirstPaint,
      });
      const els = collectElements(tree);

      expect(els.some((e) => e.props.accessibilityLabel === 'CareDose launch screen')).toBe(true);
      expect(els.some((e) => e.props.accessibilityLabel === 'CareDose')).toBe(true);
      expect(
        els.some((e) => e.props.children === 'Your health, one dose at a time.'),
      ).toBe(true);

      const logoImg = els.find((e) => e.props.accessibilityLabel === 'CareDose emblem');
      expect(logoImg).toBeDefined();
      expect(logoImg?.props.resizeMode).toBe('contain');
      const imgStyle = logoImg?.props.style as { width: number; height: number };
      expect(imgStyle.width).toBe(imgStyle.height);
      expect(imgStyle.width).toBeGreaterThanOrEqual(64);
      expect(imgStyle.width).toBeLessThan(width * 0.4);

      const rootEl = els[0];
      const onLayout = rootEl.props.onLayout as () => void;
      onLayout();
      onLayout();
      expect(onFirstPaint).toHaveBeenCalledTimes(1);
    }
  });
});
