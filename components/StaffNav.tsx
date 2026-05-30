'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import ConfirmModal from '@/components/ConfirmModal';
import { useBrandAppearance } from '@/lib/use-brand-appearance';
import { resolveNavLogoUrl } from '@/lib/brand-defaults';

interface StaffNavProps {
  locale: string;
}

export default function StaffNav({ locale }: StaffNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const appearance = useBrandAppearance();
  const navLogoSrc = resolveNavLogoUrl(appearance?.navLogoUrl);

  // Don't show nav on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  const clearNextAuthCookies = () => {
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

  const handleLogout = async () => {
    await signOut({ redirect: false });
    clearNextAuthCookies();

    const currentOrigin = window.location.origin;
    const loginUrl = `${currentOrigin}/${locale}/staff/login`;
    window.location.href = loginUrl;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--theme-paper)]/92 backdrop-blur-md border-b border-[var(--theme-hairline)]">
        <div className="container mx-auto px-4 py-1">
          <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <Link href={`/${locale}/staff`} className="flex h-16 max-h-16 items-center gap-3 sm:max-h-20">
            {navLogoSrc ? (
              <Image
                src={navLogoSrc}
                alt=""
                width={400}
                height={331}
                sizes="(max-width: 768px) 200px, 260px"
                className="theme-brand-filter h-full w-auto max-h-16 min-h-0 shrink-0 object-contain object-left sm:max-h-20"
                priority
              />
            ) : null}
            <span className="text-xl font-bold text-[var(--theme-ink)] hidden sm:inline">Staff Dashboard</span>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-card)] hover:bg-[var(--theme-card-hover)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)] text-[var(--theme-accent-contrast)] flex items-center justify-center font-bold">
                {(session?.user as any)?.name?.[0] || 'S'}
              </div>
              <span className="text-[var(--theme-ink)] font-medium hidden sm:block">
                {(session?.user as any)?.name || 'Staff'}
              </span>
              <svg className="w-4 h-4 text-[var(--theme-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--theme-card)] border border-[var(--theme-hairline)] rounded-xl shadow-xl">
                <div className="p-4 border-b border-[var(--theme-hairline)]">
                  <p className="text-[var(--theme-ink)] font-semibold">{(session?.user as any)?.name}</p>
                  <p className="text-sm theme-muted">{(session?.user as any)?.email}</p>
                  <span className="mt-2 inline-flex items-center px-2.5 py-1 text-xs rounded-full bg-[var(--theme-accent-tint)] border border-[var(--theme-accent-tint-border)] text-[var(--theme-accent)]">
                    {(session?.user as any)?.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full text-left px-4 py-3 text-[var(--theme-danger)] hover:bg-[var(--theme-accent-tint)] transition-colors flex items-center gap-2"
                >
                  <span>🚪</span>
                  Изход
                </button>
              </div>
            )}
          </div>
        </div>
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

