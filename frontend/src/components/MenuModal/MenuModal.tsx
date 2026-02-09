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
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import type { Category, Entry, Feed } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { isYouTubeFeedUrl } from '@/lib/youtube';
import { normalizeCategoryTitle } from '@/lib/protectedCategories';

type MenuView = 'feeds' | 'look' | 'other';
type StoriesWindowDays = 7 | 30 | 90;

export type MenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  feeds: Feed[];
  storiesWindowDays: StoriesWindowDays;
  onStoriesWindowDaysChange: (days: StoriesWindowDays) => void;
  openEditModal: (type: 'feed' | 'category', item: Feed | Category) => void;
  openAddModal: () => void;
  onRefreshFeeds: () => Promise<void> | void;
  isRefreshingFeeds: boolean;
  isLoading: boolean;
  globalFilterWords: string;
  onGlobalFilterWordsChange: (value: string) => void;
  onApplyGlobalFilterWords: (value: string) => Promise<boolean>;
  isApplyingGlobalFilterWords: boolean;
  globalFilterWordsError: string | null;
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
const STORIES_WINDOW_OPTIONS: StoriesWindowDays[] = [7, 30, 90];
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
  storiesWindowDays,
  onStoriesWindowDaysChange,
  openEditModal,
  openAddModal,
  onRefreshFeeds,
  isRefreshingFeeds,

  isLoading,
  globalFilterWords,
  onGlobalFilterWordsChange,
  onApplyGlobalFilterWords,
  isApplyingGlobalFilterWords,
  globalFilterWordsError,
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

  const protectedCategoriesByKind = useMemo(() => {
    const map = new Map<'youtube' | 'instagram' | 'twitter', Category>();
    for (const cat of categories) {
      const kind = normalizeCategoryTitle(cat.title);
      if (kind === 'youtube' || kind === 'instagram' || kind === 'twitter') {
        map.set(kind, cat);
      }
    }
    return map;
  }, [categories]);

  const youtubeCategory = protectedCategoriesByKind.get('youtube') ?? null;
  const instagramCategory = protectedCategoriesByKind.get('instagram') ?? null;
  const twitterCategory = protectedCategoriesByKind.get('twitter') ?? null;

  const protectedCategoryIds = useMemo(() => {
    return new Set<number>(
      Array.from(protectedCategoriesByKind.values()).map((cat) => cat.id),
    );
  }, [protectedCategoriesByKind]);

  const youtubeFeeds = useMemo(() => {
    return feeds.filter((feed) => {
      if (youtubeCategory && feed.category?.id === youtubeCategory.id)
        return true;
      return Boolean(feed.feed_url && isYouTubeFeedUrl(feed.feed_url));
    });
  }, [feeds, youtubeCategory]);

  const instagramFeeds = useMemo(() => {
    if (!instagramCategory) return [];
    return feeds.filter((feed) => feed.category?.id === instagramCategory.id);
  }, [feeds, instagramCategory]);

  const twitterFeeds = useMemo(() => {
    if (!twitterCategory) return [];
    return feeds.filter((feed) => feed.category?.id === twitterCategory.id);
  }, [feeds, twitterCategory]);

  const protectedFeedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const feed of feeds) {
      if (feed.category?.id && protectedCategoryIds.has(feed.category.id)) {
        ids.add(feed.id);
        continue;
      }
      if (feed.feed_url && isYouTubeFeedUrl(feed.feed_url)) {
        ids.add(feed.id);
      }
    }
    return ids;
  }, [feeds, protectedCategoryIds]);

  const nonProtectedFeeds = useMemo(() => {
    if (protectedFeedIds.size === 0) return feeds;
    return feeds.filter((feed) => !protectedFeedIds.has(feed.id));
  }, [feeds, protectedFeedIds]);

  const uncategorizedNonProtectedFeeds = useMemo(() => {
    if (protectedFeedIds.size === 0) return uncategorizedFeeds;
    return uncategorizedFeeds.filter((feed) => !protectedFeedIds.has(feed.id));
  }, [uncategorizedFeeds, protectedFeedIds]);

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

  const handleRefreshFeeds = useCallback(() => {
    if (isLoading) return;
    toast(NOTIFICATION_COPY.app.feedRefreshing);
    void onRefreshFeeds();
  }, [isLoading, onRefreshFeeds]);

  const handleApplyGlobalFilterWords = useCallback(async () => {
    const didSucceed = await onApplyGlobalFilterWords(globalFilterWords);
    if (didSucceed) {
      toast(NOTIFICATION_COPY.app.feedUpdated);
    }
  }, [globalFilterWords, onApplyGlobalFilterWords]);

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
            {/* ADD CONTENT BUTTON */}
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
              <LabelWithCount count={nonProtectedFeeds.length}>
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

            {/* YOUTUBE FEEDS LIST */}
            {youtubeFeeds.length > 0 && (
              <div className={styles.youtubeFeedsList}>
                <div className={styles.categoryHeader}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() =>
                      toggleCategoryCollapse(youtubeCategory?.id ?? 'youtube')
                    }
                    disabled={isLoading}
                    active={
                      !collapsedCategories.has(youtubeCategory?.id ?? 'youtube')
                    }
                    count={youtubeFeeds.length}
                  >
                    <IconWrapper>
                      <IconPlus />
                    </IconWrapper>
                    <span>{youtubeCategory?.title ?? 'YouTube'}</span>
                  </Button>
                </div>
                <div
                  className={styles.feedsUnderCategory}
                  data-open={
                    !collapsedCategories.has(youtubeCategory?.id ?? 'youtube')
                  }
                >
                  {youtubeFeeds.map((feed) => (
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

            {/* INSTAGRAM FEEDS LIST */}
            {instagramFeeds.length > 0 && (
              <div className={styles.youtubeFeedsList}>
                <div className={styles.categoryHeader}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() =>
                      toggleCategoryCollapse(
                        instagramCategory?.id ?? 'instagram',
                      )
                    }
                    disabled={isLoading}
                    active={
                      !collapsedCategories.has(
                        instagramCategory?.id ?? 'instagram',
                      )
                    }
                    count={instagramFeeds.length}
                  >
                    <IconWrapper>
                      <IconPlus />
                    </IconWrapper>
                    <span>{instagramCategory?.title ?? 'Instagram'}</span>
                  </Button>
                </div>
                <div
                  className={styles.feedsUnderCategory}
                  data-open={
                    !collapsedCategories.has(
                      instagramCategory?.id ?? 'instagram',
                    )
                  }
                >
                  {instagramFeeds.map((feed) => (
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

            {/* TWITTER FEEDS LIST */}
            {twitterFeeds.length > 0 && (
              <div className={styles.youtubeFeedsList}>
                <div className={styles.categoryHeader}>
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() =>
                      toggleCategoryCollapse(twitterCategory?.id ?? 'twitter')
                    }
                    disabled={isLoading}
                    active={
                      !collapsedCategories.has(twitterCategory?.id ?? 'twitter')
                    }
                    count={twitterFeeds.length}
                  >
                    <IconWrapper>
                      <IconPlus />
                    </IconWrapper>
                    <span>{twitterCategory?.title ?? 'Twitter'}</span>
                  </Button>
                </div>
                <div
                  className={styles.feedsUnderCategory}
                  data-open={
                    !collapsedCategories.has(twitterCategory?.id ?? 'twitter')
                  }
                >
                  {twitterFeeds.map((feed) => (
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

            {/* OTHER SETTINGS */}
            <div className={styles.otherSettings}>
              <LabelWithCount count={0}>
                <span>Other Settings</span>
              </LabelWithCount>

              <div className={styles.otherSettings_Body}>
                <div className={styles.otherSettings_FilterWords}>
                  <LabeledInput
                    id="global-filter-words"
                    label="Filter-out words"
                    value={globalFilterWords}
                    onChange={onGlobalFilterWordsChange}
                    placeholder="war, politics, ads"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="nav"
                    onClick={() => void handleApplyGlobalFilterWords()}
                    disabled={isLoading || isApplyingGlobalFilterWords}
                  >
                    {isApplyingGlobalFilterWords ? 'Applying...' : 'Apply now'}
                  </Button>
                </div>
                <div className={styles.otherSettings_Help}>
                  Enter comma-separated words filter to filkter-out from all
                  feeds.
                </div>
                {globalFilterWordsError ? (
                  <div className={styles.otherSettings_Error}>
                    {globalFilterWordsError}
                  </div>
                ) : null}
              </div>
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
              <div className={styles.cardSection}>
                <div className={styles.cardLabel}>Theme</div>
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

              <div className={styles.cardDivider} />

              <div className={styles.cardSection}>
                <div className={styles.cardLabel}>Stories</div>
                {STORIES_WINDOW_OPTIONS.map((days) => (
                  <button
                    type="button"
                    key={days}
                    className={styles.themeOption}
                    data-active={storiesWindowDays === days}
                    onClick={() => onStoriesWindowDaysChange(days)}
                  >
                    Last {days} days
                  </button>
                ))}
              </div>
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
