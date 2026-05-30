'use client';

import { useState, type ReactNode } from 'react';
import { Category } from '@/lib/types';
import { bgnToEur, eurToBgn } from '@/lib/currency';
import ImageUpload from './ImageUpload';
import CategorySelectCombobox from './CategorySelectCombobox';
import { ThemeInlineFeedback } from '@/components/ThemeInlineFeedback';

interface ProductFormProps {
  categories: Category[];
  initialData?: Partial<ProductFormData>;
  onSubmit: (data: any) => Promise<void>;
  locale: string;
  /** Extra controls in the submit row (e.g. delete on edit page). */
  footerAddon?: ReactNode;
}

type ProductFormData = {
  name_bg: string;
  name_en: string;
  name_ro: string;
  description_bg: string;
  description_en: string;
  description_ro: string;
  allergens_bg: string;
  allergens_en: string;
  allergens_ro: string;
  variants: { label: string; enabled: boolean }[];
  category_id: string;
  price_eur: number | '';
  unit: string;
  quantity: number;
  is_available: boolean;
  is_hidden: boolean;
  is_featured: boolean;
  image_url: string;
  order: number;
};

const defaultProductFormData = (categories: Category[]): ProductFormData => ({
  name_bg: '',
  name_en: '',
  name_ro: '',
  description_bg: '',
  description_en: '',
  description_ro: '',
  allergens_bg: '',
  allergens_en: '',
  allergens_ro: '',
  variants: [],
  category_id: categories[0]?.id || '',
  price_eur: 0,
  unit: 'pcs',
  quantity: 1,
  is_available: true,
  is_hidden: false,
  is_featured: false,
  image_url: '',
  order: 0
});

export default function ProductForm({
  categories,
  initialData,
  onSubmit,
  locale,
  footerAddon,
}: ProductFormProps) {
  const [formData, setFormData] = useState<ProductFormData>(() => {
    const base = defaultProductFormData(categories);
    const merged = { ...base, ...(initialData || {}) } as ProductFormData & { price_bgn?: number };
    if (
      (merged.price_eur === undefined || merged.price_eur === '') &&
      typeof merged.price_bgn === 'number'
    ) {
      merged.price_eur = bgnToEur(merged.price_bgn);
    }
    delete (merged as { price_bgn?: number }).price_bgn;

    // Normalize variants (trim + dedupe by label) to avoid UI key warnings
    const rawVariants = Array.isArray((merged as any).variants) ? (merged as any).variants : [];
    const normalized = rawVariants
      .map((v: any) => {
        const label = String(v?.label ?? v?.name ?? v ?? '').trim();
        if (!label) return null;
        const enabled = typeof v === 'object' ? v?.enabled !== false : true;
        return { label, enabled };
      })
      .filter(Boolean) as { label: string; enabled: boolean }[];
    const uniq: { label: string; enabled: boolean }[] = [];
    for (const v of normalized) {
      if (uniq.some((x) => x.label === v.label)) continue;
      uniq.push(v);
    }
    (merged as any).variants = uniq;
    return merged;
  });

  const resolvePriceEur = (price: number | ''): number =>
    typeof price === 'number' ? price : parseFloat(String(price || '0')) || 0;

  const [loading, setLoading] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [newVariant, setNewVariant] = useState<string>('');

  const addVariant = (label: string) => {
    const next = String(label || '').trim();
    if (!next) return;
    setFormData((prev) => {
      const existing = Array.isArray(prev.variants) ? prev.variants : [];
      if (existing.some((v) => v?.label === next)) return prev;
      return { ...prev, variants: [...existing, { label: next, enabled: true }] };
    });
    setNewVariant('');
  };

  const removeVariant = (label: string) => {
    setFormData((prev) => {
      const existing = Array.isArray(prev.variants) ? prev.variants : [];
      return { ...prev, variants: existing.filter((v) => v?.label !== label) };
    });
  };

  const toggleVariantEnabled = (label: string) => {
    setFormData((prev) => {
      const existing = Array.isArray(prev.variants) ? prev.variants : [];
      return {
        ...prev,
        variants: existing.map((v) =>
          v?.label === label ? { ...v, enabled: !v.enabled } : v
        ),
      };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'number') {
      setFormData({ ...formData, [name]: value === '' ? '' : parseFloat(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleTranslate = async (
    field: 'name_en' | 'name_ro' | 'description_en' | 'description_ro' | 'allergens_en' | 'allergens_ro',
    targetLang: 'en' | 'ro'
  ) => {
    // Determine source field based on target
    const sourceField = field.includes('name')
      ? 'name_bg'
      : field.includes('allergens')
        ? 'allergens_bg'
        : 'description_bg';
    const source = formData[sourceField]?.trim() || '';
    
    if (!source) {
      setTranslationError('Моля, въведете текст на български, за да използвате автоматичен превод.');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const priceEurValue = resolvePriceEur(formData.price_eur);
    const priceBgnValue = eurToBgn(priceEurValue);

    const dataToSubmit = {
      ...formData,
      price_eur: priceEurValue,
      price_bgn: priceBgnValue
    };

    try {
      await onSubmit(dataToSubmit);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Category: search + tree (+/−) */}
      <div>
        <label className="theme-label" id="product-category-label">
          Категория *
        </label>
        <CategorySelectCombobox
          categories={categories as any[]}
          value={formData.category_id}
          onChange={(id) => setFormData((prev) => ({ ...prev, category_id: id }))}
          locale={locale}
          labelId="product-category-label"
        />
      </div>

      {/* Names */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="theme-label">Име (БГ) *</label>
          <input
            type="text"
            name="name_bg"
            value={formData.name_bg}
            onChange={handleChange}
            className="theme-field"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Name (EN) *</label>
            <button
              type="button"
              onClick={() => handleTranslate('name_en', 'en')}
              disabled={!formData.name_bg || translatingField === 'name_en'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'name_en' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <input
            type="text"
            name="name_en"
            value={formData.name_en}
            onChange={handleChange}
            className="theme-field"
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Name (RO) *</label>
            <button
              type="button"
              onClick={() => handleTranslate('name_ro', 'ro')}
              disabled={!formData.name_bg || translatingField === 'name_ro'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'name_ro' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <input
            type="text"
            name="name_ro"
            value={formData.name_ro}
            onChange={handleChange}
            className="theme-field"
            required
          />
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="theme-label">Описание (БГ)</label>
          <textarea
            name="description_bg"
            value={formData.description_bg}
            onChange={handleChange}
            rows={3}
            className="theme-field"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Description (EN)</label>
            <button
              type="button"
              onClick={() => handleTranslate('description_en', 'en')}
              disabled={!formData.description_bg || translatingField === 'description_en'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'description_en' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="description_en"
            value={formData.description_en}
            onChange={handleChange}
            rows={3}
            className="theme-field"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Description (RO)</label>
            <button
              type="button"
              onClick={() => handleTranslate('description_ro', 'ro')}
              disabled={!formData.description_bg || translatingField === 'description_ro'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'description_ro' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="description_ro"
            value={formData.description_ro}
            onChange={handleChange}
            rows={3}
            className="theme-field"
          />
        </div>
      </div>

      {/* Allergens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="theme-label">Алергени (БГ)</label>
          <textarea
            name="allergens_bg"
            value={formData.allergens_bg}
            onChange={handleChange}
            rows={2}
            className="theme-field"
            placeholder="напр. Глутен, мляко, яйца"
          />
          <p className="theme-help mt-1">Свободен текст. Показва се само ако е попълнено.</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Allergens (EN)</label>
            <button
              type="button"
              onClick={() => handleTranslate('allergens_en', 'en')}
              disabled={!formData.allergens_bg || translatingField === 'allergens_en'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'allergens_en' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="allergens_en"
            value={formData.allergens_en}
            onChange={handleChange}
            rows={2}
            className="theme-field"
            placeholder="e.g. Gluten, milk, eggs"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="theme-label mb-0">Alergeni (RO)</label>
            <button
              type="button"
              onClick={() => handleTranslate('allergens_ro', 'ro')}
              disabled={!formData.allergens_bg || translatingField === 'allergens_ro'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--theme-hairline)] text-[var(--theme-ink)] hover:bg-[var(--theme-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'allergens_ro' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="allergens_ro"
            value={formData.allergens_ro}
            onChange={handleChange}
            rows={2}
            className="theme-field"
            placeholder="ex. Gluten, lapte, ouă"
          />
        </div>
      </div>

      {/* Variants */}
      <div className="theme-card p-6">
        <h3 className="text-[var(--theme-ink)] font-semibold mb-2">
          Варианти (по избор)
        </h3>
        <p className="theme-help mb-4">
          Добави варианти като отделни опции. Пример за “Сок Cappy”: портокал, кайсия, праскова.
        </p>

        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <input
            type="text"
            value={newVariant}
            onChange={(e) => setNewVariant(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // don't submit form
                addVariant(newVariant);
              }
            }}
            className="theme-field"
            placeholder="напр. портокал"
          />
          <button
            type="button"
            onClick={() => addVariant(newVariant)}
            className="theme-btn-primary theme-btn-admin-compact whitespace-nowrap font-semibold"
          >
            + Добави
          </button>
        </div>

        {(formData.variants || []).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(formData.variants || []).map((v, i) => (
              <span
                key={`${String(v?.label ?? '')}::${i}`}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  v.enabled
                    ? 'border-[var(--theme-hairline)] bg-[var(--theme-inset)] text-[var(--theme-ink)]'
                    : 'border-[var(--theme-hairline)] bg-[var(--theme-paper)] text-[var(--theme-subtle)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleVariantEnabled(v.label)}
                  className={`rounded-full px-1.5 py-0.5 text-xs font-bold border ${
                    v.enabled
                      ? 'border-[rgba(22,101,52,0.25)] text-[var(--theme-success)] hover:bg-[rgba(22,101,52,0.08)]'
                      : 'border-[rgba(146,64,14,0.25)] text-[var(--theme-warning)] hover:bg-[rgba(146,64,14,0.08)]'
                  }`}
                  aria-label={`${v.enabled ? 'Маркирай като неналичен' : 'Маркирай като наличен'}: ${v.label}`}
                  title={v.enabled ? 'Налично' : 'Временно неналично'}
                >
                  {v.enabled ? '✓' : '✕'}
                </button>
                <span>{v.label}</span>
                <button
                  type="button"
                  onClick={() => removeVariant(v.label)}
                  className="rounded-full px-1.5 py-0.5 text-xs font-bold text-[var(--theme-danger)] hover:bg-[rgba(127,29,29,0.08)]"
                  aria-label={`Премахни вариант ${v.label}`}
                  title="Премахни"
                >
                  −
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
      
      {translationError && (
        <ThemeInlineFeedback tone="error" role="alert">
          {translationError}
        </ThemeInlineFeedback>
      )}

      {/* Price and Order */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="theme-label">Цена (€) *</label>
          <input
            type="number"
            name="price_eur"
            value={formData.price_eur || ''}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="theme-field"
            placeholder="0.00"
            required
          />
          <p className="theme-help mt-1">
            ≈ {eurToBgn(resolvePriceEur(formData.price_eur)).toFixed(2)} лв.
          </p>
        </div>
        <div>
          <label className="theme-label">
            Подредба
            <span className="ml-2 text-sm theme-muted font-normal">
              (по-малко число = показва се по-рано)
            </span>
          </label>
          <input
            type="number"
            name="order"
            value={formData.order}
            onChange={handleChange}
            className="theme-field"
            placeholder="0, 1, 2, 3..."
          />
          <p className="theme-help mt-1">
            Използвай за да контролираш реда на продуктите в менюто
          </p>
        </div>
      </div>

      {/* Unit and Quantity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="theme-label">Мерна единица *</label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="theme-field"
            required
          >
            <option value="pcs">бр. (броя)</option>
            <option value="ml">ml (милилитри)</option>
            <option value="g">g (грамове)</option>
            <option value="kg">kg (килограми)</option>
          </select>
        </div>
        <div>
          <label className="theme-label">Количество *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            className="theme-field"
            required
          />
          <p className="theme-help mt-1">
            Пример: 500 (ml), 200 (g), 1 (kg), 1 (pcs)
          </p>
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-4">
        <div>
          <label className="theme-label">
            Снимка на продукта
          </label>
          <p className="theme-help mb-4">
            💡 Избери ЕДИН от двата начина:
          </p>
        </div>

        {/* Option 1: Upload local file */}
        <div className="theme-card p-4">
          <h3 className="text-[var(--theme-ink)] font-semibold mb-3">Вариант 1: Добави снимка</h3>
          <ImageUpload
            currentImageUrl={formData.image_url}
            onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
            bucket="product-images"
          />
          <p className="theme-muted text-xs mt-2">
            Снимките се запазват в /public/uploads/ и се достъпват чрез /uploads/filename.jpg
          </p>
        </div>

        {/* Option 2: External URL */}
        <div className="theme-card p-4">
          <h3 className="text-[var(--theme-ink)] font-semibold mb-3">Вариант 2: Външен URL (от интернет)</h3>
          <input
            type="text"
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            className="theme-field"
            placeholder="https://example.com/image.jpg"
          />
          <p className="theme-help mt-2">
            Ако използваш upload (Вариант 1), това поле ще се попълни автоматично
          </p>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-4">
        <div className="theme-card p-6">
          <h3 className="text-[var(--theme-ink)] font-semibold mb-4">Видимост и статус</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-[var(--theme-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_available"
                checked={formData.is_available}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--theme-hairline)] bg-[var(--theme-card)] text-[var(--theme-success)] focus:ring-[var(--theme-success)]"
              />
              <div>
                <span className="font-semibold">✅ Налично</span>
                <p className="text-sm theme-muted mt-1">
                  Махни отметката ако продукта е временно неналичен. Ще се показва в менюто с избледнял ефект и &quot;Не е наличен&quot; етикет.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 text-[var(--theme-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_hidden"
                checked={formData.is_hidden}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--theme-hairline)] bg-[var(--theme-card)] text-[var(--theme-danger)] focus:ring-[var(--theme-danger)]"
              />
              <div>
                <span className="font-semibold">🚫 Скрит</span>
                <p className="text-sm theme-muted mt-1">
                  Продуктът НЕ се показва в менюто. Използвай за продукти които временно не предлагаш или са в подготовка.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 text-[var(--theme-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--theme-hairline)] bg-[var(--theme-card)] text-[var(--theme-warning)] focus:ring-[var(--theme-warning)]"
              />
              <div>
                <span className="font-semibold">⭐ Препоръчано</span>
                <p className="text-sm theme-muted mt-1">
                  Продуктът ще има звезда икона за да се откроява като специална препоръка.
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4 sm:items-center">
        <button
          type="submit"
          disabled={loading}
          className="theme-btn-primary theme-btn-admin-compact w-full font-semibold transition-all disabled:opacity-50 sm:flex-1"
        >
          {loading ? 'Запазване...' : 'Запази'}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="theme-btn-secondary theme-btn-admin-compact w-full font-semibold transition-all sm:w-auto"
        >
          Отказ
        </button>
        {footerAddon}
      </div>
    </form>
  );
}


