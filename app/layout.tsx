import type { Metadata } from "next";
import { Geist, Geist_Mono, Rubik_Doodle_Shadow, Pangolin, Reggae_One } from "next/font/google";
import "./globals.css";
import { getBrandAppearanceSettings } from "@/lib/brand-appearance-settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const maltsDisplay = Rubik_Doodle_Shadow({
  variable: "--font-malts-display",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const maltsButtons = Pangolin({
  variable: "--font-malts-buttons",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const maltsLang = Pangolin({
  variable: "--font-malts-lang",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const maltsNav = Reggae_One({
  variable: "--font-malts-nav",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Malts – Русе",
  description: "Malts – bar, кафе, меню и добро настроение. Русе.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Malts"
  }
};

export const viewport = {
  themeColor: '#e8e0d4',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appearance = await getBrandAppearanceSettings().catch(() => null);
  const themeColor = (appearance?.themeColor || '').trim() || '#e8e0d4';

  const faviconAny = (appearance?.faviconUrl || '').trim() || null;
  const appIconAny = (appearance?.appIconUrl || '').trim() || null;
  const favicon32 = faviconAny || '/favicon-32x32.png';
  const favicon16 = faviconAny || '/favicon-16x16.png';
  const faviconMain = faviconAny || '/favicon.png';
  const appleTouch = appIconAny || '/apple-touch-icon.png';
  const msTile = appIconAny || '/malts-icon-192.png';

  const iconMime = (url: string) => {
    const u = url.toLowerCase();
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.svg')) return 'image/svg+xml';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/png';
  };

  const cssVars: Record<string, string | null | undefined> = {
    '--malts-paper': appearance?.paper,
    '--malts-ink': appearance?.ink,
    '--malts-muted': appearance?.muted,
    '--malts-subtle': appearance?.subtle,
    '--malts-card': appearance?.card,
    '--malts-card-hover': appearance?.cardHover,
    '--malts-inset': appearance?.inset,
    '--malts-hairline': appearance?.hairline,

    '--malts-accent': appearance?.accent,
    '--malts-accent-hover': appearance?.accentHover,
    '--malts-accent-contrast': appearance?.accentContrast,

    '--malts-success': appearance?.success,
    '--malts-warning': appearance?.warning,
    '--malts-danger': appearance?.danger,
    '--malts-info': appearance?.info,
  };

  const inlineCss = (() => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(cssVars)) {
      const s = (v ?? '').toString().trim();
      if (s) parts.push(`${k}:${s}`);
    }
    if (parts.length === 0) return '';
    return `:root{${parts.join(';')}}`;
  })();

  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        {/* manifest: app/manifest.ts (Next injects <link rel="manifest">) */}
        {/* Favicon / PWA icons: defaults from public/; Super Admin can override via Branding */}
        <link rel="icon" href={faviconMain} type={iconMime(faviconMain)} sizes="any" />
        <link rel="icon" type={iconMime(favicon32)} sizes="32x32" href={favicon32} />
        <link rel="icon" type={iconMime(favicon16)} sizes="16x16" href={favicon16} />
        <link rel="apple-touch-icon" sizes="180x180" href={appleTouch} />
        <link rel="shortcut icon" href={favicon32} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-TileImage" content={msTile} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content={themeColor} />
        {/* Preload loader media for Safari (avoid blank first frame). */}
        <link rel="preload" as="image" href="/beer-mug-loader.gif" />
        <link rel="preload" as="image" href="/beer-mug-loader.png" />
        {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${maltsDisplay.variable} ${maltsButtons.variable} ${maltsLang.variable} ${maltsNav.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
