'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import ConfirmModal from '@/components/ConfirmModal';
import { eurToBgn } from '@/lib/currency';
import AutoTranslateButton from '@/components/AutoTranslateButton';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

type PromotionsUiSettings = { id: string; titleBg: string; titleEn: string; titleRo: string };

type PromoRow = {
  id: string;
  productId: string;
  order: number;
  startsAt: string;
  endsAt: string;
  priceBgn: number;
  priceEur: number;
  label: string | null;
  product: { nameBg: string; nameEn: string; nameRo: string };
};

type ProductOpt = {
  id: string;
  nameBg: string;
  nameEn: string;
  nameRo: string;
  priceBgn: number;
  priceEur: number;
  quantity: number;
  unit: string;
  categoryNameBg: string;
  categoryNameEn: string;
  categoryNameRo: string;
};

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminPromotionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromoRow[]>([]);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [uiSettings, setUiSettings] = useState<PromotionsUiSettings | null>(null);
  const [savingUi, setSavingUi] = useState(false);

  const [form, setForm] = useState({
    productId: '',
    order: '0',
    startsAt: '',
    endsAt: '',
    priceBgn: '',
    priceEur: '',
    discountPercent: '',
    label: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<{
    id: string;
    order: string;
    startsAt: string;
    endsAt: string;
    priceBgn: string;
    priceEur: string;
    discountPercent: string;
    label: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletePromoId, setDeletePromoId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productListOpen, setProductListOpen] = useState(false);
  const productComboRef = useRef<HTMLDivElement>(null);
  const productSearchInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [pr, prod, ui] = await Promise.all([
        fetch('/api/promotions').then((r) => r.json()),
        fetch('/api/products').then((r) => r.json()),
        fetch('/api/promotions-ui-settings').then((r) => r.json()).catch(() => null),
      ]);
      if (pr.promotions) setPromotions(pr.promotions);
      if (prod.products) {
        setProducts(
          prod.products.map(
            (p: ProductOpt & {
              priceBgn: unknown;
              category?: { nameBg?: string; nameEn?: string; nameRo?: string };
            }) => ({
              id: p.id,
              nameBg: p.nameBg,
              nameEn: p.nameEn,
              nameRo: p.nameRo,
              priceBgn: Number(p.priceBgn),
              priceEur: Number(p.priceEur),
              quantity: typeof p.quantity === 'number' ? p.quantity : Number(p.quantity) || 1,
              unit: p.unit || 'pcs',
              categoryNameBg: p.category?.nameBg ?? '',
              categoryNameEn: p.category?.nameEn ?? '',
              categoryNameRo: p.category?.nameRo ?? '',
            })
          )
        );
      }
      if (ui?.settings) setUiSettings(ui.settings);
    } catch {
      setErr('Грешка при зареждане');
    } finally {
      setLoading(false);
    }
  }, []);

  const saveUiSettings = async () => {
    if (!uiSettings) return;
    setSavingUi(true);
    setErr(null);
    try {
      const res = await fetch('/api/promotions-ui-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleBg: uiSettings.titleBg,
          titleEn: uiSettings.titleEn,
          titleRo: uiSettings.titleRo,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(data?.error || 'Грешка при запис на настройките');
        return;
      }
      if (data?.settings) setUiSettings(data.settings);
    } catch {
      setErr('Грешка при запис на настройките');
    } finally {
      setSavingUi(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
      return;
    }
    if (status === 'authenticated') load();
  }, [status, load, locale]);

  const productName = (p: ProductOpt) =>
    locale === 'en' ? p.nameEn : locale === 'ro' ? p.nameRo : p.nameBg;

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const haystack = (p: ProductOpt) => {
      const names = `${p.nameBg} ${p.nameEn} ${p.nameRo}`.toLowerCase();
      const cat = `${p.categoryNameBg} ${p.categoryNameEn} ${p.categoryNameRo}`.toLowerCase();
      const qty = String(p.quantity);
      const unit = (p.unit || '').toLowerCase();
      return `${names} ${cat} ${qty} ${unit}`;
    };
    if (!q) return products;
    return products.filter((p) => haystack(p).includes(q));
  }, [products, productSearch]);

  const productsForSelect = useMemo(() => {
    if (!form.productId) return filteredProducts;
    const selected = products.find((p) => p.id === form.productId);
    if (!selected) return filteredProducts;
    if (filteredProducts.some((p) => p.id === form.productId)) return filteredProducts;
    return [selected, ...filteredProducts];
  }, [products, filteredProducts, form.productId]);

  useEffect(() => {
    if (!productListOpen) return;
    const t = window.setTimeout(() => productSearchInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [productListOpen]);

  useEffect(() => {
    if (!productListOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = productComboRef.current;
      if (el && !el.contains(e.target as Node)) setProductListOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProductListOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [productListOpen]);

  const pickProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      productId: id,
      priceBgn: p ? String(p.priceBgn) : f.priceBgn,
      priceEur: p ? String(p.priceEur) : f.priceEur,
    }));
    setProductListOpen(false);
    setProductSearch('');
  };

  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.productId || !form.startsAt || !form.endsAt || (form.priceEur === '' && form.discountPercent === '')) {
      setErr('Попълнете продукт, период и цена или % отстъпка');
      return;
    }
    const priceEurNum = parseFloat(form.priceEur || '0');
    if (Number.isNaN(priceEurNum) || priceEurNum < 0) {
      setErr('Въведете валидна цена в евро');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: form.productId,
          order: Number(form.order) || 0,
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          priceBgn: eurToBgn(priceEurNum),
          priceEur: priceEurNum,
          label: form.label.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка');
      setForm({
        productId: '',
        order: '0',
        startsAt: '',
        endsAt: '',
        priceBgn: '',
        priceEur: '',
        discountPercent: '',
        label: '',
      });
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Грешка');
    } finally {
      setSubmitting(false);
    }
  };

  const executeRemovePromo = async () => {
    if (!deletePromoId) return;
    const id = deletePromoId;
    setDeletePromoId(null);
    try {
      const res = await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Грешка');
      setEditing((e) => (e?.id === id ? null : e));
      await load();
    } catch {
      setErr('Изтриването неуспешно');
    }
  };

  const startEdit = (p: PromoRow) => {
    setErr(null);
    setEditing({
      id: p.id,
      order: String(p.order ?? 0),
      startsAt: toDatetimeLocalValue(p.startsAt),
      endsAt: toDatetimeLocalValue(p.endsAt),
      priceBgn: String(p.priceBgn),
      priceEur: String(p.priceEur),
      discountPercent: '',
      label: p.label ?? '',
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    setErr(null);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const priceEurNum = parseFloat(editing.priceEur);
    if (Number.isNaN(priceEurNum) || priceEurNum < 0) {
      setErr('Въведете валидна цена в евро');
      return;
    }
    setSavingEdit(true);
    setErr(null);
    try {
      const res = await fetch(`/api/promotions/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: Number(editing.order) || 0,
          startsAt: new Date(editing.startsAt).toISOString(),
          endsAt: new Date(editing.endsAt).toISOString(),
          priceBgn: eurToBgn(priceEurNum),
          priceEur: priceEurNum,
          label: editing.label.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Грешка при запис');
      setEditing(null);
      await load();
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : 'Грешка при запис');
    } finally {
      setSavingEdit(false);
    }
  };

  if (status === 'loading' || loading) {
    return <ManagedLoadingScreen locale={locale} />;
  }

  const now = Date.now();
  const selectedProduct = products.find((p) => p.id === form.productId);
  const selectedProductBaseEur = selectedProduct?.priceEur ?? null;
  const productTriggerLabel =
    selectedProduct != null
      ? productName(selectedProduct)
      : locale === 'en'
        ? '— choose product —'
        : locale === 'ro'
          ? '— alege produs —'
          : '— избери продукт —';

  return (
    <div className="max-w-5xl mx-auto w-full">
      <h1 className="malts-admin-heading-font malts-admin-page-title mb-2">Промоции</h1>
      <p className="malts-muted text-sm mb-8">
        Промо цена в зададен период. На менюто се показва ефективната цена и бадж „Промо“.
      </p>

      {uiSettings && (
        <div className="malts-card p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-[var(--malts-ink)]">Заглавие над промо картите</h2>
              <p className="malts-muted mt-1 text-sm">
                Това е текстът „Промоция“, който се вижда над промоциите в началната страница и в `/order`.
              </p>
            </div>
            <button
              type="button"
              onClick={saveUiSettings}
              disabled={savingUi}
              className={`malts-btn-admin-compact w-full rounded-xl font-semibold transition-all sm:w-auto ${
                savingUi ? 'malts-btn-secondary cursor-not-allowed opacity-50' : 'malts-btn-primary'
              }`}
            >
              {savingUi ? 'Запазване...' : 'Запази'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="malts-label">Заглавие (BG)</label>
              <input
                className="malts-field"
                value={uiSettings.titleBg}
                onChange={(e) => setUiSettings({ ...uiSettings, titleBg: e.target.value })}
              />
            </div>
            <div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <label className="malts-label">Заглавие (EN)</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={uiSettings.titleBg}
                  targetLang="en"
                  onTranslated={(text) => setUiSettings({ ...uiSettings, titleEn: text })}
                  onError={setErr}
                />
              </div>
              <input
                className="malts-field"
                value={uiSettings.titleEn}
                onChange={(e) => setUiSettings({ ...uiSettings, titleEn: e.target.value })}
              />
            </div>
            <div>
              <div className="flex justify-between items-center gap-2 mb-2">
                <label className="malts-label">Заглавие (RO)</label>
                <AutoTranslateButton
                  variant="dark"
                  sourceText={uiSettings.titleBg}
                  targetLang="ro"
                  onTranslated={(text) => setUiSettings({ ...uiSettings, titleRo: text })}
                  onError={setErr}
                />
              </div>
              <input
                className="malts-field"
                value={uiSettings.titleRo}
                onChange={(e) => setUiSettings({ ...uiSettings, titleRo: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {err && (
        <MaltsInlineFeedback tone="error" className="mb-4" role="alert">
          {err}
        </MaltsInlineFeedback>
      )}

      <form
        onSubmit={createPromo}
        className="malts-card p-6 mb-10 space-y-4"
      >
        <h2 className="font-semibold text-lg">Нова промоция</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block malts-subtle text-sm mb-1" id="promo-product-label">
              Продукт
            </label>
            <div ref={productComboRef} className="relative">
              <button
                type="button"
                id="promo-product-trigger"
                aria-haspopup="listbox"
                aria-expanded={productListOpen}
                aria-labelledby="promo-product-label promo-product-trigger"
                onClick={() => setProductListOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--malts-hairline)] bg-[var(--malts-inset)] px-3 py-2.5 text-left text-[var(--malts-ink)] transition-colors hover:border-[var(--malts-accent-tint-border)]"
              >
                <span className={selectedProduct ? '' : 'malts-muted'}>{productTriggerLabel}</span>
                <span className="text-[var(--malts-subtle)] shrink-0" aria-hidden>
                  {productListOpen ? '▲' : '▼'}
                </span>
              </button>
              {productListOpen && (
                <div
                  className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-72 flex-col overflow-hidden rounded-xl border border-[var(--malts-hairline)] bg-[var(--malts-card)] shadow-lg"
                  role="listbox"
                  aria-label={
                    locale === 'en'
                      ? 'Products'
                      : locale === 'ro'
                        ? 'Produse'
                        : 'Продукти'
                  }
                >
                  <div
                    className="shrink-0 border-b border-[var(--malts-hairline)] bg-[var(--malts-inset)] p-2"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <input
                      ref={productSearchInputRef}
                      type="search"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder={
                        locale === 'en'
                          ? 'Search (name, category, qty…)…'
                          : locale === 'ro'
                            ? 'Caută (nume, categorie, cant.)…'
                            : 'Търси (име, категория, колич.)…'
                      }
                      className="malts-field w-full text-sm"
                      autoComplete="off"
                      aria-label={
                        locale === 'en'
                          ? 'Search products'
                          : locale === 'ro'
                            ? 'Caută produse'
                            : 'Търсене в продукти'
                      }
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                    {productsForSelect.length === 0 ? (
                      <li className="px-3 py-4 text-sm malts-muted">
                        {locale === 'en'
                          ? 'No products match.'
                          : locale === 'ro'
                            ? 'Niciun rezultat.'
                            : 'Няма съвпадения.'}
                      </li>
                    ) : (
                      productsForSelect.map((p) => (
                        <li key={p.id} role="presentation">
                          <button
                            type="button"
                            role="option"
                            aria-selected={form.productId === p.id}
                            className={`w-full px-3 py-2.5 text-left text-sm transition-colors ${
                              form.productId === p.id
                                ? 'bg-[var(--malts-accent-tint)] text-[var(--malts-ink)]'
                                : 'text-[var(--malts-ink)] hover:bg-[var(--malts-card-hover)]'
                            }`}
                            onClick={() => pickProduct(p.id)}
                          >
                            {productName(p)}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
            <input type="hidden" value={form.productId} required readOnly aria-hidden tabIndex={-1} />
          </div>
          <div>
            <label className="block malts-subtle text-sm mb-1">Подредба (order)</label>
            <input
              type="number"
              value={form.order}
              onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
              placeholder="0"
              className="w-full malts-inset px-3 py-2"
            />
          </div>
          <div>
            <label className="block malts-subtle text-sm mb-1">Етикет (по избор)</label>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Промо"
              className="w-full malts-inset px-3 py-2"
            />
          </div>
          <div>
            <label className="block malts-subtle text-sm mb-1">Начало (локално време)</label>
            <input
              type="datetime-local"
              required
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
              className="w-full malts-inset px-3 py-2"
            />
          </div>
          <div>
            <label className="malts-label">Край</label>
            <input
              type="datetime-local"
              required
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              className="w-full malts-inset px-3 py-2 rounded-lg"
            />
          </div>
          <div>
            <label className="malts-label">Цена (€)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.priceEur}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  priceEur: v,
                  discountPercent: '',
                  priceBgn: v === '' ? '' : String(eurToBgn(parseFloat(v) || 0)),
                }));
              }}
              className="w-full malts-inset px-3 py-2 rounded-lg"
            />
          </div>
          <div>
            <label className="malts-label">% отстъпка (по избор)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={form.discountPercent}
              onChange={(e) => {
                const pctRaw = e.target.value;
                const pct = parseFloat(pctRaw);
                if (!selectedProductBaseEur || Number.isNaN(pct)) {
                  setForm((f) => ({ ...f, discountPercent: pctRaw }));
                  return;
                }
                const nextEur = Math.max(0, selectedProductBaseEur * (1 - pct / 100));
                const eurRounded = Math.round(nextEur * 100) / 100;
                setForm((f) => ({
                  ...f,
                  discountPercent: pctRaw,
                  priceEur: String(eurRounded),
                  priceBgn: String(eurToBgn(eurRounded)),
                }));
              }}
              placeholder="напр. 50"
              className="w-full malts-inset px-3 py-2 rounded-lg"
            />
            <p className="mt-1 text-xs malts-muted">
              {locale === 'bg'
                ? 'Смята се от базовата цена на продукта.'
                : locale === 'en'
                  ? 'Calculated from the product base price.'
                  : 'Calculat din prețul de bază al produsului.'}
            </p>
          </div>
          <div>
            <label className="malts-label">≈ лв. (по фиксиран курс)</label>
            <input
              readOnly
              type="text"
              value={form.priceBgn === '' ? '' : `${form.priceBgn} лв.`}
              className="w-full malts-inset px-3 py-2 rounded-lg malts-muted cursor-not-allowed"
              aria-readonly="true"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="px-6 py-2 malts-btn-primary font-semibold rounded-lg disabled:opacity-50"
        >
          {submitting ? 'Запис…' : 'Добави промоция'}
        </button>
      </form>

      <div className="overflow-x-auto border border-[var(--malts-hairline)] rounded-xl malts-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--malts-hairline)] text-left malts-subtle bg-[var(--malts-inset)]">
              <th className="p-3">Продукт</th>
              <th className="p-3">Период</th>
              <th className="p-3">Цена</th>
              <th className="p-3">Статус</th>
              <th className="p-3 w-[200px]">Действия</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => {
              const start = new Date(p.startsAt).getTime();
              const end = new Date(p.endsAt).getTime();
              const active = now >= start && now <= end;
              const isEditing = editing?.id === p.id;

              if (isEditing && editing) {
                return (
                  <tr key={p.id} className="border-b border-[var(--malts-hairline)] bg-[var(--malts-inset)]">
                    <td className="p-3 align-top" colSpan={5}>
                      <form onSubmit={saveEdit} className="space-y-3">
                        <p className="text-[var(--malts-ink)] font-medium">{p.product.nameBg}</p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="malts-label text-xs">Начало</label>
                            <input
                              type="datetime-local"
                              required
                              value={editing.startsAt}
                              onChange={(e) => setEditing((x) => (x ? { ...x, startsAt: e.target.value } : x))}
                              className="w-full malts-inset rounded-lg px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="malts-label text-xs">Край</label>
                            <input
                              type="datetime-local"
                              required
                              value={editing.endsAt}
                              onChange={(e) => setEditing((x) => (x ? { ...x, endsAt: e.target.value } : x))}
                              className="w-full malts-inset rounded-lg px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="malts-label text-xs">Цена (€)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editing.priceEur}
                              onChange={(e) => {
                                const v = e.target.value;
                                setEditing((x) =>
                                  x
                                    ? {
                                        ...x,
                                        priceEur: v,
                                        discountPercent: '',
                                        priceBgn: v === '' ? '' : String(eurToBgn(parseFloat(v) || 0)),
                                      }
                                    : x
                                );
                              }}
                              className="w-full malts-inset rounded-lg px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="malts-label text-xs">≈ лв.</label>
                            <input
                              readOnly
                              type="text"
                              value={editing.priceBgn === '' ? '' : `${editing.priceBgn} лв.`}
                              className="w-full malts-inset rounded-lg px-2 py-1.5 text-sm malts-muted cursor-not-allowed"
                              aria-readonly="true"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="malts-label text-xs">Етикет</label>
                          <input
                            value={editing.label}
                            onChange={(e) => setEditing((x) => (x ? { ...x, label: e.target.value } : x))}
                            className="w-full max-w-md malts-inset rounded-lg px-2 py-1.5 text-sm"
                          />
                        </div>
                      <div>
                        <label className="malts-label text-xs">Подредба (order)</label>
                        <input
                          type="number"
                          value={editing.order}
                          onChange={(e) => setEditing((x) => (x ? { ...x, order: e.target.value } : x))}
                          className="w-full max-w-md malts-inset rounded-lg px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="malts-label text-xs">% отстъпка (по избор)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="99.99"
                          value={editing.discountPercent}
                          onChange={(e) => {
                            const pctRaw = e.target.value;
                            const pct = parseFloat(pctRaw);
                            const prod = products.find((pp) => pp.id === promotions.find((pr) => pr.id === editing.id)?.productId);
                            const baseEur = prod?.priceEur ?? null;
                            if (!baseEur || Number.isNaN(pct)) {
                              setEditing((x) => (x ? { ...x, discountPercent: pctRaw } : x));
                              return;
                            }
                            const nextEur = Math.max(0, baseEur * (1 - pct / 100));
                            const eurRounded = Math.round(nextEur * 100) / 100;
                            setEditing((x) =>
                              x
                                ? {
                                    ...x,
                                    discountPercent: pctRaw,
                                    priceEur: String(eurRounded),
                                    priceBgn: String(eurToBgn(eurRounded)),
                                  }
                                : x
                            );
                          }}
                          className="w-full max-w-md malts-inset rounded-lg px-2 py-1.5 text-sm"
                        />
                      </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={savingEdit}
                            className="px-4 py-1.5 malts-btn-primary text-sm font-semibold rounded-lg disabled:opacity-50"
                          >
                            {savingEdit ? 'Запис…' : 'Запази'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-4 py-1.5 malts-btn-secondary text-sm rounded-lg"
                          >
                            Отказ
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={p.id} className="border-b border-[var(--malts-hairline)]">
                  <td className="p-3">{p.product.nameBg}</td>
                  <td className="p-3 whitespace-nowrap">
                    {new Date(p.startsAt).toLocaleString('bg')} – {new Date(p.endsAt).toLocaleString('bg')}
                  </td>
                  <td className="p-3">
                    €{p.priceEur.toFixed(2)} · {p.priceBgn.toFixed(2)} лв.
                  </td>
                  <td className="p-3">
                    {active ? (
                      <span className="text-[var(--malts-success)] font-semibold">активна</span>
                    ) : now < start ? (
                      <span className="text-[var(--malts-warning)] font-semibold">предстои</span>
                    ) : (
                      <span className="malts-muted">приключила</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-[var(--malts-accent)] hover:underline mr-4"
                    >
                      Редактирай
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromoId(p.id)}
                      className="text-[var(--malts-danger)] hover:underline"
                    >
                      Изтрий
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {promotions.length === 0 && (
          <p className="p-6 malts-muted text-center">Няма записани промоции.</p>
        )}
      </div>

      <ConfirmModal
        open={!!deletePromoId}
        title="Изтриване на промоция"
        message="Сигурни ли сте, че искате да изтриете тази промоция?"
        confirmLabel="Изтрий"
        cancelLabel="Отказ"
        tone="danger"
        onCancel={() => setDeletePromoId(null)}
        onConfirm={executeRemovePromo}
      />
    </div>
  );
}
