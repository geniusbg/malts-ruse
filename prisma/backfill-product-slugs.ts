/**
 * След миграцията slug често е копие на id → URL изглеждат като UUID.
 * Този скрипт задава slug от name_bg (латиница, уникален), само където slug липсва или съвпада с id.
 *
 * npx ts-node --project prisma/tsconfig.seed.json prisma/backfill-product-slugs.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ensureUniqueProductSlug, slugify } from '../lib/slug';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, nameBg: true, slug: true },
  });
  let updated = 0;
  for (const p of products) {
    if (p.slug && p.slug !== p.id) continue;
    const s = await ensureUniqueProductSlug(
      slugify(p.nameBg) || `item-${p.id.slice(0, 8)}`,
      p.id
    );
    await prisma.product.update({ where: { id: p.id }, data: { slug: s } });
    updated++;
  }
  console.log(`✅ Product slugs: updated ${updated}, skipped (already custom) ${products.length - updated}, total ${products.length}`);
}

main()
  .catch((e) => {
    console.error('❌ backfill-product-slugs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
