-- Custom typography per brand (Google Fonts URL + family stacks)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS google_fonts_css_url TEXT,
  ADD COLUMN IF NOT EXISTS font_display_family TEXT,
  ADD COLUMN IF NOT EXISTS font_buttons_family TEXT,
  ADD COLUMN IF NOT EXISTS font_nav_family TEXT,
  ADD COLUMN IF NOT EXISTS font_body_family TEXT;
