/**
 * Еднократно: добавя/актуализира продуктите в категория „Топли напитки“ (1 €).
 * Изпълни: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-hot-drinks.ts
 * След успех може да изтриеш този файл.
 */
import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { eurToBgn } from '../lib/currency';
import { ensureUniqueProductSlug, slugify } from '../lib/slug';

const prisma = new PrismaClient();

async function main() {
  const brandSlug = process.env.DEFAULT_BRAND_SLUG || 'malts';
  const brand = await prisma.brand.findUnique({ where: { slug: brandSlug } });
  if (!brand) {
    throw new Error(`Brand "${brandSlug}" not found. Run the main seed first (db:seed).`);
  }

  const hotDrinks = await prisma.category.findFirst({
    where: { brandId: brand.id, slug: 'topli-napitki' },
  });
  if (!hotDrinks) {
    throw new Error('Category "topli-napitki" not found. Run the main seed first (db:seed).');
  }

  const priceEur = new Prisma.Decimal('1.00');
  const priceBgn = new Prisma.Decimal(eurToBgn(1).toFixed(2));

  const hotDrinksItems: { nameBg: string; nameEn: string; nameRo: string; order: number }[] = [
    { nameBg: 'Кафе Julius Meinl', nameEn: 'Julius Meinl Coffee', nameRo: 'Cafea Julius Meinl', order: 1 },
    { nameBg: 'Капучино', nameEn: 'Cappuccino', nameRo: 'Cappuccino', order: 2 },
    { nameBg: 'Лате', nameEn: 'Latte', nameRo: 'Latte', order: 3 },
    { nameBg: 'Мляко с Нес', nameEn: 'Milk with Nescafé', nameRo: 'Lapte cu Nescafé', order: 4 },
    { nameBg: 'Безкофеиново кафе', nameEn: 'Decaffeinated coffee', nameRo: 'Cafea decofeinizată', order: 5 },
    { nameBg: 'Чай', nameEn: 'Tea', nameRo: 'Ceai', order: 6 },
    { nameBg: 'Мляко с какао', nameEn: 'Milk with cocoa', nameRo: 'Lapte cu cacao', order: 7 },
    { nameBg: 'Горещ шоколад', nameEn: 'Hot chocolate', nameRo: 'Ciocolată caldă', order: 8 },
    { nameBg: 'Фрапе', nameEn: 'Frappé', nameRo: 'Frappé', order: 9 },
    { nameBg: 'Фредо капучино', nameEn: 'Freddo cappuccino', nameRo: 'Freddo cappuccino', order: 10 },
  ];

  for (const item of hotDrinksItems) {
    const existing = await prisma.product.findFirst({
      where: { categoryId: hotDrinks.id, nameBg: item.nameBg },
    });
    const base = {
      nameBg: item.nameBg,
      nameEn: item.nameEn,
      nameRo: item.nameRo,
      priceBgn,
      priceEur,
      order: item.order,
      isAvailable: true,
      isHidden: false,
      allergens: [] as string[],
    };
    if (existing) {
      const slug =
        existing.slug && existing.slug !== existing.id
          ? existing.slug
          : await ensureUniqueProductSlug(slugify(item.nameBg) || `item-${existing.id.slice(0, 8)}`, existing.id);
      await prisma.product.update({
        where: { id: existing.id },
        data: { ...base, slug },
      });
    } else {
      const slug = await ensureUniqueProductSlug(slugify(item.nameBg) || `hot-${item.order}`);
      await prisma.product.create({
        data: { categoryId: hotDrinks.id, ...base, slug },
      });
    }
  }

  console.log(`✅ Hot drinks products seeded/updated (${hotDrinksItems.length})`);
}

main()
  .catch((e) => {
    console.error('❌ seed-topli-napitki error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
