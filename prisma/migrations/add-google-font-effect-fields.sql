ALTER TABLE "brand_appearance_settings"
  ADD COLUMN IF NOT EXISTS "font_display_effect" TEXT,
  ADD COLUMN IF NOT EXISTS "font_mood_effect" TEXT;
