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
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import type { Category, Entry, Feed } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';
import { IconArrowShortRight } from '../icons/IconArrowShortRight';

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
  isLoading,
  starredEntries,
  onToggleEntryStar,
}: MenuModalProps) {
  const [activeView, setActiveView] = useState<MenuView>('feeds');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [localThemeChoice, setLocalThemeChoice] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  const displayTheme =
    localThemeChoice ??
    (typeof theme === 'string' && theme in THEME_LABELS ? theme : '');
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
    setLocalThemeChoice(null);
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

  const protectedCategoryIds = useMemo(() => {
    return new Set<number>(
      categories
        .filter((cat) => isProtectedCategoryTitle(cat.title))
        .map((cat) => cat.id),
    );
  }, [categories]);

  const nonProtectedFeeds = useMemo(() => {
    if (protectedCategoryIds.size === 0) return feeds;
    return feeds.filter((feed) => {
      if (!feed.category?.id) return true;
      return !protectedCategoryIds.has(feed.category.id);
    });
  }, [feeds, protectedCategoryIds]);

  const uncategorizedNonProtectedFeeds = useMemo(() => {
    if (protectedCategoryIds.size === 0) return uncategorizedFeeds;
    return uncategorizedFeeds.filter((feed) => {
      if (!feed.category?.id) return true;
      return !protectedCategoryIds.has(feed.category.id);
    });
  }, [uncategorizedFeeds, protectedCategoryIds]);

  const regularCategories = useMemo(() => {
    const rest = categories.slice(1);
    if (protectedCategoryIds.size === 0) return rest;
    return rest.filter((cat) => !protectedCategoryIds.has(cat.id));
  }, [categories, protectedCategoryIds]);

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

  const themeOptions = useMemo(
    () =>
      Object.entries(THEME_LABELS).map(([value, label]) => ({
        value,
        label: `${label} theme`,
      })),
    [],
  );

  const handleSelectTheme = useCallback(() => {
    if (!displayTheme) return;
    handleThemeChange(displayTheme);
    setLocalThemeChoice(null);
  }, [handleThemeChange, displayTheme]);

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

        {/* FEEDS VIEW (organise) */}
        {activeView === 'feeds' && (
          <div className={styles.viewFeeds}>
            {/* FEEDS LIST */}
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
              <div className={styles.feedList_Header}>
                <LabelWithCount count={nonProtectedFeeds.length}>
                  <span>All feeds</span>
                </LabelWithCount>{' '}
                <Button
                  type="button"
                  onClick={handleOpenAddModal}
                  disabled={isLoading}
                  variant="icon"
                  icon="plus"
                >
                  <IconWrapper>
                    <IconPlus />
                  </IconWrapper>
                </Button>
              </div>
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

              {regularCategories.map((cat) => {
                const categoryFeeds = nonProtectedFeeds.filter(
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

              {uncategorizedNonProtectedFeeds.length > 0 && (
                <div className={styles.categoryGroup}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() => toggleCategoryCollapse('uncategorized')}
                    disabled={isLoading}
                    count={uncategorizedNonProtectedFeeds.length}
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
                    {uncategorizedNonProtectedFeeds.map((feed) => (
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
            <div className={styles.viewLook_themeSelectRow}>
              <div className={styles.viewLook_themeSelectField}>
                <LabeledSelect
                  id="theme-select"
                  value={displayTheme}
                  onChange={setLocalThemeChoice}
                  options={themeOptions}
                  placeholder="Select theme"
                  disabled={isLoading}
                />
              </div>
              <Button
                type="button"
                variant="nav"
                onClick={handleSelectTheme}
                disabled={
                  isLoading ||
                  !displayTheme ||
                  (typeof theme === 'string' && displayTheme === theme)
                }
              >
                <span>Select</span>
              </Button>
            </div>
          </div>
        )}

        {activeView === 'other' && (
          <div className={styles.viewOther}>
            <div className={styles.viewOther_Links}>
              <div className={styles.viewOther_Profile}>
                <span>Profile</span>
                <UserButton />
              </div>
              <div className={styles.viewOther_Links_Item}>
                <Link href="/about">About</Link>
                <IconWrapper>
                  <IconArrowShortRight />
                </IconWrapper>
              </div>
              <div className={styles.viewOther_Links_Item}>
                <Link href="/updates">Updates</Link>
                <IconWrapper>
                  <IconArrowShortRight />
                </IconWrapper>
              </div>
              <div className={styles.viewOther_Links_Item}>
                <Link href="/tips">Tips</Link>
                <IconWrapper>
                  <IconArrowShortRight />
                </IconWrapper>
              </div>
            </div>

            <div className={styles.viewOther_Footer}>
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
