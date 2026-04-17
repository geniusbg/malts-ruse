import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../../../_auth';
import { getGoogleDriveOauthConfigForAdmin, updateGoogleDriveOauthConfig } from '@/lib/backup-google';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const cfg = await getGoogleDriveOauthConfigForAdmin(prisma);
  return NextResponse.json(cfg);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const updated = await updateGoogleDriveOauthConfig(prisma, {
    clientId: body.clientId,
    clientSecret: body.clientSecret,
    redirectUri: body.redirectUri,
  });
  return NextResponse.json(updated);
}
