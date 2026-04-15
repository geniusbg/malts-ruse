import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDefaultBrandId } from '@/lib/brand';

function requireAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

/** List promotions (optionally filter upcoming/past via query) */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !requireAdmin((session.user as { role?: string }).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandId = await getDefaultBrandId();
    const list = await prisma.productPromotion.findMany({
      where: { brandId },
      orderBy: [{ order: 'asc' }, { startsAt: 'desc' }],
      include: {
        product: {
          select: { id: true, nameBg: true, nameEn: true, nameRo: true },
        },
      },
    });

    return NextResponse.json({
      promotions: list.map((p) => ({
        ...p,
        priceBgn: Number(p.priceBgn),
        priceEur: Number(p.priceEur),
      })),
    });
  } catch (e) {
    console.error('GET promotions', e);
    return NextResponse.json({ error: 'Failed to load promotions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || !requireAdmin(role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      productId,
      startsAt,
      endsAt,
      priceBgn,
      priceEur,
      label,
      order,
    } = body as {
      productId?: string;
      startsAt?: string;
      endsAt?: string;
      priceBgn?: number;
      priceEur?: number;
      label?: string | null;
      order?: number;
    };

    if (!productId || !startsAt || !endsAt || priceBgn == null || priceEur == null) {
      return NextResponse.json({ error: 'Липсват задължителни полета' }, { status: 400 });
    }

    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (!(start < end)) {
      return NextResponse.json({ error: 'Крайът трябва да е след началото' }, { status: 400 });
    }

    const brandId = await getDefaultBrandId();
    const product = await prisma.product.findFirst({
      where: { id: productId, category: { brandId } },
    });
    if (!product) {
      return NextResponse.json({ error: 'Продуктът не е намерен' }, { status: 404 });
    }

    const created = await prisma.productPromotion.create({
      data: {
        brandId,
        productId,
        order: typeof order === 'number' ? order : 0,
        startsAt: start,
        endsAt: end,
        priceBgn,
        priceEur,
        label: label?.trim() || null,
      },
      include: {
        product: { select: { nameBg: true, nameEn: true, nameRo: true } },
      },
    });

    return NextResponse.json({
      promotion: {
        ...created,
        priceBgn: Number(created.priceBgn),
        priceEur: Number(created.priceEur),
      },
    });
  } catch (e) {
    console.error('POST promotions', e);
    return NextResponse.json({ error: 'Неуспешно създаване' }, { status: 500 });
  }
}
