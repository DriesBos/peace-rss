'use client';

import { useEffect } from 'react';
import styles from './AddModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import type { Category } from '@/app/_lib/types';

export type AddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
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
  isLoading: boolean;
};

export function AddModal({
  isOpen,
  onClose,
  categories,
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
  isLoading,
}: AddModalProps) {
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
    <ModalContainer isOpen={isOpen} onClose={onClose} ariaLabel="Add">
      <div className={styles.modalAdd}>
        <h2 className={styles.modalAdd_Title}>Add Category or Feed</h2>

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
            {addFeedError && <div className={styles.error}>{addFeedError}</div>}
          </form>
        </div>
      </div>
    </ModalContainer>
  );
}
