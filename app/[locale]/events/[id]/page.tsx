import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDateForLocale } from '@/lib/date-utils';
import { eventDetailImageUrl } from '@/lib/event-images';
import ScrollToTopOnMount from '@/components/ScrollToTopOnMount';

export const revalidate = 0;

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const event = await prisma.event.findUnique({
    where: { id }
  });

  if (!event) {
    notFound();
  }

  const eventTitle = locale === 'bg' ? event.titleBg : locale === 'en' ? event.titleEn : event.titleRo;
  const eventDesc = locale === 'bg' ? event.descriptionBg : locale === 'en' ? event.descriptionEn : event.descriptionRo;
  const eventLocation = event.isExternal 
    ? (locale === 'bg' ? (event.locationBg || event.location) : 
       locale === 'en' ? (event.locationEn || event.location) : 
       (event.locationRo || event.location))
    : event.location;
  const eventDate = new Date(event.eventDate);
  const detailImageSrc = eventDetailImageUrl(event);

  const backLabel =
    locale === 'bg' ? 'Назад към събития' : locale === 'en' ? 'Back to events' : 'Înapoi la evenimente';

  return (
    <main className="min-h-screen malts-surface text-[var(--malts-ink)] pt-16 md:pt-20 pb-16">
      <ScrollToTopOnMount />
      <div className="container mx-auto max-w-5xl px-4">
        <Link
          href={`/${locale}/events`}
          className="inline-flex items-center gap-2 malts-muted hover:text-[var(--malts-accent)] mb-8 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>

        <div className="malts-card rounded-2xl overflow-hidden shadow-sm">
          {/* Event Image */}
          {detailImageSrc && (
            <div className="relative flex w-full items-center justify-center bg-[var(--malts-inset)] px-2 py-4 md:px-4 md:py-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detailImageSrc}
                alt={eventTitle}
                loading="eager"
                decoding="async"
                className="mx-auto block h-auto max-h-[min(88vh,960px)] w-auto max-w-full object-contain object-center"
              />
            </div>
          )}

          {/* Event Content */}
          <div className="p-8 md:p-12">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-6">
              {event.isExternal ? (
                <span className="px-4 py-2 bg-[var(--malts-inset)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] rounded-full text-sm font-medium">
                  {locale === 'bg' ? 'Партньорско събитие' : locale === 'en' ? 'Partner Event' : 'Eveniment partener'}
                </span>
              ) : (
                <span className="px-4 py-2 bg-[var(--malts-accent-tint)] text-[var(--malts-accent)] border border-[var(--malts-accent-tint-border)] rounded-full text-sm font-medium">
                  {locale === 'bg' ? 'В Malts' : locale === 'en' ? 'At Malts' : 'La Malts'}
                </span>
              )}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)] mb-8">
              {eventTitle}
            </h1>

            {/* Date & Location */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 mb-8">
              <div className="flex items-center gap-3 text-[var(--malts-ink)]">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm malts-muted">
                    {locale === 'bg' ? 'Дата и час' : locale === 'en' ? 'Date & time' : 'Dată și oră'}
                  </p>
                  <p className="font-semibold text-[var(--malts-ink)]">
                    {formatDateForLocale(eventDate, locale as 'bg' | 'en' | 'ro')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[var(--malts-ink)]">
                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-sm malts-muted">
                    {locale === 'bg' ? 'Локация' : locale === 'en' ? 'Location' : 'Locație'}
                  </p>
                  <p className="font-semibold text-[var(--malts-ink)]">{eventLocation}</p>
                </div>
              </div>
            </div>

            <div className="prose prose-stone max-w-none mb-8">
              <p className="text-lg text-[var(--malts-ink)] leading-relaxed whitespace-pre-line">
                {eventDesc}
              </p>
            </div>

            {/* External Event Info */}
            {event.isExternal && (event.externalUrl || event.contactInfo) && (
              <div className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-xl p-6 mb-8">
                <h3 className="text-xl font-bold text-[var(--malts-ink)] mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-[var(--malts-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {locale === 'bg'
                    ? 'Информация за събитието'
                    : locale === 'en'
                      ? 'Event information'
                      : 'Informații despre eveniment'}
                </h3>
                
                {event.externalUrl && (
                  <div className="mb-4 flex items-center gap-3">
                    <svg className="w-5 h-5 text-[var(--malts-accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <div>
                      <p className="malts-muted text-sm">{locale === 'bg' ? 'Уебсайт' : locale === 'en' ? 'Website' : 'Site web'}</p>
                      <a 
                        href={event.externalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[var(--malts-accent)] hover:opacity-90 underline break-all font-medium"
                      >
                        {event.externalUrl}
                      </a>
                    </div>
                  </div>
                )}
                
                {event.contactInfo && (
                  <div className="space-y-3">
                    {event.contactInfo.split('\n').map((line: string, idx: number) => {
                      if (line.includes('Телефон:')) {
                        const phone = line.replace('Телефон:', '').trim();
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-green-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <div>
                              <p className="malts-muted text-sm">{locale === 'bg' ? 'Телефон' : locale === 'en' ? 'Phone' : 'Telefon'}</p>
                              <a href={`tel:${phone}`} className="text-[var(--malts-ink)] font-medium hover:text-[var(--malts-accent)]">{phone}</a>
                            </div>
                          </div>
                        );
                      }
                      if (line.includes('Email:')) {
                        const email = line.replace('Email:', '').trim();
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-[var(--malts-accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <div>
                              <p className="malts-muted text-sm">Email</p>
                              <a href={`mailto:${email}`} className="text-[var(--malts-ink)] font-medium hover:text-[var(--malts-accent)]">{email}</a>
                            </div>
                          </div>
                        );
                      }
                      if (line.includes('Facebook:')) {
                        const fb = line.replace('Facebook:', '').trim();
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-[var(--malts-accent)] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                            <div>
                              <p className="malts-muted text-sm">Facebook</p>
                              <a href={`https://facebook.com${fb}`} target="_blank" rel="noopener noreferrer" className="text-[var(--malts-ink)] font-medium hover:text-[var(--malts-accent)]">{fb}</a>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-12">
              {event.isExternal ? (
                <>
                  {event.externalUrl && (
                    <a
                      href={event.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-8 py-4 bg-[var(--malts-accent)] hover:opacity-95 text-[var(--malts-accent-contrast)] rounded-xl font-semibold transition-all text-center flex items-center justify-center gap-2 shadow-sm"
                    >
                      {locale === 'bg' ? 'Към събитието' : locale === 'en' ? 'Go to event' : 'Către eveniment'}
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <Link
                    href={`/${locale}/events`}
                    className="px-8 py-4 malts-btn-secondary rounded-xl font-semibold transition-all text-center shadow-sm"
                  >
                    {locale === 'bg' ? 'Всички събития' : locale === 'en' ? 'All events' : 'Toate evenimentele'}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href={`/${locale}/menu`}
                    className="px-8 py-4 bg-[var(--malts-accent)] hover:opacity-95 text-[var(--malts-accent-contrast)] rounded-xl font-semibold transition-all text-center shadow-sm"
                  >
                    {locale === 'bg' ? 'Виж менюто' : locale === 'en' ? 'View menu' : 'Vezi meniul'}
                  </Link>
                  <Link
                    href={`/${locale}/contact`}
                    className="px-8 py-4 malts-btn-secondary rounded-xl font-semibold transition-all text-center shadow-sm"
                  >
                    {locale === 'bg' ? 'Резервация' : locale === 'en' ? 'Reservation' : 'Rezervare'}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


