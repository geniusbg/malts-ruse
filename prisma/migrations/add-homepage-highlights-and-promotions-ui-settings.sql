-- Add per-locale label for offering card highlights (homepage "Акценти" label).
ALTER TABLE "homepage_settings"
  ADD COLUMN IF NOT EXISTS "highlights_label_bg" TEXT NOT NULL DEFAULT 'Акценти',
  ADD COLUMN IF NOT EXISTS "highlights_label_en" TEXT NOT NULL DEFAULT 'Highlights',
  ADD COLUMN IF NOT EXISTS "highlights_label_ro" TEXT NOT NULL DEFAULT 'Accente',
  ADD COLUMN IF NOT EXISTS "cards_heading_bg" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cards_heading_en" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cards_heading_ro" TEXT NOT NULL DEFAULT '';

-- Promotions UI settings (per brand): heading/title used above promotions cards sections.
CREATE TABLE IF NOT EXISTS "promotions_ui_settings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "brand_id" TEXT NOT NULL UNIQUE,
  "title_bg" TEXT NOT NULL DEFAULT 'Промоция',
  "title_en" TEXT NOT NULL DEFAULT 'Promotion',
  "title_ro" TEXT NOT NULL DEFAULT 'Promoție',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotions_ui_settings_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "brands"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "promotions_ui_settings_brand_id_idx"
  ON "promotions_ui_settings"("brand_id");

