import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChatMessage,
  ChatMessagePayload,
  ChatMessageType,
  FriendProfileSummary,
  SocialHubData,
} from '../types/workout';
import { getStoredCloudSession, registerPostCloudPushHook } from './cloudSync';
import {
  getActiveProfile,
  getActiveWorkoutPlan,
  getAllBestPRs,
  getCustomExercises,
  getWorkoutHistory,
  getWorkoutStreak,
} from './storage';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { computePhysiqueAnalytics } from './muscleAnalytics';
import { getCurrentAppLanguage } from './settings';
import { getTranslatedExerciseName, translateText } from '../i18n/translations';
import { isValidNickname, normalizeNickname } from '../utils/nickname';
import {
  decryptChatEnvelope,
  encryptChatEnvelope,
  getOrCreateE2eeKeyPair,
  StoredE2eeKeyPair,
} from '../utils/e2ee';

const SOCIAL_API_URL = 'https://iron-routine-app.vercel.app/api/social';
const SOCIAL_CACHE_KEY_PREFIX = '@iron_routine:social_hub_v2_';

export interface SocialSearchResult {
  profile: FriendProfileSummary;
  relationStatus: 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
}

function getFriendlySocialError(code?: string): string {
  const lang = getCurrentAppLanguage();
  switch (code) {
    case 'INVALID_NICKNAME':
      return translateText(lang, 'nicknameInvalidError');
    case 'NICKNAME_TAKEN':
      return translateText(lang, 'nicknameTakenError');
    case 'NICKNAME_COOLDOWN':
      return translateText(lang, 'nicknameCooldownError');
    case 'USER_NOT_FOUND':
      return translateText(lang, 'friendNotFoundError');
    case 'ALREADY_FRIENDS':
      return translateText(lang, 'friendAlreadyAddedError');
    case 'ALREADY_REQUESTED':
      return translateText(lang, 'friendAlreadyRequestedError');
    case 'UNAUTHORIZED':
      return translateText(lang, 'cloudErrNoAccount');
    default:
      return translateText(lang, 'socialRequestFailedError');
  }
}

function decryptWireChatMessage(
  raw: any,
  myUserId: string,
  myKeyPair: StoredE2eeKeyPair | null
): ChatMessage {
  const plain = decryptChatEnvelope(raw, myUserId, myKeyPair);
  if (plain) {
    return {
      id: String(raw.id),
      senderId: String(raw.senderId),
      recipientId: String(raw.recipientId),
      type: plain.type,
      text: plain.text,
      payload: plain.payload,
      isEncrypted: raw.isEncrypted !== false,
      decryptFailed: false,
      ciphertext: raw.ciphertext,
      nonce: raw.nonce,
      senderPublicKey: raw.senderPublicKey,
      recipientPublicKey: raw.recipientPublicKey,
      alg: raw.alg,
      createdAt: String(raw.createdAt),
      reactions: raw.reactions || {},
    };
  }
  return {
    id: String(raw.id),
    senderId: String(raw.senderId),
    recipientId: String(raw.recipientId),
    type: 'text',
    text: translateText(getCurrentAppLanguage(), 'e2eeKeyChangedPlaceholder'),
    isEncrypted: true,
    decryptFailed: true,
    createdAt: String(raw.createdAt),
    reactions: raw.reactions || {},
  };
}

export async function ensureE2eeKeyRegistered(): Promise<StoredE2eeKeyPair | null> {
  const session = await getStoredCloudSession();
  if (!session?.token || !session?.userId) return null;
  const keyPair = await getOrCreateE2eeKeyPair(session.userId);
  try {
    await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'register_e2ee_key',
        publicKey: keyPair.publicKey,
      }),
    });
  } catch {}
  return keyPair;
}

export async function getCachedSocialHub(userId: string): Promise<SocialHubData | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SOCIAL_CACHE_KEY_PREFIX}${userId}`);
    return raw ? (JSON.parse(raw) as SocialHubData) : null;
  } catch {
    return null;
  }
}

async function saveCachedSocialHub(userId: string, hub: SocialHubData): Promise<void> {
  try {
    await AsyncStorage.setItem(`${SOCIAL_CACHE_KEY_PREFIX}${userId}`, JSON.stringify(hub));
  } catch {}
}

export async function claimNicknameInCloud(params: {
  nickname: string;
  displayName?: string;
  enforceCooldown?: boolean;
}): Promise<{
  ok: boolean;
  nickname?: string;
  nicknameUpdatedAt?: string;
  daysRemaining?: number;
  error?: string;
}> {
  const cleanNick = normalizeNickname(params.nickname);
  if (!isValidNickname(cleanNick)) {
    return { ok: false, error: getFriendlySocialError('INVALID_NICKNAME') };
  }

  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: true, nickname: cleanNick, nicknameUpdatedAt: new Date().toISOString() };
  }

  try {
    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'claim_nickname',
        nickname: cleanNick,
        displayName: params.displayName,
        enforceCooldown: params.enforceCooldown !== false,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        daysRemaining: data?.daysRemaining,
        error: getFriendlySocialError(data?.error),
      };
    }
    return {
      ok: true,
      nickname: data.nickname,
      nicknameUpdatedAt: data.nicknameUpdatedAt,
    };
  } catch {
    return { ok: false, error: translateText(getCurrentAppLanguage(), 'socialNetworkError') };
  }
}

export async function buildAndPublishSocialProfile(
  explicitProfileId?: string
): Promise<FriendProfileSummary | null> {
  try {
    const session = await getStoredCloudSession();
    if (!session?.token) return null;

    const active = await getActiveProfile();
    const profileId = explicitProfileId || active?.id;
    if (!profileId || !active) return null;

    const [activePlan, history, streak, customExercises, bestPRs, keyPair] = await Promise.all([
      getActiveWorkoutPlan(profileId),
      getWorkoutHistory(profileId),
      getWorkoutStreak(profileId),
      getCustomExercises(),
      getAllBestPRs(profileId),
      getOrCreateE2eeKeyPair(session.userId),
    ]);

    const allExercises = [...EXERCISE_LIBRARY, ...customExercises];
    const physique = await computePhysiqueAnalytics({
      profileId,
      allExercises,
      activePlanDays: activePlan?.days || [],
      workoutHistory: history,
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff7Str = sevenDaysAgo.toISOString().slice(0, 10);
    const weeklyWorkouts = history.filter((h) => h.date >= cutoff7Str).length;

    const topMuscles = [...physique.muscleStatsList]
      .filter((m) => m.effectiveSetsTotal > 0)
      .sort((a, b) => b.effectiveSetsTotal - a.effectiveSetsTotal)
      .slice(0, 3)
      .map((m) => ({
        muscleId: m.muscleId,
        rank: m.rank,
        effectiveSetsTotal: Math.round(m.effectiveSetsTotal),
      }));

    const lang = getCurrentAppLanguage();
    const recentPrs = Object.values(bestPRs)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 3)
      .map((pr) => ({
        exerciseId: pr.exerciseId,
        exerciseName: getTranslatedExerciseName(pr.exerciseId, pr.exerciseName, lang),
        weight: pr.weight,
        reps: pr.reps,
        date: pr.date,
      }));

    const latestWorkout = history.length > 0 ? history[0] : null;

    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'publish_profile',
        profile: {
          displayName: active.name,
          nickname: active.nickname,
          e2eePublicKey: keyPair.publicKey,
          avatarColor: active.avatarColor || '#10B981',
          avatarUrl: active.avatarUrl !== undefined ? active.avatarUrl : undefined,
          gender: active.gender || 'male',
          overallRank: physique.overallRank,
          overallProgressPct: physique.overallProgressPct,
          balanceScorePct: physique.balanceScorePct,
          streak,
          totalWorkouts: history.length,
          totalSets: physique.totalLifetimeSets,
          weeklyWorkouts,
          topMuscles,
          recentPrs,
          lastWorkoutAt: latestWorkout?.date || null,
          latestWorkoutTitle: latestWorkout?.dayName || undefined,
          statusNote: active.statusNote,
          showActivityToFriends: active.showActivityToFriends !== false,
        },
      }),
    });

    const data = await res.json().catch(() => null);
    if (res.ok && data?.ok && data?.profile) {
      return data.profile as FriendProfileSummary;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchSocialHub(): Promise<{
  ok: boolean;
  hub?: SocialHubData;
  error?: string;
}> {
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, error: getFriendlySocialError('UNAUTHORIZED') };
  }
  try {
    const [keyPair, res] = await Promise.all([
      getOrCreateE2eeKeyPair(session.userId),
      fetch(`${SOCIAL_API_URL}?action=hub`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.token}` },
      }),
    ]);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.hub) {
      return { ok: false, error: getFriendlySocialError(data?.error) };
    }

    const rawHub = data.hub as SocialHubData;
    const decryptedHub: SocialHubData = {
      ...rawHub,
      friends: (rawHub.friends || []).map((thread) => ({
        ...thread,
        lastMessage: thread.lastMessage
          ? decryptWireChatMessage(thread.lastMessage, session.userId, keyPair)
          : null,
      })),
    };

    await saveCachedSocialHub(session.userId, decryptedHub);
    return { ok: true, hub: decryptedHub };
  } catch {
    return { ok: false, error: translateText(getCurrentAppLanguage(), 'socialNetworkError') };
  }
}

export async function searchUsersByNickname(query: string): Promise<{
  ok: boolean;
  results: SocialSearchResult[];
  error?: string;
}> {
  const clean = normalizeNickname(query);
  if (!clean) return { ok: true, results: [] };
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, results: [], error: getFriendlySocialError('UNAUTHORIZED') };
  }
  try {
    const res = await fetch(
      `${SOCIAL_API_URL}?action=search&q=${encodeURIComponent(clean)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.token}` },
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, results: [], error: getFriendlySocialError(data?.error) };
    }
    return { ok: true, results: (data.results || []) as SocialSearchResult[] };
  } catch {
    return {
      ok: false,
      results: [],
      error: translateText(getCurrentAppLanguage(), 'socialNetworkError'),
    };
  }
}

export async function sendFriendRequest(params: {
  targetNickname?: string;
  targetUserId?: string;
}): Promise<{ ok: boolean; matched?: boolean; error?: string }> {
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, error: getFriendlySocialError('UNAUTHORIZED') };
  }
  try {
    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'send_request',
        targetNickname: params.targetNickname,
        targetUserId: params.targetUserId,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: getFriendlySocialError(data?.error) };
    }
    return { ok: true, matched: Boolean(data.matched) };
  } catch {
    return { ok: false, error: translateText(getCurrentAppLanguage(), 'socialNetworkError') };
  }
}

export async function respondToFriendRequest(
  targetUserId: string,
  decision: 'accept' | 'decline' | 'cancel'
): Promise<{ ok: boolean; error?: string }> {
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, error: getFriendlySocialError('UNAUTHORIZED') };
  }
  try {
    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'respond_request',
        targetUserId,
        decision,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: getFriendlySocialError(data?.error) };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: translateText(getCurrentAppLanguage(), 'socialNetworkError') };
  }
}

export async function removeFriend(targetUserId: string): Promise<boolean> {
  const session = await getStoredCloudSession();
  if (!session?.token) return false;
  try {
    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'remove_friend',
        targetUserId,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendSocialCheer(
  targetUserId: string,
  activityId?: string,
  count = 1
): Promise<{ ok: boolean; cheersCount?: number }> {
  const session = await getStoredCloudSession();
  if (!session?.token) return { ok: false };
  try {
    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'send_cheer',
        targetUserId,
        activityId,
        count: Math.max(1, Math.min(200, Math.round(count || 1))),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return { ok: false };
    return { ok: true, cheersCount: data.cheersCount };
  } catch {
    return { ok: false };
  }
}

export async function fetchChatMessages(friendId: string): Promise<{
  ok: boolean;
  messages: ChatMessage[];
  error?: string;
}> {
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, messages: [], error: getFriendlySocialError('UNAUTHORIZED') };
  }
  try {
    const [keyPair, res] = await Promise.all([
      getOrCreateE2eeKeyPair(session.userId),
      fetch(`${SOCIAL_API_URL}?action=messages&friendId=${encodeURIComponent(friendId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.token}` },
      }),
    ]);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, messages: [], error: getFriendlySocialError(data?.error) };
    }
    const decrypted = (data.messages || []).map((m: any) =>
      decryptWireChatMessage(m, session.userId, keyPair)
    );
    return { ok: true, messages: decrypted };
  } catch {
    return {
      ok: false,
      messages: [],
      error: translateText(getCurrentAppLanguage(), 'socialNetworkError'),
    };
  }
}

export async function sendChatMessage(params: {
  friendId: string;
  recipientPublicKey: string;
  type?: ChatMessageType;
  text: string;
  payload?: ChatMessagePayload;
}): Promise<{ ok: boolean; message?: ChatMessage; error?: string }> {
  const session = await getStoredCloudSession();
  if (!session?.token) {
    return { ok: false, error: getFriendlySocialError('UNAUTHORIZED') };
  }
  if (!params.recipientPublicKey) {
    return {
      ok: false,
      error: translateText(getCurrentAppLanguage(), 'e2eeMissingRecipientKey'),
    };
  }

  try {
    const myKeyPair = await getOrCreateE2eeKeyPair(session.userId);
    const wire = encryptChatEnvelope(
      {
        type: params.type || 'text',
        text: params.text,
        payload: params.payload,
      },
      params.recipientPublicKey,
      myKeyPair
    );

    const res = await fetch(SOCIAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'send_message',
        friendId: params.friendId,
        ...wire,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.message) {
      return { ok: false, error: getFriendlySocialError(data?.error) };
    }
    return {
      ok: true,
      message: decryptWireChatMessage(data.message, session.userId, myKeyPair),
    };
  } catch {
    return { ok: false, error: translateText(getCurrentAppLanguage(), 'socialNetworkError') };
  }
}

export async function reactToChatMessage(
  friendId: string,
  messageId: string,
  emoji: string
): Promise<ChatMessage | null> {
  const session = await getStoredCloudSession();
  if (!session?.token) return null;
  try {
    const [keyPair, res] = await Promise.all([
      getOrCreateE2eeKeyPair(session.userId),
      fetch(SOCIAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          action: 'react_message',
          friendId,
          messageId,
          emoji,
        }),
      }),
    ]);
    const data = await res.json().catch(() => null);
    return res.ok && data?.ok
      ? decryptWireChatMessage(data.message, session.userId, keyPair)
      : null;
  } catch {
    return null;
  }
}

registerPostCloudPushHook((profileId) => {
  void buildAndPublishSocialProfile(profileId);
});
