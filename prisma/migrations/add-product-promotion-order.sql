-- Adds manual ordering for promotions.
-- NOTE: apply with your preferred workflow (e.g. prisma db execute) in environments where migrations are not automatic.

ALTER TABLE "product_promotions"
ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "product_promotions_order_idx"
ON "product_promotions" ("order");

