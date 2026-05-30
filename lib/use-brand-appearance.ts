'use client';

import { useEffect, useState } from 'react';
import { readBrandBootstrap } from '@/lib/brand-bootstrap';

export type BrandAppearance = {
  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
};

function appearanceFromBootstrap(): BrandAppearance | null {
  const b = readBrandBootstrap();
  if (!b) return null;
  return {
    navLogoUrl: b.navLogoUrl,
    heroLogoUrl: b.heroLogoUrl,
    appIconUrl: null,
    faviconUrl: null,
  };
}

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
  // Do not read window/bootstrap in useState — SSR and first client paint must match.
  const [value, setValue] = useState<BrandAppearance | null>(null);

  useEffect(() => {
    let alive = true;
    const boot = appearanceFromBootstrap();
    if (boot) {
      cached = boot;
      setValue(boot);
    } else if (cached) {
      setValue(cached);
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

