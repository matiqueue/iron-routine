import crypto from 'crypto';
import { del, get, put } from '@vercel/blob';

export type CloudAuthProvider = 'apple' | 'google';

export interface CloudUserRecord {
  userId: string;
  email: string;
  provider: CloudAuthProvider;
  displayName: string;
  pinSalt: string;
  pinHash: string;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
  backupSummary?: {
    profileName: string;
    plansCount: number;
    prsCount: number;
    historyCount: number;
  };
}

export interface SignedTokenPayload {
  userId: string;
  email: string;
  provider: CloudAuthProvider;
  iat: number;
  exp: number;
}

const FALLBACK_SECRET = 'ir_cloud_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

function getSecret(): string {
  return process.env.CLOUD_AUTH_SECRET || process.env.BLOB_READ_WRITE_TOKEN || FALLBACK_SECRET;
}

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(`enc:${getSecret()}`).digest();
}

export function deriveUserId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(`ir_user:${normalized}`).digest('hex').slice(0, 28);
  return `usr_${hash}`;
}

export function hashPin(pin: string, salt: string): string {
  return crypto.scryptSync(pin.trim(), salt, 32).toString('hex');
}

export function verifyPin(pin: string, salt: string, expectedHash: string): boolean {
  const computed = Buffer.from(hashPin(pin, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (computed.length !== expected.length) return false;
  return crypto.timingSafeEqual(computed, expected);
}

export function signCloudToken(payload: Omit<SignedTokenPayload, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SignedTokenPayload = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 24 * 90,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');
  return `ir_tok_${encoded}.${sig}`;
}

export function verifyCloudToken(rawToken?: string | null): SignedTokenPayload | null {
  if (!rawToken || !rawToken.startsWith('ir_tok_')) return null;
  const body = rawToken.slice('ir_tok_'.length);
  const parts = body.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed: SignedTokenPayload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.userId || !parsed.email || parsed.exp < now) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function encryptJsonPayload(rawJson: string): string {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  });
}

export function decryptJsonPayload(storedText: string): string {
  const parsed = JSON.parse(storedText);
  if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) {
    return storedText;
  }
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(parsed.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

async function readPrivateDocument(pathname: string): Promise<string | null> {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    const response = new Response(result.stream);
    return await response.text();
  } catch {
    return null;
  }
}

async function writePrivateDocument(pathname: string, content: string): Promise<void> {
  await put(pathname, content, {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function getCloudUser(userId: string): Promise<CloudUserRecord | null> {
  const raw = await readPrivateDocument(`nosql/users/${userId}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CloudUserRecord;
  } catch {
    return null;
  }
}

export async function saveCloudUser(user: CloudUserRecord): Promise<void> {
  await writePrivateDocument(`nosql/users/${user.userId}.json`, JSON.stringify(user));
}

export async function getCloudBackupJson(userId: string): Promise<string | null> {
  const raw = await readPrivateDocument(`nosql/backups/${userId}.json`);
  if (!raw) return null;
  try {
    return decryptJsonPayload(raw);
  } catch {
    return null;
  }
}

export async function saveCloudBackupJson(userId: string, backupJson: string): Promise<void> {
  const encrypted = encryptJsonPayload(backupJson);
  await writePrivateDocument(`nosql/backups/${userId}.json`, encrypted);
}

export async function deleteCloudUserAndBackup(userId: string): Promise<void> {
  try {
    await del([`nosql/users/${userId}.json`, `nosql/backups/${userId}.json`]);
  } catch {}
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
