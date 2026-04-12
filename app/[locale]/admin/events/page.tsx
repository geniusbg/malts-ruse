'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/LoadingScreen';
import Toast from '@/components/Toast';
import ConfirmModal from '@/components/ConfirmModal';
import { formatBulgarianDateWithMonth } from '@/lib/date-utils';
import { eventCardImageUrl } from '@/lib/event-images';

export default function AdminEventsPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const loadEvents = async () => {
    try {
      const response = await fetch('/api/events');
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const executeDeleteEvent = async () => {
    if (!deleteTarget) return;
    const eventId = deleteTarget.id;
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setToast({ message: '✅ Събитието е изтрито успешно', type: 'success' });
        loadEvents();
      } else {
        const data = await response.json().catch(() => ({ error: 'Грешка при изтриване на събитието' }));
        setToast({ message: data.error || 'Грешка при изтриване на събитието', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при изтриване на събитието', type: 'error' });
    }
  };

  if (loading) {
    return <LoadingScreen locale={locale} />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title">Събития</h1>
        <Link
          href={`/${locale}/admin/events/new`}
          className="malts-btn-primary malts-btn-admin-compact w-full rounded-lg text-center font-semibold transition-all sm:w-auto"
        >
          + Добави събитие
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event: any) => {
          const eventDate = new Date(event.eventDate);
          const isPast = eventDate < new Date();
          const cardImageSrc = eventCardImageUrl(event);

          return (
            <div
              key={event.id}
              className="group malts-card overflow-hidden transition-all duration-300"
            >
              {cardImageSrc && (
                <div className="h-48 bg-[var(--malts-inset)] relative overflow-hidden">
                  <img
                    src={cardImageSrc}
                    alt={event.titleBg}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(26,24,16,0.65)] via-transparent to-transparent opacity-60"></div>
                </div>
              )}
              
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  {event.isPublished ? (
                    <span className="px-3 py-1 bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)] rounded-full text-sm">
                      Публикувано
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-[var(--malts-accent-tint)] text-[var(--malts-accent)] border border-[var(--malts-accent-tint-border)] rounded-full text-sm">
                      Чернова
                    </span>
                  )}
                  
                  {event.isExternal && (
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                      Партньорско
                    </span>
                  )}
                  
                  {isPast && (
                    <span className="px-3 py-1 bg-[rgba(153,27,27,0.10)] text-[var(--malts-danger)] border border-[rgba(153,27,27,0.25)] rounded-full text-sm">
                      Минало
                    </span>
                  )}
                </div>
                
                <h3 className="text-xl font-bold mb-2">
                  {event.titleBg}
                </h3>
                
                <p className="malts-muted text-sm mb-3">
                  {formatBulgarianDateWithMonth(eventDate)}
                </p>
                
                <p className="malts-muted text-sm mb-4 line-clamp-2">
                  {event.descriptionBg}
                </p>
                
                <div className="flex gap-2">
                  <Link
                    href={`/${locale}/admin/events/${event.id}/edit`}
                    className="flex-1 px-4 py-2 malts-btn-secondary rounded-lg text-sm text-center transition-all"
                  >
                    Редактирай
                  </Link>
                  <button
                    onClick={() => setDeleteTarget({ id: event.id, title: event.titleBg })}
                    className="px-4 py-2 malts-btn-danger rounded-lg text-sm transition-all"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {events.length === 0 && (
        <div className="text-center py-20">
          <p className="malts-muted text-xl">Няма създадени събития</p>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Изтриване на събитие"
        message={
          deleteTarget
            ? `Сигурен ли си, че искаш да изтриеш „${deleteTarget.title}“?`
            : ''
        }
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDeleteEvent}
      />
    </div>
  );
}

