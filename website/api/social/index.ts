import crypto from 'crypto';
import { getCloudUser, jsonResponse, verifyCloudToken } from '../_lib/cloudStore.js';
import { ensureSchema, getSql } from '../_lib/db.js';
import {
  areUsersFriends,
  claimUserNickname,
  deleteEncryptedChatMessage,
  editEncryptedChatMessage,
  getChatPairTheme,
  getEncryptedChatMessages,
  getFriendLastReadAt,
  getPairCheerStreak,
  getSocialHubForUser,
  markChatRead,
  normalizeNickServer,
  orderedPair,
  publishSocialProfile,
  registerUserE2eePublicKey,
  saveChatPairTheme,
  saveEncryptedChatMessage,
  saveUserPushToken,
  searchUsersByNickPg,
  sendPushNotificationToUser,
  toggleChatMessageReaction,
} from '../_lib/socialStore.js';

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
      return jsonResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);
    }

    const userId = verified.userId;

    try {
      await ensureSchema();
      const sql = getSql();

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const action = String(url.searchParams.get('action') || 'hub').trim();

        if (action === 'hub') {
          const localDate = url.searchParams.get('localDate');
          const hub = await getSocialHubForUser(userId, localDate);
          return jsonResponse({ ok: true, hub });
        }

        if (action === 'search') {
          const q = String(url.searchParams.get('q') || '').trim();
          const results = await searchUsersByNickPg(q, userId);
          return jsonResponse({ ok: true, results });
        }

        if (action === 'messages') {
          const friendId = String(url.searchParams.get('friendId') || '').trim();
          if (!friendId) {
            return jsonResponse({ ok: false, error: 'MISSING_FRIEND_ID' }, 400);
          }
          const isFriend = await areUsersFriends(userId, friendId);
          if (!isFriend) {
            return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
          }
          const [messages, chatTheme, friendLastReadAt] = await Promise.all([
            getEncryptedChatMessages(userId, friendId),
            getChatPairTheme(userId, friendId),
            getFriendLastReadAt(userId, friendId),
          ]);
          await markChatRead(userId, friendId);
          return jsonResponse({ ok: true, messages, theme: chatTheme, friendLastReadAt });
        }

        return jsonResponse({ ok: false, error: 'UNKNOWN_SOCIAL_ACTION' }, 400);
      }

      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
      }

      const body: any = await request.json();
      const action = String(body?.action || '').trim();

      if (action === 'register_e2ee_key') {
        const ok = await registerUserE2eePublicKey(userId, String(body?.publicKey || ''));
        if (!ok) {
          return jsonResponse({ ok: false, error: 'INVALID_PUBLIC_KEY' }, 400);
        }
        return jsonResponse({ ok: true });
      }

      if (action === 'register_push_token') {
        const pushToken = String(body?.token || '').trim();
        const platform = body?.platform === 'android' ? 'android' : 'ios';
        if (!pushToken) {
          return jsonResponse({ ok: false, error: 'MISSING_PUSH_TOKEN' }, 400);
        }
        await saveUserPushToken(userId, pushToken, platform);
        return jsonResponse({ ok: true });
      }

      if (action === 'claim_nickname') {
        const res = await claimUserNickname({
          userId,
          requestedNickname: String(body?.nickname || ''),
          displayName: body?.displayName ? String(body.displayName).trim() : undefined,
          enforceCooldown: body?.enforceCooldown !== false,
        });
        if (!res.ok) {
          return jsonResponse(res, res.status || 400);
        }
        return jsonResponse(res, 200);
      }

      if (action === 'publish_profile') {
        const profile = await publishSocialProfile({
          userId,
          snap: body?.profile || {},
        });
        return jsonResponse({ ok: true, profile });
      }

      if (action === 'send_request') {
        const targetNick = normalizeNickServer(String(body?.targetNickname || ''));
        let targetUserId = String(body?.targetUserId || '').trim();

        if (!targetUserId && targetNick) {
          const rows: any[] = await sql`
            SELECT user_id FROM users WHERE LOWER(nickname) = LOWER(${targetNick}) LIMIT 1
          `;
          if (!rows[0]) {
            return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
          }
          targetUserId = String(rows[0].user_id);
        }

        if (!targetUserId || targetUserId === userId) {
          return jsonResponse({ ok: false, error: 'INVALID_TARGET' }, 400);
        }

        const targetUser = await getCloudUser(targetUserId);
        if (!targetUser) {
          return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
        }

        if (await areUsersFriends(userId, targetUserId)) {
          return jsonResponse({ ok: false, error: 'ALREADY_FRIENDS' }, 409);
        }

        // Check reverse request for instant mutual friendship
        const reverseRows: any[] = await sql`
          SELECT id FROM friend_requests
          WHERE from_user_id = ${targetUserId} AND to_user_id = ${userId}
          LIMIT 1
        `;
        if (reverseRows.length > 0) {
          const [ua, ub] = orderedPair(userId, targetUserId);
          await sql`
            DELETE FROM friend_requests
            WHERE (from_user_id = ${targetUserId} AND to_user_id = ${userId})
               OR (from_user_id = ${userId} AND to_user_id = ${targetUserId})
          `;
          await sql`
            INSERT INTO friendships (user_a, user_b) VALUES (${ua}, ${ub}) ON CONFLICT DO NOTHING
          `;
          return jsonResponse({ ok: true, matched: true });
        }

        const existingReq: any[] = await sql`
          SELECT id FROM friend_requests
          WHERE from_user_id = ${userId} AND to_user_id = ${targetUserId}
          LIMIT 1
        `;
        if (existingReq.length > 0) {
          return jsonResponse({ ok: false, error: 'ALREADY_REQUESTED' }, 409);
        }

        const reqId = `fr_${crypto.randomBytes(8).toString('hex')}`;
        await sql`
          INSERT INTO friend_requests (id, from_user_id, to_user_id, created_at)
          VALUES (${reqId}, ${userId}, ${targetUserId}, NOW())
        `;
        return jsonResponse({ ok: true, requestId: reqId });
      }

      if (action === 'respond_request') {
        const targetUserId = String(body?.targetUserId || '').trim();
        const decision = String(body?.decision || '').trim();
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }

        if (decision === 'cancel') {
          await sql`
            DELETE FROM friend_requests
            WHERE from_user_id = ${userId} AND to_user_id = ${targetUserId}
          `;
          return jsonResponse({ ok: true });
        }

        await sql`
          DELETE FROM friend_requests
          WHERE from_user_id = ${targetUserId} AND to_user_id = ${userId}
        `;

        if (decision === 'accept') {
          const [ua, ub] = orderedPair(userId, targetUserId);
          await sql`
            INSERT INTO friendships (user_a, user_b) VALUES (${ua}, ${ub}) ON CONFLICT DO NOTHING
          `;
        }
        return jsonResponse({ ok: true, accepted: decision === 'accept' });
      }

      if (action === 'remove_friend') {
        const targetUserId = String(body?.targetUserId || '').trim();
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }
        const [ua, ub] = orderedPair(userId, targetUserId);
        await sql`DELETE FROM friendships WHERE user_a = ${ua} AND user_b = ${ub}`;
        return jsonResponse({ ok: true });
      }

      if (action === 'send_cheer') {
        const targetUserId = String(body?.targetUserId || '').trim();
        const activityId = body?.activityId ? String(body.activityId) : null;
        const count = Math.max(1, Math.min(200, Math.round(Number(body?.count || 1) || 1)));
        const rawLocalDate = typeof body?.localDate === 'string' ? body.localDate.trim() : '';
        const cheerDayKey = /^\d{4}-\d{2}-\d{2}$/.test(rawLocalDate)
          ? rawLocalDate
          : new Date().toISOString().slice(0, 10);
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }

        if (activityId) {
          const rows: any[] = await sql`
            SELECT user_id, cheered_by, cheers_count FROM social_activities WHERE id = ${activityId} LIMIT 1
          `;
          if (rows[0]) {
            const set = new Set<string>(Array.isArray(rows[0].cheered_by) ? rows[0].cheered_by : []);
            set.add(userId);
            const next = Array.from(set);
            const nextCount =
              Math.max(Number(rows[0].cheers_count || 0), set.size - 1) + count;
            await sql`
              UPDATE social_activities
              SET cheered_by = ${JSON.stringify(next)}::jsonb,
                  cheers_count = ${nextCount}
              WHERE id = ${activityId}
            `;
            const recipientId = String(rows[0].user_id || targetUserId);
            let cheerStreakDays = 0;
            let cheeredTodayWithMe = false;
            if (recipientId && recipientId !== userId) {
              const burstId = `cb_${crypto.randomBytes(8).toString('hex')}`;
              await sql`
                INSERT INTO cheer_bursts (id, from_user_id, to_user_id, activity_id, burst_count, day_key)
                VALUES (${burstId}, ${userId}, ${recipientId}, ${activityId}, ${count}, ${cheerDayKey})
              `;
              const st = await getPairCheerStreak(userId, recipientId, cheerDayKey);
              cheerStreakDays = st.streakDays;
              cheeredTodayWithMe = st.cheeredToday;
            }
            return jsonResponse({ ok: true, cheersCount: nextCount, cheerStreakDays, cheeredTodayWithMe });
          }
        }

        const profRows: any[] = await sql`
          SELECT cheered_by, cheers_count FROM athlete_profiles WHERE user_id = ${targetUserId} LIMIT 1
        `;
        if (!profRows[0]) {
          return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
        }
        const cheeredSet = new Set<string>(
          Array.isArray(profRows[0].cheered_by) ? profRows[0].cheered_by : []
        );
        cheeredSet.add(userId);
        const nextCheers = Number(profRows[0].cheers_count || 0) + count;
        await sql`
          UPDATE athlete_profiles
          SET cheered_by = ${JSON.stringify(Array.from(cheeredSet))}::jsonb,
              cheers_count = ${nextCheers}
          WHERE user_id = ${targetUserId}
        `;
        let cheerStreakDays = 0;
        let cheeredTodayWithMe = false;
        if (targetUserId !== userId) {
          const burstId = `cb_${crypto.randomBytes(8).toString('hex')}`;
          await sql`
            INSERT INTO cheer_bursts (id, from_user_id, to_user_id, activity_id, burst_count, day_key)
            VALUES (${burstId}, ${userId}, ${targetUserId}, ${null}, ${count}, ${cheerDayKey})
          `;
          const st = await getPairCheerStreak(userId, targetUserId, cheerDayKey);
          cheerStreakDays = st.streakDays;
          cheeredTodayWithMe = st.cheeredToday;
        }
        return jsonResponse({ ok: true, cheersCount: nextCheers, cheerStreakDays, cheeredTodayWithMe });
      }

      if (action === 'send_message') {
        const friendId = String(body?.friendId || '').trim();
        const ciphertext = String(body?.ciphertext || '').trim();
        const nonce = String(body?.nonce || '').trim();
        const senderPublicKey = String(body?.senderPublicKey || '').trim();
        const recipientPublicKey = String(body?.recipientPublicKey || '').trim();
        const alg = String(body?.alg || 'x25519-xsalsa20-poly1305').trim();

        if (!friendId || !ciphertext || !nonce || !senderPublicKey || !recipientPublicKey) {
          return jsonResponse({ ok: false, error: 'INVALID_ENCRYPTED_PAYLOAD' }, 400);
        }

        if (!(await areUsersFriends(userId, friendId))) {
          return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
        }

        const message = await saveEncryptedChatMessage({
          senderId: userId,
          recipientId: friendId,
          ciphertext,
          nonce,
          senderPublicKey,
          recipientPublicKey,
          alg,
        });

        const silent = Boolean(body?.silent);
        if (!silent) {
          const sender = await getCloudUser(userId).catch(() => null);
          const senderTitle =
            sender?.displayName || (sender?.nickname ? `@${sender.nickname}` : 'Iron Routine');
          await sendPushNotificationToUser({
            recipientUserId: friendId,
            title: senderTitle,
            body: sender?.nickname ? `@${sender.nickname} · nowa wiadomość` : 'Nowa wiadomość',
            data: {
              type: 'chat_message',
              friendId: userId,
              messageId: message.id,
            },
          });
        }

        return jsonResponse({ ok: true, message });
      }

      if (action === 'edit_message') {
        const friendId = String(body?.friendId || '').trim();
        const messageId = String(body?.messageId || '').trim();
        const ciphertext = String(body?.ciphertext || '').trim();
        const nonce = String(body?.nonce || '').trim();
        const senderPublicKey = String(body?.senderPublicKey || '').trim();
        const recipientPublicKey = String(body?.recipientPublicKey || '').trim();
        const alg = String(body?.alg || 'x25519-xsalsa20-poly1305').trim();

        if (!friendId || !messageId || !ciphertext || !nonce || !senderPublicKey || !recipientPublicKey) {
          return jsonResponse({ ok: false, error: 'INVALID_EDIT_PAYLOAD' }, 400);
        }
        if (!(await areUsersFriends(userId, friendId))) {
          return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
        }
        const message = await editEncryptedChatMessage({
          userId,
          friendId,
          messageId,
          ciphertext,
          nonce,
          senderPublicKey,
          recipientPublicKey,
          alg,
        });
        if (!message) {
          return jsonResponse({ ok: false, error: 'MESSAGE_NOT_FOUND_OR_FORBIDDEN' }, 403);
        }
        return jsonResponse({ ok: true, message });
      }

      if (action === 'react_message') {
        const friendId = String(body?.friendId || '').trim();
        const messageId = String(body?.messageId || '').trim();
        const emoji = String(body?.emoji || '').trim().slice(0, 8);
        if (!friendId || !messageId || !emoji) {
          return jsonResponse({ ok: false, error: 'INVALID_REACTION' }, 400);
        }
        const message = await toggleChatMessageReaction(userId, friendId, messageId, emoji);
        if (!message) {
          return jsonResponse({ ok: false, error: 'MESSAGE_NOT_FOUND' }, 404);
        }
        return jsonResponse({ ok: true, message });
      }

      if (action === 'delete_message') {
        const friendId = String(body?.friendId || '').trim();
        const messageId = String(body?.messageId || '').trim();
        if (!friendId || !messageId) {
          return jsonResponse({ ok: false, error: 'INVALID_DELETE_PARAMS' }, 400);
        }
        const deleted = await deleteEncryptedChatMessage(userId, friendId, messageId);
        if (!deleted) {
          return jsonResponse({ ok: false, error: 'MESSAGE_NOT_FOUND' }, 404);
        }
        return jsonResponse({ ok: true, messageId });
      }

      if (action === 'set_chat_theme') {
        const friendId = String(body?.friendId || '').trim();
        if (!friendId || !(await areUsersFriends(userId, friendId))) {
          return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
        }
        const saved = await saveChatPairTheme(userId, friendId, {
          themeId: String(body?.themeId || 'monochrome'),
          wallpaperId: String(body?.wallpaperId || 'none'),
          customUri: body?.customUri ? String(body.customUri) : null,
        });
        return jsonResponse({ ok: true, theme: saved });
      }

      if (action === 'mark_read') {
        const friendId = String(body?.friendId || '').trim();
        if (friendId) {
          await markChatRead(userId, friendId);
        }
        return jsonResponse({ ok: true });
      }

      return jsonResponse({ ok: false, error: 'UNKNOWN_SOCIAL_ACTION' }, 400);
    } catch (error) {
      console.error('Social API error:', error);
      return jsonResponse({ ok: false, error: 'SOCIAL_SERVER_ERROR' }, 500);
    }
  },
};
