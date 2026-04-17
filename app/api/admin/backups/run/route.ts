import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';
import { randomUUID } from 'crypto';
import { executeBackupJob } from '@/lib/backup-execute';

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const note = String(body?.note || '').slice(0, 500) || null;

  const activeDestinations = await (prisma as any).backupDestination.findMany({
    where: { active: true },
    orderBy: { createdAt: 'desc' },
  });
  if (activeDestinations.length === 0) {
    return NextResponse.json({ error: 'No active destinations configured' }, { status: 400 });
  }

  const jobId = randomUUID();
  await (prisma as any).backupJob.create({
    data: {
      id: jobId,
      triggerType: 'MANUAL',
      status: 'PENDING',
      requestedByUserId: String((auth.session.user as any)?.id || ''),
      note,
    },
  });

  try {
    await executeBackupJob(prisma, jobId, activeDestinations, null);
    return NextResponse.json({ message: 'Backup job finished', jobId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
