-- Extend location_settings with contact fields.
ALTER TABLE "location_settings"
  ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "instagram_url" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "facebook_url" TEXT NOT NULL DEFAULT '';

