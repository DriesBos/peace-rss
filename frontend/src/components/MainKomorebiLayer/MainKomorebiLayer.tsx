'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import KomorebiShader from '@/components/KomorebiShader/KomorebiShader';
import styles from './MainKomorebiLayer.module.sass';
import {
  DEFAULT_KOMOREBI_MAIN,
  getAppliedKomorebiMain,
  KOMOREBI_MAIN_CHANGE_EVENT,
  KOMOREBI_MAIN_STORAGE_KEY,
  type KomorebiMainPreference,
} from '@/lib/komorebi';

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handlePreferenceChange = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (event.key === KOMOREBI_MAIN_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(KOMOREBI_MAIN_CHANGE_EVENT, handlePreferenceChange);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(KOMOREBI_MAIN_CHANGE_EVENT, handlePreferenceChange);
    window.removeEventListener('storage', handleStorage);
  };
}

function getSnapshot(): KomorebiMainPreference {
  return getAppliedKomorebiMain();
}

function getServerSnapshot(): KomorebiMainPreference {
  return DEFAULT_KOMOREBI_MAIN;
}

const KOMOREBI_MAIN_FADE_MS = 320;

export function MainKomorebiLayer() {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const shouldBeVisible = preference === 'on';
  const [isRendered, setIsRendered] = useState(shouldBeVisible);
  const [isVisible, setIsVisible] = useState(shouldBeVisible);
  const hideTimeoutRef = useRef<number | null>(null);
  const showFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current);
      }
      if (showFrameRef.current !== null) {
        window.cancelAnimationFrame(showFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (showFrameRef.current !== null) {
      window.cancelAnimationFrame(showFrameRef.current);
      showFrameRef.current = null;
    }

    if (shouldBeVisible) {
      setIsRendered(true);
      showFrameRef.current = window.requestAnimationFrame(() => {
        setIsVisible(true);
        showFrameRef.current = null;
      });
      return;
    }

    setIsVisible(false);
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsRendered(false);
      hideTimeoutRef.current = null;
    }, KOMOREBI_MAIN_FADE_MS);
  }, [shouldBeVisible]);

  if (!isRendered) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={[
        styles.layer,
        isVisible ? styles.layerVisible : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <KomorebiShader opacity={0.08} />
    </div>
  );
}
