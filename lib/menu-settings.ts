import { prisma } from './prisma';
import { getDefaultBrandId } from './brand';

export interface MenuSettings {
  id: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  subtitleBg: string;
  subtitleEn: string;
  subtitleRo: string;
  backgroundImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_SETTINGS = {
  titleBg: 'Нашето Меню',
  titleEn: 'Our Menu',
  titleRo: 'Meniul nostru',
  subtitleBg: 'Открийте селекцията ни от напитки и деликатеси',
  subtitleEn: 'Discover our selection of drinks and delicacies',
  subtitleRo: 'Descoperă selecția noastră de băuturi și delicatese',
  backgroundImageUrl: null as string | null,
};

export async function getMenuSettings(): Promise<MenuSettings | null> {
  try {
    const brandId = await getDefaultBrandId();
    const settings = await prisma.menuSettings.findUnique({
      where: { brandId },
    });
    return settings;
  } catch (error) {
    console.error('Error fetching menu settings:', error);
    return null;
  }
}

export async function updateMenuSettings(data: {
  titleBg?: string;
  titleEn?: string;
  titleRo?: string;
  subtitleBg?: string;
  subtitleEn?: string;
  subtitleRo?: string;
  backgroundImageUrl?: string | null;
}): Promise<MenuSettings> {
  const brandId = await getDefaultBrandId();
  const existing = await prisma.menuSettings.findUnique({
    where: { brandId },
  });

  if (existing) {
    return await prisma.menuSettings.update({
      where: { id: existing.id },
      data: {
        titleBg: data.titleBg ?? existing.titleBg,
        titleEn: data.titleEn ?? existing.titleEn,
        titleRo: data.titleRo ?? existing.titleRo,
        subtitleBg: data.subtitleBg ?? existing.subtitleBg,
        subtitleEn: data.subtitleEn ?? existing.subtitleEn,
        subtitleRo: data.subtitleRo ?? existing.subtitleRo,
        backgroundImageUrl:
          data.backgroundImageUrl !== undefined ? data.backgroundImageUrl : existing.backgroundImageUrl,
      },
    });
  }
  return await prisma.menuSettings.create({
    data: {
      brandId,
      titleBg: data.titleBg ?? DEFAULT_SETTINGS.titleBg,
      titleEn: data.titleEn ?? DEFAULT_SETTINGS.titleEn,
      titleRo: data.titleRo ?? DEFAULT_SETTINGS.titleRo,
      subtitleBg: data.subtitleBg ?? DEFAULT_SETTINGS.subtitleBg,
      subtitleEn: data.subtitleEn ?? DEFAULT_SETTINGS.subtitleEn,
      subtitleRo: data.subtitleRo ?? DEFAULT_SETTINGS.subtitleRo,
      backgroundImageUrl: data.backgroundImageUrl ?? DEFAULT_SETTINGS.backgroundImageUrl,
    },
  });
}
