'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './AddModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import type { Category, DiscoveredFeed } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { Button } from '@/components/Button/Button';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';

export type AddFeedPayload = {
  feedUrl: string;
  categoryId: number;
  selectedFeedUrl: string;
};

export type AddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  defaultFeedCategoryId: number | null;
  onAddCategory: (title: string) => Promise<boolean>;
  onAddFeed: (payload: AddFeedPayload) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: string;
        discoveredFeeds?: DiscoveredFeed[];
        selectedDiscoveredFeedUrl?: string;
      }
  >;
  isLoading: boolean;
};

export function AddModal({
  isOpen,
  onClose,
  categories,
  defaultFeedCategoryId,
  onAddCategory,
  onAddFeed,
  isLoading,
}: AddModalProps) {
  const [newCategoryTitle, setNewCategoryTitle] = useState('');
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
    defaultFeedCategoryId,
  );
  const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
  const [selectedDiscoveredFeedUrl, setSelectedDiscoveredFeedUrl] =
    useState('');
  const [addFeedLoading, setAddFeedLoading] = useState(false);
  const [addFeedError, setAddFeedError] = useState<string | null>(null);

  const isChoosingDiscoveredFeed = discoveredFeeds.length > 0;
  const hasCategoryChoice = newFeedCategoryId !== null;
  const canSubmitFeed = isChoosingDiscoveredFeed
    ? Boolean(selectedDiscoveredFeedUrl) && hasCategoryChoice
    : Boolean(newFeedUrl.trim()) && hasCategoryChoice;

  useEffect(() => {
    if (!isOpen) return;
    setNewCategoryTitle('');
    setAddCategoryError(null);
    setNewFeedUrl('');
    setNewFeedCategoryId(defaultFeedCategoryId);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
    setAddFeedError(null);
  }, [defaultFeedCategoryId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const allowedCategoryIds = new Set(
      categories
        .filter((category) => !isProtectedCategoryTitle(category.title))
        .map((category) => category.id),
    );

    setNewFeedCategoryId((previous) => {
      if (previous !== null && allowedCategoryIds.has(previous)) {
        return previous;
      }
      return defaultFeedCategoryId;
    });
  }, [categories, defaultFeedCategoryId, isOpen]);

  function handleSetNewFeedUrl(value: string) {
    setNewFeedUrl(value);
    setDiscoveredFeeds([]);
    setSelectedDiscoveredFeedUrl('');
    setAddFeedError(null);
  }

  const handleAddCategory = async (event: React.FormEvent) => {
    event.preventDefault();

    const title = newCategoryTitle.trim();
    if (!title) return;

    setAddCategoryLoading(true);
    setAddCategoryError(null);
    try {
      const didSucceed = await onAddCategory(title);
      if (didSucceed) {
        toast.success(NOTIFICATION_COPY.app.categoryAdded);
        onClose();
      }
    } catch (e) {
      setAddCategoryError(
        e instanceof Error ? e.message : 'Failed to add category',
      );
    } finally {
      setAddCategoryLoading(false);
    }
  };

  const handleAddFeed = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddFeedLoading(true);
    setAddFeedError(null);
    try {
      const result = await onAddFeed({
        feedUrl: newFeedUrl.trim(),
        categoryId: newFeedCategoryId ?? 0,
        selectedFeedUrl: selectedDiscoveredFeedUrl.trim(),
      });
      if (result.ok) {
        toast.success(NOTIFICATION_COPY.app.feedAdded);
        onClose();
        return;
      }

      setAddFeedError(result.error);
      if (result.discoveredFeeds) {
        setDiscoveredFeeds(result.discoveredFeeds);
        setSelectedDiscoveredFeedUrl(
          result.selectedDiscoveredFeedUrl ??
            result.discoveredFeeds[0]?.url ??
            '',
        );
      }
    } finally {
      setAddFeedLoading(false);
    }
  };

  useKeydown(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    },
    {
      enabled: isOpen,
      target: typeof document !== 'undefined' ? document : null,
    },
  );

  const categoryOptions = useMemo(() => {
    return categories
      .filter((cat) => !isProtectedCategoryTitle(cat.title))
      .map((cat) => ({
        value: String(cat.id),
        label: cat.title,
      }));
  }, [categories]);

  const discoveredFeedOptions = useMemo(() => {
    return discoveredFeeds.map((feed) => ({
      value: feed.url,
      label: `${feed.title || feed.url} (${feed.type.toUpperCase()})`,
    }));
  }, [discoveredFeeds]);

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose} ariaLabel="Add">
      <div className={styles.modalAdd}>
        <form onSubmit={handleAddCategory} className={styles.formBlock}>
          <LabeledInput
            id="add-category-title"
            label="Category name"
            value={newCategoryTitle}
            onChange={setNewCategoryTitle}
            placeholder="Category name.."
            disabled={addCategoryLoading || isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={
              addCategoryLoading || isLoading || !newCategoryTitle.trim()
            }
          >
            {addCategoryLoading ? 'Adding...' : 'Add category'}
          </Button>
          {addCategoryError && (
            <div className={styles.error}>{addCategoryError}</div>
          )}
        </form>

        <form onSubmit={handleAddFeed} className={styles.formBlock}>
          <LabeledInput
            id="add-feed-url"
            label="Add content"
            value={newFeedUrl}
            onChange={handleSetNewFeedUrl}
            placeholder="Add web address..."
            disabled={addFeedLoading || isLoading}
          />
          <LabeledSelect
            id="add-feed-category"
            label="Category"
            value={newFeedCategoryId ? String(newFeedCategoryId) : ''}
            onChange={(value) =>
              setNewFeedCategoryId(value ? Number(value) : null)
            }
            placeholder="Select category"
            options={categoryOptions}
            disabled={addFeedLoading || isLoading}
          />
          {!hasCategoryChoice ? (
            <div className={styles.help}>
              Create a category first before adding feeds.
            </div>
          ) : null}
          {isChoosingDiscoveredFeed ? (
            <>
              <LabeledSelect
                id="add-feed-discovered"
                label="Choose feed"
                value={selectedDiscoveredFeedUrl}
                onChange={setSelectedDiscoveredFeedUrl}
                placeholder="Choose discovered feed"
                options={discoveredFeedOptions}
                disabled={addFeedLoading || isLoading}
              />
              <div className={styles.help}>
                Choose a discovered feed and submit again.
              </div>
            </>
          ) : null}
          <button
            type="submit"
            disabled={addFeedLoading || isLoading || !canSubmitFeed}
            className={styles.linkButton}
          >
            {addFeedLoading
              ? 'Adding...'
              : isChoosingDiscoveredFeed
                ? 'Subscribe selected feed'
                : 'Add feed'}
          </button>
          {addFeedError && <div className={styles.error}>{addFeedError}</div>}
        </form>
      </div>
    </ModalContainer>
  );
}
