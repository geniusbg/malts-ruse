import { redirect } from 'next/navigation';
import { locales } from '@/i18n';

type HandlerKind = 'public' | 'admin' | 'staff';

function parseTarget(raw: string | undefined): { pathname: string; search: string } | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw.replace(/\+/g, '%20'));
  } catch {
    return null;
  }
  if (decoded.includes('..')) return null;

  if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
    try {
      const u = new URL(decoded);
      return { pathname: u.pathname, search: u.search };
    } catch {
      return null;
    }
  }

  const combined = decoded.startsWith('/') ? decoded : `/${decoded}`;
  const qi = combined.indexOf('?');
  if (qi === -1) return { pathname: combined, search: '' };
  return { pathname: combined.slice(0, qi), search: combined.slice(qi) };
}

function isLocaleSegment(seg: string | undefined): seg is (typeof locales)[number] {
  return !!seg && (locales as readonly string[]).includes(seg);
}

/**
 * Validates `target` from manifest protocol_handlers (?target=%s) and redirects in-app.
 */
export function redirectFromProtocolTarget(
  rawTarget: string | string[] | undefined,
  fallbackLocale: string,
  kind: HandlerKind
): never {
  const raw = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;
  const parsed = parseTarget(raw);
  if (!parsed) redirect(`/${fallbackLocale}`);

  const { pathname, search } = parsed;
  const parts = pathname.split('/').filter(Boolean);
  const loc = parts[0];

  if (!isLocaleSegment(loc)) {
    redirect(`/${fallbackLocale}`);
  }

  if (kind === 'public') {
    if (parts[1] === 'admin' || parts[1] === 'staff') {
      redirect(`/${loc}`);
    }
  } else if (kind === 'admin') {
    if (parts[1] !== 'admin') {
      redirect(`/${loc}/admin`);
    }
  } else if (kind === 'staff') {
    if (parts[1] !== 'staff') {
      redirect(`/${loc}/staff`);
    }
  }

  redirect(pathname + search);
}
