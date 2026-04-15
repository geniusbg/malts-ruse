-- Add configurable colors for Menu page title/subtitle
-- Safe to run multiple times.

ALTER TABLE menu_settings
  ADD COLUMN IF NOT EXISTS title_color TEXT;

ALTER TABLE menu_settings
  ADD COLUMN IF NOT EXISTS subtitle_color TEXT;

