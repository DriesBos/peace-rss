const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

type TabKeyEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function trapTabFocus(
  event: TabKeyEvent,
  container: HTMLElement | null,
) {
  if (event.key !== 'Tab' || !container) return;

  const focusableElements = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) => element.tabIndex >= 0 && isVisible(element));

  if (focusableElements.length === 0) {
    event.preventDefault();
    container.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = container.ownerDocument.activeElement;
  const containerHasFocus = activeElement === container;

  if (event.shiftKey) {
    if (
      containerHasFocus ||
      activeElement === firstElement ||
      !container.contains(activeElement)
    ) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
    }
    return;
  }

  if (containerHasFocus || activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}
