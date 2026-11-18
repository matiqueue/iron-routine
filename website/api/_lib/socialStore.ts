import crypto from 'crypto';
import { getCloudUser } from './cloudStore.js';
import { ensureSchema, getSql } from './db.js';

const NICKNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export interface SocialProfileRecord {
  userId: string;
  nickname: string;
  displayName: string;
  e2eePublicKey?: string | null;
  avatarColor?: string;
  avatarUrl?: string | null;
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
  cheeredByMe?: boolean;
  updatedAt: string;
}

export interface StoredFriendRequest {
  id: string;
  fromUserId: string;
  fromNickname: string;
  fromDisplayName: string;
  fromRank?: string;
  fromAvatarColor?: string;
  fromAvatarUrl?: string | null;
  toUserId: string;
  toNickname: string;
  toDisplayName?: string;
  createdAt: string;
}

export interface EncryptedChatMessageRecord {
  id: string;
  senderId: string;
  recipientId: string;
  isEncrypted: boolean;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  alg: string;
  reactions: Record<string, string[]>;
  editedAt?: string | null;
  createdAt: string;
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

export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join('__');
}

function mapSocialProfileRow(row: any, viewerUserId?: string): SocialProfileRecord {
  const cheeredBy: string[] = Array.isArray(row.cheered_by) ? row.cheered_by : [];
  return {
    userId: String(row.user_id),
    nickname: String(row.nickname || ''),
    displayName: String(row.display_name || 'Athlete'),
    e2eePublicKey: row.e2ee_public_key || null,
    avatarColor: row.avatar_color || '#10B981',
    avatarUrl: row.avatar_url !== undefined ? row.avatar_url : row.user_avatar_url || null,
    gender: row.gender === 'female' ? 'female' : 'male',
    overallRank: String(row.overall_rank || 'F'),
    overallProgressPct: Number(row.overall_progress_pct || 0),
    balanceScorePct: Number(row.balance_score_pct ?? 100),
    streak: Number(row.streak || 0),
    totalWorkouts: Number(row.total_workouts || 0),
    totalSets: Number(row.total_sets || 0),
    weeklyWorkouts: Number(row.weekly_workouts || 0),
    topMuscles: Array.isArray(row.top_muscles) ? row.top_muscles : [],
    recentPrs: Array.isArray(row.recent_prs) ? row.recent_prs : [],
    lastWorkoutAt: row.last_workout_at || null,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).toISOString() : null,
    statusNote: row.status_note || undefined,
    showActivityToFriends: row.show_activity !== false,
    cheersCount: Number(row.cheers_count || 0),
    cheeredByMe: viewerUserId ? cheeredBy.includes(viewerUserId) : false,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapChatMessageRow(row: any): EncryptedChatMessageRecord {
  return {
    id: String(row.id),
    senderId: String(row.sender_id),
    recipientId: String(row.recipient_id),
    isEncrypted: row.is_encrypted !== false,
    ciphertext: String(row.ciphertext),
    nonce: String(row.nonce),
    senderPublicKey: String(row.sender_public_key),
    recipientPublicKey: String(row.recipient_public_key),
    alg: String(row.alg || 'x25519-xsalsa20-poly1305'),
    reactions: (row.reactions && typeof row.reactions === 'object' ? row.reactions : {}) as Record<
      string,
      string[]
    >,
    editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

export async function getSocialProfile(
  userId: string,
  viewerUserId?: string
): Promise<SocialProfileRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const rows: any[] = await sql`
    SELECT
      u.user_id,
      u.nickname,
      u.display_name,
      u.e2ee_public_key,
      COALESCE(ap.avatar_url, u.avatar_url) AS avatar_url,
      ap.avatar_color,
      ap.gender,
      ap.overall_rank,
      ap.overall_progress_pct,
      ap.balance_score_pct,
      ap.streak,
      ap.total_workouts,
      ap.total_sets,
      ap.weekly_workouts,
      ap.top_muscles,
      ap.recent_prs,
      ap.last_workout_at,
      ap.last_active_at,
      ap.status_note,
      ap.show_activity,
      ap.cheers_count,
      ap.cheered_by,
      ap.updated_at
    FROM users u
    LEFT JOIN athlete_profiles ap ON ap.user_id = u.user_id
    WHERE u.user_id = ${userId}
    LIMIT 1
  `;
  if (!rows[0] || !rows[0].nickname) return null;
  return mapSocialProfileRow(rows[0], viewerUserId);
}

export async function registerUserE2eePublicKey(
  userId: string,
  e2eePublicKey: string
): Promise<boolean> {
  const cleanKey = String(e2eePublicKey || '').trim();
  if (cleanKey.length < 32 || cleanKey.length > 128) return false;
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE users
    SET
      e2ee_public_key = ${cleanKey},
      e2ee_key_updated_at = NOW(),
      updated_at = NOW()
    WHERE user_id = ${userId}
  `;
  return true;
}

export async function claimUserNickname(params: {
  userId: string;
  requestedNickname: string;
  displayName?: string;
  enforceCooldown?: boolean;
}): Promise<{
  ok: boolean;
  nickname?: string;
  nicknameUpdatedAt?: string;
  daysRemaining?: number;
  error?: string;
  status?: number;
}> {
  const nick = normalizeNickServer(params.requestedNickname);
  if (!isValidNickServer(nick)) {
    return { ok: false, status: 400, error: 'INVALID_NICKNAME' };
  }

  await ensureSchema();
  const sql = getSql();

  const existingUser = await getCloudUser(params.userId);
  if (!existingUser) {
    return { ok: false, status: 404, error: 'USER_NOT_FOUND' };
  }

  const takenRows: any[] = await sql`
    SELECT user_id FROM users
    WHERE LOWER(nickname) = LOWER(${nick}) AND user_id <> ${params.userId}
    LIMIT 1
  `;
  if (takenRows.length > 0) {
    return { ok: false, status: 409, error: 'NICKNAME_TAKEN' };
  }

  if (existingUser.nickname === nick) {
    return {
      ok: true,
      nickname: nick,
      nicknameUpdatedAt: existingUser.nicknameUpdatedAt || new Date().toISOString(),
    };
  }

  if (params.enforceCooldown !== false && existingUser.nickname && existingUser.nicknameUpdatedAt) {
    const prevMs = new Date(existingUser.nicknameUpdatedAt).getTime();
    if (!isNaN(prevMs) && Date.now() < prevMs + NICKNAME_COOLDOWN_MS) {
      const daysRemaining = Math.max(
        1,
        Math.ceil((prevMs + NICKNAME_COOLDOWN_MS - Date.now()) / (24 * 60 * 60 * 1000))
      );
      return { ok: false, status: 429, daysRemaining, error: 'NICKNAME_COOLDOWN' };
    }
  }

  const nowIso = new Date().toISOString();
  await sql`
    UPDATE users
    SET
      nickname = ${nick},
      nickname_updated_at = ${nowIso},
      display_name = COALESCE(${params.displayName || null}, display_name),
      updated_at = NOW()
    WHERE user_id = ${params.userId}
  `;

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
  await ensureSchema();
  const sql = getSql();
  const existing = await getCloudUser(userId);
  if (existing?.nickname) return existing.nickname;

  const base = normalizeNickServer(displayName).replace(/[._]+/g, '') || 'athlete';
  const prefix = base.slice(0, 12) || 'athlete';
  for (let i = 0; i < 6; i++) {
    const candidate = normalizeNickServer(`${prefix}_${Math.floor(100 + Math.random() * 899)}`);
    if (!isValidNickServer(candidate)) continue;
    const rows: any[] = await sql`
      SELECT user_id FROM users WHERE LOWER(nickname) = LOWER(${candidate}) LIMIT 1
    `;
    if (rows.length === 0) {
      await sql`
        UPDATE users
        SET nickname = ${candidate}, nickname_updated_at = COALESCE(nickname_updated_at, NOW()), updated_at = NOW()
        WHERE user_id = ${userId}
      `;
      return candidate;
    }
  }
  const fallback = `athlete_${userId.slice(-6)}`;
  await sql`
    UPDATE users
    SET nickname = ${fallback}, nickname_updated_at = COALESCE(nickname_updated_at, NOW()), updated_at = NOW()
    WHERE user_id = ${userId}
  `;
  return fallback;
}

export async function publishSocialProfile(params: {
  userId: string;
  snap: Record<string, any>;
}): Promise<SocialProfileRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const user = await getCloudUser(params.userId);
  if (!user) return null;

  const snap = params.snap || {};
  const displayName = String(snap.displayName || user.displayName || 'Athlete').trim();

  let nickname = user.nickname || '';
  const reqNick = normalizeNickServer(String(snap.nickname || ''));
  if (reqNick && reqNick !== nickname) {
    const claim = await claimUserNickname({
      userId: params.userId,
      requestedNickname: reqNick,
      displayName,
      enforceCooldown: Boolean(nickname),
    });
    if (claim.ok && claim.nickname) {
      nickname = claim.nickname;
    }
  }
  if (!nickname) {
    nickname = await ensureDefaultNicknameForUser(params.userId, displayName);
  }

  if (snap.e2eePublicKey) {
    await registerUserE2eePublicKey(params.userId, String(snap.e2eePublicKey));
  }

  if (snap.avatarUrl !== undefined) {
    await sql`
      UPDATE users
      SET avatar_url = ${snap.avatarUrl || null}, updated_at = NOW()
      WHERE user_id = ${params.userId}
    `;
  }

  if (displayName && displayName !== user.displayName) {
    await sql`UPDATE users SET display_name = ${displayName}, updated_at = NOW() WHERE user_id = ${params.userId}`;
  }

  const prevRows: any[] = await sql`
    SELECT total_workouts, overall_rank FROM athlete_profiles WHERE user_id = ${params.userId} LIMIT 1
  `;
  const hadPrev = prevRows.length > 0;
  const prevWorkouts = Number(prevRows[0]?.total_workouts || 0);
  const prevRank = String(prevRows[0]?.overall_rank || 'F');

  const nextWorkouts = Number(snap.totalWorkouts ?? prevWorkouts) || 0;
  const nextRank = String(snap.overallRank || prevRank || 'F');
  const nextPct = Number(snap.overallProgressPct ?? 0) || 0;
  const showActivity = snap.showActivityToFriends !== false;

  await sql`
    INSERT INTO athlete_profiles (
      user_id, avatar_color, avatar_url, gender, overall_rank, overall_progress_pct, balance_score_pct,
      streak, total_workouts, total_sets, weekly_workouts, top_muscles, recent_prs,
      last_workout_at, last_active_at, status_note, show_activity, updated_at
    ) VALUES (
      ${params.userId},
      ${String(snap.avatarColor || '#10B981')},
      ${snap.avatarUrl !== undefined ? snap.avatarUrl : user.avatarUrl || null},
      ${snap.gender === 'female' ? 'female' : 'male'},
      ${nextRank},
      ${nextPct},
      ${Number(snap.balanceScorePct ?? 100)},
      ${Number(snap.streak ?? 0)},
      ${nextWorkouts},
      ${Number(snap.totalSets ?? 0)},
      ${Number(snap.weeklyWorkouts ?? 0)},
      ${JSON.stringify(Array.isArray(snap.topMuscles) ? snap.topMuscles.slice(0, 3) : [])}::jsonb,
      ${JSON.stringify(Array.isArray(snap.recentPrs) ? snap.recentPrs.slice(0, 3) : [])}::jsonb,
      ${snap.lastWorkoutAt || null},
      NOW(),
      ${snap.statusNote !== undefined ? String(snap.statusNote).slice(0, 48) : null},
      ${showActivity},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      avatar_color = EXCLUDED.avatar_color,
      avatar_url = CASE
        WHEN ${snap.avatarUrl !== undefined} THEN EXCLUDED.avatar_url
        ELSE COALESCE(athlete_profiles.avatar_url, EXCLUDED.avatar_url)
      END,
      gender = EXCLUDED.gender,
      overall_rank = EXCLUDED.overall_rank,
      overall_progress_pct = EXCLUDED.overall_progress_pct,
      balance_score_pct = EXCLUDED.balance_score_pct,
      streak = EXCLUDED.streak,
      total_workouts = EXCLUDED.total_workouts,
      total_sets = EXCLUDED.total_sets,
      weekly_workouts = EXCLUDED.weekly_workouts,
      top_muscles = EXCLUDED.top_muscles,
      recent_prs = EXCLUDED.recent_prs,
      last_workout_at = EXCLUDED.last_workout_at,
      last_active_at = NOW(),
      status_note = CASE
        WHEN ${snap.statusNote !== undefined} THEN EXCLUDED.status_note
        ELSE athlete_profiles.status_note
      END,
      show_activity = EXCLUDED.show_activity,
      updated_at = NOW()
  `;

  if (hadPrev && showActivity && nextWorkouts > prevWorkouts) {
    const actId = `act_${crypto.randomBytes(8).toString('hex')}`;
    await sql`
      INSERT INTO social_activities (id, user_id, type, title, subtitle, rank_tier, created_at)
      VALUES (
        ${actId},
        ${params.userId},
        'workout',
        ${String(snap.latestWorkoutTitle || 'Workout')},
        ${`${Number(snap.totalSets ?? 0)} sets · ${Number(snap.streak ?? 0)}d`},
        ${nextRank},
        NOW()
      )
    `;
  }

  if (hadPrev && showActivity && nextRank !== prevRank && nextRank !== 'F') {
    const actId = `act_${crypto.randomBytes(8).toString('hex')}`;
    await sql`
      INSERT INTO social_activities (id, user_id, type, title, subtitle, rank_tier, created_at)
      VALUES (
        ${actId},
        ${params.userId},
        'rank',
        ${`Rank ${nextRank}`},
        ${`${nextPct}%`},
        ${nextRank},
        NOW()
      )
    `;
  }

  return getSocialProfile(params.userId, params.userId);
}

export async function areUsersFriends(userA: string, userB: string): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const [a, b] = orderedPair(userA, userB);
  const rows: any[] = await sql`
    SELECT 1 FROM friendships WHERE user_a = ${a} AND user_b = ${b} LIMIT 1
  `;
  return rows.length > 0;
}

export async function getSocialHubForUser(userId: string) {
  await ensureSchema();
  const sql = getSql();

  const [myProfile, friendRows, incomingRows, outgoingRows, readRows] = await Promise.all([
    getSocialProfile(userId, userId),
    sql`
      SELECT
        u.user_id, u.nickname, u.display_name, u.e2ee_public_key,
        COALESCE(ap.avatar_url, u.avatar_url) AS avatar_url,
        ap.avatar_color, ap.gender, ap.overall_rank, ap.overall_progress_pct,
        ap.balance_score_pct, ap.streak, ap.total_workouts, ap.total_sets,
        ap.weekly_workouts, ap.top_muscles, ap.recent_prs, ap.last_workout_at,
        ap.last_active_at, ap.status_note, ap.show_activity, ap.cheers_count,
        ap.cheered_by, ap.updated_at
      FROM friendships f
      JOIN users u ON u.user_id = CASE WHEN f.user_a = ${userId} THEN f.user_b ELSE f.user_a END
      LEFT JOIN athlete_profiles ap ON ap.user_id = u.user_id
      WHERE f.user_a = ${userId} OR f.user_b = ${userId}
    `,
    sql`
      SELECT
        fr.id, fr.from_user_id, fr.to_user_id, fr.created_at,
        uf.nickname AS from_nickname, uf.display_name AS from_display_name,
        COALESCE(apf.avatar_url, uf.avatar_url) AS from_avatar_url,
        apf.overall_rank AS from_rank, apf.avatar_color AS from_avatar_color,
        ut.nickname AS to_nickname, ut.display_name AS to_display_name
      FROM friend_requests fr
      JOIN users uf ON uf.user_id = fr.from_user_id
      LEFT JOIN athlete_profiles apf ON apf.user_id = fr.from_user_id
      JOIN users ut ON ut.user_id = fr.to_user_id
      WHERE fr.to_user_id = ${userId}
      ORDER BY fr.created_at DESC
    `,
    sql`
      SELECT
        fr.id, fr.from_user_id, fr.to_user_id, fr.created_at,
        uf.nickname AS from_nickname, uf.display_name AS from_display_name,
        ut.nickname AS to_nickname, ut.display_name AS to_display_name
      FROM friend_requests fr
      JOIN users uf ON uf.user_id = fr.from_user_id
      JOIN users ut ON ut.user_id = fr.to_user_id
      WHERE fr.from_user_id = ${userId}
      ORDER BY fr.created_at DESC
    `,
    sql`
      SELECT friend_id, last_read_at FROM chat_read_state WHERE user_id = ${userId}
    `,
  ]);

  const readMap: Record<string, string> = {};
  for (const r of readRows as any[]) {
    readMap[String(r.friend_id)] = new Date(r.last_read_at).toISOString();
  }

  const friendProfiles = (friendRows as any[]).map((r) => mapSocialProfileRow(r, userId));
  const friendIds = friendProfiles.map((f) => f.userId);

  let totalUnread = 0;
  const friends = await Promise.all(
    friendProfiles.map(async (fp) => {
      const pk = pairKeyFor(userId, fp.userId);
      const lastRead = readMap[fp.userId] || '1970-01-01T00:00:00.000Z';
      const [lastMsgRows, unreadRows] = await Promise.all([
        sql`
          SELECT * FROM chat_messages
          WHERE pair_key = ${pk}
          ORDER BY created_at DESC
          LIMIT 1
        `,
        sql`
          SELECT COUNT(*)::int AS cnt FROM chat_messages
          WHERE pair_key = ${pk}
            AND sender_id = ${fp.userId}
            AND created_at > ${lastRead}::timestamptz
        `,
      ]);
      const unreadCount = Number((unreadRows as any[])[0]?.cnt || 0);
      totalUnread += unreadCount;
      const lastMessage = (lastMsgRows as any[])[0]
        ? mapChatMessageRow((lastMsgRows as any[])[0])
        : null;
      return { friend: fp, lastMessage, unreadCount };
    })
  );

  friends.sort((a, b) => {
    const ta = a.lastMessage?.createdAt || a.friend.lastActiveAt || '';
    const tb = b.lastMessage?.createdAt || b.friend.lastActiveAt || '';
    return tb.localeCompare(ta);
  });

  const actRows: any[] =
    friendIds.length > 0
      ? await sql`
          SELECT
            sa.*,
            u.nickname, u.display_name,
            COALESCE(ap.avatar_url, u.avatar_url) AS avatar_url,
            ap.avatar_color, ap.show_activity
          FROM social_activities sa
          JOIN users u ON u.user_id = sa.user_id
          LEFT JOIN athlete_profiles ap ON ap.user_id = sa.user_id
          WHERE sa.user_id = ANY(${friendIds}::text[])
          ORDER BY sa.created_at DESC
          LIMIT 45
        `
      : [];

  const activities = actRows
    .filter((row) => row.user_id !== userId && row.show_activity !== false)
    .map((row) => {
      const cheeredBy: string[] = Array.isArray(row.cheered_by) ? row.cheered_by : [];
      const numericCheers = Number(row.cheers_count || 0);
      return {
        id: String(row.id),
        userId: String(row.user_id),
        nickname: String(row.nickname || ''),
        displayName: String(row.display_name || 'Athlete'),
        avatarColor: row.avatar_color || '#10B981',
        avatarUrl: row.avatar_url || null,
        type: row.type,
        title: String(row.title),
        subtitle: row.subtitle || undefined,
        rankTier: row.rank_tier || undefined,
        createdAt: new Date(row.created_at).toISOString(),
        cheersCount: Math.max(numericCheers, cheeredBy.length),
        cheeredByMe: cheeredBy.includes(userId),
      };
    });

  const incomingRequests: StoredFriendRequest[] = (incomingRows as any[]).map((r) => ({
    id: String(r.id),
    fromUserId: String(r.from_user_id),
    fromNickname: String(r.from_nickname || ''),
    fromDisplayName: String(r.from_display_name || 'Athlete'),
    fromRank: r.from_rank || 'F',
    fromAvatarColor: r.from_avatar_color || '#10B981',
    fromAvatarUrl: r.from_avatar_url || null,
    toUserId: String(r.to_user_id),
    toNickname: String(r.to_nickname || ''),
    toDisplayName: String(r.to_display_name || ''),
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const outgoingRequests: StoredFriendRequest[] = (outgoingRows as any[]).map((r) => ({
    id: String(r.id),
    fromUserId: String(r.from_user_id),
    fromNickname: String(r.from_nickname || ''),
    fromDisplayName: String(r.from_display_name || 'Athlete'),
    toUserId: String(r.to_user_id),
    toNickname: String(r.to_nickname || ''),
    toDisplayName: String(r.to_display_name || ''),
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const burstRows: any[] = await sql`
    SELECT
      cb.from_user_id,
      u.nickname AS from_nickname,
      u.display_name AS from_display_name,
      COALESCE(ap.avatar_url, u.avatar_url) AS from_avatar_url,
      SUM(cb.burst_count)::int AS count
    FROM cheer_bursts cb
    JOIN users u ON u.user_id = cb.from_user_id
    LEFT JOIN athlete_profiles ap ON ap.user_id = cb.from_user_id
    WHERE cb.to_user_id = ${userId} AND cb.delivered = FALSE
    GROUP BY cb.from_user_id, u.nickname, u.display_name, ap.avatar_url, u.avatar_url
  `;

  if (burstRows.length > 0) {
    await sql`
      UPDATE cheer_bursts
      SET delivered = TRUE
      WHERE to_user_id = ${userId} AND delivered = FALSE
    `;
  }

  const pendingCheerBursts = (burstRows as any[]).map((b) => ({
    fromUserId: String(b.from_user_id),
    fromNickname: String(b.from_nickname || ''),
    fromDisplayName: String(b.from_display_name || 'Athlete'),
    fromAvatarUrl: b.from_avatar_url || null,
    count: Number(b.count || 0),
  }));

  return {
    myProfile,
    friends,
    incomingRequests,
    outgoingRequests,
    activities,
    pendingCheerBursts,
    totalUnread: totalUnread + incomingRequests.length,
  };
}

export async function searchUsersByNickPg(query: string, viewerUserId: string) {
  const q = normalizeNickServer(query);
  if (!q) return [];
  await ensureSchema();
  const sql = getSql();

  const [rows, fRows, reqRows] = await Promise.all([
    sql`
      SELECT
        u.user_id, u.nickname, u.display_name, u.e2ee_public_key,
        COALESCE(ap.avatar_url, u.avatar_url) AS avatar_url,
        ap.avatar_color, ap.gender, ap.overall_rank, ap.overall_progress_pct,
        ap.balance_score_pct, ap.streak, ap.total_workouts, ap.total_sets,
        ap.weekly_workouts, ap.top_muscles, ap.recent_prs, ap.last_workout_at,
        ap.last_active_at, ap.status_note, ap.show_activity, ap.cheers_count,
        ap.cheered_by, ap.updated_at
      FROM users u
      LEFT JOIN athlete_profiles ap ON ap.user_id = u.user_id
      WHERE u.nickname IS NOT NULL
        AND u.user_id <> ${viewerUserId}
        AND LOWER(u.nickname) LIKE ${`%${q}%`}
      ORDER BY
        CASE
          WHEN LOWER(u.nickname) = ${q} THEN 0
          WHEN LOWER(u.nickname) LIKE ${`${q}%`} THEN 1
          ELSE 2
        END,
        LOWER(u.nickname) ASC
      LIMIT 20
    `,
    sql`
      SELECT CASE WHEN user_a = ${viewerUserId} THEN user_b ELSE user_a END AS fid
      FROM friendships
      WHERE user_a = ${viewerUserId} OR user_b = ${viewerUserId}
    `,
    sql`
      SELECT from_user_id, to_user_id FROM friend_requests
      WHERE from_user_id = ${viewerUserId} OR to_user_id = ${viewerUserId}
    `,
  ]);

  const friendSet = new Set((fRows as any[]).map((r) => String(r.fid)));
  const incomingSet = new Set(
    (reqRows as any[])
      .filter((r) => r.to_user_id === viewerUserId)
      .map((r) => String(r.from_user_id))
  );
  const outgoingSet = new Set(
    (reqRows as any[])
      .filter((r) => r.from_user_id === viewerUserId)
      .map((r) => String(r.to_user_id))
  );

  return (rows as any[]).map((row) => {
    const profile = mapSocialProfileRow(row, viewerUserId);
    const relationStatus = friendSet.has(profile.userId)
      ? 'friend'
      : incomingSet.has(profile.userId)
      ? 'incoming'
      : outgoingSet.has(profile.userId)
      ? 'outgoing'
      : 'none';
    return { profile, relationStatus };
  });
}

export async function getEncryptedChatMessages(
  userId: string,
  friendId: string
): Promise<EncryptedChatMessageRecord[]> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(userId, friendId);
  const rows: any[] = await sql`
    SELECT * FROM chat_messages
    WHERE pair_key = ${pk}
    ORDER BY created_at DESC
    LIMIT 150
  `;
  return rows.reverse().map(mapChatMessageRow);
}

export async function markChatRead(userId: string, friendId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO chat_read_state (user_id, friend_id, last_read_at)
    VALUES (${userId}, ${friendId}, NOW())
    ON CONFLICT (user_id, friend_id) DO UPDATE SET last_read_at = NOW()
  `;
}

export async function getFriendLastReadAt(
  userId: string,
  friendId: string
): Promise<string | null> {
  await ensureSchema();
  const sql = getSql();
  const rows: any[] = await sql`
    SELECT last_read_at FROM chat_read_state
    WHERE user_id = ${friendId} AND friend_id = ${userId}
    LIMIT 1
  `;
  return rows[0]?.last_read_at ? new Date(rows[0].last_read_at).toISOString() : null;
}

export async function saveEncryptedChatMessage(params: {
  senderId: string;
  recipientId: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  alg?: string;
}): Promise<EncryptedChatMessageRecord> {
  await ensureSchema();
  const sql = getSql();
  const id = `msg_${crypto.randomBytes(10).toString('hex')}`;
  const pk = pairKeyFor(params.senderId, params.recipientId);
  const rows: any[] = await sql`
    INSERT INTO chat_messages (
      id, pair_key, sender_id, recipient_id, is_encrypted,
      ciphertext, nonce, sender_public_key, recipient_public_key, alg, reactions, created_at
    ) VALUES (
      ${id},
      ${pk},
      ${params.senderId},
      ${params.recipientId},
      TRUE,
      ${params.ciphertext},
      ${params.nonce},
      ${params.senderPublicKey},
      ${params.recipientPublicKey},
      ${params.alg || 'x25519-xsalsa20-poly1305'},
      '{}'::jsonb,
      NOW()
    )
    RETURNING *
  `;
  await markChatRead(params.senderId, params.recipientId);
  return mapChatMessageRow(rows[0]);
}

export async function toggleChatMessageReaction(
  userId: string,
  friendId: string,
  messageId: string,
  emoji: string
): Promise<EncryptedChatMessageRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(userId, friendId);
  const rows: any[] = await sql`
    SELECT * FROM chat_messages WHERE id = ${messageId} AND pair_key = ${pk} LIMIT 1
  `;
  if (!rows[0]) return null;

  const reactions: Record<string, string[]> = { ...(rows[0].reactions || {}) };
  const users = new Set(Array.isArray(reactions[emoji]) ? reactions[emoji] : []);
  if (users.has(userId)) users.delete(userId);
  else users.add(userId);
  if (users.size === 0) delete reactions[emoji];
  else reactions[emoji] = Array.from(users);

  const updatedRows: any[] = await sql`
    UPDATE chat_messages
    SET reactions = ${JSON.stringify(reactions)}::jsonb
    WHERE id = ${messageId}
    RETURNING *
  `;
  return mapChatMessageRow(updatedRows[0]);
}

export async function editEncryptedChatMessage(params: {
  userId: string;
  friendId: string;
  messageId: string;
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  alg?: string;
}): Promise<EncryptedChatMessageRecord | null> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(params.userId, params.friendId);
  const rows: any[] = await sql`
    UPDATE chat_messages
    SET
      ciphertext = ${params.ciphertext},
      nonce = ${params.nonce},
      sender_public_key = ${params.senderPublicKey},
      recipient_public_key = ${params.recipientPublicKey},
      alg = ${params.alg || 'x25519-xsalsa20-poly1305'},
      edited_at = NOW()
    WHERE id = ${params.messageId}
      AND pair_key = ${pk}
      AND sender_id = ${params.userId}
    RETURNING *
  `;
  return rows[0] ? mapChatMessageRow(rows[0]) : null;
}

export async function deleteEncryptedChatMessage(
  userId: string,
  friendId: string,
  messageId: string
): Promise<boolean> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(userId, friendId);
  const rows: any[] = await sql`
    DELETE FROM chat_messages
    WHERE id = ${messageId}
      AND pair_key = ${pk}
      AND sender_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export interface SharedChatThemeRecord {
  themeId: string;
  wallpaperId: string;
  customUri?: string | null;
  updatedAt?: string;
}

export async function getChatPairTheme(
  userId: string,
  friendId: string
): Promise<SharedChatThemeRecord> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(userId, friendId);
  const rows: any[] = await sql`
    SELECT theme_id, wallpaper_id, custom_uri, updated_at
    FROM chat_pair_themes
    WHERE pair_key = ${pk}
    LIMIT 1
  `;
  if (!rows[0]) {
    return { themeId: 'monochrome', wallpaperId: 'none', customUri: null };
  }
  return {
    themeId: String(rows[0].theme_id || 'monochrome'),
    wallpaperId: String(rows[0].wallpaper_id || 'none'),
    customUri: rows[0].custom_uri ? String(rows[0].custom_uri) : null,
    updatedAt: rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : undefined,
  };
}

export async function saveChatPairTheme(
  userId: string,
  friendId: string,
  params: { themeId: string; wallpaperId: string; customUri?: string | null }
): Promise<SharedChatThemeRecord> {
  await ensureSchema();
  const sql = getSql();
  const pk = pairKeyFor(userId, friendId);
  const cleanTheme = String(params.themeId || 'monochrome').slice(0, 32);
  const cleanWallpaper = String(params.wallpaperId || 'none').slice(0, 32);
  const cleanCustom =
    params.customUri && String(params.customUri).length <= 800_000
      ? String(params.customUri)
      : null;

  const rows: any[] = await sql`
    INSERT INTO chat_pair_themes (pair_key, theme_id, wallpaper_id, custom_uri, updated_by, updated_at)
    VALUES (${pk}, ${cleanTheme}, ${cleanWallpaper}, ${cleanCustom}, ${userId}, NOW())
    ON CONFLICT (pair_key) DO UPDATE SET
      theme_id = EXCLUDED.theme_id,
      wallpaper_id = EXCLUDED.wallpaper_id,
      custom_uri = EXCLUDED.custom_uri,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
    RETURNING theme_id, wallpaper_id, custom_uri, updated_at
  `;
  const r = rows[0];
  return {
    themeId: String(r.theme_id || 'monochrome'),
    wallpaperId: String(r.wallpaper_id || 'none'),
    customUri: r.custom_uri ? String(r.custom_uri) : null,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

export async function saveUserPushToken(
  userId: string,
  token: string,
  platform = 'ios'
): Promise<void> {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return;
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO push_tokens (user_id, token, platform, updated_at)
    VALUES (${userId}, ${cleanToken}, ${platform === 'android' ? 'android' : 'ios'}, NOW())
    ON CONFLICT (user_id, token) DO UPDATE SET
      platform = EXCLUDED.platform,
      updated_at = NOW()
  `;
}

export async function sendPushNotificationToUser(params: {
  recipientUserId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows: any[] = await sql`
      SELECT token FROM push_tokens WHERE user_id = ${params.recipientUserId}
    `;
    if (rows.length === 0) return;

    const tokens = rows.map((r) => String(r.token)).filter(Boolean);
    if (tokens.length === 0) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: params.title,
      body: params.body,
      data: params.data || {},
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const json: any = await res.json().catch(() => null);
    const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
    const staleTokens: string[] = [];
    tickets.forEach((ticket, idx) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered' && tokens[idx]) {
        staleTokens.push(tokens[idx]);
      }
    });
    if (staleTokens.length > 0) {
      await sql`
        DELETE FROM push_tokens
        WHERE user_id = ${params.recipientUserId} AND token = ANY(${staleTokens}::text[])
      `;
    }
  } catch {
    // Non-fatal: remote push delivery never blocks messaging
  }
}
