'use client';

import styles from '../page.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
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
        <h2 className={styles.editModal_Title}>
          {editType === 'feed' ? 'Edit Feed' : 'Edit Category'}
        </h2>

        {editType === 'category' ? (
          <form onSubmit={onUpdateCategory} className={styles.editForm}>
            <div className={styles.formField}>
              <label htmlFor="edit-category-title" className={styles.label}>
                Category Title
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
                className={styles.buttonDanger}
              >
                Delete
              </button>
              <div className={styles.formActionsRight}>
                <button
                  type="button"
                  onClick={onClose}
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

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        ) : (
          <form onSubmit={onUpdateFeed} className={styles.editForm}>
            <div className={styles.formField}>
              <label htmlFor="edit-feed-title" className={styles.label}>
                Feed Title
              </label>
              <input
                id="edit-feed-title"
                type="text"
                value={editTitle}
                onChange={(e) => onChangeTitle(e.target.value)}
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
                onChange={(e) => onChangeFeedUrl(e.target.value)}
                placeholder="RSS feed URL"
                disabled={editLoading}
                className={styles.input}
              />
            </div>

            <div className={styles.formField}>
              <label htmlFor="edit-feed-category" className={styles.label}>
                Category
              </label>
              <select
                id="edit-feed-category"
                value={editCategoryId ?? ''}
                onChange={(e) =>
                  onChangeCategoryId(
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
                    confirm('Are you sure you want to delete this feed?')
                  ) {
                    onDeleteFeed(editItemId);
                    onClose();
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
                  onClick={onClose}
                  disabled={editLoading}
                  className={styles.buttonSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    editLoading || !editTitle.trim() || !editFeedUrl.trim()
                  }
                  className={styles.button}
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {editError && <div className={styles.error}>{editError}</div>}
          </form>
        )}
      </div>
    </ModalContainer>
  );
}
