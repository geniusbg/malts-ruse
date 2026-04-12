-- Event: separate images for list cards vs detail page (+ optional client upload targets).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "image_card_url" TEXT;
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "image_detail_url" TEXT;

-- Existing rows: reuse legacy image_url for both until admins set dedicated assets.
UPDATE "events"
SET "image_detail_url" = COALESCE("image_detail_url", "image_url")
WHERE "image_url" IS NOT NULL;

UPDATE "events"
SET "image_card_url" = COALESCE("image_card_url", "image_url")
WHERE "image_url" IS NOT NULL;
