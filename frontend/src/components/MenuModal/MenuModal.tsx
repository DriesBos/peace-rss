'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { useTheme } from 'next-themes';
import styles from './MenuModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { IconEdit } from '@/components/icons/IconEdit';
import { Button } from '@/components/Button/Button';
import { IconPlus } from '@/components/icons/IconPlus';
import { IconStar } from '@/components/icons/IconStar';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { LabelWithCount } from '@/components/LabelWithCount/LabelWithCount';
import type { Category, Entry, Feed } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';

type MenuView = 'feeds' | 'look' | 'other';

export type MenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  feeds: Feed[];
  openEditModal: (type: 'feed' | 'category', item: Feed | Category) => void;
  openAddModal: () => void;
  onRefreshFeeds: () => Promise<void> | void;
  isRefreshingFeeds: boolean;
  lastRefreshedAt: number | null;
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
  nightmode: 'Nightmode',
};
const THEME_TOAST_DEBOUNCE_MS = 350;

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
  onRefreshFeeds,
  isRefreshingFeeds,
  lastRefreshedAt,
  isLoading,
  starredEntries,
  onToggleEntryStar,
}: MenuModalProps) {
  const [activeView, setActiveView] = useState<MenuView>('feeds');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { theme, setTheme } = useTheme();
  const hasUserAdjustedCollapse = useRef(false);
  const categoriesListRef = useRef<HTMLDivElement | null>(null);
  const [feedsMaxHeight, setFeedsMaxHeight] = useState(0);
  const themeToastTimeoutRef = useRef<number | null>(null);

  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<number | string>
  >(() => buildInitialCollapsedCategories(categories));

  const resetCollapsedCategories = useCallback(() => {
    hasUserAdjustedCollapse.current = false;
    setCollapsedCategories(buildInitialCollapsedCategories(categories));
  }, [categories]);

  const toggleCategoryCollapse = useCallback((categoryId: number | string) => {
    hasUserAdjustedCollapse.current = true;
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
    hasUserAdjustedCollapse.current = false;
    setActiveView('feeds');
    resetCollapsedCategories();
    onClose();
  }, [onClose, resetCollapsedCategories]);

  useEffect(() => {
    if (!isOpen) {
      hasUserAdjustedCollapse.current = false;
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (hasUserAdjustedCollapse.current) return;

    const desired = buildInitialCollapsedCategories(categories);
    const isSame =
      desired.size === collapsedCategories.size &&
      Array.from(desired).every((key) => collapsedCategories.has(key));

    if (!isSame) {
      setCollapsedCategories(desired);
    }
  }, [isOpen, categories, collapsedCategories]);

  useKeydown(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    },
    {
      enabled: isOpen,
      target: typeof document !== 'undefined' ? document : null,
    },
  );

  useEffect(() => {
    if (!isOpen) return;

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (themeToastTimeoutRef.current !== null) {
        window.clearTimeout(themeToastTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (activeView !== 'feeds') return;

    const container = categoriesListRef.current;
    if (!container) return;

    const panels = Array.from(
      container.querySelectorAll<HTMLElement>(`.${styles.feedsUnderCategory}`),
    );
    const maxHeight = panels.reduce(
      (max, panel) => Math.max(max, panel.scrollHeight),
      0,
    );

    setFeedsMaxHeight(maxHeight);
  }, [isOpen, activeView, feeds, categories, starredEntries]);

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
        (feed) => !feed.category || feed.category.id === categories[0]?.id,
      ),
    [feeds, categories],
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
    [onClose, openEditModal, resetCollapsedCategories],
  );

  const queueThemeToast = useCallback((label: string) => {
    if (themeToastTimeoutRef.current !== null) {
      window.clearTimeout(themeToastTimeoutRef.current);
    }
    themeToastTimeoutRef.current = window.setTimeout(() => {
      toast(NOTIFICATION_COPY.app.themeChanged(label));
      themeToastTimeoutRef.current = null;
    }, THEME_TOAST_DEBOUNCE_MS);
  }, []);

  const handleThemeChange = useCallback(
    (nextTheme: string) => {
      if (nextTheme === theme) return;
      setTheme(nextTheme);
      const label = THEME_LABELS[nextTheme] ?? nextTheme;
      queueThemeToast(label);
    },
    [queueThemeToast, setTheme, theme],
  );

  const handleRefreshFeeds = useCallback(() => {
    if (isLoading) return;
    toast(NOTIFICATION_COPY.app.feedRefreshing);
    void onRefreshFeeds();
  }, [isLoading, onRefreshFeeds]);

  const refreshMeta = useMemo(() => {
    if (isRefreshingFeeds) return 'Refreshing feeds...';
    if (!lastRefreshedAt) return 'Not refreshed yet.';
    const label = new Date(lastRefreshedAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `Last refreshed ${label}`;
  }, [isRefreshingFeeds, lastRefreshedAt]);

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
              <span>Organise</span>
            </Button>
            <Button
              variant="nav"
              type="button"
              className={styles.tab}
              active={activeView === 'look'}
              onClick={() => setActiveView('look')}
            >
              <span>Looks</span>
            </Button>
            <Button
              variant="nav"
              type="button"
              className={styles.tab}
              active={activeView === 'other'}
              onClick={() => setActiveView('other')}
            >
              <span>Info</span>
            </Button>
          </div>
          <LabelWithCount count={timeParts.period}>
            <span>{timeParts.hours}</span>
            <span className={styles.timeColon}>:</span>
            <span>{timeParts.minutes}</span>
          </LabelWithCount>
        </div>

        {activeView === 'feeds' && (
          <div className={styles.viewFeeds}>
            <Button
              type="button"
              onClick={handleOpenAddModal}
              disabled={isLoading}
              variant="nav"
              icon="plus"
            >
              <IconWrapper>
                <IconPlus />
              </IconWrapper>
              <span>Add content</span>
            </Button>
            <Button
              type="button"
              onClick={handleRefreshFeeds}
              disabled={isLoading}
              variant="nav"
              className={styles.refreshButton}
            >
              <span>Refresh feeds</span>
              <span className={styles.refreshShortcut}>R</span>
            </Button>
            <div className={styles.refreshMeta}>{refreshMeta}</div>

            <div
              className={styles.categoriesFeedsList}
              ref={categoriesListRef}
              style={
                feedsMaxHeight > 0
                  ? ({
                      '--feeds-max-height': `${feedsMaxHeight}px`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <LabelWithCount count={feeds.length}>
                <span>All feeds</span>
              </LabelWithCount>
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
                  <div
                    className={styles.feedsUnderCategory}
                    data-open={!collapsedCategories.has('starred')}
                  >
                    {starredEntries.map((entry) => (
                      <div key={entry.id} className={styles.feedListItem}>
                        <span className={styles.feedListItem_Title}>
                          {entry.title}
                        </span>
                        <Button
                          variant="icon"
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await onToggleEntryStar(entry.id);
                              toast(NOTIFICATION_COPY.app.starRemoved);
                            } catch (error) {
                              toast.error(
                                NOTIFICATION_COPY.app.starRemoveError,
                              );
                            }
                          }}
                          disabled={isLoading}
                          title="Remove from starred"
                          aria-label={`Remove story from starred`}
                        >
                          <IconWrapper>
                            <IconStar />
                          </IconWrapper>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categories.slice(1).map((cat) => {
                const categoryFeeds = feeds.filter(
                  (feed) => feed.category?.id === cat.id,
                );
                const isCollapsed = collapsedCategories.has(cat.id);

                return (
                  <div key={cat.id} className={styles.categoryGroup}>
                    <div className={styles.categoryHeader}>
                      <Button
                        type="button"
                        variant="nav"
                        active={!isCollapsed}
                        icon="plus"
                        onClick={() => toggleCategoryCollapse(cat.id)}
                        disabled={isLoading}
                        count={
                          categoryFeeds.length > 0
                            ? categoryFeeds.length
                            : undefined
                        }
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

                    {categoryFeeds.length > 0 ? (
                      <div
                        className={styles.feedsUnderCategory}
                        data-open={!isCollapsed}
                      >
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
                    ) : (
                      <div className={styles.feedListItem_Empty} />
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
                  <div
                    className={styles.feedsUnderCategory}
                    data-open={!collapsedCategories.has('uncategorized')}
                  >
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
              onClick={() =>
                handleThemeChange(theme === 'dark' ? 'light' : 'dark')
              }
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
                  onClick={() => handleThemeChange(themeName)}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.lookCard}
              data-kind="komorebi"
              onClick={() => handleThemeChange('softlight')}
            />
            <button
              type="button"
              className={styles.lookCard}
              data-kind="rain"
              onClick={() => handleThemeChange('green')}
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
              <Link href="/about">About</Link>
              <Link href="/tips">Tips</Link>
              <Link href="/notifications">Notifications</Link>
              <Link href="/updates">Updates</Link>
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
