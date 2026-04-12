import type { Metadata } from "next";
import { Geist, Geist_Mono, Rubik_Doodle_Shadow, Pangolin, Reggae_One } from "next/font/google";
import "./globals.css";

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
  manifest: "/manifest.json",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        {/* manifest: see metadata.manifest (Next injects <link rel="manifest">) */}
        {/* Tab: favicon.png → npm run favicon:optimize (16/32). Direct PNG fallback for browsers that request it. */}
        <link rel="icon" href="/favicon.png" type="image/png" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        {/* PWA / Add to Home Screen: hero logo — npm run pwa-icons:optimize */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" href="/favicon-32x32.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="msapplication-TileImage" content="/malts-icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#e8e0d4" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${maltsDisplay.variable} ${maltsButtons.variable} ${maltsLang.variable} ${maltsNav.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
