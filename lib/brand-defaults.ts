import type { BrandAppearanceSettings } from '@/lib/brand-appearance-settings';

/** Deployment fallbacks via .env — no hardcoded tenant name. */
export function envDefaultNavLogo(): string {
  return (process.env.BRAND_DEFAULT_NAV_LOGO || '').trim();
}

export function envDefaultHeroLogo(): string {
  return (process.env.BRAND_DEFAULT_HERO_LOGO || '').trim();
}

export function envSiteTitle(): string {
  return (process.env.SITE_TITLE || '').trim();
}

export function envSiteShortName(): string {
  return (process.env.SITE_SHORT_NAME || process.env.SITE_TITLE || '').trim();
}

export function envSiteDescription(): string {
  return (process.env.SITE_DESCRIPTION || '').trim();
}

export function resolveNavLogoUrl(
  ...sources: Array<string | null | undefined>
): string {
  for (const s of sources) {
    const v = (s ?? '').trim();
    if (v) return v;
  }
  return envDefaultNavLogo();
}

export function resolveHeroLogoUrl(
  ...sources: Array<string | null | undefined>
): string {
  for (const s of sources) {
    const v = (s ?? '').trim();
    if (v) return v;
  }
  return envDefaultHeroLogo();
}

export function resolveSiteTitle(
  appearance: Pick<BrandAppearanceSettings, 'siteTitle'> | null | undefined,
  brandName?: string | null
): string {
  const fromSettings = (appearance?.siteTitle ?? '').trim();
  if (fromSettings) return fromSettings;
  const fromEnv = envSiteTitle();
  if (fromEnv) return fromEnv;
  const fromBrand = (brandName ?? '').trim();
  if (fromBrand) return fromBrand;
  return 'App';
}

export function resolveSiteShortName(
  appearance: Pick<BrandAppearanceSettings, 'siteShortName' | 'siteTitle'> | null | undefined,
  brandName?: string | null
): string {
  const fromSettings = (appearance?.siteShortName ?? '').trim();
  if (fromSettings) return fromSettings;
  const fromEnv = envSiteShortName();
  if (fromEnv) return fromEnv;
  const fromBrand = (brandName ?? '').trim();
  if (fromBrand) return fromBrand;
  return resolveSiteTitle(appearance, brandName);
}

export function resolveSiteDescription(
  appearance: Pick<BrandAppearanceSettings, 'siteDescription'> | null | undefined,
  shortName: string
): string {
  const fromSettings = (appearance?.siteDescription ?? '').trim();
  if (fromSettings) return fromSettings;
  const fromEnv = envSiteDescription();
  if (fromEnv) return fromEnv;
  return `${shortName} – меню, поръчки и събития.`;
}
