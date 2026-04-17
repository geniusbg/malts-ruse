import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultBrandId } from '@/lib/brand';

/** Публично четене за клиентския UI (меню/поръчка) — без сесия. */
export async function GET() {
  try {
    const brandId = await getDefaultBrandId();
    const ops = await prisma.operationalSettings.findUnique({ where: { brandId } });
    return NextResponse.json({
      ordersEnabled: ops?.ordersEnabled ?? true,
      waiterCallEnabled: ops?.waiterCallEnabled ?? true,
    });
  } catch (e) {
    console.error('GET operational-settings/public', e);
    return NextResponse.json({ ordersEnabled: true, waiterCallEnabled: true });
  }
}
