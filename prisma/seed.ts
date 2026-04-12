import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { ensureUniqueProductSlug, slugify } from '../lib/slug';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('🌱 Seeding database (Malts)...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD must be set. Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=strong_password npm run db:seed'
    );
  }

  const brandSlug = process.env.DEFAULT_BRAND_SLUG || 'malts';
  const brand = await prisma.brand.upsert({
    where: { slug: brandSlug },
    update: { name: 'Malts' },
    create: {
      slug: brandSlug,
      name: 'Malts',
    },
  });
  console.log(`✅ Brand: ${brand.name} (${brand.slug})`);

  await prisma.operationalSettings.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      maxQrTables: 30,
      ordersEnabled: true,
      waiterCallEnabled: true,
    },
  });

  await prisma.securitySettings.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
    },
  });

  await prisma.locationSettings.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      addressBg: 'Русе, ул. Александровска 97',
      addressEn: 'Ruse, 97 Aleksandrovska St.',
      addressRo: 'Ruse, str. Aleksandrovska 97',
    },
  });

  const adminPasswordHash = hashPassword(adminPassword);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Super Admin user:', adminEmail);

  const categories = [
    { nameBg: 'Алкохол', nameEn: 'Alcohol', nameRo: 'Alcool', slug: 'alcohol', order: 1 },
    { nameBg: 'Кафе Costa', nameEn: 'Costa Coffee', nameRo: 'Cafea Costa', slug: 'costa-coffee', order: 2 },
    { nameBg: 'Кафе Richard', nameEn: 'Richard Coffee', nameRo: 'Cafea Richard', slug: 'richard-coffee', order: 3 },
    { nameBg: 'Топли Напитки', nameEn: 'Hot Drinks', nameRo: 'Băuturi calde', slug: 'hot-drinks', order: 4 },
    { nameBg: 'Студени Напитки', nameEn: 'Cold Drinks', nameRo: 'Băuturi reci', slug: 'cold-drinks', order: 5 },
    { nameBg: 'Фреш', nameEn: 'Fresh Juices', nameRo: 'Sucuri proaspete', slug: 'fresh-juices', order: 6 },
    { nameBg: 'Безалкохолни', nameEn: 'Soft Drinks', nameRo: 'Răcoritoare', slug: 'soft-drinks', order: 7 },
    { nameBg: 'Лимонади', nameEn: 'Lemonades', nameRo: 'Limonade', slug: 'lemonades', order: 8 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: {
        brandId_slug: { brandId: brand.id, slug: cat.slug },
      },
      update: {
        nameBg: cat.nameBg,
        nameEn: cat.nameEn,
        nameRo: cat.nameRo,
        order: cat.order,
      },
      create: {
        brandId: brand.id,
        nameBg: cat.nameBg,
        nameEn: cat.nameEn,
        nameRo: cat.nameRo,
        slug: cat.slug,
        order: cat.order,
      },
    });
  }
  console.log('✅ Categories seeded (8)');

  /** Demo 3-level hierarchy (Фаза 4 / план): Храна → Скара → Кебапче */
  const demoFood = await prisma.category.upsert({
    where: { brandId_slug: { brandId: brand.id, slug: 'demo-hrana' } },
    update: {},
    create: {
      brandId: brand.id,
      nameBg: 'Демо: Храна',
      nameEn: 'Demo: Food',
      nameRo: 'Demo: Mâncare',
      slug: 'demo-hrana',
      order: 200,
      parentCategoryId: null,
    },
  });
  const demoGrill = await prisma.category.upsert({
    where: { brandId_slug: { brandId: brand.id, slug: 'demo-skara' } },
    update: { parentCategoryId: demoFood.id },
    create: {
      brandId: brand.id,
      nameBg: 'Демо: Скара',
      nameEn: 'Demo: Grill',
      nameRo: 'Demo: Grătar',
      slug: 'demo-skara',
      order: 1,
      parentCategoryId: demoFood.id,
    },
  });
  await prisma.category.upsert({
    where: { brandId_slug: { brandId: brand.id, slug: 'demo-kebapche' } },
    update: { parentCategoryId: demoGrill.id },
    create: {
      brandId: brand.id,
      nameBg: 'Демо: Кебапче',
      nameEn: 'Demo: Kebapche',
      nameRo: 'Demo: Cevapcici',
      slug: 'demo-kebapche',
      order: 1,
      parentCategoryId: demoGrill.id,
    },
  });
  console.log('✅ Demo 3-level categories (demo-hrana → demo-skara → demo-kebapche)');

  const allProducts = await prisma.product.findMany({ select: { id: true, nameBg: true, slug: true } });
  for (const p of allProducts) {
    if (p.slug && p.slug !== p.id) continue;
    const s = await ensureUniqueProductSlug(slugify(p.nameBg) || `item-${p.id.slice(0, 8)}`, p.id);
    await prisma.product.update({ where: { id: p.id }, data: { slug: s } });
  }
  if (allProducts.length > 0) {
    console.log(`✅ Product slugs backfilled (${allProducts.length})`);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  for (let i = 1; i <= 30; i++) {
    const location = i <= 20 ? 'indoor' : i <= 25 ? 'terrace' : 'bar';
    await prisma.barTable.upsert({
      where: {
        brandId_tableNumber: { brandId: brand.id, tableNumber: i },
      },
      update: {},
      create: {
        brandId: brand.id,
        tableNumber: i,
        tableName: `Маса ${i}`,
        capacity: i <= 25 ? 4 : 2,
        location,
        qrCodeUrl: `${appUrl}/order?table=${i}`,
      },
    });
  }
  console.log('✅ Tables seeded (30)');

  console.log('\n🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
