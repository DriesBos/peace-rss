'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './ModalContainer.module.sass';
import { useDisableScroll } from '@/hooks/useDisableScroll';
import { trapTabFocus } from '@/lib/focusTrap';

gsap.registerPlugin(useGSAP);

const OPEN_DURATION_SECONDS = 0.42;
const CLOSE_DURATION_SECONDS = 0.32;
const OVERLAY_DURATION_SECONDS = 0.2;
const HEIGHT_DURATION_SECONDS = 0.32;

function getDialogTargetHeight(
  dialog: HTMLDivElement,
  scroller: HTMLDivElement,
  content: HTMLDivElement,
) {
  const dialogStyles = window.getComputedStyle(dialog);
  const scrollerStyles = window.getComputedStyle(scroller);
  const borderTop = Number.parseFloat(dialogStyles.borderTopWidth) || 0;
  const borderBottom = Number.parseFloat(dialogStyles.borderBottomWidth) || 0;
  const paddingTop = Number.parseFloat(scrollerStyles.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(scrollerStyles.paddingBottom) || 0;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const maxHeight = viewportHeight * 0.9;

  return Math.min(
    Math.ceil(
      content.offsetHeight + paddingTop + paddingBottom + borderTop + borderBottom,
    ),
    Math.floor(maxHeight),
  );
}

type ModalContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
  containerClassName?: string;
};

export function ModalContainer({
  isOpen,
  onClose,
  onAfterClose,
  ariaLabel,
  children,
  containerClassName,
}: ModalContainerProps) {
  // Disable body scroll when modal is open
  const [isPresent, setIsPresent] = useState(isOpen);
  useDisableScroll(isOpen || isPresent);

  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const hasCapturedFocusRef = useRef(false);
  const hasPrimedEntranceRef = useRef(false);
  const isOpeningRef = useRef(false);
  const isClosingRef = useRef(false);
  const { contextSafe } = useGSAP({ scope: overlayRef });

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

  const shouldRender = isOpen || isPresent;

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return;

    if (isOpen) {
      if (!isPresent) {
        const schedule =
          typeof queueMicrotask === 'function'
            ? queueMicrotask
            : (callback: () => void) => Promise.resolve().then(callback);

        schedule(() => {
          setIsPresent(true);
        });
      }

      if (!hasCapturedFocusRef.current) {
        previouslyFocusedElementRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        hasCapturedFocusRef.current = true;
      }

      const isTouchLikeDevice =
        typeof window !== 'undefined' &&
        window.matchMedia('(hover: none), (pointer: coarse)').matches;

      if (isTouchLikeDevice) {
        dialogRef.current?.focus({ preventScroll: true });
      } else {
        closeButtonRef.current?.focus({ preventScroll: true });
      }

      return;
    }

    if (!isPresent) return;

    restoreFocus();
    hasCapturedFocusRef.current = false;
    previouslyFocusedElementRef.current = null;
  }, [isOpen, isPresent, restoreFocus]);

  const syncDialogHeight = useCallback(
    ({ immediate = false }: { immediate?: boolean } = {}) => {
      if (typeof window === 'undefined') return 0;

      const dialog = dialogRef.current;
      const scroller = scrollerRef.current;
      const content = contentRef.current;
      if (!dialog || !scroller || !content) return 0;

      const nextHeight = getDialogTargetHeight(dialog, scroller, content);
      gsap.killTweensOf(dialog, 'height');

      if (
        immediate ||
        !isOpen ||
        isOpeningRef.current ||
        isClosingRef.current
      ) {
        gsap.set(dialog, { height: nextHeight });
        return nextHeight;
      }

      gsap.to(dialog, {
        duration: HEIGHT_DURATION_SECONDS,
        ease: 'power2.out',
        height: nextHeight,
        overwrite: 'auto',
      });

      return nextHeight;
    },
    [isOpen],
  );

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldRender) return;

    const syncDialogHeightSafely = contextSafe(syncDialogHeight);
    syncDialogHeightSafely({ immediate: true });

    const content = contentRef.current;
    if (!content) return;

    let frameId = 0;
    const scheduleHeightSync = () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        syncDialogHeightSafely();
      });
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleHeightSync();
          })
        : null;

    resizeObserver?.observe(content);

    const handleViewportResize = () => {
      syncDialogHeightSafely();
    };

    window.addEventListener('resize', handleViewportResize);
    window.addEventListener('orientationchange', handleViewportResize);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleViewportResize);
      window.removeEventListener('orientationchange', handleViewportResize);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, [contextSafe, shouldRender, syncDialogHeight]);

  useGSAP(
    () => {
      if (!shouldRender) return;

      const overlay = overlayRef.current;
      const dialog = dialogRef.current;
      if (!overlay || !dialog) return;

      gsap.killTweensOf(overlay);
      gsap.killTweensOf(dialog, 'yPercent');

      if (isOpen) {
        isClosingRef.current = false;
        isOpeningRef.current = true;

        if (!hasPrimedEntranceRef.current) {
          gsap.set(overlay, { autoAlpha: 0 });
          gsap.set(dialog, {
            force3D: true,
            yPercent: 100,
          });
          hasPrimedEntranceRef.current = true;
        }

        syncDialogHeight({ immediate: true });

        gsap.to(overlay, {
          autoAlpha: 1,
          duration: OVERLAY_DURATION_SECONDS,
          ease: 'power2.out',
          overwrite: 'auto',
        });
        gsap.to(dialog, {
          duration: OPEN_DURATION_SECONDS,
          ease: 'power3.out',
          force3D: true,
          overwrite: 'auto',
          yPercent: 0,
          onComplete: () => {
            isOpeningRef.current = false;
            syncDialogHeight({ immediate: true });
          },
        });
        return;
      }

      isOpeningRef.current = false;
      isClosingRef.current = true;

      gsap.to(overlay, {
        autoAlpha: 0,
        duration: OVERLAY_DURATION_SECONDS,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
      gsap.to(dialog, {
        duration: CLOSE_DURATION_SECONDS,
        ease: 'power3.in',
        force3D: true,
        overwrite: 'auto',
        yPercent: 100,
        onComplete: () => {
          isClosingRef.current = false;
          hasPrimedEntranceRef.current = false;
          setIsPresent(false);
          onAfterClose?.();
        },
      });
    },
    {
      scope: overlayRef,
      dependencies: [isOpen, onAfterClose, shouldRender, syncDialogHeight],
    },
  );

  const ariaHidden = !isOpen;

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
      data-present={shouldRender ? 'true' : 'false'}
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
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => trapTabFocus(event, dialogRef.current)}
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
        <div className={styles.modalOverlay_Scroller} ref={scrollerRef}>
          <div className={styles.modalOverlay_Body} ref={contentRef}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  if (!portalTarget || !shouldRender) return null;
  return createPortal(modal, portalTarget);
}
