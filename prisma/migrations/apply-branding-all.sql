-- Run once per database (Malts, Dunav, etc.) when branding admin fails or columns are missing.
-- Safe to re-run: uses IF NOT EXISTS.

-- 1) Base branding table
CREATE TABLE IF NOT EXISTS brand_appearance_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  brand_id TEXT UNIQUE NOT NULL,

  paper TEXT,
  ink TEXT,
  muted TEXT,
  subtle TEXT,
  card TEXT,
  card_hover TEXT,
  inset TEXT,
  hairline TEXT,

  accent TEXT,
  accent_hover TEXT,
  accent_contrast TEXT,

  success TEXT,
  warning TEXT,
  danger TEXT,
  info TEXT,

  theme_color TEXT,

  nav_logo_url TEXT,
  hero_logo_url TEXT,
  app_icon_url TEXT,
  favicon_url TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT brand_appearance_settings_brand_fk
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

-- 2) Site identity (tab title, PWA)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS site_title TEXT,
  ADD COLUMN IF NOT EXISTS site_short_name TEXT,
  ADD COLUMN IF NOT EXISTS site_description TEXT;

-- 3) Typography (Google Fonts)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS google_fonts_css_url TEXT,
  ADD COLUMN IF NOT EXISTS font_display_family TEXT,
  ADD COLUMN IF NOT EXISTS font_buttons_family TEXT,
  ADD COLUMN IF NOT EXISTS font_nav_family TEXT,
  ADD COLUMN IF NOT EXISTS font_body_family TEXT;

-- 4) Primary button text on hover
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS accent_contrast_hover TEXT;

-- 5) Secondary + danger modal buttons
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS btn_secondary_bg TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_text TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_border TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_bg_hover TEXT,
  ADD COLUMN IF NOT EXISTS btn_secondary_text_hover TEXT,
  ADD COLUMN IF NOT EXISTS danger_hover TEXT,
  ADD COLUMN IF NOT EXISTS danger_contrast TEXT,
  ADD COLUMN IF NOT EXISTS danger_contrast_hover TEXT;

-- 6) Homepage hero glow + offering accent tags
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS hero_glow TEXT,
  ADD COLUMN IF NOT EXISTS homepage_accent TEXT;
