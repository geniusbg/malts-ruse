import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { sanitizeGoogleFontsCssUrl } from '@/lib/brand-fonts';

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

  accent: string | null;
  accentHover: string | null;
  accentContrast: string | null;
  accentContrastHover: string | null;

  success: string | null;
  warning: string | null;
  danger: string | null;
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

    accent: row.accent ?? null,
    accentHover: row.accentHover ?? null,
    accentContrast: row.accentContrast ?? null,
    accentContrastHover: row.accentContrastHover ?? null,

    success: row.success ?? null,
    warning: row.warning ?? null,
    danger: row.danger ?? null,
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

    navLogoUrl: row.navLogoUrl ?? null,
    heroLogoUrl: row.heroLogoUrl ?? null,
    appIconUrl: row.appIconUrl ?? null,
    faviconUrl: row.faviconUrl ?? null,

    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getBrandAppearanceSettings(): Promise<BrandAppearanceSettings | null> {
  const brandId = await getDefaultBrandId();
  const row = await prisma.brandAppearanceSettings.findUnique({ where: { brandId } });
  return row ? sanitize(row) : null;
}

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
    | 'accent'
    | 'accentHover'
    | 'accentContrast'
    | 'accentContrastHover'
    | 'success'
    | 'warning'
    | 'danger'
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
    const updated = await prisma.brandAppearanceSettings.update({
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

        accent: cleanText(dto.accent),
        accentHover: cleanText(dto.accentHover),
        accentContrast: cleanText(dto.accentContrast),
        accentContrastHover: cleanText(dto.accentContrastHover),

        success: cleanText(dto.success),
        warning: cleanText(dto.warning),
        danger: cleanText(dto.danger),
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

        navLogoUrl: cleanText(dto.navLogoUrl),
        heroLogoUrl: cleanText(dto.heroLogoUrl),
        appIconUrl: cleanText(dto.appIconUrl),
        faviconUrl: cleanText(dto.faviconUrl),
      },
    });
    return sanitize(updated);
  }

  const created = await prisma.brandAppearanceSettings.create({
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

      accent: cleanText(dto.accent),
      accentHover: cleanText(dto.accentHover),
      accentContrast: cleanText(dto.accentContrast),
      accentContrastHover: cleanText(dto.accentContrastHover),

      success: cleanText(dto.success),
      warning: cleanText(dto.warning),
      danger: cleanText(dto.danger),
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

      navLogoUrl: cleanText(dto.navLogoUrl),
      heroLogoUrl: cleanText(dto.heroLogoUrl),
      appIconUrl: cleanText(dto.appIconUrl),
      faviconUrl: cleanText(dto.faviconUrl),
    },
  });
  return sanitize(created);
}

