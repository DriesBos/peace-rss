'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './EditModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import type { Category, Feed } from '@/app/_lib/types';
import { Button } from '@/components/Button/Button';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';

export type EditTarget =
  | { type: 'feed'; item: Feed }
  | { type: 'category'; item: Category }
  | null;

export type UpdateFeedPayload = {
  id: number;
  title: string;
  feedUrl: string;
  categoryId: number | null;
};

export type UpdateCategoryPayload = {
  id: number;
  title: string;
};

export type EditModalProps = {
  isOpen: boolean;
  target: EditTarget;
  categories: Category[];
  onClose: () => void;
  onDeleteCategory: (categoryId: number) => Promise<boolean>;
  onDeleteFeed: (feedId: number) => Promise<boolean>;
  onUpdateCategory: (payload: UpdateCategoryPayload) => Promise<boolean>;
  onUpdateFeed: (payload: UpdateFeedPayload) => Promise<boolean>;
};

export function EditModal({
  isOpen,
  target,
  categories,
  onClose,
  onDeleteCategory,
  onDeleteFeed,
  onUpdateCategory,
  onUpdateFeed,
}: EditModalProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !target) return;
    setEditTitle(target.item.title);
    setEditError(null);

    if (target.type === 'feed') {
      setEditFeedUrl(target.item.feed_url || '');
      setEditCategoryId(target.item.category?.id || null);
    } else {
      setEditFeedUrl('');
      setEditCategoryId(null);
    }
  }, [isOpen, target]);

  const categoryOptions = useMemo(() => {
    return categories
      .filter((cat) => !isProtectedCategoryTitle(cat.title))
      .map((cat) => ({
        value: String(cat.id),
        label: cat.title,
      }));
  }, [categories]);

  const handleDeleteCategory = async () => {
    if (!target || target.type !== 'category') return;
    if (!confirm('Are you sure you want to delete this category?')) return;

    const didSucceed = await onDeleteCategory(target.item.id);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.categoryDeleted);
      onClose();
    }
  };

  const handleDeleteFeed = async () => {
    if (!target || target.type !== 'feed') return;
    if (!confirm('Are you sure you want to delete this feed?')) return;

    const didSucceed = await onDeleteFeed(target.item.id);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedDeleted);
      onClose();
    }
  };

  const handleSubmitCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || target.type !== 'category') return;

    const title = editTitle.trim();
    if (!title) return;

    setEditLoading(true);
    setEditError(null);
    try {
      const didSucceed = await onUpdateCategory({
        id: target.item.id,
        title,
      });
      if (didSucceed) {
        toast.success(NOTIFICATION_COPY.app.categoryUpdated);
        onClose();
      }
    } catch (e) {
      setEditError(
        e instanceof Error ? e.message : 'Failed to update category',
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleSubmitFeed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target || target.type !== 'feed') return;

    const title = editTitle.trim();
    const feedUrl = editFeedUrl.trim();
    if (!title || !feedUrl) return;

    setEditLoading(true);
    setEditError(null);
    try {
      const didSucceed = await onUpdateFeed({
        id: target.item.id,
        title,
        feedUrl,
        categoryId: editCategoryId,
      });
      if (didSucceed) {
        toast.success(NOTIFICATION_COPY.app.feedUpdated);
        onClose();
      }
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update feed');
    } finally {
      setEditLoading(false);
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

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={target?.type === 'feed' ? 'Edit Feed' : 'Edit Category'}
    >
      <div className={styles.editModal}>
        {target?.type === 'category' ? (
          <form onSubmit={handleSubmitCategory} className={styles.editForm}>
            <div className={styles.formField}>
              <LabeledInput
                id="edit-category-title"
                label="Category name"
                value={editTitle}
                onChange={setEditTitle}
                placeholder="Category name"
                disabled={editLoading}
              />
            </div>

            <div className={styles.formActions}>
              <Button
                variant="primary"
                type="submit"
                disabled={editLoading || !editTitle.trim()}
              >
                {editLoading ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => void handleDeleteCategory()}
                disabled={editLoading}
              >
                Delete
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={onClose}
                disabled={editLoading}
              >
                Cancel
              </Button>
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        ) : target?.type === 'feed' ? (
          <form onSubmit={handleSubmitFeed} className={styles.editForm}>
            <div className={styles.formField}>
              <LabeledInput
                id="edit-feed-title"
                label="Feed name"
                value={editTitle}
                onChange={setEditTitle}
                placeholder="Feed name"
                disabled={editLoading}
              />
            </div>

            <div className={styles.formField}>
              <LabeledInput
                id="edit-feed-url"
                label="Feed web address"
                value={editFeedUrl}
                onChange={setEditFeedUrl}
                placeholder="Feed web address"
                disabled={editLoading}
              />
            </div>

            <LabeledSelect
              id="edit-feed-category"
              label="Category"
              value={editCategoryId ? String(editCategoryId) : ''}
              onChange={(value) =>
                setEditCategoryId(value ? Number(value) : null)
              }
              placeholder="Select category"
              options={categoryOptions}
              disabled={editLoading}
            />

            <div className={styles.formActions}>
              <Button
                variant="primary"
                type="submit"
                disabled={
                  editLoading || !editTitle.trim() || !editFeedUrl.trim()
                }
              >
                {editLoading ? 'Saving...' : 'Save changes'}
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => void handleDeleteFeed()}
                disabled={editLoading}
              >
                Delete
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={onClose}
                disabled={editLoading}
              >
                Cancel
              </Button>
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        ) : null}
      </div>
    </ModalContainer>
  );
}
