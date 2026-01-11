'use client';

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/nextjs';
import { useInView } from 'react-intersection-observer';
import IntersectionImage from 'react-intersection-image';
import styles from './page.module.sass';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { EntryItem } from '@/components/EntryItem/EntryItem';
import { Button } from '@/components/Button/Button';
import { FormattedDate } from '@/components/FormattedDate';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { SlidePanel } from '@/components/SlidePanel/SlidePanel';
import { IconMenu } from '@/components/icons/IconMenu';
import { Footer } from '@/components/Footer/Footer';
import { IconArrowShortLeft } from '@/components/icons/IconArrowShortLeft';
import { IconArrowShortRight } from '@/components/icons/IconArrowShortRight';
import { IconEdit } from '@/components/icons/IconEdit';

type Category = {
  id: number;
  user_id: number;
  title: string;
};

type Feed = {
  id: number;
  title: string;
  feed_url?: string;
  unread_count?: number;
  category?: { id: number; title: string };
};

type Entry = {
  id: number;
  title: string;
  url: string;
  content?: string;
  author?: string;
  feed_id: number;
  feed?: { id: number; title: string };
  feed_title?: string;
  published_at?: string;
  status?: 'read' | 'unread';
  starred?: boolean;
  bookmarked?: boolean;
};

type EntriesResponse = {
  total: number;
  entries: Entry[];
};

type FeedCountersResponse = {
  reads?: Record<string, number>;
  unreads?: Record<string, number>;
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function formatDate(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

// Lazy loading wrapper for entry items
type LazyEntryItemProps = {
  entry: Entry;
  selectedEntryId: number | null;
  feedsById: Map<number, Feed>;
  onEntryClick: (id: number) => void;
};

function LazyEntryItem({
  entry,
  selectedEntryId,
  feedsById,
  onEntryClick,
}: LazyEntryItemProps) {
  const { ref, inView } = useInView({
    threshold: 0.5,
    // rootMargin: '0px', // Load 0px before entering viewport
    triggerOnce: true, // Once loaded, stay rendered
  });

  const isActive = entry.id === selectedEntryId;
  const feedTitle =
    entry.feed_title ??
    entry.feed?.title ??
    feedsById.get(entry.feed_id)?.title;
  const published = formatDate(entry.published_at);

  return (
    <div ref={ref} className={styles.lazyEntryWrapper}>
      {inView && (
        <EntryItem
          title={entry.title}
          author={entry.author}
          feedTitle={feedTitle}
          publishedAt={published}
          active={isActive}
          content={entry.content}
          url={entry.url}
          onClick={() => onEntryClick(entry.id)}
        />
      )}
    </div>
  );
}

function useLazyEntryContent(html?: string) {
  return useMemo<ReactNode[] | null>(() => {
    const canUseDom =
      typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined';

    if (!html || !canUseDom) return null;

    try {
      return convertHtmlToReactNodes(html);
    } catch {
      return null;
    }
  }, [html]);
}

function convertHtmlToReactNodes(html: string): ReactNode[] {
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return Array.from(doc.body.childNodes)
    .map((node, index) => transformNodeToReact(node, `entry-node-${index}`))
    .filter(
      (child): child is ReactNode => child !== null && child !== undefined
    );
}

// Void elements that cannot have children in React
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function transformNodeToReact(node: ChildNode, key: string): ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'script' || tagName === 'style') {
    return null;
  }

  if (tagName === 'img') {
    return createLazyImageElement(element as HTMLImageElement, key);
  }

  const props = buildElementProps(element);

  // Void elements must not have children
  if (VOID_ELEMENTS.has(tagName)) {
    return createElement(tagName, { ...props, key });
  }

  const children = Array.from(element.childNodes).map((child, childIndex) =>
    transformNodeToReact(child, `${key}-${childIndex}`)
  );

  return createElement(tagName, { ...props, key }, children);
}

type ElementProps = Record<string, unknown> & {
  className?: string;
  style?: CSSProperties;
};

function buildElementProps(
  element: Element,
  options: { omit?: string[] } = {}
): ElementProps {
  const props: ElementProps = {};
  const omit = new Set(
    (options.omit ?? []).map((attrName) => attrName.toLowerCase())
  );

  Array.from(element.attributes).forEach((attr) => {
    const lowerName = attr.name.toLowerCase();
    if (omit.has(lowerName)) {
      return;
    }

    if (lowerName.startsWith('on')) {
      return;
    }

    if (lowerName === 'style') {
      const styleObj = styleStringToObject(attr.value);
      if (styleObj) {
        props.style = { ...(props.style ?? {}), ...styleObj };
      }
      return;
    }

    const mappedName = mapAttributeName(attr.name);

    if (mappedName === 'className') {
      props.className = props.className
        ? `${props.className} ${attr.value}`
        : attr.value;
      return;
    }

    props[mappedName] = attr.value;
  });

  return props;
}

function createLazyImageElement(
  element: HTMLImageElement,
  key: string
): ReactNode | null {
  const src = element.getAttribute('src');

  if (!src) {
    return null;
  }

  const baseProps = buildElementProps(element, {
    omit: ['src', 'srcset', 'sizes'],
  });

  const {
    className: htmlClassName,
    style: htmlStyle,
    ...restProps
  } = baseProps;

  const combinedClassName = [styles.lazyEntryImage, htmlClassName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const mergedStyle: CSSProperties = {
    ...(htmlStyle ?? {}),
  };

  if (!mergedStyle.transition) {
    mergedStyle.transition = 'opacity 0.6s ease-in-out';
  }

  const srcSet = element.getAttribute('srcset');
  const sizes = element.getAttribute('sizes');
  const alt = element.getAttribute('alt') ?? '';

  return (
    <IntersectionImage
      key={key}
      {...restProps}
      src={src}
      alt={alt}
      srcSet={srcSet ?? undefined}
      sizes={sizes ?? undefined}
      className={combinedClassName || undefined}
      style={Object.keys(mergedStyle).length ? mergedStyle : {}}
    />
  );
}

function styleStringToObject(value: string): CSSProperties | undefined {
  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  if (declarations.length === 0) {
    return undefined;
  }

  const styleObject: Record<string, string> = {};

  declarations.forEach((declaration) => {
    const separatorIndex = declaration.indexOf(':');
    if (separatorIndex === -1) {
      return;
    }

    const property = declaration.slice(0, separatorIndex).trim();
    const rawValue = declaration.slice(separatorIndex + 1).trim();

    if (!property || !rawValue) {
      return;
    }

    const camelCased = property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

    styleObject[camelCased] = rawValue;
  });

  return Object.keys(styleObject).length
    ? (styleObject as CSSProperties)
    : undefined;
}

function mapAttributeName(name: string): string {
  const normalized = name.toLowerCase();

  switch (normalized) {
    case 'class':
      return 'className';
    case 'for':
      return 'htmlFor';
    case 'http-equiv':
      return 'httpEquiv';
    case 'accept-charset':
      return 'acceptCharset';
    case 'maxlength':
      return 'maxLength';
    case 'tabindex':
      return 'tabIndex';
    case 'readonly':
      return 'readOnly';
    case 'colspan':
      return 'colSpan';
    case 'rowspan':
      return 'rowSpan';
    case 'frameborder':
      return 'frameBorder';
    case 'allowfullscreen':
      return 'allowFullScreen';
    case 'srcset':
      return 'srcSet';
    default:
      return name;
  }
}

type MenuModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  feeds: Feed[];
  newCategoryTitle: string;
  setNewCategoryTitle: (value: string) => void;
  addCategoryLoading: boolean;
  addCategoryError: string | null;
  addCategory: (e: React.FormEvent) => void;
  newFeedUrl: string;
  setNewFeedUrl: (value: string) => void;
  newFeedCategoryId: number | null;
  setNewFeedCategoryId: (value: number | null) => void;
  addFeedLoading: boolean;
  addFeedError: string | null;
  addFeed: (e: React.FormEvent) => void;
  openEditModal: (type: 'feed' | 'category', item: Feed | Category) => void;
  isLoading: boolean;
};

// function ThemeModal({
//   isOpen,
//   onClose,
// }: {
//   isOpen: boolean;
//   onClose: () => void;
// }) {
//   return (
//     <ModalContainer isOpen={isOpen} onClose={onClose} ariaLabel="Theme">
//       <div className={styles.modalTheme}>
//         <ThemeSwitcher />
//       </div>
//     </ModalContainer>
//   );
// }

function MenuModal({
  isOpen,
  onClose,
  categories,
  feeds,
  newCategoryTitle,
  setNewCategoryTitle,
  addCategoryLoading,
  addCategoryError,
  addCategory,
  newFeedUrl,
  setNewFeedUrl,
  newFeedCategoryId,
  setNewFeedCategoryId,
  addFeedLoading,
  addFeedError,
  addFeed,
  openEditModal,
  isLoading,
}: MenuModalProps) {
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

        {/* Combined Categories & Feeds Section */}
        <div className={styles.modalMenu_CategoriesFeeds}>
          <div className={styles.sectionTitle}>Categories & Feeds</div>

          {/* Categories with nested Feeds */}
          <div className={styles.categoriesFeedsList}>
            {categories.length <= 1 && feeds.length === 0 ? (
              <div className={styles.muted}>No categories or feeds yet.</div>
            ) : (
              <>
                {/* User-created categories (skip "All" category) */}
                {categories.slice(1).map((cat) => {
                  const categoryFeeds = feeds.filter(
                    (feed) => feed.category?.id === cat.id
                  );
                  return (
                    <div key={cat.id} className={styles.categoryGroup}>
                      {/* Category Header */}
                      <div className={styles.categoryHeader}>
                        <span className={styles.categoryTitle}>
                          {cat.title}
                        </span>
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
                      {/* Feeds under this category */}
                      {categoryFeeds.length > 0 && (
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

                {/* Uncategorized Feeds */}
                {(() => {
                  const uncategorizedFeeds = feeds.filter(
                    (feed) =>
                      !feed.category || feed.category.id === categories[0]?.id
                  );
                  if (uncategorizedFeeds.length > 0) {
                    return (
                      <div className={styles.categoryGroup}>
                        <div className={styles.categoryHeader}>
                          <span className={styles.categoryTitle}>
                            Uncategorized
                          </span>
                        </div>
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
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>

          {/* Add Category Form */}
          <div className={styles.formSection}>
            <div className={styles.formTitle}>Add Category</div>
            <form onSubmit={addCategory} className={styles.addForm}>
              <input
                type="text"
                value={newCategoryTitle}
                onChange={(e) => setNewCategoryTitle(e.target.value)}
                placeholder="Category name"
                disabled={addCategoryLoading || isLoading}
                className={styles.input}
              />
              <button
                type="submit"
                disabled={
                  addCategoryLoading || isLoading || !newCategoryTitle.trim()
                }
                className={styles.button}
              >
                {addCategoryLoading ? 'Adding...' : 'Add category'}
              </button>
              {addCategoryError && (
                <div className={styles.error}>{addCategoryError}</div>
              )}
            </form>
          </div>

          {/* Add Feed Form */}
          <div className={styles.formSection}>
            <div className={styles.formTitle}>Add Feed</div>
            <form onSubmit={addFeed} className={styles.addForm}>
              <input
                type="text"
                value={newFeedUrl}
                onChange={(e) => setNewFeedUrl(e.target.value)}
                placeholder="RSS feed URL"
                disabled={addFeedLoading || isLoading}
                className={styles.input}
              />
              <select
                value={newFeedCategoryId ?? ''}
                onChange={(e) =>
                  setNewFeedCategoryId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                disabled={addFeedLoading || isLoading}
                className={styles.select}
              >
                <option value="">Select category (optional)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={addFeedLoading || isLoading || !newFeedUrl.trim()}
                className={styles.button}
              >
                {addFeedLoading ? 'Adding...' : 'Add feed'}
              </button>
              {addFeedError && (
                <div className={styles.error}>{addFeedError}</div>
              )}
            </form>
          </div>
        </div>

        <Footer />
        {/* <div className={styles.feedList}>
                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    selectedFeedId === null && !isStarredView && !searchMode
                      ? styles.feedItemActive
                      : ''
                  }`}
                  onClick={() => {
                    setSelectedFeedId(null);
                    setIsStarredView(false);
                    setSearchMode(false);
                  }}
                  disabled={isLoading}
                >
                  <span className={styles.feedTitle}>All feeds</span>
                </button>

                <button
                  type="button"
                  className={`${styles.feedItem} ${
                    isStarredView ? styles.feedItemActive : ''
                  }`}
                  onClick={() => {
                    setSelectedFeedId(null);
                    setIsStarredView(true);
                    setSearchMode(false);
                  }}
                  disabled={isLoading}
                >
                  <span className={styles.feedTitle}>⭐ Starred</span>
                </button>

                {filteredFeeds.length === 0 ? (
                  <div className={styles.muted}>
                    {selectedCategoryId
                      ? 'No feeds in this category.'
                      : 'No feeds yet.'}
                  </div>
                ) : (
                  filteredFeeds.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`${styles.feedItem} ${
                        selectedFeedId === f.id && !searchMode
                          ? styles.feedItemActive
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedFeedId(f.id);
                        setSearchMode(false);
                      }}
                      disabled={isLoading}
                      title={f.title}
                    >
                      <span className={styles.feedTitle}>{f.title}</span>
                      {typeof f.unread_count === 'number' ? (
                        <span className={styles.badge}>{f.unread_count}</span>
                      ) : null}
                    </button>
                  ))
                )}
              </div> */}

        {/* Search Section */}
        {/* <div
                className={styles.sectionTitle}
                style={{ marginTop: '2rem' }}
              >
                Search
              </div>
              <form onSubmit={handleSearch} className={styles.addFeedForm}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  disabled={isLoading}
                  className={styles.input}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={isLoading || !searchQuery.trim()}
                    className={styles.button}
                  >
                    Search
                  </button>
                  {searchMode && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      disabled={isLoading}
                      className={styles.button}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form> */}
      </div>
    </ModalContainer>
  );
}

export default function Home() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null
  );
  const [isStarredView, setIsStarredView] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProvisioned, setIsProvisioned] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
    null
  );
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [fetchingOriginal, setFetchingOriginal] = useState(false);
  const [fetchedEntryIds, setFetchedEntryIds] = useState<Set<number>>(
    new Set()
  );
  const [categoryCounts, setCategoryCounts] = useState<Map<number, number>>(
    new Map()
  );
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editType, setEditType] = useState<'feed' | 'category' | null>(null);
  const [editItemId, setEditItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openMenuModal = useCallback(() => setIsMenuModalOpen(true), []);
  const closeMenuModal = useCallback(() => setIsMenuModalOpen(false), []);

  const openEditModal = useCallback(
    (type: 'feed' | 'category', item: Feed | Category) => {
      setEditType(type);
      setEditItemId(item.id);
      setEditTitle(item.title);
      if (type === 'feed') {
        const feed = item as Feed;
        setEditFeedUrl(feed.feed_url || '');
        setEditCategoryId(feed.category?.id || null);
      }
      setIsEditModalOpen(true);
      setEditError(null);
    },
    []
  );

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditType(null);
    setEditItemId(null);
    setEditTitle('');
    setEditFeedUrl('');
    setEditCategoryId(null);
    setEditError(null);
  }, []);

  const feedsById = useMemo(() => {
    const map = new Map<number, Feed>();
    for (const feed of feeds) map.set(feed.id, feed);
    return map;
  }, [feeds]);

  const selectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  const { selectedIndex, hasPrev, hasNext } = useMemo(() => {
    const index = entries.findIndex((e) => e.id === selectedEntryId);
    return {
      selectedIndex: index,
      hasPrev: index > 0,
      hasNext: index >= 0 && index < entries.length - 1,
    };
  }, [entries, selectedEntryId]);

  // Calculate unread count per category
  // First try from stored categoryCounts (from entries API), fallback to summing feed unread_count
  const categoryUnreadCounts = useMemo(() => {
    const counts = new Map<number, number>(categoryCounts);

    // Fill in any missing counts by summing feed unread_count
    for (const feed of feeds) {
      const categoryId = feed.category?.id;
      const unreadCount = feed.unread_count;

      if (categoryId && typeof unreadCount === 'number') {
        // Only use feed count if we don't already have a stored count for this category
        if (!counts.has(categoryId)) {
          const current = counts.get(categoryId) ?? 0;
          counts.set(categoryId, current + unreadCount);
        }
      }
    }
    return counts;
  }, [feeds, categoryCounts]);

  const loadUnreadCounters = useCallback(async () => {
    try {
      const counters = await fetchJson<FeedCountersResponse>(
        '/api/feeds/counters'
      );
      const totalUnread = Object.values(counters.unreads ?? {}).reduce(
        (sum, value) => sum + value,
        0
      );
      setTotalUnreadCount(totalUnread);
    } catch (err) {
      console.error('Failed to load unread counters', err);
    }
  }, []);

  useEffect(() => {
    if (!isProvisioned) return;
    void loadUnreadCounters();
  }, [isProvisioned, entries, loadUnreadCounters]);

  async function loadFeeds() {
    const data = await fetchJson<Feed[]>('/api/feeds');
    setFeeds(data);
  }

  async function loadCategories() {
    const data = await fetchJson<Category[]>('/api/categories');
    setCategories(data);

    // Fetch unread counts for all categories
    const counts = new Map<number, number>();
    await Promise.all(
      data.map(async (cat) => {
        try {
          const entriesData = await fetchJson<EntriesResponse>(
            `/api/entries?status=unread&category_id=${cat.id}&limit=1&offset=0`
          );
          counts.set(cat.id, entriesData.total ?? 0);
        } catch (e) {
          // Ignore errors, count will remain 0
          console.error(`Failed to load count for category ${cat.id}:`, e);
        }
      })
    );
    setCategoryCounts(counts);
  }

  function entriesUrl(nextOffset: number) {
    const qs = new URLSearchParams({
      limit: '50',
      offset: String(nextOffset),
      order: 'published_at',
      direction: 'desc',
    });

    if (searchMode && searchQuery.trim()) {
      // For search mode, search all entries
      qs.set('search', searchQuery.trim());
    } else if (isStarredView) {
      // For starred view, fetch starred entries (any status)
      qs.set('starred', 'true');
    } else {
      // For normal view, fetch unread entries
      qs.set('status', 'unread');
    }

    if (selectedFeedId && !searchMode)
      qs.set('feed_id', String(selectedFeedId));

    if (selectedCategoryId !== null && !searchMode)
      qs.set('category_id', String(selectedCategoryId));

    return `/api/entries?${qs.toString()}`;
  }

  async function loadEntries(opts?: { append?: boolean; nextOffset?: number }) {
    const append = Boolean(opts?.append);
    const nextOffset = opts?.nextOffset ?? 0;

    const data = await fetchJson<EntriesResponse>(entriesUrl(nextOffset));
    setTotal(data.total ?? 0);
    setOffset(nextOffset);

    // Store category count when loading entries for a specific category
    if (
      selectedCategoryId !== null &&
      !searchMode &&
      !isStarredView &&
      nextOffset === 0
    ) {
      setCategoryCounts((prev) => {
        const updated = new Map(prev);
        updated.set(selectedCategoryId, data.total ?? 0);
        return updated;
      });
    }

    if (append) {
      setEntries((prev) => [...prev, ...data.entries]);
      return;
    }

    setEntries(data.entries);
    // Only keep selection if the previously selected entry still exists
    // Don't auto-select the first entry on initial load
    setSelectedEntryId((prev) => {
      if (prev && data.entries.some((e) => e.id === prev)) return prev;
      return null;
    });
  }

  // TODO: Active for feed pull downs
  // async function refreshAll() {
  //   setIsLoading(true);
  //   setError(null);
  //   try {
  //     await Promise.all([
  //       loadFeeds(),
  //       loadCategories(),
  //       loadEntries({ append: false, nextOffset: 0 }),
  //     ]);
  //   } catch (e) {
  //     setError(e instanceof Error ? e.message : 'Failed to load');
  //   } finally {
  //     setIsLoading(false);
  //   }
  // }

  async function markEntryStatus(
    entryIds: number[],
    status: 'read' | 'unread'
  ) {
    await fetchJson<{ ok: true }>('/api/entries/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_ids: entryIds, status }),
    });
  }

  async function markPageRead() {
    if (entries.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await markEntryStatus(
        entries.map((e) => e.id),
        'read'
      );
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to mark page read');
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleSelectedStar() {
    if (!selectedEntry) return;
    setIsLoading(true);
    setError(null);
    try {
      await fetchJson<{ ok: true }>(
        `/api/entries/${selectedEntry.id}/bookmark`,
        {
          method: 'POST',
        }
      );
      // Refresh list + selection state
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: offset }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle star');
    } finally {
      setIsLoading(false);
    }
  }

  async function setSelectedStatus(status: 'read' | 'unread') {
    if (!selectedEntry) return;
    setIsLoading(true);
    setError(null);
    try {
      await markEntryStatus([selectedEntry.id], status);
      await Promise.all([
        loadFeeds(),
        loadEntries({ append: false, nextOffset: 0 }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMore() {
    setIsLoading(true);
    setError(null);
    try {
      await loadEntries({ append: true, nextOffset: offset + 50 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }

  async function bootstrap() {
    try {
      const res = await fetchJson<{ ok: boolean; provisioned: boolean }>(
        '/api/bootstrap',
        { method: 'POST' }
      );
      if (res.ok && res.provisioned) {
        setIsProvisioned(true);
        setProvisionError(null);
      }
    } catch (e) {
      setProvisionError(e instanceof Error ? e.message : 'Provisioning failed');
      setIsProvisioned(false);
    }
  }

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();

    const trimmedUrl = newFeedUrl.trim();
    if (!trimmedUrl) return;

    setAddFeedLoading(true);
    setAddFeedError(null);

    try {
      const requestBody: { feed_url: string; category_id?: number } = {
        feed_url: trimmedUrl,
      };

      if (newFeedCategoryId) {
        requestBody.category_id = newFeedCategoryId;
      }

      await fetchJson<unknown>('/api/feeds/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // Success: clear input and refresh feeds
      setNewFeedUrl('');
      setNewFeedCategoryId(null);
      await loadFeeds();
    } catch (e) {
      setAddFeedError(e instanceof Error ? e.message : 'Failed to add feed');
    } finally {
      setAddFeedLoading(false);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();

    const trimmedTitle = newCategoryTitle.trim();
    if (!trimmedTitle) return;

    setAddCategoryLoading(true);
    setAddCategoryError(null);

    try {
      await fetchJson<unknown>('/api/categories/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      // Success: clear input and refresh categories
      setNewCategoryTitle('');
      await loadCategories();
    } catch (e) {
      setAddCategoryError(
        e instanceof Error ? e.message : 'Failed to add category'
      );
    } finally {
      setAddCategoryLoading(false);
    }
  }

  async function deleteCategory(categoryId: number) {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      // Success: refresh categories and feeds
      await Promise.all([loadCategories(), loadFeeds()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category');
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteFeed(feedId: number) {
    if (!confirm('Are you sure you want to delete this feed?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${feedId}`, {
        method: 'DELETE',
      });

      // Success: refresh feeds
      await loadFeeds();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete feed');
    } finally {
      setIsLoading(false);
    }
  }

  async function updateCategory(e: React.FormEvent) {
    e.preventDefault();

    if (!editItemId) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/categories/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmedTitle }),
      });

      // Success: close modal and refresh categories
      closeEditModal();
      await loadCategories();
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : 'Failed to update category'
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function updateFeed(e: React.FormEvent) {
    e.preventDefault();

    if (!editItemId) return;

    const trimmedTitle = editTitle.trim();
    const trimmedUrl = editFeedUrl.trim();

    if (!trimmedTitle || !trimmedUrl) return;

    setEditLoading(true);
    setEditError(null);

    try {
      await fetchJson<{ ok: boolean }>(`/api/feeds/${editItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          feed_url: trimmedUrl,
          category_id: editCategoryId,
        }),
      });

      // Success: close modal and refresh feeds
      closeEditModal();
      await loadFeeds();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update feed');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;

    setSearchMode(true);
    setIsStarredView(false);
    setSelectedFeedId(null);

    setIsLoading(true);
    setError(null);
    try {
      await loadEntries({ append: false, nextOffset: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to search');
    } finally {
      setIsLoading(false);
    }
  }

  // function clearSearch() {
  //   setSearchQuery('');
  //   setSearchMode(false);
  // }

  const fetchOriginalArticle = useCallback(
    async (entryId?: number) => {
      const targetEntry = entryId
        ? entries.find((e) => e.id === entryId)
        : selectedEntry;

      if (!targetEntry || !isProvisioned) return;

      // Skip if we've already attempted to fetch this entry
      if (fetchedEntryIds.has(targetEntry.id)) return;

      setFetchingOriginal(true);
      setError(null);

      try {
        const result = await fetchJson<{ ok: boolean; content: string }>(
          `/api/entries/${targetEntry.id}/fetch-content`,
          { method: 'POST' }
        );

        if (result.ok && result.content) {
          // Update the entry in the entries array with the new content
          setEntries((prev) =>
            prev.map((e) =>
              e.id === targetEntry.id ? { ...e, content: result.content } : e
            )
          );
          // Mark this entry as fetched
          setFetchedEntryIds((prev) => new Set(prev).add(targetEntry.id));
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Failed to fetch original article'
        );
        // Mark as fetched even on error to avoid retry loops
        setFetchedEntryIds((prev) => new Set(prev).add(targetEntry.id));
      } finally {
        setFetchingOriginal(false);
      }
    },
    [selectedEntry, entries, isProvisioned, fetchedEntryIds]
  );

  const handleEntrySelect = useCallback(
    (entryId: number) => {
      setSelectedEntryId(entryId);

      // Immediately check if we should fetch original content
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;

      // Always attempt to fetch if not already fetched, regardless of content length
      // This ensures we get the full article content when available
      if (!fetchedEntryIds.has(entryId) && isProvisioned) {
        // Trigger fetch with the entry ID immediately
        void fetchOriginalArticle(entryId);
      }
    },
    [entries, fetchedEntryIds, isProvisioned, fetchOriginalArticle]
  );

  const navigateToPrev = useCallback(() => {
    if (hasPrev && selectedIndex > 0) {
      handleEntrySelect(entries[selectedIndex - 1].id);
    }
  }, [hasPrev, selectedIndex, entries, handleEntrySelect]);

  const navigateToNext = useCallback(() => {
    if (hasNext && selectedIndex < entries.length - 1) {
      handleEntrySelect(entries[selectedIndex + 1].id);
    }
  }, [hasNext, selectedIndex, entries, handleEntrySelect]);

  // Bootstrap on mount
  useEffect(() => {
    void bootstrap();
  }, []);

  // Load feeds/entries after provisioning
  useEffect(() => {
    if (!isProvisioned) return;

    setIsLoading(true);
    setError(null);
    Promise.all([
      loadFeeds(),
      loadCategories(),
      loadEntries({ append: false, nextOffset: 0 }),
    ])
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFeedId,
    selectedCategoryId,
    isStarredView,
    searchMode,
    isProvisioned,
  ]);

  // Keyboard shortcuts for navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // j or ArrowDown = next entry
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasNext) navigateToNext();
      }
      // k or ArrowUp = previous entry
      else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasPrev) navigateToPrev();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, navigateToNext, navigateToPrev]);

  // Console log entries data
  useEffect(() => {
    console.log('Entries data:', entries);
    console.log(`Total entries loaded: ${entries.length}`);
  }, [entries]);

  // Auto-fetch original article when entry is selected (safety net)
  // Primary fetch happens in handleEntrySelect for immediate response
  // This useEffect acts as a fallback in case handleEntrySelect didn't trigger
  useEffect(() => {
    if (!selectedEntry || fetchingOriginal || !isProvisioned) return;

    // Skip if we've already attempted to fetch this entry
    if (fetchedEntryIds.has(selectedEntry.id)) return;

    // Trigger the fetch as a safety net (small delay to avoid duplicate calls)
    const timeoutId = setTimeout(() => {
      if (!fetchedEntryIds.has(selectedEntry.id)) {
        void fetchOriginalArticle();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [
    selectedEntry,
    fetchingOriginal,
    fetchedEntryIds,
    isProvisioned,
    fetchOriginalArticle,
  ]);

  const selectedIsStarred = Boolean(
    selectedEntry?.starred ?? selectedEntry?.bookmarked
  );

  const canLoadMore = entries.length > 0 && total > entries.length;
  // const selectedFeedTitle = searchMode
  //   ? `Search: ${searchQuery}`
  //   : isStarredView
  //   ? 'Starred'
  //   : selectedFeedId === null
  //   ? 'All feeds'
  //   : feedsById.get(selectedFeedId)?.title;

  // Filter feeds by selected category
  // const filteredFeeds = useMemo(() => {
  //   if (selectedCategoryId === null) {
  //     return feeds;
  //   }
  //   return feeds.filter((feed) => feed.category?.id === selectedCategoryId);
  // }, [feeds, selectedCategoryId]);

  const lazyEntryContent = useLazyEntryContent(selectedEntry?.content);

  return (
    <>
      <SignedIn>
        {/* Show provisioning error with retry button */}
        {provisionError && !isProvisioned ? (
          <div className={styles.app}>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <div className={styles.error}>{provisionError}</div>
              <button
                className={styles.button}
                onClick={() => void bootstrap()}
                style={{ marginTop: '1rem' }}
              >
                Retry
              </button>
            </div>
          </div>
        ) : !isProvisioned ? (
          <div className={styles.app}>
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              Setting up your account...
            </div>
          </div>
        ) : (
          <div className={styles.app}>
            <MenuModal
              isOpen={isMenuModalOpen}
              onClose={closeMenuModal}
              categories={categories}
              feeds={feeds}
              newCategoryTitle={newCategoryTitle}
              setNewCategoryTitle={setNewCategoryTitle}
              addCategoryLoading={addCategoryLoading}
              addCategoryError={addCategoryError}
              addCategory={addCategory}
              newFeedUrl={newFeedUrl}
              setNewFeedUrl={setNewFeedUrl}
              newFeedCategoryId={newFeedCategoryId}
              setNewFeedCategoryId={setNewFeedCategoryId}
              addFeedLoading={addFeedLoading}
              addFeedError={addFeedError}
              addFeed={addFeed}
              openEditModal={openEditModal}
              isLoading={isLoading}
            />

            {/* Edit Modal */}
            <ModalContainer
              isOpen={isEditModalOpen}
              onClose={closeEditModal}
              ariaLabel={editType === 'feed' ? 'Edit Feed' : 'Edit Category'}
            >
              <div className={styles.editModal}>
                <h2 className={styles.editModal_Title}>
                  {editType === 'feed' ? 'Edit Feed' : 'Edit Category'}
                </h2>

                {editType === 'category' ? (
                  <form onSubmit={updateCategory} className={styles.editForm}>
                    <div className={styles.formField}>
                      <label
                        htmlFor="edit-category-title"
                        className={styles.label}
                      >
                        Category Title
                      </label>
                      <input
                        id="edit-category-title"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Category name"
                        disabled={editLoading}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            editItemId &&
                            confirm(
                              'Are you sure you want to delete this category?'
                            )
                          ) {
                            deleteCategory(editItemId);
                            closeEditModal();
                          }
                        }}
                        disabled={editLoading}
                        className={styles.buttonDanger}
                      >
                        Delete
                      </button>
                      <div className={styles.formActionsRight}>
                        <button
                          type="button"
                          onClick={closeEditModal}
                          disabled={editLoading}
                          className={styles.buttonSecondary}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editLoading || !editTitle.trim()}
                          className={styles.button}
                        >
                          {editLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>

                    {editError && (
                      <div className={styles.error}>{editError}</div>
                    )}
                  </form>
                ) : (
                  <form onSubmit={updateFeed} className={styles.editForm}>
                    <div className={styles.formField}>
                      <label htmlFor="edit-feed-title" className={styles.label}>
                        Feed Title
                      </label>
                      <input
                        id="edit-feed-title"
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Feed title"
                        disabled={editLoading}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formField}>
                      <label htmlFor="edit-feed-url" className={styles.label}>
                        Feed URL
                      </label>
                      <input
                        id="edit-feed-url"
                        type="text"
                        value={editFeedUrl}
                        onChange={(e) => setEditFeedUrl(e.target.value)}
                        placeholder="RSS feed URL"
                        disabled={editLoading}
                        className={styles.input}
                      />
                    </div>

                    <div className={styles.formField}>
                      <label
                        htmlFor="edit-feed-category"
                        className={styles.label}
                      >
                        Category
                      </label>
                      <select
                        id="edit-feed-category"
                        value={editCategoryId ?? ''}
                        onChange={(e) =>
                          setEditCategoryId(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                        disabled={editLoading}
                        className={styles.select}
                      >
                        <option value="">Select category (optional)</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.formActions}>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            editItemId &&
                            confirm(
                              'Are you sure you want to delete this feed?'
                            )
                          ) {
                            deleteFeed(editItemId);
                            closeEditModal();
                          }
                        }}
                        disabled={editLoading}
                        className={styles.buttonDanger}
                      >
                        Delete
                      </button>
                      <div className={styles.formActionsRight}>
                        <button
                          type="button"
                          onClick={closeEditModal}
                          disabled={editLoading}
                          className={styles.buttonSecondary}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={
                            editLoading ||
                            !editTitle.trim() ||
                            !editFeedUrl.trim()
                          }
                          className={styles.button}
                        >
                          {editLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </div>

                    {editError && (
                      <div className={styles.error}>{editError}</div>
                    )}
                  </form>
                )}
              </div>
            </ModalContainer>

            {/* NEWS FEED */}
            <header className={styles.header}>
              <div className={styles.header_Menu}>
                <Button
                  type="button"
                  variant="nav"
                  onClick={openMenuModal}
                  aria-haspopup="dialog"
                  aria-expanded={isMenuModalOpen}
                  data-active={isMenuModalOpen}
                >
                  <IconMenu />
                  <span>Menu</span>
                </Button>
              </div>
              {/* Category List */}
              <ul className={styles.header_CategoryList}>
                <li>
                  <Button
                    type="button"
                    variant="category"
                    active={selectedCategoryId === null}
                    className={`${styles.header_CategoryList_Item} ${
                      selectedCategoryId === null
                        ? styles.categoryItemActive
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedCategoryId(null);
                      setSelectedFeedId(null);
                    }}
                    disabled={isLoading}
                  >
                    All
                  </Button>
                  <div className={styles.header_CategoryList_Count}>
                    {totalUnreadCount}
                  </div>
                </li>
                {categories.slice(1).map((cat) => (
                  <li key={cat.id}>
                    <Button
                      type="button"
                      variant="category"
                      active={selectedCategoryId === cat.id}
                      className={`${styles.header_CategoryList_Item} ${
                        selectedCategoryId === cat.id
                          ? styles.categoryItemActive
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setSelectedFeedId(null);
                      }}
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
              {/* <button
                  className={styles.button}
                  onClick={() => void refreshAll()}
                  disabled={isLoading}
                >
                  Refresh
                </button> */}
              {/* {!isStarredView && !searchMode && (
                  <button
                    className={styles.button}
                    onClick={() => void markPageRead()}
                    disabled={isLoading || entries.length === 0}
                  >
                    Mark page read
                  </button>
                )} */}
              {/* <div className={styles.meta}>
                  {isLoading
                    ? 'Loading…'
                    : `${entries.length}${total ? ` / ${total}` : ''} ${
                        searchMode
                          ? 'results'
                          : isStarredView
                          ? 'starred'
                          : 'unread'
                      }${selectedFeedTitle ? ` — ${selectedFeedTitle}` : ''}`}
                </div> */}
            </header>

            {error ? <div className={styles.error}>{error}</div> : null}

            <div className={styles.entryList}>
              <>
                {entries.length === 0 ? (
                  <div className={styles.muted}>
                    {searchMode
                      ? 'No results found.'
                      : isStarredView
                      ? 'No starred entries.'
                      : 'No unread entries.'}
                  </div>
                ) : (
                  entries.map((e) => (
                    <LazyEntryItem
                      key={e.id}
                      entry={e}
                      selectedEntryId={selectedEntryId}
                      feedsById={feedsById}
                      onEntryClick={handleEntrySelect}
                    />
                  ))
                )}
                <div className={styles.entryList_Footer}>
                  {canLoadMore && (
                    <Button
                      variant="primary"
                      onClick={() => void loadMore()}
                      disabled={isLoading}
                    >
                      Load more
                    </Button>
                  )}
                </div>
              </>
            </div>

            {/* SLIDE PANEL */}
            <SlidePanel
              isOpen={!!selectedEntry}
              onClose={() => setSelectedEntryId(null)}
              ariaLabel="Entry details"
            >
              {selectedEntry && (
                <div className={styles.entry_Container}>
                  {/* ENTRY HEADER */}
                  <div className={styles.entry_Header}>
                    <h1>{selectedEntry.title || '(untitled)'}</h1>
                    <div className={styles.entry_Meta}>
                      {(selectedEntry.feed_title ??
                        selectedEntry.feed?.title ??
                        feedsById.get(selectedEntry.feed_id)?.title) ||
                      selectedEntry.published_at ||
                      selectedEntry.author ? (
                        <>
                          {selectedEntry.published_at && (
                            <p>
                              <FormattedDate
                                date={selectedEntry.published_at}
                              />
                            </p>
                          )}
                          <p>
                            From:{' '}
                            <i>
                              {selectedEntry.author &&
                                `By: ${selectedEntry.author}, `}
                              {selectedEntry.feed_title ??
                                selectedEntry.feed?.title ??
                                feedsById.get(selectedEntry.feed_id)?.title ??
                                ''}
                            </i>
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* ENTRY CONTENT */}
                  {selectedEntry.content ? (
                    lazyEntryContent ? (
                      <div className={styles.entry_Content}>
                        {lazyEntryContent}
                      </div>
                    ) : (
                      <div
                        className={styles.entry_Content}
                        dangerouslySetInnerHTML={{
                          __html: selectedEntry.content,
                        }}
                      />
                    )
                  ) : (
                    <div className={styles.content}>
                      <div className={styles.entry_noContent}>
                        No content available.
                      </div>
                      <div>
                        <a
                          className={styles.link}
                          href={selectedEntry.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open source
                        </a>
                      </div>
                    </div>
                  )}
                  <div className={styles.entry_Footer}>
                    <div className={styles.actionsList}>
                      <Button
                        variant="primary"
                        onClick={() => void toggleSelectedStar()}
                        disabled={isLoading}
                        title={selectedIsStarred ? 'Unbookmark' : 'Bookmark'}
                        className={styles.actionsList_Item}
                      >
                        {selectedIsStarred ? 'Unbookmark' : 'Bookmark'}
                        {', '}
                      </Button>
                      <Button
                        onClick={() => void fetchOriginalArticle()}
                        disabled={isLoading || fetchingOriginal}
                        title="Link to original article"
                        className={styles.actionsList_Item}
                      >
                        Link to original article{', '}
                      </Button>
                      <Button
                        onClick={() => void fetchOriginalArticle()}
                        disabled={isLoading || fetchingOriginal}
                        title={
                          fetchingOriginal
                            ? 'Fetching...'
                            : 'Fetch original article'
                        }
                        className={styles.actionsList_Item}
                      >
                        {fetchingOriginal
                          ? 'Fetching...'
                          : 'Fetch original article'}
                        {', '}
                      </Button>
                      {selectedEntry.status === 'unread' ? (
                        <Button
                          onClick={() => void setSelectedStatus('read')}
                          disabled={isLoading}
                          type="button"
                          className={styles.actionsList_Item}
                        >
                          Mark read{', '}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => void setSelectedStatus('unread')}
                          disabled={isLoading}
                          type="button"
                          className={styles.actionsList_Item}
                        >
                          Mark unread
                        </Button>
                      )}
                      <Button
                        className={styles.actionsList_Item}
                        onClick={() => void setSelectedStatus('unread')}
                        disabled={isLoading}
                        type="button"
                      >
                        Mark unread
                      </Button>
                    </div>
                    <div className={styles.prevNextButtons}>
                      <Button
                        className={styles.button}
                        onClick={navigateToPrev}
                        disabled={!hasPrev || isLoading}
                        type="button"
                        variant="nav"
                      >
                        <IconArrowShortLeft />
                        <span>Prev</span>
                      </Button>
                      <Button
                        className={styles.button}
                        onClick={navigateToNext}
                        disabled={!hasNext || isLoading}
                        type="button"
                        variant="nav"
                      >
                        <span>Next</span>
                        <IconArrowShortRight />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </SlidePanel>
          </div>
        )}
      </SignedIn>

      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
