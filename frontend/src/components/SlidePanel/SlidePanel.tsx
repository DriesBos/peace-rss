'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type TransitionEvent,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './SlidePanel.module.sass';
import { Button } from '@/components/Button/Button';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { useDisableScroll } from '@/hooks/useDisableScroll';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { useKeydown } from '@/hooks/useKeydown';

type SlidePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

export function SlidePanel({
  isOpen,
  onClose,
  ariaLabel = 'Detail panel',
  children,
  scrollContainerRef,
}: SlidePanelProps) {
  // Disable body scroll when panel is open
  useDisableScroll(isOpen);

  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [isPresent, setIsPresent] = useState(isOpen);
  const [isA11yHidden, setIsA11yHidden] = useState(!isOpen);

  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = scrollContainerRef ?? internalContainerRef;
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
    const container = containerRef.current;

    const activeIsInsidePanel =
      container &&
      active instanceof HTMLElement &&
      (active === container || container.contains(active));

    if (activeIsInsidePanel && active instanceof HTMLElement) {
      active.blur();
    }

    if (
      previous &&
      typeof previous.focus === 'function' &&
      document.contains(previous)
    ) {
      previous.focus({ preventScroll: true });
    }
  }, [containerRef]);

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

      const container = containerRef.current;
      if (container) {
        container.focus({ preventScroll: true });
      }

      return;
    }

    if (!isPresent) return;

    restoreFocus();
    setIsA11yHidden(true);
    previouslyFocusedElementRef.current = null;
  }, [containerRef, isOpen, isPresent, restoreFocus]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOpen) return;
    if (!isPresent) return;

    const timeout = window.setTimeout(() => {
      setIsPresent(false);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [isOpen, isPresent]);

  // Handle Escape key to close panel
  useKeydown(
    (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      requestClose();
    },
    {
      enabled: isOpen,
      target: typeof document !== 'undefined' ? document : null,
    }
  );

  const ariaHidden = isOpen ? false : isA11yHidden;
  const shouldRender = isOpen || isPresent;

  const handleContainerTransitionEnd = useCallback(
    (event: TransitionEvent<HTMLDivElement>) => {
      if (event.target !== containerRef.current) return;
      if (event.propertyName !== 'opacity') return;
      if (isOpen) return;
      setIsPresent(false);
    },
    [containerRef, isOpen],
  );

  const panel = (
    <>
      {/* Backdrop overlay */}
      <div
        className={styles.slidePanel_Backdrop}
        onClick={() => {
          if (!isOpen) return;
          requestClose();
        }}
        aria-hidden={ariaHidden}
        data-open={isOpen}
      />

      {/* Slide panel */}
      <div
        className={styles.slidePanel_Container}
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={ariaHidden}
        data-open={isOpen}
        tabIndex={-1}
        onTransitionEnd={handleContainerTransitionEnd}
      >
        <div className={styles.slidePanel_Content}>
          <div className={styles.slidePanel_Header}>
            <Button
              type="button"
              variant="nav"
              onClick={requestClose}
              aria-label="Close detail panel"
            >
              <IconWrapper variant="wide">
                <IconArrowLeft />
              </IconWrapper>
              <span>Back</span>
            </Button>
          </div>
          {children}
        </div>
      </div>
    </>
  );

  if (!portalTarget || !shouldRender) return null;
  return createPortal(panel, portalTarget);
}
