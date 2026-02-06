'use client';

import { useEffect, useState, type RefObject } from 'react';
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

  // Handle Escape key to close panel
  useKeydown(
    (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      onClose();
    },
    {
      enabled: isOpen,
      target: typeof document !== 'undefined' ? document : null,
    }
  );

  const panel = (
    <>
      {/* Backdrop overlay */}
      <div
        className={styles.slidePanel_Backdrop}
        onClick={onClose}
        aria-hidden={!isOpen}
        data-open={isOpen}
      />

      {/* Slide panel */}
      <div
        className={styles.slidePanel_Container}
        ref={scrollContainerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-hidden={!isOpen}
        data-open={isOpen}
      >
        <div className={styles.slidePanel_Content}>
          <div className={styles.slidePanel_Header}>
            <Button
              type="button"
              variant="nav"
              onClick={onClose}
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

  if (!portalTarget) return null;
  return createPortal(panel, portalTarget);
}
