export const THEME_OPTIONS = [
  'system',
  'light',
  'dark',
  'nightmode',
] as const;

export type ThemeOption = (typeof THEME_OPTIONS)[number];
export type ResolvedThemeOption = Exclude<ThemeOption, 'system'>;

export const DEFAULT_THEME: ThemeOption = 'system';

export const THEME_LABELS: Record<ThemeOption, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  nightmode: 'Night',
};

export function isThemeOption(value: string): value is ThemeOption {
  return value in THEME_LABELS;
}

export function normalizeLegacyTheme(value: string | undefined): ThemeOption | null {
  if (value === 'green' || value === 'softdark') return 'dark';
  if (value === 'softlight') return 'light';
  if (value === 'system' || value === 'light' || value === 'dark' || value === 'nightmode') {
    return value;
  }
  return null;
}

export function isSystemNightmodeWindow(date: Date = new Date()) {
  const hour = date.getHours();
  return hour >= 0 && hour < 5;
}

export function getEffectiveTheme(
  theme: string | undefined,
  resolvedTheme: string | undefined,
  date: Date = new Date(),
): ResolvedThemeOption {
  const normalizedTheme = normalizeLegacyTheme(theme);

  if (normalizedTheme === 'light' || normalizedTheme === 'dark' || normalizedTheme === 'nightmode') {
    return normalizedTheme;
  }

  if (normalizedTheme === 'system') {
    if (isSystemNightmodeWindow(date)) return 'nightmode';
    return resolvedTheme === 'dark' ? 'dark' : 'light';
  }

  return DEFAULT_THEME === 'system'
    ? resolvedTheme === 'dark'
      ? 'dark'
      : 'light'
    : DEFAULT_THEME;
}
