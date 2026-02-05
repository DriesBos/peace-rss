'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import styles from './page.module.sass';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { Button } from '@/components/Button/Button';

type ToastButton = {
  id: string;
  label: string;
  onClick: () => void;
};

const TOAST_BUTTONS: ToastButton[] = [
  {
    id: 'default',
    label: 'Default',
    onClick: () => toast('Saved to reading list.'),
  },
  {
    id: 'description',
    label: 'With description',
    onClick: () =>
      toast('Feed refreshed.', {
        description: 'Fetched 12 new items.',
      }),
  },
  {
    id: 'success',
    label: 'Success',
    onClick: () => toast.success('Category renamed.'),
  },
  {
    id: 'error',
    label: 'Error',
    onClick: () =>
      toast.error('Could not save.', {
        description: 'Please try again.',
      }),
  },
  {
    id: 'action',
    label: 'Action',
    onClick: () =>
      toast('Feed removed.', {
        action: (
          <button
            type="button"
            className={styles.toastAction}
            onClick={() => toast('Undo complete.')}
          >
            Undo
          </button>
        ),
      }),
  },
  {
    id: 'cancel',
    label: 'Cancel',
    onClick: () =>
      toast('Discard changes?', {
        cancel: (
          <button
            type="button"
            className={styles.toastCancel}
            onClick={() => toast('Kept editing.')}
          >
            Keep editing
          </button>
        ),
      }),
  },
  {
    id: 'loading',
    label: 'Loading',
    onClick: () => {
      const toastId = toast.loading('Refreshing feeds...');
      window.setTimeout(() => {
        toast.success('Refresh complete.', { id: toastId });
      }, 1200);
    },
  },
  {
    id: 'promise',
    label: 'Promise',
    onClick: () => {
      const syncPromise = new Promise<string>((resolve) => {
        window.setTimeout(() => resolve('Sync complete.'), 1400);
      });

      toast.promise(syncPromise, {
        loading: 'Syncing library...',
        success: (message) => message,
        error: 'Sync failed.',
      });
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    onClick: () =>
      toast(
        <div className={styles.customToast}>
          <strong>Saved</strong>
          <span>Added to your "Read later" list.</span>
        </div>
      ),
  },
];

export default function NotificationsPage() {
  return (
    <div className={styles.notificationsPage}>
      <div className={styles.content}>
        <Link href="/" className={styles.backButton} aria-label="Back to home">
          <IconWrapper variant="wide">
            <IconArrowLeft />
          </IconWrapper>
          <span>Back</span>
        </Link>

        <div className={styles.textBlock}>
          <h2 className={styles.sectionTitle}>Notifications</h2>
          <p className={styles.lead}>
            Trigger each toast style to preview how notifications feel in the app.
          </p>
          <div className={styles.buttonsGrid}>
            {TOAST_BUTTONS.map((button) => (
              <Button
                key={button.id}
                type="button"
                variant="primary"
                className={styles.toastButton}
                onClick={button.onClick}
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
