'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import styles from './MenuModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { IconEdit } from '@/components/icons/IconEdit';
import { IconPlus } from '@/components/icons/IconPlus';
import type { Category, Entry, Feed } from '@/app/_lib/types';

type MenuView = 'feeds' | 'look' | 'other';

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

const THEME_LABELS: Record<string, string> = {
  light: 'Light',
  dark: 'Dark',
  softlight: 'Soft Light',
  softdark: 'Soft Dark',
  green: 'Green',
};

function buildInitialCollapsedCategories(categories: Category[]) {
  const initialSet = new Set<number | string>();
  initialSet.add('starred');
  initialSet.add('uncategorized');
  categories.slice(1).forEach((cat) => {
    initialSet.add(cat.id);
  });
  return initialSet;
}

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
  const [activeView, setActiveView] = useState<MenuView>('feeds');
  const [timeLabel, setTimeLabel] = useState('');
  const { theme, setTheme } = useTheme();

  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<number | string>
  >(() => buildInitialCollapsedCategories(categories));

  const resetCollapsedCategories = useCallback(() => {
    setCollapsedCategories(buildInitialCollapsedCategories(categories));
  }, [categories]);

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

  const handleClose = useCallback(() => {
    setActiveView('feeds');
    resetCollapsedCategories();
    onClose();
  }, [onClose, resetCollapsedCategories]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;

    const formatter = new Intl.DateTimeFormat([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const updateClock = () => setTimeLabel(formatter.format(new Date()));
    updateClock();

    const interval = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  const uncategorizedFeeds = useMemo(
    () =>
      feeds.filter((feed) => !feed.category || feed.category.id === categories[0]?.id),
    [feeds, categories]
  );

  const handleOpenAddModal = useCallback(() => {
    setActiveView('feeds');
    resetCollapsedCategories();
    onClose();
    openAddModal();
  }, [onClose, openAddModal, resetCollapsedCategories]);

  const handleOpenEditModal = useCallback(
    (type: 'feed' | 'category', item: Feed | Category) => {
      setActiveView('feeds');
      resetCollapsedCategories();
      onClose();
      openEditModal(type, item);
    },
    [onClose, openEditModal, resetCollapsedCategories]
  );

  return (
    <ModalContainer isOpen={isOpen} onClose={handleClose} ariaLabel="Menu">
      <div className={styles.modalMenu}>
        <div className={styles.modalMenu_Nav}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={styles.tab}
              data-active={activeView === 'feeds'}
              onClick={() => setActiveView('feeds')}
            >
              Feeds
            </button>
            <button
              type="button"
              className={styles.tab}
              data-active={activeView === 'look'}
              onClick={() => setActiveView('look')}
            >
              Look
            </button>
            <button
              type="button"
              className={styles.tab}
              data-active={activeView === 'other'}
              onClick={() => setActiveView('other')}
            >
              Other
            </button>
          </div>
          <div className={styles.time}>{timeLabel}</div>
        </div>

        {activeView === 'feeds' && (
          <div className={styles.viewFeeds}>
            <button
              type="button"
              className={styles.addContentButton}
              onClick={handleOpenAddModal}
              disabled={isLoading}
            >
              <IconPlus width={14} height={14} />
              <span>Add content</span>
            </button>

            <div className={styles.sectionHeader}>
              <span>All feeds</span>
              <span className={styles.count}>{feeds.length}</span>
            </div>

            <div className={styles.categoriesFeedsList}>
              {starredEntries.length > 0 && (
                <div className={styles.categoryGroup}>
                  <button
                    type="button"
                    className={styles.categoryHeader}
                    onClick={() => toggleCategoryCollapse('starred')}
                    disabled={isLoading}
                  >
                    <div className={styles.categoryTitleWrap}>
                      <span className={styles.expandIcon} data-open={!collapsedCategories.has('starred')}>
                        <IconPlus width={12} height={12} />
                      </span>
                      <span className={styles.categoryTitle}>Starred</span>
                      <span className={styles.count}>{starredEntries.length}</span>
                    </div>
                  </button>
                  {!collapsedCategories.has('starred') && (
                    <div className={styles.feedsUnderCategory}>
                      {starredEntries.map((entry) => (
                        <div key={entry.id} className={styles.feedListItem}>
                          <span className={styles.feedListItem_Title}>{entry.title}</span>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await onToggleEntryStar(entry.id);
                            }}
                            disabled={isLoading}
                            title="Remove from starred"
                            aria-label={`Remove ${entry.title} from starred`}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {categories.slice(1).map((cat) => {
                const categoryFeeds = feeds.filter(
                  (feed) => feed.category?.id === cat.id
                );
                const isCollapsed = collapsedCategories.has(cat.id);

                return (
                  <div key={cat.id} className={styles.categoryGroup}>
                    <div className={styles.categoryHeader}>
                      <button
                        type="button"
                        className={styles.categoryToggle}
                        onClick={() => toggleCategoryCollapse(cat.id)}
                        disabled={isLoading}
                      >
                        <span className={styles.expandIcon} data-open={!isCollapsed}>
                          <IconPlus width={12} height={12} />
                        </span>
                        <span className={styles.categoryTitle}>{cat.title}</span>
                        <span className={styles.count}>{categoryFeeds.length}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.iconButton}
                        onClick={() => handleOpenEditModal('category', cat)}
                        disabled={isLoading}
                        aria-label={`Edit category ${cat.title}`}
                      >
                        <IconEdit width={16} height={16} />
                      </button>
                    </div>

                    {!isCollapsed && categoryFeeds.length > 0 && (
                      <div className={styles.feedsUnderCategory}>
                        {categoryFeeds.map((feed) => (
                          <div key={feed.id} className={styles.feedListItem}>
                            <span className={styles.feedListItem_Title}>{feed.title}</span>
                            <button
                              type="button"
                              className={styles.iconButton}
                              onClick={() => handleOpenEditModal('feed', feed)}
                              disabled={isLoading}
                              aria-label={`Edit feed ${feed.title}`}
                            >
                              <IconEdit width={16} height={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {uncategorizedFeeds.length > 0 && (
                <div className={styles.categoryGroup}>
                  <button
                    type="button"
                    className={styles.categoryHeader}
                    onClick={() => toggleCategoryCollapse('uncategorized')}
                    disabled={isLoading}
                  >
                    <div className={styles.categoryTitleWrap}>
                      <span
                        className={styles.expandIcon}
                        data-open={!collapsedCategories.has('uncategorized')}
                      >
                        <IconPlus width={12} height={12} />
                      </span>
                      <span className={styles.categoryTitle}>Uncategorised</span>
                      <span className={styles.count}>{uncategorizedFeeds.length}</span>
                    </div>
                  </button>
                  {!collapsedCategories.has('uncategorized') && (
                    <div className={styles.feedsUnderCategory}>
                      {uncategorizedFeeds.map((feed) => (
                        <div key={feed.id} className={styles.feedListItem}>
                          <span className={styles.feedListItem_Title}>{feed.title}</span>
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() => handleOpenEditModal('feed', feed)}
                            disabled={isLoading}
                            aria-label={`Edit feed ${feed.title}`}
                          >
                            <IconEdit width={16} height={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeView === 'look' && (
          <div className={styles.viewLook}>
            <button
              type="button"
              className={styles.themeWheel}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <div className={styles.themeWheel_Indicator} />
            </button>

            <div className={styles.themeCard}>
              {Object.entries(THEME_LABELS).map(([themeName, label]) => (
                <button
                  type="button"
                  key={themeName}
                  className={styles.themeOption}
                  data-active={theme === themeName}
                  onClick={() => setTheme(themeName)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.lookCard}
              data-kind="komorebi"
              onClick={() => setTheme('softlight')}
            />
            <button
              type="button"
              className={styles.lookCard}
              data-kind="rain"
              onClick={() => setTheme('green')}
            />
          </div>
        )}

        {activeView === 'other' && (
          <div className={styles.viewOther}>
            <div className={styles.profileRow}>
              <div className={styles.profileButton}>
                <UserButton />
              </div>
              <span>Profile</span>
            </div>

            <div className={styles.menuLinks}>
              <a href="https://peace.blog/about" target="_blank" rel="noreferrer">
                About
              </a>
              <a href="https://peace.blog/news" target="_blank" rel="noreferrer">
                Updates
              </a>
            </div>

            <div className={styles.footerLinks}>
              <a href="mailto:info@driesbos.com">Feedback</a>
              <a href="https://peace.blog/newsletter" target="_blank" rel="noreferrer">
                Newsletter
              </a>
              <a href="https://www.instagram.com/dries_bos" target="_blank" rel="noreferrer">
                IG
              </a>
            </div>
          </div>
        )}
      </div>
    </ModalContainer>
  );
}
