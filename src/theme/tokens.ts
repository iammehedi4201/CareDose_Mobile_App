/**
 * CareDose Design System Tokens (v1.5)
 * Reference: CareDose_Medicine_Tracking_App_Documentation_v1.5.md Section 8.13
 * Reference: CareDose_UI_UX_Reference_Guide.md Section 2
 */

export const CAREDOSE_COLORS = {
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
} as const;

export const CAREDOSE_EXTENDED_COLORS = {
  ...CAREDOSE_COLORS,
  surface: '#FFFFFF',
  secondaryText: '#5A706B',
  mutedText: '#7D928D',
  warningSurface: '#FDF5E6',
  errorSurface: '#FDECEC',
  infoSurface: '#EBF3FC',
  neutralSurface: '#EEF2F0',
} as const;

export const CAREDOSE_TYPOGRAPHY = {
  screenTitle: { fontSize: 24, fontWeight: '700' as const },
  sectionTitle: { fontSize: 16, fontWeight: '600' as const },
  medicineTitle: { fontSize: 14, fontWeight: '600' as const },
  body: { fontSize: 13, fontWeight: '400' as const },
  supporting: { fontSize: 12, fontWeight: '400' as const },
  caption: { fontSize: 11, fontWeight: '500' as const },
} as const;

export const CAREDOSE_SPACING = [4, 8, 12, 16, 24, 32] as const;

export const CAREDOSE_RADIUS = {
  card: 16,
  field: 12,
  button: 12,
} as const;

export const MIN_TOUCH_TARGET = 44;

export type PrimaryTabKey = 'home' | 'schedule' | 'medicines' | 'explore' | 'profile';

export const PRIMARY_BOTTOM_TABS = [
  { key: 'home', label: 'Home', route: '/', icon: 'home' },
  { key: 'schedule', label: 'Schedule', route: '/schedule', icon: 'calendar' },
  { key: 'medicines', label: 'Medicines', route: '/medicines', icon: 'package' },
  { key: 'explore', label: 'Explore', route: '/explore', icon: 'compass' },
  { key: 'profile', label: 'Profile', route: '/profile', icon: 'user' },
] as const;

export const SECONDARY_PROFILE_DESTINATIONS = [
  {
    key: 'health-log',
    label: 'Health Log',
    subtitle: 'Glucose readings & 7-day trend',
    route: '/health',
    icon: 'activity',
  },
  {
    key: 'expenses',
    label: 'Medicine Expenses',
    subtitle: 'Monthly spending & budget tracker',
    route: '/expenses',
    icon: 'pie-chart',
  },
  {
    key: 'purchases',
    label: 'Purchase History',
    subtitle: 'Recorded pack purchases & amounts paid',
    route: '/purchases',
    icon: 'shopping-bag',
  },
  {
    key: 'alternatives',
    label: 'Alternative Brands',
    subtitle: 'Compare catalogue brands by generic & strength',
    route: '/alternatives',
    icon: 'layers',
  },
  {
    key: 'dose-history',
    label: 'Dose History',
    subtitle: 'Taken, skipped & missed dose logs',
    route: '/history',
    icon: 'clock',
  },
  {
    key: 'settings',
    label: 'Settings',
    subtitle: 'Reminders, units, budget & demo reset',
    route: '/settings',
    icon: 'settings',
  },
] as const;

/**
 * Resolves which of the 5 primary bottom navigation tabs should appear active
 * for any given pathname, including nested detail routes and secondary Profile screens.
 */
export function resolveActiveBottomTab(pathname: string): PrimaryTabKey {
  const clean = (pathname || '/').split('?')[0].toLowerCase();
  if (clean === '/' || clean === '/index') {
    return 'home';
  }
  if (clean.startsWith('/schedule')) {
    return 'schedule';
  }
  if (clean.startsWith('/medicines')) {
    return 'medicines';
  }
  if (clean.startsWith('/explore')) {
    return 'explore';
  }
  if (
    clean.startsWith('/profile') ||
    clean.startsWith('/health') ||
    clean.startsWith('/expenses') ||
    clean.startsWith('/purchases') ||
    clean.startsWith('/alternatives') ||
    clean.startsWith('/history') ||
    clean.startsWith('/settings')
  ) {
    return 'profile';
  }
  return 'home';
}
