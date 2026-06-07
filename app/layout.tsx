import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Rubik_Doodle_Shadow, Pangolin, Reggae_One } from "next/font/google";
import "./globals.css";
import { getBrandAppearanceSettings } from "@/lib/brand-appearance-settings";
import { logosFromAppearance, serializeBrandBootstrap } from "@/lib/brand-bootstrap";
import { getDefaultBrand } from "@/lib/brand";
import { getLoadingUiSettings } from "@/lib/loading-ui-settings";
import {
  resolveSiteDescription,
  resolveSiteShortName,
  resolveSiteTitle,
} from "@/lib/brand-defaults";
import { fontVarsFromAppearance, fontVarsToCssRecord } from "@/lib/brand-fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeDisplay = Rubik_Doodle_Shadow({
  variable: "--font-theme-display",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const themeButtons = Pangolin({
  variable: "--font-theme-buttons",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const themeLang = Pangolin({
  variable: "--font-theme-lang",
  weight: "400",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const themeNav = Reggae_One({
  variable: "--font-theme-nav",
  weight: "400",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const [appearance, brand] = await Promise.all([
    getBrandAppearanceSettings().catch(() => null),
    getDefaultBrand().catch(() => null),
  ]);
  const brandName = brand?.name ?? null;
  const title = resolveSiteTitle(appearance, brandName);
  const shortName = resolveSiteShortName(appearance, brandName);
  const description = resolveSiteDescription(appearance, shortName);

  return {
    title,
    description,
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: shortName,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const appearance = await getBrandAppearanceSettings().catch(() => null);
  const themeColor = (appearance?.themeColor || "").trim() || "#e8e0d4";
  return {
    themeColor,
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [appearance, loadingUi, brand] = await Promise.all([
    getBrandAppearanceSettings().catch(() => null),
    getLoadingUiSettings().catch(() => null),
    getDefaultBrand().catch(() => null),
  ]);
  const themeColor = (appearance?.themeColor || "").trim() || "#e8e0d4";

  const faviconAny = (appearance?.faviconUrl || "").trim() || null;
  const appIconAny = (appearance?.appIconUrl || "").trim() || null;
  const favicon32 = faviconAny || "/favicon-32x32.png";
  const favicon16 = faviconAny || "/favicon-16x16.png";
  const faviconMain = faviconAny || "/favicon.png";
  const appleTouch = appIconAny || "/apple-touch-icon.png";
  const msTile = appIconAny || "/apple-touch-icon.png";

  const brandLogos = logosFromAppearance(
    appearance,
    resolveSiteShortName(appearance, brand?.name ?? null)
  );
  const bootstrapScript = `window.__BRAND_LOGOS__=${serializeBrandBootstrap(brandLogos)};`;

  const navPreload = brandLogos.navLogoUrl;
  const heroPreload = brandLogos.heroLogoUrl;
  const loadingEnabled = Boolean(loadingUi?.enabled);

  const iconMime = (url: string) => {
    const u = url.toLowerCase();
    if (u.endsWith(".webp")) return "image/webp";
    if (u.endsWith(".svg")) return "image/svg+xml";
    if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
    return "image/png";
  };

  const brandFonts = fontVarsFromAppearance(appearance);
  const fontCssVars = fontVarsToCssRecord(brandFonts);

  const cssVars: Record<string, string | null | undefined> = {
    ...fontCssVars,
    "--theme-paper": appearance?.paper,
    "--theme-ink": appearance?.ink,
    "--theme-muted": appearance?.muted,
    "--theme-subtle": appearance?.subtle,
    "--theme-card": appearance?.card,
    "--theme-card-hover": appearance?.cardHover,
    "--theme-inset": appearance?.inset,
    "--theme-hairline": appearance?.hairline,

    "--theme-accent": appearance?.accent,
    "--theme-accent-hover": appearance?.accentHover,
    "--theme-accent-contrast": appearance?.accentContrast,
    "--theme-accent-contrast-hover": appearance?.accentContrastHover,
    "--theme-hero-glow": appearance?.heroGlow,
    "--theme-homepage-accent": appearance?.homepageAccent,

    "--theme-btn-secondary-bg": appearance?.btnSecondaryBg,
    "--theme-btn-secondary-text": appearance?.btnSecondaryText,
    "--theme-btn-secondary-border": appearance?.btnSecondaryBorder,
    "--theme-btn-secondary-bg-hover": appearance?.btnSecondaryBgHover,
    "--theme-btn-secondary-text-hover": appearance?.btnSecondaryTextHover,

    "--theme-success": appearance?.success,
    "--theme-warning": appearance?.warning,
    "--theme-danger": appearance?.danger,
    "--theme-danger-hover": appearance?.dangerHover,
    "--theme-danger-contrast": appearance?.dangerContrast,
    "--theme-danger-contrast-hover": appearance?.dangerContrastHover,
    "--theme-info": appearance?.info,
  };

  const inlineCss = (() => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(cssVars)) {
      const s = (v ?? "").toString().trim();
      if (s) parts.push(`${k}:${s}`);
    }
    if (parts.length === 0) return "";
    return `:root{${parts.join(";")}}`;
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
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        {navPreload ? <link rel="preload" as="image" href={navPreload} /> : null}
        {heroPreload ? <link rel="preload" as="image" href={heroPreload} /> : null}
        {loadingEnabled ? (
          <>
            <link rel="preload" as="image" href="/beer-mug-loader.gif" />
            <link rel="preload" as="image" href="/beer-mug-loader.png" />
          </>
        ) : null}
        {brandFonts.googleFontsCssUrl ? (
          <link rel="stylesheet" href={brandFonts.googleFontsCssUrl} />
        ) : null}
        {inlineCss ? <style dangerouslySetInnerHTML={{ __html: inlineCss }} /> : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${themeDisplay.variable} ${themeButtons.variable} ${themeLang.variable} ${themeNav.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
