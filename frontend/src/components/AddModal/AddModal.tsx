'use client';

import { useMemo } from 'react';
import styles from './AddModal.module.sass';
import { ModalContainer } from '@/components/ModalContainer/ModalContainer';
import { LabeledInput } from '@/components/LabeledInput/LabeledInput';
import { LabeledSelect } from '@/components/LabeledSelect/LabeledSelect';
import { TagPicker } from '@/components/TagPicker/TagPicker';
import type { DiscoveredFeed, Tag } from '@/app/_lib/types';
import { toast } from 'sonner';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { useKeydown } from '@/hooks/useKeydown';
import { Button } from '@/components/Button/Button';

export type AddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Tags that can be put on a feed. */
  tags: Tag[];
  newTagTitle: string;
  setNewTagTitle: (value: string) => void;
  addTagLoading: boolean;
  addTagError: string | null;
  addTag: (e: React.FormEvent) => Promise<boolean>;
  newFeedUrl: string;
  setNewFeedUrl: (value: string) => void;
  newFeedTagIds: number[];
  setNewFeedTagIds: (value: number[]) => void;
  discoveredFeeds: DiscoveredFeed[];
  selectedDiscoveredFeedUrl: string;
  setSelectedDiscoveredFeedUrl: (value: string) => void;
  addFeedLoading: boolean;
  addFeedError: string | null;
  addFeed: (e: React.FormEvent) => Promise<boolean>;
  isLoading: boolean;
};

export function AddModal({
  isOpen,
  onClose,
  tags,
  newTagTitle,
  setNewTagTitle,
  addTagLoading,
  addTagError,
  addTag,
  newFeedUrl,
  setNewFeedUrl,
  newFeedTagIds,
  setNewFeedTagIds,
  discoveredFeeds,
  selectedDiscoveredFeedUrl,
  setSelectedDiscoveredFeedUrl,
  addFeedLoading,
  addFeedError,
  addFeed,
  isLoading,
}: AddModalProps) {
  const isChoosingDiscoveredFeed = discoveredFeeds.length > 0;
  const canSubmitFeed = isChoosingDiscoveredFeed
    ? Boolean(selectedDiscoveredFeedUrl)
    : Boolean(newFeedUrl.trim());

  const handleAddTag = async (event: React.FormEvent) => {
    const didSucceed = await addTag(event);
    if (didSucceed) {
      toast.success(NOTIFICATION_COPY.app.tagAdded);
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

  const discoveredFeedOptions = useMemo(() => {
    return discoveredFeeds.map((feed) => ({
      value: feed.url,
      label: `${feed.title || feed.url} (${feed.type.toUpperCase()})`,
    }));
  }, [discoveredFeeds]);

  return (
    <ModalContainer isOpen={isOpen} onClose={onClose} ariaLabel="Add">
      <div className={styles.modalAdd}>
        <form onSubmit={handleAddFeed} className={styles.formBlock}>
          <LabeledInput
            id="add-feed-url"
            label="Add content"
            value={newFeedUrl}
            onChange={setNewFeedUrl}
            placeholder="Add web address..."
            disabled={addFeedLoading || isLoading}
          />
          <TagPicker
            label="Tags"
            tags={tags}
            selectedIds={newFeedTagIds}
            onToggle={(tagId, on) =>
              setNewFeedTagIds(
                on
                  ? [...newFeedTagIds, tagId]
                  : newFeedTagIds.filter((id) => id !== tagId),
              )
            }
            disabled={addFeedLoading || isLoading}
            emptyHint="No tags yet. Add one below; tags are optional."
          />
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

        <form onSubmit={handleAddTag} className={styles.formBlock}>
          <LabeledInput
            id="add-tag-title"
            label="New tag"
            value={newTagTitle}
            onChange={setNewTagTitle}
            placeholder="Tag name.."
            disabled={addTagLoading || isLoading}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={addTagLoading || isLoading || !newTagTitle.trim()}
          >
            {addTagLoading ? 'Adding...' : 'Add tag'}
          </Button>
          {addTagError && <div className={styles.error}>{addTagError}</div>}
        </form>
      </div>
    </ModalContainer>
  );
}
