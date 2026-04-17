import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../_auth';
import { sanitizeDestinationOutput } from '@/lib/backup-destinations';

type DestinationType = 'LOCAL_PATH' | 'GOOGLE_DRIVE' | 'S3' | 'SFTP' | 'FTP' | 'SMB';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const rows = await (prisma as any).backupDestination.findMany({
    orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({ destinations: rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || '').trim();
  const type = String(body?.type || '').trim() as DestinationType;
  const config = body?.config ?? {};
  const active = body?.active !== false;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 });

  // Minimal validation for v1
  if (type === 'LOCAL_PATH') {
    const basePath = String(config?.basePath || '').trim();
    if (!basePath) return NextResponse.json({ error: 'LOCAL_PATH requires config.basePath' }, { status: 400 });
  }
  if (type === 'GOOGLE_DRIVE') {
    const folderId = String(config?.folderId || '').trim();
    if (!folderId) return NextResponse.json({ error: 'GOOGLE_DRIVE requires config.folderId' }, { status: 400 });
  }

  const created = await (prisma as any).backupDestination.create({
    data: {
      name,
      type,
      config,
      active,
      createdByUserId: String((auth.session.user as any)?.id || ''),
    },
  });

  return NextResponse.json({ destination: sanitizeDestinationOutput(created as Record<string, unknown>) }, { status: 201 });
}

