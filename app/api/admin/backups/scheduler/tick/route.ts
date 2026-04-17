import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../../_auth';
import { executeBackupJob } from '@/lib/backup-execute';

let schedulerLocked = false;

async function authorize(request: NextRequest) {
  const secret = String(process.env.BACKUP_CRON_SECRET || '').trim();
  const header = request.headers.get('x-backup-cron-secret') || '';
  if (secret && header === secret) return { ok: true as const, via: 'cron' as const };
  const auth = await requireSuperAdmin();
  if (auth.ok) return { ok: true as const, via: 'session' as const };
  return { ok: false as const, response: auth.response };
}

export async function POST(request: NextRequest) {
  const gate = await authorize(request);
  if (!gate.ok) return gate.response;

  if (schedulerLocked) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'locked' });
  }
  schedulerLocked = true;

  try {
    const now = new Date();
    const policies = await (prisma as any).backupPolicy.findMany({
      where: { enabled: true },
    });

    const started: string[] = [];

    for (const policy of policies) {
      const interval = Number(policy.intervalMinutes || 0);
      if (!Number.isFinite(interval) || interval < 5) continue;

      const lastRunAt = policy.lastRunAt ? new Date(policy.lastRunAt) : null;
      if (lastRunAt) {
        const diffMs = now.getTime() - lastRunAt.getTime();
        if (diffMs < interval * 60 * 1000) continue;
      }

      const destinationIds = Array.isArray(policy.destinationIds)
        ? policy.destinationIds.map((x: unknown) => String(x))
        : [];
      if (destinationIds.length === 0) continue;

      const destinations = await (prisma as any).backupDestination.findMany({
        where: { id: { in: destinationIds }, active: true },
      });
      if (destinations.length === 0) continue;

      await (prisma as any).backupPolicy.update({
        where: { id: policy.id },
        data: { lastRunAt: now },
      });

      const jobId = randomUUID();
      await (prisma as any).backupJob.create({
        data: {
          id: jobId,
          triggerType: 'SCHEDULED',
          status: 'PENDING',
          policyId: policy.id,
          note: `Scheduled every ${interval} min`,
        },
      });

      await executeBackupJob(prisma, jobId, destinations, policy);
      started.push(jobId);
    }

    return NextResponse.json({ ok: true, jobsStarted: started.length, jobIds: started });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    schedulerLocked = false;
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
