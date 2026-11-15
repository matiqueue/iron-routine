import crypto from 'node:crypto';
import {
  deriveUserId,
  getCloudUser,
  hashPin,
  parseJsonBody,
  saveCloudUser,
  sendJson,
  signCloudToken,
  verifyPin,
} from '../_lib/cloudStore.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    return sendJson(res, { ok: true }, 200);
  }
  if (method !== 'POST') {
    return sendJson(res, { ok: false, error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await parseJsonBody(req);
    const provider = body?.provider === 'apple' ? 'apple' : 'google';
    const rawEmail = String(body?.email || '').trim().toLowerCase();
    const secretPin = String(body?.secretPin || '').trim();
    const displayName =
      String(body?.displayName || '').trim() || rawEmail.split('@')[0] || 'Użytkownik';

    if (!rawEmail || !rawEmail.includes('@') || rawEmail.length < 5) {
      return sendJson(
        res,
        { ok: false, error: 'Podaj prawidłowy adres e-mail konta Apple ID lub Google.' },
        400
      );
    }

    if (!secretPin || secretPin.length < 4) {
      return sendJson(
        res,
        { ok: false, error: 'Klucz bezpieczeństwa / PIN chmury musi mieć minimum 4 znaki.' },
        400
      );
    }

    const userId = deriveUserId(rawEmail);
    const existing = await getCloudUser(userId);
    const nowIso = new Date().toISOString();

    if (!existing) {
      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = hashPin(secretPin, salt);
      const newUser = {
        userId,
        email: rawEmail,
        provider,
        displayName,
        pinSalt: salt,
        pinHash,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await saveCloudUser(newUser);
      const token = signCloudToken({
        userId,
        email: rawEmail,
        provider,
      });

      return sendJson(res, {
        ok: true,
        isNewAccount: true,
        token,
        user: {
          userId: newUser.userId,
          email: newUser.email,
          provider: newUser.provider,
          displayName: newUser.displayName,
          lastSyncedAt: null,
          backupSummary: null,
        },
      });
    }

    if (!verifyPin(secretPin, existing.pinSalt, existing.pinHash)) {
      return sendJson(
        res,
        {
          ok: false,
          error: 'Nieprawidłowy klucz bezpieczeństwa / PIN dla tego konta w chmurze.',
        },
        401
      );
    }

    existing.provider = provider;
    existing.updatedAt = nowIso;
    if (body?.displayName && String(body.displayName).trim()) {
      existing.displayName = String(body.displayName).trim();
    }
    await saveCloudUser(existing);

    const token = signCloudToken({
      userId: existing.userId,
      email: existing.email,
      provider: existing.provider,
    });

    return sendJson(res, {
      ok: true,
      isNewAccount: false,
      token,
      user: {
        userId: existing.userId,
        email: existing.email,
        provider: existing.provider,
        displayName: existing.displayName,
        lastSyncedAt: existing.lastSyncedAt || null,
        backupSummary: existing.backupSummary || null,
      },
    });
  } catch (error) {
    console.error('Cloud auth error:', error);
    return sendJson(
      res,
      { ok: false, error: 'Błąd połączenia z bazą danych NoSQL na Vercel.' },
      500
    );
  }
}
