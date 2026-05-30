'use client';

import { useEffect, useState } from 'react';
import { getSiteDisplayName } from '@/lib/site-display-name';

/** Brand display name: same initial value on server + client, then bootstrap/API. */
export function useSiteDisplayName(initialName?: string): string {
  const [name, setName] = useState(initialName?.trim() || getSiteDisplayName());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window.__BRAND_LOGOS__;
    const fromBootstrap = typeof w?.siteShortName === 'string' ? w.siteShortName.trim() : '';
    if (fromBootstrap) setName(fromBootstrap);

    void fetch('/api/brand-appearance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const s = data?.settings;
        const next = (s?.siteShortName || s?.siteTitle || '').trim();
        if (next) setName(next);
      })
      .catch(() => {});
  }, []);

  return name;
}
