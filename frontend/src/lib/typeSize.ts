export const TYPE_SIZE_STORAGE_KEY = 'peace-rss-type-size';

export const TYPE_SIZE_VALUES = ['s', 'm', 'l'] as const;

export type TypeSize = (typeof TYPE_SIZE_VALUES)[number];

export const DEFAULT_TYPE_SIZE: TypeSize = 'm';

export const TYPE_SIZE_LABELS: Record<TypeSize, string> = {
  s: 'S',
  m: 'M',
  l: 'L',
};

export function isTypeSize(value: string | null | undefined): value is TypeSize {
  return (
    typeof value === 'string' &&
    (TYPE_SIZE_VALUES as readonly string[]).includes(value)
  );
}

export function getStoredTypeSize(): TypeSize {
  if (typeof window === 'undefined') return DEFAULT_TYPE_SIZE;

  const storedValue = window.localStorage.getItem(TYPE_SIZE_STORAGE_KEY);
  return isTypeSize(storedValue) ? storedValue : DEFAULT_TYPE_SIZE;
}

export function applyTypeSize(typeSize: TypeSize) {
  if (typeof document === 'undefined') return;

  document.body.dataset.typeSize = typeSize;
}

export function persistTypeSize(typeSize: TypeSize) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(TYPE_SIZE_STORAGE_KEY, typeSize);
}

export function setTypeSize(typeSize: TypeSize) {
  applyTypeSize(typeSize);
  persistTypeSize(typeSize);
}

export function getAppliedTypeSize(): TypeSize {
  if (typeof document === 'undefined') return DEFAULT_TYPE_SIZE;

  const appliedValue = document.body.dataset.typeSize;
  return isTypeSize(appliedValue) ? appliedValue : DEFAULT_TYPE_SIZE;
}
