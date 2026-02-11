export type ProtectedCategoryKind = 'instagram' | 'twitter';

export function normalizeCategoryTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function isProtectedCategoryTitle(title: string): boolean {
  const normalized = normalizeCategoryTitle(title);
  return normalized === 'instagram' || normalized === 'twitter';
}

export function protectedCategoryTitleForKind(kind: ProtectedCategoryKind): string {
  switch (kind) {
    case 'instagram':
      return 'Instagram';
    case 'twitter':
      return 'Twitter';
  }
}
