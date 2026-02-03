'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

type ScrollToTopProps = {
  containerRef: RefObject<HTMLElement | null>;
  triggerKey: string | number | null | undefined;
  isActive?: boolean;
  behavior?: ScrollBehavior;
};

export function ScrollToTop({
  containerRef,
  triggerKey,
  isActive = true,
  behavior = 'auto',
}: ScrollToTopProps) {
  useEffect(() => {
    if (!isActive) return;
    const node = containerRef.current;
    if (!node) return;

    if (typeof node.scrollTo === 'function') {
      node.scrollTo({ top: 0, left: 0, behavior });
      return;
    }

    node.scrollTop = 0;
  }, [containerRef, triggerKey, isActive, behavior]);

  return null;
}
