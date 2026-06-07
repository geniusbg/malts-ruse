'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import Toast from '@/components/Toast';
import { fontVarsFromAppearance, normalizeFontFamilyStack } from '@/lib/brand-fonts';

type BrandAppearanceSettings = {
  id: string;
  paper: string | null;
  ink: string | null;
  muted: string | null;
  subtle: string | null;
  card: string | null;
  cardHover: string | null;
  inset: string | null;
  hairline: string | null;
  hoverBorder: string | null;

  accent: string | null;
  accentHover: string | null;
  accentContrast: string | null;
  accentContrastHover: string | null;
  heroGlow: string | null;
  heroMoodBg: string | null;
  homepageAccent: string | null;

  btnSecondaryBg: string | null;
  btnSecondaryText: string | null;
  btnSecondaryBorder: string | null;
  btnSecondaryBgHover: string | null;
  btnSecondaryTextHover: string | null;

  success: string | null;
  warning: string | null;
  danger: string | null;
  dangerHover: string | null;
  dangerContrast: string | null;
  dangerContrastHover: string | null;
  info: string | null;

  themeColor: string | null;
  siteTitle: string | null;
  siteShortName: string | null;
  siteDescription: string | null;

  googleFontsCssUrl: string | null;
  fontDisplayFamily: string | null;
  fontButtonsFamily: string | null;
  fontNavFamily: string | null;
  fontBodyFamily: string | null;

  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
};

const DEFAULTS = {
  paper: '#d8cfbf',
  ink: '#1a1810',
  muted: '#4a4437',
  subtle: '#6b6255',
  card: '#ebe4d6',
  cardHover: '#e4dcc8',
  inset: '#dfd4c4',
  hairline: '#c9bda8',
  hoverBorder: '#c65a6b',
  accent: '#b0162f',
  accentHover: '#921226',
  accentContrast: '#f5f0e6',
  accentContrastHover: '#f5f0e6',
  heroGlow: '#b0162f',
  heroMoodBg: '#000000',
  homepageAccent: '#b0162f',
  success: '#166534',
  warning: '#92400e',
  danger: '#991b1b',
  dangerHover: '#7f1515',
  dangerContrast: '#ffffff',
  dangerContrastHover: '#ffffff',
  info: '#1d4ed8',
  themeColor: '#e8e0d4',
};

function coalesceColor(v: string | null | undefined, fallback: string) {
  const s = (v ?? '').trim();
  return s || fallback;
}

function colorFieldFallback(key: keyof BrandAppearanceSettings): string {
  const chain: Partial<Record<keyof BrandAppearanceSettings, keyof typeof DEFAULTS>> = {
    btnSecondaryBg: 'card',
    btnSecondaryText: 'ink',
    btnSecondaryBorder: 'hairline',
    btnSecondaryBgHover: 'cardHover',
    btnSecondaryTextHover: 'ink',
    dangerHover: 'danger',
    dangerContrastHover: 'dangerContrast',
  };
  const mapped = chain[key];
  if (mapped) return DEFAULTS[mapped];
  if (key in DEFAULTS) return DEFAULTS[key as keyof typeof DEFAULTS];
  return DEFAULTS.card;
}

type ColorField = { key: keyof BrandAppearanceSettings; label: string; hint: string };

const COLOR_GROUPS: { title: string; description: string; fields: ColorField[] }[] = [
  {
    title: 'Homepage акценти',
    description: 'Логото и mood текста в hero, както и таговете в секцията „Предложения“.',
    fields: [
      { key: 'heroGlow', label: 'Hero glow / mood рамка', hint: 'Пулсацията около голямото лого и рамката около Food • Drinks…' },
      { key: 'heroMoodBg', label: 'Фон вътре в mood банера', hint: 'Вътрешният фон зад текста Food • Drinks…' },
      { key: 'homepageAccent', label: 'Предложения и Акценти', hint: 'Етикет „Предложения“, badge-ове и accent елементи в cards' },
    ],
  },
  {
    title: 'Фон и повърхности',
    description: 'Общ фон на сайта, картички и полета.',
    fields: [
      { key: 'paper', label: 'Фон на страницата', hint: 'Целият сайт (body), админ, staff' },
      { key: 'card', label: 'Фон на картички', hint: 'Блокове, менюта, форми в админ' },
      { key: 'cardHover', label: 'Картичка при hover', hint: 'Леко потъмняване при посочване' },
      { key: 'inset', label: 'Вдлъбнати полета', hint: 'Input полета, вътрешни панели' },
      { key: 'hairline', label: 'Рамки / разделители', hint: 'Граници между секции' },
      { key: 'hoverBorder', label: 'Рамки при hover', hint: 'Цвят на рамката при посочване върху картички, вторични бутони и pills' },
    ],
  },
  {
    title: 'Текст',
    description: 'Йерархия на текста в публичната част и админа.',
    fields: [
      { key: 'ink', label: 'Основен текст', hint: 'Заглавия, параграфи, меню' },
      { key: 'muted', label: 'Вторичен текст', hint: 'Подзаглавия, описания' },
      { key: 'subtle', label: 'Блед текст', hint: 'Етикети, помощен текст' },
    ],
  },
  {
    title: 'Акцент и бутони',
    description: 'Главни CTA бутони (Меню, Поръчай, Запази).',
    fields: [
      { key: 'accent', label: 'Цвят на бутоните', hint: 'theme-btn-primary — акцентен фон' },
      { key: 'accentHover', label: 'Бутон при hover', hint: 'Фон, когато мишката е върху бутона' },
      { key: 'accentContrast', label: 'Текст на бутона', hint: 'Цвят на буквите — нормално състояние' },
      { key: 'accentContrastHover', label: 'Текст на бутона при hover', hint: 'Цвят на буквите при hover' },
    ],
  },
  {
    title: 'Вторични бутони',
    description: 'Отказ в modals (theme-btn-secondary). Празно поле = стойност от Фон/Текст по-горе.',
    fields: [
      { key: 'btnSecondaryBg', label: 'Фон', hint: 'По подразбиране: Фон на картички' },
      { key: 'btnSecondaryText', label: 'Текст', hint: 'По подразбиране: Основен текст' },
      { key: 'btnSecondaryBorder', label: 'Рамка', hint: 'По подразбиране: Рамки / разделители' },
      { key: 'btnSecondaryBgHover', label: 'Фон при hover', hint: 'По подразбиране: Картичка при hover' },
      { key: 'btnSecondaryTextHover', label: 'Текст при hover', hint: 'По подразбиране: същият като Текст' },
    ],
  },
  {
    title: 'Опасни бутони',
    description: 'Да, излез / Изтрий (theme-btn-danger) в modals.',
    fields: [
      { key: 'danger', label: 'Фон', hint: 'Същото като „Грешка / опасност“ за badges' },
      { key: 'dangerHover', label: 'Фон при hover', hint: 'По-тъмен фон при hover' },
      { key: 'dangerContrast', label: 'Текст', hint: 'Букви върху червения фон' },
      { key: 'dangerContrastHover', label: 'Текст при hover', hint: 'Букви при hover' },
    ],
  },
  {
    title: 'Съобщения (успех / грешка)',
    description: 'Банери и badges. Червен badge ползва „Фон“ от Опасни бутони.',
    fields: [
      { key: 'success', label: 'Успех', hint: 'Потвърждения, „запазено“' },
      { key: 'warning', label: 'Предупреждение', hint: 'Внимание, изчакващи действия' },
      { key: 'info', label: 'Информация', hint: 'Неутрални съобщения' },
    ],
  },
  {
    title: 'Браузър и телефон',
    description: 'Лента над адресната лента и PWA.',
    fields: [
      { key: 'themeColor', label: 'Цвят на лентата (theme-color)', hint: 'Safari/Chrome горна лента, splash screen' },
    ],
  },
];

const LOGO_FIELDS: { key: keyof BrandAppearanceSettings; label: string; hint: string }[] = [
  { key: 'navLogoUrl', label: 'Лого в горната лента', hint: 'Винаги видимо при скрол — всички публични страници' },
  { key: 'heroLogoUrl', label: 'Голямо лого на начална', hint: 'Само homepage hero' },
  { key: 'appIconUrl', label: 'Икона за приложение (PWA)', hint: '„Добави към началния екран“, push известия' },
  { key: 'faviconUrl', label: 'Favicon (таб)', hint: 'Малката икона в таба на браузъра' },
];

const FONT_FIELDS: { key: keyof BrandAppearanceSettings; label: string; hint: string; placeholder: string }[] = [
  { key: 'fontDisplayFamily', label: 'Заглавия / банер', hint: 'Mood banner на начална, големи надписи', placeholder: 'Ruslan Display' },
  { key: 'fontButtonsFamily', label: 'Бутони', hint: 'Всички основни и вторични бутони', placeholder: 'Pangolin' },
  { key: 'fontNavFamily', label: 'Навигация', hint: 'Меню: Начало, Меню, Събития…', placeholder: 'Reggae One' },
  { key: 'fontBodyFamily', label: 'Обикновен текст', hint: 'Параграфи, форми (ако е празно — Inter)', placeholder: 'Inter' },
];

function ColorInput({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  const resolved = coalesceColor(value, fallback);
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(resolved) ? resolved : fallback;

  return (
    <div className="space-y-1 rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/30 p-3">
      <label className="theme-label">{label}</label>
      <p className="theme-muted text-xs leading-snug">{hint}</p>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-[var(--theme-hairline)] bg-white p-0.5"
          aria-label={`${label} — цветов избор`}
        />
        <input
          className="theme-field flex-1 font-mono text-sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder={fallback}
        />
        <span
          className="h-10 w-10 shrink-0 rounded-md border border-[var(--theme-hairline)]"
          style={{ background: resolved }}
          title={resolved}
          aria-hidden
        />
      </div>
    </div>
  );
}

function BrandingPreview({ settings }: { settings: BrandAppearanceSettings }) {
  const p = useMemo(() => {
    const c = (k: keyof typeof DEFAULTS) => coalesceColor(settings[k] as string | null, DEFAULTS[k]);
    const fonts = fontVarsFromAppearance(settings);
    return {
      paper: c('paper'),
      ink: c('ink'),
      muted: c('muted'),
      card: c('card'),
      hairline: c('hairline'),
      hoverBorder: c('hoverBorder'),
      inset: c('inset'),
      accent: c('accent'),
      accentHover: c('accentHover'),
      accentContrast: c('accentContrast'),
      accentContrastHover: coalesceColor(settings.accentContrastHover, c('accentContrast')),
      heroGlow: c('heroGlow'),
      heroMoodBg: c('heroMoodBg'),
      homepageAccent: c('homepageAccent'),
      btnSecondaryBg: coalesceColor(settings.btnSecondaryBg, c('card')),
      btnSecondaryText: coalesceColor(settings.btnSecondaryText, c('ink')),
      btnSecondaryBorder: coalesceColor(settings.btnSecondaryBorder, c('hairline')),
      btnSecondaryBgHover: coalesceColor(settings.btnSecondaryBgHover, c('cardHover')),
      btnSecondaryTextHover: coalesceColor(settings.btnSecondaryTextHover, coalesceColor(settings.btnSecondaryText, c('ink'))),
      success: c('success'),
      warning: c('warning'),
      danger: c('danger'),
      dangerHover: coalesceColor(settings.dangerHover, c('dangerHover')),
      dangerContrast: coalesceColor(settings.dangerContrast, c('dangerContrast')),
      dangerContrastHover: coalesceColor(settings.dangerContrastHover, coalesceColor(settings.dangerContrast, c('dangerContrast'))),
      fontDisplay: fonts.display || undefined,
      fontButtons: fonts.buttons || undefined,
      fontNav: fonts.nav || undefined,
      fontBody: fonts.body || undefined,
      navLogo: (settings.navLogoUrl || '').trim(),
      siteTitle: (settings.siteShortName || settings.siteTitle || 'Вашият бранд').trim(),
    };
  }, [settings]);

  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-card)] p-4">
        <h3 className="text-lg font-bold text-[var(--theme-ink)]">Преглед (локален)</h3>
        <p className="theme-muted mt-1 text-xs leading-relaxed">
          Показва текущите стойности в полетата — <strong>без запазване</strong>. След „Запази“ презареди
          публичния сайт за финален вид. Пълен site preview не е нужен — това е достатъчно за цветове и бутони.
        </p>
      </div>

      <div
        className="overflow-hidden rounded-xl border shadow-md"
        style={{ borderColor: p.hairline, background: p.paper, color: p.ink, fontFamily: p.fontBody }}
      >
        {/* mock nav */}
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: p.hairline, background: p.paper, fontFamily: p.fontNav }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {p.navLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.navLogo} alt="" className="h-8 w-auto max-w-[100px] object-contain" />
            ) : (
              <span className="truncate text-sm font-semibold" style={{ fontFamily: p.fontNav }}>
                {p.siteTitle}
              </span>
            )}
          </div>
          <span className="text-xs opacity-70" style={{ fontFamily: p.fontNav }}>
            Меню · Контакти
          </span>
        </div>

        <div className="space-y-3 p-3">
          {/* mood banner mock */}
          <p
            className="mx-auto max-w-full rounded-full border-2 px-4 py-2 text-center text-sm"
            style={{
              fontFamily: p.fontDisplay,
              borderColor: p.heroGlow,
              background: p.heroMoodBg,
              color: p.accentContrast,
              boxShadow: `0 0 22px ${p.heroGlow}55`,
            }}
          >
            Добро настроение
          </p>

          <div className="flex flex-wrap justify-center gap-2 text-xs font-medium">
            <span
              className="rounded-full border px-3 py-1 uppercase tracking-[0.18em]"
              style={{ borderColor: p.homepageAccent, color: p.homepageAccent, background: `${p.homepageAccent}18` }}
            >
              Предложения
            </span>
            <span
              className="rounded-full border px-3 py-1"
              style={{ borderColor: p.homepageAccent, color: p.homepageAccent, background: `${p.homepageAccent}18` }}
            >
              Класика
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: p.accent, color: p.accentContrast, fontFamily: p.fontButtons }}
            >
              Основен бутон
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: p.accentHover, color: p.accentContrastHover, fontFamily: p.fontButtons }}
              title="Преглед при hover"
            >
              При hover
            </button>
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                background: p.btnSecondaryBg,
                color: p.btnSecondaryText,
                borderColor: p.btnSecondaryBorder,
                fontFamily: p.fontButtons,
              }}
            >
              Отказ
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: p.danger, color: p.dangerContrast, fontFamily: p.fontButtons }}
            >
              Да, излез
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                background: p.btnSecondaryBgHover,
                color: p.btnSecondaryTextHover,
                borderColor: p.btnSecondaryBorder,
                fontFamily: p.fontButtons,
              }}
              title="Отказ при hover"
            >
              Отказ hover
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: p.dangerHover, color: p.dangerContrastHover, fontFamily: p.fontButtons }}
              title="Опасен при hover"
            >
              Излез hover
            </button>
          </div>

          <div
            className="rounded-xl border p-3 text-sm"
            style={{ background: p.card, borderColor: p.hoverBorder, color: p.ink }}
          >
            <p className="font-semibold">Примерна картичка</p>
            <p style={{ color: p.muted }}>Вторичен текст в меню или админ.</p>
            <input
              readOnly
              value="Примерно поле"
              className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ background: p.inset, borderColor: p.hairline, color: p.ink }}
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full px-2 py-1" style={{ background: `${p.success}22`, color: p.success }}>
              Успех
            </span>
            <span className="rounded-full px-2 py-1" style={{ background: `${p.warning}22`, color: p.warning }}>
              Внимание
            </span>
            <span className="rounded-full px-2 py-1" style={{ background: `${p.danger}22`, color: p.danger }}>
              Грешка
            </span>
          </div>
        </div>
      </div>

      <p className="theme-muted text-xs">
        За шрифтове: ако смениш Google Fonts URL, прегледът може да използва шрифта едва след запазване и презареждане
        (браузърът трябва да зареди CSS файла).
      </p>
    </div>
  );
}

export default function BrandingAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as any)?.role as string | undefined;
  const isSuper = role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [settings, setSettings] = useState<BrandAppearanceSettings | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) return;
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
    }
  }, [status, locale]);

  useEffect(() => {
    if (status !== 'authenticated' || !isSuper) return;
    void (async () => {
      try {
        const res = await fetch('/api/brand-appearance', { cache: 'no-store' });
        const data = await res.json();
        setSettings((data?.settings ?? null) as BrandAppearanceSettings | null);
      } catch {
        setToast({ message: 'Грешка при зареждане на настройките', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [status, isSuper]);

  async function handleUpload(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Грешка при качване');
    return String(data.url || '');
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/brand-appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Грешка при запазване');
      setSettings(data.settings as BrandAppearanceSettings);
      setToast({ message: '✅ Запазено — презареди сайта за пълен ефект', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка при запазване', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) return <ManagedLoadingScreen locale={locale} />;

  if (!isSuper) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 md:p-8">
        <div className="theme-card p-6">
          <p className="theme-muted">Само Super Admin може да редактира брандинга.</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-6xl">
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin`)}
          className="theme-muted mb-4 flex items-center gap-2 transition-colors hover:text-[var(--theme-ink)]"
        >
          <span>←</span>
          <span>Назад към таблото</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="theme-admin-heading-font theme-admin-page-title">🎨 Брандинг и външен вид</h1>
            <p className="theme-muted mt-2 max-w-2xl text-sm leading-relaxed">
              Цветове, лога, шрифтове и заглавие в таба. Празно поле = стойност по подразбиране от темата. Промените
              важат за публичния сайт, админ и staff след „Запази“.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="theme-btn-primary theme-btn-admin-compact w-full shrink-0 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Запазване...' : 'Запази всичко'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="min-w-0 space-y-6">
          <section className="theme-card rounded-xl p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-[var(--theme-ink)]">Име и таб на браузъра</h2>
            <p className="theme-muted text-sm">Какво пише в заглавието на таба и при „Добави към началния екран“.</p>
            <div className="grid grid-cols-1 gap-4">
              {(
                [
                  ['siteTitle', 'Заглавие в таба', 'напр. Ресторантски комплекс Дунав – Русе'],
                  ['siteShortName', 'Кратко име (икона на телефона)', 'напр. Дунав'],
                  ['siteDescription', 'Описание за Google / споделяне', 'напр. Меню, събития и поръчки…'],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-1">
                  <label className="theme-label">{label}</label>
                  <input
                    className="theme-field"
                    value={(settings as any)[key] ?? ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null } as any)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="theme-card rounded-xl p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-[var(--theme-ink)]">Шрифтове</h2>
            <p className="theme-muted text-sm leading-relaxed">
              От{' '}
              <a
                href="https://fonts.google.com/specimen/Ruslan+Display?lang=bg_Cyrl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--theme-accent)] underline"
              >
                Google Fonts
              </a>
              : „Get font“ → копирай <strong>link</strong> URL (не целия HTML таг) или само въведи името на шрифта
              по-долу.
            </p>
            <div className="space-y-1">
              <label className="theme-label">Link към Google Fonts (по избор)</label>
              <input
                className="theme-field font-mono text-xs"
                value={settings.googleFontsCssUrl ?? ''}
                onChange={(e) => setSettings({ ...settings, googleFontsCssUrl: e.target.value || null })}
                placeholder="https://fonts.googleapis.com/css2?family=Ruslan+Display&display=swap"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FONT_FIELDS.map(({ key, label, hint, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="theme-label">{label}</label>
                  <p className="theme-muted text-xs">{hint}</p>
                  <input
                    className="theme-field"
                    value={(settings as any)[key] ?? ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null } as any)}
                    placeholder={placeholder}
                    style={
                      (settings as any)[key]
                        ? { fontFamily: normalizeFontFamilyStack((settings as any)[key]) ?? undefined }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          {COLOR_GROUPS.map((group) => (
            <section key={group.title} className="theme-card rounded-xl p-6 md:p-8 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--theme-ink)]">{group.title}</h2>
                <p className="theme-muted mt-1 text-sm">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <ColorInput
                    key={field.key}
                    label={field.label}
                    hint={field.hint}
                    value={(settings[field.key] as string | null) ?? ''}
                    fallback={colorFieldFallback(field.key)}
                    onChange={(v) => setSettings({ ...settings, [field.key]: v } as BrandAppearanceSettings)}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="theme-card rounded-xl p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--theme-ink)]">Лога и икони</h2>
              <p className="theme-muted mt-1 text-sm">Качи PNG/WebP/SVG. Всяко поле има мини преглед отдолу.</p>
            </div>

            {LOGO_FIELDS.map(({ key, label, hint }) => {
              const url = String((settings as any)[key] || '');
              return (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/40 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--theme-ink)]">{label}</p>
                      <p className="theme-muted mt-1 text-xs leading-snug">{hint}</p>
                      {url ? (
                        <p className="theme-muted mt-2 break-all text-xs font-mono">{url}</p>
                      ) : (
                        <p className="theme-muted mt-2 text-xs italic">Няма качен файл — ползва се резервна икона</p>
                      )}
                    </div>
                    <label className="theme-btn-secondary inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold">
                      Качи файл
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.currentTarget.value = '';
                          if (!f) return;
                          try {
                            const nextUrl = await handleUpload(f);
                            setSettings({ ...settings, [key]: nextUrl || null } as any);
                            setToast({ message: '✅ Качено', type: 'success' });
                          } catch (err: any) {
                            setToast({ message: err?.message || 'Грешка при качване', type: 'error' });
                          }
                        }}
                      />
                    </label>
                  </div>

                  {url ? (
                    <div className="mt-3 flex items-center justify-center rounded-lg bg-black/5 p-3">
                      <Image
                        src={url}
                        alt={label}
                        width={320}
                        height={180}
                        className="h-auto max-h-28 w-auto object-contain"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="hidden xl:block">
          <BrandingPreview settings={settings} />
        </aside>
      </div>

      <div className="mt-8 xl:hidden">
        <BrandingPreview settings={settings} />
      </div>
    </div>
  );
}
