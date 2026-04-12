import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';
import { getLocationSettings } from '@/lib/location-settings';
import { getHomepageSettings, getHomepageOfferingCards } from '@/lib/homepage-settings';
import ChefsPicksCarousel from '@/components/ChefsPicksCarousel';
import OfferingCardIcon from '@/components/OfferingCardIcon';
import { formatDateForLocale } from '@/lib/date-utils';
import { eventCardImageUrl } from '@/lib/event-images';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export default async function HomePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const brandId = await getDefaultBrandId();

  // Fetch next 3 upcoming published events (same tenant as admin API)
  const events = await prisma.event.findMany({
    where: {
      brandId,
      eventDate: { gte: new Date() },
      isPublished: true
    },
    // В Malts първо, после партньорски; вътре в групата — по дата.
    orderBy: [{ isExternal: 'asc' }, { eventDate: 'asc' }],
    take: 3
  });

  // Fetch working hours
  const workingHours = await prisma.workingHours.findMany({
    orderBy: { dayOfWeek: 'asc' }
  });

  // Fetch location settings
  const locationSettings = await getLocationSettings();

  // Fetch homepage settings and cards
  const [homepageSettings, homepageCards] = await Promise.all([
    getHomepageSettings(),
    getHomepageOfferingCards()
  ]);

  // Fetch featured products for Chef's Picks
  const featuredProducts = await prisma.product.findMany({
    where: {
      isFeatured: true,
      isHidden: false,
      isAvailable: true
    },
    include: {
      category: {
        select: {
          nameBg: true,
          nameEn: true,
          nameRo: true,
          slug: true
        }
      }
    },
    orderBy: { order: 'asc' },
    take: 8
  });

  // Get current day
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todayHours = workingHours.find(wh => wh.dayOfWeek === currentDay);

  const localeContent = {
    bg: {
      sectionLabel: 'Предложения',
      title: 'Какво предлагаме',
      subtitle: 'Открий нашето разнообразие',
      description:
        'От сутрешно specialty кафе до вечерни авторски коктейли, вкусни сандвичи и ароматни шиши – създаваме настроение през целия ден.',
      stats: [
        { label: 'Signature коктейли', value: '25+' },
        { label: 'Селектирани кафета', value: '12' },
        { label: 'Шиша вкуса', value: '18' }
      ],
      cards: [
        {
          icon: '🍸',
          title: 'Коктейли - Миксове за пиене, миксове за слушане',
          description: 'Премиум спиртни напитки, първокласни сиропи и много фантазия. В бара може да играете карти, морски шах и други настолни игри. Разполагаме и със сепаре с телевизор за гледане на срещи.',
          highlights: ['House Margarita', 'Smoky Negroni', 'Espresso Martini'],
          badge: 'Signature'
        },
        {
          icon: '☕',
          title: 'Кафе & дневен бар',
          description: 'Costa & Richard селекция, филтърни методи и изкушения с десерт.',
          highlights: ['Flat White', 'Cold Brew Tonic', 'Affogato'],
          badge: locale === 'bg' ? 'Дневен ритуал' : locale === 'en' ? 'Daily ritual' : 'Ritual zilnic'
        },
        {
          icon: '🥪',
          title: 'Сандвичи',
          description: 'Вкусни сандвичи с 3 вида сос – перфектна комбинация за всеки момент.',
          highlights: ['Класически', 'Специални', 'Вегетариански'],
          badge: locale === 'bg' ? 'Дневно меню' : locale === 'en' ? 'Day menu' : 'Tagesmenü'
        },
        {
          icon: '💨',
          title: 'Shisha Lounge',
          description: 'Балансирани смеси, охлаждащи аксесоари и релаксираща атмосфера.',
          highlights: ['Double Apple', 'Grape Mint', 'Blue Ice'],
          badge: locale === 'bg' ? 'Вечерно настроение' : locale === 'en' ? 'Night mood' : 'Abendstimmung'
        }
      ],
      ctaPrimary: 'Разгледай менюто',
      ctaSecondary: 'Резервирай вечер'
    },
    en: {
      sectionLabel: 'Experiences',
      title: 'What We Offer',
      subtitle: 'Discover our variety',
      description:
        'From specialty coffee mornings to signature cocktail nights, delicious sandwiches and aromatic shisha – we craft moods for every hour. In the bar you can play cards, backgammon and other board games. We also have a separate area with a TV for watching matches.',
      stats: [
        { label: 'Signature cocktails', value: '25+' },
        { label: 'Curated coffees', value: '12' },
        { label: 'Shisha blends', value: '18' }
      ],
      cards: [
        {
          icon: '🍸',
          title: 'Cocktails - Mixes for drinking, mixes for listening',
          description: 'Premium spirits, first-class syrups and bold imagination. In the bar you can play cards, backgammon and other board games. We also have a separate area with a TV for watching matches.',
          highlights: ['House Margarita', 'Smoky Negroni', 'Espresso Martini'],
          badge: 'Signature'
        },
        {
          icon: '☕',
          title: 'Coffee & Day Bar',
          description: 'Costa & Richard beans, filter methods and dessert pairings.',
          highlights: ['Flat White', 'Cold Brew Tonic', 'Affogato'],
          badge: locale === 'bg' ? 'Дневен ритуал' : locale === 'en' ? 'Daily ritual' : 'Ritual zilnic'
        },
        {
          icon: '🥪',
          title: 'Sandwiches',
          description: 'Delicious sandwiches with 3 types of sauces – perfect combination for any moment.',
          highlights: ['Classic', 'Special', 'Vegetarian'],
          badge: locale === 'bg' ? 'Дневно меню' : locale === 'en' ? 'Day menu' : 'Tagesmenü'
        },
        {
          icon: '💨',
          title: 'Shisha Lounge',
          description: 'Balanced blends, cooling accessories and a relaxed vibe.',
          highlights: ['Double Apple', 'Grape Mint', 'Blue Ice'],
          badge: locale === 'bg' ? 'Вечерно настроение' : locale === 'en' ? 'Night mood' : 'Abendstimmung'
        }
      ],
      ctaPrimary: 'View the menu',
      ctaSecondary: 'Book an evening'
    },
    ro: {
      sectionLabel: 'Experiențe',
      title: 'Ce oferim',
      subtitle: 'Descoperă varietatea noastră',
      description:
        'De la cafea de dimineață la cocktailuri seara, sandvișuri și shisha – creăm atmosfera potrivită oricând.',
      stats: [
        { label: 'Cocktailuri signature', value: '25+' },
        { label: 'Cafea selectată', value: '12' },
        { label: 'Arome shisha', value: '18' }
      ],
      cards: [
        {
          icon: '🍸',
          title: 'Cocktailuri – mixuri de băut, mixuri de ascultat',
          description: 'Spirtoase premium, siropuri alese și imaginație. La bar poți juca cărți, table și alte jocuri. Avem și zonă cu televizor pentru meciuri.',
          highlights: ['House Margarita', 'Smoky Negroni', 'Espresso Martini'],
          badge: 'Signature'
        },
        {
          icon: '☕',
          title: 'Cafea & bar de zi',
          description: 'Costa & Richard, metode filter și deserturi.',
          highlights: ['Flat White', 'Cold Brew Tonic', 'Affogato'],
          badge: locale === 'bg' ? 'Дневен ритуал' : locale === 'en' ? 'Daily ritual' : 'Ritual zilnic'
        },
        {
          icon: '🥪',
          title: 'Sandvișuri',
          description: 'Sandvișuri cu 3 feluri de sosuri – combinație potrivită oricând.',
          highlights: ['Clasic', 'Special', 'Vegetarian'],
          badge: locale === 'bg' ? 'Дневно меню' : locale === 'en' ? 'Day menu' : 'Meniu de zi'
        },
        {
          icon: '💨',
          title: 'Shisha Lounge',
          description: 'Amestecuri echilibrate, accesorii răcoritoare și atmosferă relaxată.',
          highlights: ['Double Apple', 'Grape Mint', 'Blue Ice'],
          badge: locale === 'bg' ? 'Вечерно настроение' : locale === 'en' ? 'Night mood' : 'Atmosferă de seară'
        }
      ],
      ctaPrimary: 'Vezi meniul',
      ctaSecondary: 'Rezervă o seară'
    }
  } as const;

  // Use database settings if available, otherwise fallback to hardcoded
  // Check if we have settings in DB (by checking if homepageSettings has an id)
  const useDbSettings = !!homepageSettings.id;
  
  const offerings = localeContent[locale as 'bg' | 'en' | 'ro'] ?? localeContent.bg;
  
  // Get section header from DB or fallback
  const sectionLabel = useDbSettings 
    ? (locale === 'bg' ? homepageSettings.sectionLabelBg : locale === 'en' ? homepageSettings.sectionLabelEn : homepageSettings.sectionLabelRo)
    : offerings.sectionLabel;
  const offeringsTitle = useDbSettings
    ? (locale === 'bg' ? homepageSettings.titleBg : locale === 'en' ? homepageSettings.titleEn : homepageSettings.titleRo)
    : offerings.title;
  const offeringsSubtitle = useDbSettings
    ? (locale === 'bg' ? homepageSettings.subtitleBg : locale === 'en' ? homepageSettings.subtitleEn : homepageSettings.subtitleRo)
    : offerings.subtitle;
  const offeringsDescription = useDbSettings
    ? (locale === 'bg' ? homepageSettings.descriptionBg : locale === 'en' ? homepageSettings.descriptionEn : homepageSettings.descriptionRo)
    : offerings.description;
  const moodText = useDbSettings
    ? (locale === 'bg' ? homepageSettings.moodTextBg : locale === 'en' ? homepageSettings.moodTextEn : homepageSettings.moodTextRo)
    : (locale === 'bg' 
      ? 'Бар, кафе, сандвичи, шиша – перфектната атмосфера за деня и вечерта' 
      : locale === 'en' 
      ? 'Bar, coffee, sandwiches, shisha – the perfect atmosphere for day and evening'
      : 'Bar, cafea, sandvișuri, shisha – atmosfera potrivită zi și seară');

  const offeringsNote = useDbSettings
    ? (locale === 'bg' ? homepageSettings.offeringsNoteBg : locale === 'en' ? homepageSettings.offeringsNoteEn : homepageSettings.offeringsNoteRo)
    : (locale === 'bg'
      ? 'Заповядай за класика или открий нещо ново — при нас денят и вечерта имат вкус.'
      : locale === 'en'
      ? 'Come for the classics or discover something new — here, every hour has its own flavor.'
      : 'Vino pentru clasice sau descoperă ceva nou — aici, fiecare oră are gustul ei.');
  
  // Get stats from DB or fallback
  const stats = useDbSettings 
    ? (locale === 'bg' ? homepageSettings.stats.bg : locale === 'en' ? homepageSettings.stats.en : homepageSettings.stats.ro)
    : offerings.stats;
  
  // Get cards from DB or fallback
  const cards = useDbSettings
    ? homepageCards.map(card => ({
        icon: card.icon,
        title: locale === 'bg' ? card.titleBg : locale === 'en' ? card.titleEn : card.titleRo,
        description: locale === 'bg' ? card.descriptionBg : locale === 'en' ? card.descriptionEn : card.descriptionRo,
        highlights: locale === 'bg' ? card.highlights.bg : locale === 'en' ? card.highlights.en : card.highlights.ro,
        badge: locale === 'bg' ? card.badgeBg : locale === 'en' ? card.badgeEn : card.badgeRo
      }))
    : offerings.cards;
  
  const ctaPrimary = useDbSettings
    ? (locale === 'bg' ? homepageSettings.ctaPrimaryBg : locale === 'en' ? homepageSettings.ctaPrimaryEn : homepageSettings.ctaPrimaryRo)
    : offerings.ctaPrimary;
  const ctaSecondary = useDbSettings
    ? (locale === 'bg' ? homepageSettings.ctaSecondaryBg : locale === 'en' ? homepageSettings.ctaSecondaryEn : homepageSettings.ctaSecondaryRo)
    : offerings.ctaSecondary;

  return (
    <main className="min-h-screen malts-surface">
      {/* Hero: overflow-visible so logo drop-shadow / glow is not clipped */}
      <div className="relative overflow-visible">
        <div className="relative container mx-auto px-4 pt-8 pb-14 md:pt-12 md:pb-20">
          <div className="text-center">
            {/* Logo — glow clearance; леко нагоре и по-малък от преди */}
            <div className="-mt-1 mb-6 flex justify-center px-4 py-3 animate-fade-in md:-mt-2 md:mb-10 md:py-5">
              <Image
                src="/malts-logo-hero.webp"
                alt="Malt's"
                width={834}
                height={812}
                sizes="(max-width: 768px) 90vw, 440px"
                className="malts-hero-logo h-auto w-full max-w-[min(100%,300px)] md:max-w-[440px]"
                priority
              />
            </div>

            {/* Tagline — red frame + glow; един ред (размерът се смалява леко на тесен екран) */}
            <div className="mb-8 md:mb-12 flex justify-center px-3 py-6 md:py-8">
              <p className="malts-mood-banner inline-block whitespace-nowrap text-center text-[clamp(0.8rem,3.1vw,2.25rem)] text-[#f5f0e6] font-normal tracking-wide malts-display px-8 py-4 md:px-14 md:py-5">
                {moodText}
              </p>
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-10 md:mb-16">
              <Link 
                href={`/${locale}/menu`}
                className="group relative px-8 py-4 malts-btn-primary rounded-xl font-bold text-lg transition-all duration-300 overflow-hidden w-full sm:w-auto"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  🍸 {locale === 'bg' ? 'Виж менюто' : locale === 'en' ? 'View Menu' : 'Vezi meniul'}
                </span>
              </Link>
              <Link 
                href={`/${locale}/events`}
                className="px-8 py-4 malts-btn-secondary rounded-xl font-bold text-lg border-2 transition-all duration-300 w-full sm:w-auto"
              >
                🎉 {locale === 'bg' ? 'Събития' : locale === 'en' ? 'Events' : 'Evenimente'}
              </Link>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              {/* Location with enhanced styling */}
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--malts-card)]/80 border border-[var(--malts-hairline)] rounded-full text-[var(--malts-ink)] backdrop-blur-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium">
                  {locale === 'bg' ? locationSettings.addressBg :
                   locale === 'en' ? locationSettings.addressEn :
                   locationSettings.addressRo}
                </span>
              </div>
              
              {/* Today's working hours */}
              {todayHours && todayHours.isOpen && todayHours.openTime && todayHours.closeTime && (
                <div className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--malts-card)]/80 border border-[var(--malts-hairline)] rounded-full text-[var(--malts-ink)] backdrop-blur-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">
                    {locale === 'bg' ? 'Днес' : locale === 'en' ? 'Today' : 'Astăzi'}: {todayHours.openTime} - {todayHours.closeTime}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-20">

        {/* Offerings Section */}
        <section className="mt-16 md:mt-24 relative">
          <div className="relative overflow-hidden malts-card px-6 py-12 md:px-16 md:py-16">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 right-0 w-72 h-72 bg-[var(--malts-accent-tint)] blur-3xl opacity-60"></div>
              <div className="absolute -bottom-10 left-10 w-56 h-56 bg-[rgba(22,101,52,0.10)] blur-3xl opacity-60"></div>
            </div>

            <div className="relative flex flex-col items-center text-center max-w-4xl mx-auto">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-base md:text-lg lg:text-xl font-semibold uppercase tracking-[0.18em] md:tracking-[0.22em] text-[var(--malts-accent)] bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] malts-section-label-font">
                {sectionLabel}
              </span>
              <h2 className="mt-6 text-3xl md:text-5xl font-semibold tracking-tight malts-display">
                {offeringsTitle}
              </h2>
              <p className="mt-4 text-lg md:text-xl malts-muted malts-display-secondary">
                {offeringsSubtitle}
              </p>
              <p className="mt-6 text-base md:text-lg malts-muted leading-relaxed max-w-3xl">
                {offeringsDescription}
              </p>
              <p className="mt-8 text-lg md:text-xl font-light italic max-w-3xl malts-muted">
                {offeringsNote}
              </p>
            </div>

            <div className="relative mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map(stat => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-6 py-5 text-center"
                >
                  <div className="text-3xl md:text-4xl font-semibold">{stat.value}</div>
                  <div className="mt-2 text-sm uppercase tracking-[0.2em] malts-subtle">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="relative mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {cards.map(card => (
                <div
                  key={card.title}
                  className="group flex flex-col malts-card p-6 md:p-7 hover:-translate-y-[6px] transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="relative group/icon">
                      {/* Icon circle with glow */}
                      <div className="absolute inset-0 w-16 h-16 rounded-full bg-[var(--malts-accent-tint)] blur-md transition-all duration-300 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2"></div>
                      <div className="relative w-16 h-16 rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] flex items-center justify-center transition-all duration-300">
                        <div className="flex items-center justify-center transform group-hover/icon:scale-110 transition-transform duration-300">
                          <OfferingCardIcon icon={card.icon} />
                        </div>
                      </div>
                      {/* Micro interaction - hover tooltip with suggestions */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-4 opacity-0 group-hover/icon:opacity-100 pointer-events-none transition-opacity duration-300 z-10">
                        <div className="bg-[var(--malts-card)]/92 backdrop-blur-sm border border-[var(--malts-hairline)] rounded-lg px-4 py-2 whitespace-nowrap">
                          <p className="text-xs text-[var(--malts-ink)] font-medium">
                            {card.highlights.slice(0, 3).join(' • ')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.25em] text-[var(--malts-accent)] bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] px-3 py-1 rounded-full transition-colors">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold transition-colors">{card.title}</h3>
                  <p className="mt-3 malts-muted text-sm md:text-base leading-relaxed transition-colors">
                    {card.description}
                  </p>

                  <div className="mt-6">
                    <p className="text-xs uppercase tracking-[0.3em] malts-subtle mb-3 transition-colors">Highlights</p>
                    <ul className="space-y-2 text-sm md:text-base text-[var(--malts-ink)]">
                      {card.highlights.map((item, index) => (
                        <li key={`${card.title}-${index}`} className="flex items-center gap-2 group-hover:translate-x-1 transition-transform duration-200" style={{ transitionDelay: `${index * 50}ms` }}>
                          <span className="inline-block h-[2px] w-6 bg-[var(--malts-hairline)] group-hover:bg-[var(--malts-accent-tint-border)] group-hover:w-8 transition-all"></span>
                          <span className="truncate transition-colors">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href={`/${locale}/menu`}
                className="inline-flex items-center justify-center gap-2 rounded-full malts-btn-primary px-8 py-3 font-semibold tracking-wide transition"
              >
                {ctaPrimary}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href={`/${locale}/events`}
                className="inline-flex items-center justify-center gap-2 rounded-full malts-btn-secondary px-8 py-3 font-semibold tracking-wide transition"
              >
                {ctaSecondary}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Chef's Picks Carousel */}
        {featuredProducts.length > 0 && (
          <ChefsPicksCarousel 
            products={featuredProducts.map((p: any) => ({
              id: p.id,
              slug: p.slug,
              nameBg: p.nameBg,
              nameEn: p.nameEn,
              nameRo: p.nameRo,
              descriptionBg: p.descriptionBg,
              descriptionEn: p.descriptionEn,
              descriptionRo: p.descriptionRo,
              priceBgn: Number(p.priceBgn),
              quantity: p.quantity ?? 1,
              unit: p.unit ?? 'pcs',
              imageUrl: p.imageUrl,
              categoryId: p.categoryId,
              categorySlug: p.category.slug,
              category: {
                nameBg: p.category.nameBg,
                nameEn: p.category.nameEn,
                nameRo: p.category.nameRo
              }
            }))}
            locale={locale}
          />
        )}

        {/* Upcoming Events Preview */}
        {events.length > 0 && (
          <div className="mt-16 md:mt-24">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 md:mb-12 gap-4">
              <div>
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight malts-display mb-2">
                  {locale === 'bg' ? 'Предстоящи събития' : locale === 'en' ? 'Upcoming Events' : 'Evenimente viitoare'}
                </h2>
                <p className="text-lg md:text-xl malts-muted malts-display-secondary max-w-3xl">
                  {locale === 'bg'
                    ? "Не пропускайте предстоящи събития — при нас в MALT'S или при наши партньори."
                    : locale === 'en'
                      ? "Don’t miss upcoming events — with us at MALT'S or with our partners."
                      : "Nu ratați evenimentele viitoare — la MALT'S sau la partenerii noștri."}
                </p>
              </div>
              <Link 
                href={`/${locale}/events`}
                className="group px-6 py-3 malts-btn-secondary rounded-xl font-semibold border-2 transition-all flex items-center gap-2"
              >
                {locale === 'bg' ? 'Виж всички' : locale === 'en' ? 'View all' : 'Alle ansehen'}
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {events.map((event: any) => {
                const eventTitle = locale === 'bg' ? event.titleBg : locale === 'en' ? event.titleEn : event.titleRo;
                const eventDesc = locale === 'bg' ? event.descriptionBg : locale === 'en' ? event.descriptionEn : event.descriptionRo;
                const eventDate = new Date(event.eventDate);
                const cardImageSrc = eventCardImageUrl(event);

                return (
                  <Link
                    key={event.id}
                    href={`/${locale}/events/${event.id}`}
                    className="group malts-card overflow-hidden transition-all duration-300 transform hover:-translate-y-1 block"
                  >
                    {cardImageSrc && (
                      <div className="relative h-56 w-full overflow-hidden bg-[var(--malts-inset)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cardImageSrc}
                          alt={eventTitle}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,24,16,0.65)] via-transparent to-transparent opacity-60"></div>
                      </div>
                    )}
                    
                    <div className="p-6">
                      <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] rounded-full w-fit backdrop-blur-sm">
                        <svg className="w-4 h-4 text-[var(--malts-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[var(--malts-ink)] text-sm font-medium">
                          {formatDateForLocale(eventDate, locale as 'bg' | 'en' | 'ro')}
                        </span>
                      </div>

                      <h3 className="text-xl md:text-2xl font-bold mb-3 transition-colors line-clamp-2">
                        {eventTitle}
                      </h3>
                      
                      {eventDesc && (
                        <p className="malts-muted text-sm md:text-base line-clamp-2 mb-4">
                          {eventDesc}
                        </p>
                      )}

                      <div className="flex items-center text-[var(--malts-accent)] font-semibold text-sm group-hover:gap-3 gap-2 transition-all">
                        {locale === 'bg' ? 'Научи повече' : locale === 'en' ? 'Learn more' : 'Află mai mult'}
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
