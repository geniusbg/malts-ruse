'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';
import { getAdminPanelHeading, getSiteDisplayName } from '@/lib/site-display-name';

export default function AdminDashboard({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const adminHeading = getAdminPanelHeading(locale, getSiteDisplayName());
  const { data: session, status } = useSession();
  
  // Redirect if not authenticated or wrong role
  useEffect(() => {
    // Don't redirect if offline - offline banner will handle it
    if (typeof window !== 'undefined' && (window as any).__isOffline) {
      return;
    }
    
    if (status === 'unauthenticated') {
      // Small delay to allow SW offline message to arrive
      const timer = setTimeout(() => {
        // Check again if still not offline (race condition with SW message)
        if (typeof window !== 'undefined' && !(window as any).__isOffline) {
          window.location.href = `/${locale}/admin/login`;
        }
      }, 100); // 100ms delay
      return () => clearTimeout(timer);
    }
    
    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any)?.role;
      if (userRole === 'STAFF') {
        window.location.href = `/${locale}/staff`;
      }
    }
  }, [status, session, locale]);

  // Prevent back button after logout
  useEffect(() => {
    const handlePopState = (e: any) => {
      // Don't redirect if offline
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
    fetch('/api/stats').then(res => res.json()).then(data => {
      setStats(data);
      // Show loading for 2 seconds
      setTimeout(() => {
        setInitialLoading(false);
      }, 2000);
    });
  }, []);

  // Show loading while checking session or initial loading
  if (status === 'loading' || initialLoading) {
    return <LoadingScreen locale={locale} />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-10">
        <h1 className="malts-admin-heading-font malts-admin-page-title mb-3 text-balance">
          {adminHeading}
        </h1>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <a
          href="/bg/admin/categories"
          className="group malts-card rounded-2xl p-8 hover:bg-[var(--malts-card-hover)] transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="malts-subtle text-sm uppercase tracking-wide mb-3">Категории</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)]">{stats.categories}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">📁</div>
          </div>
        </a>

        <a
          href="/bg/admin/products"
          className="group malts-card rounded-2xl p-8 hover:bg-[var(--malts-card-hover)] transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="malts-subtle text-sm uppercase tracking-wide mb-3">Продукти</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)]">{stats.products}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">🍽️</div>
          </div>
        </a>

        <a
          href="/bg/admin/events"
          className="group malts-card rounded-2xl p-8 hover:bg-[var(--malts-card-hover)] transition-all duration-300 sm:col-span-2 lg:col-span-1 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="malts-subtle text-sm uppercase tracking-wide mb-3">Събития</p>
              <p className="text-4xl md:text-5xl font-bold text-[var(--malts-ink)]">{stats.events}</p>
            </div>
            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">🎉</div>
          </div>
        </a>
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="malts-admin-heading-font malts-admin-section-title mb-6">Бързи действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/bg/admin/products/new"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🍽️</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Добави продукт</h3>
          </a>
          <a
            href="/bg/admin/events/new"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🎉</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Добави събитие</h3>
          </a>
          <a
            href="/bg/admin/categories"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📁</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Категории</h3>
          </a>
          <a
            href="/bg/admin/qr"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📱</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">QR Кодове</h3>
          </a>
          <a
            href="/bg/admin/working-hours"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🕐</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Работно време</h3>
          </a>
          <a
            href="/bg/admin/security-settings"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🛡️</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Настройки за сигурност</h3>
          </a>
          <a
            href="/bg/admin/location-settings"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📍</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Адрес</h3>
          </a>
          <a
            href="/bg/admin/homepage-settings"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">🏠</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Начална страница</h3>
          </a>
          <a
            href="/bg/admin/menu-settings"
            className="group malts-card rounded-2xl p-6 hover:bg-[var(--malts-card-hover)] transition-all duration-300 text-center"
          >
            <div className="text-5xl mb-3 group-hover:scale-110 transition-transform duration-300">📋</div>
            <h3 className="text-[var(--malts-ink)] font-bold text-lg">Настройки на меню</h3>
          </a>
        </div>
      </div>
    </div>
  );
}


