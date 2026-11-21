import { AppState, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
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
  avatarUrl?: string | null;
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

export interface CloudAuthResult {
  ok: boolean;
  canceled?: boolean;
  isNewAccount?: boolean;
  session?: CloudSession;
  error?: string;
}

async function pollOAuthAttemptOnce(
  attemptId: string,
  fallbackProvider: CloudAuthProvider,
  fallbackDisplayName?: string
): Promise<CloudAuthResult | null> {
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
      const resolvedProvider: CloudAuthProvider =
        pollData.user.provider === 'apple' ? 'apple' : fallbackProvider;
      const session: CloudSession = {
        token: pollData.token,
        userId: pollData.user.userId,
        clerkUserId: pollData.user.clerkUserId || null,
        email: pollData.user.email,
        provider: resolvedProvider,
        displayName:
          pollData.user.displayName ||
          fallbackDisplayName?.trim() ||
          (resolvedProvider === 'apple' ? 'Apple' : 'Google'),
        nickname: pollData.user.nickname || null,
        nicknameUpdatedAt: pollData.user.nicknameUpdatedAt || null,
        avatarUrl: pollData.user.avatarUrl || null,
        lastSyncedAt: pollData.user.lastSyncedAt || null,
        backupSummary: pollData.user.backupSummary || null,
      };
      await saveStoredCloudSession(session);
      return {
        ok: true,
        isNewAccount: Boolean(pollData.isNewAccount),
        session,
      };
    }
  } catch {}
  return null;
}

/**
 * Unified Clerk Core 3 authentication flow for Google (and non-iOS Apple fallback).
 * On iOS & Android, runs inside a native in-app ASWebAuthenticationSession / Chrome Custom Tab
 * (`expo-web-browser` openAuthSessionAsync) to comply with Apple App Store Guideline 4.0.
 */
export async function signInWithClerkCloud(
  provider: CloudAuthProvider,
  displayName?: string
): Promise<CloudAuthResult> {
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
          displayName?.trim() || (provider === 'apple' ? 'Apple' : 'Google'),
      }),
    });

    const startData = await startRes.json().catch(() => null);
    if (!startRes.ok || !startData?.ok || !startData?.attemptId || !startData?.authUrl) {
      return {
        ok: false,
        error:
          startData?.error ||
          translateText(getCurrentAppLanguage(), 'cloudErrInitClerk', {
            provider: provider === 'apple' ? 'Apple' : 'Google',
          }),
      };
    }

    const { attemptId, authUrl } = startData;

    // Native iOS (ASWebAuthenticationSession) & Android (Chrome Custom Tabs) in-app auth session
    if (Platform.OS !== 'web') {
      const authResult = await WebBrowser.openAuthSessionAsync(
        authUrl,
        'ironroutine://auth',
        { preferEphemeralSession: false }
      );

      // Even on dismiss/cancel, check once in case the callback completed right before close
      const maxChecks = authResult.type === 'success' ? 6 : 1;
      for (let i = 0; i < maxChecks; i++) {
        const completed = await pollOAuthAttemptOnce(attemptId, provider, displayName);
        if (completed) {
          return completed;
        }
        if (i < maxChecks - 1) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }

      if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
        return { ok: false, canceled: true };
      }

      return {
        ok: false,
        error: translateText(getCurrentAppLanguage(), 'cloudErrTimeout'),
      };
    }

    // Web fallback: open popup + poll attempt
    const win = (globalThis as any)?.window;
    if (win?.open) {
      win.open(authUrl, '_blank', 'noopener');
    } else {
      await Linking.openURL(authUrl);
    }

    return await new Promise((resolve) => {
      let finished = false;
      let attempts = 0;
      const maxAttempts = 75;

      const checkAttempt = async () => {
        if (finished) return;
        attempts += 1;
        const completed = await pollOAuthAttemptOnce(attemptId, provider, displayName);
        if (completed) {
          finished = true;
          cleanup();
          resolve(completed);
          return;
        }

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
        provider: provider === 'apple' ? 'Apple' : 'Google',
      }),
    };
  }
}

/**
 * Native Sign in with Apple on iOS (`expo-apple-authentication` with Face ID / Touch ID +
 * server-side Apple JWKS identityToken verification), complying with App Store Guideline 4.8.
 */
export async function signInWithAppleCloud(displayName?: string): Promise<CloudAuthResult> {
  if (Platform.OS === 'ios') {
    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (available) {
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (!credential.identityToken) {
          return {
            ok: false,
            error: translateText(getCurrentAppLanguage(), 'cloudErrInitClerk', {
              provider: 'Apple',
            }),
          };
        }

        const appleNameParts = [
          credential.fullName?.givenName,
          credential.fullName?.familyName,
        ].filter(Boolean);
        const resolvedName =
          appleNameParts.join(' ').trim() || displayName?.trim() || undefined;

        const res = await fetch(`${CLOUD_API_BASE}/auth`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'apple_native',
            identityToken: credential.identityToken,
            displayName: resolvedName,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !data?.token || !data?.user) {
          return {
            ok: false,
            error:
              data?.error ||
              translateText(getCurrentAppLanguage(), 'cloudErrInitClerk', {
                provider: 'Apple',
              }),
          };
        }

        const session: CloudSession = {
          token: data.token,
          userId: data.user.userId,
          clerkUserId: data.user.clerkUserId || null,
          email: data.user.email,
          provider: 'apple',
          displayName: data.user.displayName || resolvedName || 'Apple',
          nickname: data.user.nickname || null,
          nicknameUpdatedAt: data.user.nicknameUpdatedAt || null,
          avatarUrl: data.user.avatarUrl || null,
          lastSyncedAt: data.user.lastSyncedAt || null,
          backupSummary: data.user.backupSummary || null,
        };
        await saveStoredCloudSession(session);

        return {
          ok: true,
          isNewAccount: Boolean(data.isNewAccount),
          session,
        };
      }
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return { ok: false, canceled: true };
      }
      return {
        ok: false,
        error:
          err?.message ||
          translateText(getCurrentAppLanguage(), 'cloudErrOpenClerk', {
            provider: 'Apple',
          }),
      };
    }
  }

  return signInWithClerkCloud('apple', displayName);
}

export async function signInWithGoogleCloud(displayName?: string): Promise<CloudAuthResult> {
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
let autoPullInFlight = false;

/**
 * Checks whether the Neon cloud backup is strictly newer than the device's lastCloudSyncAt
 * and pulls it automatically if updated remotely (e.g. from another device or server edit).
 */
export async function pullIfCloudNewer(): Promise<{
  updated: boolean;
  profile?: UserProfile;
}> {
  if (autoPullInFlight || autoSyncInFlight) {
    return { updated: false };
  }
  const session = await getStoredCloudSession();
  if (!session?.token || !session?.userId) {
    return { updated: false };
  }

  autoPullInFlight = true;
  try {
    const [active, res] = await Promise.all([
      getActiveProfile(),
      fetch(`${CLOUD_API_BASE}/sync`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      }),
    ]);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.backup || !data?.syncedAt) {
      return { updated: false };
    }

    const remoteMs = new Date(data.syncedAt).getTime();
    const localRef = active?.lastCloudSyncAt || session.lastSyncedAt || '';
    const localMs = localRef ? new Date(localRef).getTime() : 0;
    if (isNaN(remoteMs) || (!isNaN(localMs) && localMs > 0 && remoteMs <= localMs + 2000)) {
      return { updated: false };
    }

    if (autoSyncTimer) {
      clearTimeout(autoSyncTimer);
      autoSyncTimer = null;
    }

    const importedResult = await importProfileBackup(JSON.stringify(data.backup));
    const syncedAt = String(data.syncedAt);
    const updatedProfile =
      (await updateProfile(
        importedResult.profile.id,
        {
          cloudUserId: session.userId,
          cloudProvider: session.provider,
          cloudEmail: session.email,
          lastCloudSyncAt: syncedAt,
        },
        { skipCloudSync: true }
      )) || importedResult.profile;

    await saveStoredCloudSession({
      ...session,
      lastSyncedAt: syncedAt,
    });

    return {
      updated: true,
      profile: updatedProfile,
    };
  } catch {
    return { updated: false };
  } finally {
    autoPullInFlight = false;
  }
}

/**
 * Automatically synchronizes the active profile to the Neon PostgreSQL database
 * whenever local training data, plans, body weight, or profile settings change.
 */
export function scheduleAutoCloudSync(explicitProfileId?: string): void {
  if (autoPullInFlight) return;
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
