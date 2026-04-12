import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDefaultBrandId } from '@/lib/brand';
import { ensureUniqueProductSlug, slugify } from '@/lib/slug';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const brandId = await getDefaultBrandId();
    const category = await prisma.category.findFirst({
      where: { id: data.category_id, brandId },
    });
    if (!category) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const slug = await ensureUniqueProductSlug(slugify(data.name_bg) || `item-${Date.now()}`);

    // Map snake_case to camelCase for Prisma
    const product = await prisma.product.create({
      data: {
        slug,
        categoryId: data.category_id,
        nameBg: data.name_bg,
        nameEn: data.name_en,
        nameRo: data.name_ro,
        descriptionBg: data.description_bg || null,
        descriptionEn: data.description_en || null,
        descriptionRo: data.description_ro || null,
        priceBgn: data.price_bgn,
        priceEur: data.price_eur,
        imageUrl: data.image_url || null,
        unit: data.unit || 'pcs',
        quantity: data.quantity || 1,
        isAvailable: data.is_available !== undefined ? data.is_available : true,
        isHidden: data.is_hidden !== undefined ? data.is_hidden : false,
        isFeatured: data.is_featured !== undefined ? data.is_featured : false,
        order: data.order || 0,
        allergens: data.allergens || []
      }
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category_id');
    const brandId = await getDefaultBrandId();

    // Check if user is SUPER_ADMIN
    const userRole = (session?.user as any)?.role;
    const showHidden = userRole === 'SUPER_ADMIN';

    const where: import('@prisma/client').Prisma.ProductWhereInput = {
      category: { brandId },
    };
    if (categoryId) where.categoryId = categoryId;
    if (!showHidden) where.isHidden = false;

    const products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: {
            order: true,
            nameBg: true,
            nameEn: true,
            nameRo: true,
          },
        },
      }
    });

    // Sort by category order first, then by product order
    const sortedProducts = products.sort((a, b) => {
      // First sort by category order
      if (a.category.order !== b.category.order) {
        return a.category.order - b.category.order;
      }
      // Then sort by product order
      return a.order - b.order;
    });

    // Convert Decimal to Number for proper JSON serialization
    const productsWithNumbers = sortedProducts.map(product => ({
      ...product,
      priceBgn: Number(product.priceBgn),
      priceEur: Number(product.priceEur)
    }));

    return NextResponse.json({ products: productsWithNumbers }, { status: 200 });
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


