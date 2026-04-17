-- Staff table assignments + user "see all tables" + product allergens (multi-lang)
-- Safe to run multiple times.

-- Users: can see all tables
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "can_see_all_tables" BOOLEAN NOT NULL DEFAULT FALSE;

-- Product: allergens text (multi-lang)
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "allergens_bg" TEXT,
  ADD COLUMN IF NOT EXISTS "allergens_en" TEXT,
  ADD COLUMN IF NOT EXISTS "allergens_ro" TEXT;

-- Assignments table (many-to-many user <-> bar_tables)
CREATE TABLE IF NOT EXISTS "staff_table_assignments" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "brand_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "table_id" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_table_assignments_brand_fk" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE,
  CONSTRAINT "staff_table_assignments_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "staff_table_assignments_table_fk" FOREIGN KEY ("table_id") REFERENCES "bar_tables"("id") ON DELETE CASCADE
);

-- Uniqueness: a table can't be assigned twice to same user
CREATE UNIQUE INDEX IF NOT EXISTS "staff_table_assignments_user_table_unique"
  ON "staff_table_assignments" ("user_id", "table_id");

CREATE INDEX IF NOT EXISTS "staff_table_assignments_brand_idx"
  ON "staff_table_assignments" ("brand_id");

CREATE INDEX IF NOT EXISTS "staff_table_assignments_user_idx"
  ON "staff_table_assignments" ("user_id");

CREATE INDEX IF NOT EXISTS "staff_table_assignments_table_idx"
  ON "staff_table_assignments" ("table_id");

