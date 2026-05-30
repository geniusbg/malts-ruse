'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';
import { locales } from '@/i18n';

type LoadingAssetType = 'image' | 'video';
type LoadingAsset = { id: string; name: string; url: string; type: LoadingAssetType; createdAt: string };
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
  enabled: boolean;
  defaultAssetId: string | null;
  assets: LoadingAsset[];
  rules: LoadingRule[];
};

function normalizePathForRules(pathname: string): { raw: string; canonical: string } {
  const raw = pathname || '/';
  const parts = raw.split('/').filter(Boolean);
  if (parts.length && locales.includes(parts[0] as any)) {
    const rest = parts.slice(1).join('/');
    return { raw, canonical: `/:locale/${rest}`.replace(/\/$/, '') || '/:locale' };
  }
  return { raw, canonical: raw };
}

function normalizeMatchMode(v: any): 'exact' | 'prefix' {
  return v === 'prefix' ? 'prefix' : 'exact';
}

function isPrefixMatch(rulePath: string, targetPath: string): boolean {
  if (!rulePath) return false;
  if (rulePath === '/') return true;
  if (targetPath === rulePath) return true;
  return targetPath.startsWith(rulePath.endsWith('/') ? rulePath : `${rulePath}/`);
}

function resolveRuleForPath(rules: LoadingRule[], raw: string, canonical: string): LoadingRule | null {
  const exact = rules.find((r) => r?.enabled && typeof r.path === 'string' && normalizeMatchMode(r.matchMode) === 'exact' && (r.path === raw || r.path === canonical));
  if (exact) return exact;

  let best: LoadingRule | null = null;
  let bestLen = -1;
  for (const r of rules) {
    if (!r?.enabled || typeof r.path !== 'string') continue;
    if (normalizeMatchMode(r.matchMode) !== 'prefix') continue;
    const p = r.path;
    if (isPrefixMatch(p, raw) || isPrefixMatch(p, canonical)) {
      const len = p.length;
      if (len > bestLen) {
        best = r;
        bestLen = len;
      }
    }
  }
  if (best) return best;

  if (canonical === '/:locale') {
    const localeRoot = rules.find((r) => r?.enabled && typeof r.path === 'string' && r.path === '/:locale');
    if (localeRoot) return localeRoot;
  }
  return null;
}

/** Minimal spinner when global loading UI is disabled (admin/order data fetch). */
function MinimalLoadingFallback({
  inline,
  message,
}: {
  inline?: boolean;
  message?: string;
}) {
  const inner = (
    <div className="flex flex-col items-center justify-center gap-3 px-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--theme-accent)] border-t-transparent"
        aria-hidden
      />
      {message ? <p className="theme-muted text-sm font-medium">{message}</p> : null}
    </div>
  );

  if (inline) return <div className="py-8 text-center">{inner}</div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center theme-surface">
      {inner}
    </div>
  );
}

export default function ManagedLoadingScreen(props: Omit<React.ComponentProps<typeof LoadingScreen>, 'assetUrl' | 'assetType'>) {
  const pathname = usePathname() || '/';
  const [settings, setSettings] = useState<LoadingUiSettings | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/loading-ui-settings')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSettings((data?.settings ?? null) as LoadingUiSettings | null);
        setSettingsStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setSettings(null);
        setSettingsStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('app.loading-ui-settings');
    ch.onmessage = (ev) => {
      const next = (ev?.data?.settings ?? null) as LoadingUiSettings | null;
      if (next) setSettings(next);
    };
    return () => ch.close();
  }, []);

  const rules = useMemo(() => (settings?.rules ?? []) as LoadingRule[], [settings]);

  const assetIndex = useMemo(() => {
    const map = new Map<string, LoadingAsset>();
    for (const a of settings?.assets ?? []) {
      if (a && typeof a.id === 'string') map.set(a.id, a);
    }
    return map;
  }, [settings]);

  const globalEnabled = settings?.enabled === true;

  const { raw, canonical } = normalizePathForRules(pathname);
  const rule = globalEnabled ? resolveRuleForPath(rules, raw, canonical) : null;
  const assetId = rule?.enabled ? (rule.assetId ?? settings?.defaultAssetId ?? null) : null;
  const asset = assetId ? assetIndex.get(assetId) : null;

  if (settingsStatus === 'ready' && settings && !settings.enabled) {
    return <MinimalLoadingFallback inline={props.inline} message={props.message} />;
  }

  return (
    <LoadingScreen
      {...props}
      assetUrl={globalEnabled && rule?.enabled ? asset?.url : undefined}
      assetType={asset?.type}
      hideDefaultMedia={
        settingsStatus === 'loading'
          ? true
          : Boolean(globalEnabled && rule?.enabled)
      }
    />
  );
}
