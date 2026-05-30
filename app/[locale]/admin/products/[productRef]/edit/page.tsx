'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import ProductForm from '@/components/ProductForm';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';

export default function EditProductPage({
  params,
}: {
  params: Promise<{ productRef: string; locale: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname.split('/')[1] || 'bg';
  const [urlRef, setUrlRef] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function init() {
      const resolvedParams = await params;
      const ref = resolvedParams.productRef;
      setUrlRef(ref);

      const [categoriesRes, productRes] = await Promise.all([
        fetch('/api/categories'),
        fetch(`/api/products/${encodeURIComponent(ref)}`),
      ]);

      const categoriesData = await categoriesRes.json();
      const productData = await productRes.json();

      setCategories(categoriesData.categories || []);

      if (!productRes.ok || !productData.product) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (productData.product) {
        const p = productData.product;
        const variants =
          Array.isArray((p as any).variants) ? ((p as any).variants as any[]) : [];
        const variantOptions = variants
          .map((v) => {
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
        setProductName(p.nameBg || '');
        setProduct({
          category_id: p.categoryId,
          name_bg: p.nameBg,
          name_en: p.nameEn,
          name_ro: p.nameRo,
          description_bg: p.descriptionBg || '',
          description_en: p.descriptionEn || '',
          description_ro: p.descriptionRo || '',
          allergens_bg: p.allergensBg || '',
          allergens_en: p.allergensEn || '',
          allergens_ro: p.allergensRo || '',
          variants: variantOptions,
          price_eur: Number(p.priceEur),
          image_url: p.imageUrl || '',
          unit: p.unit || 'pcs',
          quantity: p.quantity || 1,
          is_available: p.isAvailable,
          is_hidden: p.isHidden,
          is_featured: p.isFeatured,
          order: p.order,
        });
      }

      setLoading(false);
    }

    init();
  }, [params]);

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(urlRef)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.status === 503 || !response.ok) {
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
        throw new Error('Server is offline');
      }

      if (response.ok) {
        router.push(`/${locale}/admin/products`);
      }
    } catch (error: any) {
      if (error.name === 'TypeError' || error.message === 'Server is offline') {
        if (typeof window !== 'undefined' && (window as any).__setOfflineState) {
          (window as any).__setOfflineState(true);
        }
        if (typeof window !== 'undefined' && (window as any).__setServerDown) {
          (window as any).__setServerDown(true);
        }
      }
      throw error;
    }
  };

  const executeDelete = async () => {
    setDeleteOpen(false);
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(urlRef)}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        router.push(`/${locale}/admin/products`);
        return;
      }
    } catch {
      /* fall through */
    }
    router.push(`/${locale}/admin/products`);
  };

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="theme-admin-heading-font theme-admin-page-title mb-4">Продуктът не е намерен</h1>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin/products`)}
          className="theme-btn-primary theme-btn-admin-compact rounded-lg font-semibold"
        >
          Към списъка с продукти
        </button>
      </div>
    );
  }

  if (loading || !product || categories.length === 0) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  return (
    <div>
      <h1 className="theme-admin-heading-font theme-admin-page-title mb-8">Редактирай продукт</h1>

      <div className="theme-card rounded-xl p-8">
        <ProductForm
          categories={categories}
          initialData={product}
          onSubmit={handleSubmit}
          locale={locale}
          footerAddon={
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="theme-btn-danger theme-btn-admin-compact w-full font-semibold transition-all sm:w-auto"
            >
              Изтрий
            </button>
          }
        />
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Изтриване на продукт"
        message={`Сигурен ли си, че искаш да изтриеш „${productName}“?\n\nАко продуктът има поръчки, ще бъде само скрит. Ако няма поръчки, ще бъде изтрит перманентно.`}
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={executeDelete}
      />
    </div>
  );
}
