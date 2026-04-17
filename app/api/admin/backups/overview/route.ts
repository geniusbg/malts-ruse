import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';

/** Same shape as Delivery `getOverview`: active destination count, enabled policies, latest job rows. */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const p = prisma as any;
  const [destinations, policies, latestJobs] = await Promise.all([
    p.backupDestination.count({ where: { active: true } }),
    p.backupPolicy.count({ where: { enabled: true } }),
    p.backupJob.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        triggerType: true,
        status: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ destinations, policies, latestJobs });
}
