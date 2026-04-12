import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: loc } = await params;
  const locale = loc === 'en' || loc === 'ro' ? loc : 'bg';

  const workingHours = await prisma.workingHours.findMany({

    orderBy: { dayOfWeek: 'asc' },

  });



  const daysMap = new Map(workingHours.map((wh) => [wh.dayOfWeek, wh]));

  const allDays = Array.from({ length: 7 }, (_, i) => {

    const existing = daysMap.get(i);

    return (

      existing || {

        dayOfWeek: i,

        isOpen: true,

        openTime: '10:00',

        closeTime: '00:00',

      }

    );

  });



  const dayNames = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб'];



  return (

    <main className="min-h-screen malts-surface text-[var(--malts-ink)] pt-24 md:pt-28 pb-16">

      <div className="container mx-auto px-4">

        <h1 className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)] text-center mb-12 malts-display">Контакти</h1>



        <div className="max-w-4xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <div className="malts-card rounded-2xl p-8 shadow-sm">

              <div className="mb-6 -mt-4 flex justify-center">
                <Link href={`/${locale}`} className="inline-block max-w-full">
                  <Image
                    src="/malts-logo-nav.webp"
                    alt="Malt's"
                    width={400}
                    height={331}
                    sizes="(max-width: 768px) 280px, 360px"
                    className="malts-brand-filter h-auto w-full max-w-[min(100%,280px)] object-contain sm:max-w-[320px]"
                  />
                </Link>
              </div>



              <div className="space-y-4">

                <div className="flex items-start gap-4">

                  <svg

                    className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0"

                    fill="none"

                    stroke="currentColor"

                    viewBox="0 0 24 24"

                  >

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

                  <div>

                    <p className="text-[var(--malts-ink)] font-semibold">Адрес</p>

                    <p className="malts-muted">ул. &quot;Александровска&quot; 97</p>

                    <p className="malts-muted">Русе, България</p>

                  </div>

                </div>



                <div className="flex items-start gap-4">

                  <svg

                    className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0"

                    fill="none"

                    stroke="currentColor"

                    viewBox="0 0 24 24"

                  >

                    <path

                      strokeLinecap="round"

                      strokeLinejoin="round"

                      strokeWidth={2}

                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"

                    />

                  </svg>

                  <div>

                    <p className="text-[var(--malts-ink)] font-semibold">Телефон</p>

                    <a

                      href="tel:+359898536542"

                      className="text-[var(--malts-ink)] hover:text-[var(--malts-accent)] transition-colors"

                    >

                      089 853 6542

                    </a>

                  </div>

                </div>



                <div className="flex items-start gap-4">

                  <svg className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0" fill="currentColor" viewBox="0 0 24 24">

                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />

                  </svg>

                  <div>

                    <p className="text-[var(--malts-ink)] font-semibold">Instagram</p>

                    <a
                      href="https://instagram.com/"

                      target="_blank"

                      rel="noopener noreferrer"

                      className="text-[var(--malts-ink)] hover:text-[var(--malts-accent)]"

                    >

                      (очаква се линк)

                    </a>

                  </div>

                </div>



                <div className="flex items-start gap-4">

                  <svg className="w-6 h-6 text-[var(--malts-subtle)] mt-1 shrink-0" fill="currentColor" viewBox="0 0 24 24">

                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />

                  </svg>

                  <div>

                    <p className="text-[var(--malts-ink)] font-semibold">Facebook</p>

                    <a
                      href="https://www.facebook.com/"

                      target="_blank"

                      rel="noopener noreferrer"

                      className="text-[var(--malts-ink)] hover:text-[var(--malts-accent)]"

                    >

                      (очаква се линк)

                    </a>

                  </div>

                </div>

              </div>

            </div>



            <div className="malts-card rounded-2xl p-2 overflow-hidden h-full min-h-[280px] shadow-sm">

              <iframe

                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2889.8!2d25.95!3d43.85!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDPCsDUxJzAwLjAiTiAyNcKwNTcnMDAuMCJF!5e0!3m2!1sen!2sbg!4v1234567890"

                width="100%"

                height="100%"

                style={{ border: 0 }}

                allowFullScreen

                loading="lazy"

                title="Карта — Malts"

                className="rounded-xl min-h-[260px]"

              />

            </div>

          </div>



          <div className="malts-card rounded-2xl p-8 mt-8 shadow-sm">

            <h3 className="text-2xl font-bold text-[var(--malts-ink)] mb-4">Работно време</h3>

            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 text-center">

              {allDays.map((day) => (

                <div key={day.dayOfWeek} className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-lg p-3">

                  <p className="malts-muted text-sm mb-1">{dayNames[day.dayOfWeek]}</p>

                  {day.isOpen && day.openTime && day.closeTime ? (

                    <p className="text-[var(--malts-ink)] font-semibold text-sm">

                      {day.openTime} - {day.closeTime}

                    </p>

                  ) : (

                    <p className="malts-muted font-semibold">Затворено</p>

                  )}

                </div>

              ))}

            </div>

          </div>

        </div>

      </div>

    </main>

  );

}

