'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserButton } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import styles from './MenuModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { IconEdit } from '@/components/icons/IconEdit';
import { Button } from '@/components/Button/Button';
import { IconPlus } from '@/components/icons/IconPlus';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { LabelWithCount } from '@/components/LabelWithCount/LabelWithCount';
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
  const [nowMs, setNowMs] = useState(() => Date.now());
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

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  const timeParts = useMemo(() => {
    const date = new Date(nowMs);
    const hours24 = date.getHours();
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = ((hours24 + 11) % 12) + 1;

    return {
      hours: String(hours12).padStart(2, '0'),
      minutes: String(date.getMinutes()).padStart(2, '0'),
      period,
    };
  }, [nowMs]);

  const uncategorizedFeeds = useMemo(
    () =>
      feeds.filter(
        (feed) => !feed.category || feed.category.id === categories[0]?.id
      ),
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
            <Button
              variant="nav"
              type="button"
              className={styles.tab}
              active={activeView === 'feeds'}
              onClick={() => setActiveView('feeds')}
            >
              Feeds
            </Button>
            <Button
              variant="nav"
              type="button"
              className={styles.tab}
              active={activeView === 'look'}
              onClick={() => setActiveView('look')}
            >
              Look
            </Button>
            <Button
              variant="nav"
              type="button"
              className={styles.tab}
              active={activeView === 'other'}
              onClick={() => setActiveView('other')}
            >
              Other
            </Button>
          </div>
          <div className={styles.time}>
            <span>{timeParts.hours}</span>
            <span className={styles.timeColon}>:</span>
            <span>{timeParts.minutes}</span>
            <span className={styles.timePeriod}>{timeParts.period}</span>
          </div>
        </div>

        {activeView === 'feeds' && (
          <div className={styles.viewFeeds}>
            <Button
              type="button"
              onClick={handleOpenAddModal}
              disabled={isLoading}
              variant="nav"
            >
              <IconWrapper>
                <IconPlus />
              </IconWrapper>
              <span>Add content</span>
            </Button>

            <div className={styles.categoriesFeedsList}>
              <LabelWithCount label="All feeds" count={feeds.length} />
              {starredEntries.length > 0 && (
                <div className={styles.categoryGroup}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() => toggleCategoryCollapse('starred')}
                    disabled={isLoading}
                    active={!collapsedCategories.has('starred')}
                    count={starredEntries.length}
                  >
                    <IconWrapper>
                      <IconPlus />
                    </IconWrapper>
                    <span>Starred</span>
                  </Button>
                  {!collapsedCategories.has('starred') && (
                    <div className={styles.feedsUnderCategory}>
                      {starredEntries.map((entry) => (
                        <div key={entry.id} className={styles.feedListItem}>
                          <span className={styles.feedListItem_Title}>
                            {entry.title}
                          </span>
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
                      <Button
                        type="button"
                        variant="nav"
                        active={!isCollapsed}
                        onClick={() => toggleCategoryCollapse(cat.id)}
                        disabled={isLoading}
                        count={categoryFeeds.length}
                      >
                        <IconWrapper>
                          <IconPlus />
                        </IconWrapper>
                        <span>{cat.title}</span>
                      </Button>
                      <Button
                        variant="icon"
                        type="button"
                        onClick={() => handleOpenEditModal('category', cat)}
                        disabled={isLoading}
                        aria-label={`Edit category ${cat.title}`}
                      >
                        <IconWrapper>
                          <IconEdit />
                        </IconWrapper>
                      </Button>
                    </div>

                    {!isCollapsed && categoryFeeds.length > 0 && (
                      <div className={styles.feedsUnderCategory}>
                        {categoryFeeds.map((feed) => (
                          <div key={feed.id} className={styles.feedListItem}>
                            <span className={styles.feedListItem_Title}>
                              {feed.title}
                            </span>
                            <Button
                              variant="icon"
                              type="button"
                              onClick={() => handleOpenEditModal('feed', feed)}
                              disabled={isLoading}
                              aria-label={`Edit feed ${feed.title}`}
                            >
                              <IconWrapper>
                                <IconEdit />
                              </IconWrapper>
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {uncategorizedFeeds.length > 0 && (
                <div className={styles.categoryGroup}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() => toggleCategoryCollapse('uncategorized')}
                    disabled={isLoading}
                    count={uncategorizedFeeds.length}
                    active={!collapsedCategories.has('uncategorized')}
                  >
                    <IconWrapper>
                      <IconPlus />
                    </IconWrapper>
                    <span>Uncategorised</span>
                  </Button>
                  {!collapsedCategories.has('uncategorized') && (
                    <div className={styles.feedsUnderCategory}>
                      {uncategorizedFeeds.map((feed) => (
                        <div key={feed.id} className={styles.feedListItem}>
                          <span className={styles.feedListItem_Title}>
                            {feed.title}
                          </span>
                          <Button
                            variant="icon"
                            type="button"
                            onClick={() => handleOpenEditModal('feed', feed)}
                            disabled={isLoading}
                            aria-label={`Edit feed ${feed.title}`}
                          >
                            <IconWrapper>
                              <IconEdit />
                            </IconWrapper>
                          </Button>
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
              <a
                href="https://peace.blog/about"
                target="_blank"
                rel="noreferrer"
              >
                About
              </a>
              <a
                href="https://peace.blog/news"
                target="_blank"
                rel="noreferrer"
              >
                Updates
              </a>
            </div>

            <div className={styles.footerLinks}>
              <a href="mailto:info@driesbos.com">Feedback</a>
              <a
                href="https://peace.blog/newsletter"
                target="_blank"
                rel="noreferrer"
              >
                Newsletter
              </a>
              <a
                href="https://www.instagram.com/dries_bos"
                target="_blank"
                rel="noreferrer"
              >
                IG
              </a>
            </div>
          </div>
        )}
      </div>
    </ModalContainer>
  );
}
