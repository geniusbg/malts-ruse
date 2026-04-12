'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import EventForm from '@/components/EventForm';
import Toast from '@/components/Toast';
import LoadingScreen from '@/components/LoadingScreen';

export default function EditEventPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const eventId = pathname.split('/')[4]; // Extract ID from path
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    try {
      const response = await fetch(`/api/events/${eventId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Parse contact info back to structured fields
        let contact_phone = '';
        let contact_email = '';
        let contact_facebook = '';
        
        if (data.event.contactInfo) {
          const lines = data.event.contactInfo.split('\n');
          lines.forEach((line: string) => {
            if (line.includes('Телефон:')) contact_phone = line.replace('Телефон:', '').trim();
            if (line.includes('Email:')) contact_email = line.replace('Email:', '').trim();
            if (line.includes('Facebook:')) contact_facebook = line.replace('Facebook:', '').trim();
          });
        }

        // Convert from camelCase to snake_case for form
        const formData = {
          title_bg: data.event.titleBg,
          title_en: data.event.titleEn,
          title_ro: data.event.titleRo,
          description_bg: data.event.descriptionBg,
          description_en: data.event.descriptionEn,
          description_ro: data.event.descriptionRo,
          event_date: new Date(data.event.eventDate).toISOString().slice(0, 16),
          location: data.event.location,
          location_bg: data.event.isExternal
            ? data.event.locationBg || data.event.location || ''
            : '',
          location_en: data.event.locationEn || '',
          location_ro: data.event.locationRo || '',
          is_external: data.event.isExternal,
          external_url: data.event.externalUrl || '',
          contact_phone: contact_phone,
          contact_email: contact_email,
          contact_facebook: contact_facebook,
          is_published: data.event.isPublished,
          image_card_url: data.event.imageCardUrl || data.event.imageUrl || '',
          image_detail_url: data.event.imageDetailUrl || data.event.imageUrl || '',
        };
        setEvent(formData);
      }
    } catch (error) {
      console.error('Error loading event:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: any) {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        setToast({ message: '✅ Събитието е актуализирано успешно', type: 'success' });
        setTimeout(() => router.push(`/${locale}/admin/events`), 1500);
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || 'Грешка при актуализиране на събитието', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при актуализиране на събитието', type: 'error' });
    }
  }

  if (loading) {
    return <LoadingScreen locale={locale} />;
  }

  if (!event) {
    return <div className="text-2xl">Събитието не е намерено</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Toast Notification - hidden when offline */}
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title mb-2">Редактирай събитие</h1>
        <p className="malts-muted">Актуализирай информацията за събитието</p>
      </div>

      <div className="malts-card p-4 md:p-8">
        <EventForm
          initialData={event}
          onSubmit={handleSubmit}
          locale={locale}
        />
      </div>
    </div>
  );
}



