import crypto from 'crypto';
import { ensureSchema, getSql } from './db.js';

export type CloudAuthProvider = 'apple' | 'google';

export interface CloudUserRecord {
  userId: string;
  clerkUserId?: string | null;
  email: string;
  provider: CloudAuthProvider;
  displayName: string;
  nickname?: string;
  nicknameUpdatedAt?: string;
  e2eePublicKey?: string;
  e2eeKeyUpdatedAt?: string;
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
    nickname?: string | null;
    nicknameUpdatedAt?: string | null;
    e2eePublicKey?: string | null;
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
    process.env.DATABASE_URL ||
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

export function encryptJsonPayload(rawJson: string): Record<string, unknown> {
  const iv = crypto.randomBytes(12);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(rawJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decryptJsonPayload(stored: any): string {
  const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!parsed || parsed.v !== 1 || !parsed.iv || !parsed.tag || !parsed.data) {
    return typeof stored === 'string' ? stored : JSON.stringify(stored);
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

function mapUserRow(row: any): CloudUserRecord | null {
  if (!row) return null;
  return {
    userId: String(row.user_id),
    clerkUserId: row.clerk_user_id || null,
    email: String(row.email),
    provider: row.provider === 'apple' ? 'apple' : 'google',
    displayName: String(row.display_name),
    nickname: row.nickname || undefined,
    nicknameUpdatedAt: row.nickname_updated_at
      ? new Date(row.nickname_updated_at).toISOString()
      : undefined,
    e2eePublicKey: row.e2ee_public_key || undefined,
    e2eeKeyUpdatedAt: row.e2ee_key_updated_at
      ? new Date(row.e2ee_key_updated_at).toISOString()
      : undefined,
    backupSummary: row.backup_summary || undefined,
    lastSyncedAt: row.last_synced_at
      ? new Date(row.last_synced_at).toISOString()
      : undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function getCloudUser(userId: string): Promise<CloudUserRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows: any[] = await sql`
    SELECT * FROM users WHERE user_id = ${userId} LIMIT 1
  `;
  return mapUserRow(rows[0]);
}

export async function saveCloudUser(user: CloudUserRecord): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO users (
      user_id,
      clerk_user_id,
      email,
      provider,
      display_name,
      nickname,
      nickname_updated_at,
      e2ee_public_key,
      e2ee_key_updated_at,
      backup_summary,
      last_synced_at,
      created_at,
      updated_at
    ) VALUES (
      ${user.userId},
      ${user.clerkUserId || null},
      ${user.email},
      ${user.provider},
      ${user.displayName},
      ${user.nickname || null},
      ${user.nicknameUpdatedAt || null},
      ${user.e2eePublicKey || null},
      ${user.e2eeKeyUpdatedAt || null},
      ${user.backupSummary ? JSON.stringify(user.backupSummary) : null}::jsonb,
      ${user.lastSyncedAt || null},
      ${user.createdAt || new Date().toISOString()},
      ${user.updatedAt || new Date().toISOString()}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      clerk_user_id = COALESCE(EXCLUDED.clerk_user_id, users.clerk_user_id),
      email = EXCLUDED.email,
      provider = EXCLUDED.provider,
      display_name = EXCLUDED.display_name,
      nickname = COALESCE(EXCLUDED.nickname, users.nickname),
      nickname_updated_at = COALESCE(EXCLUDED.nickname_updated_at, users.nickname_updated_at),
      e2ee_public_key = COALESCE(EXCLUDED.e2ee_public_key, users.e2ee_public_key),
      e2ee_key_updated_at = COALESCE(EXCLUDED.e2ee_key_updated_at, users.e2ee_key_updated_at),
      backup_summary = COALESCE(EXCLUDED.backup_summary, users.backup_summary),
      last_synced_at = COALESCE(EXCLUDED.last_synced_at, users.last_synced_at),
      updated_at = NOW()
  `;
}

export async function getCloudBackupJson(userId: string): Promise<string | null> {
  await ensureSchema();
  const sql = getSql();
  const rows: any[] = await sql`
    SELECT encrypted_blob FROM cloud_backups WHERE user_id = ${userId} LIMIT 1
  `;
  if (!rows[0]?.encrypted_blob) return null;
  try {
    return decryptJsonPayload(rows[0].encrypted_blob);
  } catch {
    return null;
  }
}

export async function saveCloudBackupJson(userId: string, backupJson: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const encrypted = encryptJsonPayload(backupJson);
  await sql`
    INSERT INTO cloud_backups (user_id, encrypted_blob, updated_at)
    VALUES (${userId}, ${JSON.stringify(encrypted)}::jsonb, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      encrypted_blob = EXCLUDED.encrypted_blob,
      updated_at = NOW()
  `;
}

export async function deleteCloudUserAndBackup(userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM users WHERE user_id = ${userId}`;
}

export async function saveOAuthAttempt(
  attemptId: string,
  payload: OAuthAttemptRecord
): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO oauth_attempts (
      attempt_id, provider, status, is_new_account, token, user_payload, created_at, completed_at
    ) VALUES (
      ${attemptId},
      ${payload.provider || 'google'},
      ${payload.status},
      ${Boolean(payload.isNewAccount)},
      ${payload.token || null},
      ${payload.user ? JSON.stringify(payload.user) : null}::jsonb,
      ${payload.createdAt || new Date().toISOString()},
      ${payload.completedAt || null}
    )
    ON CONFLICT (attempt_id) DO UPDATE SET
      status = EXCLUDED.status,
      is_new_account = EXCLUDED.is_new_account,
      token = EXCLUDED.token,
      user_payload = EXCLUDED.user_payload,
      completed_at = EXCLUDED.completed_at
  `;
}

export async function getOAuthAttempt(attemptId: string): Promise<OAuthAttemptRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows: any[] = await sql`
    SELECT * FROM oauth_attempts WHERE attempt_id = ${attemptId} LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    attemptId: String(row.attempt_id),
    provider: row.provider === 'apple' ? 'apple' : 'google',
    status: row.status === 'completed' ? 'completed' : 'pending',
    isNewAccount: Boolean(row.is_new_account),
    token: row.token || undefined,
    user: row.user_payload || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
  };
}

export async function deleteOAuthAttempt(attemptId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM oauth_attempts WHERE attempt_id = ${attemptId}`;
}

/**
 * Verifies or creates a user in Clerk Backend API so every Google / iCloud account
 * is registered in Clerk and linked to their PostgreSQL record.
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
    if (clerkUserId && clerkUserId.startsWith('user_')) {
      const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, { headers });
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
        const primaryEmail = clerkUser.email_addresses?.[0]?.email_address || email || '';
        const fullName =
          [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') ||
          displayName ||
          primaryEmail.split('@')[0] ||
          'Athlete';
        return { clerkUserId: clerkUser.id, email: primaryEmail, displayName: fullName };
      }
    }

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
          email: existingClerk.email_addresses?.[0]?.email_address || email,
          displayName:
            [existingClerk.first_name, existingClerk.last_name]
              .filter(Boolean)
              .join(' ') ||
            displayName ||
            'Athlete',
        };
      }
    }

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
          'Athlete',
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
