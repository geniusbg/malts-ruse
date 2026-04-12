-- Run manually if needed: psql $DATABASE_URL -f prisma/migrations/add-product-slug.sql
-- Or: npx prisma db execute --file prisma/migrations/add-product-slug.sql

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;

UPDATE "products" SET "slug" = "id"::text WHERE "slug" IS NULL OR trim("slug") = '';

ALTER TABLE "products" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products" ("slug");
