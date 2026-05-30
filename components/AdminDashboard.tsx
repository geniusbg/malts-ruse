'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import { getAdminPanelHeading } from '@/lib/site-display-name';
import { useSiteDisplayName } from '@/lib/use-site-display-name';

type Props = {
  locale: string;
  initialSiteName: string;
};

export default function AdminDashboard({ locale, initialSiteName }: Props) {
  const siteName = useSiteDisplayName(initialSiteName);
  const adminHeading = getAdminPanelHeading(locale, siteName);
  const { data: session, status } = useSession();

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) {
      return;
    }

    if (status === 'unauthenticated') {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && !(window as any).__isOffline) {
          window.location.href = `/${locale}/admin/login`;
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any)?.role;
      if (userRole === 'STAFF') {
        window.location.href = `/${locale}/staff`;
      }
    }
  }, [status, session, locale]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && (window as any).__isOffline) {
        return;
      }

      if (!session) {
        window.history.pushState(null, '', window.location.href);
        window.location.href = `/${locale}/admin/login`;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [session, locale]);

  const [stats, setStats] = useState({ categories: 0, products: 0, events: 0 });
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setTimeout(() => {
          setInitialLoading(false);
        }, 2000);
      });
  }, []);

  if (status === 'loading' || initialLoading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="theme-admin-heading-font theme-admin-page-title mb-3 text-balance">{adminHeading}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href={`/${locale}/admin/categories`}
          className="group theme-card rounded-2xl p-8 hover:bg-[var(--theme-card-hover)] transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="theme-subtle text-sm uppercase tracking-wide mb-3">Категории</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--theme-ink)]">{stats.categories}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">📁</div>
          </div>
        </Link>

        <Link
          href={`/${locale}/admin/products`}
          className="group theme-card rounded-2xl p-8 hover:bg-[var(--theme-card-hover)] transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="theme-subtle text-sm uppercase tracking-wide mb-3">Продукти</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--theme-ink)]">{stats.products}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">🍽️</div>
          </div>
        </Link>

        <Link
          href={`/${locale}/admin/events`}
          className="group theme-card rounded-2xl p-8 hover:bg-[var(--theme-card-hover)] transition-all duration-300 sm:col-span-2 lg:col-span-1 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="theme-subtle text-sm uppercase tracking-wide mb-3">Събития</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--theme-ink)]">{stats.events}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">🎉</div>
          </div>
        </Link>
      </div>

      <div className="mt-12">
        <h2 className="theme-admin-heading-font theme-admin-section-title mb-6">Бързи действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href={`/${locale}/admin/products/new`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🍽️</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Добави продукт</h3>
          </Link>
          <Link
            href={`/${locale}/admin/events/new`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🎉</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Добави събитие</h3>
          </Link>
          <Link
            href={`/${locale}/admin/categories`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📁</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Категории</h3>
          </Link>
          <Link
            href={`/${locale}/admin/qr`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📱</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">QR Кодове</h3>
          </Link>
          <Link
            href={`/${locale}/admin/working-hours`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🕐</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Работно време</h3>
          </Link>
          <Link
            href={`/${locale}/admin/security-settings`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🛡️</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Настройки за сигурност</h3>
          </Link>
          <Link
            href={`/${locale}/admin/location-settings`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📍</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Контакти</h3>
          </Link>
          <Link
            href={`/${locale}/admin/homepage-settings`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🏠</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Начална страница</h3>
          </Link>
          <Link
            href={`/${locale}/admin/menu-settings`}
            className="group theme-card rounded-2xl p-6 hover:bg-[var(--theme-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📋</div>
            <h3 className="text-[var(--theme-ink)] font-bold text-lg">Настройки на меню</h3>
          </Link>
        </div>
      </div>
    </div>
  );
}
