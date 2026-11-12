'use client';

import { useCallback, useState } from 'react';

type ImageLoadState = 'loading' | 'loaded' | 'error';

/**
 * Tracks an <img>'s load state for the data-loading surface
 * (styles/loading.sass). Pass `attachImage` as the img ref, plus `onLoad` and `onError`, and put
 * `dataLoading` on its wrapper.
 */
export function useImageLoadState(src?: string) {
  const [state, setState] = useState<ImageLoadState>('loading');
  const [trackedSrc, setTrackedSrc] = useState(src);

  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setState('loading');
  }

  // Cached images can finish before React attaches onLoad.
  const attachImage = useCallback((img: HTMLImageElement | null) => {
    if (!img || !img.complete) return;
    setState(img.naturalWidth > 0 ? 'loaded' : 'error');
  }, []);

  const dataLoading =
    state === 'loading' ? 'true' : state === 'error' ? 'error' : 'false';

  return {
    state,
    dataLoading,
    attachImage,
    onLoad: () => setState('loaded'),
    onError: () => setState('error'),
  } as const;
}
