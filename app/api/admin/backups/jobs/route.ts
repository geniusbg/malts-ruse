import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';
import { normalizeBackupJson } from '@/lib/backup-json';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

  const jobs = await (prisma as any).backupJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      artifacts: { include: { destination: true } },
      policy: true,
    },
  });

  return NextResponse.json(normalizeBackupJson({ jobs }));
}

