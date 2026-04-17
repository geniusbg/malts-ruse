import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../../_auth';
import { sanitizeDestinationOutput } from '@/lib/backup-destinations';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await (prisma as any).backupDestination.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const next = await (prisma as any).backupDestination.update({
    where: { id },
    data: {
      ...(body?.name !== undefined ? { name: String(body.name || '').trim() } : {}),
      ...(body?.type !== undefined ? { type: String(body.type || '').trim() } : {}),
      ...(body?.config !== undefined ? { config: body.config ?? {} } : {}),
      ...(body?.active !== undefined ? { active: Boolean(body.active) } : {}),
    },
  });

  return NextResponse.json({ destination: sanitizeDestinationOutput(next as Record<string, unknown>) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  // Prevent deletion if referenced by any policy
  const policies = await (prisma as any).backupPolicy.findMany({
    select: { id: true, destinationIds: true },
  });
  const inUse = policies.some((p: any) => Array.isArray(p.destinationIds) && p.destinationIds.includes(id));
  if (inUse) {
    return NextResponse.json({ error: 'Destination is used in one or more policies' }, { status: 400 });
  }

  await (prisma as any).backupDestination.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

