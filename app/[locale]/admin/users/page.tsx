'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import Toast from '@/components/Toast';
import { formatBulgarianDate } from '@/lib/date-utils';
import { useLockScroll } from '@/lib/use-lock-scroll';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';
  isActive: boolean;
  canSeeAllTables?: boolean;
  createdAt: string;
}

export default function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [locale, setLocale] = useState('bg');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [tablesModalUser, setTablesModalUser] = useState<User | null>(null);

  useLockScroll(showAddForm || showEditForm || showDeleteConfirm || Boolean(tablesModalUser));

  useEffect(() => {
    params.then(p => setLocale(p.locale));
  }, [params]);

  useEffect(() => {
    if (!session) return;
    fetchUsers();
  }, [session]);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  const userRole = (session.user as any)?.role;
  
  if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    return <div>Access denied</div>;
  }

  const canCreateUsers = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const roleBadgeClass = (role: User['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-[rgba(196,30,58,0.14)] text-[#8b0a1a] border border-[rgba(196,30,58,0.32)]';
      case 'ADMIN':
        return 'bg-[rgba(88,28,135,0.12)] text-[#3b0764] border border-[rgba(88,28,135,0.30)]';
      case 'STAFF':
      default:
        return 'bg-[rgba(2,132,199,0.12)] text-[#0c4a6e] border border-[rgba(2,132,199,0.28)]';
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowEditForm(true);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const handleTables = (user: User) => {
    setTablesModalUser(user);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;

    try {
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchUsers();
        setShowDeleteConfirm(false);
        setSelectedUser(null);
      } else {
        const error = await response.json();
        setToast({ message: error.error || 'Грешка при изтриване', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при изтриване на потребител', type: 'error' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="theme-admin-heading-font theme-admin-page-title">👥 Потребители</h1>
        {canCreateUsers && (
          <button
            onClick={() => setShowAddForm(true)}
            className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold whitespace-nowrap transition-colors"
          >
            + Добави потребител
          </button>
        )}
      </div>

      {loading ? (
        <ManagedLoadingScreen locale={locale} />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {users.map((user) => (
              <div key={user.id} className="theme-card p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold">{user.name}</h3>
                      <p className="theme-muted text-sm">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${roleBadgeClass(user.role)}`}
                    >
                      {user.role}
                    </span>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-[rgba(22,101,52,0.12)] text-[var(--theme-success)] border border-[rgba(22,101,52,0.25)]'
                        : 'bg-[var(--theme-card)] text-[var(--theme-subtle)] border border-[var(--theme-hairline)]'
                    }`}>
                      {user.isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </div>
                  <p className="theme-muted text-sm">
                    Създаден: {formatBulgarianDate(user.createdAt)}
                  </p>
                  <div className="flex gap-2 pt-2 border-t border-[var(--theme-hairline)]">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-[var(--theme-info)] text-sm"
                    >
                      Редактирай
                    </button>
                    <button
                      onClick={() => handleTables(user)}
                      className="text-[var(--theme-ink)] text-sm"
                    >
                      Маси
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-[var(--theme-danger)] text-sm"
                    >
                      Изтрий
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block theme-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--theme-inset)] border-b border-[var(--theme-hairline)]">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Име</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Email</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Роля</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Статус</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Създаден</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold theme-subtle uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-[var(--theme-hairline)] hover:bg-[var(--theme-accent-tint)]">
                      <td className="px-4 py-4 text-sm">{user.name}</td>
                      <td className="px-4 py-4 theme-muted text-sm">{user.email}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${roleBadgeClass(user.role)}`}
                        >
                          {user.role}
                        </span>
                        {user.canSeeAllTables ? (
                          <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[rgba(22,101,52,0.12)] text-[var(--theme-success)] border border-[rgba(22,101,52,0.25)]">
                            Всички маси
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                          user.isActive
                            ? 'bg-[rgba(22,101,52,0.12)] text-[var(--theme-success)] border border-[rgba(22,101,52,0.25)]'
                            : 'bg-[var(--theme-card)] text-[var(--theme-subtle)] border border-[var(--theme-hairline)]'
                        }`}>
                          {user.isActive ? 'Активен' : 'Неактивен'}
                        </span>
                      </td>
                      <td className="px-4 py-4 theme-muted text-sm">
                        {formatBulgarianDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-4 flex gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-[var(--theme-info)] text-sm"
                        >
                          Редактирай
                        </button>
                        <button
                          onClick={() => handleTables(user)}
                          className="text-[var(--theme-ink)] text-sm"
                        >
                          Маси
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-[var(--theme-danger)] text-sm"
                        >
                          Изтрий
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAddForm && canCreateUsers && (
        <AddUserForm
          locale={locale}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            fetchUsers();
          }}
          onError={(message) => setToast({ message, type: 'error' })}
        />
      )}

      {showEditForm && selectedUser && (
        <EditUserForm
          user={selectedUser}
          locale={locale}
          onClose={() => {
            setShowEditForm(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditForm(false);
            setSelectedUser(null);
            fetchUsers();
          }}
          onError={(message) => setToast({ message, type: 'error' })}
        />
      )}

      {showDeleteConfirm && selectedUser && (
        <DeleteConfirmModal
          user={selectedUser}
          onClose={() => {
            setShowDeleteConfirm(false);
            setSelectedUser(null);
          }}
          onConfirm={confirmDelete}
        />
      )}

      {tablesModalUser && (
        <TablesAccessModal
          user={tablesModalUser}
          onClose={() => setTablesModalUser(null)}
          onSaved={async () => {
            setTablesModalUser(null);
            await fetchUsers();
          }}
          onError={(message) => setToast({ message, type: 'error' })}
        />
      )}
    </div>
  );
}

function TablesAccessModal({
  user,
  onClose,
  onSaved,
  onError,
}: {
  user: User;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canSeeAllTables, setCanSeeAllTables] = useState(Boolean(user.canSeeAllTables));
  const [tables, setTables] = useState<Array<{ id: string; tableNumber: number; tableName: string | null; isActive: boolean }>>([]);
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/staff-table-assignments?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setCanSeeAllTables(Boolean(data?.canSeeAllTables));
        setTables(Array.isArray(data?.tables) ? data.tables : []);
        setSelectedTableIds(new Set(Array.isArray(data?.tableIds) ? data.tableIds : []));
      })
      .catch(() => {
        if (cancelled) return;
        onError('Грешка при зареждане на масите');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id, onError]);

  const toggle = (tableId: string) => {
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/staff-table-assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          canSeeAllTables,
          tableIds: Array.from(selectedTableIds),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Грешка при запазване');
      }
      await onSaved();
    } catch (e: any) {
      onError(e?.message || 'Грешка при запазване');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--theme-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="theme-card p-6 md:p-8 max-w-2xl w-full">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-[var(--theme-ink)]">Маси — {user.name}</h2>
            <p className="theme-muted mt-1 text-sm">
              Ако е включено „Всички маси“, потребителят вижда/получава известия за всички маси.
            </p>
          </div>
          <button onClick={onClose} className="theme-btn-secondary theme-btn-admin-compact rounded-lg font-semibold">
            ✕
          </button>
        </div>

        {loading ? (
          <div className="theme-muted">Зареждане...</div>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--theme-ink)] mb-4">
              <input
                type="checkbox"
                checked={canSeeAllTables}
                onChange={(e) => setCanSeeAllTables(e.target.checked)}
                className="rounded"
              />
              Всички маси
            </label>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1 ${canSeeAllTables ? 'opacity-50 pointer-events-none' : ''}`}>
              {tables.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-card)] hover:bg-[var(--theme-card-hover)]"
                >
                  <input
                    type="checkbox"
                    checked={selectedTableIds.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="rounded"
                  />
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--theme-ink)]">Маса {t.tableNumber}</div>
                    {t.tableName ? <div className="text-sm theme-muted truncate">{t.tableName}</div> : null}
                    {!t.isActive ? <div className="text-xs text-[var(--theme-danger)]">Неактивна</div> : null}
                  </div>
                </label>
              ))}
            </div>

            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="theme-btn-secondary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="theme-btn-primary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? 'Запазване...' : 'Запази'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EditUserForm({
  user,
  locale,
  onClose,
  onSuccess,
  onError,
}: {
  user: User;
  locale: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const { data: session } = useSession();
  const currentRole = (session?.user as any)?.role as User['role'] | undefined;
  const canAssignSuperAdmin = currentRole === 'SUPER_ADMIN';
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'STAFF'>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body: any = { email, name, role, isActive };
      if (password) body.password = password;

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        onError(error.error || 'Грешка при редактиране');
      }
    } catch (error) {
      onError('Грешка при редактиране на потребител');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--theme-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="theme-card p-6 md:p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-[var(--theme-ink)] mb-6">Редактирай потребител</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="theme-label">Име</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Нова парола (остави празно за запазване)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Роля</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'STAFF')}
              className="theme-field"
            >
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
              {canAssignSuperAdmin ? <option value="SUPER_ADMIN">SUPER_ADMIN</option> : null}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-[var(--theme-ink)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Активен
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="theme-btn-secondary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="theme-btn-primary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Запазване...' : 'Запази'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ user, onClose, onConfirm }: { user: User; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-[var(--theme-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="theme-card p-6 md:p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-[var(--theme-ink)] mb-2">Потвърди изтриване</h2>
        <p className="theme-muted mb-6">
          Сигурни ли сте, че искате да изтриете потребителя <strong>{user.name}</strong> ({user.email})?
        </p>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="theme-btn-secondary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
          >
            Отказ
          </button>
          <button
            onClick={onConfirm}
            className="theme-btn-danger theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
          >
            Изтрий
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserForm({
  locale,
  onClose,
  onSuccess,
  onError,
}: {
  locale: string;
  onClose: () => void;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const { data: session } = useSession();
  const currentRole = (session?.user as any)?.role as User['role'] | undefined;
  const canCreateSuperAdmin = currentRole === 'SUPER_ADMIN';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'ADMIN' | 'STAFF'>('STAFF');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        console.error('Error creating user:', error);
        
        // Show validation errors properly
        let errorMessage = 'Грешка при създаване на потребител';
        if (error.details && Array.isArray(error.details)) {
          errorMessage = error.details.join('\n');
        } else if (error.error) {
          errorMessage = error.error;
        } else if (error.details) {
          errorMessage = error.details;
        }
        
        onError(errorMessage);
      }
    } catch (error) {
      onError('Грешка при създаване на потребител');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--theme-paper)]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="theme-card p-6 md:p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-[var(--theme-ink)] mb-6">Добави потребител</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="theme-label">Име</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Парола</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="theme-field"
            />
          </div>

          <div>
            <label className="theme-label">Роля</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'STAFF')}
              className="theme-field"
            >
              <option value="STAFF">STAFF</option>
              <option value="ADMIN">ADMIN</option>
              {canCreateSuperAdmin ? <option value="SUPER_ADMIN">SUPER_ADMIN</option> : null}
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="theme-btn-secondary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors"
            >
              Отказ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="theme-btn-primary theme-btn-admin-compact flex-1 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Създаване...' : 'Създай'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

