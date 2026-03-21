'use client';

import { useEffect } from 'react';
import { getStoredKomorebiMain, setKomorebiMain } from '@/lib/komorebi';

export function KomorebiMainController() {
  useEffect(() => {
    setKomorebiMain(getStoredKomorebiMain());
  }, []);

  return null;
}
