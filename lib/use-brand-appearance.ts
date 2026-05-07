'use client';

import { useEffect, useState } from 'react';

export type BrandAppearance = {
  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
};

let cached: BrandAppearance | null = null;
let inFlight: Promise<BrandAppearance | null> | null = null;

async function fetchAppearance(): Promise<BrandAppearance | null> {
  try {
    const res = await fetch('/api/brand-appearance', { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    const s = data?.settings ?? null;
    if (!s) return null;
    return {
      navLogoUrl: s.navLogoUrl ?? null,
      heroLogoUrl: s.heroLogoUrl ?? null,
      appIconUrl: s.appIconUrl ?? null,
      faviconUrl: s.faviconUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function useBrandAppearance(): BrandAppearance | null {
  const [value, setValue] = useState<BrandAppearance | null>(cached);

  useEffect(() => {
    let alive = true;
    if (cached) {
      setValue(cached);
      return () => {
        alive = false;
      };
    }

    inFlight =
      inFlight ??
      fetchAppearance().then((v) => {
        cached = v;
        inFlight = null;
        return v;
      });

    void inFlight.then((v) => {
      if (!alive) return;
      setValue(v);
    });

    return () => {
      alive = false;
    };
  }, []);

  return value;
}

