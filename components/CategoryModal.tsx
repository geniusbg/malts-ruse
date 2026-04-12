'use client';

import { useEffect, useState } from 'react';
import { useLockScroll } from '@/lib/use-lock-scroll';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>; // Returns true on success
  category?: any; // For editing existing category
  categories?: any[]; // All categories for parent selection
}

export default function CategoryModal({ isOpen, onClose, onSubmit, category, categories = [] }: CategoryModalProps) {
  const [formData, setFormData] = useState({
    name_bg: '',
    name_en: '',
    name_ro: '',
    order: 0,
    parent_category_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [translatingField, setTranslatingField] = useState<'name_en' | 'name_ro' | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

  const flatCategories = categories as any[];
  const byId = new Map<string, any>(flatCategories.map((c) => [c.id, c]));
  const getPathLabel = (catId: string) => {
    const parts: string[] = [];
    let cur: any | undefined = byId.get(catId);
    let guard = 0;
    while (cur && guard < 20) {
      parts.unshift(cur.nameBg || cur.slug || cur.id);
      cur = cur.parentCategoryId ? byId.get(cur.parentCategoryId) : undefined;
      guard += 1;
    }
    return parts.join(' → ');
  };

  const isDescendant = (ancestorId: string, nodeId: string) => {
    let cur = byId.get(nodeId);
    let guard = 0;
    while (cur && guard < 50) {
      if (cur.id === ancestorId) return true;
      cur = cur.parentCategoryId ? byId.get(cur.parentCategoryId) : undefined;
      guard += 1;
    }
    return false;
  };

  // Lock scroll when modal is open (backdrop locked, modal can scroll)
  useLockScroll(isOpen);


  const handleTranslate = async (field: 'name_en' | 'name_ro', targetLang: 'en' | 'ro') => {
    const source = formData.name_bg.trim();
    if (!source) {
      setTranslationError('Моля, въведете име на български, за да използвате автоматичен превод.');
      return;
    }

    setTranslationError(null);
    setTranslatingField(field);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: source,
          targetLang
        })
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      if (data?.text) {
        setFormData((prev) => ({
          ...prev,
          [field]: data.text
        }));
      } else {
        setTranslationError('Неуспешно получаване на превода. Опитайте отново.');
      }
    } catch (error) {
      setTranslationError('Неуспешен превод. Моля, опитайте отново.');
    } finally {
      setTranslatingField(null);
    }
  };

  // Reset form when modal opens/closes or category changes
  useEffect(() => {
    if (!isOpen) return;
    if (category) {
      setFormData({
        name_bg: category.nameBg || '',
        name_en: category.nameEn || '',
        name_ro: category.nameRo || '',
        order: category.order || 0,
        parent_category_id: category.parentCategoryId || ''
      });
    } else {
      setFormData({
        name_bg: '',
        name_en: '',
        name_ro: '',
        order: 0,
        parent_category_id: ''
      });
    }
  }, [isOpen, category]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const success = await onSubmit(formData);
      // Only close modal if submission was successful
      if (success) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden overscroll-contain">
      <div
        className="fixed inset-0 bg-[var(--malts-paper)]/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 flex min-h-[100dvh] min-h-[100svh] items-center justify-center p-3 py-10 sm:p-4 sm:py-12"
        onClick={onClose}
      >
        <div
          data-modal-scroll
          className="malts-card w-full max-w-2xl max-h-[min(88dvh,92svh)] overflow-y-auto overscroll-contain rounded-2xl shadow-lg touch-pan-y"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3 sm:mb-6">
            <h2 id="category-modal-title" className="min-w-0 text-xl font-bold sm:text-2xl md:text-3xl">
              {category ? 'Редактирай категория' : 'Добави нова категория'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--malts-accent-tint)] rounded-lg transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="malts-label">Име (БГ) *</label>
              <input
                type="text"
                value={formData.name_bg}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name_bg: e.target.value
                  }))
                }
                className="malts-field"
                required
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="malts-label mb-0">Name (EN) *</label>
                <button
                  type="button"
                  onClick={() => handleTranslate('name_en', 'en')}
                  disabled={!formData.name_bg || translatingField === 'name_en'}
                  className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
                >
                  {translatingField === 'name_en' ? 'Превеждам...' : 'Авто превод'}
                </button>
              </div>
              <input
                type="text"
                value={formData.name_en}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name_en: e.target.value
                  }))
                }
                className="malts-field"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="malts-label mb-0">Name (RO) *</label>
                <button
                  type="button"
                  onClick={() => handleTranslate('name_ro', 'ro')}
                  disabled={!formData.name_bg || translatingField === 'name_ro'}
                  className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
                >
                  {translatingField === 'name_ro' ? 'Превеждам...' : 'Авто превод'}
                </button>
              </div>
              <input
                type="text"
                value={formData.name_ro}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    name_ro: e.target.value
                  }))
                }
                className="malts-field"
                required
              />
            </div>

            {translationError && (
              <p className="text-sm text-red-400">{translationError}</p>
            )}

            <div>
              <label className="malts-label">
                Родителска категория
                <span className="ml-2 text-sm malts-muted font-normal">(остави празно за главна категория)</span>
              </label>
              <select
                value={formData.parent_category_id}
                onChange={(e) => setFormData({ ...formData, parent_category_id: e.target.value })}
                className="malts-field"
              >
                <option value="">-- Главна категория --</option>
                {flatCategories
                  .filter((c: any) => c.id !== category?.id)
                  .sort((a: any, b: any) => getPathLabel(a.id).localeCompare(getPathLabel(b.id), 'bg'))
                  .map((c: any) => {
                    const disabled =
                      !!category?.id && isDescendant(category.id, c.id); // prevent selecting a child as parent
                    return (
                      <option key={c.id} value={c.id} disabled={disabled}>
                        {getPathLabel(c.id)}
                      </option>
                    );
                  })}
              </select>
            </div>

            <div>
              <label className="malts-label">
                Подредба
                <span className="ml-2 text-sm malts-muted font-normal">(по-малко = показва се по-рано)</span>
              </label>
              <input
                type="number"
                value={formData.order}
                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                className="malts-field"
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:gap-4 sm:pt-4">
              <button
                type="submit"
                disabled={loading}
                className="malts-btn-primary malts-btn-admin-compact order-2 w-full rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:order-1 sm:flex-1"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {category ? 'Обновяване...' : 'Добавяне...'}
                  </span>
                ) : (
                  category ? 'Обнови' : 'Добави'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="malts-btn-secondary malts-btn-admin-compact order-1 w-full rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:w-auto"
              >
                Отказ
              </button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}

