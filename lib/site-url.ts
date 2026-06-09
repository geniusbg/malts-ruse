export function getSiteBaseUrl(): string {
  const raw =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://malts-ruse.com';
  return raw.trim().replace(/\/+$/, '').replace(/^http:\/\//i, 'https://');
}

export function getSiteBaseUrlObject(): URL {
  return new URL(getSiteBaseUrl());
}

export function buildSiteUrl(path: string): string {
  return `${getSiteBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
