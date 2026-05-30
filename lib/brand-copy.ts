export type BrandLocale = 'bg' | 'en' | 'ro';

export function normalizeBrandLocale(locale: string): BrandLocale {
  if (locale === 'en') return 'en';
  if (locale === 'ro') return 'ro';
  return 'bg';
}

/** Badge / label: event at our venue (e.g. „В Dunav“, „At Dunav“). */
export function atVenueLabel(locale: string, siteName: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') return `At ${siteName}`;
  if (loc === 'ro') return `La ${siteName}`;
  return `В ${siteName}`;
}

/** Short badge in modals — BG stays „При нас“, EN/RO use venue name. */
export function atVenueBadgeShort(locale: string, siteName: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'bg') return 'При нас';
  return atVenueLabel(loc, siteName);
}

/** Homepage / order events section intro. */
export function upcomingEventsIntro(locale: string, siteName: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') {
    return `Don't miss upcoming events — with us at ${siteName} or with our partners.`;
  }
  if (loc === 'ro') {
    return `Nu ratați evenimentele viitoare — la ${siteName} sau la partenerii noștri.`;
  }
  return `Не пропускайте предстоящи събития — при нас в ${siteName} или при наши партньори.`;
}

export function mapEmbedTitle(locale: string, siteName: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') return `Map — ${siteName}`;
  if (loc === 'ro') return `Hartă — ${siteName}`;
  return `Карта — ${siteName}`;
}

export function partnerEventBadge(locale: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') return 'Partner event';
  if (loc === 'ro') return 'Eveniment partener';
  return 'Партньорско събитие';
}

export function partnerEventBadgeShort(locale: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') return 'Partner';
  if (loc === 'ro') return 'Partener';
  return 'Партньорско';
}

/** Admin event form: external event checkbox. */
export function partnerEventNotAtVenue(locale: string, siteName: string): string {
  const loc = normalizeBrandLocale(locale);
  if (loc === 'en') return `Partner event (not at ${siteName})`;
  if (loc === 'ro') return `Eveniment partener (nu la ${siteName})`;
  return `Партньорско събитие (не в ${siteName})`;
}

/** Default internal event location placeholder (admin). */
export function defaultVenueLocationPlaceholder(siteName: string, city = 'Русе'): string {
  return `${siteName}, ${city}`;
}
