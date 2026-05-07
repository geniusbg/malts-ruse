'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { displayPrice } from '@/lib/currency';
import {
  getChildrenOf,
  categoryPathLeafId,
  selectCategoryAtDepth,
  MALLS_MAX_CATEGORY_DEPTH,
} from '@/lib/category-navigation';
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
  /** [root, child, grandchild, ...] — до MALLS_MAX_CATEGORY_DEPTH нива */
  const [categoryPath, setCategoryPath] = useState<string[]>([]);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'visible' | 'hidden'>('all');
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

  const matchesVisibility = (p: any) => {
    if (visibilityFilter === 'hidden') return Boolean(p.isHidden);
    if (visibilityFilter === 'visible') return !p.isHidden;
    return true;
  };

  const leafCategoryId = categoryPathLeafId(categoryPath);

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

  const parentCategories = useMemo(
    () =>
      categories
        .filter((c: any) => !(c.parentCategoryId ?? c.parent_category_id))
        .slice()
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)),
    [categories]
  );

  const categoryProducts = useMemo(() => {
    if (!leafCategoryId) return products;
    return products.filter((p: any) => p.categoryId === leafCategoryId);
  }, [products, leafCategoryId]);

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

  const filteredProducts = categoryProducts.filter(
    (product) => matchesSearchQuery(product) && matchesVisibility(product)
  );

  const totalMatchingSearch = categoryProducts.filter(
    (p) => matchesSearchQuery(p) && matchesVisibility(p)
  ).length;

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

      {/* Category Filter (menu-like tiers) */}
      <div className="mb-4 space-y-2">
        {(() => {
          const tierBtnClass = (depth: number, isActive: boolean) =>
            depth === 0
              ? `rounded-lg px-3 py-2 text-sm font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                    : 'border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
                }`
              : `rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-2 border-[var(--malts-accent)] bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                    : 'border border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
                }`;

          const renderTierRow = (depth: number) => {
            const tierItemsRaw =
              depth === 0
                ? parentCategories
                : categoryPath[depth - 1]
                  ? getChildrenOf(categories, categoryPath[depth - 1]!)
                  : [];
            const tierItems = tierItemsRaw
              .slice()
              .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
            if (tierItems.length === 0) return null;
            return (
              <div className="overflow-x-auto pb-1">
                <div className="flex gap-2 min-w-max">
                  {depth === 0 ? (
                    <button
                      key="__all_products__"
                      type="button"
                      className={tierBtnClass(0, categoryPath.length === 0)}
                      onClick={() => setCategoryPath([])}
                    >
                      Всички продукти
                    </button>
                  ) : null}
                  {tierItems.map((cat: any) => {
                    const isActive = categoryPath[depth] === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={tierBtnClass(depth, isActive)}
                        onClick={() => {
                          const nextPath = selectCategoryAtDepth(categoryPath, depth, cat.id);
                          setCategoryPath(nextPath);
                        }}
                      >
                        {cat.nameBg ?? cat.name_bg ?? '?'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          };

          const tiersToRender = MALLS_MAX_CATEGORY_DEPTH;
          return (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--malts-ink)]">Категории</div>
                {categoryPath.length ? (
                  <button
                    type="button"
                    onClick={() => setCategoryPath([])}
                    className="malts-btn-secondary rounded-lg px-3 py-2 text-sm font-semibold transition-all"
                  >
                    Изчисти филтър
                  </button>
                ) : null}
              </div>
              {Array.from({ length: tiersToRender }).map((_, i) => {
                const row = renderTierRow(i);
                return row ? <div key={`tier-${i}`}>{row}</div> : null;
              })}
              {leafCategoryId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs malts-muted">Избрано:</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-3 py-1 text-xs font-semibold text-[var(--malts-ink)]">
                    {getCategoryPathLabel(leafCategoryId)}
                  </span>
                </div>
              ) : null}
            </>
          );
        })()}
      </div>

      {/* Visibility Filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--malts-ink)]">Показвай:</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--malts-hairline)] bg-[var(--malts-card)]">
            <button
              type="button"
              onClick={() => setVisibilityFilter('all')}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${
                visibilityFilter === 'all'
                  ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
              }`}
            >
              Всички
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('visible')}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${
                visibilityFilter === 'visible'
                  ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
              }`}
            >
              Видими
            </button>
            <button
              type="button"
              onClick={() => setVisibilityFilter('hidden')}
              className={`px-3 py-2 text-sm font-semibold transition-colors ${
                visibilityFilter === 'hidden'
                  ? 'bg-[var(--malts-accent)] text-[var(--malts-accent-contrast)]'
                  : 'text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
              }`}
            >
              Скрити
            </button>
          </div>
        </div>
        <div className="text-sm malts-muted"> </div>
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

              {/* Variants */}
              {(() => {
                const variantsRaw = Array.isArray((product as any)?.variants) ? (product as any).variants : [];
                const variants = variantsRaw
                  .map((v: any) => {
                    if (typeof v === 'string') {
                      const label = String(v || '').trim();
                      return label ? { label, enabled: true } : null;
                    }
                    const label = String(v?.label ?? v?.name ?? '').trim();
                    if (!label) return null;
                    const enabled = v?.enabled !== false;
                    return { label, enabled };
                  })
                  .filter(Boolean) as { label: string; enabled: boolean }[];
                if (variants.length === 0) return null;
                return (
                  <div className="mb-3">
                    <div className="text-[11px] uppercase tracking-wide malts-muted mb-1">
                      Варианти
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v) => (
                        <span
                          key={v.label}
                          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${
                            v.enabled
                              ? 'border-[var(--malts-hairline)] bg-[var(--malts-inset)] text-[var(--malts-ink)]'
                              : 'border-[var(--malts-hairline)] bg-[var(--malts-paper)] text-[var(--malts-subtle)]'
                          }`}
                        >
                          {v.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
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

