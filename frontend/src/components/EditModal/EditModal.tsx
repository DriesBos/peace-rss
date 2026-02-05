'use client';

import styles from './EditModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import type { Category } from '@/app/_lib/types';
import { Button } from '@/components/Button/Button';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';

export type EditModalProps = {
  isOpen: boolean;
  editType: 'feed' | 'category' | null;
  editItemId: number | null;
  categories: Category[];
  editTitle: string;
  editFeedUrl: string;
  editCategoryId: number | null;
  editLoading: boolean;
  editError: string | null;
  onClose: () => void;
  onDeleteCategory: (categoryId: number) => void;
  onDeleteFeed: (feedId: number) => void;
  onUpdateCategory: (e: React.FormEvent) => Promise<boolean>;
  onUpdateFeed: (e: React.FormEvent) => Promise<boolean>;
  onChangeTitle: (value: string) => void;
  onChangeFeedUrl: (value: string) => void;
  onChangeCategoryId: (value: number | null) => void;
};

export function EditModal({
  isOpen,
  editType,
  editItemId,
  categories,
  editTitle,
  editFeedUrl,
  editCategoryId,
  editLoading,
  editError,
  onClose,
  onDeleteCategory,
  onDeleteFeed,
  onUpdateCategory,
  onUpdateFeed,
  onChangeTitle,
  onChangeFeedUrl,
  onChangeCategoryId,
}: EditModalProps) {
  const handleSubmitCategory = async (event: React.FormEvent) => {
    const didSucceed = await onUpdateCategory(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.categoryUpdated);
      onClose();
    }
  };

  const handleSubmitFeed = async (event: React.FormEvent) => {
    const didSucceed = await onUpdateFeed(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedUpdated);
      onClose();
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
    }
  );

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={editType === 'feed' ? 'Edit Feed' : 'Edit Category'}
    >
      <div className={styles.editModal}>
        {editType === 'category' ? (
          <form onSubmit={handleSubmitCategory} className={styles.editForm}>
            <div className={styles.formField}>
              <LabeledInput
                id="edit-category-title"
                label="Category name"
                value={editTitle}
                onChange={onChangeTitle as (value: string) => void}
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
                onClick={() => {
                  if (
                    editItemId &&
                    confirm('Are you sure you want to delete this category?')
                  ) {
                    onDeleteCategory(editItemId);
                    toast(NOTIFICATION_COPY.app.categoryDeleted);
                    onClose();
                  }
                }}
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
        ) : (
          <form onSubmit={handleSubmitFeed} className={styles.editForm}>
            <div className={styles.formField}>
              <LabeledInput
                id="edit-feed-title"
                label="Feed name"
                value={editTitle}
                onChange={onChangeTitle as (value: string) => void}
                placeholder="Feed name"
                disabled={editLoading}
              />
            </div>

            <div className={styles.formField}>
              <LabeledInput
                id="edit-feed-url"
                label="Feed web address"
                value={editFeedUrl}
                onChange={onChangeFeedUrl as (value: string) => void}
                placeholder="Feed web address"
                disabled={editLoading}
              />
            </div>

            <LabeledSelect
              id="edit-feed-category"
              label="Category"
              value={editCategoryId ? String(editCategoryId) : ''}
              onChange={(value) =>
                onChangeCategoryId(value ? Number(value) : null)
              }
              placeholder="Select category"
              options={categories.map((cat) => ({
                value: String(cat.id),
                label: cat.title,
              }))}
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
                onClick={() => {
                  if (
                    editItemId &&
                    confirm('Are you sure you want to delete this feed?')
                  ) {
                    onDeleteFeed(editItemId);
                    toast(NOTIFICATION_COPY.app.feedDeleted);
                    onClose();
                  }
                }}
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
        )}
      </div>
    </ModalContainer>
  );
}
