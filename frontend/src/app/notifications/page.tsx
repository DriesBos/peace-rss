'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import styles from './page.module.sass';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { Button } from '@/components/Button/Button';
import { NOTIFICATION_COPY } from '@/lib/notificationCopy';
import { EscapeToHome } from '@/components/EscapeToHome/EscapeToHome';

type ToastButton = {
  id: string;
  label: string;
  onClick: () => void;
};

const TOAST_BUTTONS: ToastButton[] = [
  {
    id: 'default',
    label: 'Default',
    onClick: () => toast(NOTIFICATION_COPY.demo.defaultToast),
  },
  {
    id: 'description',
    label: 'With description',
    onClick: () =>
      toast(NOTIFICATION_COPY.demo.descriptionTitle, {
        description: NOTIFICATION_COPY.demo.descriptionBody,
      }),
  },
  {
    id: 'success',
    label: 'Success',
    onClick: () => toast.success(NOTIFICATION_COPY.demo.successToast),
  },
  {
    id: 'error',
    label: 'Error',
    onClick: () =>
      toast.error(NOTIFICATION_COPY.demo.errorTitle, {
        description: NOTIFICATION_COPY.demo.errorBody,
      }),
  },
  {
    id: 'action',
    label: 'Action',
    onClick: () =>
      toast(NOTIFICATION_COPY.demo.actionTitle, {
        action: (
          <button
            type="button"
            className={styles.toastAction}
            onClick={() => toast(NOTIFICATION_COPY.demo.actionUndoResult)}
          >
            {NOTIFICATION_COPY.demo.actionUndoLabel}
          </button>
        ),
      }),
  },
  {
    id: 'cancel',
    label: 'Cancel',
    onClick: () =>
      toast(NOTIFICATION_COPY.demo.cancelTitle, {
        cancel: (
          <button
            type="button"
            className={styles.toastCancel}
            onClick={() => toast(NOTIFICATION_COPY.demo.cancelResult)}
          >
            {NOTIFICATION_COPY.demo.cancelLabel}
          </button>
        ),
      }),
  },
  {
    id: 'loading',
    label: 'Loading',
    onClick: () => {
      const toastId = toast.loading(NOTIFICATION_COPY.demo.loadingTitle);
      setTimeout(() => {
        toast.success(NOTIFICATION_COPY.demo.loadingSuccess, { id: toastId });
      }, 1200);
    },
  },
  {
    id: 'promise',
    label: 'Promise',
    onClick: () => {
      const syncPromise = new Promise<string>((resolve) => {
        setTimeout(
          () => resolve(NOTIFICATION_COPY.demo.promiseSuccess),
          1400
        );
      });

      toast.promise(syncPromise, {
        loading: NOTIFICATION_COPY.demo.promiseLoading,
        success: (message) => message,
        error: NOTIFICATION_COPY.demo.promiseError,
      });
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    onClick: () =>
      toast(
        <div className={styles.customToast}>
          <strong>{NOTIFICATION_COPY.demo.customTitle}</strong>
          <span>{NOTIFICATION_COPY.demo.customBody}</span>
        </div>
      ),
  },
];

export default function NotificationsPage() {
  return (
    <div className={styles.notificationsPage}>
      <EscapeToHome />
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
