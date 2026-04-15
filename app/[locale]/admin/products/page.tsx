'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { displayPrice } from '@/lib/currency';
import { getDescendantCategoryIds } from '@/lib/category-navigation';
import Toast from '@/components/Toast';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';
import { productParamForUrl } from '@/lib/product-url';

export default function AdminProductsPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [productsRes, categoriesRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/categories')
    ]);

    const productsData = await productsRes.json();
    const categoriesData = await categoriesRes.json();

    setProducts(productsData.products || []);
    setCategories(categoriesData.categories || []);
    setLoading(false);
  }

  const categoryRefs = useMemo(
    () =>
      categories.map((c: any) => ({
        id: c.id,
        parentCategoryId: (c.parentCategoryId ?? c.parent_category_id ?? null) as string | null,
      })),
    [categories]
  );

  const matchesSearchQuery = (p: any) =>
    searchQuery === '' ||
    p.nameBg.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nameEn?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.nameRo?.toLowerCase().includes(searchQuery.toLowerCase());

  /** За всеки възел: той + всички подкатегории (за бързо броене и филтър) */
  const descendantIdsByCategory = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const c of categoryRefs) {
      map.set(c.id, getDescendantCategoryIds(categoryRefs, c.id));
    }
    return map;
  }, [categoryRefs]);

  const selectedCategoryIds = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return descendantIdsByCategory.get(selectedCategory) ?? new Set<string>();
  }, [selectedCategory, descendantIdsByCategory]);

  /** Пълен път за йерархия (напр. „Бир → Наливна бира“) */
  const getCategoryPathLabel = (categoryId: string) => {
    const byId = new Map(categoryRefs.map((c) => [c.id, c]));
    const names = new Map(categories.map((c: any) => [c.id, c.nameBg ?? c.name_bg ?? '']));
    const parts: string[] = [];
    let cur: string | undefined = categoryId;
    let guard = 0;
    while (cur && guard < 32) {
      parts.unshift(names.get(cur) ?? '?');
      cur = byId.get(cur)?.parentCategoryId ?? undefined;
      guard += 1;
    }
    return parts.join(' → ');
  };

  const executeDeleteProduct = async () => {
    if (!deleteTarget) return;
    const productId = deleteTarget.id;
    setDeleteTarget(null);

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        const data = await response.json();
        loadData();
        setToast({ message: `✅ ${data.message}`, type: 'success' });
      } else {
        const data = await response.json();
        setToast({ message: data.error || 'Грешка при изтриване на продукта', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Грешка при изтриване на продукта', type: 'error' });
    }
  };

  if (loading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategoryIds === null || selectedCategoryIds.has(product.categoryId);
    return matchesCategory && matchesSearchQuery(product);
  });

  const totalMatchingSearch = products.filter(matchesSearchQuery).length;

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 md:mb-8">
        <h1 className="malts-admin-heading-font malts-admin-page-title">Продукти</h1>
        <Link
          href={`/${locale}/admin/products/new`}
          className="malts-btn-primary malts-btn-admin-compact w-full rounded-lg text-center font-semibold transition-all sm:w-auto"
        >
          + Добави продукт
        </Link>
      </div>

      {/* Category Filter */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
            }`}
          >
            Всички ({totalMatchingSearch})
          </button>
          {categories.map((category: any) => {
            const inTree = descendantIdsByCategory.get(category.id) ?? new Set();
            const count = products.filter(
              (p) => inTree.has(p.categoryId) && matchesSearchQuery(p)
            ).length;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-[var(--malts-accent)] text-[#f5f0e6]'
                    : 'bg-[var(--malts-card)] text-[var(--malts-ink)] border border-[var(--malts-hairline)] hover:bg-[var(--malts-card-hover)]'
                }`}
              >
                {category.nameBg} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Търси продукт..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="malts-field"
        />
      </div>

      {/* Products Grid - Card View */}
      {filteredProducts.length === 0 ? (
        <p className="text-center py-16 malts-muted">
          Няма продукти за този филтър{searchQuery.trim() ? ' / търсене' : ''}.
        </p>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map((product: any) => (
          <div
            key={product.id}
            className="malts-card overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* Product Image */}
            {product.imageUrl ? (
              <div className="relative h-56 w-full overflow-hidden bg-[var(--malts-inset)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.nameBg}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              </div>
            ) : (
              <div className="h-56 bg-[var(--malts-inset)] flex items-center justify-center">
                <svg className="w-16 h-16 text-[var(--malts-subtle)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {/* Product Info */}
            <div className="p-4">
              {/* Name with Price and Status in one row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[var(--malts-ink)] flex items-center gap-2 mb-1">
                    {product.isFeatured && <span className="text-yellow-400">⭐</span>}
                    {product.nameBg}
                  </h3>
                  <p className="malts-subtle text-xs">{getCategoryPathLabel(product.categoryId)}</p>
                </div>
                <div className="text-right ml-3">
                  <div className="text-xl font-bold text-[var(--malts-ink)]">{displayPrice(Number(product.priceBgn), 'EUR')}</div>
                  <div className="text-xs malts-subtle">{displayPrice(Number(product.priceBgn), 'BGN')}</div>
                  {product.unit && product.quantity && (
                    <div className="text-xs malts-subtle mt-1">
                      {product.quantity} {product.unit === 'pcs' ? 'бр.' : product.unit}
                    </div>
                  )}
                  <div className="mt-1">
                    {product.isHidden ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-[var(--malts-inset)] border border-[var(--malts-hairline)] text-[var(--malts-ink)] inline-block">
                        🚫 Скрит
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs inline-block ${
                        product.isAvailable 
                          ? 'bg-[rgba(22,101,52,0.12)] text-[var(--malts-success)] border border-[rgba(22,101,52,0.25)]'
                          : 'bg-[rgba(146,64,14,0.12)] text-[var(--malts-warning)] border border-[rgba(146,64,14,0.25)]'
                      }`}>
                        {product.isAvailable ? '✅ Налично' : '⚠️ Не е наличен'}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              {(() => {
                const description = 
                  (locale === 'bg' && product.descriptionBg) ||
                  (locale === 'en' && product.descriptionEn) ||
                  (locale === 'ro' && product.descriptionRo) ||
                  product.descriptionBg ||
                  product.descriptionEn ||
                  product.descriptionRo;
                
                return description ? (
                  <div className="mb-3">
                    <p className="malts-muted text-sm leading-relaxed break-words whitespace-pre-wrap">
                      {description}
                    </p>
                  </div>
                ) : null;
              })()}

              {/* Actions */}
              <div className="flex gap-2">
                <Link
                  href={`/${locale}/admin/products/${encodeURIComponent(productParamForUrl(product))}/edit`}
                  className="flex-1 px-3 py-2 malts-btn-secondary rounded-lg text-sm font-semibold transition-all text-center"
                >
                  Редактирай
                </Link>
                <button
                  onClick={() => setDeleteTarget({ id: product.id, name: product.nameBg })}
                  className="flex-1 px-3 py-2 malts-btn-danger rounded-lg text-sm font-semibold transition-all"
                >
                  Изтрий
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Изтриване на продукт"
        message={
          deleteTarget
            ? `Сигурен ли си, че искаш да изтриеш „${deleteTarget.name}“?\n\nАко продуктът има поръчки, ще бъде само скрит. Ако няма поръчки, ще бъде изтрит перманентно.`
            : ''
        }
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={executeDeleteProduct}
      />
    </div>
  );
}

