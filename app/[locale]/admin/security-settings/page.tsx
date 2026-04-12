'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/components/LoadingScreen';

export default function SecuritySettingsPage({
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

  const [securitySettings, setSecuritySettings] = useState({
    id: '',
    approvalOrderThreshold: 5,
    approvalTimeWindowMinutes: 5,
    sessionDurationHours: 3,
    autoRejectMinutes: 30
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setSettingsLoading(true);
    fetch('/api/security-settings')
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (data?.settings) {
          setSecuritySettings({
            id: data.settings.id || '',
            approvalOrderThreshold: data.settings.approvalOrderThreshold ?? 5,
            approvalTimeWindowMinutes: data.settings.approvalTimeWindowMinutes ?? 5,
            sessionDurationHours: data.settings.sessionDurationHours ?? 3,
            autoRejectMinutes: data.settings.autoRejectMinutes ?? 30
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

  const handleSettingsChange = (field: keyof typeof securitySettings, value: number) => {
    setSecuritySettings(prev => ({
      ...prev,
      [field]: value
    }));
    setSettingsMessage(null);
    setSettingsError(null);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsMessage(null);
    setSettingsError(null);

    try {
      const response = await fetch('/api/security-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(securitySettings)
      });

      const data = await response.json();

      if (response.ok) {
        setSettingsMessage('Настройките са запазени успешно!');
        setSecuritySettings({
          id: data.settings.id || securitySettings.id,
          approvalOrderThreshold: data.settings.approvalOrderThreshold ?? securitySettings.approvalOrderThreshold,
          approvalTimeWindowMinutes: data.settings.approvalTimeWindowMinutes ?? securitySettings.approvalTimeWindowMinutes,
          sessionDurationHours: data.settings.sessionDurationHours ?? securitySettings.sessionDurationHours,
          autoRejectMinutes: data.settings.autoRejectMinutes ?? securitySettings.autoRejectMinutes
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
    return <LoadingScreen locale={locale} />;
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
          <h1 className="malts-admin-heading-font malts-admin-page-title">Настройки за сигурност</h1>
          <p className="mt-2 malts-muted max-w-2xl">
            Определи след колко поръчки и в какъв период ще се изисква одобрение. Настройките се отразяват веднага.
          </p>
        </div>

        {/* Settings Form */}
        <div className="malts-card p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[var(--malts-ink)]">Конфигурация</h2>
            </div>
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

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="malts-label">
                Брой поръчки преди одобрение
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={securitySettings.approvalOrderThreshold}
                onChange={(e) => handleSettingsChange('approvalOrderThreshold', Number(e.target.value))}
                disabled={settingsLoading}
                className="malts-field"
              />
              <p className="malts-help">
                Колко поръчки от една маса преди да се изисква одобрение от администратор.
              </p>
            </div>

            <div className="space-y-2">
              <label className="malts-label">
                Времеви прозорец (минути)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={securitySettings.approvalTimeWindowMinutes}
                onChange={(e) => handleSettingsChange('approvalTimeWindowMinutes', Number(e.target.value))}
                disabled={settingsLoading}
                className="malts-field"
              />
              <p className="malts-help">Периодът, в който се броят поръчките (например 5 минути).</p>
            </div>

            <div className="space-y-2">
              <label className="malts-label">
                Валидност на сесиите (часове)
              </label>
              <input
                type="number"
                min={1}
                max={24}
                value={securitySettings.sessionDurationHours}
                onChange={(e) => handleSettingsChange('sessionDurationHours', Number(e.target.value))}
                disabled={settingsLoading}
                className="malts-field"
              />
              <p className="malts-help">Колко време QR сесията остава активна след сканиране.</p>
            </div>

            <div className="space-y-2">
              <label className="malts-label">
                Автоматично отхвърляне (минути)
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={securitySettings.autoRejectMinutes}
                onChange={(e) => handleSettingsChange('autoRejectMinutes', Number(e.target.value))}
                disabled={settingsLoading}
                className="malts-field"
              />
              <p className="malts-help">След колко време чакащите поръчки се отхвърлят автоматично.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

