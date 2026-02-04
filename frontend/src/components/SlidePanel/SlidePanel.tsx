import { useEffect } from 'react';
import type { RefObject } from 'react';
import styles from './SlidePanel.module.sass';
import { Button } from '@/components/Button/Button';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { useDisableScroll } from '@/hooks/useDisableScroll';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';

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

  // Handle Escape key to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't close if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
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
}
