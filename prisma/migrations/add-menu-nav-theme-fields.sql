ALTER TABLE "brand_appearance_settings"
  ADD COLUMN IF NOT EXISTS "menu_active_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_active_text" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_active_border" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_inactive_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_inactive_text" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_inactive_border" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_hover_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "menu_hover_border" TEXT,
  ADD COLUMN IF NOT EXISTS "nav_active_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "nav_active_text" TEXT,
  ADD COLUMN IF NOT EXISTS "nav_active_border" TEXT,
  ADD COLUMN IF NOT EXISTS "nav_hover_text" TEXT,
  ADD COLUMN IF NOT EXISTS "nav_mobile_active_bg" TEXT;
