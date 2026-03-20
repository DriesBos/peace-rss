export const FONT_FAMILY_STORAGE_KEY = 'peace-rss-font-family';

export const FONT_FAMILY_VALUES = ['sans-serif', 'serif'] as const;

export type FontFamilyPreference = (typeof FONT_FAMILY_VALUES)[number];

export const DEFAULT_FONT_FAMILY: FontFamilyPreference = 'sans-serif';

export const FONT_FAMILY_LABELS: Record<FontFamilyPreference, string> = {
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
};

export function isFontFamilyPreference(
  value: string | null | undefined,
): value is FontFamilyPreference {
  return (
    typeof value === 'string' &&
    (FONT_FAMILY_VALUES as readonly string[]).includes(value)
  );
}

export function getStoredFontFamily(): FontFamilyPreference {
  if (typeof window === 'undefined') return DEFAULT_FONT_FAMILY;

  const storedValue = window.localStorage.getItem(FONT_FAMILY_STORAGE_KEY);
  if (storedValue === 'clean') return 'sans-serif';
  if (storedValue === 'cheltenham' || storedValue === 'imperial') return 'serif';
  return isFontFamilyPreference(storedValue)
    ? storedValue
    : DEFAULT_FONT_FAMILY;
}

export function applyFontFamily(fontFamily: FontFamilyPreference) {
  if (typeof document === 'undefined') return;

  document.body.dataset.fontFamily = fontFamily;
}

export function persistFontFamily(fontFamily: FontFamilyPreference) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(FONT_FAMILY_STORAGE_KEY, fontFamily);
}

export function setFontFamily(fontFamily: FontFamilyPreference) {
  applyFontFamily(fontFamily);
  persistFontFamily(fontFamily);
}

export function getAppliedFontFamily(): FontFamilyPreference {
  if (typeof document === 'undefined') return DEFAULT_FONT_FAMILY;

  const appliedValue = document.body.dataset.fontFamily;
  if (appliedValue === 'clean') return 'sans-serif';
  if (appliedValue === 'cheltenham' || appliedValue === 'imperial') return 'serif';
  return isFontFamilyPreference(appliedValue)
    ? appliedValue
    : DEFAULT_FONT_FAMILY;
}
