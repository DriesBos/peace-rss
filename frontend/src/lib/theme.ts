export const THEME_OPTIONS = [
  'system',
  'light',
  'dark',
  'softlight',
  'softdark',
  'green',
  'nightmode',
] as const;

export type ThemeOption = (typeof THEME_OPTIONS)[number];

export const DEFAULT_THEME: ThemeOption = 'system';

export const THEME_LABELS: Record<ThemeOption, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
  softlight: 'Soft Light',
  softdark: 'Soft Dark',
  green: 'Green',
  nightmode: 'Nightmode',
};

export function isThemeOption(value: string): value is ThemeOption {
  return value in THEME_LABELS;
}
