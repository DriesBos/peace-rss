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
import type { SocialPlatform } from '@/lib/social/types';
import { isYouTubeFeedUrl } from '@/lib/youtube';
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
  newYoutubeFeedUrl: string;
  setNewYoutubeFeedUrl: (value: string) => void;
  addYoutubeFeedLoading: boolean;
  addYoutubeFeedError: string | null;
  addYoutubeFeed: (e: React.FormEvent) => Promise<boolean>;
  newInstagramHandle: string;
  setNewInstagramHandle: (value: string) => void;
  addInstagramFeedLoading: boolean;
  addInstagramFeedError: string | null;
  addInstagramFeed: (e: React.FormEvent) => Promise<boolean>;
  newTwitterHandle: string;
  setNewTwitterHandle: (value: string) => void;
  addTwitterFeedLoading: boolean;
  addTwitterFeedError: string | null;
  addTwitterFeed: (e: React.FormEvent) => Promise<boolean>;
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
  newYoutubeFeedUrl,
  setNewYoutubeFeedUrl,
  addYoutubeFeedLoading,
  addYoutubeFeedError,
  addYoutubeFeed,
  newInstagramHandle,
  setNewInstagramHandle,
  addInstagramFeedLoading,
  addInstagramFeedError,
  addInstagramFeed,
  newTwitterHandle,
  setNewTwitterHandle,
  addTwitterFeedLoading,
  addTwitterFeedError,
  addTwitterFeed,
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
  const isAddingYoutubeFromMainForm = useMemo(() => {
    const trimmed = newFeedUrl.trim();
    return Boolean(trimmed && isYouTubeFeedUrl(trimmed));
  }, [newFeedUrl]);

  const isAddingProtectedSocialFromMainForm = useMemo(() => {
    return newFeedPlatform === 'instagram' || newFeedPlatform === 'twitter';
  }, [newFeedPlatform]);

  const canSubmitFeed = Boolean(
    newFeedUrl.trim() || (newFeedPlatform && newFeedHandle.trim()),
  );
  const canSubmitYoutube = Boolean(newYoutubeFeedUrl.trim());
  const canSubmitInstagram = Boolean(newInstagramHandle.trim());
  const canSubmitTwitter = Boolean(newTwitterHandle.trim());

  const handleAddCategory = async (event: React.FormEvent) => {
    const didSucceed = await addCategory(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.categoryAdded);
      onClose();
    }
  };

  const handleAddYoutubeFeed = async (event: React.FormEvent) => {
    const didSucceed = await addYoutubeFeed(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedAdded);
      onClose();
    }
  };

  const handleAddInstagramFeed = async (event: React.FormEvent) => {
    const didSucceed = await addInstagramFeed(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedAdded);
      onClose();
    }
  };

  const handleAddTwitterFeed = async (event: React.FormEvent) => {
    const didSucceed = await addTwitterFeed(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedAdded);
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

        <form onSubmit={handleAddYoutubeFeed} className={styles.formBlock}>
          <LabeledInput
            id="add-youtube-feed-url"
            label="YouTube handle"
            value={newYoutubeFeedUrl}
            onChange={setNewYoutubeFeedUrl}
            placeholder="Add handle..."
            disabled={addYoutubeFeedLoading || isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={addYoutubeFeedLoading || isLoading || !canSubmitYoutube}
          >
            {addYoutubeFeedLoading ? 'Adding...' : 'Add feed'}
          </Button>
          {addYoutubeFeedError && (
            <div className={styles.error}>{addYoutubeFeedError}</div>
          )}
        </form>

        <form onSubmit={handleAddInstagramFeed} className={styles.formBlock}>
          <LabeledInput
            id="add-instagram-handle"
            label="Instagram handle"
            value={newInstagramHandle}
            onChange={setNewInstagramHandle}
            placeholder="@username or profile URL"
            disabled={addInstagramFeedLoading || isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={
              addInstagramFeedLoading || isLoading || !canSubmitInstagram
            }
          >
            {addInstagramFeedLoading ? 'Adding...' : 'Add feed'}
          </Button>
          {addInstagramFeedError && (
            <div className={styles.error}>{addInstagramFeedError}</div>
          )}
        </form>

        <form onSubmit={handleAddTwitterFeed} className={styles.formBlock}>
          <LabeledInput
            id="add-twitter-handle"
            label="Twitter / X handle"
            value={newTwitterHandle}
            onChange={setNewTwitterHandle}
            placeholder="@username or profile URL"
            disabled={addTwitterFeedLoading || isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={addTwitterFeedLoading || isLoading || !canSubmitTwitter}
          >
            {addTwitterFeedLoading ? 'Adding...' : 'Add feed'}
          </Button>
          {addTwitterFeedError && (
            <div className={styles.error}>{addTwitterFeedError}</div>
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
            onChange={(value) =>
              setNewFeedPlatform(value as '' | SocialPlatform)
            }
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
          {!isAddingYoutubeFromMainForm &&
          !isAddingProtectedSocialFromMainForm ? (
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
          ) : isAddingYoutubeFromMainForm ? (
            <div className={styles.help}>
              This looks like a YouTube feed. Use the YouTube form above
              (YouTube feeds are assigned automatically).
            </div>
          ) : (
            <div className={styles.help}>
              Social feeds are assigned automatically (use the Instagram/Twitter
              forms above).
            </div>
          )}
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
