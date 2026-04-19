'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Price from '@/components/Price';
import { productParamForUrl } from '@/lib/product-url';

interface Product {
  id: string;
  slug?: string | null;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  descriptionBg?: string | null;
  descriptionEn?: string | null;
  descriptionRo?: string | null;
  priceBgn: number;
  quantity?: number;
  unit?: string;
  imageUrl?: string | null;
  categoryId: string;
  /** Public menu URLs use slug instead of raw id */
  categorySlug?: string;
  category: {
    nameBg: string;
    nameEn: string;
    nameRo: string;
  };
}

interface ChefsPicksCarouselProps {
  products: Product[];
  locale: string;
  /** На /order: бутон за добавяне в количка вместо линк към менюто. */
  orderAddMode?: boolean;
  onAddToCart?: (product: Product) => void;
  /** Когато поръчките са изключени — бутонът е неактивен. */
  addDisabled?: boolean;
  /** Скрива мобилния текст „плъзни за повече“ (ползва се на /order). */
  hideScrollHint?: boolean;
}

export default function ChefsPicksCarousel({
  products,
  locale,
  orderAddMode = false,
  onAddToCart,
  addDisabled = false,
  hideScrollHint = false,
}: ChefsPicksCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (!scrollContainerRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollability();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollability);
      window.addEventListener('resize', checkScrollability);
      return () => {
        container.removeEventListener('scroll', checkScrollability);
        window.removeEventListener('resize', checkScrollability);
      };
    }
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const cardWidth = 288; // w-72 = 18rem = 288px
    const gap = 24; // gap-6 = 1.5rem = 24px
    const scrollAmount = cardWidth + gap;
    
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (products.length === 0) return null;

  return (
    <section className="mt-16 md:mt-24">
      <div className="text-center mb-10 md:mb-12">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight malts-display mb-3">
          {locale === 'bg' ? 'Избрани от нас' : locale === 'en' ? "Chef's Picks" : 'Unsere Auswahl'}
        </h2>
        <p className="malts-muted text-lg md:text-xl malts-display-secondary">
          {locale === 'bg' 
            ? 'Специални предложения и любими вкусове' 
            : locale === 'en' 
            ? 'Special selections and favorite flavors'
            : 'Besondere Auswahl und Lieblingsgeschmäcker'}
        </p>
      </div>

      <div className="relative">
        {/* Left Arrow */}
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

        {/* Carousel container */}
        <div className="relative overflow-hidden">
          <div
            ref={scrollContainerRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product) => {
              const productName = locale === 'bg' ? product.nameBg : locale === 'en' ? product.nameEn : product.nameRo;
              const categoryName = locale === 'bg' ? product.category.nameBg : locale === 'en' ? product.category.nameEn : product.category.nameRo;
              const qty = product.quantity ?? 1;
              const unit = product.unit ?? 'pcs';
              const unitSuffix =
                unit === 'pcs'
                  ? locale === 'bg'
                    ? 'бр.'
                    : locale === 'en'
                      ? 'pcs'
                      : 'buc.'
                  : unit;

              return (
                <div
                  key={product.id}
                  className="flex-shrink-0 w-64 md:w-72 snap-center group"
                >
                  <div className="malts-card overflow-hidden transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col">
                    {product.imageUrl ? (
                      <div className="relative h-48 w-full overflow-hidden bg-[var(--malts-inset)]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt={productName}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,24,16,0.65)] via-transparent to-transparent opacity-60"></div>
                      </div>
                    ) : (
                      <div className="relative h-48 w-full overflow-hidden bg-[var(--malts-inset)] flex items-center justify-center px-4 py-3 border-b border-[var(--malts-hairline)]/60">
                        <Image
                          src="/malts-logo-landscape.svg"
                          alt="Malt's"
                          width={320}
                          height={120}
                          className="w-full max-w-[min(100%,320px)] h-auto max-h-[9rem] object-contain opacity-80"
                        />
                      </div>
                    )}
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="mb-2">
                        <span className="text-xs uppercase tracking-[0.2em] malts-subtle">{categoryName}</span>
                      </div>
                      <h3 className="text-xl font-bold mb-2 line-clamp-2">{productName}</h3>
                      {(product.descriptionBg || product.descriptionEn || product.descriptionRo) && (
                        <p className="malts-muted text-sm mb-4 line-clamp-2 flex-1">
                          {locale === 'bg' ? product.descriptionBg : 
                           locale === 'en' ? product.descriptionEn : 
                           product.descriptionRo}
                        </p>
                      )}
                      <div className="mt-auto flex flex-col gap-3">
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <Price
                            priceBgn={Number(product.priceBgn)}
                            inline
                            className="text-sm md:text-base text-[var(--malts-ink)]"
                          />
                          <span className="text-sm malts-muted tabular-nums">
                            {qty} {unitSuffix}
                          </span>
                        </div>
                        {orderAddMode && onAddToCart ? (
                          <button
                            type="button"
                            disabled={addDisabled}
                            onClick={() => onAddToCart(product)}
                            className="w-full px-4 py-2.5 malts-btn-primary rounded-lg font-semibold text-sm transition-colors min-h-[48px] flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {locale === 'bg' ? '+ Добави' : locale === 'en' ? '+ Add' : '+ Adaugă'}
                          </button>
                        ) : (
                          <Link
                            href={`/${locale}/menu?category=${encodeURIComponent(product.categorySlug || product.categoryId)}&product=${encodeURIComponent(productParamForUrl(product))}`}
                            className="w-full px-4 py-2.5 malts-btn-primary rounded-lg font-semibold text-sm transition-colors min-h-[48px] flex items-center justify-center text-center"
                          >
                            {locale === 'bg' ? 'Виж' : locale === 'en' ? 'View' : 'Vezi'}
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Arrow */}
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
        
        {/* Scroll hint - Mobile only */}
        {!hideScrollHint && products.length > 3 && (
          <div className="text-center mt-6 md:hidden">
            <p className="malts-muted text-sm">
              {locale === 'bg' ? '← Плъзни за повече →' : locale === 'en' ? '← Scroll for more →' : '← Glisează pentru mai mult →'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

