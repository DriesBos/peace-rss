'use client';

import { useRouter } from 'next/navigation';
import { useKeydown } from '@/hooks/useKeydown';

export function EscapeToHome() {
  const router = useRouter();

  useKeydown((event) => {
    if (event.key !== 'Escape') return;
    if (event.defaultPrevented) return;

    event.preventDefault();
    router.push('/');
  });

  return null;
}
