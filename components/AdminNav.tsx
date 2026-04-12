'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import ConfirmModal from '@/components/ConfirmModal';

function buildNavLinks(locale: string, isSuper: boolean) {
  const links = [
    { href: `/${locale}/admin`, label: '📊 Dashboard' },
    { href: `/${locale}/admin/orders`, label: '🧾 Поръчки' },
    { href: `/${locale}/admin/categories`, label: '🗂️ Категории' },
    { href: `/${locale}/admin/products`, label: '🍽️ Продукти' },
    { href: `/${locale}/admin/promotions`, label: '🏷️ Промоции' },
    { href: `/${locale}/admin/events`, label: '🎉 Събития' },
    { href: `/${locale}/admin/qr`, label: '📱 QR Кодове' },
    { href: `/${locale}/admin/users`, label: '👥 Потребители' },
  ];
  if (isSuper) {
    links.splice(links.length - 1, 0, {
      href: `/${locale}/admin/operational-settings`,
      label: '⚙️ Оперативни',
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

  // Don't show nav on login page
  if (pathname?.includes('/login')) {
    return null;
  }

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

    // Manually redirect to login using current origin
    const currentOrigin = window.location.origin;
    const loginUrl = `${currentOrigin}/${locale}/admin/login`;
    window.location.href = loginUrl;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--malts-paper)]/92 backdrop-blur-md border-b border-[var(--malts-hairline)]">
        <div className="w-full px-3 sm:px-4 lg:px-6 py-1">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 lg:gap-4">
          {/* Logo: винаги вляво (мобилен + десктоп) */}
          <Link
            href={`/${locale}/admin`}
            className="flex h-16 max-h-16 min-w-0 shrink-0 items-center lg:h-20 lg:max-h-20"
          >
            <Image
              src="/malts-logo-nav.webp"
              alt="Malt's"
              width={400}
              height={331}
              sizes="(max-width: 1024px) 200px, 260px"
              className="malts-brand-filter h-full w-auto max-h-16 min-h-0 min-w-0 shrink-0 object-contain object-left lg:max-h-20"
              priority
            />
          </Link>

          {/* Desktop Navigation — център на лентата */}
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="flex items-center justify-center gap-1 overflow-x-auto whitespace-nowrap py-1 no-scrollbar">
              {navLinks.map((link) => (
                (() => {
                  const { icon, text } = splitEmojiLabel(link.label);
                  return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`malts-admin-nav-tab px-4 py-3 rounded-2xl transition-colors shrink-0 ${
                    isActive(link.href)
                      ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
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
            </div>
          </div>

          {/* Вдясно: потребител (desktop) / hamburger (mobile) */}
          <div className="flex shrink-0 items-center justify-end">
            <div className="hidden lg:block relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-colors border border-[var(--malts-hairline)] bg-[var(--malts-card)] hover:bg-[var(--malts-card-hover)]"
              >
                <div className="w-6 h-6 rounded-full bg-[var(--malts-accent)] text-[#f5f0e6] flex items-center justify-center font-bold text-sm">
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
              className="lg:hidden text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] rounded-xl p-2 transition-colors"
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
          <div className="lg:hidden py-4 border-t border-[var(--malts-hairline)] mt-4">
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
                    ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
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
              className="block w-full text-left py-3 px-4 text-[var(--malts-danger)] transition-colors font-semibold"
            >
              🚪 Изход
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

