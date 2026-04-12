-- Add menu settings table
CREATE TABLE IF NOT EXISTS menu_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title_bg TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_de TEXT NOT NULL,
  subtitle_bg TEXT NOT NULL,
  subtitle_en TEXT NOT NULL,
  subtitle_de TEXT NOT NULL,
  background_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO menu_settings (title_bg, title_en, title_de, subtitle_bg, subtitle_en, subtitle_de, background_image_url)
VALUES (
  '🍸 Нашето Меню',
  '🍸 Our Menu',
  '🍸 Unser Menü',
  'Открийте селекцията ни от напитки и деликатеси',
  'Discover our selection of drinks and delicacies',
  'Entdecken Sie unsere Auswahl an Getränken und Köstlichkeiten',
  NULL
) ON CONFLICT DO NOTHING;

