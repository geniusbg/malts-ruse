'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import AutoTranslateButton from '@/components/AutoTranslateButton';
import OfferingCardIcon from '@/components/OfferingCardIcon';
import ConfirmModal from '@/components/ConfirmModal';
import { useLockScroll } from '@/lib/use-lock-scroll';

interface HomepageSettings {
  id: string;
  sectionLabelBg: string;
  sectionLabelEn: string;
  sectionLabelRo: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  subtitleBg: string;
  subtitleEn: string;
  subtitleRo: string;
  descriptionBg: string;
  descriptionEn: string;
  descriptionRo: string;
  moodTextBg: string;
  moodTextEn: string;
  moodTextRo: string;
  offeringsNoteBg: string;
  offeringsNoteEn: string;
  offeringsNoteRo: string;
  highlightsLabelBg: string;
  highlightsLabelEn: string;
  highlightsLabelRo: string;
  cardsHeadingBg: string;
  cardsHeadingEn: string;
  cardsHeadingRo: string;
  stats: {
    bg: { label: string; value: string }[];
    en: { label: string; value: string }[];
    ro: { label: string; value: string }[];
  };
  ctaPrimaryBg: string;
  ctaPrimaryEn: string;
  ctaPrimaryRo: string;
  ctaSecondaryBg: string;
  ctaSecondaryEn: string;
  ctaSecondaryRo: string;
}

interface OfferingCard {
  id: string;
  order: number;
  icon: string;
  titleBg: string;
  titleEn: string;
  titleRo: string;
  descriptionBg: string;
  descriptionEn: string;
  descriptionRo: string;
  badgeBg: string;
  badgeEn: string;
  badgeRo: string;
  highlights: {
    bg: string[];
    en: string[];
    ro: string[];
  };
  isActive: boolean;
}

export default function HomepageSettingsPage({
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

  const [settings, setSettings] = useState<HomepageSettings | null>(null);
  const [cards, setCards] = useState<OfferingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'stats' | 'cards'>('general');
  const [editingCard, setEditingCard] = useState<OfferingCard | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [translateErr, setTranslateErr] = useState<string | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  useLockScroll(showCardModal);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    
    Promise.all([
      fetch('/api/homepage-settings').then(res => res.json()),
      fetch('/api/homepage-offering-cards').then(res => res.json())
    ])
      .then(([settingsData, cardsData]) => {
        if (!isMounted) return;
        if (settingsData?.settings) {
          setSettings(settingsData.settings);
        }
        if (cardsData?.cards) {
          setCards(cardsData.cards);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Грешка при зареждане на настройките.');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch('/api/homepage-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Настройките са запазени успешно!');
        if (data.settings) {
          setSettings(data.settings);
        }
        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(data.error || 'Грешка при запазване на настройките.');
      }
    } catch (error) {
      setError('Грешка при връзка със сървъра.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCard = async (card: OfferingCard) => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const url = card.id ? `/api/homepage-offering-cards/${card.id}` : '/api/homepage-offering-cards';
      const method = card.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Картата е запазена успешно!');
        if (data.card) {
          if (card.id) {
            setCards(cards.map(c => c.id === card.id ? data.card : c));
          } else {
            setCards([...cards, data.card]);
          }
        }
        setShowCardModal(false);
        setEditingCard(null);
        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(data.error || 'Грешка при запазване на картата.');
      }
    } catch (error) {
      setError('Грешка при връзка със сървъра.');
    } finally {
      setSaving(false);
    }
  };

  const executeDeleteCard = async () => {
    if (!deleteCardId) return;
    const cardId = deleteCardId;
    setDeleteCardId(null);

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/homepage-offering-cards/${cardId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setCards(cards.filter(c => c.id !== cardId));
        setMessage('Картата е изтрита успешно!');
        setTimeout(() => setMessage(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Грешка при изтриване на картата.');
      }
    } catch (error) {
      setError('Грешка при връзка със сървъра.');
    } finally {
      setSaving(false);
    }
  };

  const updateHighlightValue = (localeKey: 'bg' | 'en' | 'ro', index: number, value: string) => {
    if (!editingCard) return;

    const nextHighlights = {
      ...editingCard.highlights,
      [localeKey]: editingCard.highlights[localeKey].map((item, idx) => (idx === index ? value : item))
    };

    setEditingCard({
      ...editingCard,
      highlights: nextHighlights
    });
  };

  // Keep highlight rows aligned across languages.
  // When adding/removing, we do it for bg/en/ro together so indexes match.
  const addHighlightRowAll = () => {
    if (!editingCard) return;
    setEditingCard({
      ...editingCard,
      highlights: {
        bg: [...editingCard.highlights.bg, ''],
        en: [...editingCard.highlights.en, ''],
        ro: [...editingCard.highlights.ro, ''],
      }
    });
  };

  const removeHighlightRowAll = (index: number) => {
    if (!editingCard) return;
    setEditingCard({
      ...editingCard,
      highlights: {
        bg: editingCard.highlights.bg.filter((_, idx) => idx !== index),
        en: editingCard.highlights.en.filter((_, idx) => idx !== index),
        ro: editingCard.highlights.ro.filter((_, idx) => idx !== index),
      }
    });
  };

  if (status === 'loading' || loading || !settings) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/${locale}/admin`)}
            className="malts-muted hover:text-[var(--malts-ink)] mb-4 flex items-center gap-2 transition-colors"
          >
            <span>←</span>
            <span>Назад към Dashboard</span>
          </button>
          <h1 className="malts-admin-heading-font malts-admin-page-title">Настройки на началната страница</h1>
          <p className="malts-muted mt-2">
            Управлявай съдържанието на секцията "Предложения" на началната страница.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--malts-hairline)]">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'general'
                ? 'text-[var(--malts-ink)] border-b-2 border-[var(--malts-accent)]'
                : 'malts-muted hover:text-[var(--malts-ink)]'
            }`}
          >
            Общи настройки
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'stats'
                ? 'text-[var(--malts-ink)] border-b-2 border-[var(--malts-accent)]'
                : 'malts-muted hover:text-[var(--malts-ink)]'
            }`}
          >
            Статистики
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'cards'
                ? 'text-[var(--malts-ink)] border-b-2 border-[var(--malts-accent)]'
                : 'malts-muted hover:text-[var(--malts-ink)]'
            }`}
          >
            Карти ({cards.length})
          </button>
        </div>

        {message && (
          <div
            className="mb-4 malts-alert malts-alert-success"
            role="status"
          >
            {message}
          </div>
        )}
        {error && (
          <div
            className="mb-4 malts-alert malts-alert-error"
            role="alert"
          >
            {error}
          </div>
        )}
        {translateErr && (
          <div className="mb-4 malts-alert malts-alert-error text-sm" role="alert">
            {translateErr}
          </div>
        )}

        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <div className="malts-card p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold">Общи настройки</h2>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className={`malts-btn-admin-compact w-full rounded-xl font-semibold transition-all sm:w-auto ${
                  saving
                    ? 'malts-btn-secondary cursor-not-allowed opacity-50'
                    : 'malts-btn-primary'
                }`}
              >
                {saving ? 'Запазване...' : 'Запази'}
              </button>
            </div>

            <div className="space-y-6">
              {/* Section Label */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Етикет на секцията (БГ)</label>
                  <input
                    type="text"
                    value={settings.sectionLabelBg}
                    onChange={(e) => setSettings({ ...settings, sectionLabelBg: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Етикет на секцията (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.sectionLabelBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, sectionLabelEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.sectionLabelEn}
                    onChange={(e) => setSettings({ ...settings, sectionLabelEn: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Етикет на секцията (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.sectionLabelBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, sectionLabelRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.sectionLabelRo}
                    onChange={(e) => setSettings({ ...settings, sectionLabelRo: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* Title */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Заглавие (БГ)</label>
                  <input
                    type="text"
                    value={settings.titleBg}
                    onChange={(e) => setSettings({ ...settings, titleBg: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Заглавие (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.titleBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, titleEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.titleEn}
                    onChange={(e) => setSettings({ ...settings, titleEn: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Заглавие (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.titleBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, titleRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.titleRo}
                    onChange={(e) => setSettings({ ...settings, titleRo: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Подзаглавие (БГ)</label>
                  <input
                    type="text"
                    value={settings.subtitleBg}
                    onChange={(e) => setSettings({ ...settings, subtitleBg: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Подзаглавие (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.subtitleBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, subtitleEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.subtitleEn}
                    onChange={(e) => setSettings({ ...settings, subtitleEn: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Подзаглавие (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.subtitleBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, subtitleRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.subtitleRo}
                    onChange={(e) => setSettings({ ...settings, subtitleRo: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* Cards heading (shown above the cards grid) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Заглавие над картите (БГ)</label>
                  <input
                    type="text"
                    value={settings.cardsHeadingBg}
                    onChange={(e) => setSettings({ ...settings, cardsHeadingBg: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                    placeholder="напр. Акценти"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Заглавие над картите (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.cardsHeadingBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, cardsHeadingEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.cardsHeadingEn}
                    onChange={(e) => setSettings({ ...settings, cardsHeadingEn: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                    placeholder="e.g. Highlights"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Заглавие над картите (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.cardsHeadingBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, cardsHeadingRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.cardsHeadingRo}
                    onChange={(e) => setSettings({ ...settings, cardsHeadingRo: e.target.value })}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                    placeholder="ex. Accente"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Описание (БГ)</label>
                  <textarea
                    value={settings.descriptionBg}
                    onChange={(e) => setSettings({ ...settings, descriptionBg: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Описание (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.descriptionBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, descriptionEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.descriptionEn}
                    onChange={(e) => setSettings({ ...settings, descriptionEn: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Описание (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.descriptionBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, descriptionRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.descriptionRo}
                    onChange={(e) => setSettings({ ...settings, descriptionRo: e.target.value })}
                    rows={4}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* Mood Text */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Текст под логото (БГ)</label>
                  <textarea
                    value={settings.moodTextBg}
                    onChange={(e) => setSettings({ ...settings, moodTextBg: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Текст под логото (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.moodTextBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, moodTextEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.moodTextEn}
                    onChange={(e) => setSettings({ ...settings, moodTextEn: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Текст под логото (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.moodTextBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, moodTextRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.moodTextRo}
                    onChange={(e) => setSettings({ ...settings, moodTextRo: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* Offerings Note */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold malts-subtle mb-2">Текст в „Какво предлагаме“ (БГ)</label>
                  <textarea
                    value={settings.offeringsNoteBg}
                    onChange={(e) => setSettings({ ...settings, offeringsNoteBg: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Текст в „Какво предлагаме“ (EN)</label>
                    <AutoTranslateButton
                      sourceText={settings.offeringsNoteBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, offeringsNoteEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.offeringsNoteEn}
                    onChange={(e) => setSettings({ ...settings, offeringsNoteEn: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="block text-sm font-semibold malts-subtle">Текст в „Какво предлагаме“ (RO)</label>
                    <AutoTranslateButton
                      sourceText={settings.offeringsNoteBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, offeringsNoteRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <textarea
                    value={settings.offeringsNoteRo}
                    onChange={(e) => setSettings({ ...settings, offeringsNoteRo: e.target.value })}
                    rows={2}
                    className="w-full rounded-xl malts-inset px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--malts-accent-tint-border)]"
                  />
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="malts-label">Основен призив (БГ)</label>
                  <input
                    type="text"
                    value={settings.ctaPrimaryBg}
                    onChange={(e) => setSettings({ ...settings, ctaPrimaryBg: e.target.value })}
                    className="malts-field"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="malts-label">Основен призив (EN)</label>
                    <AutoTranslateButton
                      variant="dark"
                      sourceText={settings.ctaPrimaryBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, ctaPrimaryEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.ctaPrimaryEn}
                    onChange={(e) => setSettings({ ...settings, ctaPrimaryEn: e.target.value })}
                    className="malts-field"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="malts-label">Основен призив (RO)</label>
                    <AutoTranslateButton
                      variant="dark"
                      sourceText={settings.ctaPrimaryBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, ctaPrimaryRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.ctaPrimaryRo}
                    onChange={(e) => setSettings({ ...settings, ctaPrimaryRo: e.target.value })}
                    className="malts-field"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="malts-label">Втори призив (БГ)</label>
                  <input
                    type="text"
                    value={settings.ctaSecondaryBg}
                    onChange={(e) => setSettings({ ...settings, ctaSecondaryBg: e.target.value })}
                    className="malts-field"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="malts-label">Втори призив (EN)</label>
                    <AutoTranslateButton
                      variant="dark"
                      sourceText={settings.ctaSecondaryBg}
                      targetLang="en"
                      onTranslated={(text) => setSettings({ ...settings, ctaSecondaryEn: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.ctaSecondaryEn}
                    onChange={(e) => setSettings({ ...settings, ctaSecondaryEn: e.target.value })}
                    className="malts-field"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center gap-2 mb-2">
                    <label className="malts-label">Втори призив (RO)</label>
                    <AutoTranslateButton
                      variant="dark"
                      sourceText={settings.ctaSecondaryBg}
                      targetLang="ro"
                      onTranslated={(text) => setSettings({ ...settings, ctaSecondaryRo: text })}
                      onError={setTranslateErr}
                    />
                  </div>
                  <input
                    type="text"
                    value={settings.ctaSecondaryRo}
                    onChange={(e) => setSettings({ ...settings, ctaSecondaryRo: e.target.value })}
                    className="malts-field"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="malts-card rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-[var(--malts-ink)]">Статистики</h2>
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className={`malts-btn-admin-compact w-full rounded-xl font-semibold transition-all sm:w-auto ${
                  saving
                    ? 'malts-btn-secondary cursor-not-allowed opacity-50'
                    : 'malts-btn-primary'
                }`}
              >
                {saving ? 'Запазване...' : 'Запази'}
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4">Български</h3>
                {settings.stats.bg.map((stat, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={stat.label}
                      onChange={(e) => {
                        const newStats = { ...settings.stats };
                        newStats.bg[index].label = e.target.value;
                        setSettings({ ...settings, stats: newStats });
                      }}
                      placeholder="Label"
                      className="malts-field"
                    />
                    <input
                      type="text"
                      value={stat.value}
                      onChange={(e) => {
                        const newStats = { ...settings.stats };
                        newStats.bg[index].value = e.target.value;
                        setSettings({ ...settings, stats: newStats });
                      }}
                      placeholder="Value"
                      className="malts-field"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newStats = { ...settings.stats };
                    newStats.bg.push({ label: '', value: '' });
                    setSettings({ ...settings, stats: newStats });
                  }}
                  className="malts-muted hover:text-[var(--malts-ink)] text-sm"
                >
                  + Добави статистика
                </button>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4">English</h3>
                {settings.stats.en.map((stat, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => {
                          const newStats = { ...settings.stats };
                          newStats.en[index].label = e.target.value;
                          setSettings({ ...settings, stats: newStats });
                        }}
                        placeholder="Label"
                        className="malts-field flex-1 min-w-0"
                      />
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={settings.stats.bg[index]?.label || ''}
                        targetLang="en"
                        onTranslated={(text) => {
                          const newStats = { ...settings.stats };
                          newStats.en[index].label = text;
                          setSettings({ ...settings, stats: newStats });
                        }}
                        onError={setTranslateErr}
                        className="mt-0.5"
                      />
                    </div>
                    <input
                      type="text"
                      value={stat.value}
                      onChange={(e) => {
                        const newStats = { ...settings.stats };
                        newStats.en[index].value = e.target.value;
                        setSettings({ ...settings, stats: newStats });
                      }}
                      placeholder="Value"
                      className="malts-field"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newStats = { ...settings.stats };
                    newStats.en.push({ label: '', value: '' });
                    setSettings({ ...settings, stats: newStats });
                  }}
                  className="malts-muted hover:text-[var(--malts-ink)] text-sm"
                >
                  + Add stat
                </button>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[var(--malts-ink)] mb-4">Română</h3>
                {settings.stats.ro.map((stat, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex gap-2 items-start">
                      <input
                        type="text"
                        value={stat.label}
                        onChange={(e) => {
                          const newStats = { ...settings.stats };
                          newStats.ro[index].label = e.target.value;
                          setSettings({ ...settings, stats: newStats });
                        }}
                        placeholder="Label"
                        className="malts-field flex-1 min-w-0"
                      />
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={settings.stats.bg[index]?.label || ''}
                        targetLang="ro"
                        onTranslated={(text) => {
                          const newStats = { ...settings.stats };
                          newStats.ro[index].label = text;
                          setSettings({ ...settings, stats: newStats });
                        }}
                        onError={setTranslateErr}
                        className="mt-0.5"
                      />
                    </div>
                    <input
                      type="text"
                      value={stat.value}
                      onChange={(e) => {
                        const newStats = { ...settings.stats };
                        newStats.ro[index].value = e.target.value;
                        setSettings({ ...settings, stats: newStats });
                      }}
                      placeholder="Value"
                      className="malts-field"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newStats = { ...settings.stats };
                    newStats.ro.push({ label: '', value: '' });
                    setSettings({ ...settings, stats: newStats });
                  }}
                  className="malts-muted hover:text-[var(--malts-ink)] text-sm"
                >
                  + Statistik hinzufügen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cards Tab */}
        {activeTab === 'cards' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-[var(--malts-ink)]">Карти</h2>
              <button
                onClick={() => {
                  setEditingCard({
                    id: '',
                    order: cards.length,
                    icon: '✨',
                    titleBg: '',
                    titleEn: '',
                    titleRo: '',
                    descriptionBg: '',
                    descriptionEn: '',
                    descriptionRo: '',
                    badgeBg: '',
                    badgeEn: '',
                    badgeRo: '',
                    highlights: { bg: [], en: [], ro: [] },
                    isActive: true
                  });
                  setShowCardModal(true);
                }}
                className="malts-btn-primary malts-btn-admin-compact w-full rounded-xl font-semibold transition-all sm:w-auto"
              >
                + Добави карта
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="malts-card rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex h-12 w-12 items-center justify-center text-4xl">
                      <OfferingCardIcon icon={card.icon} />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingCard(card);
                          setShowCardModal(true);
                        }}
                        className="px-3 py-1 rounded-lg malts-btn-secondary text-sm"
                      >
                        Редактирай
                      </button>
                      <button
                        onClick={() => setDeleteCardId(card.id)}
                        className="px-3 py-1 rounded-lg malts-btn-danger text-sm"
                      >
                        Изтрий
                      </button>
                    </div>
                  </div>
                  <h3 className="text-[var(--malts-ink)] font-semibold mb-2">{card.titleBg}</h3>
                  <p className="malts-muted text-sm mb-2">{card.descriptionBg.substring(0, 100)}...</p>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-xs malts-muted">Badge: {card.badgeBg}</span>
                    <span className="text-xs malts-muted">Order: {card.order}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card Modal */}
        {showCardModal && editingCard && (
          <div className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="malts-card rounded-2xl p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-[var(--malts-ink)]">
                  {editingCard.id ? 'Редактирай карта' : 'Добави карта'}
                </h3>
                <button
                  onClick={() => {
                    setShowCardModal(false);
                    setEditingCard(null);
                  }}
                  className="text-[var(--malts-subtle)] hover:text-[var(--malts-ink)]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="malts-label">Икона (емоджи или път)</label>
                    <input
                      type="text"
                      value={editingCard.icon}
                      onChange={(e) => setEditingCard({ ...editingCard, icon: e.target.value })}
                      className="malts-field"
                      placeholder="напр. ☕ или /nasheto-menu.webp"
                    />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[
                          '🍺','🍷','🥂','🍸','🍹','🥃','☕','🍋','🥤','🍽️','🥗','🧀','🥩','🍕','🍰','🔥','⭐'
                        ].map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setEditingCard({ ...editingCard, icon: ic })}
                            className={`h-9 w-9 rounded-xl border border-[var(--malts-hairline)] bg-[var(--malts-inset)] text-lg transition-colors hover:bg-[var(--malts-card-hover)] ${
                              editingCard.icon === ic ? 'ring-2 ring-[var(--malts-accent-tint-border)]' : ''
                            }`}
                            aria-label={`Pick icon ${ic}`}
                            title={ic}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                  </div>
                  <div>
                    <label className="malts-label">Позиция (подредба)</label>
                    <input
                      type="number"
                      value={editingCard.order}
                      onChange={(e) => setEditingCard({ ...editingCard, order: Number(e.target.value) })}
                      className="malts-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="malts-label">Заглавие (BG)</label>
                    <input
                      type="text"
                      value={editingCard.titleBg}
                      onChange={(e) => setEditingCard({ ...editingCard, titleBg: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Заглавие (EN)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.titleBg}
                        targetLang="en"
                        onTranslated={(text) => setEditingCard({ ...editingCard, titleEn: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <input
                      type="text"
                      value={editingCard.titleEn}
                      onChange={(e) => setEditingCard({ ...editingCard, titleEn: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Заглавие (RO)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.titleBg}
                        targetLang="ro"
                        onTranslated={(text) => setEditingCard({ ...editingCard, titleRo: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <input
                      type="text"
                      value={editingCard.titleRo}
                      onChange={(e) => setEditingCard({ ...editingCard, titleRo: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="malts-label">Описание (BG)</label>
                    <textarea
                      value={editingCard.descriptionBg}
                      onChange={(e) => setEditingCard({ ...editingCard, descriptionBg: e.target.value })}
                      rows={4}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Описание (EN)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.descriptionBg}
                        targetLang="en"
                        onTranslated={(text) => setEditingCard({ ...editingCard, descriptionEn: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <textarea
                      value={editingCard.descriptionEn}
                      onChange={(e) => setEditingCard({ ...editingCard, descriptionEn: e.target.value })}
                      rows={4}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Описание (RO)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.descriptionBg}
                        targetLang="ro"
                        onTranslated={(text) => setEditingCard({ ...editingCard, descriptionRo: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <textarea
                      value={editingCard.descriptionRo}
                      onChange={(e) => setEditingCard({ ...editingCard, descriptionRo: e.target.value })}
                      rows={4}
                      className="malts-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="malts-label">Бадж (BG)</label>
                    <input
                      type="text"
                      value={editingCard.badgeBg}
                      onChange={(e) => setEditingCard({ ...editingCard, badgeBg: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Бадж (EN)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.badgeBg}
                        targetLang="en"
                        onTranslated={(text) => setEditingCard({ ...editingCard, badgeEn: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <input
                      type="text"
                      value={editingCard.badgeEn}
                      onChange={(e) => setEditingCard({ ...editingCard, badgeEn: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center gap-2 mb-2">
                      <label className="malts-label">Бадж (RO)</label>
                      <AutoTranslateButton
                        variant="dark"
                        sourceText={editingCard.badgeBg}
                        targetLang="ro"
                        onTranslated={(text) => setEditingCard({ ...editingCard, badgeRo: text })}
                        onError={setTranslateErr}
                      />
                    </div>
                    <input
                      type="text"
                      value={editingCard.badgeRo}
                      onChange={(e) => setEditingCard({ ...editingCard, badgeRo: e.target.value })}
                      className="malts-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="malts-label">Акценти (едно поле = един акцент)</label>
                  <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="malts-label">Етикет над акцентите (BG)</label>
                      <input
                        type="text"
                        value={settings?.highlightsLabelBg ?? ''}
                        onChange={(e) => settings && setSettings({ ...settings, highlightsLabelBg: e.target.value })}
                        className="malts-field"
                        placeholder="Акценти"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <label className="malts-label">Етикет над акцентите (EN)</label>
                        <AutoTranslateButton
                          variant="dark"
                          sourceText={settings?.highlightsLabelBg ?? ''}
                          targetLang="en"
                          onTranslated={(text) => settings && setSettings({ ...settings, highlightsLabelEn: text })}
                          onError={setTranslateErr}
                        />
                      </div>
                      <input
                        type="text"
                        value={settings?.highlightsLabelEn ?? ''}
                        onChange={(e) => settings && setSettings({ ...settings, highlightsLabelEn: e.target.value })}
                        className="malts-field"
                        placeholder="Highlights"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <label className="malts-label">Етикет над акцентите (RO)</label>
                        <AutoTranslateButton
                          variant="dark"
                          sourceText={settings?.highlightsLabelBg ?? ''}
                          targetLang="ro"
                          onTranslated={(text) => settings && setSettings({ ...settings, highlightsLabelRo: text })}
                          onError={setTranslateErr}
                        />
                      </div>
                      <input
                        type="text"
                        value={settings?.highlightsLabelRo ?? ''}
                        onChange={(e) => settings && setSettings({ ...settings, highlightsLabelRo: e.target.value })}
                        className="malts-field"
                        placeholder="Accente"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['bg', 'en', 'ro'] as Array<'bg' | 'en' | 'ro'>).map((localeKey) => (
                      <div key={localeKey}>
                        <label className="block text-xs malts-subtle mb-2 uppercase">{localeKey}</label>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            {editingCard.highlights[localeKey].map((highlight, idx) => (
                              <div
                                key={`${localeKey}-${idx}`}
                                className="flex gap-2 items-center flex-wrap"
                              >
                                <input
                                  type="text"
                                  value={highlight}
                                  onChange={(e) => updateHighlightValue(localeKey, idx, e.target.value)}
                                  className="malts-field flex-1 min-w-0"
                                  placeholder="Въведи акцент"
                                />
                                {(localeKey === 'en' || localeKey === 'ro') && (
                                  <AutoTranslateButton
                                    variant="dark"
                                    sourceText={editingCard.highlights.bg[idx] || ''}
                                    targetLang={localeKey}
                                    onTranslated={(text) => updateHighlightValue(localeKey, idx, text)}
                                    onError={setTranslateErr}
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeHighlightRowAll(idx)}
                                  className="flex-shrink-0 px-3 py-2 rounded-xl malts-btn-danger text-sm"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addHighlightRowAll()}
                            className="malts-muted hover:text-[var(--malts-ink)] text-sm block"
                          >
                            + Добави акцент
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                  <button
                    type="button"
                    onClick={() => handleSaveCard(editingCard)}
                    disabled={saving}
                    className={`malts-btn-admin-compact flex-1 rounded-xl font-semibold transition-all ${
                      saving
                        ? 'malts-btn-secondary cursor-not-allowed opacity-50'
                        : 'malts-btn-primary'
                    }`}
                  >
                    {saving ? 'Запазване...' : 'Запази'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCardModal(false);
                      setEditingCard(null);
                    }}
                    className="malts-btn-secondary malts-btn-admin-compact flex-1 rounded-xl font-semibold transition-all sm:flex-none"
                  >
                    Отказ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          open={!!deleteCardId}
          title="Изтриване на карта"
          message="Сигурни ли сте, че искате да изтриете тази карта?"
          confirmLabel="Изтрий"
          cancelLabel="Отказ"
          tone="danger"
          onCancel={() => setDeleteCardId(null)}
          onConfirm={executeDeleteCard}
        />
      </div>
    </div>
  );
}

