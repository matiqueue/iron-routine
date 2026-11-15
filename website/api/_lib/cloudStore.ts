import crypto from 'crypto';
import { del, get, put } from '@vercel/blob';

export type CloudAuthProvider = 'apple' | 'google';

export interface CloudUserRecord {
  userId: string;
  clerkUserId?: string | null;
  email: string;
  provider: CloudAuthProvider;
  displayName: string;
  pinSalt?: string;
  pinHash?: string;
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

export interface OAuthAttemptRecord {
  attemptId: string;
  provider?: CloudAuthProvider;
  status: 'pending' | 'completed';
  isNewAccount?: boolean;
  token?: string;
  user?: {
    userId: string;
    clerkUserId?: string | null;
    email: string;
    provider: CloudAuthProvider;
    displayName: string;
    lastSyncedAt?: string | null;
    backupSummary?: CloudUserRecord['backupSummary'] | null;
  };
  createdAt?: string;
  completedAt?: string;
}

const FALLBACK_SECRET = 'ir_cloud_secret_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';

function getSecret(): string {
  return (
    process.env.CLOUD_AUTH_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    FALLBACK_SECRET
  );
}

function getEncryptionKey(): Buffer {
  return crypto.createHash('sha256').update(`enc:${getSecret()}`).digest();
}

export function deriveUserId(identifier: string): string {
  const normalized = String(identifier || '').trim().toLowerCase();
  const hash = crypto
    .createHash('sha256')
    .update(`ir_user:${normalized}`)
    .digest('hex')
    .slice(0, 28);
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

export async function saveOAuthAttempt(
  attemptId: string,
  payload: OAuthAttemptRecord
): Promise<void> {
  await writePrivateDocument(`nosql/attempts/${attemptId}.json`, JSON.stringify(payload));
}

export async function getOAuthAttempt(attemptId: string): Promise<OAuthAttemptRecord | null> {
  const raw = await readPrivateDocument(`nosql/attempts/${attemptId}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OAuthAttemptRecord;
  } catch {
    return null;
  }
}

export async function deleteOAuthAttempt(attemptId: string): Promise<void> {
  try {
    await del([`nosql/attempts/${attemptId}.json`]);
  } catch {}
}

/**
 * Verifies or creates a user in Clerk Backend API so every Google / iCloud account
 * is registered in Clerk and assigned to the user's NoSQL record.
 */
export async function syncClerkAccount(params: {
  clerkUserId?: string;
  externalId?: string;
  email: string;
  displayName?: string;
  provider: CloudAuthProvider;
  ironRoutineUserId: string;
}): Promise<{ clerkUserId: string; email: string; displayName: string } | null> {
  const { clerkUserId, externalId, email, displayName, provider, ironRoutineUserId } = params;
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // 1. If a clerkUserId was provided by Clerk OAuth, verify it directly
    if (clerkUserId && clerkUserId.startsWith('user_')) {
      const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        headers,
      });
      if (res.ok) {
        const clerkUser: any = await res.json();
        await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}/metadata`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            public_metadata: {
              ironRoutineUserId,
              provider,
              app: 'iron-routine',
            },
          }),
        }).catch(() => {});
        const primaryEmail =
          clerkUser.email_addresses?.[0]?.email_address || email || '';
        const fullName =
          [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') ||
          displayName ||
          primaryEmail.split('@')[0] ||
          'Użytkownik';
        return {
          clerkUserId: clerkUser.id,
          email: primaryEmail,
          displayName: fullName,
        };
      }
    }

    // 2. Look up by external_id or email_address in Clerk
    const queryParam = externalId
      ? `external_id=${encodeURIComponent(externalId)}`
      : `email_address=${encodeURIComponent(email)}`;
    const listRes = await fetch(`https://api.clerk.com/v1/users?${queryParam}&limit=1`, {
      headers,
    });
    if (listRes.ok) {
      const list: any = await listRes.json();
      if (Array.isArray(list) && list.length > 0) {
        const existingClerk = list[0];
        await fetch(`https://api.clerk.com/v1/users/${existingClerk.id}/metadata`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            public_metadata: {
              ironRoutineUserId,
              provider,
              app: 'iron-routine',
            },
          }),
        }).catch(() => {});
        return {
          clerkUserId: existingClerk.id,
          email:
            existingClerk.email_addresses?.[0]?.email_address || email,
          displayName:
            [existingClerk.first_name, existingClerk.last_name]
              .filter(Boolean)
              .join(' ') ||
            displayName ||
            'Użytkownik',
        };
      }
    }

    // 3. Create user in Clerk Backend API so they appear in Clerk Dashboard with their provider
    const createBody = {
      external_id: externalId || ironRoutineUserId,
      first_name: displayName || (provider === 'apple' ? 'Apple iCloud' : 'Google User'),
      email_address: [email],
      skip_password_requirement: true,
      skip_password_checks: true,
      public_metadata: {
        ironRoutineUserId,
        provider,
        app: 'iron-routine',
      },
    };
    const createRes = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers,
      body: JSON.stringify(createBody),
    });
    if (createRes.ok) {
      const createdClerk: any = await createRes.json();
      return {
        clerkUserId: createdClerk.id,
        email: createdClerk.email_addresses?.[0]?.email_address || email,
        displayName:
          [createdClerk.first_name, createdClerk.last_name].filter(Boolean).join(' ') ||
          displayName ||
          'Użytkownik',
      };
    }
  } catch (err) {
    console.error('Clerk sync warning:', err);
  }
  return null;
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
