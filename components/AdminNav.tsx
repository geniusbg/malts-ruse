'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import ConfirmModal from '@/components/ConfirmModal';
import { useBrandAppearance } from '@/lib/use-brand-appearance';

function buildNavLinks(locale: string, isSuper: boolean) {
  const links = [
    { href: `/${locale}/admin`, label: '📊 Dashboard' },
    { href: `/${locale}/admin/orders`, label: '🧾 Поръчки' },
    { href: `/${locale}/admin/categories`, label: '🗂️ Категории' },
    { href: `/${locale}/admin/products`, label: '🍽️ Продукти' },
    { href: `/${locale}/admin/promotions`, label: '🏷️ Промоции' },
    { href: `/${locale}/admin/events`, label: '🎉 Събития' },
    { href: `/${locale}/admin/qr`, label: '📱 QR Кодове' },
    { href: `/${locale}/admin/loading-screens`, label: '⏳ Loading' },
    { href: `/${locale}/admin/users`, label: '👥 Потребители' },
  ];
  if (isSuper) {
    links.splice(links.length - 1, 0, {
      href: `/${locale}/admin/operational-settings`,
      label: '⚙️ Оперативни',
    });
    links.splice(links.length - 1, 0, {
      href: `/${locale}/admin/branding`,
      label: '🎨 Branding',
    });
    links.splice(links.length - 1, 0, {
      href: `/${locale}/admin/backups`,
      label: '🗄️ Backups',
    });
  }
  return links;
}

interface AdminNavProps {
  locale: string;
}

export default function AdminNav({ locale }: AdminNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const appearance = useBrandAppearance();
  const navLogoSrc = appearance?.navLogoUrl || '/malts-logo-nav.webp';

  // Don't show nav on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  const clearNextAuthCookies = () => {
    // Middleware checks both secureCookie true/false; in some setups one cookie can survive,
    // causing a "bounce" back to login once after switching users.
    const names = [
      '__Secure-next-auth.session-token',
      'next-auth.session-token',
      '__Host-next-auth.csrf-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
    ];
    for (const name of names) {
      document.cookie = `${name}=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
    }
  };

  const isSuper = (session?.user as { role?: string })?.role === 'SUPER_ADMIN';
  const navLinks = buildNavLinks(locale, isSuper);

  const splitEmojiLabel = (label: string) => {
    const trimmed = label.trim();
    const firstSpace = trimmed.indexOf(' ');
    if (firstSpace === -1) return { icon: '', text: trimmed };
    return { icon: trimmed.slice(0, firstSpace), text: trimmed.slice(firstSpace + 1) };
  };

  const isActive = (href: string) => {
    if (href === `/${locale}/admin`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    // Sign out without NextAuth redirect
    await signOut({ redirect: false });
    clearNextAuthCookies();

    // Manually redirect to login using current origin
    const currentOrigin = window.location.origin;
    const loginUrl = `${currentOrigin}/${locale}/admin/login`;
    window.location.href = loginUrl;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--malts-paper)]/92 backdrop-blur-md border-b border-[var(--malts-hairline)]">
        <div className="w-full px-2 sm:px-3 md:px-4 lg:px-6 py-0.5 md:py-1">
          <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2 md:gap-3 lg:gap-4">
          {/* Logo: винаги вляво (мобилен + десктоп) */}
          <Link
            href={`/${locale}/admin`}
            className="flex h-12 max-h-12 min-w-0 shrink-0 items-center md:h-14 md:max-h-14 xl:h-[4.25rem] xl:max-h-[4.25rem] 2xl:h-20 2xl:max-h-20"
          >
            <Image
              src={navLogoSrc}
              alt="Malt's"
              width={400}
              height={331}
              sizes="(max-width: 768px) 140px, (max-width: 1280px) 160px, 220px, 260px"
              className="malts-brand-filter h-full w-auto max-h-12 min-h-0 min-w-0 shrink-0 object-contain object-left md:max-h-14 xl:max-h-[4.25rem] 2xl:max-h-20"
              priority
            />
          </Link>

          {/* Desktop Navigation: под xl само икони (+ native title); при нужда хоризонтален скрол */}
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="flex touch-pan-x items-center justify-start gap-0.5 overflow-x-auto overflow-y-hidden py-0.5 sm:justify-center sm:gap-1 md:py-1 [scrollbar-width:thin]">
              {navLinks.map((link) => (
                (() => {
                  const { icon, text } = splitEmojiLabel(link.label);
                  return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label.trim()}
                  className={`malts-admin-nav-tab shrink-0 rounded-lg px-1 py-1 transition-colors md:rounded-xl md:px-1.5 md:py-1.5 xl:rounded-2xl xl:px-3 xl:py-2 2xl:px-4 2xl:py-3 ${
                    isActive(link.href)
                      ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                      : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
                  }`}
                >
                  <span className="flex flex-col items-center justify-center gap-0 leading-tight xl:gap-0.5">
                    {icon ? (
                      <span className="text-[1.05rem] leading-none md:text-lg xl:text-xl 2xl:text-2xl" aria-hidden>
                        {icon}
                      </span>
                    ) : null}
                    <span className="hidden text-center text-[0.8125rem] font-semibold leading-tight xl:block 2xl:text-[0.9375rem]">
                      <span className="max-w-[4.5rem] truncate 2xl:max-w-none 2xl:whitespace-normal">{text}</span>
                    </span>
                  </span>
                </Link>
                  );
                })()
              ))}
            </div>
          </div>

          {/* Вдясно: потребител (md+) / hamburger (под md) */}
          <div className="flex shrink-0 items-center justify-end">
            <div className="hidden md:block relative">
              <button
                type="button"
                title={(session?.user as any)?.name || 'Профил'}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--malts-hairline)] bg-[var(--malts-card)] px-1.5 py-1 transition-colors hover:bg-[var(--malts-card-hover)] md:rounded-xl md:px-2 md:py-1.5 xl:px-3 xl:py-2"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--malts-accent)] text-sm font-bold text-[var(--malts-accent-contrast)] md:h-7 md:w-7">
                  {(session?.user as any)?.name?.[0] || 'A'}
                </div>
                <span className="text-[var(--malts-ink)] text-sm font-medium hidden xl:block">
                  {(session?.user as any)?.name || 'Admin'}
                </span>
                <svg className="w-3 h-3 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--malts-card)] border border-[var(--malts-hairline)] rounded-xl shadow-xl z-50">
                  <div className="p-4 border-b border-[var(--malts-hairline)]">
                    <p className="text-[var(--malts-ink)] font-semibold">{(session?.user as any)?.name}</p>
                    <p className="text-sm malts-muted">{(session?.user as any)?.email}</p>
                    <span className="mt-2 inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-[var(--malts-accent-tint)] border border-[var(--malts-accent-tint-border)] text-[var(--malts-accent)]">
                      {(session?.user as any)?.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full text-left px-4 py-3 text-[var(--malts-danger)] hover:bg-[var(--malts-accent-tint)] transition-colors flex items-center gap-2"
                  >
                    <span>🚪</span>
                    Изход
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] rounded-xl p-2 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--malts-hairline)] py-4 mt-2 max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain touch-pan-y pr-1">
            {navLinks.map((link) => (
              (() => {
                const { icon, text } = splitEmojiLabel(link.label);
                return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`malts-admin-nav-tab block py-4 px-4 rounded-2xl transition-colors mb-2 ${
                  isActive(link.href)
                    ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                    : 'text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)]'
                }`}
              >
                <span className="flex flex-col items-center justify-center gap-1 leading-tight">
                  {icon ? <span className="text-2xl leading-none">{icon}</span> : null}
                  <span className="malts-admin-nav-tab-label">{text}</span>
                </span>
              </Link>
                );
              })()
            ))}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLogoutConfirm(true);
              }}
              className="malts-admin-nav-tab block w-full py-4 px-4 rounded-2xl transition-colors mb-2 text-[var(--malts-danger)] hover:bg-[var(--malts-accent-tint)]"
            >
              <span className="flex flex-col items-center justify-center gap-1 leading-tight">
                <span className="text-2xl leading-none" aria-hidden>🚪</span>
                <span className="malts-admin-nav-tab-label">Изход</span>
              </span>
            </button>
          </div>
        )}
      </div>
      </nav>

      <ConfirmModal
        open={showLogoutConfirm}
        title="Изход"
        message="Сигурни ли сте, че искате да излезете?"
        confirmLabel="Да, излез"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={async () => {
          setShowLogoutConfirm(false);
          await handleLogout();
        }}
      />
    </>
  );
}

