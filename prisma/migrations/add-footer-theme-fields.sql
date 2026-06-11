ALTER TABLE "brand_appearance_settings"
  ADD COLUMN IF NOT EXISTS "footer_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "footer_text" TEXT,
  ADD COLUMN IF NOT EXISTS "footer_link_hover" TEXT,
  ADD COLUMN IF NOT EXISTS "footer_border" TEXT;
