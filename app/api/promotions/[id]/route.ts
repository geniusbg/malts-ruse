import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDefaultBrandId } from '@/lib/brand';

function requireAdmin(role: string | undefined) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !requireAdmin((session.user as { role?: string }).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const brandId = await getDefaultBrandId();
    const existing = await prisma.productPromotion.findFirst({
      where: { id, brandId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await request.json() as {
      order?: number;
      startsAt?: string;
      endsAt?: string;
      priceBgn?: number;
      priceEur?: number;
      label?: string | null;
    };

    const start = body.startsAt != null ? new Date(body.startsAt) : existing.startsAt;
    const end = body.endsAt != null ? new Date(body.endsAt) : existing.endsAt;
    if (!(start < end)) {
      return NextResponse.json({ error: 'Крайът трябва да е след началото' }, { status: 400 });
    }

    const updated = await prisma.productPromotion.update({
      where: { id },
      data: {
        ...(typeof body.order === 'number' ? { order: body.order } : {}),
        ...(body.startsAt != null ? { startsAt: start } : {}),
        ...(body.endsAt != null ? { endsAt: end } : {}),
        ...(typeof body.priceBgn === 'number' ? { priceBgn: body.priceBgn } : {}),
        ...(typeof body.priceEur === 'number' ? { priceEur: body.priceEur } : {}),
        ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
      },
    });

    return NextResponse.json({
      promotion: {
        ...updated,
        priceBgn: Number(updated.priceBgn),
        priceEur: Number(updated.priceEur),
      },
    });
  } catch (e) {
    console.error('PATCH promotion', e);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !requireAdmin((session.user as { role?: string }).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const brandId = await getDefaultBrandId();
    const existing = await prisma.productPromotion.findFirst({
      where: { id, brandId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.productPromotion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE promotion', e);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
