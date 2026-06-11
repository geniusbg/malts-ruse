'use client';

import { usePathname } from 'next/navigation';
import { ReactNode, useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import { SessionProvider } from 'next-auth/react';
import OfflineBanner from '@/components/OfflineBanner';
import AppLoadingOverlay from '@/components/AppLoadingOverlay';

export default function ConditionalNav({
  children,
  initialNavLogoUrl = null,
  initialSiteShortName = null,
}: {
  children?: ReactNode;
  initialNavLogoUrl?: string | null;
  initialSiteShortName?: string | null;
}) {
  const pathname = usePathname();
  const [isOffline, setIsOffline] = useState(false);
  const [swVersion, setSwVersion] = useState<string | null>(null);
  
  // Hide navigation in admin, staff, and order routes
  const hideNav = pathname.includes('/admin') || pathname.includes('/staff') || pathname.includes('/order');
  /** Фиксиран CTA на /order не закрива footer при скрол до края */
  const orderFooterClearance =
    pathname.includes('/order') && !pathname.includes('/admin') && !pathname.includes('/staff');
  
  // Use inline function to avoid re-renders
  const handleStatusChange = (blocked: boolean) => {
    setIsOffline(blocked);
    
    // Expose offline state globally for toast hiding
    if (typeof window !== 'undefined') {
      (window as any).__isOffline = blocked;
    }
  };
  
  // Expose offline state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__isOffline = isOffline;
    }
  }, [isOffline]);

  // Get Service Worker version
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          if (registration.active) {
            registration.active.postMessage({ type: 'GET_VERSION' });
          }
        })
        .catch(() => {
          setSwVersion(null);
        });

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SW_VERSION') {
          setSwVersion(event.data.version);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, []);
  
  return (
    <SessionProvider 
      refetchOnWindowFocus={false} // Не проверява при фокус на прозореца
      refetchInterval={0} // Не прави периодични проверки
    >
      <OfflineBanner onStatusChange={handleStatusChange} />
      <AppLoadingOverlay />
      <div className={isOffline ? 'pointer-events-none opacity-50' : ''}>
        {!hideNav && (
          <Navigation
            initialNavLogoUrl={initialNavLogoUrl}
            initialSiteShortName={initialSiteShortName}
          />
        )}
        <div className={hideNav ? '' : 'pt-16'}>
          {children}
        </div>
      </div>
      <footer
        className={`border-t border-[var(--theme-footer-border)] bg-[var(--theme-footer-bg)]/80 py-4 text-center text-sm text-[var(--theme-footer-text)] ${
          orderFooterClearance ? 'max-md:mb-28' : ''
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <a 
            href="https://gsoft.bg" 
            target="_blank" 
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--theme-footer-link-hover)]"
          >
            Реализирано от GSoft.bg
          </a>
          {swVersion && (
            <span className="text-xs text-[var(--theme-subtle)] font-mono">
              версия - {swVersion}
            </span>
          )}
        </div>
      </footer>
    </SessionProvider>
  );
}
