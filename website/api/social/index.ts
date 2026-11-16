import crypto from 'crypto';
import { getCloudUser, jsonResponse, verifyCloudToken } from '../_lib/cloudStore.js';
import {
  appendUserActivity,
  claimUserNickname,
  ensureDefaultNicknameForUser,
  getChatMessages,
  getChatReadMeta,
  getNicknameClaim,
  getSocialProfile,
  getUserActivities,
  getUserRelations,
  normalizeNickServer,
  saveChatMessages,
  saveSocialProfile,
  saveUserRelations,
  searchNicknames,
  setChatReadForFriend,
  SocialProfileRecord,
  StoredChatMessage,
  StoredFriendRequest,
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
      // =====================================================
      // GET ENDPOINTS: hub, search, profile, messages
      // =====================================================
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const action = String(url.searchParams.get('action') || 'hub').trim();

        if (action === 'hub') {
          const [myProfileRaw, rel, readMeta] = await Promise.all([
            getSocialProfile(userId),
            getUserRelations(userId),
            getChatReadMeta(userId),
          ]);

          const friendIds = Array.from(new Set(rel.friends));
          const [friendProfiles, chatThreads, friendActivityLists, myActivities] = await Promise.all([
            Promise.all(friendIds.map((fid) => getSocialProfile(fid))),
            Promise.all(friendIds.map((fid) => getChatMessages(userId, fid))),
            Promise.all(friendIds.map((fid) => getUserActivities(fid))),
            getUserActivities(userId),
          ]);

          let totalUnread = 0;
          const friends = friendIds
            .map((fid, idx) => {
              const fp = friendProfiles[idx];
              if (!fp) return null;
              const msgs = chatThreads[idx] || [];
              const lastReadAt = readMeta[fid] || '';
              const unreadCount = msgs.filter(
                (m) => m.senderId === fid && (!lastReadAt || m.createdAt > lastReadAt)
              ).length;
              totalUnread += unreadCount;
              const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : null;
              return {
                friend: {
                  ...fp,
                  cheeredByMe: Array.isArray(fp.cheeredBy) ? fp.cheeredBy.includes(userId) : false,
                },
                lastMessage,
                unreadCount,
              };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => {
              const ta = a.lastMessage?.createdAt || a.friend?.lastActiveAt || '';
              const tb = b.lastMessage?.createdAt || b.friend?.lastActiveAt || '';
              return tb.localeCompare(ta);
            });

          const mergedActivities = [...myActivities, ...friendActivityLists.flat()]
            .filter((item) => {
              if (item.userId === userId) return true;
              const fp = friendProfiles.find((p) => p?.userId === item.userId);
              return fp?.showActivityToFriends !== false;
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 40)
            .map((item) => ({
              id: item.id,
              userId: item.userId,
              nickname: item.nickname,
              displayName: item.displayName,
              avatarColor: item.avatarColor,
              type: item.type,
              title: item.title,
              subtitle: item.subtitle,
              rankTier: item.rankTier,
              createdAt: item.createdAt,
              cheersCount: item.cheeredBy?.length || 0,
              cheeredByMe: Array.isArray(item.cheeredBy) ? item.cheeredBy.includes(userId) : false,
            }));

          return jsonResponse({
            ok: true,
            hub: {
              myProfile: myProfileRaw
                ? {
                    ...myProfileRaw,
                    cheeredByMe: false,
                  }
                : null,
              friends,
              incomingRequests: rel.incomingRequests,
              outgoingRequests: rel.outgoingRequests,
              activities: mergedActivities,
              totalUnread: totalUnread + rel.incomingRequests.length,
            },
          });
        }

        if (action === 'search') {
          const q = String(url.searchParams.get('q') || '').trim();
          const results = await searchNicknames(q, userId);
          return jsonResponse({
            ok: true,
            results: results.map((r) => ({
              profile: r.profile,
              relationStatus: r.relationStatus,
            })),
          });
        }

        if (action === 'messages') {
          const friendId = String(url.searchParams.get('friendId') || '').trim();
          if (!friendId) {
            return jsonResponse({ ok: false, error: 'MISSING_FRIEND_ID' }, 400);
          }
          const rel = await getUserRelations(userId);
          if (!rel.friends.includes(friendId)) {
            return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
          }
          const messages = await getChatMessages(userId, friendId);
          await setChatReadForFriend(userId, friendId);
          return jsonResponse({ ok: true, messages });
        }

        return jsonResponse({ ok: false, error: 'UNKNOWN_SOCIAL_ACTION' }, 400);
      }

      // =====================================================
      // POST ENDPOINTS
      // =====================================================
      if (request.method !== 'POST') {
        return jsonResponse({ ok: false, error: 'Method Not Allowed' }, 405);
      }

      const body: any = await request.json();
      const action = String(body?.action || '').trim();

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
        const snap = body?.profile || {};
        const [existing, cloudUser] = await Promise.all([
          getSocialProfile(userId),
          getCloudUser(userId),
        ]);
        const displayName = String(
          snap.displayName || existing?.displayName || cloudUser?.displayName || 'Athlete'
        ).trim();

        let nickname = existing?.nickname || cloudUser?.nickname || '';
        const reqNick = normalizeNickServer(String(snap.nickname || ''));

        if (reqNick && reqNick !== nickname) {
          const claimRes = await claimUserNickname({
            userId,
            requestedNickname: reqNick,
            displayName,
            enforceCooldown: Boolean(nickname),
          });
          if (claimRes.ok && claimRes.nickname) {
            nickname = claimRes.nickname;
          }
        }

        if (!nickname) {
          nickname = await ensureDefaultNicknameForUser(userId, displayName);
        }

        const nowIso = new Date().toISOString();
        const prevWorkouts = existing?.totalWorkouts || 0;
        const nextWorkouts = Number(snap.totalWorkouts ?? prevWorkouts) || 0;
        const prevRank = existing?.overallRank || 'F';
        const nextRank = String(snap.overallRank || prevRank);

        const nextProfile: SocialProfileRecord = {
          userId,
          nickname,
          displayName,
          avatarColor: snap.avatarColor || existing?.avatarColor || '#10B981',
          gender: snap.gender === 'female' ? 'female' : 'male',
          overallRank: nextRank,
          overallProgressPct: Number(snap.overallProgressPct ?? existing?.overallProgressPct ?? 0),
          balanceScorePct: Number(snap.balanceScorePct ?? existing?.balanceScorePct ?? 100),
          streak: Number(snap.streak ?? existing?.streak ?? 0),
          totalWorkouts: nextWorkouts,
          totalSets: Number(snap.totalSets ?? existing?.totalSets ?? 0),
          weeklyWorkouts: Number(snap.weeklyWorkouts ?? existing?.weeklyWorkouts ?? 0),
          topMuscles: Array.isArray(snap.topMuscles)
            ? snap.topMuscles.slice(0, 3)
            : existing?.topMuscles || [],
          recentPrs: Array.isArray(snap.recentPrs)
            ? snap.recentPrs.slice(0, 3)
            : existing?.recentPrs || [],
          lastWorkoutAt: snap.lastWorkoutAt ?? existing?.lastWorkoutAt ?? null,
          lastActiveAt: nowIso,
          statusNote:
            snap.statusNote !== undefined ? String(snap.statusNote).slice(0, 48) : existing?.statusNote,
          showActivityToFriends:
            snap.showActivityToFriends !== undefined
              ? Boolean(snap.showActivityToFriends)
              : existing?.showActivityToFriends !== false,
          cheersCount: existing?.cheersCount || 0,
          cheeredBy: existing?.cheeredBy || [],
          updatedAt: nowIso,
        };

        await saveSocialProfile(nextProfile);

        // Emit automatic activity milestones when workouts or rank advance
        if (existing && nextWorkouts > prevWorkouts && nextProfile.showActivityToFriends !== false) {
          await appendUserActivity(userId, {
            userId,
            nickname,
            displayName,
            avatarColor: nextProfile.avatarColor,
            type: 'workout',
            title: String(snap.latestWorkoutTitle || 'Workout'),
            subtitle: `${nextProfile.totalSets} sets · ${nextProfile.streak}d streak`,
            rankTier: nextRank,
          });
        }
        if (existing && nextRank !== prevRank && nextRank !== 'F' && nextProfile.showActivityToFriends !== false) {
          await appendUserActivity(userId, {
            userId,
            nickname,
            displayName,
            avatarColor: nextProfile.avatarColor,
            type: 'rank',
            title: `Rank ${nextRank}`,
            subtitle: `${nextProfile.overallProgressPct}%`,
            rankTier: nextRank,
          });
        }

        return jsonResponse({ ok: true, profile: nextProfile });
      }

      if (action === 'send_request') {
        const targetNick = normalizeNickServer(String(body?.targetNickname || ''));
        let targetUserId = String(body?.targetUserId || '').trim();

        if (!targetUserId && targetNick) {
          const claim = await getNicknameClaim(targetNick);
          if (!claim) {
            return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
          }
          targetUserId = claim.userId;
        }

        if (!targetUserId || targetUserId === userId) {
          return jsonResponse({ ok: false, error: 'INVALID_TARGET' }, 400);
        }

        const [myProfile, targetProfile, myRel, targetRel] = await Promise.all([
          getSocialProfile(userId),
          getSocialProfile(targetUserId),
          getUserRelations(userId),
          getUserRelations(targetUserId),
        ]);

        if (!targetProfile) {
          return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
        }

        if (myRel.friends.includes(targetUserId)) {
          return jsonResponse({ ok: false, error: 'ALREADY_FRIENDS' }, 409);
        }

        // If target already requested us -> mutual match, become friends immediately!
        const reverseIncoming = myRel.incomingRequests.find((r) => r.fromUserId === targetUserId);
        if (reverseIncoming) {
          myRel.incomingRequests = myRel.incomingRequests.filter((r) => r.fromUserId !== targetUserId);
          targetRel.outgoingRequests = targetRel.outgoingRequests.filter((r) => r.toUserId !== userId);
          if (!myRel.friends.includes(targetUserId)) myRel.friends.push(targetUserId);
          if (!targetRel.friends.includes(userId)) targetRel.friends.push(userId);
          await Promise.all([
            saveUserRelations(userId, myRel),
            saveUserRelations(targetUserId, targetRel),
          ]);
          return jsonResponse({ ok: true, matched: true });
        }

        if (myRel.outgoingRequests.some((r) => r.toUserId === targetUserId)) {
          return jsonResponse({ ok: false, error: 'ALREADY_REQUESTED' }, 409);
        }

        const cloudMe = !myProfile ? await getCloudUser(userId) : null;
        const myNick =
          myProfile?.nickname ||
          cloudMe?.nickname ||
          (await ensureDefaultNicknameForUser(userId, cloudMe?.displayName || 'Athlete'));
        const myDisplay = myProfile?.displayName || cloudMe?.displayName || myNick;

        const reqRecord: StoredFriendRequest = {
          id: `fr_${crypto.randomBytes(8).toString('hex')}`,
          fromUserId: userId,
          fromNickname: myNick,
          fromDisplayName: myDisplay,
          fromRank: myProfile?.overallRank || 'F',
          fromAvatarColor: myProfile?.avatarColor || '#10B981',
          toUserId: targetUserId,
          toNickname: targetProfile.nickname,
          toDisplayName: targetProfile.displayName,
          createdAt: new Date().toISOString(),
        };

        myRel.outgoingRequests.unshift(reqRecord);
        targetRel.incomingRequests.unshift(reqRecord);

        await Promise.all([
          saveUserRelations(userId, myRel),
          saveUserRelations(targetUserId, targetRel),
        ]);

        return jsonResponse({ ok: true, request: reqRecord });
      }

      if (action === 'respond_request') {
        const targetUserId = String(body?.targetUserId || '').trim();
        const decision = String(body?.decision || '').trim(); // 'accept' | 'decline' | 'cancel'
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }

        const [myRel, targetRel] = await Promise.all([
          getUserRelations(userId),
          getUserRelations(targetUserId),
        ]);

        if (decision === 'cancel') {
          myRel.outgoingRequests = myRel.outgoingRequests.filter((r) => r.toUserId !== targetUserId);
          targetRel.incomingRequests = targetRel.incomingRequests.filter(
            (r) => r.fromUserId !== userId
          );
          await Promise.all([
            saveUserRelations(userId, myRel),
            saveUserRelations(targetUserId, targetRel),
          ]);
          return jsonResponse({ ok: true });
        }

        myRel.incomingRequests = myRel.incomingRequests.filter((r) => r.fromUserId !== targetUserId);
        targetRel.outgoingRequests = targetRel.outgoingRequests.filter((r) => r.toUserId !== userId);

        if (decision === 'accept') {
          if (!myRel.friends.includes(targetUserId)) myRel.friends.push(targetUserId);
          if (!targetRel.friends.includes(userId)) targetRel.friends.push(userId);
        }

        await Promise.all([
          saveUserRelations(userId, myRel),
          saveUserRelations(targetUserId, targetRel),
        ]);

        return jsonResponse({ ok: true, accepted: decision === 'accept' });
      }

      if (action === 'remove_friend') {
        const targetUserId = String(body?.targetUserId || '').trim();
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }
        const [myRel, targetRel] = await Promise.all([
          getUserRelations(userId),
          getUserRelations(targetUserId),
        ]);
        myRel.friends = myRel.friends.filter((id) => id !== targetUserId);
        targetRel.friends = targetRel.friends.filter((id) => id !== userId);
        await Promise.all([
          saveUserRelations(userId, myRel),
          saveUserRelations(targetUserId, targetRel),
        ]);
        return jsonResponse({ ok: true });
      }

      if (action === 'send_cheer') {
        const targetUserId = String(body?.targetUserId || '').trim();
        const activityId = body?.activityId ? String(body.activityId) : null;
        if (!targetUserId) {
          return jsonResponse({ ok: false, error: 'MISSING_TARGET' }, 400);
        }

        if (activityId) {
          const acts = await getUserActivities(targetUserId);
          const idx = acts.findIndex((a) => a.id === activityId);
          if (idx >= 0) {
            const set = new Set(acts[idx].cheeredBy || []);
            if (set.has(userId)) set.delete(userId);
            else set.add(userId);
            acts[idx].cheeredBy = Array.from(set);
            const { writePrivateDocument } = await import('../_lib/cloudStore.js');
            await writePrivateDocument(`nosql/social/activities/${targetUserId}.json`, JSON.stringify(acts));
            return jsonResponse({ ok: true, cheersCount: acts[idx].cheeredBy.length });
          }
        }

        const targetProfile = await getSocialProfile(targetUserId);
        if (!targetProfile) {
          return jsonResponse({ ok: false, error: 'USER_NOT_FOUND' }, 404);
        }
        const cheeredSet = new Set(targetProfile.cheeredBy || []);
        cheeredSet.add(userId);
        targetProfile.cheeredBy = Array.from(cheeredSet);
        targetProfile.cheersCount = (targetProfile.cheersCount || 0) + 1;
        await saveSocialProfile(targetProfile);

        return jsonResponse({ ok: true, cheersCount: targetProfile.cheersCount });
      }

      if (action === 'send_message') {
        const friendId = String(body?.friendId || '').trim();
        const msgType = (['text', 'cheer', 'workout_share', 'rank_card'].includes(body?.type)
          ? body.type
          : 'text') as StoredChatMessage['type'];
        const text = String(body?.text || '').trim().slice(0, 1200);
        if (!friendId || (!text && msgType === 'text')) {
          return jsonResponse({ ok: false, error: 'INVALID_MESSAGE' }, 400);
        }

        const rel = await getUserRelations(userId);
        if (!rel.friends.includes(friendId)) {
          return jsonResponse({ ok: false, error: 'NOT_FRIENDS' }, 403);
        }

        const existing = await getChatMessages(userId, friendId);
        const nowIso = new Date().toISOString();
        const message: StoredChatMessage = {
          id: `msg_${crypto.randomBytes(8).toString('hex')}`,
          senderId: userId,
          recipientId: friendId,
          type: msgType,
          text,
          payload: body?.payload && typeof body.payload === 'object' ? body.payload : undefined,
          createdAt: nowIso,
          reactions: {},
        };

        await Promise.all([
          saveChatMessages(userId, friendId, [...existing, message]),
          setChatReadForFriend(userId, friendId),
        ]);

        return jsonResponse({ ok: true, message });
      }

      if (action === 'react_message') {
        const friendId = String(body?.friendId || '').trim();
        const messageId = String(body?.messageId || '').trim();
        const emoji = String(body?.emoji || '').trim().slice(0, 8);
        if (!friendId || !messageId || !emoji) {
          return jsonResponse({ ok: false, error: 'INVALID_REACTION' }, 400);
        }
        const msgs = await getChatMessages(userId, friendId);
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx === -1) {
          return jsonResponse({ ok: false, error: 'MESSAGE_NOT_FOUND' }, 404);
        }
        const reactions = { ...(msgs[idx].reactions || {}) };
        const users = new Set(reactions[emoji] || []);
        if (users.has(userId)) users.delete(userId);
        else users.add(userId);
        if (users.size === 0) delete reactions[emoji];
        else reactions[emoji] = Array.from(users);
        msgs[idx] = { ...msgs[idx], reactions };
        await saveChatMessages(userId, friendId, msgs);
        return jsonResponse({ ok: true, message: msgs[idx] });
      }

      if (action === 'mark_read') {
        const friendId = String(body?.friendId || '').trim();
        if (friendId) {
          await setChatReadForFriend(userId, friendId);
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
