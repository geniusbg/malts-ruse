import type { BrandAppearanceSettings } from '@/lib/brand-appearance-settings';

export type BrandLogoBootstrap = {
  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  siteShortName: string | null;
};

declare global {
  interface Window {
    __BRAND_LOGOS__?: BrandLogoBootstrap;
  }
}

export function logosFromAppearance(
  appearance:
    | Pick<BrandAppearanceSettings, 'navLogoUrl' | 'heroLogoUrl' | 'siteShortName'>
    | null
    | undefined,
  siteShortName?: string | null
): BrandLogoBootstrap {
  const nav = (appearance?.navLogoUrl ?? '').trim();
  const hero = (appearance?.heroLogoUrl ?? '').trim();
  const short =
    (appearance?.siteShortName ?? '').trim() || (siteShortName ?? '').trim();
  return {
    navLogoUrl: nav || null,
    heroLogoUrl: hero || null,
    siteShortName: short || null,
  };
}

/** Safe JSON for inline script (XSS hardening). */
export function serializeBrandBootstrap(logos: BrandLogoBootstrap): string {
  return JSON.stringify(logos).replace(/</g, '\\u003c');
}

export function readBrandBootstrap(): BrandLogoBootstrap | null {
  if (typeof window === 'undefined') return null;
  const w = window.__BRAND_LOGOS__;
  if (!w || typeof w !== 'object') return null;
  const nav = typeof w.navLogoUrl === 'string' ? w.navLogoUrl.trim() : '';
  const hero = typeof w.heroLogoUrl === 'string' ? w.heroLogoUrl.trim() : '';
  const short = typeof w.siteShortName === 'string' ? w.siteShortName.trim() : '';
  if (!nav && !hero && !short) return null;
  return {
    navLogoUrl: nav || null,
    heroLogoUrl: hero || null,
    siteShortName: short || null,
  };
}
