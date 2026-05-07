import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getDefaultBrandId } from '@/lib/brand';

// GET all offering cards (public)
export async function GET() {
  try {
    const brandId = await getDefaultBrandId();
    const cards = await prisma.homepageOfferingCard.findMany({
      where: { brandId, isActive: true },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Get offering cards error:', error);
    return NextResponse.json({ error: 'Failed to get offering cards' }, { status: 500 });
  }
}

// POST create new card (admin only)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any)?.role;
    if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await request.json();
    const brandId = await getDefaultBrandId();
    const h = (data.highlights || {}) as {
      bg?: string[];
      en?: string[];
      ro?: string[];
      de?: string[];
    };
    const highlights = {
      bg: h.bg ?? [],
      en: h.en ?? [],
      ro: h.ro ?? h.de ?? [],
    };

    const card = await prisma.homepageOfferingCard.create({
      data: {
        brandId,
        order: data.order ?? 0,
        icon: data.icon || '🍸',
        titleBg: data.titleBg || '',
        titleEn: data.titleEn || '',
        titleRo: data.titleRo || '',
        descriptionBg: data.descriptionBg || '',
        descriptionEn: data.descriptionEn || '',
        descriptionRo: data.descriptionRo || '',
        badgeBg: data.badgeBg || '',
        badgeEn: data.badgeEn || '',
        badgeRo: data.badgeRo || '',
        highlights,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch (error) {
    console.error('Create offering card error:', error);
    return NextResponse.json({ error: 'Failed to create offering card' }, { status: 500 });
  }
}

