-- Secondary + danger button tokens (modals: Отказ / Да, излез / Изтрий)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS btn_secondary_bg TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_text TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_border TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_bg_hover TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_text_hover TEXT,
  ADD COLUMN IF NOT EXISTS danger_hover TEXT,
  ADD COLUMN IF NOT EXISTS danger_contrast TEXT,
  ADD COLUMN IF NOT EXISTS danger_contrast_hover TEXT;
