'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import { useBrandAppearance } from '@/lib/use-brand-appearance';
import { resolveNavLogoUrl } from '@/lib/brand-defaults';

// Translations
const translations: Record<string, Record<string, string>> = {
  bg: {
    home: 'Начало',
    menu: 'Меню',
    events: 'Събития',
    contact: 'Контакти'
  },
  en: {
    home: 'Home',
    menu: 'Menu',
    events: 'Events',
    contact: 'Contact'
  },
  ro: {
    home: 'Acasă',
    menu: 'Meniu',
    events: 'Evenimente',
    contact: 'Contact'
  }
};

export default function Navigation({
  initialNavLogoUrl = null,
  initialSiteShortName = null,
}: {
  initialNavLogoUrl?: string | null;
  initialSiteShortName?: string | null;
}) {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const appearance = useBrandAppearance();
  const navLogoSrc = resolveNavLogoUrl(appearance?.navLogoUrl, initialNavLogoUrl);
  const brandLabel = (initialSiteShortName || '').trim() || 'Menu';

  const t = translations[locale] || translations.bg;

  type NavLinkItem = {
    href: string;
    label: string;
    /** When true, only exact pathname match counts as active (e.g. home). */
    exact?: boolean;
    /** Full document reload when already on this href — clears query and client state. */
    fullReloadIfActive?: boolean;
  };

  const navLinks: NavLinkItem[] = [
    { href: `/${locale}`, label: t.home, exact: true },
    /** Full document reload when already on /menu — clears query and client state */
    { href: `/${locale}/menu`, label: t.menu, fullReloadIfActive: true },
    { href: `/${locale}/events`, label: t.events },
    { href: `/${locale}/contact`, label: t.contact },
  ];

  function onNavLinkClick(
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string,
    fullReloadIfActive?: boolean
  ) {
    if (fullReloadIfActive && pathname.startsWith(href)) {
      e.preventDefault();
      window.location.assign(href);
    }
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href || pathname === `${href}/`;
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--theme-paper)]/95 backdrop-blur-md border-b border-[var(--theme-hairline)] shadow-sm">
      <div className="container mx-auto max-w-full px-3 sm:px-4 py-1">
        {/* flex-1 | nav | flex-1 keeps logo at the start of the bar and langs at the end
            (justify-between with a wide center cluster was squeezing the sides inward on md–lg). */}
        <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 md:gap-4">
          <div className="flex min-w-0 flex-1 justify-start">
            <Link
              href={`/${locale}`}
              className="flex h-16 max-h-16 shrink-0 items-center sm:h-20 sm:max-h-20"
            >
              {navLogoSrc ? (
                <Image
                  src={navLogoSrc}
                  alt={brandLabel}
                  width={400}
                  height={331}
                  sizes="(max-width: 768px) 240px, 300px"
                  className="theme-brand-filter h-full w-auto max-h-16 min-h-0 min-w-0 shrink-0 object-contain object-left sm:max-h-20"
                  priority
                />
              ) : (
                <span className="theme-display text-lg font-semibold text-[var(--theme-ink)] sm:text-xl">
                  {brandLabel}
                </span>
              )}
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div
            className={`hidden shrink-0 items-center gap-3 md:flex lg:gap-6 theme-nav-font theme-nav-links ${locale === 'bg' ? 'theme-nav-links--bg' : ''}`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => onNavLinkClick(e, link.href, link.fullReloadIfActive)}
                className={`whitespace-nowrap transition-colors font-medium ${
                  isActive(link.href, link.exact)
                    ? 'text-[var(--theme-accent)] border-b-2 border-[var(--theme-accent)]'
                    : 'text-[var(--theme-ink)] hover:text-[var(--theme-accent)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side - Language Switcher & Mobile Menu Button */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-4">
            <Suspense fallback={<div className="h-8 w-24 shrink-0" />}>
              <LanguageSwitcher />
            </Suspense>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="shrink-0 md:hidden text-[var(--theme-ink)] hover:text-[var(--theme-accent)] p-2"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                // X Icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // Hamburger Icon
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div
            className={`md:hidden py-4 border-t border-[var(--theme-hairline)] mt-2 theme-nav-font theme-nav-links ${locale === 'bg' ? 'theme-nav-links--bg' : ''}`}
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  onNavLinkClick(e, link.href, link.fullReloadIfActive);
                  setMobileMenuOpen(false);
                }}
                className={`block py-3 px-4 rounded-lg transition-colors font-medium ${
                  isActive(link.href, link.exact)
                    ? 'text-[var(--theme-accent)] bg-[var(--theme-accent-tint)] border-l-4 border-[var(--theme-accent)]'
                    : 'text-[var(--theme-ink)] hover:text-[var(--theme-accent)] hover:bg-[var(--theme-card-hover)]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
