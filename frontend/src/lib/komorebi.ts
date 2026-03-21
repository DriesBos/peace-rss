export const KOMOREBI_MAIN_STORAGE_KEY = 'peace-rss-komorebi-main';
export const KOMOREBI_MAIN_CHANGE_EVENT = 'peace-rss-komorebi-main-change';

export const KOMOREBI_MAIN_VALUES = ['off', 'on'] as const;

export type KomorebiMainPreference = (typeof KOMOREBI_MAIN_VALUES)[number];

export const DEFAULT_KOMOREBI_MAIN: KomorebiMainPreference = 'off';

export const KOMOREBI_MAIN_LABELS: Record<KomorebiMainPreference, string> = {
  off: 'Off',
  on: 'On',
};

export function isKomorebiMainPreference(
  value: string | null | undefined,
): value is KomorebiMainPreference {
  return (
    typeof value === 'string' &&
    (KOMOREBI_MAIN_VALUES as readonly string[]).includes(value)
  );
}

export function getStoredKomorebiMain(): KomorebiMainPreference {
  if (typeof window === 'undefined') return DEFAULT_KOMOREBI_MAIN;

  const storedValue = window.localStorage.getItem(KOMOREBI_MAIN_STORAGE_KEY);
  return isKomorebiMainPreference(storedValue)
    ? storedValue
    : DEFAULT_KOMOREBI_MAIN;
}

export function applyKomorebiMain(preference: KomorebiMainPreference) {
  if (typeof document === 'undefined') return;

  document.body.dataset.komorebiMain = preference;
}

export function persistKomorebiMain(preference: KomorebiMainPreference) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(KOMOREBI_MAIN_STORAGE_KEY, preference);
}

export function setKomorebiMain(preference: KomorebiMainPreference) {
  applyKomorebiMain(preference);
  persistKomorebiMain(preference);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<KomorebiMainPreference>(KOMOREBI_MAIN_CHANGE_EVENT, {
        detail: preference,
      }),
    );
  }
}

export function getAppliedKomorebiMain(): KomorebiMainPreference {
  if (typeof document === 'undefined') return DEFAULT_KOMOREBI_MAIN;

  const appliedValue = document.body.dataset.komorebiMain;
  return isKomorebiMainPreference(appliedValue)
    ? appliedValue
    : DEFAULT_KOMOREBI_MAIN;
}
