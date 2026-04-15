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

function resolveRuleForPath(ruleIndex: Map<string, LoadingRule>, raw: string, canonical: string): LoadingRule | null {
  const direct = ruleIndex.get(raw) ?? ruleIndex.get(canonical);
  if (direct) return direct;
  const global = ruleIndex.get('/');
  if (global) return global;
  if (canonical === '/:locale') {
    const localeRoot = ruleIndex.get('/:locale');
    if (localeRoot) return localeRoot;
  }
  return null;
}

export default function ManagedLoadingScreen(props: Omit<React.ComponentProps<typeof LoadingScreen>, 'assetUrl' | 'assetType'>) {
  const pathname = usePathname() || '/';
  const [settings, setSettings] = useState<LoadingUiSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/loading-ui-settings')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSettings((data?.settings ?? null) as LoadingUiSettings | null);
      })
      .catch(() => {
        if (cancelled) return;
        setSettings(null);
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

  const ruleIndex = useMemo(() => {
    const map = new Map<string, LoadingRule>();
    for (const r of settings?.rules ?? []) {
      if (r && typeof r.path === 'string') map.set(r.path, r);
    }
    return map;
  }, [settings]);

  const assetIndex = useMemo(() => {
    const map = new Map<string, LoadingAsset>();
    for (const a of settings?.assets ?? []) {
      if (a && typeof a.id === 'string') map.set(a.id, a);
    }
    return map;
  }, [settings]);

  const { raw, canonical } = normalizePathForRules(pathname);
  const rule = settings?.enabled ? resolveRuleForPath(ruleIndex, raw, canonical) : null;
  const assetId = rule?.enabled ? (rule.assetId ?? settings?.defaultAssetId ?? null) : null;
  const asset = assetId ? assetIndex.get(assetId) : null;

  return (
    <LoadingScreen
      {...props}
      assetUrl={asset?.url}
      assetType={asset?.type}
      hideDefaultMedia={Boolean(settings?.enabled && rule?.enabled)}
    />
  );
}

