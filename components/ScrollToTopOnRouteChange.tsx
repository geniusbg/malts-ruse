'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function ScrollToTopOnRouteChange() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPathname = useRef<string | null>(null);

  useEffect(() => {
    // Skip first render (don't fight initial browser position)
    if (lastPathname.current === null) {
      lastPathname.current = pathname;
      return;
    }

    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;

    // If navigation includes a hash, let the browser scroll to the anchor.
    if (typeof window !== 'undefined' && window.location.hash) return;

    // Deep-links (e.g. home → menu with ?product=...) handle their own scrolling.
    // Avoid a "jump to top then jump again" UX.
    if (searchParams?.get('product') || searchParams?.get('category')) return;

    // Ensure we scroll after the new route paints.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    });
  }, [pathname, searchParams]);

  return null;
}

