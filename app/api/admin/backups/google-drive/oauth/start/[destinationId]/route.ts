import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '../../../../_auth';
import { getResolvedGoogleDriveOauthConfig } from '@/lib/backup-google';

/** Delivery-compatible: `POST admin/backups/google-drive/oauth/start/:destinationId` */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ destinationId: string }> }) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const { destinationId } = await params;
  if (!destinationId) {
    return NextResponse.json({ error: 'destinationId is required' }, { status: 400 });
  }

  const dest = await (prisma as any).backupDestination.findUnique({ where: { id: destinationId } });
  if (!dest || String(dest.type) !== 'GOOGLE_DRIVE') {
    return NextResponse.json({ error: 'Invalid GOOGLE_DRIVE destination' }, { status: 400 });
  }

  let oauth: { clientId: string; clientSecret: string; redirectUri: string };
  try {
    oauth = await getResolvedGoogleDriveOauthConfig(prisma);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const nonce = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const nextConfig = {
    ...(dest.config as object),
    authMode: 'OAUTH',
    oauthStateNonce: nonce,
    oauthStateExpiresAt: expiresAt.toISOString(),
    oauthRequestedByUserId: String((auth.session.user as any)?.id || ''),
  };

  await (prisma as any).backupDestination.update({
    where: { id: destinationId },
    data: { config: nextConfig },
  });

  const state = `${destinationId}:${nonce}`;
  const authClient = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
  const authUrl = authClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
    include_granted_scopes: true,
  });

  return NextResponse.json({ authUrl });
}
