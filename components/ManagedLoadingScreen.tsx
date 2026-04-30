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
    const ch = new BroadcastChannel('malts.loading-ui-settings');
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

  const { raw, canonical } = normalizePathForRules(pathname);
  const rule = settings?.enabled ? resolveRuleForPath(rules, raw, canonical) : null;
  const assetId = rule?.enabled ? (rule.assetId ?? settings?.defaultAssetId ?? null) : null;
  const asset = assetId ? assetIndex.get(assetId) : null;

  return (
    <LoadingScreen
      {...props}
      assetUrl={asset?.url}
      assetType={asset?.type}
      // Avoid "flash" of the default beer mug before admin settings load.
      // While settings are loading, hide default media; once loaded, show it only when no custom rule applies.
      hideDefaultMedia={
        settingsStatus === 'loading'
          ? true
          : Boolean(settings?.enabled && rule?.enabled)
      }
    />
  );
}

