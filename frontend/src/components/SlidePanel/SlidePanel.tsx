'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import styles from './SlidePanel.module.sass';
import { Button } from '@/components/Button/Button';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { useDisableScroll } from '@/hooks/useDisableScroll';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import { useKeydown } from '@/hooks/useKeydown';
import { MainKomorebiLayer } from '@/components/MainKomorebiLayer/MainKomorebiLayer';

gsap.registerPlugin(useGSAP);

const OPEN_DURATION_SECONDS = 0.42;
const CLOSE_DURATION_SECONDS = 0.32;
const OVERLAY_DURATION_SECONDS = 0.2;

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
  const [isPresent, setIsPresent] = useState(isOpen);
  useDisableScroll(isOpen || isPresent);

  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const [isA11yHidden, setIsA11yHidden] = useState(!isOpen);
  const [isHeaderStuck, setIsHeaderStuck] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = scrollContainerRef ?? internalContainerRef;
  const headerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const hasCapturedFocusRef = useRef(false);
  const hasPrimedEntranceRef = useRef(false);

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

  const shouldRender = isOpen || isPresent;

  const syncHeaderStickyState = useCallback(() => {
    const container = containerRef.current;
    const header = headerRef.current;
    if (!container || !header) return;

    const containerTop = container.getBoundingClientRect().top;
    const headerTop = header.getBoundingClientRect().top;
    setIsHeaderStuck(headerTop <= containerTop + 0.5);
  }, [containerRef]);

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

      setIsA11yHidden(false);

      if (!hasCapturedFocusRef.current) {
        previouslyFocusedElementRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        hasCapturedFocusRef.current = true;
      }

      const container = containerRef.current;
      if (container) {
        container.focus({ preventScroll: true });
      }
      return;
    }

    if (!isPresent) return;

    restoreFocus();
    setIsA11yHidden(true);
    hasCapturedFocusRef.current = false;
    previouslyFocusedElementRef.current = null;
  }, [containerRef, isOpen, isPresent, restoreFocus]);

  useEffect(() => {
    if (!shouldRender) return;

    syncHeaderStickyState();

    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      syncHeaderStickyState();
    };

    const onResize = () => {
      syncHeaderStickyState();
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [containerRef, shouldRender, syncHeaderStickyState]);

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
    },
  );

  useGSAP(
    () => {
      if (!shouldRender) return;

      const overlay = overlayRef.current;
      const container = containerRef.current;
      if (!overlay || !container) return;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const openDuration = prefersReducedMotion ? 0 : OPEN_DURATION_SECONDS;
      const closeDuration = prefersReducedMotion ? 0 : CLOSE_DURATION_SECONDS;
      const overlayDuration = prefersReducedMotion ? 0 : OVERLAY_DURATION_SECONDS;

      gsap.killTweensOf(overlay);
      gsap.killTweensOf(container);

      if (isOpen) {
        if (!hasPrimedEntranceRef.current) {
          gsap.set(overlay, { autoAlpha: 0 });
          gsap.set(container, {
            autoAlpha: 1,
            force3D: true,
            xPercent: 100,
            opacity: 0,
          });
          hasPrimedEntranceRef.current = true;
        }

        gsap.to(overlay, {
          autoAlpha: 1,
          duration: overlayDuration,
          ease: 'power2.out',
          overwrite: 'auto',
        });
        gsap.to(container, {
          duration: openDuration,
          ease: 'power3.out',
          force3D: true,
          overwrite: 'auto',
          xPercent: 0,
          opacity: 1,
        });
        return;
      }

      gsap.to(overlay, {
        autoAlpha: 0,
        duration: overlayDuration,
        ease: 'power2.inOut',
        overwrite: 'auto',
      });
      gsap.to(container, {
        duration: closeDuration,
        ease: 'power3.in',
        force3D: true,
        overwrite: 'auto',
        xPercent: 100,
        opacity: 0,
        onComplete: () => {
          hasPrimedEntranceRef.current = false;
          setIsPresent(false);
        },
      });
    },
    {
      scope: overlayRef,
      dependencies: [containerRef, isOpen, shouldRender],
    },
  );

  const ariaHidden = isOpen ? false : isA11yHidden;

  const panel = (
    <>
      {/* Backdrop overlay */}
      <div
        className={styles.slidePanel_Backdrop}
        ref={overlayRef}
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
      >
        <div className={styles.slidePanel_Background} aria-hidden="true">
          <MainKomorebiLayer />
        </div>
        <div className={styles.slidePanel_Content}>
          <div
            ref={headerRef}
            className={styles.slidePanel_Header}
            data-stuck={isHeaderStuck}
          >
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
