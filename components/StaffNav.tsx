'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import ConfirmModal from '@/components/ConfirmModal';

interface StaffNavProps {
  locale: string;
}

export default function StaffNav({ locale }: StaffNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Don't show nav on login page
  if (pathname?.includes('/login')) {
    return null;
  }

  const handleLogout = async () => {
    await signOut({ redirect: false });

    const currentOrigin = window.location.origin;
    const loginUrl = `${currentOrigin}/${locale}/staff/login`;
    window.location.href = loginUrl;
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--malts-paper)]/92 backdrop-blur-md border-b border-[var(--malts-hairline)]">
        <div className="container mx-auto px-4 py-1">
          <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <Link href={`/${locale}/staff`} className="flex h-16 max-h-16 items-center gap-3 sm:max-h-20">
            <Image
              src="/malts-logo-nav.webp"
              alt="Malt's"
              width={400}
              height={331}
              sizes="(max-width: 768px) 200px, 260px"
              className="malts-brand-filter h-full w-auto max-h-16 min-h-0 shrink-0 object-contain object-left sm:max-h-20"
              priority
            />
            <span className="text-xl font-bold text-[var(--malts-ink)] hidden sm:inline">Staff Dashboard</span>
          </Link>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--malts-hairline)] bg-[var(--malts-card)] hover:bg-[var(--malts-card-hover)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--malts-accent)] text-[#f5f0e6] flex items-center justify-center font-bold">
                {(session?.user as any)?.name?.[0] || 'S'}
              </div>
              <span className="text-[var(--malts-ink)] font-medium hidden sm:block">
                {(session?.user as any)?.name || 'Staff'}
              </span>
              <svg className="w-4 h-4 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[var(--malts-card)] border border-[var(--malts-hairline)] rounded-xl shadow-xl">
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

