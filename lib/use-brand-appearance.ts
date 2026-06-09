'use client';

import { useEffect, useState } from 'react';
import { readBrandBootstrap } from '@/lib/brand-bootstrap';

export type BrandAppearance = {
  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
  navActiveBg: string | null;
  navActiveText: string | null;
  navActiveBorder: string | null;
  navHoverText: string | null;
  navMobileActiveBg: string | null;
  fontNavEffect: string | null;
  fontMenuEffect: string | null;
  fontProductEffect: string | null;
  fontButtonEffect: string | null;
};

function appearanceFromBootstrap(): BrandAppearance | null {
  const b = readBrandBootstrap();
  if (!b) return null;
  return {
    navLogoUrl: b.navLogoUrl,
    heroLogoUrl: b.heroLogoUrl,
    appIconUrl: null,
    faviconUrl: null,
    navActiveBg: null,
    navActiveText: null,
    navActiveBorder: null,
    navHoverText: null,
    navMobileActiveBg: null,
    fontNavEffect: null,
    fontMenuEffect: null,
    fontProductEffect: null,
    fontButtonEffect: null,
  };
}

function applyAppearanceCssVars(appearance: BrandAppearance | null) {
  if (typeof document === 'undefined' || !appearance) return;
  const vars: Array<[string, string | null]> = [
    ['--theme-nav-active-bg', appearance.navActiveBg],
    ['--theme-nav-active-text', appearance.navActiveText],
    ['--theme-nav-active-border', appearance.navActiveBorder],
    ['--theme-nav-hover-text', appearance.navHoverText],
    ['--theme-nav-mobile-active-bg', appearance.navMobileActiveBg],
  ];
  for (const [key, value] of vars) {
    const clean = (value ?? '').trim();
    if (clean) {
      document.documentElement.style.setProperty(key, clean);
    } else {
      document.documentElement.style.removeProperty(key);
    }
  }
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
      navActiveBg: s.navActiveBg ?? null,
      navActiveText: s.navActiveText ?? null,
      navActiveBorder: s.navActiveBorder ?? null,
      navHoverText: s.navHoverText ?? null,
      navMobileActiveBg: s.navMobileActiveBg ?? null,
      fontNavEffect: s.fontNavEffect ?? null,
      fontMenuEffect: s.fontMenuEffect ?? null,
      fontProductEffect: s.fontProductEffect ?? null,
      fontButtonEffect: s.fontButtonEffect ?? null,
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
      applyAppearanceCssVars(v);
      setValue(v);
    });

    return () => {
      alive = false;
    };
  }, []);

  return value;
}

