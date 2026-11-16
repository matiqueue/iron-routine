import crypto from 'crypto';
import {
  CloudAuthProvider,
  CloudUserRecord,
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

      // 1. Start a Clerk OAuth handoff attempt for mobile Google / Apple iCloud sign-in
      if (action === 'create_attempt') {
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const deviceIdentityId = String(body?.deviceIdentityId || '').trim();
        const displayName = String(body?.displayName || '').trim();
        const attemptId = `att_${crypto.randomBytes(14).toString('hex')}`;
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

      // 2. Poll an active Clerk OAuth attempt from the mobile app
      if (action === 'poll_attempt') {
        const attemptId = String(body?.attemptId || '').trim();
        if (!attemptId) {
          return jsonResponse({ ok: false, error: 'Brak identyfikatora sesji OAuth.' }, 400);
        }
        const attempt = await getOAuthAttempt(attemptId);
        if (!attempt) {
          return jsonResponse({ ok: false, status: 'expired' }, 404);
        }
        if (attempt.status !== 'completed') {
          return jsonResponse({ ok: true, status: 'pending' });
        }
        return jsonResponse({
          ok: true,
          status: 'completed',
          isNewAccount: Boolean(attempt.isNewAccount),
          token: attempt.token,
          user: attempt.user,
        });
      }

      // 3. Mint a Clerk Sign-In Token (ticket) for Apple iCloud identity via Clerk Backend API
      if (action === 'mint_clerk_ticket') {
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const rawDeviceId = String(body?.deviceIdentityId || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, '')
          .slice(0, 32);
        const rawEmailInput = String(body?.email || '').trim().toLowerCase();
        const rawEmail =
          rawEmailInput && rawEmailInput.includes('@')
            ? rawEmailInput
            : rawDeviceId
            ? `icloud.${rawDeviceId}@icloud.ironroutine.app`
            : '';

        const displayName =
          String(body?.displayName || '').trim() ||
          (rawEmailInput ? rawEmailInput.split('@')[0] : '') ||
          (provider === 'apple' ? 'Apple iCloud' : 'Konto Google');

        if (!rawEmail) {
          return jsonResponse(
            { ok: false, error: 'Nie udało się zweryfikować identyfikatora Apple iCloud.' },
            400
          );
        }

        const userId = deriveUserId(rawEmail);
        const clerkSynced = await syncClerkAccount({
          externalId: rawDeviceId ? `apple_${rawDeviceId}` : `${provider}_${userId}`,
          email: rawEmail,
          displayName,
          provider,
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
                expires_in_seconds: 600,
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

      // 4. Complete Clerk OAuth handoff (called by /mobile-auth after Clerk sign-in)
      if (action === 'complete_clerk_attempt' || action === 'clerk_direct') {
        const attemptId = String(body?.attemptId || '').trim();
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const clerkUserId = String(body?.clerkUserId || '').trim();
        let rawEmail = String(body?.email || '').trim().toLowerCase();
        let displayName = String(body?.displayName || '').trim();
        const incomingAvatarUrl =
          typeof body?.avatarUrl === 'string' && body.avatarUrl.trim()
            ? body.avatarUrl.trim()
            : null;

        if (!clerkUserId && !rawEmail) {
          return jsonResponse(
            { ok: false, error: 'Brak danych konta z Clerk OAuth.' },
            400
          );
        }

        const prelimId = deriveUserId(rawEmail || clerkUserId);
        const clerkSynced = await syncClerkAccount({
          clerkUserId,
          externalId: prelimId,
          email: rawEmail,
          displayName,
          provider,
          ironRoutineUserId: prelimId,
        });

        if (clerkSynced?.email) {
          rawEmail = clerkSynced.email.toLowerCase();
        }
        if (clerkSynced?.displayName) {
          displayName = clerkSynced.displayName;
        }
        const finalClerkId = clerkSynced?.clerkUserId || clerkUserId || null;
        const userId = deriveUserId(rawEmail || finalClerkId || prelimId);
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
              email: rawEmail || `${userId}@clerk.ironroutine.app`,
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

        if (attemptId) {
          await saveOAuthAttempt(attemptId, {
            attemptId,
            status: 'completed',
            isNewAccount: !hasBackup,
            token,
            user: userPayload,
            completedAt: nowIso,
          });
        }

        return jsonResponse({
          ok: true,
          isNewAccount: !hasBackup,
          token,
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
        { ok: false, error: 'Błąd połączenia z Clerk / bazą PostgreSQL.' },
        500
      );
    }
  },
};
