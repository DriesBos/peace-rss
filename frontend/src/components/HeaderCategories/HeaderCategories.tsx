'use client';

import { useEffect, useRef } from 'react';
import styles from './HeaderCategories.module.sass';
import { Button } from '@/components/Button/Button';
import { IconMenu } from '@/components/icons/IconMenu';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import type { Category } from '@/app/_lib/types';
import { IconSearch } from '@/components/icons/IconSearch';
import { IconCategories } from '../icons/IconCategories';

export type HeaderCategoriesProps = {
  isMenuOpen: boolean;
  onOpenMenu: () => void;
  isCategoriesOpen: boolean;
  onToggleCategories: () => void;
  isOffline: boolean;
  categories: Category[];
  selectedCategoryId: number | null;
  isStarredView: boolean;
  categoryUnreadCounts: Map<number, number>;
  totalUnreadCount: number;
  totalStarredCount: number;
  isLoading: boolean;
  isSearchOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onToggleSearch: () => void;
  onSelectAll: () => void;
  onSelectStarred: () => void;
  onSelectCategory: (categoryId: number) => void;
};

export function HeaderCategories({
  isMenuOpen,
  onOpenMenu,
  isCategoriesOpen,
  onToggleCategories,
  isOffline,
  categories,
  selectedCategoryId,
  isStarredView,
  categoryUnreadCounts,
  totalUnreadCount,
  totalStarredCount,
  isLoading,
  isSearchOpen,
  searchQuery,
  onSearchQueryChange,
  onToggleSearch,
  onSelectAll,
  onSelectStarred,
  onSelectCategory,
}: HeaderCategoriesProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSearchOpen) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [isSearchOpen]);

  return (
    <header className={styles.header} data-categories-open={isCategoriesOpen}>
      <div className={styles.header_Fixed}>
        <div className={styles.header_Menu}>
          <div className={styles.header_Search} data-open={isMenuOpen}>
            <Button
              type="button"
              variant={isCategoriesOpen ? 'icon' : 'nav'}
              onClick={onOpenMenu}
              aria-haspopup="dialog"
              aria-expanded={isMenuOpen}
              aria-label={isCategoriesOpen ? 'Open menu' : undefined}
              data-active={isMenuOpen}
            >
              <IconWrapper>
                <IconMenu />
              </IconWrapper>
              {!isCategoriesOpen && <span>Menu</span>}
            </Button>
          </div>
        </div>
        <div className={styles.header_Search} data-open={isSearchOpen}>
          <Button
            type="button"
            variant={isCategoriesOpen ? 'icon' : 'nav'}
            icon="search"
            onClick={onToggleSearch}
            aria-expanded={isSearchOpen}
            aria-controls="header-search-input"
            aria-label={isSearchOpen ? 'Close search' : 'Open search'}
          >
            <IconWrapper>
              <IconSearch />
            </IconWrapper>
            {!isCategoriesOpen && <span>Search</span>}
          </Button>
          {isSearchOpen && (
            <input
              id="header-search-input"
              ref={searchInputRef}
              className={styles.searchInput}
              type="search"
              placeholder="Search.."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              aria-label="Search entries"
            />
          )}
        </div>
        {!isCategoriesOpen && (
          <div className={styles.header_isCategoriesOpen}>
            <Button
              type="button"
              variant="nav"
              icon="categories"
              onClick={onToggleCategories}
              aria-expanded={isCategoriesOpen}
              aria-controls="header-categories-list"
              aria-label="Toggle categories"
            >
              <IconWrapper>
                <IconCategories />
              </IconWrapper>
              <span>Categories</span>
            </Button>
          </div>
        )}
      </div>
      {isOffline && <div className={styles.header_Offline}>app is offline</div>}
      {isCategoriesOpen && (
        <ul
          className={styles.header_CategoryList}
          id="header-categories-list"
        >
          <li>
            <Button
              type="button"
              variant="nav"
              active={selectedCategoryId === null && !isStarredView}
              className={`${styles.header_CategoryList_Item} ${
                selectedCategoryId === null && !isStarredView
                  ? styles.categoryItemActive
                  : ''
              }`}
              onClick={onSelectAll}
              disabled={isLoading}
              count={totalUnreadCount}
            >
              <span>All</span>
            </Button>
          </li>
          <li>
            <Button
              type="button"
              variant="nav"
              active={isStarredView}
              className={`${styles.header_CategoryList_Item} ${
                isStarredView ? styles.categoryItemActive : ''
              }`}
              onClick={onSelectStarred}
              disabled={isLoading}
              count={totalStarredCount}
            >
              <span>Starred</span>
            </Button>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Button
                type="button"
                variant="nav"
                active={selectedCategoryId === cat.id}
                className={`${styles.header_CategoryList_Item} ${
                  selectedCategoryId === cat.id ? styles.categoryItemActive : ''
                }`}
                onClick={() => onSelectCategory(cat.id)}
                disabled={isLoading}
                count={categoryUnreadCounts.get(cat.id) ?? 0}
              >
                <span>{cat.title}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
