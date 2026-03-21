'use client';

import { useSyncExternalStore } from 'react';
import KomorebiShader from '@/components/KomorebiShader/KomorebiShader';
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

export function MainKomorebiLayer() {
  const preference = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (preference !== 'on') {
    return null;
  }

  return <KomorebiShader opacity={0.08} />;
}
