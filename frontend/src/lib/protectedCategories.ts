export type ProtectedCategoryKind = 'youtube' | 'instagram' | 'twitter';

export function normalizeCategoryTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function isProtectedCategoryTitle(title: string): boolean {
  const normalized = normalizeCategoryTitle(title);
  return normalized === 'youtube' || normalized === 'instagram' || normalized === 'twitter';
}

export function protectedCategoryTitleForKind(kind: ProtectedCategoryKind): string {
  switch (kind) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'twitter':
      return 'Twitter';
  }
}

