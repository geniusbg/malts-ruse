'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function clampMs(v: any, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(60_000, Math.round(n));
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
  // Exact matches first (raw, then canonical)
  const exact = rules.find((r) => r?.enabled && typeof r.path === 'string' && normalizeMatchMode(r.matchMode) === 'exact' && (r.path === raw || r.path === canonical));
  if (exact) return exact;

  // Prefix matches: pick the most specific (longest path) among raw/canonical matches.
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

  // Back-compat: if canonical locale root, allow "/:locale" exact rule even without matchMode.
  if (canonical === '/:locale') {
    const localeRoot = rules.find((r) => r?.enabled && typeof r.path === 'string' && r.path === '/:locale');
    if (localeRoot) return localeRoot;
  }

  return null;
}

export default function AppLoadingOverlay() {
  const pathname = usePathname() || '/';
  const [settings, setSettings] = useState<LoadingUiSettings | null>(null);
  const [active, setActive] = useState(false);
  const [activeAssetUrl, setActiveAssetUrl] = useState<string | null>(null);
  const [activeAssetType, setActiveAssetType] = useState<LoadingAssetType | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [activationKey, setActivationKey] = useState(0);

  const startAtRef = useRef<number>(0);
  const minMsRef = useRef<number>(0);
  const extraMsRef = useRef<number>(0);
  const hideTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<string | null>(null);
  const lastAppliedPathRef = useRef<string | null>(null);
  const lastStartKeyRef = useRef<string | null>(null);
  // Keep previous simple behavior: apply route rules on initial mount too.

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
      else {
        // fallback: refetch when message doesn't carry settings
        fetch('/api/loading-ui-settings')
          .then((r) => r.json())
          .then((data) => setSettings((data?.settings ?? null) as LoadingUiSettings | null))
          .catch(() => {});
      }
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

  const startOverlay = (rule: LoadingRule, asset: LoadingAsset | null, mode: 'route' | 'link', startKey: string) => {
    // Avoid "double start" on Safari/slow devices where settings apply + route effect can race,
    // which causes progress to jump then reset.
    if (active && lastStartKeyRef.current === startKey) {
      return;
    }
    lastStartKeyRef.current = startKey;

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    startAtRef.current = Date.now();
    minMsRef.current = clampMs(rule.minMs, 0);
    extraMsRef.current = clampMs(rule.extraMs, 0);
    const duration = Math.max(0, minMsRef.current + extraMsRef.current);

    setActiveAssetUrl(asset?.url ?? null);
    setActiveAssetType(asset?.type ?? null);
    setProgress(0);
    setActivationKey((k) => k + 1);
    setActive(true);

    const tick = () => {
      const elapsed = Date.now() - startAtRef.current;
      const p = duration === 0 ? 100 : Math.min(100, (elapsed / duration) * 100);
      setProgress(p);
      if (p >= 100) return;
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    if (mode === 'link') {
      // keep old behavior for link-based nav: hide when route commits (but not before 100%)
      pendingTargetRef.current = pendingTargetRef.current ?? null;
    } else {
      pendingTargetRef.current = null;
      hideTimerRef.current = window.setTimeout(() => {
        setProgress(100);
        setActive(false);
      }, duration);
    }
  };

  const startForTarget = useCallback((targetPath: string) => {
    if (!settings?.enabled) return;

    const { raw, canonical } = normalizePathForRules(targetPath);
    const rule = resolveRuleForPath(rules, raw, canonical);
    if (!rule || !rule.enabled) return;

    const assetId = rule.assetId ?? settings.defaultAssetId;
    const asset = assetId ? (assetIndex.get(assetId) ?? null) : null;

    pendingTargetRef.current = raw;
    startOverlay(rule, asset, 'link', `link:${raw}`);
  }, [assetIndex, rules, settings]);

  // Apply rules reliably on route changes (works for router.push, back/forward, direct loads).
  useEffect(() => {
    if (!settings?.enabled) return;

    const { raw, canonical } = normalizePathForRules(pathname);
    const rule = resolveRuleForPath(rules, raw, canonical);
    if (!rule || !rule.enabled) {
      lastAppliedPathRef.current = null;
      return;
    }

    if (lastAppliedPathRef.current === raw) return;
    lastAppliedPathRef.current = raw;

    const assetId = rule.assetId ?? settings.defaultAssetId;
    const asset = assetId ? (assetIndex.get(assetId) ?? null) : null;
    startOverlay(rule, asset, 'route', `route:${raw}`);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [pathname, settings, rules, assetIndex]);

  useEffect(() => {
    // Hide logic: when the route commit happens (pathname changes), keep overlay
    // for at least minMs since start, then add extraMs.
    if (!active) return;
    if (!pendingTargetRef.current) return;

    // If the pathname hasn't changed yet, do nothing.
    if (pathname === pendingTargetRef.current) return;

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    const now = Date.now();
    const minRemaining = Math.max(0, startAtRef.current + minMsRef.current - now);
    const total = minRemaining + extraMsRef.current;
    hideTimerRef.current = window.setTimeout(() => {
      pendingTargetRef.current = null;
      setProgress(100);
      setActive(false);
    }, total);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [active, pathname]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as Element | null;
      const a = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;

      const href = a.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('http://') || href.startsWith('https://')) return;

      // Resolve relative paths against current origin
      const next = new URL(href, window.location.origin);
      if (next.origin !== window.location.origin) return;
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;

      startForTarget(next.pathname);
    };

    document.addEventListener('click', onClickCapture, true);
    return () => document.removeEventListener('click', onClickCapture, true);
  }, [settings, rules, assetIndex, startForTarget]);

  if (!active) return null;

  return (
    <LoadingScreen
      locale={pathname.split('/')[1] || 'bg'}
      progress={progress}
      activationKey={activationKey}
      assetUrl={activeAssetUrl ?? undefined}
      assetType={activeAssetType ?? undefined}
      hideDefaultMedia
    />
  );
}

