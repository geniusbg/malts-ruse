import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import type { PrismaClient } from '@prisma/client';
import { uploadMaltsBackupToGoogleDrive } from './backup-google';

export function normalizePgToolConnection(rawDbUrl: string): { dbUrl: string; schema?: string } {
  const dbUrl = String(rawDbUrl || '').trim();
  if (!dbUrl) throw new Error('DATABASE_URL is not configured');
  if (dbUrl.startsWith('prisma://')) throw new Error('DATABASE_URL uses prisma:// and cannot be used by pg_dump');
  if (!/^postgres(ql)?:\/\//i.test(dbUrl)) return { dbUrl };

  const parsed = new URL(dbUrl);
  const schema = parsed.searchParams.get('schema')?.trim() || undefined;
  ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer'].forEach((k) => parsed.searchParams.delete(k));
  return { dbUrl: parsed.toString(), schema };
}

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

async function publishToLocalPath(destination: Record<string, unknown>, sourceFilePath: string, jobId: string) {
  const basePath = String((destination.config as Record<string, unknown>)?.basePath || '').trim();
  if (!basePath) throw new Error('LOCAL_PATH destination requires config.basePath');
  await fs.mkdir(basePath, { recursive: true });
  const targetName = `theme-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${jobId}.dump`;
  const targetPath = join(basePath, targetName);
  await fs.copyFile(sourceFilePath, targetPath);
  return targetPath;
}

async function publishToDestination(
  prisma: PrismaClient,
  destination: Record<string, unknown>,
  sourceFilePath: string,
  jobId: string,
): Promise<string> {
  const type = String(destination.type || '');
  if (type === 'LOCAL_PATH') {
    return publishToLocalPath(destination, sourceFilePath, jobId);
  }
  if (type === 'GOOGLE_DRIVE') {
    return uploadMaltsBackupToGoogleDrive(prisma, destination, sourceFilePath, jobId);
  }
  throw new Error(`Destination type ${type} is not supported yet.`);
}

async function runPgDump(outputFilePath: string) {
  const normalized = normalizePgToolConnection(String(process.env.DATABASE_URL || ''));
  const args = ['--format=custom', `--file=${outputFilePath}`, `--dbname=${normalized.dbUrl}`];
  if (normalized.schema) args.push(`--schema=${normalized.schema}`);
  await execCommand('pg_dump', args);
}

async function cleanupRetention(prisma: PrismaClient, policy: Record<string, unknown>) {
  const retentionDays = Number(policy.retentionDays || 0);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const p = prisma as any;
  const jobs = await p.backupJob.findMany({
    where: {
      policyId: String(policy.id),
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  const jobIds = jobs.map((x: { id: string }) => x.id);
  if (jobIds.length === 0) return;

  const artifacts = await p.backupArtifact.findMany({
    where: { jobId: { in: jobIds } },
    include: { destination: true },
  });

  for (const artifact of artifacts) {
    if (artifact.filePath && String(artifact.destination?.type || '') === 'LOCAL_PATH') {
      await fs.unlink(String(artifact.filePath)).catch(() => undefined);
    }
  }

  await p.backupJob.deleteMany({ where: { id: { in: jobIds } } });
}

export async function executeBackupJob(
  prisma: PrismaClient,
  jobId: string,
  destinations: Record<string, unknown>[],
  policy: Record<string, unknown> | null,
) {
  const p = prisma as any;

  await p.backupJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const tempDir = process.env.BACKUP_TEMP_DIR || join(tmpdir(), 'theme-backups');
  let tempFilePath = '';
  try {
    await fs.mkdir(tempDir, { recursive: true });
    tempFilePath = join(tempDir, `backup-${jobId}.dump`);
    await runPgDump(tempFilePath);

    const fileBuffer = await fs.readFile(tempFilePath);
    const checksum = createHash('sha256').update(fileBuffer).digest('hex');
    const stats = await fs.stat(tempFilePath);

    for (const destination of destinations) {
      const artifactId = randomUUID();
      await p.backupArtifact.create({
        data: { id: artifactId, jobId, destinationId: String(destination.id), status: 'RUNNING' },
      });
      try {
        const storedPath = await publishToDestination(prisma, destination, tempFilePath, jobId);
        await p.backupArtifact.update({
          where: { id: artifactId },
          data: {
            status: 'SUCCESS',
            filePath: storedPath,
            checksumSha256: checksum,
            fileSizeBytes: BigInt(stats.size),
          },
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        await p.backupArtifact.update({
          where: { id: artifactId },
          data: { status: 'FAILED', error: msg.slice(0, 2000) },
        });
      }
    }

    const failedCount = await p.backupArtifact.count({
      where: { jobId, status: 'FAILED' },
    });

    await p.backupJob.update({
      where: { id: jobId },
      data: {
        status: failedCount > 0 ? 'FAILED' : 'SUCCESS',
        finishedAt: new Date(),
        error: failedCount > 0 ? `${failedCount} destinations failed` : null,
      },
    });

    if (policy) {
      await cleanupRetention(prisma, policy);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await p.backupJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', finishedAt: new Date(), error: msg.slice(0, 4000) },
    });
    throw e;
  } finally {
    if (tempFilePath) {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }
}
