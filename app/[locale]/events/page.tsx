import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { getDefaultBrandId } from '@/lib/brand';
import { eventCardImageUrl } from '@/lib/event-images';

export const revalidate = 0;

const copy = {
  bg: {
    title: 'Събития',
    subtitle: 'Предстоящи събития',
    empty: 'Няма предстоящи събития в момента',
    partner: 'Партньорско събитие',
    atMalts: 'В Malts',
    learnMore: 'Научи повече →',
  },
  en: {
    title: 'Events',
    subtitle: 'Upcoming events',
    empty: 'No upcoming events at the moment',
    partner: 'Partner event',
    atMalts: 'At Malts',
    learnMore: 'Learn more →',
  },
  ro: {
    title: 'Evenimente',
    subtitle: 'Evenimente viitoare',
    empty: 'Nu există evenimente viitoare momentan',
    partner: 'Eveniment partener',
    atMalts: 'La Malts',
    learnMore: 'Află mai multe →',
  },
} as const;

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: loc } = await params;
  const locale = loc === 'en' || loc === 'ro' ? loc : 'bg';
  const t = copy[locale];

  const brandId = await getDefaultBrandId();

  const events = await prisma.event.findMany({
    where: {
      brandId,
      eventDate: { gte: new Date() },
      isPublished: true,
    },
    orderBy: [{ isExternal: 'asc' }, { eventDate: 'asc' }],
  });

  return (
    <main className="min-h-screen malts-surface text-[var(--malts-ink)] pt-24 md:pt-28 pb-16">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)] text-center mb-4 malts-display">{t.title}</h1>
        <p className="text-xl malts-muted text-center mb-12">{t.subtitle}</p>

        {events.length === 0 ? (
          <div className="text-center malts-muted py-20">
            <p className="text-xl">{t.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event: {
              id: string;
              imageUrl: string | null;
              imageCardUrl?: string | null;
              imageDetailUrl?: string | null;
              isExternal: boolean;
              titleBg: string;
              titleEn: string;
              titleRo: string;
              descriptionBg: string;
              descriptionEn: string;
              descriptionRo: string;
              location: string | null;
              locationBg: string | null;
              locationEn: string | null;
              locationRo: string | null;
              eventDate: Date;
            }) => {
              const eventTitle =
                locale === 'bg' ? event.titleBg : locale === 'en' ? event.titleEn : event.titleRo;
              const eventDesc =
                locale === 'bg'
                  ? event.descriptionBg
                  : locale === 'en'
                    ? event.descriptionEn
                    : event.descriptionRo;
              const eventLocation = event.isExternal
                ? locale === 'bg'
                  ? event.locationBg || event.location
                  : locale === 'en'
                    ? event.locationEn || event.location
                    : event.locationRo || event.location
                : event.location;
              const eventDate = new Date(event.eventDate);
              const cardImageSrc = eventCardImageUrl(event);

              return (
                <Link
                  key={event.id}
                  href={`/${loc}/events/${event.id}`}
                  className="malts-card rounded-2xl overflow-hidden hover:border-[var(--malts-accent)]/40 hover:shadow-md transition-all block group shadow-sm"
                >
                  {cardImageSrc && (
                    <div className="relative h-64 w-full overflow-hidden bg-[var(--malts-inset)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cardImageSrc}
                        alt={eventTitle}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      {event.isExternal ? (
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-700 rounded-full text-sm border border-blue-500/20">
                          {t.partner}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-[var(--malts-accent-tint)] text-[var(--malts-accent)] rounded-full text-sm font-medium border border-[var(--malts-accent-tint-border)]">
                          {t.atMalts}
                        </span>
                      )}
                    </div>

                    <h3 className="text-2xl font-bold text-[var(--malts-ink)] mb-2">{eventTitle}</h3>

                    <div className="flex items-center gap-2 malts-muted mb-3">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <span>
                        {eventDate.toLocaleDateString(locale === 'ro' ? 'ro-RO' : locale === 'en' ? 'en-GB' : 'bg-BG', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 malts-muted mb-4">
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span>{eventLocation}</span>
                    </div>

                    <p className="malts-muted mb-4 line-clamp-3">{eventDesc}</p>

                    <div className="mt-4 text-center">
                      <span className="text-[var(--malts-accent)] font-semibold group-hover:underline transition-colors">
                        {t.learnMore}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
