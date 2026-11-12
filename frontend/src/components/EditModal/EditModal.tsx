'use client';

import styles from './EditModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { TagPicker } from '@/components/TagPicker/TagPicker';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import type { Tag } from '@/app/_lib/types';
import { Button } from '@/components/Button/Button';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';

export type EditModalProps = {
  isOpen: boolean;
  editType: 'feed' | 'tag' | null;
  editItemId: number | null;
  /** Tags that can be put on a feed. */
  tags: Tag[];
  editTitle: string;
  editFeedUrl: string;
  editTagIds: number[];
  editLoading: boolean;
  editError: string | null;
  onClose: () => void;
  onDeleteTag: (tagId: number) => Promise<boolean>;
  onDeleteFeed: (feedId: number) => Promise<boolean>;
  onUpdateTag: (e: React.FormEvent) => Promise<boolean>;
  onUpdateFeed: (e: React.FormEvent) => Promise<boolean>;
  onChangeTitle: (value: string) => void;
  onChangeFeedUrl: (value: string) => void;
  onChangeTagIds: (value: number[]) => void;
};

export function EditModal({
  isOpen,
  editType,
  editItemId,
  tags,
  editTitle,
  editFeedUrl,
  editTagIds,
  editLoading,
  editError,
  onClose,
  onDeleteTag,
  onDeleteFeed,
  onUpdateTag,
  onUpdateFeed,
  onChangeTitle,
  onChangeFeedUrl,
  onChangeTagIds,
}: EditModalProps) {
  const handleDeleteTag = async () => {
    if (!editItemId) return;
    if (
      !confirm(
        'Delete this tag? Feeds and posts keep existing, they only lose the tag.',
      )
    ) {
      return;
    }

    const didSucceed = await onDeleteTag(editItemId);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.tagDeleted);
      onClose();
    }
  };

  const handleDeleteFeed = async () => {
    if (!editItemId) return;
    if (!confirm('Are you sure you want to delete this feed?')) return;

    const didSucceed = await onDeleteFeed(editItemId);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.feedDeleted);
      onClose();
    }
  };

  const handleSubmitTag = async (event: React.FormEvent) => {
    const didSucceed = await onUpdateTag(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.tagUpdated);
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
    },
  );

  return (
    <ModalContainer
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={editType === 'feed' ? 'Edit Feed' : 'Edit Tag'}
    >
      <div className={styles.editModal}>
        {editType === 'tag' ? (
          <form onSubmit={handleSubmitTag} className={styles.editForm}>
            <div className={styles.formField}>
              <LabeledInput
                id="edit-tag-title"
                label="Tag name"
                value={editTitle}
                onChange={onChangeTitle as (value: string) => void}
                placeholder="Tag name"
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
                onClick={() => void handleDeleteTag()}
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

            <TagPicker
              label="Tags"
              tags={tags}
              selectedIds={editTagIds}
              onToggle={(tagId, on) =>
                onChangeTagIds(
                  on
                    ? [...editTagIds, tagId]
                    : editTagIds.filter((id) => id !== tagId),
                )
              }
              disabled={editLoading}
              emptyHint="No tags yet. Add one from the menu."
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
        )}
      </div>
    </ModalContainer>
  );
}
