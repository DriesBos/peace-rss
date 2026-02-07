'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useKeydown } from '@/hooks/useKeydown';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }
  if (target.getAttribute('role') === 'textbox') return true;
  return false;
}

function isPlusKey(event: KeyboardEvent): boolean {
  // '+' is typically Shift+='=' on US keyboards.
  return (
    event.key === '+' ||
    event.code === 'NumpadAdd' ||
    (event.code === 'Equal' && event.shiftKey)
  );
}

export function GlobalKeybindings() {
  const router = useRouter();
  const pathname = usePathname();

  const openAddModal = useCallback(() => {
    if (pathname === '/') {
      window.dispatchEvent(new CustomEvent('peace-rss:open-add-modal'));
      return;
    }

    router.push('/?openAdd=1', { scroll: false });
  }, [pathname, router]);

  useKeydown((event) => {
    if (event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (
      isEditableTarget(event.target) ||
      isEditableTarget(document.activeElement)
    ) {
      return;
    }

    if (!isPlusKey(event)) return;

    event.preventDefault();
    openAddModal();
  });

  return null;
}

