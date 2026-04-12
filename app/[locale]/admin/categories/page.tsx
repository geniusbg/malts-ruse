'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Toast from '@/components/Toast';
import CategoryModal from '@/components/CategoryModal';
import LoadingScreen from '@/components/LoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';

export default function AdminCategoriesPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  /** Кои родителски възли показват поддърво (по подразбиране — свити) */
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const response = await fetch('/api/categories');
    const data = await response.json();
    setCategories(data.categories || []);
    setLoading(false);
  }

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: any) => {
    setEditingCategory(category);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCategory(null);
  };

  const handleModalSubmit = async (data: any): Promise<boolean> => {
    try {
      const url = editingCategory 
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      
      const method = editingCategory ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      // Check if server is offline (503 or network error)
      if (response.status === 503 || !response.ok) {
        // Trigger offline banner
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
        return false; // Keep modal open
      }

      if (response.ok) {
        loadCategories();
        setToast({ 
          message: editingCategory ? '✅ Категорията е обновена успешно' : '✅ Категорията е добавена успешно', 
          type: 'success' 
        });
        return true; // Close modal
      } else {
        const errorData = await response.json();
        setToast({ 
          message: errorData.error || 'Грешка при запазване на категорията', 
          type: 'error' 
        });
        return false; // Keep modal open
      }
    } catch (error: any) {
      // Network error or server offline
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        // Trigger offline banner
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
      }
      return false; // Keep modal open
    }
  };

  const executeDeleteCategory = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      });

      if (response.status === 503) {
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
        return;
      }

      if (response.ok) {
        loadCategories();
        setToast({ message: '✅ Категорията е изтрита успешно', type: 'success' });
      } else {
        const data = await response.json().catch(() => ({ error: 'Грешка при изтриване на категорията' }));
        setToast({ message: data.error || 'Грешка при изтриване на категорията', type: 'error' });
      }
    } catch (error: any) {
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
      }
    }
  };

  if (loading) {
    return <LoadingScreen locale={locale} />;
  }

  const renderCategoryTree = (parentId: string | null, depth = 0) => {
    const children = categories
      .filter((c: any) => (c.parentCategoryId ?? null) === parentId)
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));

    if (children.length === 0) return null;

    return (
      <div className={depth === 0 ? 'space-y-3 md:space-y-4' : 'space-y-2'}>
        {children.map((cat: any) => {
          const hasChildren = categories.some((c: any) => c.parentCategoryId === cat.id);
          const isExpanded = hasChildren && expandedIds.has(cat.id);
          const isRoot = depth === 0;

          return (
            <div key={cat.id} className="space-y-2">
              <div
                className={[
                  'malts-card transition-all',
                  isRoot
                    ? 'border-2 border-[var(--malts-hairline)] p-4 hover:border-[var(--malts-accent-tint-border)] md:p-5'
                    : 'border border-[var(--malts-hairline)] p-3 hover:border-[var(--malts-accent-tint-border)]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div
                      className={[
                        isRoot ? 'mb-3' : 'mb-2',
                        'flex items-start gap-2',
                        hasChildren ? 'cursor-pointer select-none' : '',
                      ].join(' ')}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(cat.id);
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-lg font-bold leading-none text-[var(--malts-ink)] transition-colors hover:border-[var(--malts-accent-tint-border)] hover:bg-[var(--malts-card-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--malts-accent)]"
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Свий подкатегориите' : 'Разгъни подкатегориите'}
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                      ) : null}
                      <h3
                        className={
                          isRoot
                            ? 'flex min-w-0 flex-1 items-start gap-2 text-lg font-bold text-[var(--malts-ink)] md:text-xl'
                            : 'flex min-w-0 flex-1 items-start gap-2 text-base font-semibold text-[var(--malts-ink)]'
                        }
                        onClick={hasChildren ? () => toggleExpanded(cat.id) : undefined}
                      >
                        <span className="shrink-0 pt-0.5 text-[var(--malts-accent)]" aria-hidden>
                          {isRoot ? '📁' : '└─'}
                        </span>
                        <span className="min-w-0 flex-1 break-words leading-snug">{cat.nameBg}</span>
                      </h3>
                    </div>

                    <div className="mb-2 space-y-1">
                      <div className="flex items-start gap-2">
                        <span className="malts-subtle w-[5.5rem] shrink-0 text-xs uppercase leading-snug sm:w-24">
                          EN:
                        </span>
                        <span className="malts-muted min-w-0 flex-1 text-sm leading-snug">{cat.nameEn}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="malts-subtle w-[5.5rem] shrink-0 text-xs uppercase leading-snug sm:w-24">
                          RO:
                        </span>
                        <span className="malts-muted min-w-0 flex-1 text-sm leading-snug">{cat.nameRo}</span>
                      </div>
                    </div>
                    <div className="mb-2 space-y-1 border-t border-[var(--malts-hairline)] pt-2">
                      <div className="flex items-start gap-2">
                        <span className="malts-subtle w-[5.5rem] shrink-0 text-xs leading-snug sm:w-24">Slug</span>
                        <span className="malts-muted min-w-0 flex-1 break-all font-mono text-xs leading-snug sm:text-sm">
                          {cat.slug}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="malts-subtle w-[5.5rem] shrink-0 text-xs leading-snug sm:w-24">Подредба</span>
                        <span className="malts-muted min-w-0 flex-1 text-sm leading-snug">{cat.order}</span>
                      </div>
                      {hasChildren && (
                        <div className="flex items-start gap-2">
                          <span className="malts-subtle w-[5.5rem] shrink-0 text-xs leading-snug sm:w-24">
                            Подкатегории
                          </span>
                          <span className="malts-muted min-w-0 flex-1 text-sm leading-snug">
                            {categories.filter((c: any) => c.parentCategoryId === cat.id).length}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => handleOpenEdit(cat)}
                        className="malts-btn-secondary w-full rounded-lg px-3 py-2 text-sm font-semibold transition-all sm:flex-1 sm:py-1.5"
                      >
                        Редактирай
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: cat.id, name: cat.nameBg })}
                        className="malts-btn-danger w-full rounded-lg px-3 py-2 text-sm font-semibold transition-all sm:w-auto sm:py-1.5"
                      >
                        Изтрий
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {hasChildren && isExpanded && (
                <div className="ml-4 border-l-2 border-[var(--malts-hairline)] pl-4 md:ml-5 md:pl-5">
                  {renderCategoryTree(cat.id, depth + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

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

      {/* Header with Add Button */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title">Категории</h1>
        <button
          onClick={handleOpenAdd}
          type="button"
          className="malts-btn-primary malts-btn-admin-compact w-full shrink-0 rounded-lg text-center font-semibold transition-all sm:w-auto"
        >
          + Добави категория
        </button>
      </div>

      {/* List */}
      <div className="malts-card p-4 md:p-6">
        {categories.length === 0 ? (
          <p className="malts-muted">Няма категории. Добави първата категория!</p>
        ) : (
          <>
            <p className="malts-muted mb-4 text-sm leading-snug">
              Редовете с подкатегории са свити по подразбиране — натисни{' '}
              <span className="font-mono text-[var(--malts-ink)]">+</span> или името на категорията, за да ги
              видиш.
            </p>
            <div>{renderCategoryTree(null, 0)}</div>
          </>
        )}
      </div>

      {/* Modal */}
      <CategoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        category={editingCategory}
        categories={categories}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title="Изтриване на категория"
        message={
          deleteTarget
            ? `Сигурен ли си, че искаш да изтриеш „${deleteTarget.name}“?\n\nПодкатегориите също могат да бъдат засегнати.`
            : ''
        }
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDeleteCategory}
      />
    </div>
  );
}

