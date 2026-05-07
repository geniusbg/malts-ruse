import { Metadata } from 'next';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';

export const metadata: Metadata = {
  title: 'Malts Staff Dashboard',
  manifest: '/manifest-staff.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Malts Staff'
  }
};

export async function generateViewport() {
  const appearance = await getBrandAppearanceSettings().catch(() => null);
  const themeColor = (appearance?.themeColor || '').trim() || '#e8e0d4';
  return {
    themeColor,
    width: 'device-width',
    initialScale: 1,
  };
}

export default async function StaffLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Note: Authentication check moved to individual pages to avoid redirect loops
  // Login page has its own layout that doesn't check auth

  return (
    <>
      <link rel="manifest" href="/manifest-staff.json" />
      <div className="malts-surface">{children}</div>
    </>
  );
}

