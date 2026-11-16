import {
  deleteCloudUserAndBackup,
  getCloudBackupJson,
  getCloudUser,
  jsonResponse,
  saveCloudBackupJson,
  saveCloudUser,
  verifyCloudToken,
} from '../_lib/cloudStore.js';

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim();
  }
  return null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return jsonResponse({ ok: true }, 200);
    }

    const token = extractBearerToken(request);
    const verified = verifyCloudToken(token);
    if (!verified) {
      return jsonResponse({ ok: false, error: 'Brak autoryzacji lub sesja wygasła.' }, 401);
    }

    if (request.method === 'GET') {
      try {
        const [user, backupRaw] = await Promise.all([
          getCloudUser(verified.userId),
          getCloudBackupJson(verified.userId),
        ]);

        if (!backupRaw) {
          return jsonResponse(
            {
              ok: false,
              error: 'Brak zapisanej kopii profilu w chmurze dla tego konta.',
              hasBackup: false,
            },
            404
          );
        }

        const parsedBackup = JSON.parse(backupRaw);
        return jsonResponse({
          ok: true,
          hasBackup: true,
          syncedAt:
            user?.lastSyncedAt || parsedBackup?.exportedAt || new Date().toISOString(),
          backup: parsedBackup,
        });
      } catch (error) {
        console.error('Cloud sync GET error:', error);
        return jsonResponse(
          { ok: false, error: 'Nie udało się pobrać danych z chmury PostgreSQL.' },
          500
        );
      }
    }

    if (request.method === 'POST') {
      try {
        const body: any = await request.json();
        const backup = body?.backup || body;

        if (
          !backup ||
          backup.app !== 'iron-routine' ||
          !backup.profile ||
          !Array.isArray(backup.plans)
        ) {
          return jsonResponse(
            { ok: false, error: 'Nieprawidłowy format pakietu danych Iron Routine.' },
            400
          );
        }

        const rawBackupJson = JSON.stringify(backup);
        if (rawBackupJson.length > 4_500_000) {
          return jsonResponse(
            { ok: false, error: 'Rozmiar kopii przekracza dopuszczalny limit 4.5 MB.' },
            413
          );
        }

        const nowIso = new Date().toISOString();
        await saveCloudBackupJson(verified.userId, rawBackupJson);

        const user = await getCloudUser(verified.userId);
        const prsCount = Object.values(backup.prRecords || {}).reduce<number>(
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

        return jsonResponse({
          ok: true,
          syncedAt: nowIso,
          summary,
        });
      } catch (error) {
        console.error('Cloud sync POST error:', error);
        return jsonResponse(
          { ok: false, error: 'Nie udało się zapisać danych w bazie PostgreSQL.' },
          500
        );
      }
    }

    if (request.method === 'DELETE') {
      try {
        await deleteCloudUserAndBackup(verified.userId);
        return jsonResponse({ ok: true });
      } catch (error) {
        console.error('Cloud sync DELETE error:', error);
        return jsonResponse(
          { ok: false, error: 'Nie udało się usunąć danych z chmury.' },
          500
        );
      }
    }

    return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
  },
};
