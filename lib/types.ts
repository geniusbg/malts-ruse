export interface Category {
  id: string;
  name_bg: string;
  name_en: string;
  name_ro: string;
  slug: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  name_bg: string;
  name_en: string;
  name_ro: string;
  description_bg?: string;
  description_en?: string;
  description_ro?: string;
  price_bgn: number;
  price_eur: number;
  image_url?: string;
  unit?: string;
  quantity?: number;
  is_available: boolean;
  is_featured: boolean;
  allergens?: string[];
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Event {
  id: string;
  title_bg: string;
  title_en: string;
  title_ro: string;
  description_bg: string;
  description_en: string;
  description_ro: string;
  event_date: string;
  location: string;
  is_external: boolean;
  image_url?: string;
  image_card_url?: string;
  image_detail_url?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocalizedText {
  bg: string;
  en: string;
  ro: string;
}
