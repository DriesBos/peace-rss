import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PullState = 'idle' | 'pulling' | 'fetching' | 'done';

const PULL_TRIGGER_PX = 70;
const PULL_MAX_PX = 90;
const DONE_HOLD_MS = 700;
const FETCH_INDICATOR_HEIGHT = 32;
const SWIPE_THRESHOLD_PX = 60;
const SWIPE_MAX_VERTICAL_PX = 50;

const getBrowserWindow = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).window ?? null;
};

const getBrowserDocument = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).document ?? null;
};

const getBrowserNavigator = (): any => {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).navigator ?? null;
};

function getScrollTop(): number {
  const win = getBrowserWindow();
  const doc = getBrowserDocument();
  if (!win || !doc) return 0;

  const winScrollY = (win as any).scrollY as unknown;
  const docElScrollTop = (doc as any).documentElement?.scrollTop as unknown;
  const docBodyScrollTop = (doc as any).body?.scrollTop as unknown;
  return (
    (typeof winScrollY === 'number' ? winScrollY : 0) ||
    (typeof docElScrollTop === 'number' ? docElScrollTop : 0) ||
    (typeof docBodyScrollTop === 'number' ? docBodyScrollTop : 0) ||
    0
  );
}

function isTouchCapable(): boolean {
  const win = getBrowserWindow();
  const nav = getBrowserNavigator();
  if (!win || !nav) return false;

  const maxTouchPoints = (nav as any).maxTouchPoints as unknown;
  return (
    'ontouchstart' in win ||
    (typeof maxTouchPoints === 'number' && maxTouchPoints > 0)
  );
}

export function useReaderGestures({
  isProvisioned,
  isLoading,
  canSwipe,
  hasNext,
  hasPrev,
  onNavigateNext,
  onNavigatePrev,
  onRefresh,
}: {
  isProvisioned: boolean;
  isLoading: boolean;
  canSwipe: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullDistance, setPullDistance] = useState(0);
  const appRef = useRef<HTMLDivElement | null>(null);
  const pullDistanceRef = useRef(0);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const isRefreshingRef = useRef(false);
  const doneTimeoutRef = useRef<number | null>(null);

  const resetPullState = useCallback(() => {
    setPullState('idle');
    setPullDistance(0);
    pullDistanceRef.current = 0;
    startYRef.current = null;
    startXRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      swipeStartRef.current = canSwipe
        ? { x: touch.clientX, y: touch.clientY }
        : null;

      if (!isProvisioned || isLoading) return;
      if (isRefreshingRef.current) return;
      if (getScrollTop() > 0) return;
      if (doneTimeoutRef.current) {
        const win = getBrowserWindow();
        if (win) {
          win.clearTimeout(doneTimeoutRef.current);
        }
        doneTimeoutRef.current = null;
      }
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
    },
    [canSwipe, isProvisioned, isLoading],
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isProvisioned || isLoading) return;
      if (isRefreshingRef.current) return;
      const startY = startYRef.current;
      const startX = startXRef.current;
      if (startY === null || startX === null) return;
      if (getScrollTop() > 0) {
        resetPullState();
        return;
      }
      const touch = event.touches[0];
      const currentY = touch.clientY;
      const currentX = touch.clientX;
      const deltaY = currentY - startY;
      const deltaX = currentX - startX;
      if (deltaY <= 0) {
        resetPullState();
        return;
      }
      if (Math.abs(deltaY) < Math.abs(deltaX)) {
        resetPullState();
        return;
      }

      event.preventDefault();
      swipeStartRef.current = null;
      pullDistanceRef.current = deltaY;
      setPullDistance(deltaY);
      if (pullState !== 'pulling') setPullState('pulling');
    },
    [isProvisioned, isLoading, pullState, resetPullState],
  );

  const handleTouchEnd = useCallback(
    async (event?: TouchEvent) => {
      const pullStart = startYRef.current;
      const pullDistanceValue = pullDistanceRef.current;
      const swipeStart = swipeStartRef.current;
      startYRef.current = null;
      startXRef.current = null;
      swipeStartRef.current = null;

      if (pullStart !== null) {
        if (pullDistanceValue >= PULL_TRIGGER_PX && !isRefreshingRef.current) {
          isRefreshingRef.current = true;
          setPullState('fetching');
          setPullDistance(0);
          pullDistanceRef.current = 0;
          try {
            await onRefresh();
          } finally {
            setPullState('done');
            const win = getBrowserWindow();
            if (win) {
              doneTimeoutRef.current = win.setTimeout(() => {
                setPullState('idle');
                doneTimeoutRef.current = null;
              }, DONE_HOLD_MS);
            } else {
              doneTimeoutRef.current = null;
            }
            isRefreshingRef.current = false;
          }
          return;
        }

        resetPullState();
      }

      if (!canSwipe) return;
      if (!swipeStart) return;
      const touch = event?.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - swipeStart.x;
      const deltaY = touch.clientY - swipeStart.y;
      if (
        Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
        Math.abs(deltaY) > SWIPE_MAX_VERTICAL_PX
      ) {
        return;
      }

      if (deltaX < 0 && hasNext) {
        onNavigateNext();
      } else if (deltaX > 0 && hasPrev) {
        onNavigatePrev();
      }
    },
    [
      canSwipe,
      hasNext,
      hasPrev,
      onNavigateNext,
      onNavigatePrev,
      onRefresh,
      resetPullState,
    ],
  );

  useEffect(() => {
    const win = getBrowserWindow();
    return () => {
      if (doneTimeoutRef.current && win) {
        win.clearTimeout(doneTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const node = appRef.current;
    if (!node) return;
    if (!isTouchCapable()) return;

    const onTouchStart = (event: TouchEvent) => handleTouchStart(event);
    const onTouchMove = (event: TouchEvent) => handleTouchMove(event);
    const onTouchEnd = (event: TouchEvent) => {
      void handleTouchEnd(event);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);

    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const indicatorHeight = useMemo(
    () =>
      pullState === 'pulling'
        ? Math.min(pullDistance, PULL_MAX_PX)
        : pullState === 'fetching' || pullState === 'done'
          ? FETCH_INDICATOR_HEIGHT
          : 0,
    [pullDistance, pullState],
  );

  const pullOffset = indicatorHeight;

  const indicatorLabel =
    pullState === 'pulling'
      ? 'pulling'
      : pullState === 'fetching'
        ? 'fetching'
        : pullState === 'done'
          ? 'done'
          : '';

  return {
    appRef,
    pullState,
    pullOffset,
    indicatorHeight,
    indicatorLabel,
  };
}
