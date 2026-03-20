'use client';

import { useEffect } from 'react';
import { applyFontFamily, getStoredFontFamily } from '@/lib/fontFamily';

export function FontFamilyController() {
  useEffect(() => {
    applyFontFamily(getStoredFontFamily());
  }, []);

  return null;
}
