ALTER TABLE "brand_appearance_settings"
  ADD COLUMN IF NOT EXISTS "product_card_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "product_card_text" TEXT,
  ADD COLUMN IF NOT EXISTS "product_card_title_hover" TEXT,
  ADD COLUMN IF NOT EXISTS "product_card_border" TEXT,
  ADD COLUMN IF NOT EXISTS "product_card_hover_border" TEXT;
