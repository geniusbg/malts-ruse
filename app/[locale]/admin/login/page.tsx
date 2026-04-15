'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
const backToSiteLabel: Record<string, string> = {
  bg: 'Назад към сайта',
  en: 'Back to site',
  ro: 'Înapoi la site',
};

const adminPortalLabel: Record<string, string> = {
  bg: 'Admin портал',
  en: 'Admin portal',
  ro: 'Portal admin',
};

export default function AdminLoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split('/')[1] || 'bg';
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (session) {
      // Get locale from URL or default to 'bg'
      const pathLocale = window.location.pathname.split('/')[1] || 'bg';
      const role = (session.user as any)?.role as string | undefined;
      if (role === 'STAFF') {
        window.location.assign(`/${pathLocale}/staff`);
        return;
      }
      router.push(`/${pathLocale}/admin`);
      router.refresh();
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get locale from URL or default to 'bg'
      const pathLocale = window.location.pathname.split('/')[1] || 'bg';
      
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: `/${pathLocale}/admin`,
      });

      if (result?.error) {
        // Проверка за rate limit грешка
        if (result.error.includes('RATE_LIMIT_EXCEEDED:')) {
          const rateLimitMessage = result.error.replace('RATE_LIMIT_EXCEEDED:', '');
          setError(rateLimitMessage);
        } else {
          setError('Невалидни данни за вход');
        }
      } else if (result?.ok) {
        // Full navigation so the session cookie is always sent on the next request.
        // If staff logged in via /admin, send them directly to /staff (avoid the /admin -> middleware redirect hop).
        try {
          const sRes = await fetch('/api/auth/session', { cache: 'no-store' });
          const sJson = (await sRes.json().catch(() => null)) as any;
          const role = sJson?.user?.role as string | undefined;
          if (role === 'STAFF') {
            window.location.assign(`/${pathLocale}/staff`);
          } else {
            window.location.assign(`/${pathLocale}/admin`);
          }
        } catch {
          window.location.assign(`/${pathLocale}/admin`);
        }
      }
    } catch (error) {
      setError('Грешка при вход');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 malts-surface flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md">
        <div className="malts-card p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center">
              <Image
                src="/malts-logo-hero.webp"
                alt="Malt's"
                width={834}
                height={812}
                sizes="(max-width: 768px) 90vw, 380px"
                className="malts-hero-logo h-auto w-full max-w-[min(100%,300px)] md:max-w-[360px]"
                priority
              />
            </div>
            <p className="malts-admin-panel-title mt-6 sm:mt-7 text-center text-lg sm:text-xl md:text-2xl leading-snug px-1">
              {adminPortalLabel[locale] ?? adminPortalLabel.bg}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {error && (
              <div className="malts-alert malts-alert-error text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="malts-label">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="malts-field"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="malts-label">
                Парола
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="malts-field"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="malts-btn-primary malts-btn-admin-compact w-full rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Влизане...' : 'Вход'}
            </button>
          </form>

          <Link
            href={`/${locale}`}
            className="malts-btn-secondary malts-btn-admin-compact mt-4 flex w-full items-center justify-center gap-2 rounded-lg font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--malts-accent)] focus-visible:ring-offset-2"
          >
            <svg
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span>{backToSiteLabel[locale] ?? backToSiteLabel.bg}</span>
          </Link>

          <p className="text-center malts-muted text-xs sm:text-sm mt-6 pt-6 border-t border-[var(--malts-hairline)]">
            Контакт: <span className="font-medium text-[var(--malts-ink)]">support@gsoft.bg</span>
          </p>
        </div>
      </div>
    </div>
  );
}

