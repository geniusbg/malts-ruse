-- Extend location_settings with coordinates for Google Maps.
-- Safe to run multiple times.

ALTER TABLE "location_settings"
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

