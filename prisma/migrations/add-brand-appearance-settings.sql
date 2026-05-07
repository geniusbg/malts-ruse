-- Add per-brand appearance (theme tokens + logos)
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

