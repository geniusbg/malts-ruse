'use client';

import { useRouter, usePathname } from 'next/navigation';
import EventForm from '@/components/EventForm';

export default function NewEventPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';

  const handleSubmit = async (data: any) => {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      router.push(`/${locale}/admin/events`);
    }
  };

  return (
    <div>
      <h1 className="malts-admin-heading-font malts-admin-page-title mb-8">Добави събитие</h1>
      
      <div className="malts-card p-8">
        <EventForm onSubmit={handleSubmit} locale={locale} />
      </div>
    </div>
  );
}

