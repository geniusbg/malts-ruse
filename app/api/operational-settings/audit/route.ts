import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth-options';
import { getDefaultBrandId } from '@/lib/brand';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string })?.role;
    if (!session?.user || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const brandId = await getDefaultBrandId();
    const rows = await prisma.operationalSettingsAuditLog.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      logs: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        actorEmail: r.actorEmail,
        action: r.action,
        before: r.before,
        after: r.after,
      })),
    });
  } catch (e) {
    console.error('GET operational-settings audit', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

