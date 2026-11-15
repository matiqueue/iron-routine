import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportProfileBackup,
  getActiveProfile,
  importProfileBackup,
  updateProfile,
} from './storage';
import { UserProfile } from '../types/workout';

export type CloudProvider = 'apple' | 'google';

export interface CloudAccountSession {
  token: string;
  userId: string;
  email: string;
  provider: CloudProvider;
  displayName: string;
  lastSyncedAt?: string | null;
  backupSummary?: {
    profileName: string;
    plansCount: number;
    prsCount: number;
    historyCount: number;
  } | null;
}

const CLOUD_SESSION_KEY = '@iron_routine_cloud_session_v1';
const CLOUD_API_BASE = 'https://iron-routine-app.vercel.app';

export async function getCloudSession(): Promise<CloudAccountSession | null> {
  try {
    const raw = await AsyncStorage.getItem(CLOUD_SESSION_KEY);
    if (!raw) return null;
    const parsed: CloudAccountSession = JSON.parse(raw);
    if (!parsed?.token || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function signOutCloudAccount(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLOUD_SESSION_KEY);
    const active = await getActiveProfile();
    if (active) {
      await updateProfile(active.id, {
        cloudUserId: '',
        cloudEmail: '',
      });
    }
  } catch {}
}

export async function signInWithCloudAccount(params: {
  provider: CloudProvider;
  email: string;
  secretPin: string;
  displayName?: string;
}): Promise<{
  session: CloudAccountSession;
  isNewAccount: boolean;
}> {
  const email = params.email.trim().toLowerCase();
  const secretPin = params.secretPin.trim();

  if (!email || !email.includes('@')) {
    throw new Error('Wpisz prawidłowy adres e-mail powiązany z Apple iCloud lub Google.');
  }
  if (!secretPin || secretPin.length < 4) {
    throw new Error('Klucz zabezpieczający / PIN chmury musi mieć co najmniej 4 znaki.');
  }

  const response = await fetch(`${CLOUD_API_BASE}/api/cloud/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: params.provider,
      email,
      secretPin,
      displayName: params.displayName,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.token) {
    throw new Error(data?.error || 'Nie udało się zalogować do chmury Iron Routine.');
  }

  const session: CloudAccountSession = {
    token: data.token,
    userId: data.user.userId,
    email: data.user.email,
    provider: data.user.provider,
    displayName: data.user.displayName,
    lastSyncedAt: data.user.lastSyncedAt || null,
    backupSummary: data.user.backupSummary || null,
  };

  await AsyncStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));

  const active = await getActiveProfile();
  if (active) {
    await updateProfile(active.id, {
      cloudUserId: session.userId,
      cloudProvider: session.provider,
      cloudEmail: session.email,
      lastCloudSyncAt: session.lastSyncedAt || undefined,
    });
  }

  return {
    session,
    isNewAccount: Boolean(data.isNewAccount),
  };
}

export async function pushProfileToCloud(profileId?: string): Promise<{
  syncedAt: string;
  session: CloudAccountSession;
}> {
  const session = await getCloudSession();
  if (!session) {
    throw new Error('Najpierw zaloguj się kontem Apple iCloud lub Google.');
  }

  const backupPayload = await exportProfileBackup(profileId);
  const response = await fetch(`${CLOUD_API_BASE}/api/cloud/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({ backup: backupPayload }),
  });

  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'Nie udało się wysłać kopii danych do chmury NoSQL.');
  }

  const nextSession: CloudAccountSession = {
    ...session,
    lastSyncedAt: data.syncedAt,
    backupSummary: data.summary || session.backupSummary,
  };
  await AsyncStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(nextSession));

  const active = await getActiveProfile();
  if (active) {
    await updateProfile(active.id, {
      cloudUserId: nextSession.userId,
      cloudProvider: nextSession.provider,
      cloudEmail: nextSession.email,
      lastCloudSyncAt: data.syncedAt,
    });
  }

  return {
    syncedAt: data.syncedAt,
    session: nextSession,
  };
}

export async function pullProfileFromCloud(
  mode: 'overwrite_active' | 'create_new' = 'overwrite_active'
): Promise<{
  profile: UserProfile;
  plansCount: number;
  prsCount: number;
  syncedAt: string;
}> {
  const session = await getCloudSession();
  if (!session) {
    throw new Error('Najpierw zaloguj się kontem Apple iCloud lub Google.');
  }

  const response = await fetch(`${CLOUD_API_BASE}/api/cloud/sync`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.backup) {
    throw new Error(
      data?.error || 'Na tym koncie w chmurze nie znaleziono jeszcze zapisanej kopii profilu.'
    );
  }

  const imported = await importProfileBackup(JSON.stringify(data.backup), mode);
  const syncedAt = data.syncedAt || new Date().toISOString();

  await updateProfile(imported.profile.id, {
    cloudUserId: session.userId,
    cloudProvider: session.provider,
    cloudEmail: session.email,
    lastCloudSyncAt: syncedAt,
  });

  const nextSession: CloudAccountSession = {
    ...session,
    lastSyncedAt: syncedAt,
  };
  await AsyncStorage.setItem(CLOUD_SESSION_KEY, JSON.stringify(nextSession));

  return {
    ...imported,
    syncedAt,
  };
}

export async function deleteCloudAccountData(): Promise<void> {
  const session = await getCloudSession();
  if (!session) return;

  await fetch(`${CLOUD_API_BASE}/api/cloud/sync`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  });

  await signOutCloudAccount();
}
