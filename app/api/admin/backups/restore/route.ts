import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';
import { randomUUID } from 'crypto';
import { executeRestoreJob } from '@/lib/backup-restore';

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const artifactId = String(body?.artifactId || '').trim();
  const inPlace = body?.inPlace === true;
  const targetDatabaseUrl = body?.targetDatabaseUrl != null ? String(body.targetDatabaseUrl || '').trim() : '';
  const confirmation = String(body?.confirmation || '').trim();

  if (!artifactId) {
    return NextResponse.json({ error: 'artifactId is required' }, { status: 400 });
  }

  const artifact = await (prisma as any).backupArtifact.findUnique({
    where: { id: artifactId },
    include: { destination: true },
  });
  if (!artifact || !artifact.filePath) {
    return NextResponse.json({ error: 'Backup artifact not found' }, { status: 404 });
  }

  if (inPlace) {
    if (confirmation !== 'RESTORE_IN_PLACE') {
      return NextResponse.json({ error: 'Confirmation token is invalid (expected RESTORE_IN_PLACE)' }, { status: 400 });
    }
    if (String(process.env.BACKUP_ALLOW_INPLACE_RESTORE || 'false') !== 'true') {
      return NextResponse.json(
        { error: 'In-place restore is disabled (set BACKUP_ALLOW_INPLACE_RESTORE=true to allow)' },
        { status: 400 },
      );
    }
  } else if (!targetDatabaseUrl) {
    return NextResponse.json({ error: 'targetDatabaseUrl is required for restore to a new database' }, { status: 400 });
  }

  const jobId = randomUUID();
  await (prisma as any).backupJob.create({
    data: {
      id: jobId,
      triggerType: inPlace ? 'RESTORE_IN_PLACE' : 'RESTORE_NEW_DB',
      status: 'PENDING',
      requestedByUserId: String((auth.session.user as any)?.id || ''),
      targetDatabaseUrl: inPlace ? null : targetDatabaseUrl,
      metadata: {
        artifactId: artifact.id,
        sourcePath: artifact.filePath,
      },
    },
  });

  try {
    await executeRestoreJob(prisma, jobId, artifact, inPlace, inPlace ? null : targetDatabaseUrl);
    return NextResponse.json({ message: 'Restore job finished', jobId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, jobId }, { status: 500 });
  }
}
