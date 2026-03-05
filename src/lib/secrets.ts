import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.APP_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error('APP_ENCRYPTION_KEY is required for database-backed AI secrets');
  }

  return createHash('sha256').update(rawKey).digest();
}

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.APP_ENCRYPTION_KEY);
}

export function encryptSecret(secret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
}

export function decryptSecret(payload: string): string {
  const key = getEncryptionKey();
  const buffer = Buffer.from(payload, 'base64url');

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function getSecretHint(secret: string | null | undefined): string | null {
  if (!secret) return null;
  const trimmed = secret.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return '*'.repeat(trimmed.length);
  return `...${trimmed.slice(-4)}`;
}
