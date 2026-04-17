import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../../_auth';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await (prisma as any).backupPolicy.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const destinationIds = body?.destinationIds;
  if (destinationIds !== undefined) {
    const ids = Array.isArray(destinationIds) ? destinationIds.map((x: any) => String(x)) : [];
    const destCount = await (prisma as any).backupDestination.count({ where: { id: { in: ids } } });
    if (destCount !== ids.length) {
      return NextResponse.json({ error: 'One or more destinations do not exist' }, { status: 400 });
    }
  }

  if (body?.intervalMinutes !== undefined) {
    const im = Number(body.intervalMinutes || 0);
    if (!Number.isFinite(im) || im < 5) {
      return NextResponse.json({ error: 'intervalMinutes must be >= 5' }, { status: 400 });
    }
  }

  const next = await (prisma as any).backupPolicy.update({
    where: { id },
    data: {
      ...(body?.name !== undefined ? { name: String(body.name || '').trim() } : {}),
      ...(body?.intervalMinutes !== undefined ? { intervalMinutes: Number(body.intervalMinutes || 0) } : {}),
      ...(body?.retentionDays !== undefined ? { retentionDays: Number(body.retentionDays || 0) } : {}),
      ...(body?.destinationIds !== undefined
        ? { destinationIds: Array.isArray(body.destinationIds) ? body.destinationIds.map((x: any) => String(x)) : [] }
        : {}),
      ...(body?.enabled !== undefined ? { enabled: Boolean(body.enabled) } : {}),
    },
  });

  return NextResponse.json({ policy: next });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  await (prisma as any).backupPolicy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

