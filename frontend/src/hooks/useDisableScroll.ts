import { useEffect } from 'react';

/**
 * Custom hook to disable body scroll when a modal or panel is open.
 * Automatically restores the original overflow value when closed.
 * 
 * @param isOpen - Whether the modal/panel is open
 */
export function useDisableScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Store original overflow value
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Calculate scrollbar width to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Disable scroll and compensate for scrollbar width
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Cleanup: restore original values
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);
}
