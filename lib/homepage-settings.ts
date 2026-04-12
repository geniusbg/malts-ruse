import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getDefaultBrandId } from './brand';

export interface HomepageStats {
  bg: { label: string; value: string }[];
  en: { label: string; value: string }[];
  ro: { label: string; value: string }[];
}

export interface HomepageOfferingCard {
  id: string;
  order: number;
  icon: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  descriptionBg: string;
  descriptionEn: string;
  descriptionRo: string;
  badgeBg: string;
  badgeEn: string;
  badgeRo: string;
  highlights: {
    bg: string[];
    en: string[];
    ro: string[];
  };
  isActive: boolean;
}

export interface HomepageSettings {
  id: string;
  sectionLabelBg: string;
  sectionLabelEn: string;
  sectionLabelRo: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  subtitleBg: string;
  subtitleEn: string;
  subtitleRo: string;
  descriptionBg: string;
  descriptionEn: string;
  descriptionRo: string;
  moodTextBg: string;
  moodTextEn: string;
  moodTextRo: string;
  offeringsNoteBg: string;
  offeringsNoteEn: string;
  offeringsNoteRo: string;
  stats: HomepageStats;
  ctaPrimaryBg: string;
  ctaPrimaryEn: string;
  ctaPrimaryRo: string;
  ctaSecondaryBg: string;
  ctaSecondaryEn: string;
  ctaSecondaryRo: string;
}

const DEFAULT_HOMEPAGE_SETTINGS: Omit<HomepageSettings, 'id' | 'stats'> = {
  sectionLabelBg: 'Предложения',
  sectionLabelEn: 'Experiences',
  sectionLabelRo: 'Experiențe',
  titleBg: 'Какво предлагаме',
  titleEn: 'What We Offer',
  titleRo: 'Ce oferim',
  subtitleBg: 'Открий нашето разнообразие',
  subtitleEn: 'Discover our variety',
  subtitleRo: 'Descoperă varietatea noastră',
  descriptionBg:
    'От сутрешно specialty кафе до вечерни авторски коктейли, вкусни сандвичи и ароматни шиши – създаваме настроение през целия ден.',
  descriptionEn:
    'From specialty coffee mornings to signature cocktail nights, delicious sandwiches and aromatic shisha – we craft moods for every hour.',
  descriptionRo:
    'De la cafea de dimineață până la cocktailuri seara, sandvișuri și shisha – creăm atmosfera potrivită oricând.',
  moodTextBg: 'Ястия • Напитки • Craft бира • Добро настроение',
  moodTextEn: 'Food • Drinks • Craft Beer • Good Times',
  moodTextRo: 'Food • Băuturi • Craft beer • Clipe faine',
  offeringsNoteBg: 'Заповядай за класика или открий нещо ново — при нас денят и вечерта имат вкус.',
  offeringsNoteEn: 'Come for the classics or discover something new — here, every hour has its own flavor.',
  offeringsNoteRo: 'Vino pentru clasice sau descoperă ceva nou — aici, fiecare oră are gustul ei.',
  ctaPrimaryBg: 'Разгледай менюто',
  ctaPrimaryEn: 'View the menu',
  ctaPrimaryRo: 'Vezi meniul',
  ctaSecondaryBg: 'Резервирай вечер',
  ctaSecondaryEn: 'Book an evening',
  ctaSecondaryRo: 'Rezervă o seară',
};

const DEFAULT_STATS: HomepageStats = {
  bg: [
    { label: 'Signature коктейли', value: '25+' },
    { label: 'Селектирани кафета', value: '12' },
    { label: 'Шиша вкуса', value: '18' },
  ],
  en: [
    { label: 'Signature cocktails', value: '25+' },
    { label: 'Curated coffees', value: '12' },
    { label: 'Shisha blends', value: '18' },
  ],
  ro: [
    { label: 'Cocktailuri signature', value: '25+' },
    { label: 'Cafea selectată', value: '12' },
    { label: 'Arome shisha', value: '18' },
  ],
};

const DEFAULT_STATS_JSON = DEFAULT_STATS as unknown as Prisma.InputJsonValue;

function normalizeStats(raw: unknown): HomepageStats {
  if (!raw || typeof raw !== 'object') return DEFAULT_STATS;
  const s = raw as Record<string, unknown> & { de?: HomepageStats['ro'] };
  const bg = (s.bg as HomepageStats['bg']) ?? DEFAULT_STATS.bg;
  const en = (s.en as HomepageStats['en']) ?? DEFAULT_STATS.en;
  let ro = (s.ro as HomepageStats['ro']) ?? undefined;
  if (!ro && s.de) ro = s.de;
  if (!ro) ro = DEFAULT_STATS.ro;
  return { bg, en, ro };
}

export async function getHomepageSettings(): Promise<HomepageSettings> {
  try {
    const brandId = await getDefaultBrandId();
    const settings = await prisma.homepageSettings.findUnique({
      where: { brandId },
    });

    if (settings) {
      return {
        id: settings.id,
        sectionLabelBg: settings.sectionLabelBg || DEFAULT_HOMEPAGE_SETTINGS.sectionLabelBg,
        sectionLabelEn: settings.sectionLabelEn || DEFAULT_HOMEPAGE_SETTINGS.sectionLabelEn,
        sectionLabelRo: settings.sectionLabelRo || DEFAULT_HOMEPAGE_SETTINGS.sectionLabelRo,
        titleBg: settings.titleBg || DEFAULT_HOMEPAGE_SETTINGS.titleBg,
        titleEn: settings.titleEn || DEFAULT_HOMEPAGE_SETTINGS.titleEn,
        titleRo: settings.titleRo || DEFAULT_HOMEPAGE_SETTINGS.titleRo,
        subtitleBg: settings.subtitleBg || DEFAULT_HOMEPAGE_SETTINGS.subtitleBg,
        subtitleEn: settings.subtitleEn || DEFAULT_HOMEPAGE_SETTINGS.subtitleEn,
        subtitleRo: settings.subtitleRo || DEFAULT_HOMEPAGE_SETTINGS.subtitleRo,
        descriptionBg: settings.descriptionBg || DEFAULT_HOMEPAGE_SETTINGS.descriptionBg,
        descriptionEn: settings.descriptionEn || DEFAULT_HOMEPAGE_SETTINGS.descriptionEn,
        descriptionRo: settings.descriptionRo || DEFAULT_HOMEPAGE_SETTINGS.descriptionRo,
        moodTextBg: settings.moodTextBg || DEFAULT_HOMEPAGE_SETTINGS.moodTextBg,
        moodTextEn: settings.moodTextEn || DEFAULT_HOMEPAGE_SETTINGS.moodTextEn,
        moodTextRo: settings.moodTextRo || DEFAULT_HOMEPAGE_SETTINGS.moodTextRo,
        offeringsNoteBg: settings.offeringsNoteBg || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteBg,
        offeringsNoteEn: settings.offeringsNoteEn || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteEn,
        offeringsNoteRo: settings.offeringsNoteRo || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteRo,
        stats: normalizeStats(settings.stats),
        ctaPrimaryBg: settings.ctaPrimaryBg || DEFAULT_HOMEPAGE_SETTINGS.ctaPrimaryBg,
        ctaPrimaryEn: settings.ctaPrimaryEn || DEFAULT_HOMEPAGE_SETTINGS.ctaPrimaryEn,
        ctaPrimaryRo: settings.ctaPrimaryRo || DEFAULT_HOMEPAGE_SETTINGS.ctaPrimaryRo,
        ctaSecondaryBg: settings.ctaSecondaryBg || DEFAULT_HOMEPAGE_SETTINGS.ctaSecondaryBg,
        ctaSecondaryEn: settings.ctaSecondaryEn || DEFAULT_HOMEPAGE_SETTINGS.ctaSecondaryEn,
        ctaSecondaryRo: settings.ctaSecondaryRo || DEFAULT_HOMEPAGE_SETTINGS.ctaSecondaryRo,
      };
    }

    const newSettings = await prisma.homepageSettings.create({
      data: {
        brandId,
        ...DEFAULT_HOMEPAGE_SETTINGS,
        stats: DEFAULT_STATS_JSON,
      },
    });

    return {
      id: newSettings.id,
      ...DEFAULT_HOMEPAGE_SETTINGS,
      stats: DEFAULT_STATS,
    };
  } catch (error) {
    console.error('Error fetching homepage settings:', error);
    return {
      id: '',
      ...DEFAULT_HOMEPAGE_SETTINGS,
      stats: DEFAULT_STATS,
    };
  }
}

export async function getHomepageOfferingCards(): Promise<HomepageOfferingCard[]> {
  try {
    const brandId = await getDefaultBrandId();
    const cards = await prisma.homepageOfferingCard.findMany({
      where: { brandId, isActive: true },
      orderBy: { order: 'asc' },
    });

    return cards.map((card) => {
      const h = card.highlights as { bg?: string[]; en?: string[]; ro?: string[]; de?: string[] };
      const highlights = {
        bg: h.bg ?? [],
        en: h.en ?? [],
        ro: h.ro ?? h.de ?? [],
      };
      return {
        id: card.id,
        order: card.order,
        icon: card.icon,
        titleBg: card.titleBg,
        titleEn: card.titleEn,
        titleRo: card.titleRo,
        descriptionBg: card.descriptionBg,
        descriptionEn: card.descriptionEn,
        descriptionRo: card.descriptionRo,
        badgeBg: card.badgeBg,
        badgeEn: card.badgeEn,
        badgeRo: card.badgeRo,
        highlights,
        isActive: card.isActive,
      };
    });
  } catch (error) {
    console.error('Error fetching homepage offering cards:', error);
    return [];
  }
}

export async function updateHomepageSettings(data: Partial<HomepageSettings>): Promise<HomepageSettings> {
  try {
    const brandId = await getDefaultBrandId();
    const existing = await prisma.homepageSettings.findUnique({
      where: { brandId },
    });

    if (existing) {
      const updated = await prisma.homepageSettings.update({
        where: { id: existing.id },
        data: {
          sectionLabelBg: data.sectionLabelBg ?? existing.sectionLabelBg,
          sectionLabelEn: data.sectionLabelEn ?? existing.sectionLabelEn,
          sectionLabelRo: data.sectionLabelRo ?? existing.sectionLabelRo,
          titleBg: data.titleBg ?? existing.titleBg,
          titleEn: data.titleEn ?? existing.titleEn,
          titleRo: data.titleRo ?? existing.titleRo,
          subtitleBg: data.subtitleBg ?? existing.subtitleBg,
          subtitleEn: data.subtitleEn ?? existing.subtitleEn,
          subtitleRo: data.subtitleRo ?? existing.subtitleRo,
          descriptionBg: data.descriptionBg ?? existing.descriptionBg,
          descriptionEn: data.descriptionEn ?? existing.descriptionEn,
          descriptionRo: data.descriptionRo ?? existing.descriptionRo,
          moodTextBg: data.moodTextBg ?? existing.moodTextBg,
          moodTextEn: data.moodTextEn ?? existing.moodTextEn,
          moodTextRo: data.moodTextRo ?? existing.moodTextRo,
          offeringsNoteBg: data.offeringsNoteBg ?? existing.offeringsNoteBg,
          offeringsNoteEn: data.offeringsNoteEn ?? existing.offeringsNoteEn,
          offeringsNoteRo: data.offeringsNoteRo ?? existing.offeringsNoteRo,
          stats: data.stats
            ? (data.stats as unknown as Prisma.InputJsonValue)
            : (existing.stats as Prisma.InputJsonValue),
          ctaPrimaryBg: data.ctaPrimaryBg ?? existing.ctaPrimaryBg,
          ctaPrimaryEn: data.ctaPrimaryEn ?? existing.ctaPrimaryEn,
          ctaPrimaryRo: data.ctaPrimaryRo ?? existing.ctaPrimaryRo,
          ctaSecondaryBg: data.ctaSecondaryBg ?? existing.ctaSecondaryBg,
          ctaSecondaryEn: data.ctaSecondaryEn ?? existing.ctaSecondaryEn,
          ctaSecondaryRo: data.ctaSecondaryRo ?? existing.ctaSecondaryRo,
        },
      });

      return {
        id: updated.id,
        sectionLabelBg: updated.sectionLabelBg,
        sectionLabelEn: updated.sectionLabelEn,
        sectionLabelRo: updated.sectionLabelRo,
        titleBg: updated.titleBg,
        titleEn: updated.titleEn,
        titleRo: updated.titleRo,
        subtitleBg: updated.subtitleBg,
        subtitleEn: updated.subtitleEn,
        subtitleRo: updated.subtitleRo,
        descriptionBg: updated.descriptionBg,
        descriptionEn: updated.descriptionEn,
        descriptionRo: updated.descriptionRo,
        moodTextBg: updated.moodTextBg,
        moodTextEn: updated.moodTextEn,
        moodTextRo: updated.moodTextRo,
        offeringsNoteBg: updated.offeringsNoteBg || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteBg,
        offeringsNoteEn: updated.offeringsNoteEn || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteEn,
        offeringsNoteRo: updated.offeringsNoteRo || DEFAULT_HOMEPAGE_SETTINGS.offeringsNoteRo,
        stats: normalizeStats(updated.stats),
        ctaPrimaryBg: updated.ctaPrimaryBg,
        ctaPrimaryEn: updated.ctaPrimaryEn,
        ctaPrimaryRo: updated.ctaPrimaryRo,
        ctaSecondaryBg: updated.ctaSecondaryBg,
        ctaSecondaryEn: updated.ctaSecondaryEn,
        ctaSecondaryRo: updated.ctaSecondaryRo,
      };
    }

    const created = await prisma.homepageSettings.create({
      data: {
        brandId,
        ...DEFAULT_HOMEPAGE_SETTINGS,
        stats: data.stats ? (data.stats as unknown as Prisma.InputJsonValue) : DEFAULT_STATS_JSON,
      },
    });

    return {
      id: created.id,
      ...DEFAULT_HOMEPAGE_SETTINGS,
      stats: normalizeStats(created.stats),
    };
  } catch (error) {
    console.error('Error updating homepage settings:', error);
    throw error;
  }
}
