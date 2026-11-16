import { list } from '@vercel/blob';
import crypto from 'crypto';
import {
  deletePrivateDocuments,
  getCloudUser,
  readPrivateDocument,
  saveCloudUser,
  writePrivateDocument,
} from './cloudStore.js';

const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface NicknameClaimRecord {
  nickname: string;
  userId: string;
  updatedAt: string;
}

export interface SocialProfileRecord {
  userId: string;
  nickname: string;
  displayName: string;
  avatarColor?: string;
  gender?: 'male' | 'female';
  overallRank: string;
  overallProgressPct: number;
  balanceScorePct: number;
  streak: number;
  totalWorkouts: number;
  totalSets: number;
  weeklyWorkouts: number;
  topMuscles: Array<{ muscleId: string; rank: string; effectiveSetsTotal: number }>;
  recentPrs: Array<{
    exerciseId: string;
    exerciseName: string;
    weight: number;
    reps: number;
    date: string;
  }>;
  lastWorkoutAt?: string | null;
  lastActiveAt?: string | null;
  statusNote?: string;
  showActivityToFriends?: boolean;
  cheersCount: number;
  cheeredBy?: string[];
  updatedAt: string;
}

export interface StoredFriendRequest {
  id: string;
  fromUserId: string;
  fromNickname: string;
  fromDisplayName: string;
  fromRank?: string;
  fromAvatarColor?: string;
  toUserId: string;
  toNickname: string;
  toDisplayName?: string;
  createdAt: string;
}

export interface UserRelationsRecord {
  friends: string[];
  incomingRequests: StoredFriendRequest[];
  outgoingRequests: StoredFriendRequest[];
}

export interface StoredSocialActivity {
  id: string;
  userId: string;
  nickname: string;
  displayName: string;
  avatarColor?: string;
  type: 'workout' | 'pr' | 'rank' | 'cheer' | 'status';
  title: string;
  subtitle?: string;
  rankTier?: string;
  createdAt: string;
  cheeredBy: string[];
}

export interface StoredChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'text' | 'cheer' | 'workout_share' | 'rank_card';
  text: string;
  payload?: Record<string, any>;
  createdAt: string;
  reactions?: Record<string, string[]>;
}

export function normalizeNickServer(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 20);
}

export function isValidNickServer(nick: string): boolean {
  return /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/.test(nick);
}

export async function getSocialProfile(userId: string): Promise<SocialProfileRecord | null> {
  const raw = await readPrivateDocument(`nosql/social/profiles/${userId}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SocialProfileRecord;
  } catch {
    return null;
  }
}

export async function saveSocialProfile(profile: SocialProfileRecord): Promise<void> {
  await writePrivateDocument(`nosql/social/profiles/${profile.userId}.json`, JSON.stringify(profile));
}

export async function getNicknameClaim(nick: string): Promise<NicknameClaimRecord | null> {
  const raw = await readPrivateDocument(`nosql/social/nicknames/${nick}.json`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as NicknameClaimRecord;
  } catch {
    return null;
  }
}

async function setNicknameClaim(record: NicknameClaimRecord): Promise<void> {
  await writePrivateDocument(`nosql/social/nicknames/${record.nickname}.json`, JSON.stringify(record));
}

export async function claimUserNickname(params: {
  userId: string;
  requestedNickname: string;
  displayName?: string;
  enforceCooldown?: boolean;
}): Promise<{ ok: boolean; nickname?: string; nicknameUpdatedAt?: string; daysRemaining?: number; error?: string; status?: number }> {
  const nick = normalizeNickServer(params.requestedNickname);
  if (!isValidNickServer(nick)) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_NICKNAME',
    };
  }

  const [cloudUser, existingProfile, claim] = await Promise.all([
    getCloudUser(params.userId),
    getSocialProfile(params.userId),
    getNicknameClaim(nick),
  ]);

  if (claim && claim.userId !== params.userId) {
    return {
      ok: false,
      status: 409,
      error: 'NICKNAME_TAKEN',
    };
  }

  const currentNick = existingProfile?.nickname || cloudUser?.nickname;
  const currentUpdatedAt = cloudUser?.nicknameUpdatedAt;

  // Same nickname already owned by user -> idempotent success
  if (currentNick === nick && claim?.userId === params.userId) {
    return {
      ok: true,
      nickname: nick,
      nicknameUpdatedAt: currentUpdatedAt || new Date().toISOString(),
    };
  }

  // Enforce 30-day cooldown if user already had an explicit nickname before
  if (params.enforceCooldown !== false && currentNick && currentUpdatedAt) {
    const prevMs = new Date(currentUpdatedAt).getTime();
    if (!isNaN(prevMs) && Date.now() < prevMs + NICKNAME_COOLDOWN_MS) {
      const daysRemaining = Math.max(
        1,
        Math.ceil((prevMs + NICKNAME_COOLDOWN_MS - Date.now()) / (24 * 60 * 60 * 1000))
      );
      return {
        ok: false,
        status: 429,
        daysRemaining,
        error: 'NICKNAME_COOLDOWN',
      };
    }
  }

  const nowIso = new Date().toISOString();
  await setNicknameClaim({
    nickname: nick,
    userId: params.userId,
    updatedAt: nowIso,
  });

  if (currentNick && currentNick !== nick) {
    const oldClaim = await getNicknameClaim(currentNick);
    if (oldClaim?.userId === params.userId) {
      await deletePrivateDocuments([`nosql/social/nicknames/${currentNick}.json`]);
    }
  }

  if (cloudUser) {
    cloudUser.nickname = nick;
    cloudUser.nicknameUpdatedAt = nowIso;
    if (params.displayName) {
      cloudUser.displayName = params.displayName;
    }
    cloudUser.updatedAt = nowIso;
    await saveCloudUser(cloudUser);
  }

  if (existingProfile) {
    existingProfile.nickname = nick;
    if (params.displayName) {
      existingProfile.displayName = params.displayName;
    }
    existingProfile.updatedAt = nowIso;
    await saveSocialProfile(existingProfile);
  }

  return {
    ok: true,
    nickname: nick,
    nicknameUpdatedAt: nowIso,
  };
}

export async function ensureDefaultNicknameForUser(
  userId: string,
  displayName: string
): Promise<string> {
  const existingProfile = await getSocialProfile(userId);
  if (existingProfile?.nickname) return existingProfile.nickname;
  const cloudUser = await getCloudUser(userId);
  if (cloudUser?.nickname) return cloudUser.nickname;

  const base = normalizeNickServer(displayName).replace(/[._]+/g, '') || 'athlete';
  const prefix = base.slice(0, 12) || 'athlete';
  for (let i = 0; i < 6; i++) {
    const suffix = Math.floor(100 + Math.random() * 899);
    const candidate = normalizeNickServer(`${prefix}_${suffix}`);
    if (!isValidNickServer(candidate)) continue;
    const claim = await getNicknameClaim(candidate);
    if (!claim || claim.userId === userId) {
      await setNicknameClaim({
        nickname: candidate,
        userId,
        updatedAt: new Date().toISOString(),
      });
      return candidate;
    }
  }
  const fallback = `athlete_${userId.slice(-6)}`;
  await setNicknameClaim({
    nickname: fallback,
    userId,
    updatedAt: new Date().toISOString(),
  });
  return fallback;
}

export async function getUserRelations(userId: string): Promise<UserRelationsRecord> {
  const raw = await readPrivateDocument(`nosql/social/relations/${userId}.json`);
  if (!raw) {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }
  try {
    const parsed = JSON.parse(raw) as UserRelationsRecord;
    return {
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      incomingRequests: Array.isArray(parsed.incomingRequests) ? parsed.incomingRequests : [],
      outgoingRequests: Array.isArray(parsed.outgoingRequests) ? parsed.outgoingRequests : [],
    };
  } catch {
    return { friends: [], incomingRequests: [], outgoingRequests: [] };
  }
}

export async function saveUserRelations(userId: string, rel: UserRelationsRecord): Promise<void> {
  await writePrivateDocument(`nosql/social/relations/${userId}.json`, JSON.stringify(rel));
}

export async function searchNicknames(query: string, viewerUserId: string): Promise<Array<{
  profile: SocialProfileRecord;
  relationStatus: 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
}>> {
  const q = normalizeNickServer(query);
  if (!q) return [];

  const [viewerRel, listed] = await Promise.all([
    getUserRelations(viewerUserId),
    list({ prefix: 'nosql/social/nicknames/', limit: 250 }),
  ]);

  const friendSet = new Set(viewerRel.friends);
  const incomingSet = new Set(viewerRel.incomingRequests.map((r) => r.fromUserId));
  const outgoingSet = new Set(viewerRel.outgoingRequests.map((r) => r.toUserId));

  // Filter exact & prefix matches first, then substring matches
  const matchedNicks: string[] = [];
  for (const blob of listed.blobs) {
    const namePart = blob.pathname
      .replace('nosql/social/nicknames/', '')
      .replace(/\.json$/, '');
    if (namePart === q || namePart.startsWith(q) || namePart.includes(q)) {
      matchedNicks.push(namePart);
    }
  }

  matchedNicks.sort((a, b) => {
    const aExact = a === q ? 0 : a.startsWith(q) ? 1 : 2;
    const bExact = b === q ? 0 : b.startsWith(q) ? 1 : 2;
    if (aExact !== bExact) return aExact - bExact;
    return a.localeCompare(b);
  });

  const topNicks = matchedNicks.slice(0, 20);
  const claims = await Promise.all(topNicks.map((n) => getNicknameClaim(n)));
  const uniqueUserIds = Array.from(
    new Set(claims.map((c) => c?.userId).filter((id): id is string => Boolean(id)))
  );
  const profiles = await Promise.all(uniqueUserIds.map((id) => getSocialProfile(id)));

  const out: Array<{
    profile: SocialProfileRecord;
    relationStatus: 'self' | 'friend' | 'incoming' | 'outgoing' | 'none';
  }> = [];

  for (const p of profiles) {
    if (!p) continue;
    const status =
      p.userId === viewerUserId
        ? 'self'
        : friendSet.has(p.userId)
        ? 'friend'
        : incomingSet.has(p.userId)
        ? 'incoming'
        : outgoingSet.has(p.userId)
        ? 'outgoing'
        : 'none';
    if (status === 'self') continue;
    out.push({ profile: p, relationStatus: status });
  }

  return out;
}

export function getChatPairKey(userA: string, userB: string): string {
  return [userA, userB].sort().join('__');
}

export async function getChatMessages(userA: string, userB: string): Promise<StoredChatMessage[]> {
  const pairKey = getChatPairKey(userA, userB);
  const raw = await readPrivateDocument(`nosql/social/chats/${pairKey}.json`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveChatMessages(
  userA: string,
  userB: string,
  messages: StoredChatMessage[]
): Promise<void> {
  const pairKey = getChatPairKey(userA, userB);
  const trimmed = messages.slice(-200);
  await writePrivateDocument(`nosql/social/chats/${pairKey}.json`, JSON.stringify(trimmed));
}

export async function getChatReadMeta(userId: string): Promise<Record<string, string>> {
  const raw = await readPrivateDocument(`nosql/social/chat_meta/${userId}.json`);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

export async function setChatReadForFriend(userId: string, friendId: string): Promise<void> {
  const meta = await getChatReadMeta(userId);
  meta[friendId] = new Date().toISOString();
  await writePrivateDocument(`nosql/social/chat_meta/${userId}.json`, JSON.stringify(meta));
}

export async function getUserActivities(userId: string): Promise<StoredSocialActivity[]> {
  const raw = await readPrivateDocument(`nosql/social/activities/${userId}.json`);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendUserActivity(
  userId: string,
  item: Omit<StoredSocialActivity, 'id' | 'cheeredBy' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<void> {
  const existing = await getUserActivities(userId);
  const entry: StoredSocialActivity = {
    id: item.id || `act_${crypto.randomBytes(8).toString('hex')}`,
    userId: item.userId,
    nickname: item.nickname,
    displayName: item.displayName,
    avatarColor: item.avatarColor,
    type: item.type,
    title: item.title,
    subtitle: item.subtitle,
    rankTier: item.rankTier,
    createdAt: item.createdAt || new Date().toISOString(),
    cheeredBy: [],
  };
  const next = [entry, ...existing].slice(0, 25);
  await writePrivateDocument(`nosql/social/activities/${userId}.json`, JSON.stringify(next));
}
