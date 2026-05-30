import { getDefaultBrand } from '@/lib/brand';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';
import { resolveSiteShortName } from '@/lib/brand-defaults';

/**
 * Sync fallback: NEXT_PUBLIC_SITE_NAME or generic label (no hardcoded tenant name).
 */
export function getSiteDisplayName(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_NAME : undefined;
  const trimmed = raw?.trim();
  if (trimmed) return trimmed;
  return 'App';
}

/** Server: brand name from DB + branding settings. */
export async function resolveSiteDisplayName(): Promise<string> {
  const [appearance, brand] = await Promise.all([
    getBrandAppearanceSettings().catch(() => null),
    getDefaultBrand().catch(() => null),
  ]);
  return resolveSiteShortName(appearance, brand?.name ?? null);
}

/** Admin dashboard / login hero line, localized. */
export function getAdminPanelHeading(locale: string, siteName: string): string {
  switch (locale) {
    case 'en':
      return `Admin – ${siteName} management`;
    case 'ro':
      return `Admin – Gestionarea ${siteName}`;
    default:
      return `Admin - Управление на ${siteName}`;
  }
}

/** Client: bootstrap from root layout, then optional env fallback. */
export function getSiteDisplayNameFromBootstrap(): string {
  if (typeof window === 'undefined') return getSiteDisplayName();
  const w = window.__BRAND_LOGOS__;
  const fromBootstrap = typeof w?.siteShortName === 'string' ? w.siteShortName.trim() : '';
  if (fromBootstrap) return fromBootstrap;
  return getSiteDisplayName();
}
