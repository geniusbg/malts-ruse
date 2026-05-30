import AdminNav from '@/components/AdminNav';
import ServiceWorkerUpdater from '@/components/ServiceWorkerUpdater';
import GlobalApprovalsBanner from '@/components/GlobalApprovalsBanner';
import { Metadata } from 'next';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';
import { resolveSiteDisplayName } from '@/lib/site-display-name';

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await resolveSiteDisplayName();
  return {
    title: `Admin – ${siteName}`,
    manifest: '/manifest-admin.json',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: `${siteName} Admin`,
    },
  };
}

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
  const appearance = await getBrandAppearanceSettings().catch(() => null);
  const initialNavLogoUrl = (appearance?.navLogoUrl || '').trim() || null;

  return (
    <>
      <link rel="manifest" href="/manifest-admin.json" />
      <div className="theme-surface">
        <ServiceWorkerUpdater />
        <AdminNav locale={locale} initialNavLogoUrl={initialNavLogoUrl} />
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

