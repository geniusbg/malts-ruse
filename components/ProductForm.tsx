'use client';

import { useState, type ReactNode } from 'react';
import { Category } from '@/lib/types';
import { bgnToEur, eurToBgn } from '@/lib/currency';
import ImageUpload from './ImageUpload';
import CategorySelectCombobox from './CategorySelectCombobox';
import { MaltsInlineFeedback } from '@/components/MaltsInlineFeedback';

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
    return merged;
  });

  const resolvePriceEur = (price: number | ''): number =>
    typeof price === 'number' ? price : parseFloat(String(price || '0')) || 0;

  const [loading, setLoading] = useState(false);
  const [translatingField, setTranslatingField] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);

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
        <label className="malts-label" id="product-category-label">
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
          <label className="malts-label">Име (БГ) *</label>
          <input
            type="text"
            name="name_bg"
            value={formData.name_bg}
            onChange={handleChange}
            className="malts-field"
            required
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
            name="name_en"
            value={formData.name_en}
            onChange={handleChange}
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
            name="name_ro"
            value={formData.name_ro}
            onChange={handleChange}
            className="malts-field"
            required
          />
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="malts-label">Описание (БГ)</label>
          <textarea
            name="description_bg"
            value={formData.description_bg}
            onChange={handleChange}
            rows={3}
            className="malts-field"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="malts-label mb-0">Description (EN)</label>
            <button
              type="button"
              onClick={() => handleTranslate('description_en', 'en')}
              disabled={!formData.description_bg || translatingField === 'description_en'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'description_en' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="description_en"
            value={formData.description_en}
            onChange={handleChange}
            rows={3}
            className="malts-field"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="malts-label mb-0">Description (RO)</label>
            <button
              type="button"
              onClick={() => handleTranslate('description_ro', 'ro')}
              disabled={!formData.description_bg || translatingField === 'description_ro'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'description_ro' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="description_ro"
            value={formData.description_ro}
            onChange={handleChange}
            rows={3}
            className="malts-field"
          />
        </div>
      </div>

      {/* Allergens */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="malts-label">Алергени (БГ)</label>
          <textarea
            name="allergens_bg"
            value={formData.allergens_bg}
            onChange={handleChange}
            rows={2}
            className="malts-field"
            placeholder="напр. Глутен, мляко, яйца"
          />
          <p className="malts-help mt-1">Свободен текст. Показва се само ако е попълнено.</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="malts-label mb-0">Allergens (EN)</label>
            <button
              type="button"
              onClick={() => handleTranslate('allergens_en', 'en')}
              disabled={!formData.allergens_bg || translatingField === 'allergens_en'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'allergens_en' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="allergens_en"
            value={formData.allergens_en}
            onChange={handleChange}
            rows={2}
            className="malts-field"
            placeholder="e.g. Gluten, milk, eggs"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="malts-label mb-0">Alergeni (RO)</label>
            <button
              type="button"
              onClick={() => handleTranslate('allergens_ro', 'ro')}
              disabled={!formData.allergens_bg || translatingField === 'allergens_ro'}
              className="text-sm px-3 py-1 rounded-md border border-[var(--malts-hairline)] text-[var(--malts-ink)] hover:bg-[var(--malts-accent-tint)] disabled:opacity-50"
            >
              {translatingField === 'allergens_ro' ? 'Превеждам...' : 'Авто превод'}
            </button>
          </div>
          <textarea
            name="allergens_ro"
            value={formData.allergens_ro}
            onChange={handleChange}
            rows={2}
            className="malts-field"
            placeholder="ex. Gluten, lapte, ouă"
          />
        </div>
      </div>
      
      {translationError && (
        <MaltsInlineFeedback tone="error" role="alert">
          {translationError}
        </MaltsInlineFeedback>
      )}

      {/* Price and Order */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="malts-label">Цена (€) *</label>
          <input
            type="number"
            name="price_eur"
            value={formData.price_eur || ''}
            onChange={handleChange}
            step="0.01"
            min="0"
            className="malts-field"
            placeholder="0.00"
            required
          />
          <p className="malts-help mt-1">
            ≈ {eurToBgn(resolvePriceEur(formData.price_eur)).toFixed(2)} лв.
          </p>
        </div>
        <div>
          <label className="malts-label">
            Подредба
            <span className="ml-2 text-sm malts-muted font-normal">
              (по-малко число = показва се по-рано)
            </span>
          </label>
          <input
            type="number"
            name="order"
            value={formData.order}
            onChange={handleChange}
            className="malts-field"
            placeholder="0, 1, 2, 3..."
          />
          <p className="malts-help mt-1">
            Използвай за да контролираш реда на продуктите в менюто
          </p>
        </div>
      </div>

      {/* Unit and Quantity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="malts-label">Мерна единица *</label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="malts-field"
            required
          >
            <option value="pcs">бр. (броя)</option>
            <option value="ml">ml (милилитри)</option>
            <option value="g">g (грамове)</option>
            <option value="kg">kg (килограми)</option>
          </select>
        </div>
        <div>
          <label className="malts-label">Количество *</label>
          <input
            type="number"
            name="quantity"
            value={formData.quantity}
            onChange={handleChange}
            min="1"
            className="malts-field"
            required
          />
          <p className="malts-help mt-1">
            Пример: 500 (ml), 200 (g), 1 (kg), 1 (pcs)
          </p>
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-4">
        <div>
          <label className="malts-label">
            Снимка на продукта
          </label>
          <p className="malts-help mb-4">
            💡 Избери ЕДИН от двата начина:
          </p>
        </div>

        {/* Option 1: Upload local file */}
        <div className="malts-card p-4">
          <h3 className="text-[var(--malts-ink)] font-semibold mb-3">Вариант 1: Добави снимка</h3>
          <ImageUpload
            currentImageUrl={formData.image_url}
            onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
            bucket="product-images"
          />
          <p className="malts-muted text-xs mt-2">
            Снимките се запазват в /public/uploads/ и се достъпват чрез /uploads/filename.jpg
          </p>
        </div>

        {/* Option 2: External URL */}
        <div className="malts-card p-4">
          <h3 className="text-[var(--malts-ink)] font-semibold mb-3">Вариант 2: Външен URL (от интернет)</h3>
          <input
            type="text"
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            className="malts-field"
            placeholder="https://example.com/image.jpg"
          />
          <p className="malts-help mt-2">
            Ако използваш upload (Вариант 1), това поле ще се попълни автоматично
          </p>
        </div>
      </div>

      {/* Checkboxes */}
      <div className="space-y-4">
        <div className="malts-card p-6">
          <h3 className="text-[var(--malts-ink)] font-semibold mb-4">Видимост и статус</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-3 text-[var(--malts-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_available"
                checked={formData.is_available}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-success)] focus:ring-[var(--malts-success)]"
              />
              <div>
                <span className="font-semibold">✅ Налично</span>
                <p className="text-sm malts-muted mt-1">
                  Махни отметката ако продукта е временно неналичен. Ще се показва в менюто с избледнял ефект и "Не е наличен" етикет.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 text-[var(--malts-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_hidden"
                checked={formData.is_hidden}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-danger)] focus:ring-[var(--malts-danger)]"
              />
              <div>
                <span className="font-semibold">🚫 Скрит</span>
                <p className="text-sm malts-muted mt-1">
                  Продуктът НЕ се показва в менюто. Използвай за продукти които временно не предлагаш или са в подготовка.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 text-[var(--malts-ink)] cursor-pointer">
              <input
                type="checkbox"
                name="is_featured"
                checked={formData.is_featured}
                onChange={handleChange}
                className="w-5 h-5 mt-0.5 rounded border-[var(--malts-hairline)] bg-[var(--malts-card)] text-[var(--malts-warning)] focus:ring-[var(--malts-warning)]"
              />
              <div>
                <span className="font-semibold">⭐ Препоръчано</span>
                <p className="text-sm malts-muted mt-1">
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
          className="malts-btn-primary malts-btn-admin-compact w-full font-semibold transition-all disabled:opacity-50 sm:flex-1"
        >
          {loading ? 'Запазване...' : 'Запази'}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="malts-btn-secondary malts-btn-admin-compact w-full font-semibold transition-all sm:w-auto"
        >
          Отказ
        </button>
        {footerAddon}
      </div>
    </form>
  );
}


