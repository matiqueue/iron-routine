import {
  deleteCloudUserAndBackup,
  extractBearerToken,
  getCloudBackupJson,
  getCloudUser,
  parseJsonBody,
  saveCloudBackupJson,
  saveCloudUser,
  sendJson,
  verifyCloudToken,
} from '../_lib/cloudStore.js';

export default async function handler(req, res) {
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    return sendJson(res, { ok: true }, 200);
  }

  const token = extractBearerToken(req);
  const verified = verifyCloudToken(token);
  if (!verified) {
    return sendJson(res, { ok: false, error: 'Brak autoryzacji lub sesja wygasła.' }, 401);
  }

  if (method === 'GET') {
    try {
      const [user, backupRaw] = await Promise.all([
        getCloudUser(verified.userId),
        getCloudBackupJson(verified.userId),
      ]);

      if (!backupRaw) {
        return sendJson(
          res,
          {
            ok: false,
            error: 'Brak zapisanej kopii profilu w chmurze dla tego konta.',
            hasBackup: false,
          },
          404
        );
      }

      const parsedBackup = JSON.parse(backupRaw);
      return sendJson(res, {
        ok: true,
        hasBackup: true,
        syncedAt: user?.lastSyncedAt || parsedBackup?.exportedAt || new Date().toISOString(),
        backup: parsedBackup,
      });
    } catch (error) {
      console.error('Cloud sync GET error:', error);
      return sendJson(
        res,
        { ok: false, error: 'Nie udało się pobrać danych z chmury NoSQL.' },
        500
      );
    }
  }

  if (method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const backup = body?.backup || body;

      if (
        !backup ||
        backup.app !== 'iron-routine' ||
        !backup.profile ||
        !Array.isArray(backup.plans)
      ) {
        return sendJson(
          res,
          { ok: false, error: 'Nieprawidłowy format pakietu danych Iron Routine.' },
          400
        );
      }

      const rawBackupJson = JSON.stringify(backup);
      if (rawBackupJson.length > 4_500_000) {
        return sendJson(
          res,
          { ok: false, error: 'Rozmiar kopii przekracza dopuszczalny limit 4.5 MB.' },
          413
        );
      }

      const nowIso = new Date().toISOString();
      await saveCloudBackupJson(verified.userId, rawBackupJson);

      const user = await getCloudUser(verified.userId);
      const prsCount = Object.values(backup.prRecords || {}).reduce(
        (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
        0
      );

      const summary = {
        profileName: String(backup.profile?.name || 'Profil'),
        plansCount: Array.isArray(backup.plans) ? backup.plans.length : 0,
        prsCount,
        historyCount: Array.isArray(backup.history) ? backup.history.length : 0,
      };

      if (user) {
        user.lastSyncedAt = nowIso;
        user.updatedAt = nowIso;
        user.backupSummary = summary;
        await saveCloudUser(user);
      }

      return sendJson(res, {
        ok: true,
        syncedAt: nowIso,
        summary,
      });
    } catch (error) {
      console.error('Cloud sync POST error:', error);
      return sendJson(
        res,
        { ok: false, error: 'Nie udało się zapisać danych w chmurze NoSQL.' },
        500
      );
    }
  }

  if (method === 'DELETE') {
    try {
      await deleteCloudUserAndBackup(verified.userId);
      return sendJson(res, { ok: true });
    } catch (error) {
      console.error('Cloud sync DELETE error:', error);
      return sendJson(
        res,
        { ok: false, error: 'Nie udało się usunąć danych z chmury.' },
        500
      );
    }
  }

  return sendJson(res, { ok: false, error: 'Method Not Allowed' }, 405);
}
