'use client';

import styles from './EditModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import type { Category } from '@/app/_lib/types';

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
  onUpdateCategory: (e: React.FormEvent) => void;
  onUpdateFeed: (e: React.FormEvent) => void;
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
  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={editType === 'feed' ? 'Edit Feed' : 'Edit Category'}
    >
      <div className={styles.editModal}>
        {editType === 'category' ? (
          <form onSubmit={onUpdateCategory} className={styles.editForm}>
            <div className={styles.formField}>
              <label htmlFor="edit-category-title" className={styles.label}>
                Category name
              </label>
              <input
                id="edit-category-title"
                type="text"
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="Category name"
                disabled={editLoading}
                className={styles.input}
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={editLoading || !editTitle.trim()}
                className={styles.linkButton}
              >
                {editLoading ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    editItemId &&
                    confirm('Are you sure you want to delete this category?')
                  ) {
                    onDeleteCategory(editItemId);
                    onClose();
                  }
                }}
                disabled={editLoading}
                className={styles.linkButton}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={editLoading}
                className={styles.linkButton}
              >
                Cancel
              </button>
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        ) : (
          <form onSubmit={onUpdateFeed} className={styles.editForm}>
            <div className={styles.formField}>
              <label htmlFor="edit-feed-title" className={styles.label}>
                Feed name
              </label>
              <input
                id="edit-feed-title"
                type="text"
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
                placeholder="Feed name"
                disabled={editLoading}
                className={styles.input}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="edit-feed-url" className={styles.label}>
                Feed web address
              </label>
              <input
                id="edit-feed-url"
                type="text"
                value={editFeedUrl}
                onChange={(e) => onChangeFeedUrl(e.target.value)}
                placeholder="Feed web address"
                disabled={editLoading}
                className={styles.input}
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
              <button
                type="submit"
                disabled={editLoading || !editTitle.trim() || !editFeedUrl.trim()}
                className={styles.linkButton}
              >
                {editLoading ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    editItemId &&
                    confirm('Are you sure you want to delete this feed?')
                  ) {
                    onDeleteFeed(editItemId);
                    onClose();
                  }
                }}
                disabled={editLoading}
                className={styles.linkButton}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={editLoading}
                className={styles.linkButton}
              >
                Cancel
              </button>
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        )}
      </div>
    </ModalContainer>
  );
}
