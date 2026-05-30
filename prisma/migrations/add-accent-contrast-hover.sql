-- Button text color on hover (theme-btn-primary:hover)
ALTER TABLE brand_appearance_settings
  ADD COLUMN IF NOT EXISTS accent_contrast_hover TEXT;
