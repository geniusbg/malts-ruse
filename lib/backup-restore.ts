import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import type { PrismaClient } from '@prisma/client';
import { normalizePgToolConnection } from '@/lib/backup-execute';
import { downloadGoogleDriveArtifactToTemp } from '@/lib/backup-google';

async function execCommand(cmd: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(0, 2000)}`));
    });
  });
}

export async function runPgRestore(inputFile: string, dbUrl: string) {
  const normalized = normalizePgToolConnection(String(dbUrl || '').trim());
  await execCommand('pg_restore', [
    '--clean',
    '--if-exists',
    '--no-owner',
    `--dbname=${normalized.dbUrl}`,
    inputFile,
  ]);
}

async function resolveArtifactDumpPath(
  prisma: PrismaClient,
  artifact: { filePath?: string | null; destination?: Record<string, unknown> | null },
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const filePath = String(artifact.filePath || '').trim();
  const dest = artifact.destination;
  if (!filePath) throw new Error('Backup artifact has no file path');
  const type = String(dest?.type || '');

  if (type === 'LOCAL_PATH') {
    await fs.access(filePath);
    return {
      path: filePath,
      cleanup: async () => {},
    };
  }

  if (type === 'GOOGLE_DRIVE') {
    if (!dest) throw new Error('Destination missing for artifact');
    const tmp = await downloadGoogleDriveArtifactToTemp(prisma, dest, filePath);
    return {
      path: tmp,
      cleanup: async () => {
        await fs.unlink(tmp).catch(() => undefined);
      },
    };
  }

  throw new Error(`Restore is not implemented for destination type: ${type}`);
}

export async function executeRestoreJob(
  prisma: PrismaClient,
  jobId: string,
  artifact: { filePath?: string | null; destination?: Record<string, unknown> | null },
  inPlace: boolean,
  targetDatabaseUrl: string | null,
) {
  const p = prisma as any;

  await p.backupJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  try {
    const dbUrl = inPlace ? String(process.env.DATABASE_URL || '').trim() : String(targetDatabaseUrl || '').trim();
    if (!dbUrl) throw new Error('Database URL is missing');

    const { path, cleanup } = await resolveArtifactDumpPath(prisma, artifact);
    try {
      await runPgRestore(path, dbUrl);
    } finally {
      await cleanup();
    }

    await p.backupJob.update({
      where: { id: jobId },
      data: { status: 'SUCCESS', finishedAt: new Date(), error: null },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await p.backupJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', finishedAt: new Date(), error: msg.slice(0, 4000) },
    });
    throw e;
  }
}
