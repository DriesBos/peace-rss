'use client';

import styles from './AddModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import type { Category } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { Button } from '@/components/Button/Button';
import type { SocialPlatform } from '@/lib/social/types';

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
  newFeedPlatform: '' | SocialPlatform;
  setNewFeedPlatform: (value: '' | SocialPlatform) => void;
  newFeedHandle: string;
  setNewFeedHandle: (value: string) => void;
  newFeedLoginUsername: string;
  setNewFeedLoginUsername: (value: string) => void;
  newFeedLoginPassword: string;
  setNewFeedLoginPassword: (value: string) => void;
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
  newFeedPlatform,
  setNewFeedPlatform,
  newFeedHandle,
  setNewFeedHandle,
  newFeedLoginUsername,
  setNewFeedLoginUsername,
  newFeedLoginPassword,
  setNewFeedLoginPassword,
  newFeedCategoryId,
  setNewFeedCategoryId,
  addFeedLoading,
  addFeedError,
  addFeed,
  isLoading,
}: AddModalProps) {
  const canSubmitFeed = Boolean(
    newFeedUrl.trim() || (newFeedPlatform && newFeedHandle.trim())
  );

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
            label="Feed web address"
            value={newFeedUrl}
            onChange={setNewFeedUrl}
            placeholder="Feed web address.."
            disabled={addFeedLoading || isLoading}
          />
          <div className={styles.help}>
            Use either a direct feed URL, or a social platform + handle.
          </div>
          <LabeledSelect
            id="add-feed-platform"
            label="Social platform"
            value={newFeedPlatform}
            onChange={(value) => setNewFeedPlatform(value as '' | SocialPlatform)}
            placeholder="Select platform"
            optionalHint="(optional)"
            options={[
              { value: 'instagram', label: 'Instagram' },
              { value: 'twitter', label: 'Twitter / X' },
            ]}
            disabled={addFeedLoading || isLoading}
          />
          <LabeledInput
            id="add-feed-handle"
            label="Social handle"
            value={newFeedHandle}
            onChange={setNewFeedHandle}
            placeholder="@username or profile URL"
            disabled={addFeedLoading || isLoading}
          />
          <LabeledInput
            id="add-feed-login-username"
            label="Login username"
            value={newFeedLoginUsername}
            onChange={setNewFeedLoginUsername}
            placeholder="Optional"
            disabled={addFeedLoading || isLoading}
          />
          <LabeledInput
            id="add-feed-login-password"
            label="Login password"
            value={newFeedLoginPassword}
            onChange={setNewFeedLoginPassword}
            placeholder="Optional"
            type="password"
            disabled={addFeedLoading || isLoading}
          />
          <div className={styles.help}>
            Login fields are optional and used as RSS-Bridge HTTP auth.
          </div>
          <LabeledSelect
            id="add-feed-category"
            value={newFeedCategoryId ? String(newFeedCategoryId) : ''}
            onChange={(value) =>
              setNewFeedCategoryId(value ? Number(value) : null)
            }
            placeholder="Select category"
            optionalHint="(optional)"
            options={categories.map((cat) => ({
              value: String(cat.id),
              label: cat.title,
            }))}
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
