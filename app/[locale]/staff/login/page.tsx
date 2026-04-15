'use client';

import { signIn, useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function StaffLoginPage() {
  const router = useRouter();
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
      router.push(`/${pathLocale}/staff`);
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
        callbackUrl: `/${pathLocale}/staff`,
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
        window.location.assign(`/${pathLocale}/staff`);
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
                sizes="(max-width: 768px) 90vw, 340px"
                className="malts-hero-logo h-auto w-full max-w-[min(100%,260px)] md:max-w-[320px]"
                priority
              />
            </div>
            <p className="malts-admin-panel-title mt-5 text-center text-lg sm:text-xl leading-snug px-1">
              Staff панел
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium malts-subtle mb-2">
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
                className="w-full px-4 py-3 malts-inset rounded-lg placeholder-[var(--malts-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)] transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium malts-subtle mb-2">
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
                className="w-full px-4 py-3 malts-inset rounded-lg placeholder-[var(--malts-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)] transition-all"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 malts-btn-primary rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
            >
              {loading ? 'Влизане...' : 'Вход'}
            </button>
          </form>

          <p className="text-center malts-muted text-xs sm:text-sm mt-6 pt-6 border-t border-[var(--malts-hairline)]">
            Контакт: <span className="font-medium text-[var(--malts-ink)]">support@gsoft.bg</span>
          </p>
        </div>
      </div>
    </div>
  );
}

