import { google } from 'googleapis';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { decrypt, encrypt, isEncrypted } from '@/lib/encryption';

type BackupDb = {
  backupSettings: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
  backupDestination: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    update: (args: unknown) => Promise<unknown>;
  };
};

function asBackupDb(prisma: PrismaClient): BackupDb {
  return prisma as unknown as BackupDb;
}

/** Decrypt if encrypted; otherwise return trimmed plain text (legacy rows). */
export function readMaybeEncrypted(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  if (isEncrypted(t)) {
    try {
      return decrypt(t);
    } catch {
      return t;
    }
  }
  return t;
}

async function getSettingsRow(prisma: PrismaClient) {
  return asBackupDb(prisma).backupSettings.findUnique({ where: { id: 'default' } });
}

export async function getGoogleDriveOauthConfigForAdmin(prisma: PrismaClient) {
  const row = await getSettingsRow(prisma);
  const envId = String(process.env.BACKUP_GOOGLE_DRIVE_CLIENT_ID || '').trim();
  const envSecret = String(process.env.BACKUP_GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  const envRedirect = String(process.env.BACKUP_GOOGLE_DRIVE_REDIRECT_URI || '').trim();

  const clientId = String(row?.googleDriveClientId || '').trim() || envId;
  const dbSecret = String(row?.googleDriveClientSecret || '').trim();
  const redirectUri = String(row?.googleDriveRedirectUri || '').trim() || envRedirect;

  return {
    clientId,
    clientSecretConfigured: Boolean(dbSecret || envSecret),
    redirectUri,
    source: {
      clientId: String(row?.googleDriveClientId || '').trim() ? 'db' : 'env',
      clientSecret: dbSecret ? 'db' : 'env',
      redirectUri: String(row?.googleDriveRedirectUri || '').trim() ? 'db' : 'env',
    },
  };
}

export async function getResolvedGoogleDriveOauthConfig(prisma: PrismaClient) {
  const row = await getSettingsRow(prisma);
  const clientId =
    String(row?.googleDriveClientId || '').trim() || String(process.env.BACKUP_GOOGLE_DRIVE_CLIENT_ID || '').trim();

  const dbSecretRaw = String(row?.googleDriveClientSecret || '').trim();
  const envSecret = String(process.env.BACKUP_GOOGLE_DRIVE_CLIENT_SECRET || '').trim();
  const clientSecretFromDb = dbSecretRaw ? readMaybeEncrypted(dbSecretRaw) : '';
  const clientSecret = clientSecretFromDb || envSecret;

  const redirectUri =
    String(row?.googleDriveRedirectUri || '').trim() ||
    String(process.env.BACKUP_GOOGLE_DRIVE_REDIRECT_URI || '').trim();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google Drive OAuth is not configured (admin Backup settings or BACKUP_GOOGLE_DRIVE_* env vars)',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export async function updateGoogleDriveOauthConfig(
  prisma: PrismaClient,
  dto: { clientId?: string; clientSecret?: string; redirectUri?: string },
) {
  const existing = (await getSettingsRow(prisma)) || {};
  let storedSecret = String(existing.googleDriveClientSecret || '');
  if (dto.clientSecret !== undefined) {
    const plain = String(dto.clientSecret || '').trim();
    storedSecret = plain ? encrypt(plain) : '';
  }

  const next = {
    googleDriveClientId:
      dto.clientId !== undefined ? String(dto.clientId || '').trim() : String(existing.googleDriveClientId || ''),
    googleDriveClientSecret: dto.clientSecret !== undefined ? storedSecret : String(existing.googleDriveClientSecret || ''),
    googleDriveRedirectUri:
      dto.redirectUri !== undefined
        ? String(dto.redirectUri || '').trim()
        : String(existing.googleDriveRedirectUri || ''),
  };

  await asBackupDb(prisma).backupSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      googleDriveClientId: next.googleDriveClientId || null,
      googleDriveClientSecret: next.googleDriveClientSecret || null,
      googleDriveRedirectUri: next.googleDriveRedirectUri || null,
    },
    update: {
      ...(dto.clientId !== undefined ? { googleDriveClientId: next.googleDriveClientId || null } : {}),
      ...(dto.clientSecret !== undefined ? { googleDriveClientSecret: next.googleDriveClientSecret || null } : {}),
      ...(dto.redirectUri !== undefined ? { googleDriveRedirectUri: next.googleDriveRedirectUri || null } : {}),
    },
  });

  return getGoogleDriveOauthConfigForAdmin(prisma);
}

async function clearGoogleDriveOauthState(
  prisma: PrismaClient,
  destinationId: string,
  extra: Record<string, unknown> = {},
) {
  const dest = await asBackupDb(prisma).backupDestination.findUnique({
    where: { id: destinationId },
    select: { config: true },
  });
  const config = { ...((dest?.config as Record<string, unknown>) || {}) };
  delete config.oauthStateNonce;
  delete config.oauthStateExpiresAt;
  delete config.oauthRequestedByUserId;
  await asBackupDb(prisma).backupDestination.update({
    where: { id: destinationId },
    data: { config: { ...config, ...extra } },
  });
}

export async function completeGoogleDriveOauthCallback(
  prisma: PrismaClient,
  query: { code?: string; state?: string; error?: string; error_description?: string },
) {
  const stateRaw = String(query.state || '').trim();
  if (!stateRaw || !stateRaw.includes(':')) {
    throw new Error('Invalid OAuth state');
  }
  const [destinationId, nonce] = stateRaw.split(':');
  if (!destinationId || !nonce) {
    throw new Error('Invalid OAuth state');
  }

  const destination = await asBackupDb(prisma).backupDestination.findUnique({ where: { id: destinationId } });
  if (!destination || String(destination.type) !== 'GOOGLE_DRIVE') {
    throw new Error('Invalid Google Drive destination');
  }

  const config = { ...((destination.config as Record<string, unknown>) || {}) };
  if (String(config.oauthStateNonce || '') !== nonce) {
    throw new Error('OAuth state mismatch');
  }
  const expiresAtRaw = String(config.oauthStateExpiresAt || '').trim();
  if (!expiresAtRaw || new Date(expiresAtRaw).getTime() < Date.now()) {
    throw new Error('OAuth state expired');
  }

  if (query.error) {
    await clearGoogleDriveOauthState(prisma, destinationId, {
      oauthLastError: String(query.error_description || query.error).slice(0, 500),
    });
    return { ok: false as const, message: String(query.error_description || query.error) };
  }

  const code = String(query.code || '').trim();
  if (!code) {
    throw new Error('Missing OAuth code');
  }

  const oauth = await getResolvedGoogleDriveOauthConfig(prisma);
  const authClient = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
  const tokenResponse = await authClient.getToken(code);
  const tokens = tokenResponse.tokens || {};
  const refreshToken = String(tokens.refresh_token || '').trim();
  const accessToken = String(tokens.access_token || '').trim();
  const expiryDate = typeof tokens.expiry_date === 'number' ? tokens.expiry_date : undefined;

  const existingRefreshRaw = String(config.oauthRefreshToken || '').trim();
  const existingRefreshPlain = existingRefreshRaw ? readMaybeEncrypted(existingRefreshRaw) : '';
  const effectiveRefreshToken = refreshToken || existingRefreshPlain;
  if (!effectiveRefreshToken) {
    throw new Error(
      'Google did not return refresh_token. Re-connect with consent and remove the previous app grant if needed.',
    );
  }

  let connectedEmail = String(config.oauthEmail || '').trim();
  try {
    authClient.setCredentials({
      access_token: accessToken || undefined,
      refresh_token: effectiveRefreshToken,
      expiry_date: expiryDate,
    });
    const oauth2 = google.oauth2({ auth: authClient, version: 'v2' });
    const me = await oauth2.userinfo.get();
    connectedEmail = String(me.data?.email || connectedEmail || '').trim();
  } catch {
    // ignore profile errors
  }

  const nextConfig: Record<string, unknown> = {
    ...config,
    authMode: 'OAUTH',
    oauthRefreshToken: encrypt(effectiveRefreshToken),
    ...(accessToken ? { oauthAccessToken: encrypt(accessToken) } : {}),
    ...(expiryDate ? { oauthTokenExpiryAt: new Date(expiryDate).toISOString() } : {}),
    ...(connectedEmail ? { oauthEmail: connectedEmail } : {}),
    oauthConnectedAt: new Date().toISOString(),
    oauthLastError: null,
  };
  delete nextConfig.oauthStateNonce;
  delete nextConfig.oauthStateExpiresAt;
  delete nextConfig.oauthRequestedByUserId;

  await asBackupDb(prisma).backupDestination.update({
    where: { id: destinationId },
    data: { config: nextConfig },
  });

  return { ok: true as const, message: 'Google Drive connected successfully' };
}

export function parseGdriveArtifactUri(filePath: string): { folderId: string; fileId: string } | null {
  const s = String(filePath || '').trim();
  const m = /^gdrive:\/\/([^/]+)\/([^/]+)$/.exec(s);
  if (!m) return null;
  return { folderId: m[1], fileId: m[2] };
}

export async function downloadGoogleDriveArtifactToTemp(
  prisma: PrismaClient,
  destination: Record<string, unknown>,
  filePathUri: string,
): Promise<string> {
  const parsed = parseGdriveArtifactUri(filePathUri);
  if (!parsed) {
    throw new Error('Invalid Google Drive artifact URI (expected gdrive://folderId/fileId)');
  }
  const { fileId } = parsed;
  const config = { ...((destination.config as Record<string, unknown>) || {}) };
  const tmpDir = process.env.BACKUP_TEMP_DIR || join(tmpdir(), 'malts-backups');
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = join(tmpDir, `restore-${randomUUID()}.dump`);

  const refreshRaw = String(config.oauthRefreshToken || '').trim();
  if (refreshRaw) {
    const oauth = await getResolvedGoogleDriveOauthConfig(prisma);
    const refresh = readMaybeEncrypted(refreshRaw);
    const accessToken = readMaybeEncrypted(String(config.oauthAccessToken || ''));
    const authClient = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
    const expiryMs = config.oauthTokenExpiryAt ? new Date(String(config.oauthTokenExpiryAt)).getTime() : undefined;
    authClient.setCredentials({
      refresh_token: refresh,
      access_token: accessToken || undefined,
      expiry_date: Number.isFinite(expiryMs) ? expiryMs : undefined,
    });
    const drive = google.drive({ version: 'v3', auth: authClient });
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    );
    const ws = createWriteStream(tmpPath);
    await pipeline(res.data as NodeJS.ReadableStream, ws);
    return tmpPath;
  }

  const serviceAccountJsonRaw = config.serviceAccountJson;
  if (!serviceAccountJsonRaw) {
    throw new Error('GOOGLE_DRIVE destination has no OAuth tokens or service account JSON');
  }

  let credentials: Record<string, unknown>;
  if (typeof serviceAccountJsonRaw === 'string') {
    try {
      credentials = JSON.parse(serviceAccountJsonRaw) as Record<string, unknown>;
    } catch {
      throw new Error('GOOGLE_DRIVE serviceAccountJson is not valid JSON');
    }
  } else {
    credentials = serviceAccountJsonRaw as Record<string, unknown>;
  }

  const clientEmail = String(credentials?.client_email || '').trim();
  const privateKeyRaw = String(credentials?.private_key || '');
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_DRIVE service account JSON is invalid');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' },
  );
  const ws = createWriteStream(tmpPath);
  await pipeline(res.data as NodeJS.ReadableStream, ws);
  return tmpPath;
}

export async function uploadMaltsBackupToGoogleDrive(
  prisma: PrismaClient,
  destination: Record<string, unknown>,
  sourceFilePath: string,
  jobId: string,
): Promise<string> {
  const config = { ...((destination.config as Record<string, unknown>) || {}) };
  const folderId = String(config.folderId || '').trim();
  if (!folderId) {
    throw new Error('GOOGLE_DRIVE destination requires folderId');
  }

  const refreshRaw = String(config.oauthRefreshToken || '').trim();
  if (refreshRaw) {
    return uploadWithOauth(prisma, destination, sourceFilePath, jobId, folderId, config);
  }

  const serviceAccountJsonRaw = config.serviceAccountJson;
  if (!serviceAccountJsonRaw) {
    throw new Error('GOOGLE_DRIVE is not connected (OAuth) and no serviceAccountJson was provided.');
  }

  let credentials: Record<string, unknown>;
  if (typeof serviceAccountJsonRaw === 'string') {
    try {
      credentials = JSON.parse(serviceAccountJsonRaw) as Record<string, unknown>;
    } catch {
      throw new Error('GOOGLE_DRIVE serviceAccountJson is not valid JSON');
    }
  } else {
    credentials = serviceAccountJsonRaw as Record<string, unknown>;
  }

  const clientEmail = String(credentials?.client_email || '').trim();
  const privateKeyRaw = String(credentials?.private_key || '');
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) {
    throw new Error('GOOGLE_DRIVE service account JSON is invalid (client_email/private_key missing)');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const fileName = `malts-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${jobId}.dump`;
  const createRes = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: createReadStream(sourceFilePath) },
    fields: 'id',
    supportsAllDrives: true,
  });

  const fileId = String(createRes.data?.id || '').trim();
  if (!fileId) {
    throw new Error('GOOGLE_DRIVE upload failed (missing file id)');
  }
  return `gdrive://${folderId}/${fileId}`;
}

async function uploadWithOauth(
  prisma: PrismaClient,
  destination: Record<string, unknown>,
  sourceFilePath: string,
  jobId: string,
  folderId: string,
  config: Record<string, unknown>,
) {
  const oauth = await getResolvedGoogleDriveOauthConfig(prisma);
  const refreshToken = readMaybeEncrypted(String(config.oauthRefreshToken || ''));
  const accessToken = readMaybeEncrypted(String(config.oauthAccessToken || ''));
  if (!refreshToken) {
    throw new Error('GOOGLE_DRIVE OAuth refresh token is missing');
  }

  const authClient = new google.auth.OAuth2(oauth.clientId, oauth.clientSecret, oauth.redirectUri);
  const expiryMs = config.oauthTokenExpiryAt ? new Date(String(config.oauthTokenExpiryAt)).getTime() : undefined;
  authClient.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken || undefined,
    expiry_date: Number.isFinite(expiryMs) ? expiryMs : undefined,
  });

  const drive = google.drive({ version: 'v3', auth: authClient });
  const fileName = `malts-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${jobId}.dump`;

  const createRes = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/octet-stream', body: createReadStream(sourceFilePath) },
    fields: 'id',
    supportsAllDrives: true,
  });

  const updatedCreds = authClient.credentials || {};
  const nextConfig = {
    ...config,
    ...(updatedCreds.access_token ? { oauthAccessToken: encrypt(String(updatedCreds.access_token)) } : {}),
    ...(updatedCreds.expiry_date
      ? { oauthTokenExpiryAt: new Date(Number(updatedCreds.expiry_date)).toISOString() }
      : {}),
    oauthLastError: null,
  };

  await asBackupDb(prisma).backupDestination.update({
    where: { id: String(destination.id) },
    data: { config: nextConfig },
  });

  const fileId = String(createRes.data?.id || '').trim();
  if (!fileId) {
    throw new Error('GOOGLE_DRIVE upload failed (missing file id)');
  }
  return `gdrive://${folderId}/${fileId}`;
}
