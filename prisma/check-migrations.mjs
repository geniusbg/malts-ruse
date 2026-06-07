import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const expectedBrandColumns = [
  'id',
  'brand_id',
  'paper',
  'ink',
  'muted',
  'subtle',
  'card',
  'card_hover',
  'inset',
  'hairline',
  'accent',
  'accent_hover',
  'accent_contrast',
  'accent_contrast_hover',
  'btn_secondary_bg',
  'btn_secondary_text',
  'btn_secondary_border',
  'btn_secondary_bg_hover',
  'btn_secondary_text_hover',
  'success',
  'warning',
  'danger',
  'danger_hover',
  'danger_contrast',
  'danger_contrast_hover',
  'info',
  'theme_color',
  'site_title',
  'site_short_name',
  'site_description',
  'google_fonts_css_url',
  'font_display_family',
  'font_buttons_family',
  'font_nav_family',
  'font_body_family',
  'nav_logo_url',
  'hero_logo_url',
  'app_icon_url',
  'favicon_url',
  'created_at',
  'updated_at',
];

async function main() {
  const migrations = await prisma.$queryRaw`
    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at
  `;
  console.log('=== _prisma_migrations ===');
  for (const m of migrations) {
    console.log(`- ${m.migration_name} (${m.finished_at})`);
  }

  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN (
      'brand_appearance_settings',
      'loading_ui_settings'
    )
    ORDER BY table_name
  `;
  console.log('\n=== key tables exist ===');
  for (const t of tables) console.log(`- ${t.table_name}`);

  let cols = [];
  try {
    cols = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'brand_appearance_settings'
      ORDER BY ordinal_position
    `;
  } catch (e) {
    console.log('\nbrand_appearance_settings: TABLE MISSING');
    cols = [];
  }

  const present = new Set(cols.map((c) => c.column_name));
  console.log('\n=== brand_appearance_settings columns ===');
  if (present.size === 0) {
    console.log('(table missing or no columns)');
  } else {
    console.log([...present].join(', '));
  }

  const missing = expectedBrandColumns.filter((c) => !present.has(c));
  const extra = [...present].filter((c) => !expectedBrandColumns.includes(c));

  console.log('\n=== branding schema check ===');
  if (missing.length) {
    console.log('MISSING (run SQL migrations):');
    missing.forEach((c) => console.log(`  - ${c}`));
  } else {
    console.log('All expected branding columns present.');
  }
  if (extra.length) console.log('Extra columns:', extra.join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
