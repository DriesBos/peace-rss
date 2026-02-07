'use client';

import {
  type TransitionEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
  const [isPresent, setIsPresent] = useState(isOpen);
  const [isA11yHidden, setIsA11yHidden] = useState(!isOpen);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let cancelled = false;
    const schedule =
      typeof queueMicrotask === 'function'
        ? queueMicrotask
        : (callback: () => void) => Promise.resolve().then(callback);

    schedule(() => {
      if (cancelled) return;
      setPortalTarget(document.getElementById('modal-root') ?? document.body);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const restoreFocus = useCallback(() => {
    if (typeof document === 'undefined') return;

    const previous = previouslyFocusedElementRef.current;
    const active = document.activeElement;
    const dialog = dialogRef.current;

    const activeIsInsideDialog =
      dialog &&
      active instanceof HTMLElement &&
      (active === dialog || dialog.contains(active));

    if (activeIsInsideDialog && active instanceof HTMLElement) {
      active.blur();
    }

    if (
      previous &&
      typeof previous.focus === 'function' &&
      document.contains(previous)
    ) {
      previous.focus({ preventScroll: true });
      return;
    }

    if (document.body && typeof document.body.focus === 'function') {
      document.body.focus({ preventScroll: true });
    }
  }, []);

  const requestClose = useCallback(() => {
    restoreFocus();
    onClose();
  }, [onClose, restoreFocus]);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;

    if (isOpen) {
      setIsPresent(true);
      setIsA11yHidden(false);

      previouslyFocusedElementRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      const closeButton = closeButtonRef.current;
      if (closeButton) {
        closeButton.focus({ preventScroll: true });
      }

      return;
    }

    if (!isPresent) return;

    restoreFocus();
    setIsA11yHidden(true);
    previouslyFocusedElementRef.current = null;
  }, [isOpen, isPresent, restoreFocus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOpen) return;
    if (!isPresent) return;

    const timeout = window.setTimeout(() => {
      setIsPresent(false);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [isOpen, isPresent]);

  const ariaHidden = isOpen ? false : isA11yHidden;
  const shouldRender = isOpen || isPresent;

  const handleDialogTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.target !== dialogRef.current) return;
      if (event.propertyName !== 'transform') return;
      if (isOpen) return;
      setIsPresent(false);
    },
    [isOpen],
  );

  const modal = (
    <div
      className={styles.modalOverlay}
      role="presentation"
      ref={overlayRef}
      onClick={() => {
        if (!isOpen) return;
        requestClose();
      }}
      aria-hidden={ariaHidden}
      data-active={isOpen}
    >
      <div
        className={[
          styles.modalOverlay_Container,
          containerClassName ? containerClassName : '',
        ]
          .filter(Boolean)
          .join(' ')}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(event) => event.stopPropagation()}
        onTransitionEnd={handleDialogTransitionEnd}
        data-active={isOpen}
      >
        <button
          type="button"
          className={styles.modalOverlay_ClosingBar}
          ref={closeButtonRef}
          onClick={requestClose}
          aria-label="Close modal"
        >
          <div className={styles.modalOverlay_ClosingBar_Button} />
        </button>
        {children}
      </div>
    </div>
  );

  if (!portalTarget || !shouldRender) return null;
  return createPortal(modal, portalTarget);
}
