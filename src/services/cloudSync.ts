import { AppState, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportProfileBackup,
  getActiveProfile,
  importProfileBackup,
  updateProfile,
} from './storage';
import { UserProfile } from '../types/workout';
import { getCurrentAppLanguage } from './settings';
import { translateText } from '../i18n/translations';

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

let postCloudPushHook: ((profileId: string) => void) | null = null;

export function registerPostCloudPushHook(fn: (profileId: string) => void): void {
  postCloudPushHook = fn;
}

export interface CloudSession {
  token: string;
  userId: string;
  clerkUserId?: string | null;
  email: string;
  provider: CloudAuthProvider;
  displayName: string;
  nickname?: string | null;
  nicknameUpdatedAt?: string | null;
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
    return 'icloud_device_default';
  }
}

/**
 * Unified, normalized Clerk Core 3 authentication flow for both iCloud (Apple) and Gmail (Google).
 * Creates a Clerk handoff attempt on Vercel NoSQL, opens Clerk's `/mobile-auth` portal,
 * and resolves immediately via `ironroutine://auth` deep link / AppState / polling.
 */
export async function signInWithClerkCloud(
  provider: CloudAuthProvider,
  displayName?: string
): Promise<{
  ok: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}> {
  try {
    const deviceIdentityId =
      provider === 'apple' ? await getOrCreateAppleICloudIdentity() : undefined;

    const startRes = await fetch(`${CLOUD_API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_attempt',
        provider,
        deviceIdentityId,
        displayName:
          displayName?.trim() || (provider === 'apple' ? 'Apple iCloud' : 'Konto Google'),
      }),
    });

    const startData = await startRes.json().catch(() => null);
    if (!startRes.ok || !startData?.ok || !startData?.attemptId || !startData?.authUrl) {
      return {
        ok: false,
        error:
          startData?.error ||
          translateText(getCurrentAppLanguage(), 'cloudErrInitClerk', {
            provider: provider === 'apple' ? 'iCloud' : 'Google',
          }),
      };
    }

    const { attemptId, authUrl } = startData;
    await Linking.openURL(authUrl);

    return await new Promise((resolve) => {
      let finished = false;
      let attempts = 0;
      const maxAttempts = 75;

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
          if (
            pollData?.ok &&
            pollData?.status === 'completed' &&
            pollData?.token &&
            pollData?.user
          ) {
            finished = true;
            cleanup();
            const resolvedProvider: CloudAuthProvider =
              pollData.user.provider === 'apple' ? 'apple' : provider;
            const session: CloudSession = {
              token: pollData.token,
              userId: pollData.user.userId,
              clerkUserId: pollData.user.clerkUserId || null,
              email: pollData.user.email,
              provider: resolvedProvider,
              displayName:
                pollData.user.displayName ||
                displayName?.trim() ||
                (resolvedProvider === 'apple' ? 'Apple iCloud' : 'Google'),
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
            error: translateText(getCurrentAppLanguage(), 'cloudErrTimeout'),
          });
        }
      };

      const intervalId = setInterval(checkAttempt, 1200);
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
      error: translateText(getCurrentAppLanguage(), 'cloudErrOpenClerk', {
        provider: provider === 'apple' ? 'iCloud' : 'Google',
      }),
    };
  }
}

export async function signInWithAppleCloud(displayName?: string): Promise<{
  ok: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}> {
  return signInWithClerkCloud('apple', displayName);
}

export async function signInWithGoogleCloud(displayName?: string): Promise<{
  ok: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}> {
  return signInWithClerkCloud('google', displayName);
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
      error: translateText(getCurrentAppLanguage(), 'cloudErrNoAccount'),
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
        error: data?.error || translateText(getCurrentAppLanguage(), 'cloudErrPushFailed'),
      };
    }

    const updatedSession: CloudSession = {
      ...session,
      lastSyncedAt: data.syncedAt,
      backupSummary: data.summary || session.backupSummary,
    };
    await saveStoredCloudSession(updatedSession);

    await updateProfile(
      profileId,
      {
        cloudUserId: session.userId,
        cloudProvider: session.provider,
        cloudEmail: session.email,
        lastCloudSyncAt: data.syncedAt,
      },
      { skipCloudSync: true }
    ).catch(() => {});

    if (postCloudPushHook) {
      try {
        postCloudPushHook(profileId);
      } catch {}
    }

    return {
      ok: true,
      syncedAt: data.syncedAt,
      summary: data.summary,
    };
  } catch {
    return {
      ok: false,
      error: translateText(getCurrentAppLanguage(), 'cloudErrPushNetwork'),
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
      error: translateText(getCurrentAppLanguage(), 'cloudErrNoAccount'),
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
          translateText(getCurrentAppLanguage(), 'cloudErrNoCloudBackup'),
      };
    }

    const rawBackupJson = JSON.stringify(data.backup);
    const importedResult = await importProfileBackup(rawBackupJson);
    const importedProfile = importedResult.profile;

    const syncedAt = data.syncedAt || new Date().toISOString();
    const updatedProfile =
      (await updateProfile(
        importedProfile.id,
        {
          cloudUserId: session.userId,
          cloudProvider: session.provider,
          cloudEmail: session.email,
          lastCloudSyncAt: syncedAt,
        },
        { skipCloudSync: true }
      )) || importedProfile;

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
      error: translateText(getCurrentAppLanguage(), 'cloudErrPullNetwork'),
    };
  }
}

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncInFlight = false;

/**
 * Automatically synchronizes the active profile to the Vercel NoSQL database
 * whenever local training data, plans, body weight, or profile settings change.
 */
export function scheduleAutoCloudSync(explicitProfileId?: string): void {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  autoSyncTimer = setTimeout(async () => {
    autoSyncTimer = null;
    if (autoSyncInFlight) return;
    try {
      const session = await getStoredCloudSession();
      if (!session?.token || !session?.userId) return;

      let targetProfileId = explicitProfileId;
      if (!targetProfileId) {
        const active = await getActiveProfile();
        targetProfileId = active?.id;
      }
      if (!targetProfileId) return;

      autoSyncInFlight = true;
      await pushProfileToCloud(targetProfileId);
    } catch {
      // Silent background sync
    } finally {
      autoSyncInFlight = false;
    }
  }, 1500);
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
