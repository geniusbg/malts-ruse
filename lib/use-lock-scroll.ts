import { useEffect } from 'react';

let lockDepth = 0;
let storedScrollY = 0;
let storedPathname: string | null = null;

function preventScrollBehindModal(e: Event) {
  const target = e.target;

  if (!target || !(target instanceof Element)) {
    e.preventDefault();
    return false;
  }

  /** Modals mark their scroll surface — iOS often fails the overflow walk; always allow gestures here */
  if (target.closest('[data-modal-scroll]')) {
    return true;
  }

  let element: HTMLElement | null = target instanceof HTMLElement ? target : target.parentElement;
  while (element && element !== document.body && element !== document.documentElement) {
    try {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const overflow = style.overflow;

      if (
        overflowY === 'auto' ||
        overflowY === 'scroll' ||
        overflowX === 'auto' ||
        overflowX === 'scroll' ||
        overflow === 'auto' ||
        overflow === 'scroll'
      ) {
        const canScrollY = element.scrollHeight > element.clientHeight;
        const canScrollX = element.scrollWidth > element.clientWidth;
        const canScroll = canScrollY || canScrollX;
        if (canScroll) {
          return true;
        }
      }
    } catch {
      // ignore
    }

    element = element.parentElement;
  }

  e.preventDefault();
  e.stopPropagation();
  return false;
}

function applyBodyLock() {
  if (typeof window === 'undefined') return;

  storedScrollY = window.scrollY;
  storedPathname = window.location.pathname;

  if (document.documentElement) {
    document.documentElement.style.overscrollBehavior = 'none';
  }
  if (document.body) {
    document.body.style.overscrollBehavior = 'none';
  }

  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${storedScrollY}px`;
  document.body.style.width = '100%';
  document.body.style.left = '0';
  document.body.style.right = '0';

  window.addEventListener('scroll', preventScrollBehindModal, { passive: false, capture: true });
  window.addEventListener('wheel', preventScrollBehindModal, { passive: false, capture: true });
  window.addEventListener('touchmove', preventScrollBehindModal, { passive: false, capture: true });
}

function releaseBodyLock() {
  if (typeof window === 'undefined') return;

  window.removeEventListener('scroll', preventScrollBehindModal, { capture: true } as AddEventListenerOptions);
  window.removeEventListener('wheel', preventScrollBehindModal, { capture: true } as AddEventListenerOptions);
  window.removeEventListener('touchmove', preventScrollBehindModal, { capture: true } as AddEventListenerOptions);

  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.overscrollBehavior = '';
  if (document.documentElement) {
    document.documentElement.style.overscrollBehavior = '';
  }

  const currentPath = window.location.pathname;
  const shouldRestore = storedPathname !== null && storedPathname === currentPath;
  const y = shouldRestore ? storedScrollY : 0;
  storedScrollY = 0;
  storedPathname = null;
  window.scrollTo(0, y);
}

/**
 * Lock/unlock page scroll behind modals. Multiple callers stack safely (ref-counted).
 */
export function useLockScroll(isLocked: boolean) {
  useEffect(() => {
    if (typeof window === 'undefined' || !isLocked) return;

    lockDepth += 1;
    if (lockDepth === 1) {
      applyBodyLock();
    }

    return () => {
      lockDepth = Math.max(0, lockDepth - 1);
      if (lockDepth === 0) {
        releaseBodyLock();
      }
    };
  }, [isLocked]);
}
