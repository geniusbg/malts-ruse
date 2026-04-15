'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import AutoTranslateButton from '@/components/AutoTranslateButton';

export default function LocationSettingsPage({
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

  const [locationSettings, setLocationSettings] = useState({
    id: '',
    addressBg: '',
    addressEn: '',
    addressRo: '',
    phone: '',
    instagramUrl: '',
    facebookUrl: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setSettingsLoading(true);
    fetch('/api/location-settings')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data?.settings) {
          setLocationSettings({
            id: data.settings.id || '',
            addressBg: data.settings.addressBg || '',
            addressEn: data.settings.addressEn || '',
            addressRo: data.settings.addressRo || '',
            phone: data.settings.phone || '',
            instagramUrl: data.settings.instagramUrl || '',
            facebookUrl: data.settings.facebookUrl || '',
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setSettingsError('Грешка при зареждане на настройките.');
      })
      .finally(() => {
        if (!isMounted) return;
        setSettingsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSettingsChange = (field: keyof typeof locationSettings, value: string) => {
    setLocationSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setSettingsMessage(null);
    setSettingsError(null);
    setTranslationError(null);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    setSettingsError(null);

    try {
      const response = await fetch('/api/location-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressBg: locationSettings.addressBg,
          addressEn: locationSettings.addressEn,
          addressRo: locationSettings.addressRo,
          phone: locationSettings.phone,
          instagramUrl: locationSettings.instagramUrl,
          facebookUrl: locationSettings.facebookUrl,
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSettingsMessage('Настройките са запазени успешно!');
        setLocationSettings({
          id: data.settings.id || locationSettings.id,
          addressBg: data.settings.addressBg ?? locationSettings.addressBg,
          addressEn: data.settings.addressEn ?? locationSettings.addressEn,
          addressRo: data.settings.addressRo ?? locationSettings.addressRo,
          phone: data.settings.phone ?? locationSettings.phone,
          instagramUrl: data.settings.instagramUrl ?? locationSettings.instagramUrl,
          facebookUrl: data.settings.facebookUrl ?? locationSettings.facebookUrl,
        });
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsError(data.error || 'Грешка при запазване на настройките.');
      }
    } catch (error) {
      setSettingsError('Грешка при връзка със сървъра.');
    } finally {
      setSavingSettings(false);
    }
  };

  if (status === 'loading' || settingsLoading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/admin`)}
            className="mb-4 flex items-center gap-2 malts-muted hover:text-[var(--malts-ink)] transition-colors"
          >
            <span aria-hidden>←</span>
            <span>Назад към Dashboard</span>
          </button>
          <h1 className="malts-admin-heading-font malts-admin-page-title">Контакти</h1>
          <p className="mt-2 malts-muted max-w-2xl">
            Настрой контактите на заведението. Те се показват в страницата „Контакти“ и на началната страница.
          </p>
        </div>

        {/* Settings Form */}
        <div className="malts-card p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div />
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={settingsLoading || savingSettings}
              className={`malts-btn-admin-compact w-full rounded-xl font-semibold transition-all sm:w-auto ${
                settingsLoading || savingSettings
                  ? 'malts-btn-secondary cursor-not-allowed opacity-50'
                  : 'malts-btn-primary'
              }`}
            >
              {savingSettings ? 'Запазване...' : 'Запази настройките'}
            </button>
          </div>

          {settingsMessage && (
            <div
              className="mb-4 malts-alert malts-alert-success"
              role="status"
            >
              {settingsMessage}
            </div>
          )}
          {settingsError && (
            <div
              className="mb-4 malts-alert malts-alert-error"
              role="alert"
            >
              {settingsError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="malts-label">Телефон</label>
                <input
                  type="tel"
                  value={locationSettings.phone}
                  onChange={(e) => handleSettingsChange('phone', e.target.value)}
                  disabled={settingsLoading}
                  className="malts-field"
                  placeholder="089 853 6542"
                />
                <p className="malts-help">Показва се като линк за набиране.</p>
              </div>

              <div className="space-y-2">
                <label className="malts-label">Instagram URL</label>
                <input
                  type="url"
                  value={locationSettings.instagramUrl}
                  onChange={(e) => handleSettingsChange('instagramUrl', e.target.value)}
                  disabled={settingsLoading}
                  className="malts-field"
                  placeholder="https://instagram.com/yourpage"
                />
              </div>

              <div className="space-y-2">
                <label className="malts-label">Facebook URL</label>
                <input
                  type="url"
                  value={locationSettings.facebookUrl}
                  onChange={(e) => handleSettingsChange('facebookUrl', e.target.value)}
                  disabled={settingsLoading}
                  className="malts-field"
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="malts-label">
                Адрес (български)
              </label>
              <textarea
                value={locationSettings.addressBg}
                onChange={(e) => handleSettingsChange('addressBg', e.target.value)}
                disabled={settingsLoading}
                className="malts-field"
                rows={3}
                placeholder="Русе, ул. Александровска 97"
              />
              <p className="malts-help">
                Адресът, който се показва на българската версия на сайта. Използвай „Авто превод“ в EN/RO от този текст.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="malts-label">
                  Address (English)
                </label>
                <AutoTranslateButton
                  sourceText={locationSettings.addressBg}
                  targetLang="en"
                  onTranslated={(text) => handleSettingsChange('addressEn', text)}
                  onError={setTranslationError}
                  disabled={settingsLoading}
                />
              </div>
              <input
                type="text"
                value={locationSettings.addressEn}
                onChange={(e) => handleSettingsChange('addressEn', e.target.value)}
                disabled={settingsLoading}
                className="malts-field"
                placeholder="Ruse, 97 Alexandrovska St"
              />
              <p className="malts-help">
                The address displayed on the English version of the site.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="malts-label">
                  Address (Romanian)
                </label>
                <AutoTranslateButton
                  sourceText={locationSettings.addressBg}
                  targetLang="ro"
                  onTranslated={(text) => handleSettingsChange('addressRo', text)}
                  onError={setTranslationError}
                  disabled={settingsLoading}
                />
              </div>
              <input
                type="text"
                value={locationSettings.addressRo}
                onChange={(e) => handleSettingsChange('addressRo', e.target.value)}
                disabled={settingsLoading}
                className="malts-field"
                placeholder="Ruse, Alexandrovska Str. 97"
              />
              <p className="malts-help">
                Adresa afișată pe versiunea română a site-ului.
              </p>
            </div>
          </div>

          {translationError && (
            <div className="mt-2 malts-alert malts-alert-error" role="alert">{translationError}</div>
          )}
        </div>
      </div>
    </div>
  );
}

