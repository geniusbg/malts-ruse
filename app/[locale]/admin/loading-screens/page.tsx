'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Toast from '@/components/Toast';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';

type LoadingAssetType = 'image' | 'video';

type LoadingAsset = {
  id: string;
  name: string;
  url: string;
  type: LoadingAssetType;
  createdAt: string;
};

type LoadingRule = {
  id: string;
  path: string;
  matchMode?: 'exact' | 'prefix';
  enabled: boolean;
  assetId: string | null;
  minMs: number;
  extraMs: number;
};

type LoadingUiSettings = {
  id: string;
  enabled: boolean;
  defaultAssetId: string | null;
  assets: LoadingAsset[];
  rules: LoadingRule[];
};

type AppRouteInfo = { path: string; file: string };

function uuid() {
  const c: any = globalThis.crypto;
  return typeof c?.randomUUID === 'function' ? c.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampMs(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(60_000, Math.round(n));
}

export default function LoadingScreensAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [settings, setSettings] = useState<LoadingUiSettings | null>(null);
  const [routes, setRoutes] = useState<AppRouteInfo[]>([]);

  const assetsById = useMemo(() => {
    const m = new Map<string, LoadingAsset>();
    for (const a of settings?.assets ?? []) m.set(a.id, a);
    return m;
  }, [settings?.assets]);

  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) return;

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
    void (async () => {
      try {
        const [sRes, rRes] = await Promise.all([fetch('/api/loading-ui-settings'), fetch('/api/app-routes')]);
        const sJson = await sRes.json();
        const rJson = await rRes.json();
        setSettings(sJson?.settings ?? null);
        setRoutes(Array.isArray(rJson?.routes) ? rJson.routes : []);
      } catch (e) {
        setToast({ message: 'Грешка при зареждане на настройките', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/loading-ui-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: settings.enabled,
          defaultAssetId: settings.defaultAssetId,
          assets: settings.assets,
          rules: settings.rules,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const next = (data?.settings ?? settings) as LoadingUiSettings;
        setSettings(next);
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const ch = new BroadcastChannel('app.loading-ui-settings');
            ch.postMessage({ settings: next });
            ch.close();
          }
        } catch {
          // ignore
        }
        setToast({ message: '✅ Запазено', type: 'success' });
      } else {
        const err = await res.json().catch(() => ({}));
        setToast({ message: err?.error || 'Грешка при запазване', type: 'error' });
      }
    } catch {
      setToast({ message: 'Грешка при запазване', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(file: File) {
    if (!settings) return;
    const fd = new FormData();
    fd.set('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');

      const type: LoadingAssetType =
        file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name) ? 'video' : 'image';

      const next: LoadingAsset = {
        id: uuid(),
        name: file.name,
        url: data.url,
        type,
        createdAt: new Date().toISOString(),
      };
      setSettings({ ...settings, assets: [next, ...(settings.assets ?? [])] });
      setToast({ message: '✅ Качено', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка при качване', type: 'error' });
    }
  }

  if (loading) return <ManagedLoadingScreen locale={locale} />;
  if (!settings) return null;

  return (
    <div className="mx-auto max-w-5xl">
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-8">
        <button
          onClick={() => router.push(`/${locale}/admin`)}
          className="theme-muted mb-4 flex items-center gap-2 transition-colors hover:text-[var(--theme-ink)]"
        >
          <span>←</span>
          <span>Назад към Dashboard</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="theme-admin-heading-font theme-admin-page-title">Loading екрани</h1>
            <p className="theme-muted mt-2">Управлявай визията и правилата за показване на loading overlay по страници.</p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="theme-btn-primary theme-btn-admin-compact w-full shrink-0 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>

      <div className="theme-card space-y-8 rounded-xl p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[var(--theme-ink)]">Глобално</h2>
            <p className="theme-muted mt-1 text-sm">
              Изключено = няма route overlay в публичното приложение и няма пълен loading екран с GIF/видео в админ,
              staff и поръчка (само малък спинър при зареждане на данни). Правилата по-долу важат само когато е включено.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            />
            Включено
          </label>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--theme-ink)]">Assets</h2>
              <p className="theme-muted mt-1 text-sm">Качи GIF/PNG/JPG/WebP или MP4/WebM и ги използвай като loading визия.</p>
            </div>
            <label className="theme-btn-secondary inline-flex cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold">
              Качи файл
              <input
                type="file"
                className="hidden"
                accept="image/*,video/mp4,video/webm"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/50 p-4">
              <label className="theme-label">Default asset</label>
              <select
                className="theme-field"
                value={settings.defaultAssetId ?? ''}
                onChange={(e) => setSettings({ ...settings, defaultAssetId: e.target.value || null })}
              >
                <option value="">(none)</option>
                {(settings.assets ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/50 p-4">
              <label className="theme-label">Preview</label>
              <div className="mt-2 flex min-h-24 items-center justify-center overflow-hidden rounded-lg bg-black/5 p-3">
                {settings.defaultAssetId && assetsById.get(settings.defaultAssetId)?.type === 'video' ? (
                  <video
                    src={assetsById.get(settings.defaultAssetId)!.url}
                    muted
                    playsInline
                    autoPlay
                    loop
                    className="h-24 w-auto max-w-full rounded-md object-contain"
                  />
                ) : settings.defaultAssetId ? (
                  <Image
                    src={assetsById.get(settings.defaultAssetId)?.url || ''}
                    alt="preview"
                    width={96}
                    height={96}
                    className="h-24 w-auto max-w-full rounded-md object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="theme-muted text-sm">Избери default asset</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {(settings.assets ?? []).length === 0 ? (
              <p className="theme-muted text-sm">Няма качени assets.</p>
            ) : (
              (settings.assets ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-3 rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="h-14 w-14 overflow-hidden rounded-lg bg-black/5">
                      {a.type === 'video' ? (
                        <video src={a.url} muted playsInline autoPlay loop className="h-full w-full object-cover" />
                      ) : (
                        <Image
                          src={a.url}
                          alt={a.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--theme-ink)]">{a.name}</p>
                      <p className="theme-muted text-xs">{a.url}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="theme-btn-secondary shrink-0 rounded-lg px-3 py-2 text-sm font-semibold"
                    onClick={() => {
                      const nextAssets = (settings.assets ?? []).filter((x) => x.id !== a.id);
                      const nextRules = (settings.rules ?? []).map((r) =>
                        r.assetId === a.id ? { ...r, assetId: null } : r
                      );
                      setSettings({
                        ...settings,
                        assets: nextAssets,
                        rules: nextRules,
                        defaultAssetId: settings.defaultAssetId === a.id ? null : settings.defaultAssetId,
                      });
                    }}
                  >
                    Изтрий
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[var(--theme-ink)]">Rules (по път)</h2>
              <p className="theme-muted mt-1 text-sm">
                Можеш да зададеш правило за точен път или за път + всички под-пътища (prefix).
              </p>
            </div>
            <button
              type="button"
              className="theme-btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
              onClick={() => {
                const next: LoadingRule = {
                  id: uuid(),
                  path: '',
                  matchMode: 'exact',
                  enabled: true,
                  assetId: settings.defaultAssetId ?? null,
                  minMs: 0,
                  extraMs: 0,
                };
                setSettings({ ...settings, rules: [next, ...(settings.rules ?? [])] });
              }}
            >
              + Добави правило
            </button>
          </div>

          {(settings.rules ?? []).length === 0 ? (
            <p className="theme-muted text-sm">Няма правила.</p>
          ) : (
            <div className="space-y-3">
              {(settings.rules ?? []).map((r) => (
                <div key={r.id} className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-card)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="theme-label">Път (dropdown)</label>
                          <select
                            className="theme-field"
                            value={routes.some((x) => x.path === r.path) ? r.path : ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettings({
                                ...settings,
                                rules: settings.rules.map((x) => (x.id === r.id ? { ...x, path: v } : x)),
                              });
                            }}
                          >
                            <option value="">(избери)</option>
                            {routes.map((x) => (
                              <option key={x.path} value={x.path}>
                                {x.path}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="theme-label">Път (custom)</label>
                          <input
                            className="theme-field"
                            value={r.path}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSettings({
                                ...settings,
                                rules: settings.rules.map((x) => (x.id === r.id ? { ...x, path: v } : x)),
                              });
                            }}
                            placeholder="/:locale/order"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={(r.matchMode ?? 'exact') === 'prefix'}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              rules: settings.rules.map((x) =>
                                x.id === r.id ? { ...x, matchMode: e.target.checked ? 'prefix' : 'exact' } : x
                              ),
                            })
                          }
                        />
                        Важи и за под-пътища (prefix)
                      </label>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="md:col-span-2">
                          <label className="theme-label">Asset</label>
                          <select
                            className="theme-field"
                            value={r.assetId ?? ''}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              setSettings({
                                ...settings,
                                rules: settings.rules.map((x) => (x.id === r.id ? { ...x, assetId: v } : x)),
                              });
                            }}
                          >
                            <option value="">(default)</option>
                            {(settings.assets ?? []).map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="theme-label">Min (ms)</label>
                          <input
                            type="number"
                            min={0}
                            max={60000}
                            className="theme-field"
                            value={r.minMs}
                            onChange={(e) => {
                              const v = clampMs(e.target.value, 0);
                              setSettings({
                                ...settings,
                                rules: settings.rules.map((x) => (x.id === r.id ? { ...x, minMs: v } : x)),
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="theme-label">Extra (ms)</label>
                          <input
                            type="number"
                            min={0}
                            max={60000}
                            className="theme-field"
                            value={r.extraMs}
                            onChange={(e) => {
                              const v = clampMs(e.target.value, 0);
                              setSettings({
                                ...settings,
                                rules: settings.rules.map((x) => (x.id === r.id ? { ...x, extraMs: v } : x)),
                              });
                            }}
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              rules: settings.rules.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)),
                            })
                          }
                        />
                        Активно
                      </label>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 md:items-end">
                      <button
                        type="button"
                        className="theme-btn-secondary rounded-lg px-3 py-2 text-sm font-semibold"
                        onClick={() =>
                          setSettings({ ...settings, rules: settings.rules.filter((x) => x.id !== r.id) })
                        }
                      >
                        Изтрий правило
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

