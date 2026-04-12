'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ImageUpload from '@/components/ImageUpload';
import Toast from '@/components/Toast';
import LoadingScreen from '@/components/LoadingScreen';
import AutoTranslateButton from '@/components/AutoTranslateButton';

interface MenuSettings {
  id: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  subtitleBg: string;
  subtitleEn: string;
  subtitleRo: string;
  backgroundImageUrl: string | null;
}

export default function MenuSettingsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Redirect if not authenticated or wrong role
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) {
      return;
    }
    
    if (status === 'unauthenticated') {
      const timer = setTimeout(() => {
        if (typeof window !== 'undefined' && !(window as any).__isOffline) {
          window.location.href = `/${locale}/admin/login`;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    
    if (status === 'authenticated' && session?.user) {
      const userRole = (session.user as any)?.role;
      if (userRole === 'STAFF') {
        window.location.href = `/${locale}/staff`;
      }
    }
  }, [status, session, locale]);

  const [settings, setSettings] = useState<MenuSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const response = await fetch('/api/menu-settings');
      const data = await response.json();
      
      if (data.settings) {
        setSettings(data.settings);
      } else {
        // Initialize with defaults if no settings exist
        const defaultSettings: MenuSettings = {
          id: '',
          titleBg: 'Нашето Меню',
          titleEn: 'Our Menu',
          titleRo: 'Meniul nostru',
          subtitleBg: 'Открийте селекцията ни от напитки и деликатеси',
          subtitleEn: 'Discover our selection of drinks and delicacies',
          subtitleRo: 'Descoperă selecția noastră de băuturi și delicatese',
          backgroundImageUrl: null
        };
        setSettings(defaultSettings);
      }
    } catch (error) {
      console.error('Error loading menu settings:', error);
      setToast({ message: 'Грешка при зареждане на настройките', type: 'error' });
      // Set defaults on error
      const defaultSettings: MenuSettings = {
        id: '',
        titleBg: 'Нашето Меню',
        titleEn: 'Our Menu',
        titleRo: 'Meniul nostru',
        subtitleBg: 'Открийте селекцията ни от напитки и деликатеси',
        subtitleEn: 'Discover our selection of drinks and delicacies',
        subtitleRo: 'Descoperă selecția noastră de băuturi și delicatese',
        backgroundImageUrl: null
      };
      setSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/menu-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleBg: settings.titleBg,
          titleEn: settings.titleEn,
          titleRo: settings.titleRo,
          subtitleBg: settings.subtitleBg,
          subtitleEn: settings.subtitleEn,
          subtitleRo: settings.subtitleRo,
          backgroundImageUrl: settings.backgroundImageUrl
        })
      });

      if (response.ok) {
        setToast({ message: '✅ Настройките са запазени успешно', type: 'success' });
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Грешка при запазване', type: 'error' });
      }
    } catch (error) {
      console.error('Error saving menu settings:', error);
      setToast({ message: 'Грешка при запазване', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingScreen locale={locale} />;
  }

  if (!settings) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast Notification */}
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(`/${locale}/admin`)}
          className="malts-muted hover:text-[var(--malts-ink)] mb-4 flex items-center gap-2 transition-colors"
        >
          <span>←</span>
          <span>Назад към Dashboard</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="malts-admin-heading-font malts-admin-page-title">Настройки на меню</h1>
            <p className="malts-muted mt-2">
              Настрой заглавието, подзаглавието и фоновото изображение на меню страницата.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="malts-btn-primary malts-btn-admin-compact w-full shrink-0 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Запазване...' : 'Запази'}
          </button>
        </div>
      </div>

        {translationError && (
          <p className="text-sm malts-alert malts-alert-error mb-4" role="alert">
            {translationError}
          </p>
        )}

        {/* Settings Form */}
      <div className="malts-card rounded-xl p-6 md:p-8 space-y-8">
        {/* Titles */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--malts-ink)] mb-4">Заглавие</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="malts-label">Заглавие (БГ) *</label>
              <input
                type="text"
                value={settings?.titleBg || ''}
                onChange={(e) => setSettings({ ...settings!, titleBg: e.target.value })}
                className="malts-field"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="malts-label">Title (EN) *</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={settings?.titleBg || ''}
                  targetLang="en"
                  onTranslated={(text) => setSettings({ ...settings!, titleEn: text })}
                  onError={setTranslationError}
                />
              </div>
              <input
                type="text"
                value={settings?.titleEn || ''}
                onChange={(e) => setSettings({ ...settings!, titleEn: e.target.value })}
                className="malts-field"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="malts-label">Titlu (RO) *</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={settings?.titleBg || ''}
                  targetLang="ro"
                  onTranslated={(text) => setSettings({ ...settings!, titleRo: text })}
                  onError={setTranslationError}
                />
              </div>
              <input
                type="text"
                value={settings?.titleRo || ''}
                onChange={(e) => setSettings({ ...settings!, titleRo: e.target.value })}
                className="malts-field"
                required
              />
            </div>
          </div>
        </div>

        {/* Subtitles */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--malts-ink)] mb-4">Подзаглавие</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="malts-label">Подзаглавие (БГ) *</label>
              <textarea
                value={settings?.subtitleBg || ''}
                onChange={(e) => setSettings({ ...settings!, subtitleBg: e.target.value })}
                rows={3}
                className="malts-field"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="malts-label">Subtitle (EN) *</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={settings?.subtitleBg || ''}
                  targetLang="en"
                  onTranslated={(text) => setSettings({ ...settings!, subtitleEn: text })}
                  onError={setTranslationError}
                />
              </div>
              <textarea
                value={settings?.subtitleEn || ''}
                onChange={(e) => setSettings({ ...settings!, subtitleEn: e.target.value })}
                rows={3}
                className="malts-field"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <label className="malts-label">Subtitlu (RO) *</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={settings?.subtitleBg || ''}
                  targetLang="ro"
                  onTranslated={(text) => setSettings({ ...settings!, subtitleRo: text })}
                  onError={setTranslationError}
                />
              </div>
              <textarea
                value={settings?.subtitleRo || ''}
                onChange={(e) => setSettings({ ...settings!, subtitleRo: e.target.value })}
                rows={3}
                className="malts-field"
                required
              />
            </div>
          </div>
        </div>

        {/* Background Image */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--malts-ink)] mb-4">Фоново изображение</h2>
          <div className="bg-[var(--malts-inset)] p-6 rounded-xl border border-[var(--malts-hairline)]">
            <p className="malts-muted mb-4">
              Препоръчителни размери: <span className="font-semibold text-[var(--malts-ink)]">1920x600px</span> (широк формат за hero секция)
            </p>
            <p className="malts-muted text-sm mb-4">
              Изображението ще се показва като фон в hero секцията на меню страницата. За най-добър резултат използвайте широко изображение с височина около 600px.
            </p>
            <ImageUpload
              currentImageUrl={settings?.backgroundImageUrl || ''}
              onImageUploaded={(url) => setSettings({ ...settings!, backgroundImageUrl: url })}
              bucket="menu-backgrounds"
              recommendedSize="1920x600px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

