'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { locales, type Locale } from '@/i18n';

const languageNames: Record<Locale, string> = {
  bg: 'БГ',
  en: 'EN',
  ro: 'RO',
};

function pathWithNewLocale(pathname: string, newLocale: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  const hasLocalePrefix = segments[0] && locales.includes(segments[0] as Locale);
  const rest = hasLocalePrefix ? segments.slice(1).join('/') : segments.join('/');
  return rest ? `/${newLocale}/${rest}` : `/${newLocale}`;
}

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const seg = pathname.split('/').filter(Boolean)[0];
  const currentLocale = (locales.includes(seg as Locale) ? seg : 'bg') as Locale;

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === currentLocale) return;
    const base = pathWithNewLocale(pathname, newLocale);
    const queryString = searchParams.toString();
    const newPath = `${base}${queryString ? `?${queryString}` : ''}`;
    router.push(newPath, { scroll: false });
  };

  return (
    <div className="flex gap-2">
      {locales.map((locale) => (
        <button
          key={locale}
          onClick={() => switchLocale(locale)}
          className={`px-3 py-1 rounded-md transition-all malts-lang-font ${
            currentLocale === locale
              ? 'bg-[var(--malts-accent)] text-[#f5f0e6] font-semibold'
              : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
          }`}
        >
          {languageNames[locale]}
        </button>
      ))}
    </div>
  );
}


