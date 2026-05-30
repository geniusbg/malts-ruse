'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Toast from '@/components/Toast';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import { formatBulgarianDateTime } from '@/lib/date-utils';

interface QRTable {
  id: string;
  tableNumber: number;
  tableName: string | null;
  isActive: boolean;
  redirectUrl: string | null;
  scanCount: number;
  lastScannedAt: string | null;
  qrCodeUrl: string | null;
}

export default function QRRedirectsPage() {
  const [tables, setTables] = useState<QRTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTable, setEditingTable] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/qr/redirects');
      const data = await response.json();
      setTables(data.tables || []);
    } catch (error) {
      console.error('Error loading tables:', error);
      setToast({ message: 'Грешка при зареждане', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (table: QRTable) => {
    setEditingTable(table.tableNumber);
    setEditUrl(table.redirectUrl || `/order?table=${table.tableNumber}`);
  };

  const cancelEditing = () => {
    setEditingTable(null);
    setEditUrl('');
  };

  const saveRedirect = async (tableNumber: number) => {
    try {
      const response = await fetch('/api/qr/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          redirectUrl: editUrl
        })
      });

      if (response.ok) {
        setToast({ message: '✅ URL успешно запазен', type: 'success' });
        await loadTables();
        cancelEditing();
      } else {
        setToast({ message: 'Грешка при запазване', type: 'error' });
      }
    } catch (error) {
      console.error('Error saving redirect:', error);
      setToast({ message: 'Грешка при запазване', type: 'error' });
    }
  };

  const toggleActive = async (tableNumber: number, currentStatus: boolean) => {
    try {
      const response = await fetch('/api/qr/redirects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber,
          isActive: !currentStatus
        })
      });

      if (response.ok) {
        setToast({ 
          message: !currentStatus ? '✅ Маса активирана' : '⛔ Маса деактивирана', 
          type: 'success' 
        });
        await loadTables();
      } else {
        setToast({ message: 'Грешка при промяна на статус', type: 'error' });
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      setToast({ message: 'Грешка при промяна на статус', type: 'error' });
    }
  };

  // Use global date formatter from lib/date-utils
  const formatDate = formatBulgarianDateTime;

  if (loading) {
    return <ManagedLoadingScreen locale="bg" />;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Toast Notification - hidden when offline */}
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="mb-8">
        <h1 className="theme-admin-heading-font theme-admin-page-title mb-2">🔗 QR Redirects</h1>
        <p className="theme-muted">
          Управление на URL адресите на QR кодовете. Промените се прилагат веднага без да принтирате нови кодове.
        </p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="theme-card p-4">
          <div className="theme-subtle text-sm mb-1">Всички маси</div>
          <div className="text-3xl font-bold">{tables.length}</div>
        </div>
        <div className="theme-card p-4">
          <div className="theme-subtle text-sm mb-1">Активни</div>
          <div className="text-3xl font-bold text-green-500">
            {tables.filter(t => t.isActive).length}
          </div>
        </div>
        <div className="theme-card p-4">
          <div className="theme-subtle text-sm mb-1">Деактивирани</div>
          <div className="text-3xl font-bold text-red-500">
            {tables.filter(t => !t.isActive).length}
          </div>
        </div>
        <div className="theme-card p-4">
          <div className="theme-subtle text-sm mb-1">Общо сканирания</div>
          <div className="text-3xl font-bold text-blue-500">
            {tables.reduce((sum, t) => sum + t.scanCount, 0)}
          </div>
        </div>
      </div>

      {/* Tables List */}
      <div className="theme-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--theme-inset)] border-b border-[var(--theme-hairline)]">
              <tr>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Маса</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Статус</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">QR Link</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Redirect URL</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Сканирания</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Последно</th>
                <th className="text-left px-4 py-3 theme-subtle font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--theme-hairline)]">
              {tables.map((table) => (
                <tr key={table.id} className={!table.isActive ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      Маса {table.tableNumber}
                    </div>
                    {table.tableName && (
                      <div className="text-sm theme-muted">{table.tableName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(table.tableNumber, table.isActive)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        table.isActive
                          ? 'bg-[rgba(22,101,52,0.12)] text-[var(--theme-success)] border border-[rgba(22,101,52,0.25)]'
                          : 'bg-[rgba(153,27,27,0.10)] text-[var(--theme-danger)] border border-[rgba(153,27,27,0.25)]'
                      }`}
                    >
                      {table.isActive ? '✓ Активна' : '✗ Спряна'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                      /t/{table.tableNumber}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    {editingTable === table.tableNumber ? (
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="w-full px-3 py-1 theme-inset rounded text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent-tint-border)]"
                        placeholder="/order?table=1"
                      />
                    ) : (
                      <code className="text-sm theme-muted">
                        {table.redirectUrl || `/order?table=${table.tableNumber}`}
                      </code>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{table.scanCount}</span>
                  </td>
                  <td className="px-4 py-3 text-sm theme-muted">
                    {formatDate(table.lastScannedAt)}
                  </td>
                  <td className="px-4 py-3">
                    {editingTable === table.tableNumber ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveRedirect(table.tableNumber)}
                          className="px-3 py-1 theme-btn-primary text-sm rounded transition-colors"
                        >
                          ✓ Запази
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="px-3 py-1 theme-btn-secondary text-sm rounded transition-colors"
                        >
                          ✗ Откажи
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(table)}
                        className="px-3 py-1 theme-btn-secondary text-sm rounded transition-colors"
                      >
                        ✎ Редактирай
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-blue-400 font-semibold mb-2">💡 Как работят динамичните QR кодове?</h3>
        <ul className="theme-muted space-y-2 text-sm">
          <li>• QR кодът винаги води към <code className="bg-blue-500/20 px-1 rounded">/t/[номер]</code> (кратък линк)</li>
          <li>• Кратият линк redirect-ва към URL-а който сте настроили тук</li>
          <li>• Можете да сменяте URL-а по всяко време без да принтирате нови кодове</li>
          <li>• Можете да спрете временно маса като я деактивирате</li>
          <li>• Статистиките показват колко пъти е сканиран всеки код</li>
        </ul>
      </div>
    </div>
  );
}

