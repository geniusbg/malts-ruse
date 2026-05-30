import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import ConditionalNav from '@/components/ConditionalNav';
import { getBrandAppearanceSettings } from '@/lib/brand-appearance-settings';
import { resolveSiteShortName } from '@/lib/brand-defaults';
import { getDefaultBrand } from '@/lib/brand';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  const [appearance, brand] = await Promise.all([
    getBrandAppearanceSettings().catch(() => null),
    getDefaultBrand().catch(() => null),
  ]);
  const initialNavLogoUrl = (appearance?.navLogoUrl || '').trim() || null;
  const initialSiteShortName = resolveSiteShortName(appearance, brand?.name ?? null);

  return (
    <ConditionalNav initialNavLogoUrl={initialNavLogoUrl} initialSiteShortName={initialSiteShortName}>
      {children}
    </ConditionalNav>
  );
}
