-- Add per-brand loading UI settings (assets + rules)
CREATE TABLE IF NOT EXISTS loading_ui_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  brand_id TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_asset_id TEXT,
  assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT loading_ui_settings_brand_fk
    FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
);

