'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import Toast from '@/components/Toast';

type BackupDestination = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  config: any;
  createdAt: string;
};

type BackupPolicy = {
  id: string;
  name: string;
  intervalMinutes: number;
  retentionDays: number;
  destinationIds: any;
  enabled: boolean;
  lastRunAt?: string | null;
  createdAt: string;
};

type BackupJob = {
  id: string;
  triggerType: string;
  status: string;
  note?: string | null;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
  artifacts?: Array<{
    id: string;
    status: string;
    filePath?: string | null;
    error?: string | null;
    destination?: { id: string; name: string; type: string } | null;
  }>;
};

export default function BackupsAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const isSuper = role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [destinations, setDestinations] = useState<BackupDestination[]>([]);
  const [policies, setPolicies] = useState<BackupPolicy[]>([]);
  const [jobs, setJobs] = useState<BackupJob[]>([]);

  const [newDestName, setNewDestName] = useState('');
  const [newDestPath, setNewDestPath] = useState('');

  const [newDriveName, setNewDriveName] = useState('');
  const [newDriveFolderId, setNewDriveFolderId] = useState('');

  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthRedirect, setOauthRedirect] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthSecretConfigured, setOauthSecretConfigured] = useState(false);
  const [savingOauth, setSavingOauth] = useState(false);

  const [runNote, setRunNote] = useState('');
  const [running, setRunning] = useState(false);
  const [tickRunning, setTickRunning] = useState(false);

  const [overview, setOverview] = useState<{ destinations: number; policies: number } | null>(null);

  const [policyName, setPolicyName] = useState('');
  const [policyInterval, setPolicyInterval] = useState('60');
  const [policyRetention, setPolicyRetention] = useState('30');
  const [policyDestPick, setPolicyDestPick] = useState<Record<string, boolean>>({});

  const [restoreArtifactId, setRestoreArtifactId] = useState('');
  const [restoreTargetUrl, setRestoreTargetUrl] = useState('');
  const [restoreInPlace, setRestoreInPlace] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoring, setRestoring] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [dRes, pRes, jRes, oRes, ovRes] = await Promise.all([
        fetch('/api/admin/backups/destinations'),
        fetch('/api/admin/backups/policies'),
        fetch('/api/admin/backups/jobs?limit=20'),
        fetch('/api/admin/backups/google/oauth/config'),
        fetch('/api/admin/backups/overview'),
      ]);
      const [dJson, pJson, jJson, oJson, ovJson] = await Promise.all([
        dRes.json(),
        pRes.json(),
        jRes.json(),
        oRes.json(),
        ovRes.json(),
      ]);
      if (!dRes.ok) throw new Error(dJson?.error || 'Грешка при destinations');
      if (!pRes.ok) throw new Error(pJson?.error || 'Грешка при policies');
      if (!jRes.ok) throw new Error(jJson?.error || 'Грешка при jobs');
      if (ovRes.ok && typeof ovJson?.destinations === 'number' && typeof ovJson?.policies === 'number') {
        setOverview({ destinations: ovJson.destinations, policies: ovJson.policies });
      }
      if (oRes.ok) {
        setOauthClientId(String(oJson?.clientId || ''));
        setOauthRedirect(String(oJson?.redirectUri || ''));
        setOauthSecretConfigured(!!oJson?.clientSecretConfigured);
        setOauthClientSecret('');
      }
      setDestinations(Array.isArray(dJson?.destinations) ? dJson.destinations : []);
      setPolicies(Array.isArray(pJson?.policies) ? pJson.policies : []);
      setJobs(Array.isArray(jJson?.jobs) ? jJson.jobs : []);
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка при зареждане', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
      return;
    }
    if (status !== 'authenticated' || !isSuper) return;
    void refresh();
  }, [status, isSuper, locale]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string; ok?: boolean; message?: string };
      if (!data || data.type !== 'malts_google_drive_oauth_result') return;
      if (ev.origin !== window.location.origin) return;
      setToast({
        message: data.ok ? 'Google Drive е свързан.' : data.message || 'Грешка при Google OAuth',
        type: data.ok ? 'success' : 'error',
      });
      void refresh();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const activeDestinationsCount = useMemo(() => destinations.filter((d) => d.active).length, [destinations]);
  const activePoliciesCount = useMemo(() => policies.filter((p) => p.enabled).length, [policies]);
  const destCountDisplay = overview?.destinations ?? activeDestinationsCount;
  const polCountDisplay = overview?.policies ?? activePoliciesCount;

  const saveGoogleOauthConfig = async () => {
    setSavingOauth(true);
    try {
      const res = await fetch('/api/admin/backups/google/oauth/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: oauthClientId,
          ...(oauthClientSecret.trim() ? { clientSecret: oauthClientSecret } : {}),
          redirectUri: oauthRedirect,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка при запис на OAuth');
      setOauthSecretConfigured(!!json?.clientSecretConfigured);
      setOauthClientSecret('');
      setToast({ message: 'OAuth настройките са записани', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    } finally {
      setSavingOauth(false);
    }
  };

  const createDriveDestination = async () => {
    try {
      const res = await fetch('/api/admin/backups/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDriveName,
          type: 'GOOGLE_DRIVE',
          active: true,
          config: { folderId: newDriveFolderId },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка при създаване');
      setNewDriveName('');
      setNewDriveFolderId('');
      setToast({ message: 'Google Drive дестинацията е добавена', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const connectGoogleDrive = async (destinationId: string) => {
    try {
      const res = await fetch('/api/admin/backups/google/oauth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Неуспешен OAuth старт');
      const url = String(json?.authUrl || '');
      if (!url) throw new Error('Липсва authUrl');
      window.open(url, 'malts_gdrive_oauth', 'width=560,height=720');
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const runSchedulerTick = async () => {
    setTickRunning(true);
    try {
      const res = await fetch('/api/admin/backups/scheduler/tick', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Scheduler tick failed');
      setToast({
        message: `Scheduler: стартирани ${json.jobsStarted ?? 0} job(s)`,
        type: 'success',
      });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    } finally {
      setTickRunning(false);
    }
  };

  const createPolicy = async () => {
    const destinationIds = Object.entries(policyDestPick)
      .filter(([, v]) => v)
      .map(([k]) => k);
    try {
      const res = await fetch('/api/admin/backups/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: policyName,
          intervalMinutes: Number(policyInterval),
          retentionDays: Number(policyRetention),
          destinationIds,
          enabled: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка при policy');
      setPolicyName('');
      setPolicyDestPick({});
      setToast({ message: 'Политиката е създадена', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const deletePolicy = async (id: string) => {
    if (!window.confirm('Изтриване на тази политика?')) return;
    try {
      const res = await fetch(`/api/admin/backups/policies/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка');
      setToast({ message: 'Политиката е изтрита', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const patchPolicy = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/backups/policies/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка');
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const deleteDestination = async (id: string) => {
    if (!window.confirm('Изтриване на тази дестинация?')) return;
    try {
      const res = await fetch(`/api/admin/backups/destinations/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка');
      setToast({ message: 'Дестинацията е изтрита', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const runRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artifactId: restoreArtifactId.trim(),
          targetDatabaseUrl: restoreInPlace ? undefined : restoreTargetUrl.trim(),
          inPlace: restoreInPlace,
          confirmation: restoreInPlace ? restoreConfirm.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Restore failed');
      setToast({ message: `Restore завърши: ${json.jobId}`, type: 'success' });
      setRestoreArtifactId('');
      setRestoreTargetUrl('');
      setRestoreConfirm('');
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  const createLocalDestination = async () => {
    try {
      const res = await fetch('/api/admin/backups/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDestName,
          type: 'LOCAL_PATH',
          active: true,
          config: { basePath: newDestPath },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка при създаване');
      setNewDestName('');
      setNewDestPath('');
      setToast({ message: 'Дестинацията е добавена', type: 'success' });
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/admin/backups/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: runNote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Грешка при backup');
      setToast({ message: `Backup job стартира/завърши: ${json.jobId}`, type: 'success' });
      setRunNote('');
      await refresh();
    } catch (e: any) {
      setToast({ message: e?.message || 'Грешка', type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  if (status !== 'authenticated') return <ManagedLoadingScreen locale={locale} />;
  if (!isSuper) return <div className="max-w-3xl mx-auto py-10">Access denied</div>;
  if (loading) return <ManagedLoadingScreen locale={locale} />;

  return (
    <div className="max-w-6xl mx-auto">
      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <h1 className="theme-admin-heading-font theme-admin-page-title">🗄️ Backups</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="theme-card p-5">
          <div className="text-sm theme-muted">Active destinations</div>
          <div className="mt-1 text-2xl font-bold text-[var(--theme-ink)]">{destCountDisplay}</div>
        </div>
        <div className="theme-card p-5">
          <div className="text-sm theme-muted">Active policies</div>
          <div className="mt-1 text-2xl font-bold text-[var(--theme-ink)]">{polCountDisplay}</div>
        </div>
        <div className="theme-card p-5">
          <div className="text-sm theme-muted">Recent jobs</div>
          <div className="mt-1 text-2xl font-bold text-[var(--theme-ink)]">{jobs.length}</div>
        </div>
      </div>

      <div className="theme-card p-6 mb-6">
        <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-3">Quick setup</h2>
        <ol className="list-decimal pl-5 theme-muted space-y-1">
          <li>За Google Drive: попълнете OAuth (или env BACKUP_GOOGLE_DRIVE_*) и добавете папка (folder ID)</li>
          <li>Добавете поне една дестинация (LOCAL_PATH и/или GOOGLE_DRIVE след свързване)</li>
          <li>Тествайте с „Backup now“; за график използвайте policies + cron към /api/admin/backups/scheduler/tick</li>
        </ol>
        <div className="mt-3 text-xs theme-muted space-y-1 break-all">
          <div>
            OAuth redirect (Malts):{' '}
            <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/admin/backups/google/oauth/callback` : '…'}</code>
          </div>
          <div>
            Съвместимост с Delivery:{' '}
            <code>{typeof window !== 'undefined' ? `${window.location.origin}/api/admin/backups/google-drive/oauth/callback` : '…'}</code>
          </div>
        </div>
      </div>

      <div className="theme-card p-6 mb-6">
        <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-4">Google Drive OAuth</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={oauthClientId}
            onChange={(e) => setOauthClientId(e.target.value)}
            className="theme-field"
            placeholder="Client ID"
          />
          <input
            value={oauthClientSecret}
            onChange={(e) => setOauthClientSecret(e.target.value)}
            className="theme-field"
            placeholder={oauthSecretConfigured ? 'Client secret (leave empty to keep)' : 'Client secret'}
            type="password"
            autoComplete="off"
          />
          <input
            value={oauthRedirect}
            onChange={(e) => setOauthRedirect(e.target.value)}
            className="theme-field md:col-span-2"
            placeholder="Redirect URI"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={() => void saveGoogleOauthConfig()}
            disabled={savingOauth}
            className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold disabled:opacity-50"
          >
            {savingOauth ? 'Saving…' : 'Save OAuth settings'}
          </button>
          {oauthSecretConfigured ? (
            <span className="text-xs theme-muted">Client secret е зададен (db или env)</span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="theme-card p-6">
          <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-4">Backup Destinations</h2>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                value={newDestName}
                onChange={(e) => setNewDestName(e.target.value)}
                className="theme-field"
                placeholder="Name (e.g. LOCAL_PATH)"
              />
              <input
                value={newDestPath}
                onChange={(e) => setNewDestPath(e.target.value)}
                className="theme-field"
                placeholder="Path (e.g. /var/backups/malts)"
              />
              <button
                type="button"
                onClick={() => void createLocalDestination()}
                className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold whitespace-nowrap"
              >
                Add destination
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center pt-4 border-t border-[var(--theme-hairline)]">
              <input
                value={newDriveName}
                onChange={(e) => setNewDriveName(e.target.value)}
                className="theme-field"
                placeholder="Име (Google Drive)"
              />
              <input
                value={newDriveFolderId}
                onChange={(e) => setNewDriveFolderId(e.target.value)}
                className="theme-field"
                placeholder="Folder ID (от URL на папката)"
              />
              <button
                type="button"
                onClick={() => void createDriveDestination()}
                className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold whitespace-nowrap"
              >
                Add Drive
              </button>
            </div>
            <div className="text-xs theme-muted">
              <b>LOCAL_PATH</b> записва dump на диска. <b>GOOGLE_DRIVE</b> изисква OAuth (Connect) или service account в
              config през API.
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {destinations.length === 0 ? (
              <div className="theme-muted">Няма дестинации.</div>
            ) : (
              destinations.map((d) => (
                <div key={d.id} className="rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-inset)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--theme-ink)] truncate">{d.name}</div>
                      <div className="text-sm theme-muted">
                        {d.type} • {d.active ? 'Active' : 'Disabled'}
                      </div>
                      {d.type === 'LOCAL_PATH' ? (
                        <div className="text-sm theme-muted mt-1 break-all">
                          Path: {String(d.config?.basePath || '')}
                        </div>
                      ) : null}
                      {d.type === 'GOOGLE_DRIVE' ? (
                        <div className="text-sm theme-muted mt-1 break-all">
                          Folder: {String(d.config?.folderId || '')}
                          {d.config?.oauthEmail ? (
                            <span className="ml-2">• {String(d.config.oauthEmail)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      {d.type === 'GOOGLE_DRIVE' ? (
                        <button
                          type="button"
                          onClick={() => void connectGoogleDrive(d.id)}
                          className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold whitespace-nowrap"
                        >
                          Connect Google
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void deleteDestination(d.id)}
                        className="text-xs text-[var(--theme-danger)] font-semibold hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="theme-card p-6">
          <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-4">Manual actions</h2>
          <div className="space-y-3">
            <input
              value={runNote}
              onChange={(e) => setRunNote(e.target.value)}
              className="theme-field"
              placeholder="Note (optional)"
            />
            <button
              type="button"
              onClick={() => void runNow()}
              disabled={running}
              className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold disabled:opacity-50"
            >
              {running ? 'Running...' : 'Backup now'}
            </button>
            <div className="text-xs theme-muted">
              Изисква наличен <code>pg_dump</code> на сървъра и правилен <code>DATABASE_URL</code>.
            </div>
            <button
              type="button"
              onClick={() => void runSchedulerTick()}
              disabled={tickRunning}
              className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold disabled:opacity-50"
            >
              {tickRunning ? 'Scheduler…' : 'Run scheduler tick (test)'}
            </button>
            <div className="text-xs theme-muted">
              Production: извиквайте периодично с header <code>x-backup-cron-secret</code> ={' '}
              <code>BACKUP_CRON_SECRET</code>, или оставете на SUPER_ADMIN тест оттук.
            </div>
          </div>

          <h3 className="mt-6 text-lg font-bold text-[var(--theme-ink)]">Recent jobs</h3>
          <div className="mt-3 space-y-3">
            {jobs.length === 0 ? (
              <div className="theme-muted">Няма jobs.</div>
            ) : (
              jobs.map((j) => (
                <div key={j.id} className="rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-inset)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm theme-muted">
                        {j.triggerType} • <b>{j.status}</b>
                      </div>
                      <div className="mt-1 font-mono text-xs break-all">{j.id}</div>
                      {j.note ? <div className="mt-2 text-sm theme-muted">{j.note}</div> : null}
                      {j.error ? <div className="mt-2 text-sm text-[var(--theme-danger)]">{j.error}</div> : null}
                      {(j.artifacts || []).length > 0 ? (
                        <div className="mt-3 space-y-1">
                          {(j.artifacts || []).map((a) => (
                            <div key={a.id} className="text-xs theme-muted break-all">
                              <span className="font-mono opacity-80">{a.id.slice(0, 8)}…</span> [{a.status}]{' '}
                              {a.destination?.name || 'destination'} • {a.filePath || a.error || ''}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="theme-card p-6 mb-6">
        <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-4">Policies (scheduler)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <input
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
            className="theme-field"
            placeholder="Име"
          />
          <input
            value={policyInterval}
            onChange={(e) => setPolicyInterval(e.target.value)}
            className="theme-field"
            placeholder="Интервал (мин, ≥5)"
            inputMode="numeric"
          />
          <input
            value={policyRetention}
            onChange={(e) => setPolicyRetention(e.target.value)}
            className="theme-field"
            placeholder="Retention (дни)"
            inputMode="numeric"
          />
          <button
            type="button"
            onClick={() => void createPolicy()}
            className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold"
          >
            Създай политика
          </button>
        </div>
        <div className="mb-4">
          <div className="text-sm theme-muted mb-2">Дестинации за политиката</div>
          <div className="flex flex-wrap gap-3">
            {destinations.map((d) => (
              <label key={d.id} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!policyDestPick[d.id]}
                  onChange={(e) => setPolicyDestPick((prev) => ({ ...prev, [d.id]: e.target.checked }))}
                />
                <span>
                  {d.name} ({d.type})
                </span>
              </label>
            ))}
          </div>
          {destinations.length === 0 ? <div className="text-xs theme-muted">Няма дестинации.</div> : null}
        </div>
        <div className="space-y-3">
          {policies.length === 0 ? (
            <div className="theme-muted">Няма политики.</div>
          ) : (
            policies.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-inset)] p-4 flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[var(--theme-ink)]">{p.name}</div>
                  <div className="text-sm theme-muted">
                    На всеки {p.intervalMinutes} мин • retention {p.retentionDays} дни •{' '}
                    {p.enabled ? 'включена' : 'изключена'}
                  </div>
                  <div className="text-xs theme-muted mt-1 break-all font-mono">
                    IDs: {Array.isArray(p.destinationIds) ? p.destinationIds.join(', ') : '—'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void patchPolicy(p.id, { enabled: !p.enabled })}
                    className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold text-sm"
                  >
                    {p.enabled ? 'Изкл.' : 'Вкл.'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePolicy(p.id)}
                    className="text-sm text-[var(--theme-danger)] font-semibold"
                  >
                    Изтрий
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="theme-card p-6 mb-6">
        <h2 className="text-xl font-bold text-[var(--theme-ink)] mb-4">Restore (pg_restore)</h2>
        <p className="text-sm theme-muted mb-3">
          Копирайте <b>artifact id</b> от успешен backup job по-горе. За нова Б: подайте пълен Postgres connection string. In-place
          изисква <code>BACKUP_ALLOW_INPLACE_RESTORE=true</code> и потвърждение <code>RESTORE_IN_PLACE</code>.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={restoreArtifactId}
            onChange={(e) => setRestoreArtifactId(e.target.value)}
            className="theme-field font-mono text-sm"
            placeholder="Artifact ID (UUID)"
          />
          <input
            value={restoreTargetUrl}
            onChange={(e) => setRestoreTargetUrl(e.target.value)}
            className="theme-field font-mono text-sm"
            placeholder="postgres://… (целева Б, ако не е in-place)"
            disabled={restoreInPlace}
          />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={restoreInPlace} onChange={(e) => setRestoreInPlace(e.target.checked)} />
          In-place restore (опасно)
        </label>
        {restoreInPlace ? (
          <input
            value={restoreConfirm}
            onChange={(e) => setRestoreConfirm(e.target.value)}
            className="theme-field mt-2 font-mono"
            placeholder="Напишете: RESTORE_IN_PLACE"
          />
        ) : null}
        <button
          type="button"
          onClick={() => void runRestore()}
          disabled={restoring}
          className="mt-4 theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold disabled:opacity-50"
        >
          {restoring ? '…' : 'Стартирай restore'}
        </button>
      </div>
    </div>
  );
}

