import { useEffect, useRef } from 'react';

type UseKeydownOptions = {
  enabled?: boolean;
  target?: Window | Document | HTMLElement | null;
};

export function useKeydown(
  handler: (event: KeyboardEvent) => void,
  options: UseKeydownOptions = {}
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (options.enabled === false) return;

    const target =
      options.target ?? (typeof window !== 'undefined' ? window : null);
    if (!target) return;

    const listener: EventListener = (event) => {
      savedHandler.current(event as KeyboardEvent);
    };

    target.addEventListener('keydown', listener);

    return () => {
      target.removeEventListener('keydown', listener);
    };
  }, [options.enabled, options.target]);
}
