import crypto from 'crypto';
import {
  CloudAuthProvider,
  CloudUserRecord,
  deriveUserId,
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

      // 1. Start a Clerk OAuth handoff attempt for mobile Google / Apple sign-in
      if (action === 'create_attempt') {
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const attemptId = `att_${crypto.randomBytes(14).toString('hex')}`;
        const nowIso = new Date().toISOString();

        await saveOAuthAttempt(attemptId, {
          attemptId,
          provider,
          status: 'pending',
          createdAt: nowIso,
        });

        const baseUrl = 'https://iron-routine-app.vercel.app';
        return jsonResponse({
          ok: true,
          attemptId,
          provider,
          authUrl: `${baseUrl}/mobile-auth?attemptId=${encodeURIComponent(
            attemptId
          )}&provider=${encodeURIComponent(provider)}`,
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

      // 3. Complete Clerk OAuth handoff (called by /mobile-auth after Clerk sign-in)
      if (action === 'complete_clerk_attempt' || action === 'clerk_direct') {
        const attemptId = String(body?.attemptId || '').trim();
        const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
        const clerkUserId = String(body?.clerkUserId || '').trim();
        let rawEmail = String(body?.email || '').trim().toLowerCase();
        let displayName = String(body?.displayName || '').trim();

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
        const existing = await getCloudUser(userId);
        const nowIso = new Date().toISOString();

        const userRecord: CloudUserRecord = existing
          ? {
              ...existing,
              clerkUserId: finalClerkId || existing.clerkUserId,
              provider,
              email: rawEmail || existing.email,
              displayName:
                displayName || existing.displayName || rawEmail.split('@')[0] || 'Użytkownik',
              updatedAt: nowIso,
            }
          : {
              userId,
              clerkUserId: finalClerkId,
              email: rawEmail || `${userId}@clerk.ironroutine.app`,
              provider,
              displayName: displayName || rawEmail.split('@')[0] || 'Użytkownik',
              createdAt: nowIso,
              updatedAt: nowIso,
            };

        await saveCloudUser(userRecord);

        const token = signCloudToken({
          userId: userRecord.userId,
          email: userRecord.email,
          provider: userRecord.provider,
        });

        const userPayload = {
          userId: userRecord.userId,
          clerkUserId: userRecord.clerkUserId || null,
          email: userRecord.email,
          provider: userRecord.provider,
          displayName: userRecord.displayName,
          lastSyncedAt: userRecord.lastSyncedAt || null,
          backupSummary: userRecord.backupSummary || null,
        };

        if (attemptId) {
          await saveOAuthAttempt(attemptId, {
            attemptId,
            status: 'completed',
            isNewAccount: !existing,
            token,
            user: userPayload,
            completedAt: nowIso,
          });
        }

        return jsonResponse({
          ok: true,
          isNewAccount: !existing,
          token,
          user: userPayload,
          deepLink: `ironroutine://auth?attemptId=${encodeURIComponent(attemptId)}`,
        });
      }

      // 4. Instant 1-Tap OAuth / iCloud / Google Identity Provisioning via Clerk Backend API
      const provider: CloudAuthProvider = body?.provider === 'apple' ? 'apple' : 'google';
      const oauthSubject = String(
        body?.oauthSubject || body?.deviceIdentityId || body?.email || ''
      )
        .trim()
        .toLowerCase();

      if (!oauthSubject) {
        return jsonResponse(
          { ok: false, error: 'Nie udało się odczytać identyfikatora konta OAuth.' },
          400
        );
      }

      const cleanSlug = oauthSubject
        .replace(/[^a-z0-9._-]/g, '')
        .slice(0, 32);
      const email = oauthSubject.includes('@')
        ? oauthSubject
        : `${provider}.${cleanSlug}@${provider === 'apple' ? 'icloud' : 'google'}.ironroutine.app`;
      const displayName =
        String(body?.displayName || '').trim() ||
        (provider === 'apple' ? 'Konto Apple iCloud' : 'Konto Google');

      const userId = deriveUserId(email);
      const clerkInfo = await syncClerkAccount({
        externalId: `${provider}_${cleanSlug}`,
        email,
        displayName,
        provider,
        ironRoutineUserId: userId,
      });

      const existing = await getCloudUser(userId);
      const nowIso = new Date().toISOString();

      const userRecord: CloudUserRecord = existing
        ? {
            ...existing,
            clerkUserId: clerkInfo?.clerkUserId || existing.clerkUserId || null,
            provider,
            displayName: displayName || existing.displayName,
            updatedAt: nowIso,
          }
        : {
            userId,
            clerkUserId: clerkInfo?.clerkUserId || null,
            email,
            provider,
            displayName,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

      await saveCloudUser(userRecord);

      const token = signCloudToken({
        userId: userRecord.userId,
        email: userRecord.email,
        provider: userRecord.provider,
      });

      return jsonResponse({
        ok: true,
        isNewAccount: !existing,
        token,
        user: {
          userId: userRecord.userId,
          clerkUserId: userRecord.clerkUserId || null,
          email: userRecord.email,
          provider: userRecord.provider,
          displayName: userRecord.displayName,
          lastSyncedAt: userRecord.lastSyncedAt || null,
          backupSummary: userRecord.backupSummary || null,
        },
      });
    } catch (error) {
      console.error('Cloud auth error:', error);
      return jsonResponse(
        { ok: false, error: 'Błąd połączenia z Clerk / bazą danych NoSQL na Vercel.' },
        500
      );
    }
  },
};
