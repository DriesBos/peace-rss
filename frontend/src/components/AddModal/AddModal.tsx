'use client';

import { useMemo } from 'react';
import styles from './AddModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import type { Category } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { Button } from '@/components/Button/Button';
import { isProtectedCategoryTitle } from '@/lib/protectedCategories';

export type AddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  newCategoryTitle: string;
  setNewCategoryTitle: (value: string) => void;
  addCategoryLoading: boolean;
  addCategoryError: string | null;
  addCategory: (e: React.FormEvent) => Promise<boolean>;
  newFeedUrl: string;
  setNewFeedUrl: (value: string) => void;
  newFeedCategoryId: number | null;
  setNewFeedCategoryId: (value: number | null) => void;
  addFeedLoading: boolean;
  addFeedError: string | null;
  addFeed: (e: React.FormEvent) => Promise<boolean>;
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
  const canSubmitFeed = Boolean(newFeedUrl.trim());

  const handleAddCategory = async (event: React.FormEvent) => {
    const didSucceed = await addCategory(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.categoryAdded);
      onClose();
    }
  };

  const handleAddFeed = async (event: React.FormEvent) => {
    const didSucceed = await addFeed(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedAdded);
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
            onChange={setNewFeedUrl}
            placeholder="Add web address..."
            disabled={addFeedLoading || isLoading}
          />
          <LabeledSelect
            id="add-feed-category"
            value={newFeedCategoryId ? String(newFeedCategoryId) : ''}
            onChange={(value) =>
              setNewFeedCategoryId(value ? Number(value) : null)
            }
            placeholder="Select category"
            optionalHint="(optional)"
            options={categoryOptions}
            disabled={addFeedLoading || isLoading}
          />
          <button
            type="submit"
            disabled={addFeedLoading || isLoading || !canSubmitFeed}
            className={styles.linkButton}
          >
            {addFeedLoading ? 'Adding...' : 'Add feed'}
          </button>
          {addFeedError && <div className={styles.error}>{addFeedError}</div>}
        </form>
      </div>
    </ModalContainer>
  );
}
