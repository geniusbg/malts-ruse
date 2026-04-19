'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type OrderTierHorizontalScrollProps = {
  children: ReactNode;
  /** Класове за хоризонтално скролващия контейнер (overflow-x-auto и др.) */
  scrollClassName?: string;
  /** Класове за flex реда с бутоните */
  rowClassName?: string;
  ariaScrollLeft: string;
  ariaScrollRight: string;
};

export default function OrderTierHorizontalScroll({
  children,
  scrollClassName = '',
  rowClassName = '',
  ariaScrollLeft,
  ariaScrollRight,
}: OrderTierHorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const max = scrollWidth - clientWidth;
    const hasOverflow = max > 6;
    setCanLeft(hasOverflow && scrollLeft > 6);
    setCanRight(hasOverflow && scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    const id = window.requestAnimationFrame(() => update());
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(id);
      el.removeEventListener('scroll', update);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update, children]);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.min(280, Math.max(160, el.clientWidth * 0.75));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  const overflow = canLeft || canRight;

  return (
    <div className="relative">
      {overflow && canLeft ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-12 bg-gradient-to-r from-[var(--malts-card)] via-[var(--malts-card)]/90 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="absolute left-0.5 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-lg font-bold text-[var(--malts-ink)] shadow-md transition-colors hover:bg-[var(--malts-card-hover)]"
            aria-label={ariaScrollLeft}
          >
            ‹
          </button>
        </>
      ) : null}
      <div ref={scrollRef} className={scrollClassName}>
        <div className={rowClassName}>{children}</div>
      </div>
      {overflow && canRight ? (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-12 bg-gradient-to-l from-[var(--malts-card)] via-[var(--malts-card)]/90 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="absolute right-0.5 top-1/2 z-[2] flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-lg font-bold text-[var(--malts-ink)] shadow-md transition-colors hover:bg-[var(--malts-card-hover)]"
            aria-label={ariaScrollRight}
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}
