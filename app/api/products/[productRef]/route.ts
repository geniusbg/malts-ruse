import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { findProductIdByRef } from '@/lib/product-resolve';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ productRef: string }> }
) {
  try {
    const data = await request.json();
    const { productRef } = await params;
    const id = await findProductIdByRef(productRef);
    if (!id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
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
        allergens: data.allergens || [],
      },
    });

    return NextResponse.json({ product }, { status: 200 });
  } catch (error) {
    console.error('Update product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ productRef: string }> }
) {
  try {
    const { productRef } = await params;
    const id = await findProductIdByRef(productRef);
    if (!id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderCount > 0) {
      await prisma.product.update({
        where: { id },
        data: {
          isHidden: true,
          isAvailable: false,
        },
      });

      return NextResponse.json({
        success: true,
        deleted: false,
        orderCount,
        message: `Продуктът е скрит успешно. Има ${orderCount} поръчки с този продукт - историята е запазена.`,
      }, { status: 200 });
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
      message: 'Продуктът е изтрит перманентно (нямаше поръчки с него).',
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('Delete product error:', error);
    return NextResponse.json({ error: 'Грешка при изтриване' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productRef: string }> }
) {
  try {
    const { productRef } = await params;
    const id = await findProductIdByRef(productRef);
    if (!id) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product }, { status: 200 });
  } catch (error) {
    console.error('Get product error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
