'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Price from '@/components/Price';
import { productParamForUrl } from '@/lib/product-url';

interface PromotionProduct {
  id: string;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  descriptionBg?: string | null;
  descriptionEn?: string | null;
  descriptionRo?: string | null;
  imageUrl?: string | null;
  promotionLabel?: string | null;
  priceBgn: number | string;
  basePriceBgn?: number | string | null;
  unit?: string | null;
  quantity?: number | null;
  category?: { slug?: string | null } | null;
}

export default function PromotionsCarousel({
  products,
  locale,
  title,
}: {
  products: PromotionProduct[];
  locale: string;
  title: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const rafRef = useRef<number | null>(null);

  const checkScrollability = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollability();
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        checkScrollability();
      });
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', checkScrollability, { passive: true } as AddEventListenerOptions);
    return () => {
      container.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', checkScrollability as any);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [products.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const cardWidth = 288; // ~w-72
    const gap = 24; // gap-6
    const scrollAmount = cardWidth + gap;

    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="mt-16 md:mt-24">
      <div className="text-center mb-10 md:mb-12">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight malts-display mb-3">{title}</h2>
        <Link
          href={`/${locale}/menu?category=promotions`}
          className="mt-3 inline-block text-sm font-semibold text-[var(--malts-accent)] hover:opacity-90"
        >
          {locale === 'bg' ? 'Виж всички →' : locale === 'en' ? 'View all →' : 'Vezi tot →'}
        </Link>
      </div>

      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 items-center justify-center bg-[var(--malts-card)]/90 hover:bg-[var(--malts-card-hover)] border border-[var(--malts-hairline)] rounded-full text-[var(--malts-ink)] transition-all shadow-lg"
            aria-label={locale === 'bg' ? 'Предишни' : locale === 'en' ? 'Previous' : 'Zurück'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        <div className="relative overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((p) => {
              const name = locale === 'bg' ? p.nameBg : locale === 'en' ? p.nameEn : p.nameRo;
              const desc =
                locale === 'bg'
                  ? p.descriptionBg
                  : locale === 'en'
                    ? p.descriptionEn
                    : p.descriptionRo;

              const badge =
                p.promotionLabel?.trim() ??
                (locale === 'bg' ? 'Промо' : 'Promo');

              const categorySlug = p.category?.slug ?? '';

              return (
                <div key={p.id} className="flex-shrink-0 w-64 md:w-72 snap-center group">
                  <Link
                    href={`/${locale}/menu?category=${encodeURIComponent(categorySlug)}&product=${encodeURIComponent(productParamForUrl(p as any))}`}
                    className="group malts-card rounded-2xl overflow-hidden transition-all duration-300 transform hover:-translate-y-1 block relative"
                  >
                    <div className="absolute top-4 left-3 z-10 bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)] px-3 py-1.5 rounded-full text-xs font-bold shadow-md">
                      {badge}
                    </div>

                    {p.imageUrl ? (
                      <div className="relative h-56 w-full overflow-hidden bg-[var(--malts-inset)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.imageUrl}
                          alt={name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : null}

                    <div className="p-6">
                      <div className="min-w-0">
                        <p className="text-lg font-bold text-[var(--malts-ink)] truncate">{name}</p>
                        {desc ? <p className="mt-2 text-sm malts-muted whitespace-pre-line">{desc}</p> : null}
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-3 border-t border-[var(--malts-hairline)] pt-4">
                        <div className="min-w-0">
                          {p.basePriceBgn != null && (
                            <div className="text-sm text-[var(--malts-subtle)] line-through whitespace-nowrap">
                              <Price priceBgn={Number(p.basePriceBgn)} inline showBoth />
                            </div>
                          )}
                          <div className="text-lg font-semibold text-[var(--malts-ink)] whitespace-nowrap">
                            <Price
                              priceBgn={Number(p.priceBgn)}
                              inline
                              showBoth
                              unit={p.unit ?? undefined}
                              quantity={p.quantity ?? undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 items-center justify-center bg-[var(--malts-card)]/90 hover:bg-[var(--malts-card-hover)] border border-[var(--malts-hairline)] rounded-full text-[var(--malts-ink)] transition-all shadow-lg"
            aria-label={locale === 'bg' ? 'Следващи' : locale === 'en' ? 'Next' : 'Weiter'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}

