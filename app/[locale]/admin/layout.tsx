import AdminNav from '@/components/AdminNav';
import ServiceWorkerUpdater from '@/components/ServiceWorkerUpdater';
import GlobalApprovalsBanner from '@/components/GlobalApprovalsBanner';
import { Metadata } from 'next';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Admin Panel – Malt's",
  manifest: '/manifest-admin.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: "Malt's Admin"
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

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params;
  
  // Note: Authentication check moved to individual pages to avoid redirect loops
  // Login page has its own layout that doesn't check auth

  return (
    <>
      <link rel="manifest" href="/manifest-admin.json" />
      <div className="malts-surface">
        <ServiceWorkerUpdater />
        <AdminNav locale={locale} />
        {/* Push all content below the fixed AdminNav (without adding extra space between banner and content). */}
        <div className="pt-16 md:pt-20 xl:pt-24 2xl:pt-28">
          <GlobalApprovalsBanner locale={locale} />
          <main className="px-4 pb-8 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

