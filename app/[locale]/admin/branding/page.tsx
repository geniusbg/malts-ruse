'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import Toast from '@/components/Toast';

type BrandAppearanceSettings = {
  id: string;
  paper: string | null;
  ink: string | null;
  muted: string | null;
  subtle: string | null;
  card: string | null;
  cardHover: string | null;
  inset: string | null;
  hairline: string | null;

  accent: string | null;
  accentHover: string | null;
  accentContrast: string | null;

  success: string | null;
  warning: string | null;
  danger: string | null;
  info: string | null;

  themeColor: string | null;

  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
};

function coalesceColor(v: string | null | undefined, fallback: string) {
  const s = (v ?? '').trim();
  return s || fallback;
}

export default function BrandingAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as any)?.role as string | undefined;
  const isSuper = role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [settings, setSettings] = useState<BrandAppearanceSettings | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) return;
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
    }
  }, [status, locale]);

  useEffect(() => {
    if (status !== 'authenticated' || !isSuper) return;
    void (async () => {
      try {
        const res = await fetch('/api/brand-appearance', { cache: 'no-store' });
        const data = await res.json();
        setSettings((data?.settings ?? null) as BrandAppearanceSettings | null);
      } catch {
        setToast({ message: 'Грешка при зареждане на настройките', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [status, isSuper]);

  const preview = useMemo(() => {
    // Keep preview in sync with existing defaults in app/globals.css.
    return {
      paper: coalesceColor(settings?.paper, '#d8cfbf'),
      ink: coalesceColor(settings?.ink, '#1a1810'),
      accent: coalesceColor(settings?.accent, '#b0162f'),
      accentContrast: coalesceColor(settings?.accentContrast, '#f5f0e6'),
    };
  }, [settings]);

  async function handleUpload(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Upload failed');
    return String(data.url || '');
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/brand-appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Грешка при запазване');
      setSettings(data.settings as BrandAppearanceSettings);
      setToast({ message: '✅ Запазено', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка при запазване', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) return <ManagedLoadingScreen locale={locale} />;

  if (!isSuper) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
        <div className="malts-card p-6">
          <p className="malts-muted">Само Super Admin може да редактира branding настройките.</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-5xl">
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-8">
        <button
          onClick={() => router.push(`/${locale}/admin`)}
          className="malts-muted mb-4 flex items-center gap-2 transition-colors hover:text-[var(--malts-ink)]"
        >
          <span>←</span>
          <span>Назад към Dashboard</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="malts-admin-heading-font malts-admin-page-title">🎨 Branding</h1>
            <p className="malts-muted mt-2">
              Цветове, theme-color и логота. Празна стойност = fallback към текущия дизайн.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="malts-btn-primary malts-btn-admin-compact w-full shrink-0 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="malts-card rounded-xl p-6 md:p-8 space-y-5">
          <h2 className="text-xl font-bold text-[var(--malts-ink)]">Theme tokens</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['paper', 'App background (paper)'],
              ['ink', 'App text (ink)'],
              ['muted', 'Muted'],
              ['subtle', 'Subtle'],
              ['card', 'Card'],
              ['cardHover', 'Card hover'],
              ['inset', 'Inset'],
              ['hairline', 'Hairline'],
              ['accent', 'Accent (buttons)'],
              ['accentHover', 'Accent hover'],
              ['accentContrast', 'Accent text'],
              ['themeColor', 'Browser theme-color'],
              ['success', 'Success'],
              ['warning', 'Warning'],
              ['danger', 'Danger'],
              ['info', 'Info'],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="malts-label">{label}</label>
                <input
                  className="malts-field"
                  value={(settings as any)[key] ?? ''}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null } as any)}
                  placeholder="например #b0162f"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="malts-card rounded-xl p-6 md:p-8 space-y-6">
          <h2 className="text-xl font-bold text-[var(--malts-ink)]">Logos / icons</h2>

          {[
            ['navLogoUrl', 'Nav logo (top bar)', '/malts-logo-nav.webp'],
            ['heroLogoUrl', 'Hero logo (homepage)', '/malts-logo-hero.webp'],
            ['appIconUrl', 'App icon URL (future PWA)', '/malts-icon-192.png'],
            ['faviconUrl', 'Favicon URL', '/favicon-32x32.png'],
          ].map(([key, label, fallback]) => {
            const url = String((settings as any)[key] || '');
            return (
              <div key={key} className="rounded-lg border border-[var(--malts-hairline)] bg-[var(--malts-inset)]/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--malts-ink)]">{label}</p>
                    <p className="malts-muted text-xs mt-1 break-all">{url || `(fallback: ${fallback})`}</p>
                  </div>
                  <label className="malts-btn-secondary inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,video/mp4,video/webm"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = '';
                        if (!f) return;
                        try {
                          const nextUrl = await handleUpload(f);
                          setSettings({ ...settings, [key]: nextUrl || null } as any);
                          setToast({ message: '✅ Качено', type: 'success' });
                        } catch (err: any) {
                          setToast({ message: err?.message || 'Грешка при качване', type: 'error' });
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="mt-3 flex items-center justify-center rounded-lg bg-black/5 p-3 overflow-hidden">
                  <Image
                    src={url || (fallback as string)}
                    alt={label as string}
                    width={320}
                    height={180}
                    className="h-auto max-h-28 w-auto object-contain"
                    unoptimized
                  />
                </div>
              </div>
            );
          })}

          <div className="rounded-lg border border-[var(--malts-hairline)] p-4">
            <p className="font-semibold text-[var(--malts-ink)] mb-2">Preview (quick)</p>
            <div
              className="rounded-xl p-4 border"
              style={{
                background: preview.paper,
                color: preview.ink,
                borderColor: 'rgba(0,0,0,0.12)',
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">Brand preview</span>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 font-semibold"
                  style={{
                    background: preview.accent,
                    color: preview.accentContrast,
                  }}
                >
                  Primary button
                </button>
              </div>
              <p className="mt-3 opacity-80 text-sm">Това е само preview в админ UI — реалното приложение ще ползва CSS vars.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

