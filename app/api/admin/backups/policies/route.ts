import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const rows = await (prisma as any).backupPolicy.findMany({
    orderBy: [{ enabled: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ policies: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const intervalMinutes = Number(body?.intervalMinutes || 0);
  const retentionDays = Number(body?.retentionDays ?? 30);
  const destinationIds = Array.isArray(body?.destinationIds) ? body.destinationIds.map((x: any) => String(x)) : [];
  const enabled = body?.enabled !== false;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5) {
    return NextResponse.json({ error: 'intervalMinutes must be >= 5' }, { status: 400 });
  }
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    return NextResponse.json({ error: 'retentionDays must be >= 1' }, { status: 400 });
  }
  if (destinationIds.length === 0) {
    return NextResponse.json({ error: 'destinationIds is required' }, { status: 400 });
  }

  const destCount = await (prisma as any).backupDestination.count({
    where: { id: { in: destinationIds } },
  });
  if (destCount !== destinationIds.length) {
    return NextResponse.json({ error: 'One or more destinations do not exist' }, { status: 400 });
  }

  const created = await (prisma as any).backupPolicy.create({
    data: {
      name,
      intervalMinutes,
      retentionDays,
      destinationIds,
      enabled,
      createdByUserId: String((auth.session.user as any)?.id || ''),
    },
  });

  return NextResponse.json({ policy: created }, { status: 201 });
}

