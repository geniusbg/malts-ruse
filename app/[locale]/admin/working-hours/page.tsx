'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Toast from '@/components/Toast';
import LoadingScreen from '@/components/LoadingScreen';

interface WorkingHour {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string | null;
  closeTime: string | null;
}

const DAYS = [
  { dayOfWeek: 1, nameBg: 'Понеделник', nameEn: 'Monday', nameRo: 'Montag', short: 'Пон' },
  { dayOfWeek: 2, nameBg: 'Вторник', nameEn: 'Tuesday', nameRo: 'Dienstag', short: 'Вт' },
  { dayOfWeek: 3, nameBg: 'Сряда', nameEn: 'Wednesday', nameRo: 'Mittwoch', short: 'Ср' },
  { dayOfWeek: 4, nameBg: 'Четвъртък', nameEn: 'Thursday', nameRo: 'Donnerstag', short: 'Чет' },
  { dayOfWeek: 5, nameBg: 'Петък', nameEn: 'Friday', nameRo: 'Freitag', short: 'Пет' },
  { dayOfWeek: 6, nameBg: 'Събота', nameEn: 'Saturday', nameRo: 'Samstag', short: 'Съб' },
  { dayOfWeek: 0, nameBg: 'Неделя', nameEn: 'Sunday', nameRo: 'Sonntag', short: 'Нед' }
];

export default function WorkingHoursPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const router = useRouter();
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadWorkingHours();
  }, []);

  const loadWorkingHours = async () => {
    try {
      const response = await fetch('/api/working-hours', {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (response.ok) {
        // Sort by dayOfWeek
        const sorted = data.workingHours.sort((a: WorkingHour, b: WorkingHour) => 
          a.dayOfWeek - b.dayOfWeek
        );
        setWorkingHours(sorted);
      } else {
        setToast({ message: 'Грешка при зареждане на работно време', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при зареждане на работно време', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (dayOfWeek: number, field: 'isOpen' | 'openTime' | 'closeTime', value: boolean | string) => {
    setWorkingHours(prev =>
      prev.map(day =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, [field]: value }
          : day
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/working-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workingHours })
      });

      const data = await response.json();

      if (response.ok) {
        setToast({ 
          message: locale === 'bg' ? 'Работното време е запазено успешно!' : 
                  locale === 'en' ? 'Working hours saved successfully!' : 
                  'Arbeitszeiten erfolgreich gespeichert!', 
          type: 'success' 
        });
      } else {
        setToast({ 
          message: locale === 'bg' ? 'Грешка при запазване' : 
                  locale === 'en' ? 'Error saving' : 
                  'Fehler beim Speichern', 
          type: 'error' 
        });
      }
    } catch (error) {
      setToast({ 
        message: locale === 'bg' ? 'Грешка при запазване' : 
                locale === 'en' ? 'Error saving' : 
                'Fehler beim Speichern', 
        type: 'error' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen locale={locale} />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title mb-3">
          {locale === 'bg' ? 'Работно време' : locale === 'en' ? 'Working Hours' : 'Arbeitszeiten'}
        </h1>
        <p className="malts-muted text-lg">
          {locale === 'bg' ? 'Управление на работното време за всеки ден от седмицата' : 
           locale === 'en' ? 'Manage working hours for each day of the week' : 
           'Verwalten Sie die Arbeitszeiten für jeden Tag der Woche'}
        </p>
      </div>

      <div className="malts-card rounded-2xl p-6 md:p-8">
        <div className="space-y-4">
          {DAYS.map(day => {
            const dayData = workingHours.find(wh => wh.dayOfWeek === day.dayOfWeek);
            if (!dayData) return null;

            const dayName = locale === 'bg' ? day.nameBg : locale === 'en' ? day.nameEn : day.nameRo;

            return (
              <div
                key={day.dayOfWeek}
                className="bg-[var(--malts-inset)] border border-[var(--malts-hairline)] rounded-xl p-4 md:p-6"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dayData.isOpen}
                        onChange={(e) => handleDayChange(day.dayOfWeek, 'isOpen', e.target.checked)}
                        className="w-5 h-5 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                      />
                      <span className="text-[var(--malts-ink)] font-semibold text-lg md:text-xl">
                        {dayName}
                      </span>
                    </label>
                  </div>

                  {dayData.isOpen && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="malts-muted text-sm">
                          {locale === 'bg' ? 'От' : locale === 'en' ? 'From' : 'Von'}
                        </label>
                        <input
                          type="time"
                          value={dayData.openTime || '10:00'}
                          onChange={(e) => handleDayChange(day.dayOfWeek, 'openTime', e.target.value)}
                          className="malts-field"
                        />
                      </div>
                      <span className="malts-muted">-</span>
                      <div className="flex items-center gap-2">
                        <label className="malts-muted text-sm">
                          {locale === 'bg' ? 'До' : locale === 'en' ? 'To' : 'Bis'}
                        </label>
                        <input
                          type="time"
                          value={dayData.closeTime || '00:00'}
                          onChange={(e) => handleDayChange(day.dayOfWeek, 'closeTime', e.target.value)}
                          className="malts-field"
                        />
                      </div>
                    </div>
                  )}

                  {!dayData.isOpen && (
                    <span className="malts-muted text-sm md:text-base">
                      {locale === 'bg' ? 'Затворено' : locale === 'en' ? 'Closed' : 'Geschlossen'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="malts-btn-primary malts-btn-admin-compact flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-[#f5f0e6] border-t-transparent rounded-full animate-spin"></div>
                <span>{locale === 'bg' ? 'Запазване...' : locale === 'en' ? 'Saving...' : 'Speichern...'}</span>
              </>
            ) : (
              <>
                ✓ {locale === 'bg' ? 'Запази' : locale === 'en' ? 'Save' : 'Speichern'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

