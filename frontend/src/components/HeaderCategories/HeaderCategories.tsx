'use client';

import styles from './HeaderCategories.module.sass';
import { Button } from '@/components/Button/Button';
import { IconMenu } from '@/components/icons/IconMenu';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import type { Category } from '@/app/_lib/types';

export type HeaderCategoriesProps = {
  isMenuOpen: boolean;
  onOpenMenu: () => void;
  isOffline: boolean;
  categories: Category[];
  selectedCategoryId: number | null;
  isStarredView: boolean;
  categoryUnreadCounts: Map<number, number>;
  totalUnreadCount: number;
  totalStarredCount: number;
  isLoading: boolean;
  onSelectAll: () => void;
  onSelectStarred: () => void;
  onSelectCategory: (categoryId: number) => void;
};

export function HeaderCategories({
  isMenuOpen,
  onOpenMenu,
  isOffline,
  categories,
  selectedCategoryId,
  isStarredView,
  categoryUnreadCounts,
  totalUnreadCount,
  totalStarredCount,
  isLoading,
  onSelectAll,
  onSelectStarred,
  onSelectCategory,
}: HeaderCategoriesProps) {
  return (
    <header className={styles.header}>
      <div className={styles.header_Menu}>
        <Button
          type="button"
          variant="nav"
          onClick={onOpenMenu}
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          data-active={isMenuOpen}
        >
          <IconWrapper>
            <IconMenu />
          </IconWrapper>
          <span>Menu</span>
        </Button>
      </div>
      {isOffline && <div className={styles.header_Offline}>app is offline</div>}
      <ul className={styles.header_CategoryList}>
        <li>
          <Button
            type="button"
            variant="category"
            active={selectedCategoryId === null && !isStarredView}
            className={`${styles.header_CategoryList_Item} ${
              selectedCategoryId === null && !isStarredView
                ? styles.categoryItemActive
                : ''
            }`}
            onClick={onSelectAll}
            disabled={isLoading}
          >
            All
          </Button>
          <div className={styles.header_CategoryList_Count}>
            {totalUnreadCount}
          </div>
        </li>
        <li>
          <Button
            type="button"
            variant="category"
            active={isStarredView}
            className={`${styles.header_CategoryList_Item} ${
              isStarredView ? styles.categoryItemActive : ''
            }`}
            onClick={onSelectStarred}
            disabled={isLoading}
          >
            Starred
          </Button>
          <div className={styles.header_CategoryList_Count}>
            {totalStarredCount}
          </div>
        </li>
        {categories
          .slice(1)
          .filter((cat) => {
            const unreadCount = categoryUnreadCounts.get(cat.id) ?? 0;
            return selectedCategoryId === cat.id || unreadCount > 0;
          })
          .map((cat) => (
            <li key={cat.id}>
              <Button
                type="button"
                variant="category"
                active={selectedCategoryId === cat.id}
                className={`${styles.header_CategoryList_Item} ${
                  selectedCategoryId === cat.id ? styles.categoryItemActive : ''
                }`}
                onClick={() => onSelectCategory(cat.id)}
                disabled={isLoading}
              >
                {cat.title}
              </Button>
              <div className={styles.header_CategoryList_Count}>
                {categoryUnreadCounts.get(cat.id) ?? 0}
              </div>
            </li>
          ))}
      </ul>
    </header>
  );
}
