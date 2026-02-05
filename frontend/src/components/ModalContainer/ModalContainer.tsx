'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ModalContainer.module.sass';
import { useDisableScroll } from '@/hooks/useDisableScroll';

type ModalContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
  containerClassName?: string;
};

export function ModalContainer({
  isOpen,
  onClose,
  ariaLabel,
  children,
  containerClassName,
}: ModalContainerProps) {
  // Disable body scroll when modal is open
  useDisableScroll(isOpen);

  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setPortalTarget(document.getElementById('modal-root') ?? document.body);
  }, []);

  const modal = (
    <div
      className={styles.modalOverlay}
      role="presentation"
      onClick={onClose}
      aria-hidden={!isOpen}
      data-active={isOpen}
    >
      <div
        className={[
          styles.modalOverlay_Container,
          containerClassName ? containerClassName : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        data-active={isOpen}
      >
        <button
          type="button"
          className={styles.modalOverlay_ClosingBar}
          onClick={onClose}
          aria-label="Close modal"
        >
          <div className={styles.modalOverlay_ClosingBar_Button} />
        </button>
        {children}
      </div>
    </div>
  );

  if (!portalTarget) return null;
  return createPortal(modal, portalTarget);
}
