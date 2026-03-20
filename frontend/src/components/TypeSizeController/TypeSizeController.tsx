'use client';

import { useEffect } from 'react';
import { applyTypeSize, getStoredTypeSize } from '@/lib/typeSize';

export function TypeSizeController() {
  useEffect(() => {
    applyTypeSize(getStoredTypeSize());
  }, []);

  return null;
}
