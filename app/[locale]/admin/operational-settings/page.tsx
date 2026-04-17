'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

type AuditRow = {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  before: { maxQrTables: number; ordersEnabled: boolean; waiterCallEnabled: boolean };
  after: { maxQrTables: number; ordersEnabled: boolean; waiterCallEnabled: boolean };
};

export default function OperationalSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [maxQrTables, setMaxQrTables] = useState(30);
  const [ordersEnabled, setOrdersEnabled] = useState(true);
  const [waiterCallEnabled, setWaiterCallEnabled] = useState(true);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const role = (session?.user as { role?: string })?.role;
  const isSuper = role === 'SUPER_ADMIN';

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
      return;
    }
    if (status !== 'authenticated' || !isSuper) return;

    fetch('/api/operational-settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          setMaxQrTables(data.settings.maxQrTables ?? 30);
          setOrdersEnabled(data.settings.ordersEnabled !== false);
          setWaiterCallEnabled(data.settings.waiterCallEnabled !== false);
        }
      })
      .catch(() => setErr('Грешка при зареждане'))
      .finally(() => setLoading(false));
  }, [status, isSuper, locale]);

  useEffect(() => {
    if (status === 'authenticated' && isSuper) {
      void loadAudit();
    }
  }, [status, isSuper]);

  const loadAudit = async () => {
    setAuditErr(null);
    try {
      const res = await fetch('/api/operational-settings/audit');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка');
      setAudit((data.logs || []) as AuditRow[]);
    } catch (e: unknown) {
      setAuditErr(e instanceof Error ? e.message : 'Грешка');
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch('/api/operational-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxQrTables, ordersEnabled, waiterCallEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка');
      setMsg('Записано.');
      await loadAudit();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Грешка');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  if (!isSuper) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto w-full">
        <div className="malts-card p-6">
          <p className="malts-muted">Само Super Admin може да редактира тези настройки.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full">
      <h1 className="malts-admin-heading-font malts-admin-page-title mb-2">Оперативни настройки</h1>
      <p className="malts-muted text-sm mb-8">
        Лимит на маси за QR, активиране на поръчки и повикване на сервитьор (сървърна проверка).
      </p>

      {msg && (
        <MaltsInlineFeedback tone="success" className="mb-4">
          {msg}
        </MaltsInlineFeedback>
      )}
      {err && (
        <MaltsInlineFeedback tone="error" className="mb-4">
          {err}
        </MaltsInlineFeedback>
      )}

      <div className="space-y-6 malts-card p-6">
        <div>
          <label className="block malts-subtle mb-2">Максимален брой маси (QR)</label>
          <input
            type="number"
            min={1}
            max={500}
            value={maxQrTables}
            onChange={(e) => setMaxQrTables(parseInt(e.target.value, 10) || 1)}
            className="w-full malts-inset px-4 py-2"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={ordersEnabled}
            onChange={(e) => setOrdersEnabled(e.target.checked)}
            className="w-5 h-5"
          />
          <span>Поръчки от менюто са разрешени</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={waiterCallEnabled}
            onChange={(e) => setWaiterCallEnabled(e.target.checked)}
            className="w-5 h-5"
          />
          <span>Повикване на сервитьор е разрешено</span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="malts-btn-primary malts-btn-admin-compact w-full font-semibold disabled:opacity-50"
        >
          {saving ? 'Запис…' : 'Запази'}
        </button>
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Audit log</h2>
          <button
            type="button"
            onClick={loadAudit}
            className="text-sm malts-muted hover:text-[var(--malts-ink)]"
          >
            Обнови
          </button>
        </div>

        {auditErr && (
          <MaltsInlineFeedback tone="error" className="mb-3">
            {auditErr}
          </MaltsInlineFeedback>
        )}

        <div className="overflow-x-auto border border-[var(--malts-hairline)] rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--malts-hairline)] text-left malts-subtle">
                <th className="p-3 whitespace-nowrap">Кога</th>
                <th className="p-3 whitespace-nowrap">Кой</th>
                <th className="p-3 whitespace-nowrap">Промяна</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((row) => (
                <tr key={row.id} className="border-b border-[var(--malts-hairline)] align-top">
                  <td className="p-3 whitespace-nowrap">{new Date(row.createdAt).toLocaleString('bg')}</td>
                  <td className="p-3">{row.actorEmail || '—'}</td>
                  <td className="p-3">
                    <div className="grid gap-1">
                      <div>
                        <span className="malts-subtle">maxQrTables:</span>{' '}
                        <span className="malts-muted">{row.before.maxQrTables}</span>{' '}
                        <span className="malts-subtle">→</span>{' '}
                        <span className="font-medium">{row.after.maxQrTables}</span>
                      </div>
                      <div>
                        <span className="malts-subtle">ordersEnabled:</span>{' '}
                        <span className="malts-muted">{String(row.before.ordersEnabled)}</span>{' '}
                        <span className="malts-subtle">→</span>{' '}
                        <span className="font-medium">{String(row.after.ordersEnabled)}</span>
                      </div>
                      <div>
                        <span className="malts-subtle">waiterCallEnabled:</span>{' '}
                        <span className="malts-muted">{String(row.before.waiterCallEnabled)}</span>{' '}
                        <span className="malts-subtle">→</span>{' '}
                        <span className="font-medium">{String(row.after.waiterCallEnabled)}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && !auditErr && (
            <p className="p-6 malts-muted text-center">Няма записани промени.</p>
          )}
        </div>
      </div>
    </div>
  );
}
