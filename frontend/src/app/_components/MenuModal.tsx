'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import styles from '../page.module.sass';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { Footer } from '@/components/Footer/Footer';
import { IconEdit } from '@/components/icons/IconEdit';
import { IconPlus } from '@/components/icons/IconPlus';
import { IconClose } from '@/components/icons/IconClose';
import type { Category, Entry, Feed } from '@/app/_lib/types';

export type MenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  feeds: Feed[];
  openEditModal: (type: 'feed' | 'category', item: Feed | Category) => void;
  openAddModal: () => void;
  isLoading: boolean;
  starredEntries: Entry[];
  onToggleEntryStar: (entryId: number) => Promise<void>;
};

export function MenuModal({
  isOpen,
  onClose,
  categories,
  feeds,
  openEditModal,
  openAddModal,
  isLoading,
  starredEntries,
  onToggleEntryStar,
}: MenuModalProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<number | string>
  >(() => {
    const initialSet = new Set<number | string>();
    initialSet.add('starred');
    initialSet.add('uncategorized');
    categories.slice(1).forEach((cat) => {
      initialSet.add(cat.id);
    });
    return initialSet;
  });

  const toggleCategoryCollapse = useCallback((categoryId: number | string) => {
    setCollapsedCategories((prev) => {
      const updated = new Set(prev);
      if (updated.has(categoryId)) {
        updated.delete(categoryId);
      } else {
        updated.add(categoryId);
      }
      return updated;
    });
  }, []);

  const resetCollapsedCategories = useCallback(() => {
    const initialSet = new Set<number | string>();
    initialSet.add('starred');
    initialSet.add('uncategorized');
    categories.slice(1).forEach((cat) => {
      initialSet.add(cat.id);
    });
    setCollapsedCategories(initialSet);
  }, [categories]);

  useEffect(() => {
    if (!isOpen) return;
    resetCollapsedCategories();
  }, [isOpen, resetCollapsedCategories]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose} ariaLabel="Menu">
      <div className={styles.modalMenu}>
        <ThemeSwitcher />

        <div className={styles.modalMenu_CategoriesFeeds}>
          <div className={styles.sectionTitle}>Feeds</div>

          <div className={styles.categoriesFeedsList}>
            {starredEntries.length > 0 && (
              <div className={styles.categoryGroup}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryTitle}>⭐ Starred</span>
                  <button
                    type="button"
                    className={styles.toggleCollapseButton}
                    onClick={() => toggleCategoryCollapse('starred')}
                    disabled={isLoading}
                    title={
                      collapsedCategories.has('starred') ? 'Expand' : 'Collapse'
                    }
                    aria-label={
                      collapsedCategories.has('starred')
                        ? 'Expand starred'
                        : 'Collapse starred'
                    }
                  >
                    {collapsedCategories.has('starred') ? (
                      <IconPlus width={14} height={14} />
                    ) : (
                      <IconClose width={14} height={14} />
                    )}
                  </button>
                </div>
                {!collapsedCategories.has('starred') && (
                  <div className={styles.feedsUnderCategory}>
                    {starredEntries.map((entry) => (
                      <div key={entry.id} className={styles.feedListItem}>
                        <span className={styles.feedListItem_Title}>
                          {entry.title}
                        </span>
                        <button
                          type="button"
                          className={styles.starButton}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await onToggleEntryStar(entry.id);
                          }}
                          disabled={isLoading}
                          title="Remove from starred"
                          aria-label={`Remove ${entry.title} from starred`}
                        >
                          ⭐
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {categories.length <= 1 && feeds.length === 0 ? (
              <div className={styles.muted}>No categories or feeds yet.</div>
            ) : (
              <>
                {categories.slice(1).map((cat) => {
                  const categoryFeeds = feeds.filter(
                    (feed) => feed.category?.id === cat.id
                  );
                  const isCollapsed = collapsedCategories.has(cat.id);
                  return (
                    <div key={cat.id} className={styles.categoryGroup}>
                      <div className={styles.categoryHeader}>
                        <span className={styles.categoryTitle}>{cat.title}</span>
                        <div className={styles.categoryHeaderButtons}>
                          <button
                            type="button"
                            className={styles.toggleCollapseButton}
                            onClick={() => toggleCategoryCollapse(cat.id)}
                            disabled={isLoading}
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                            aria-label={
                              isCollapsed
                                ? `Expand ${cat.title}`
                                : `Collapse ${cat.title}`
                            }
                          >
                            {isCollapsed ? (
                              <IconPlus width={14} height={14} />
                            ) : (
                              <IconClose width={14} height={14} />
                            )}
                          </button>
                          <button
                            type="button"
                            className={styles.editButton}
                            onClick={() => openEditModal('category', cat)}
                            disabled={isLoading}
                            title="Edit category"
                            aria-label={`Edit category ${cat.title}`}
                          >
                            <IconEdit width={14} height={14} />
                          </button>
                        </div>
                      </div>
                      {categoryFeeds.length > 0 && !isCollapsed && (
                        <div className={styles.feedsUnderCategory}>
                          {categoryFeeds.map((feed) => (
                            <div key={feed.id} className={styles.feedListItem}>
                              <span className={styles.feedListItem_Title}>
                                {feed.title}
                              </span>
                              <button
                                type="button"
                                className={styles.editButton}
                                onClick={() => openEditModal('feed', feed)}
                                disabled={isLoading}
                                title="Edit feed"
                                aria-label={`Edit feed ${feed.title}`}
                              >
                                <IconEdit width={14} height={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(() => {
                  const uncategorizedFeeds = feeds.filter(
                    (feed) =>
                      !feed.category || feed.category.id === categories[0]?.id
                  );
                  if (uncategorizedFeeds.length > 0) {
                    const isCollapsed =
                      collapsedCategories.has('uncategorized');
                    return (
                      <div className={styles.categoryGroup}>
                        <div className={styles.categoryHeader}>
                          <span className={styles.categoryTitle}>
                            Uncategorized
                          </span>
                          <button
                            type="button"
                            className={styles.toggleCollapseButton}
                            onClick={() =>
                              toggleCategoryCollapse('uncategorized')
                            }
                            disabled={isLoading}
                            title={isCollapsed ? 'Expand' : 'Collapse'}
                            aria-label={
                              isCollapsed
                                ? 'Expand uncategorized'
                                : 'Collapse uncategorized'
                            }
                          >
                            {isCollapsed ? (
                              <IconPlus width={14} height={14} />
                            ) : (
                              <IconClose width={14} height={14} />
                            )}
                          </button>
                        </div>
                        {!isCollapsed && (
                          <div className={styles.feedsUnderCategory}>
                            {uncategorizedFeeds.map((feed) => (
                              <div key={feed.id} className={styles.feedListItem}>
                                <span className={styles.feedListItem_Title}>
                                  {feed.title}
                                </span>
                                <button
                                  type="button"
                                  className={styles.editButton}
                                  onClick={() => openEditModal('feed', feed)}
                                  disabled={isLoading}
                                  title="Edit feed"
                                  aria-label={`Edit feed ${feed.title}`}
                                >
                                  <IconEdit width={14} height={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.addButton}
            onClick={openAddModal}
            disabled={isLoading}
            aria-label="Add category or feed"
          >
            <IconPlus width={16} height={16} />
            <span>Add</span>
          </button>

          <div className={styles.userButton}>
            <UserButton />
          </div>
        </div>

        <Footer />
      </div>
    </ModalContainer>
  );
}
