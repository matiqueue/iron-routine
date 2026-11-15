import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportProfileBackup,
  importProfileBackup,
  updateProfile,
} from './storage';
import { UserProfile } from '../types/workout';

const CLOUD_API_BASE = 'https://iron-routine-app.vercel.app/api/cloud';
const CLOUD_SESSION_KEY = '@iron_routine:cloud_session_v2';
const APPLE_ICLOUD_ID_KEY = '@iron_routine:apple_icloud_identity_v1';

export type CloudAuthProvider = 'apple' | 'google';

export interface CloudBackupSummary {
  profileName: string;
  plansCount: number;
  prsCount: number;
  historyCount: number;
}

export interface CloudSession {
  token: string;
  userId: string;
  clerkUserId?: string | null;
  email: string;
  provider: CloudAuthProvider;
  displayName: string;
  lastSyncedAt?: string | null;
  backupSummary?: CloudBackupSummary | null;
}

export async function getStoredCloudSession(): Promise<CloudSession | null> {
  try {
    const raw = await AsyncStorage.getItem(CLOUD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CloudSession;
    if (!parsed?.token || !parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredCloudSession(session: CloudSession): Promise<void> {
  try {
    await AsyncStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

export async function clearStoredCloudSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLOUD_SESSION_KEY);
  } catch {}
}

async function getOrCreateAppleICloudIdentity(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(APPLE_ICLOUD_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated = `icloud_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    await AsyncStorage.setItem(APPLE_ICLOUD_ID_KEY, generated);
    return generated;
  } catch {
    return `icloud_device_default`;
  }
}

/**
 * 1-Tap Sign in with Apple / iCloud backed by Clerk Backend API + Vercel NoSQL DB.
 * Zero manual email/PIN fields required.
 */
export async function signInWithAppleCloud(displayName?: string): Promise<{
  ok: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}> {
  try {
    const deviceIdentityId = await getOrCreateAppleICloudIdentity();
    const res = await fetch(`${CLOUD_API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'apple',
        deviceIdentityId,
        displayName: displayName?.trim() || 'Apple iCloud',
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.token || !data?.user) {
      return {
        ok: false,
        error: data?.error || 'Nie udało się połączyć z usługą Apple iCloud / Clerk.',
      };
    }

    const session: CloudSession = {
      token: data.token,
      userId: data.user.userId,
      clerkUserId: data.user.clerkUserId || null,
      email: data.user.email,
      provider: 'apple',
      displayName: data.user.displayName || 'Apple iCloud',
      lastSyncedAt: data.user.lastSyncedAt || null,
      backupSummary: data.user.backupSummary || null,
    };

    await saveStoredCloudSession(session);
    return {
      ok: true,
      isNewAccount: Boolean(data.isNewAccount),
      session,
    };
  } catch {
    return {
      ok: false,
      error: 'Brak połączenia z internetem lub serwer chmury jest niedostępny.',
    };
  }
}

/**
 * 1-Tap Sign in with Google via Clerk OAuth handoff (/mobile-auth) + Vercel NoSQL DB.
 * Opens Clerk's Google OAuth screen and automatically resolves when the user completes login.
 */
export async function signInWithGoogleCloud(): Promise<{
  ok: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}> {
  try {
    const startRes = await fetch(`${CLOUD_API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_attempt',
        provider: 'google',
      }),
    });

    const startData = await startRes.json().catch(() => null);
    if (!startRes.ok || !startData?.ok || !startData?.attemptId || !startData?.authUrl) {
      return {
        ok: false,
        error: startData?.error || 'Nie udało się zainicjować sesji Clerk Google OAuth.',
      };
    }

    const { attemptId, authUrl } = startData;
    await Linking.openURL(authUrl);

    // Poll Clerk OAuth completion (up to 90s, accelerating when app comes back to foreground)
    return await new Promise((resolve) => {
      let finished = false;
      let attempts = 0;
      const maxAttempts = 65;

      const checkAttempt = async () => {
        if (finished) return;
        attempts += 1;
        try {
          const pollRes = await fetch(`${CLOUD_API_BASE}/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'poll_attempt',
              attemptId,
            }),
          });
          const pollData = await pollRes.json().catch(() => null);
          if (pollData?.ok && pollData?.status === 'completed' && pollData?.token && pollData?.user) {
            finished = true;
            cleanup();
            const session: CloudSession = {
              token: pollData.token,
              userId: pollData.user.userId,
              clerkUserId: pollData.user.clerkUserId || null,
              email: pollData.user.email,
              provider: 'google',
              displayName: pollData.user.displayName || 'Konto Google',
              lastSyncedAt: pollData.user.lastSyncedAt || null,
              backupSummary: pollData.user.backupSummary || null,
            };
            await saveStoredCloudSession(session);
            resolve({
              ok: true,
              isNewAccount: Boolean(pollData.isNewAccount),
              session,
            });
            return;
          }
        } catch {}

        if (attempts >= maxAttempts && !finished) {
          finished = true;
          cleanup();
          resolve({
            ok: false,
            error: 'Przekroczono czas oczekiwania na autoryzację Google w przeglądarce.',
          });
        }
      };

      const intervalId = setInterval(checkAttempt, 1400);
      const appStateSub = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active') {
          checkAttempt();
        }
      });
      const urlSub = Linking.addEventListener('url', () => {
        checkAttempt();
      });

      const cleanup = () => {
        clearInterval(intervalId);
        appStateSub.remove();
        urlSub.remove();
      };
    });
  } catch {
    return {
      ok: false,
      error: 'Nie udało się otworzyć logowania Google (Clerk OAuth).',
    };
  }
}

export async function pushProfileToCloud(profileId: string): Promise<{
  ok: boolean;
  syncedAt?: string;
  summary?: CloudBackupSummary;
  error?: string;
}> {
  const session = await getStoredCloudSession();
  if (!session) {
    return {
      ok: false,
      error: 'Najpierw połącz konto Google lub Apple iCloud.',
    };
  }

  try {
    const parsedBackup = await exportProfileBackup(profileId);

    const res = await fetch(`${CLOUD_API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ backup: parsedBackup }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        error: data?.error || 'Nie udało się wysłać danych profilu do chmury.',
      };
    }

    const updatedSession: CloudSession = {
      ...session,
      lastSyncedAt: data.syncedAt,
      backupSummary: data.summary || session.backupSummary,
    };
    await saveStoredCloudSession(updatedSession);

    await updateProfile(profileId, {
      cloudUserId: session.userId,
      cloudProvider: session.provider,
      cloudEmail: session.email,
      lastCloudSyncAt: data.syncedAt,
    }).catch(() => {});

    return {
      ok: true,
      syncedAt: data.syncedAt,
      summary: data.summary,
    };
  } catch {
    return {
      ok: false,
      error: 'Błąd połączenia podczas wysyłania kopii do chmury NoSQL.',
    };
  }
}

export async function pullProfileFromCloud(): Promise<{
  ok: boolean;
  profile?: UserProfile;
  syncedAt?: string;
  error?: string;
}> {
  const session = await getStoredCloudSession();
  if (!session) {
    return {
      ok: false,
      error: 'Najpierw połącz konto Google lub Apple iCloud.',
    };
  }

  try {
    const res = await fetch(`${CLOUD_API_BASE}/sync`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.backup) {
      return {
        ok: false,
        error:
          data?.error ||
          'Na tym koncie nie ma jeszcze zapisanej kopii treningowej w chmurze.',
      };
    }

    const rawBackupJson = JSON.stringify(data.backup);
    const importedResult = await importProfileBackup(rawBackupJson);
    const importedProfile = importedResult.profile;

    const syncedAt = data.syncedAt || new Date().toISOString();
    const updatedProfile =
      (await updateProfile(importedProfile.id, {
        cloudUserId: session.userId,
        cloudProvider: session.provider,
        cloudEmail: session.email,
        lastCloudSyncAt: syncedAt,
      })) || importedProfile;

    await saveStoredCloudSession({
      ...session,
      lastSyncedAt: syncedAt,
    });

    return {
      ok: true,
      profile: updatedProfile,
      syncedAt,
    };
  } catch {
    return {
      ok: false,
      error: 'Błąd połączenia podczas pobierania profilu z chmury NoSQL.',
    };
  }
}

export async function deleteCloudAccountData(): Promise<boolean> {
  const session = await getStoredCloudSession();
  if (!session) return false;
  try {
    const res = await fetch(`${CLOUD_API_BASE}/sync`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    await clearStoredCloudSession();
    return res.ok;
  } catch {
    return false;
  }
}
