import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { normalizeGoogleFontEffect, sanitizeGoogleFontsCssUrl } from '@/lib/brand-fonts';

export type BrandAppearanceSettings = {
  id: string;
  brandId: string;

  paper: string | null;
  ink: string | null;
  muted: string | null;
  subtle: string | null;
  card: string | null;
  cardHover: string | null;
  inset: string | null;
  hairline: string | null;
  hoverBorder: string | null;

  accent: string | null;
  accentHover: string | null;
  accentContrast: string | null;
  accentContrastHover: string | null;
  heroGlow: string | null;
  heroMoodBg: string | null;
  homepageAccent: string | null;

  menuActiveBg: string | null;
  menuActiveText: string | null;
  menuActiveBorder: string | null;
  menuInactiveBg: string | null;
  menuInactiveText: string | null;
  menuInactiveBorder: string | null;
  menuHoverBg: string | null;
  menuHoverBorder: string | null;

  navActiveBg: string | null;
  navActiveText: string | null;
  navActiveBorder: string | null;
  navHoverText: string | null;
  navMobileActiveBg: string | null;

  btnSecondaryBg: string | null;
  btnSecondaryText: string | null;
  btnSecondaryBorder: string | null;
  btnSecondaryBgHover: string | null;
  btnSecondaryTextHover: string | null;

  success: string | null;
  warning: string | null;
  danger: string | null;
  dangerHover: string | null;
  dangerContrast: string | null;
  dangerContrastHover: string | null;
  info: string | null;

  themeColor: string | null;
  siteTitle: string | null;
  siteShortName: string | null;
  siteDescription: string | null;

  googleFontsCssUrl: string | null;
  fontDisplayFamily: string | null;
  fontButtonsFamily: string | null;
  fontNavFamily: string | null;
  fontBodyFamily: string | null;
  fontDisplayEffect: string | null;
  fontMoodEffect: string | null;
  fontNavEffect: string | null;
  fontMenuEffect: string | null;
  fontProductEffect: string | null;
  fontButtonEffect: string | null;

  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;

  createdAt: Date;
  updatedAt: Date;
};

function sanitize(row: any): BrandAppearanceSettings {
  return {
    id: String(row.id),
    brandId: String(row.brandId),

    paper: row.paper ?? null,
    ink: row.ink ?? null,
    muted: row.muted ?? null,
    subtle: row.subtle ?? null,
    card: row.card ?? null,
    cardHover: row.cardHover ?? null,
    inset: row.inset ?? null,
    hairline: row.hairline ?? null,
    hoverBorder: row.hoverBorder ?? null,

    accent: row.accent ?? null,
    accentHover: row.accentHover ?? null,
    accentContrast: row.accentContrast ?? null,
    accentContrastHover: row.accentContrastHover ?? null,
    heroGlow: row.heroGlow ?? null,
    heroMoodBg: row.heroMoodBg ?? null,
    homepageAccent: row.homepageAccent ?? null,

    menuActiveBg: row.menuActiveBg ?? null,
    menuActiveText: row.menuActiveText ?? null,
    menuActiveBorder: row.menuActiveBorder ?? null,
    menuInactiveBg: row.menuInactiveBg ?? null,
    menuInactiveText: row.menuInactiveText ?? null,
    menuInactiveBorder: row.menuInactiveBorder ?? null,
    menuHoverBg: row.menuHoverBg ?? null,
    menuHoverBorder: row.menuHoverBorder ?? null,

    navActiveBg: row.navActiveBg ?? null,
    navActiveText: row.navActiveText ?? null,
    navActiveBorder: row.navActiveBorder ?? null,
    navHoverText: row.navHoverText ?? null,
    navMobileActiveBg: row.navMobileActiveBg ?? null,

    btnSecondaryBg: row.btnSecondaryBg ?? null,
    btnSecondaryText: row.btnSecondaryText ?? null,
    btnSecondaryBorder: row.btnSecondaryBorder ?? null,
    btnSecondaryBgHover: row.btnSecondaryBgHover ?? null,
    btnSecondaryTextHover: row.btnSecondaryTextHover ?? null,

    success: row.success ?? null,
    warning: row.warning ?? null,
    danger: row.danger ?? null,
    dangerHover: row.dangerHover ?? null,
    dangerContrast: row.dangerContrast ?? null,
    dangerContrastHover: row.dangerContrastHover ?? null,
    info: row.info ?? null,

    themeColor: row.themeColor ?? null,
    siteTitle: row.siteTitle ?? null,
    siteShortName: row.siteShortName ?? null,
    siteDescription: row.siteDescription ?? null,

    googleFontsCssUrl: row.googleFontsCssUrl ?? null,
    fontDisplayFamily: row.fontDisplayFamily ?? null,
    fontButtonsFamily: row.fontButtonsFamily ?? null,
    fontNavFamily: row.fontNavFamily ?? null,
    fontBodyFamily: row.fontBodyFamily ?? null,
    fontDisplayEffect: row.fontDisplayEffect ?? null,
    fontMoodEffect: row.fontMoodEffect ?? null,
    fontNavEffect: row.fontNavEffect ?? null,
    fontMenuEffect: row.fontMenuEffect ?? null,
    fontProductEffect: row.fontProductEffect ?? null,
    fontButtonEffect: row.fontButtonEffect ?? null,

    navLogoUrl: row.navLogoUrl ?? null,
    heroLogoUrl: row.heroLogoUrl ?? null,
    appIconUrl: row.appIconUrl ?? null,
    faviconUrl: row.faviconUrl ?? null,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const getBrandAppearanceSettings = cache(async function getBrandAppearanceSettings(): Promise<BrandAppearanceSettings | null> {
  const brandId = await getDefaultBrandId();
  const row = await prisma.brandAppearanceSettings.findUnique({ where: { brandId } });
  return row ? sanitize(row) : null;
});

export async function getOrCreateBrandAppearanceSettings(): Promise<BrandAppearanceSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.brandAppearanceSettings.findUnique({ where: { brandId } });
  if (existing) return sanitize(existing);

  const created = await prisma.brandAppearanceSettings.create({
    data: { brandId },
  });
  return sanitize(created);
}

type UpdateDto = Partial<
  Pick<
    BrandAppearanceSettings,
    | 'paper'
    | 'ink'
    | 'muted'
    | 'subtle'
    | 'card'
    | 'cardHover'
    | 'inset'
    | 'hairline'
    | 'hoverBorder'
    | 'accent'
    | 'accentHover'
    | 'accentContrast'
    | 'accentContrastHover'
    | 'heroGlow'
    | 'heroMoodBg'
    | 'homepageAccent'
    | 'menuActiveBg'
    | 'menuActiveText'
    | 'menuActiveBorder'
    | 'menuInactiveBg'
    | 'menuInactiveText'
    | 'menuInactiveBorder'
    | 'menuHoverBg'
    | 'menuHoverBorder'
    | 'navActiveBg'
    | 'navActiveText'
    | 'navActiveBorder'
    | 'navHoverText'
    | 'navMobileActiveBg'
    | 'btnSecondaryBg'
    | 'btnSecondaryText'
    | 'btnSecondaryBorder'
    | 'btnSecondaryBgHover'
    | 'btnSecondaryTextHover'
    | 'success'
    | 'warning'
    | 'danger'
    | 'dangerHover'
    | 'dangerContrast'
    | 'dangerContrastHover'
    | 'info'
    | 'themeColor'
    | 'siteTitle'
    | 'siteShortName'
    | 'siteDescription'
    | 'googleFontsCssUrl'
    | 'fontDisplayFamily'
    | 'fontButtonsFamily'
    | 'fontNavFamily'
    | 'fontBodyFamily'
    | 'fontDisplayEffect'
    | 'fontMoodEffect'
    | 'fontNavEffect'
    | 'fontMenuEffect'
    | 'fontProductEffect'
    | 'fontButtonEffect'
    | 'navLogoUrl'
    | 'heroLogoUrl'
    | 'appIconUrl'
    | 'faviconUrl'
  >
>;

function cleanText(v: any): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function updateBrandAppearanceSettings(dto: UpdateDto): Promise<BrandAppearanceSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.brandAppearanceSettings.findUnique({ where: { brandId } });
  if (existing) {
    const updated = await (prisma.brandAppearanceSettings as any).update({
      where: { id: existing.id },
      data: {
        paper: cleanText(dto.paper),
        ink: cleanText(dto.ink),
        muted: cleanText(dto.muted),
        subtle: cleanText(dto.subtle),
        card: cleanText(dto.card),
        cardHover: cleanText(dto.cardHover),
        inset: cleanText(dto.inset),
        hairline: cleanText(dto.hairline),
        hoverBorder: cleanText(dto.hoverBorder),

        accent: cleanText(dto.accent),
        accentHover: cleanText(dto.accentHover),
        accentContrast: cleanText(dto.accentContrast),
        accentContrastHover: cleanText(dto.accentContrastHover),
        heroGlow: cleanText(dto.heroGlow),
        heroMoodBg: cleanText(dto.heroMoodBg),
        homepageAccent: cleanText(dto.homepageAccent),

        menuActiveBg: cleanText(dto.menuActiveBg),
        menuActiveText: cleanText(dto.menuActiveText),
        menuActiveBorder: cleanText(dto.menuActiveBorder),
        menuInactiveBg: cleanText(dto.menuInactiveBg),
        menuInactiveText: cleanText(dto.menuInactiveText),
        menuInactiveBorder: cleanText(dto.menuInactiveBorder),
        menuHoverBg: cleanText(dto.menuHoverBg),
        menuHoverBorder: cleanText(dto.menuHoverBorder),

        navActiveBg: cleanText(dto.navActiveBg),
        navActiveText: cleanText(dto.navActiveText),
        navActiveBorder: cleanText(dto.navActiveBorder),
        navHoverText: cleanText(dto.navHoverText),
        navMobileActiveBg: cleanText(dto.navMobileActiveBg),

        btnSecondaryBg: cleanText(dto.btnSecondaryBg),
        btnSecondaryText: cleanText(dto.btnSecondaryText),
        btnSecondaryBorder: cleanText(dto.btnSecondaryBorder),
        btnSecondaryBgHover: cleanText(dto.btnSecondaryBgHover),
        btnSecondaryTextHover: cleanText(dto.btnSecondaryTextHover),

        success: cleanText(dto.success),
        warning: cleanText(dto.warning),
        danger: cleanText(dto.danger),
        dangerHover: cleanText(dto.dangerHover),
        dangerContrast: cleanText(dto.dangerContrast),
        dangerContrastHover: cleanText(dto.dangerContrastHover),
        info: cleanText(dto.info),

        themeColor: cleanText(dto.themeColor),
        siteTitle: cleanText(dto.siteTitle),
        siteShortName: cleanText(dto.siteShortName),
        siteDescription: cleanText(dto.siteDescription),

        googleFontsCssUrl: sanitizeGoogleFontsCssUrl(cleanText(dto.googleFontsCssUrl) ?? undefined),
        fontDisplayFamily: cleanText(dto.fontDisplayFamily),
        fontButtonsFamily: cleanText(dto.fontButtonsFamily),
        fontNavFamily: cleanText(dto.fontNavFamily),
        fontBodyFamily: cleanText(dto.fontBodyFamily),
        fontDisplayEffect: normalizeGoogleFontEffect(cleanText(dto.fontDisplayEffect)),
        fontMoodEffect: normalizeGoogleFontEffect(cleanText(dto.fontMoodEffect)),
        fontNavEffect: normalizeGoogleFontEffect(cleanText(dto.fontNavEffect)),
        fontMenuEffect: normalizeGoogleFontEffect(cleanText(dto.fontMenuEffect)),
        fontProductEffect: normalizeGoogleFontEffect(cleanText(dto.fontProductEffect)),
        fontButtonEffect: normalizeGoogleFontEffect(cleanText(dto.fontButtonEffect)),

        navLogoUrl: cleanText(dto.navLogoUrl),
        heroLogoUrl: cleanText(dto.heroLogoUrl),
        appIconUrl: cleanText(dto.appIconUrl),
        faviconUrl: cleanText(dto.faviconUrl),
      },
    });
    return sanitize(updated);
  }

  const created = await (prisma.brandAppearanceSettings as any).create({
    data: {
      brandId,
      paper: cleanText(dto.paper),
      ink: cleanText(dto.ink),
      muted: cleanText(dto.muted),
      subtle: cleanText(dto.subtle),
      card: cleanText(dto.card),
      cardHover: cleanText(dto.cardHover),
      inset: cleanText(dto.inset),
      hairline: cleanText(dto.hairline),
      hoverBorder: cleanText(dto.hoverBorder),

      accent: cleanText(dto.accent),
      accentHover: cleanText(dto.accentHover),
      accentContrast: cleanText(dto.accentContrast),
      accentContrastHover: cleanText(dto.accentContrastHover),
      heroGlow: cleanText(dto.heroGlow),
      heroMoodBg: cleanText(dto.heroMoodBg),
      homepageAccent: cleanText(dto.homepageAccent),

      menuActiveBg: cleanText(dto.menuActiveBg),
      menuActiveText: cleanText(dto.menuActiveText),
      menuActiveBorder: cleanText(dto.menuActiveBorder),
      menuInactiveBg: cleanText(dto.menuInactiveBg),
      menuInactiveText: cleanText(dto.menuInactiveText),
      menuInactiveBorder: cleanText(dto.menuInactiveBorder),
      menuHoverBg: cleanText(dto.menuHoverBg),
      menuHoverBorder: cleanText(dto.menuHoverBorder),

      navActiveBg: cleanText(dto.navActiveBg),
      navActiveText: cleanText(dto.navActiveText),
      navActiveBorder: cleanText(dto.navActiveBorder),
      navHoverText: cleanText(dto.navHoverText),
      navMobileActiveBg: cleanText(dto.navMobileActiveBg),

      btnSecondaryBg: cleanText(dto.btnSecondaryBg),
      btnSecondaryText: cleanText(dto.btnSecondaryText),
      btnSecondaryBorder: cleanText(dto.btnSecondaryBorder),
      btnSecondaryBgHover: cleanText(dto.btnSecondaryBgHover),
      btnSecondaryTextHover: cleanText(dto.btnSecondaryTextHover),

      success: cleanText(dto.success),
      warning: cleanText(dto.warning),
      danger: cleanText(dto.danger),
      dangerHover: cleanText(dto.dangerHover),
      dangerContrast: cleanText(dto.dangerContrast),
      dangerContrastHover: cleanText(dto.dangerContrastHover),
      info: cleanText(dto.info),

      themeColor: cleanText(dto.themeColor),
      siteTitle: cleanText(dto.siteTitle),
      siteShortName: cleanText(dto.siteShortName),
      siteDescription: cleanText(dto.siteDescription),

      googleFontsCssUrl: sanitizeGoogleFontsCssUrl(cleanText(dto.googleFontsCssUrl) ?? undefined),
      fontDisplayFamily: cleanText(dto.fontDisplayFamily),
      fontButtonsFamily: cleanText(dto.fontButtonsFamily),
      fontNavFamily: cleanText(dto.fontNavFamily),
      fontBodyFamily: cleanText(dto.fontBodyFamily),
      fontDisplayEffect: normalizeGoogleFontEffect(cleanText(dto.fontDisplayEffect)),
      fontMoodEffect: normalizeGoogleFontEffect(cleanText(dto.fontMoodEffect)),
      fontNavEffect: normalizeGoogleFontEffect(cleanText(dto.fontNavEffect)),
      fontMenuEffect: normalizeGoogleFontEffect(cleanText(dto.fontMenuEffect)),
      fontProductEffect: normalizeGoogleFontEffect(cleanText(dto.fontProductEffect)),
      fontButtonEffect: normalizeGoogleFontEffect(cleanText(dto.fontButtonEffect)),

      navLogoUrl: cleanText(dto.navLogoUrl),
      heroLogoUrl: cleanText(dto.heroLogoUrl),
      appIconUrl: cleanText(dto.appIconUrl),
      faviconUrl: cleanText(dto.faviconUrl),
    },
  });
  return sanitize(created);
}

