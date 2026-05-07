import type { MetadataRoute } from 'next';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';

export const dynamic = 'force-dynamic';

function iconMime(url: string): string {
  const u = url.toLowerCase();
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.svg')) return 'image/svg+xml';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appearance = await getBrandAppearanceSettings().catch(() => null);
  const themeColor = appearance?.themeColor?.trim() || '#e8e0d4';
  const appIcon = appearance?.appIconUrl?.trim();

  const icons: MetadataRoute.Manifest['icons'] = appIcon
    ? [
        { src: appIcon, sizes: '192x192', type: iconMime(appIcon), purpose: 'any' },
        { src: appIcon, sizes: '512x512', type: iconMime(appIcon), purpose: 'any' },
        { src: appIcon, sizes: '512x512', type: iconMime(appIcon), purpose: 'maskable' },
      ]
    : [
        { src: '/malts-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/malts-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/malts-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ];

  return {
    name: 'Malts',
    short_name: 'Malts',
    description: 'Malts – Русе',
    start_url: '/bg',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    theme_color: themeColor,
    background_color: themeColor,
    protocol_handlers: [
      {
        protocol: 'web+malts',
        url: '/bg/malts-protocol?target=%s',
      },
    ],
    icons,
  };
}
