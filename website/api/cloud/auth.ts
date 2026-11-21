import crypto from 'crypto';
import {
  CloudAuthProvider,
  CloudUserRecord,
  deleteOAuthAttempt,
  deriveUserId,
  getCloudBackupJson,
  getCloudUser,
  getOAuthAttempt,
  jsonResponse,
  saveCloudUser,
  saveOAuthAttempt,
  signCloudToken,
  syncClerkAccount,
} from '../_lib/cloudStore.js';

const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const APPLE_BUNDLE_IDS = new Set(['com.matique.ironroutine']);

let cachedAppleJwks: { keys: any[]; fetchedAt: number } | null = null;

async function getAppleJwks(forceRefresh = false): Promise<any[]> {
  if (
    !forceRefresh &&
    cachedAppleJwks &&
    Date.now() - cachedAppleJwks.fetchedAt < 60 * 60 * 1000
  ) {
    return cachedAppleJwks.keys;
  }
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) {
    throw new Error('Failed to fetch Apple JWKS');
  }
  const data: any = await res.json();
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  cachedAppleJwks = { keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Cryptographically verifies a native Sign in with Apple `identityToken` JWT
 * against Apple's official JWKS (`https://appleid.apple.com/auth/keys`).
 */
async function verifyAppleIdentityToken(identityToken?: string | null): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
} | null> {
  if (!identityToken || typeof identityToken !== 'string') return null;
  const parts = identityToken.trim().split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  let header: any;
  let payload: any;
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string') {
    return null;
  }

  try {
    let keys = await getAppleJwks(false);
    let jwk = keys.find((k) => k?.kid === header.kid);
    if (!jwk) {
      keys = await getAppleJwks(true);
      jwk = keys.find((k) => k?.kid === header.kid);
    }
    if (!jwk) return null;

    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const signature = Buffer.from(sigB64, 'base64url');
    const isValidSig = crypto.verify('RSA-SHA256', signingInput, publicKey, signature);
    if (!isValidSig) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const iss = String(payload?.iss || '');
    const audList = Array.isArray(payload?.aud) ? payload.aud : [payload?.aud];
    const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
    const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';

    if (
      iss !== 'https://appleid.apple.com' ||
      !audList.some((a: unknown) => typeof a === 'string' && APPLE_BUNDLE_IDS.has(a)) ||
      exp < nowSec - 60 ||
      sub.length < 4
    ) {
      return null;
    }

    const email =
      typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const emailVerified =
      payload?.email_verified === true || payload?.email_verified === 'true';

    return { sub, email, emailVerified };
  } catch (err) {
    console.error('Apple identityToken verification error:', err);
    return null;
  }
}

function isAttemptFresh(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ts = new Date(createdAt).getTime();
  return !Number.isNaN(ts) && Date.now() - ts <= OAUTH_ATTEMPT_TTL_MS;
}

/**
 * Verifies a Clerk frontend session JWT via Clerk Backend API (`CLERK_SECRET_KEY`),
 * returning the cryptographically verified Clerk userId, email, displayName and avatarUrl.
 */
async function verifyClerkSessionJwt(jwt?: string | null): Promise<{
  clerkUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
} | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey || !jwt || typeof jwt !== 'string') return null;

  const parts = jwt.trim().split('.');
  if (parts.length !== 3) return null;

  let payload: any = null;
  try {
    payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const sub = typeof payload?.sub === 'string' ? payload.sub : '';
  const sid = typeof payload?.sid === 'string' ? payload.sid : '';
  const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
  const nowSec = Math.floor(Date.now() / 1000);
  if (!sub.startsWith('user_') || !sid.startsWith('sess_') || exp < nowSec - 30) {
    return null;
  }

  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const sessRes = await fetch(
      `https://api.clerk.com/v1/sessions/${encodeURIComponent(sid)}`,
      { headers }
    );
    if (!sessRes.ok) return null;
    const session: any = await sessRes.json();
    if (!session || session.user_id !== sub || session.status !== 'active') {
      return null;
    }

    const userRes = await fetch(
      `https://api.clerk.com/v1/users/${encodeURIComponent(sub)}`,
      { headers }
    );
    if (!userRes.ok) return null;
    const clerkUser: any = await userRes.json();

    const primaryEmailObj =
      (clerkUser.email_addresses || []).find(
        (e: any) => e.id === clerkUser.primary_email_address_id
      ) || clerkUser.email_addresses?.[0];
    const email = String(primaryEmailObj?.email_address || '').trim().toLowerCase();
    const displayName =
      [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ').trim() ||
      (email ? email.split('@')[0] : 'Athlete');

    return {
      clerkUserId: String(clerkUser.id),
      email,
      displayName,
      avatarUrl: clerkUser.image_url || null,
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true }, 200);
    }
    if (request.method !== 'POST') {
      return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
    }

    try {
      const body: any = await request.json();
      const action = String(body?.action || '').trim();

      // 0. Native Sign in with Apple (iOS Face ID / Touch ID via expo-apple-authentication)
      if (action === 'apple_native') {
        const identityToken = String(body?.identityToken || '').trim();
        const verified = await verifyAppleIdentityToken(identityToken);
        if (!verified) {
          return jsonResponse(
            { ok: false, error: 'Nie udało się zweryfikować tokenu Sign in with Apple.' },
            401
          );
        }

        const clientDisplayName = String(body?.displayName || '').trim().slice(0, 64);
        const appleSubUserId = deriveUserId(`apple_sub:${verified.sub}`);
        const emailUserId = verified.email ? deriveUserId(verified.email) : null;

        let existing = await getCloudUser(appleSubUserId);
        if (!existing && emailUserId) {
          existing = await getCloudUser(emailUserId);
        }

        const resolvedUserId = existing?.userId || appleSubUserId;
        const resolvedEmail =
          verified.email || existing?.email || `${verified.sub}@appleid.ironroutine.app`;
        const resolvedDisplayName =
          (clientDisplayName && clientDisplayName !== 'Apple iCloud'
            ? clientDisplayName
            : '') ||
          existing?.displayName ||
          (verified.email ? verified.email.split('@')[0] : '') ||
          'Apple Athlete';

        const [clerkSynced, existingBackupRaw] = await Promise.all([
          syncClerkAccount({
            clerkUserId: existing?.clerkUserId || undefined,
            externalId: `apple_${verified.sub}`,
            email: resolvedEmail,
            displayName: resolvedDisplayName,
            provider: 'apple',
            ironRoutineUserId: resolvedUserId,
          }),
          getCloudBackupJson(resolvedUserId),
        ]);

        const nowIso = new Date().toISOString();
        let backupSummary = existing?.backupSummary;
        if (!backupSummary && existingBackupRaw) {
          try {
            const parsedBackup = JSON.parse(existingBackupRaw);
            const prsCount = Object.values(parsedBackup.prRecords || {}).reduce<number>(
              (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
              0
            );
            backupSummary = {
              profileName: String(parsedBackup.profile?.name || 'Profil'),
              plansCount: Array.isArray(parsedBackup.plans) ? parsedBackup.plans.length : 0,
              prsCount,
              historyCount: Array.isArray(parsedBackup.history)
                ? parsedBackup.history.length
                : 0,
            };
          } catch {}
        }

        const userRecord: CloudUserRecord = existing
          ? {
              ...existing,
              clerkUserId: clerkSynced?.clerkUserId || existing.clerkUserId || null,
              provider: 'apple',
              email: resolvedEmail,
              displayName: resolvedDisplayName,
              backupSummary: backupSummary || existing.backupSummary,
              updatedAt: nowIso,
            }
          : {
              userId: resolvedUserId,
              clerkUserId: clerkSynced?.clerkUserId || null,
              email: resolvedEmail,
              provider: 'apple',
              displayName: resolvedDisplayName,
              avatarUrl: null,
              backupSummary,
              createdAt: nowIso,
              updatedAt: nowIso,
            };

        await saveCloudUser(userRecord);

        const token = signCloudToken({
          userId: userRecord.userId,
          email: userRecord.email,
          provider: 'apple',
        });

        const hasBackup = Boolean(existingBackupRaw || userRecord.backupSummary);

        return jsonResponse({
          ok: true,
          isNewAccount: !hasBackup,
          token,
          user: {
            userId: userRecord.userId,
            clerkUserId: userRecord.clerkUserId || null,
            email: userRecord.email,
            provider: userRecord.provider,
            displayName: userRecord.displayName,
            nickname: userRecord.nickname || null,
            nicknameUpdatedAt: userRecord.nicknameUpdatedAt || null,
            avatarUrl: userRecord.avatarUrl || null,
            e2eePublicKey: userRecord.e2eePublicKey || null,
            lastSyncedAt: userRecord.lastSyncedAt || null,
            backupSummary: userRecord.backupSummary || null,
          },
        });
      }

      // 1. Start a Clerk OAuth handoff attempt for mobile Google / Apple sign-in
      if (action === 'create_attempt') {
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const deviceIdentityId = String(body?.deviceIdentityId || '').trim().slice(0, 48);
        const displayName = String(body?.displayName || '').trim().slice(0, 64);
        const attemptId = `att_${crypto.randomBytes(16).toString('hex')}`;
        const nowIso = new Date().toISOString();

        await saveOAuthAttempt(attemptId, {
          attemptId,
          provider,
          status: 'pending',
          createdAt: nowIso,
        });

        const baseUrl = 'https://iron-routine-app.vercel.app';
        const params = new URLSearchParams({
          attemptId,
          provider,
        });
        if (deviceIdentityId) params.set('deviceId', deviceIdentityId);
        if (displayName) params.set('name', displayName);

        return jsonResponse({
          ok: true,
          attemptId,
          provider,
          authUrl: `${baseUrl}/mobile-auth?${params.toString()}`,
        });
      }

      // 2. Poll an active Clerk OAuth attempt from the mobile app (one-time consume + 10m TTL)
      if (action === 'poll_attempt') {
        const attemptId = String(body?.attemptId || '').trim();
        if (!attemptId) {
          return jsonResponse({ ok: false, error: 'Brak identyfikatora sesji OAuth.' }, 400);
        }
        const attempt = await getOAuthAttempt(attemptId);
        if (!attempt || !isAttemptFresh(attempt.createdAt)) {
          if (attempt) {
            await deleteOAuthAttempt(attemptId).catch(() => {});
          }
          return jsonResponse({ ok: false, status: 'expired' }, 404);
        }
        if (attempt.status !== 'completed') {
          return jsonResponse({ ok: true, status: 'pending' });
        }
        // Immediately consume and remove the handoff token from Postgres so it cannot be replayed
        await deleteOAuthAttempt(attemptId).catch(() => {});
        return jsonResponse({
          ok: true,
          status: 'completed',
          isNewAccount: Boolean(attempt.isNewAccount),
          token: attempt.token,
          user: attempt.user,
        });
      }

      // 3. Mint a Clerk Sign-In Token (ticket) ONLY for a fresh pending Apple fallback attempt
      // Strictly restricted to synthetic device-bound addresses — NEVER allows arbitrary user emails!
      if (action === 'mint_clerk_ticket') {
        const attemptId = String(body?.attemptId || '').trim();
        const attempt = attemptId ? await getOAuthAttempt(attemptId) : null;
        if (
          !attempt ||
          attempt.status !== 'pending' ||
          attempt.provider !== 'apple' ||
          !isAttemptFresh(attempt.createdAt)
        ) {
          return jsonResponse(
            { ok: false, error: 'Wygasła lub nieprawidłowa sesja logowania.' },
            401
          );
        }

        const rawDeviceId = String(body?.deviceIdentityId || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '')
          .slice(0, 32);

        if (rawDeviceId.length < 12) {
          return jsonResponse(
            { ok: false, error: 'Nieprawidłowy identyfikator urządzenia Apple.' },
            400
          );
        }

        const rawEmail = `icloud.${rawDeviceId}@icloud.ironroutine.app`;
        const displayName =
          String(body?.displayName || '').trim().slice(0, 64) || 'Apple iCloud';

        const userId = deriveUserId(rawEmail);
        const clerkSynced = await syncClerkAccount({
          externalId: `apple_${rawDeviceId}`,
          email: rawEmail,
          displayName,
          provider: 'apple',
          ironRoutineUserId: userId,
        });

        let ticket: string | null = null;
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (secretKey && clerkSynced?.clerkUserId) {
          try {
            const ticketRes = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                user_id: clerkSynced.clerkUserId,
                expires_in_seconds: 300,
              }),
            });
            if (ticketRes.ok) {
              const ticketData: any = await ticketRes.json();
              ticket = ticketData?.token || null;
            }
          } catch {}
        }

        return jsonResponse({
          ok: true,
          ticket,
          clerkUserId: clerkSynced?.clerkUserId || null,
          email: clerkSynced?.email || rawEmail,
          displayName: clerkSynced?.displayName || displayName,
        });
      }

      // 4. Complete Clerk OAuth handoff — requires a fresh pending attemptId AND verified Clerk session JWT
      if (action === 'complete_clerk_attempt') {
        const attemptId = String(body?.attemptId || '').trim();
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const clerkSessionToken = String(body?.clerkSessionToken || '').trim();

        const attempt = attemptId ? await getOAuthAttempt(attemptId) : null;
        if (!attempt || attempt.status !== 'pending' || !isAttemptFresh(attempt.createdAt)) {
          return jsonResponse(
            { ok: false, error: 'Sesja logowania wygasła. Spróbuj ponownie z aplikacji.' },
            401
          );
        }

        // Cryptographically verify the Clerk session via Clerk Backend API — never trust client-supplied email!
        const verifiedClerk = await verifyClerkSessionJwt(clerkSessionToken);
        if (!verifiedClerk || !verifiedClerk.email) {
          return jsonResponse(
            { ok: false, error: 'Nie udało się zweryfikować tokenu sesji Clerk.' },
            401
          );
        }

        const rawEmail = verifiedClerk.email.toLowerCase();
        const finalClerkId = verifiedClerk.clerkUserId;
        const displayName =
          verifiedClerk.displayName ||
          String(body?.displayName || '').trim().slice(0, 64) ||
          rawEmail.split('@')[0] ||
          'Użytkownik';
        const incomingAvatarUrl = verifiedClerk.avatarUrl || null;

        const userId = deriveUserId(rawEmail);
        await syncClerkAccount({
          clerkUserId: finalClerkId,
          externalId: userId,
          email: rawEmail,
          displayName,
          provider,
          ironRoutineUserId: userId,
        });

        const [existing, existingBackupRaw] = await Promise.all([
          getCloudUser(userId),
          getCloudBackupJson(userId),
        ]);
        const nowIso = new Date().toISOString();

        let backupSummary = existing?.backupSummary;
        if (!backupSummary && existingBackupRaw) {
          try {
            const parsedBackup = JSON.parse(existingBackupRaw);
            const prsCount = Object.values(parsedBackup.prRecords || {}).reduce<number>(
              (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
              0
            );
            backupSummary = {
              profileName: String(parsedBackup.profile?.name || 'Profil'),
              plansCount: Array.isArray(parsedBackup.plans) ? parsedBackup.plans.length : 0,
              prsCount,
              historyCount: Array.isArray(parsedBackup.history)
                ? parsedBackup.history.length
                : 0,
            };
          } catch {}
        }

        const userRecord: CloudUserRecord = existing
          ? {
              ...existing,
              clerkUserId: finalClerkId || existing.clerkUserId,
              provider,
              email: rawEmail || existing.email,
              displayName:
                displayName || existing.displayName || rawEmail.split('@')[0] || 'Użytkownik',
              avatarUrl: existing.avatarUrl || incomingAvatarUrl || null,
              backupSummary: backupSummary || existing.backupSummary,
              updatedAt: nowIso,
            }
          : {
              userId,
              clerkUserId: finalClerkId,
              email: rawEmail,
              provider,
              displayName: displayName || rawEmail.split('@')[0] || 'Użytkownik',
              avatarUrl: incomingAvatarUrl,
              backupSummary,
              createdAt: nowIso,
              updatedAt: nowIso,
            };

        await saveCloudUser(userRecord);

        const token = signCloudToken({
          userId: userRecord.userId,
          email: userRecord.email,
          provider: userRecord.provider,
        });

        const hasBackup = Boolean(existingBackupRaw || userRecord.backupSummary);

        const userPayload = {
          userId: userRecord.userId,
          clerkUserId: userRecord.clerkUserId || null,
          email: userRecord.email,
          provider: userRecord.provider,
          displayName: userRecord.displayName,
          nickname: userRecord.nickname || null,
          nicknameUpdatedAt: userRecord.nicknameUpdatedAt || null,
          avatarUrl: userRecord.avatarUrl || incomingAvatarUrl || null,
          e2eePublicKey: userRecord.e2eePublicKey || null,
          lastSyncedAt: userRecord.lastSyncedAt || null,
          backupSummary: userRecord.backupSummary || null,
        };

        await saveOAuthAttempt(attemptId, {
          attemptId,
          status: 'completed',
          isNewAccount: !hasBackup,
          token,
          user: userPayload,
          completedAt: nowIso,
        });

        return jsonResponse({
          ok: true,
          isNewAccount: !hasBackup,
          user: userPayload,
          deepLink: `ironroutine://auth?attemptId=${encodeURIComponent(attemptId)}`,
        });
      }

      return jsonResponse(
        { ok: false, error: 'Nieznana akcja autoryzacji Clerk.' },
        400
      );
    } catch (error) {
      console.error('Cloud auth error:', error);
      return jsonResponse(
        { ok: false, error: 'Błąd połączenia z serwerem autoryzacji.' },
        500
      );
    }
  },
};
