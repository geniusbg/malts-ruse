import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { buildSiteUrl } from '@/lib/site-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = ['', '/menu', '/events', '/contact'];
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const route of staticRoutes) {
      entries.push({
        url: buildSiteUrl(`/${locale}${route}`),
        lastModified: now,
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(locales.map((l) => [l, buildSiteUrl(`/${l}${route}`)])),
        },
      });
    }
  }

  try {
    const brandId = await getDefaultBrandId();
    const events = await prisma.event.findMany({
      where: { brandId, isPublished: true },
      select: { id: true, updatedAt: true, eventDate: true },
      orderBy: { eventDate: 'desc' },
    });

    for (const event of events) {
      for (const locale of locales) {
        entries.push({
          url: buildSiteUrl(`/${locale}/events/${event.id}`),
          lastModified: event.updatedAt ?? event.eventDate,
          changeFrequency: 'weekly',
          priority: 0.7,
          alternates: {
            languages: Object.fromEntries(
              locales.map((l) => [l, buildSiteUrl(`/${l}/events/${event.id}`)])
            ),
          },
        });
      }
    }
  } catch (error) {
    console.error('sitemap events load failed:', error);
  }

  return entries;
}
