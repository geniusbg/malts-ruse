ALTER TABLE "brand_appearance_settings"
  ADD COLUMN IF NOT EXISTS "hero_glow" TEXT,
  ADD COLUMN IF NOT EXISTS "homepage_accent" TEXT;
