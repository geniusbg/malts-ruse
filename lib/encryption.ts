import * as crypto from 'crypto';

/**
 * AES-256-GCM — same format as Delivery `encryption.util.ts`.
 * Uses BACKUP_ENCRYPTION_KEY, then SMTP_ENCRYPTION_KEY, then dev fallback.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

function getEncryptionKey(): string {
  const key =
    String(process.env.BACKUP_ENCRYPTION_KEY || '').trim() ||
    String(process.env.SMTP_ENCRYPTION_KEY || '').trim();

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'BACKUP_ENCRYPTION_KEY (or SMTP_ENCRYPTION_KEY) is required in production. Generate: openssl rand -hex 32',
      );
    }
    console.warn(
      '⚠️ BACKUP_ENCRYPTION_KEY not set — using dev-only default. Set BACKUP_ENCRYPTION_KEY for production.',
    );
    return 'dev-encryption-key-not-for-production-change-me-32chars!!';
  }

  if (key.length < 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be at least 32 characters (use openssl rand -hex 32)');
  }

  return key;
}

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encrypt(value: string): string {
  if (!value) return value;

  const encryptionKey = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(encryptionKey, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(value, 'utf8', 'binary');
  encrypted += cipher.final('binary');
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, salt, Buffer.from(encrypted, 'binary'), tag]);
  return combined.toString('base64');
}

export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;

  const encryptionKey = getEncryptionKey();
  const combined = Buffer.from(encryptedValue, 'base64');
  const iv = combined.slice(0, IV_LENGTH);
  const salt = combined.slice(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
  const tagStart = combined.length - TAG_LENGTH;
  const encrypted = combined.slice(IV_LENGTH + SALT_LENGTH, tagStart);
  const tag = combined.slice(tagStart);
  const key = deriveKey(encryptionKey, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const MIN_ENCRYPTED_LENGTH = IV_LENGTH + SALT_LENGTH + TAG_LENGTH + 1;
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return value.length > MIN_ENCRYPTED_LENGTH && base64Regex.test(value);
}
