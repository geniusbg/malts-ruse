'use client';

import { useEffect } from 'react';

export default function ScrollToTopOnMount() {
  useEffect(() => {
    // Next.js App Router sometimes preserves scroll on client navigations.
    // Force top for detail pages opened from lists.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return null;
}

