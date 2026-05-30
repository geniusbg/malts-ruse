-- Site title / description in branding (browser tab, PWA)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS site_title TEXT,
  ADD COLUMN IF NOT EXISTS site_short_name TEXT,
  ADD COLUMN IF NOT EXISTS site_description TEXT;
