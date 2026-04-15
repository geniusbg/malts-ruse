import { prisma } from './prisma';
import { getDefaultBrandId } from './brand';

export interface PromotionsUiSettings {
  id: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
}

const DEFAULT_PROMOTIONS_UI_SETTINGS: Omit<PromotionsUiSettings, 'id'> = {
  titleBg: 'Промоция',
  titleEn: 'Promotion',
  titleRo: 'Promoție',
};

export async function getPromotionsUiSettings(): Promise<PromotionsUiSettings> {
  const brandId = await getDefaultBrandId();
  const row = await prisma.promotionsUiSettings.findUnique({
    where: { brandId },
  });
  if (row) {
    return {
      id: row.id,
      titleBg: row.titleBg || DEFAULT_PROMOTIONS_UI_SETTINGS.titleBg,
      titleEn: row.titleEn || DEFAULT_PROMOTIONS_UI_SETTINGS.titleEn,
      titleRo: row.titleRo || DEFAULT_PROMOTIONS_UI_SETTINGS.titleRo,
    };
  }

  const created = await prisma.promotionsUiSettings.create({
    data: {
      brandId,
      ...DEFAULT_PROMOTIONS_UI_SETTINGS,
    },
  });

  return {
    id: created.id,
    titleBg: created.titleBg,
    titleEn: created.titleEn,
    titleRo: created.titleRo,
  };
}

export async function updatePromotionsUiSettings(
  data: Partial<Omit<PromotionsUiSettings, 'id'>>
): Promise<PromotionsUiSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.promotionsUiSettings.findUnique({ where: { brandId } });

  if (existing) {
    const updated = await prisma.promotionsUiSettings.update({
      where: { id: existing.id },
      data: {
        titleBg: data.titleBg ?? existing.titleBg,
        titleEn: data.titleEn ?? existing.titleEn,
        titleRo: data.titleRo ?? existing.titleRo,
      },
    });
    return { id: updated.id, titleBg: updated.titleBg, titleEn: updated.titleEn, titleRo: updated.titleRo };
  }

  const created = await prisma.promotionsUiSettings.create({
    data: {
      brandId,
      titleBg: data.titleBg ?? DEFAULT_PROMOTIONS_UI_SETTINGS.titleBg,
      titleEn: data.titleEn ?? DEFAULT_PROMOTIONS_UI_SETTINGS.titleEn,
      titleRo: data.titleRo ?? DEFAULT_PROMOTIONS_UI_SETTINGS.titleRo,
    },
  });

  return { id: created.id, titleBg: created.titleBg, titleEn: created.titleEn, titleRo: created.titleRo };
}

