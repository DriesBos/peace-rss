export const TYPE_SIZE_STORAGE_KEY = 'peace-rss-type-size';

export const TYPE_SIZE_VALUES = ['default', 'larger'] as const;

export type TypeSize = (typeof TYPE_SIZE_VALUES)[number];

export const DEFAULT_TYPE_SIZE: TypeSize = 'default';

export const TYPE_SIZE_LABELS: Record<TypeSize, string> = {
  default: 'Default',
  larger: 'Larger',
};

export function isTypeSize(value: string | null | undefined): value is TypeSize {
  return (
    typeof value === 'string' &&
    (TYPE_SIZE_VALUES as readonly string[]).includes(value)
  );
}

function normalizeLegacyTypeSize(
  value: string | null | undefined,
): TypeSize | null {
  if (value === 'm' || value === 's') return 'default';
  if (value === 'l') return 'larger';
  return null;
}

export function getStoredTypeSize(): TypeSize {
  if (typeof window === 'undefined') return DEFAULT_TYPE_SIZE;

  const storedValue = window.localStorage.getItem(TYPE_SIZE_STORAGE_KEY);

  if (isTypeSize(storedValue)) return storedValue;

  const normalizedValue = normalizeLegacyTypeSize(storedValue);
  if (normalizedValue) {
    window.localStorage.setItem(TYPE_SIZE_STORAGE_KEY, normalizedValue);
    return normalizedValue;
  }

  return DEFAULT_TYPE_SIZE;
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
  if (isTypeSize(appliedValue)) return appliedValue;

  return normalizeLegacyTypeSize(appliedValue) ?? DEFAULT_TYPE_SIZE;
}
