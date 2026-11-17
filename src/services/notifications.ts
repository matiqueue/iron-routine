import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, FriendChatThreadSummary } from '../types/workout';
import { buildActiveSupplementsSummary, formatSupplementDose } from '../data/supplements';
import { getAppSettings, getCurrentAppLanguage } from './settings';
import { getActiveProfile } from './storage';
import { getTranslatedSupplement, translateText } from '../i18n/translations';
import { registerPushTokenInCloud } from './social';

// Storage keys
const WEIGHT_NOTIF_STORAGE_KEY = '@iron_routine_daily_weight_notif_enabled';
const CREATINE_NOTIF_STORAGE_KEY = '@iron_routine_creatine_notif_enabled';
const CREATINE_TAKEN_KEY_PREFIX = '@iron_routine_creatine_taken_';

const REST_TIMER_CHANNEL_ID = 'rest_timer_alarm_v2';
const REST_TIMER_NOTIF_IDS = [
  'iron_routine_rest_alarm_1',
  'iron_routine_rest_alarm_2',
  'iron_routine_rest_alarm_3',
];

// Notification categories
export const CREATINE_CATEGORIES = {
  MORNING: 'supplements-morning',
  EVENING: 'supplements-evening',
} as const;

// Action Identifiers
export const CREATINE_ACTIONS = {
  TAKEN: 'CREATINE_ACTION_TAKEN',
  NOT_YET: 'CREATINE_ACTION_NOT_YET',
  SKIP: 'CREATINE_ACTION_SKIP',
} as const;

// Notification Identifiers
export const NOTIF_IDS = {
  WEIGHT: 'iron_routine_daily_weight',
  CREATINE_MORNING: 'iron_routine_creatine_morning',
  CREATINE_EVENING: 'iron_routine_creatine_evening',
} as const;

export interface NotificationPermissionSummary {
  granted: boolean;
  status: Notifications.PermissionStatus;
  canAskAgain: boolean;
  allowsAlert: boolean;
  allowsSound: boolean;
}

export async function getNotificationPermissionSummary(): Promise<NotificationPermissionSummary> {
  try {
    const perms = await Notifications.getPermissionsAsync();
    const allowsAlert = Platform.OS !== 'ios' || perms.ios?.allowsAlert !== false;
    const allowsSound = Platform.OS !== 'ios' || perms.ios?.allowsSound !== false;
    return {
      granted: perms.status === 'granted',
      status: perms.status,
      canAskAgain: perms.canAskAgain ?? true,
      allowsAlert,
      allowsSound,
    };
  } catch {
    return {
      granted: false,
      status: Notifications.PermissionStatus.UNDETERMINED,
      canAskAgain: true,
      allowsAlert: false,
      allowsSound: false,
    };
  }
}

export async function ensureNotificationPermissions(
  promptIfNeeded = true
): Promise<NotificationPermissionSummary> {
  const current = await getNotificationPermissionSummary();
  if (current.granted && current.allowsAlert && current.allowsSound) {
    return current;
  }

  const shouldPrompt =
    current.status === Notifications.PermissionStatus.UNDETERMINED ||
    (promptIfNeeded && current.canAskAgain);

  if (!shouldPrompt) {
    return current;
  }

  try {
    const requested = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    const allowsAlert = Platform.OS !== 'ios' || requested.ios?.allowsAlert !== false;
    const allowsSound = Platform.OS !== 'ios' || requested.ios?.allowsSound !== false;
    return {
      granted: requested.status === 'granted',
      status: requested.status,
      canAskAgain: requested.canAskAgain ?? false,
      allowsAlert,
      allowsSound,
    };
  } catch {
    return current;
  }
}

// Suppress foreground banner/sound for rest timer alarms (user wants haptics/alerts ONLY outside app)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isRestAlarm = REST_TIMER_NOTIF_IDS.includes(notification.request.identifier);
    if (isRestAlarm && AppState.currentState === 'active') {
      return {
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: false,
        shouldShowList: false,
      };
    }
    return {
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Configure interactive iOS notification categories and buttons.
 * Allows confirming supplement intake directly from Lock Screen without opening app.
 */
export async function setupCreatineNotificationCategories(): Promise<void> {
  const lang = getCurrentAppLanguage();
  try {
    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.MORNING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: translateText(lang, 'notifSuppTakenBtn'),
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: CREATINE_ACTIONS.NOT_YET,
        buttonTitle: translateText(lang, 'notifSuppRemindEveningBtn'),
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.EVENING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: translateText(lang, 'notifSuppTakenBtn'),
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: CREATINE_ACTIONS.SKIP,
        buttonTitle: translateText(lang, 'notifSuppSkipBtn'),
        options: {
          opensAppToForeground: false,
          isDestructive: true,
        },
      },
    ]);
  } catch (e) {
    console.warn('Failed to set up notification categories:', e);
  }
}

async function getDynamicSupplementCopy(settings?: AppSettings): Promise<{
  title: string;
  body: string;
  eveningBody: string;
}> {
  const resolvedSettings = settings || (await getAppSettings());
  const lang = resolvedSettings.language || getCurrentAppLanguage();
  const profile = await getActiveProfile().catch(() => null);

  const activeSupps = (resolvedSettings.supplements || []).filter((s) => s.enabled);
  const weightKg = profile?.weight;

  if (activeSupps.length === 0) {
    return {
      title: translateText(lang, 'notifSuppGenericTitle'),
      body: translateText(lang, 'notifSuppGenericBody'),
      eveningBody: translateText(lang, 'notifSuppGenericEvening'),
    };
  }

  if (activeSupps.length === 1) {
    const primary = activeSupps[0];
    const primaryName = getTranslatedSupplement(primary.id, 'name', primary.name, lang);
    const doseLabel = formatSupplementDose(primary, weightKg);
    return {
      title: `${primaryName} 💧`,
      body: translateText(lang, 'notifSuppSingleBody', { dose: doseLabel }),
      eveningBody: translateText(lang, 'notifSuppSingleEvening', {
        name: primaryName,
        dose: doseLabel,
      }),
    };
  }

  const summary = buildActiveSupplementsSummary(activeSupps, weightKg);
  return {
    title: translateText(lang, 'notifSuppMultiTitle', { count: activeSupps.length }),
    body: translateText(lang, 'notifSuppMultiBody', { summary }),
    eveningBody: translateText(lang, 'notifSuppMultiEvening', { summary }),
  };
}

// ==================== SUPPLEMENT STATUS STORAGE ====================

export async function hasTakenCreatineToday(): Promise<boolean> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const val = await AsyncStorage.getItem(`${CREATINE_TAKEN_KEY_PREFIX}${todayStr}`);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setCreatineTakenToday(taken: boolean): Promise<void> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    await AsyncStorage.setItem(`${CREATINE_TAKEN_KEY_PREFIX}${todayStr}`, taken ? 'true' : 'false');
  } catch (e) {
    console.warn('Error saving supplement status:', e);
  }
}

// ==================== SUPPLEMENT NOTIFICATION SCHEDULING ====================

export async function isCreatineReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(CREATINE_NOTIF_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export async function scheduleEveningCreatineReminder(hour?: number): Promise<void> {
  try {
    await cancelEveningCreatineReminder();
    const settings = await getAppSettings();
    const targetHour = hour ?? settings.creatineEveningHour ?? 22;
    const copy = await getDynamicSupplementCopy(settings);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.CREATINE_EVENING,
      content: {
        title: translateText(getCurrentAppLanguage(), 'notifSuppEveningTitle'),
        body: copy.eveningBody,
        categoryIdentifier: CREATINE_CATEGORIES.EVENING,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: targetHour,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('Error scheduling evening supplement reminder', e);
  }
}

export async function cancelEveningCreatineReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.CREATINE_EVENING);
  } catch {}
}

export async function cancelAllCreatineReminders(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.CREATINE_MORNING);
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.CREATINE_EVENING);
  } catch {}
}

export async function scheduleCreatineReminders(
  morningHour?: number,
  eveningHour?: number
): Promise<void> {
  try {
    await setupCreatineNotificationCategories();
    const settings = await getAppSettings();
    const targetMorning = morningHour ?? settings.creatineMorningHour ?? 9;
    const targetEvening = eveningHour ?? settings.creatineEveningHour ?? 22;
    const copy = await getDynamicSupplementCopy(settings);

    await cancelAllCreatineReminders();

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.CREATINE_MORNING,
      content: {
        title: copy.title,
        body: copy.body,
        categoryIdentifier: CREATINE_CATEGORIES.MORNING,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: targetMorning,
        minute: 0,
      },
    });

    const takenToday = await hasTakenCreatineToday();
    if (!takenToday) {
      await scheduleEveningCreatineReminder(targetEvening);
    }
  } catch (e) {
    console.warn('Error scheduling supplement reminders', e);
  }
}

export async function setCreatineReminderEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      const perm = await ensureNotificationPermissions(true);
      if (!perm.granted) {
        await AsyncStorage.setItem(CREATINE_NOTIF_STORAGE_KEY, 'false');
        return false;
      }
      await AsyncStorage.setItem(CREATINE_NOTIF_STORAGE_KEY, 'true');
      await scheduleCreatineReminders();
      return true;
    } else {
      await cancelAllCreatineReminders();
      await AsyncStorage.setItem(CREATINE_NOTIF_STORAGE_KEY, 'false');
      return false;
    }
  } catch (e) {
    console.warn('Error setting supplement reminder:', e);
    return false;
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  try {
    const actionId = response.actionIdentifier;

    if (actionId === CREATINE_ACTIONS.TAKEN) {
      await setCreatineTakenToday(true);
      await cancelEveningCreatineReminder();
    } else if (actionId === CREATINE_ACTIONS.NOT_YET) {
      await setCreatineTakenToday(false);
      await scheduleEveningCreatineReminder();
    } else if (actionId === CREATINE_ACTIONS.SKIP) {
      await setCreatineTakenToday(false);
    }
  } catch (e) {
    console.warn('Error handling notification response:', e);
  }
}

export async function sendTestCreatineNotification(): Promise<void> {
  await setupCreatineNotificationCategories();
  const copy = await getDynamicSupplementCopy();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: `${copy.body} (Test)`,
      categoryIdentifier: CREATINE_CATEGORIES.MORNING,
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      repeats: false,
    },
  });
}

// ==================== DAILY WEIGHT REMINDER ====================

export async function isDailyWeightReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(WEIGHT_NOTIF_STORAGE_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setDailyWeightReminder(enabled: boolean, hour?: number): Promise<boolean> {
  try {
    if (enabled) {
      const perm = await ensureNotificationPermissions(true);
      if (!perm.granted) {
        await AsyncStorage.setItem(WEIGHT_NOTIF_STORAGE_KEY, 'false');
        return false;
      }

      const settings = await getAppSettings();
      const targetHour = hour ?? settings.weightReminderHour ?? 8;

      await cancelDailyWeightReminder();

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_IDS.WEIGHT,
        content: {
          title: translateText(getCurrentAppLanguage(), 'notifWeightTitle'),
          body: translateText(getCurrentAppLanguage(), 'notifWeightBody'),
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: targetHour,
          minute: 0,
        },
      });

      await AsyncStorage.setItem(WEIGHT_NOTIF_STORAGE_KEY, 'true');
      return true;
    } else {
      await cancelDailyWeightReminder();
      await AsyncStorage.setItem(WEIGHT_NOTIF_STORAGE_KEY, 'false');
      return false;
    }
  } catch (e) {
    console.warn('Error setting daily weight reminder', e);
    return false;
  }
}

export async function cancelDailyWeightReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIF_IDS.WEIGHT);
  } catch {}
}

export async function syncRemindersWithSettings(settings: AppSettings): Promise<void> {
  try {
    await setCreatineReminderEnabled(settings.creatineRemindersEnabled);
    await setDailyWeightReminder(settings.weightReminderEnabled, settings.weightReminderHour);
  } catch (e) {
    console.warn('Failed to sync notifications with settings:', e);
  }
}

// ==================== WORKOUT REST TIMER ALARM-STYLE NOTIFICATIONS ====================

async function ensureRestTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: translateText(getCurrentAppLanguage(), 'notifRestChannelName'),
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 550, 150, 550, 150, 650],
      enableVibrate: true,
      sound: 'rest_alarm.wav',
      bypassDnd: true,
    });
  } catch {}
}

export async function cancelRestFinishedNotification(): Promise<void> {
  await Promise.all(
    REST_TIMER_NOTIF_IDS.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {}
      try {
        await Notifications.dismissNotificationAsync(id);
      } catch {}
    })
  );
}

async function dispatchRestWave(
  seconds: number,
  exerciseName: string,
  nextInfo: string | undefined,
  multiBuzz: boolean
): Promise<boolean> {
  const baseSeconds = Math.max(2, Math.round(seconds));
  const offsets = multiBuzz ? [0, 2, 4] : [0];
  const bodyText = nextInfo ? `${exerciseName} • ${nextInfo}` : exerciseName;

  const scheduleWithSound = async (soundName: 'rest_alarm.wav' | 'default') => {
    const lang = getCurrentAppLanguage();
    await Promise.all(
      offsets.map((offset, idx) =>
        Notifications.scheduleNotificationAsync({
          identifier: REST_TIMER_NOTIF_IDS[idx],
          content: {
            title:
              idx === 0
                ? translateText(lang, 'notifRestTitleFirst')
                : translateText(lang, 'notifRestTitleFollow'),
            body: bodyText,
            sound: soundName,
            // Always use standard 'active' interruptionLevel: Personal Team iOS builds lack
            // com.apple.developer.usernotifications.time-sensitive and may drop timeSensitive alerts.
            interruptionLevel: 'active',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: baseSeconds + offset,
            repeats: false,
            ...(Platform.OS === 'android' ? { channelId: REST_TIMER_CHANNEL_ID } : {}),
          },
        })
      )
    );
  };

  try {
    await scheduleWithSound('rest_alarm.wav');
    return true;
  } catch (err) {
    console.warn('Custom rest sound failed, retrying with system default sound:', err);
    try {
      await scheduleWithSound('default');
      return true;
    } catch (fallbackErr) {
      console.warn('Error scheduling rest alarm notifications:', fallbackErr);
      return false;
    }
  }
}

/**
 * Schedules alarm-style multi-wave background notifications (bundled WAV sound + native iOS
 * notification vibration / Android max vibration) so the alert fires outside the app.
 */
export async function scheduleRestFinishedNotification(
  seconds: number,
  exerciseName: string,
  nextInfo?: string
): Promise<void> {
  try {
    await cancelRestFinishedNotification();
    if (seconds <= 1) return;

    const settings = await getAppSettings();
    if (!settings.restNotificationsEnabled) return;

    const perm = await ensureNotificationPermissions(false);
    if (!perm.granted) return;

    await ensureRestTimerChannel();
    await dispatchRestWave(seconds, exerciseName, nextInfo, settings.restEndMultiBuzz);
  } catch (e) {
    console.warn('Error scheduling rest alarm notifications:', e);
  }
}

/**
 * Schedules a 5-second background alarm test so the user can lock the screen or switch apps
 * and verify native OS lockscreen vibration + alarm delivery.
 */
const CHAT_NOTIF_CHANNEL_ID = 'chat_messages_v1';
const NOTIFIED_CHAT_IDS_KEY = '@iron_routine:notified_chat_msg_ids_v1';
let notifiedChatIdsCache: Set<string> | null = null;
let notifiedChatIdsOrder: string[] = [];

async function getNotifiedChatIds(): Promise<Set<string>> {
  if (notifiedChatIdsCache) return notifiedChatIdsCache;
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_CHAT_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      notifiedChatIdsOrder = parsed.map(String).slice(-80);
      notifiedChatIdsCache = new Set(notifiedChatIdsOrder);
      return notifiedChatIdsCache;
    }
  } catch {}
  notifiedChatIdsOrder = [];
  notifiedChatIdsCache = new Set();
  return notifiedChatIdsCache;
}

async function markChatIdsNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const set = await getNotifiedChatIds();
  let changed = false;
  for (const id of ids) {
    if (!set.has(id)) {
      set.add(id);
      notifiedChatIdsOrder.push(id);
      changed = true;
    }
  }
  if (!changed) return;
  if (notifiedChatIdsOrder.length > 80) {
    notifiedChatIdsOrder = notifiedChatIdsOrder.slice(-80);
    notifiedChatIdsCache = new Set(notifiedChatIdsOrder);
  }
  try {
    await AsyncStorage.setItem(NOTIFIED_CHAT_IDS_KEY, JSON.stringify(notifiedChatIdsOrder));
  } catch {}
}

async function ensureChatMessagesChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHAT_NOTIF_CHANNEL_ID, {
      name: translateText(getCurrentAppLanguage(), 'notifChatChannelName'),
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      sound: 'default',
    });
  } catch {}
}

export async function syncAppIconBadgeCount(unreadCount: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, Math.round(unreadCount || 0)));
  } catch {}
}

export async function registerExpoPushTokenIfSupported(): Promise<void> {
  try {
    const appCfg = require('../../app.json');
    const projectId = appCfg?.expo?.extra?.eas?.projectId;
    const remoteEnabled =
      Platform.OS === 'android' ||
      appCfg?.expo?.plugins?.some(
        (p: any) => Array.isArray(p) && p[0] === 'expo-notifications' && p[1]?.enableRemoteNotifications === true
      );
    if (!projectId || !remoteEnabled) return;

    const perm = await ensureNotificationPermissions(false);
    if (!perm.granted) return;

    await ensureChatMessagesChannel();
    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    if (tokenRes?.data) {
      await registerPushTokenInCloud(
        tokenRes.data,
        Platform.OS === 'android' ? 'android' : 'ios'
      );
    }
  } catch {
    // Expected on Personal Team iOS builds without aps-environment
  }
}

export async function dismissChatNotificationsForFriend(friendId: string): Promise<void> {
  if (!friendId) return;
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((item) => item.request.content.data?.friendId === friendId)
        .map((item) =>
          Notifications.dismissNotificationAsync(item.request.identifier).catch(() => {})
        )
    );
  } catch {}
}

export async function notifyIncomingChatMessages(
  threads: FriendChatThreadSummary[],
  myUserId: string,
  openChatFriendId?: string | null
): Promise<void> {
  if (!threads || threads.length === 0 || !myUserId) return;
  try {
    const perm = await ensureNotificationPermissions(false);
    if (!perm.granted) return;

    const seenSet = await getNotifiedChatIds();
    const lang = getCurrentAppLanguage();
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    const newlyNotified: string[] = [];

    await ensureChatMessagesChannel();

    for (const thread of threads) {
      const msg = thread.lastMessage;
      if (!msg || !msg.id) continue;
      if ((thread.unreadCount || 0) <= 0) continue;
      if (msg.senderId === myUserId) continue;
      if (openChatFriendId && thread.friend.userId === openChatFriendId) {
        newlyNotified.push(msg.id);
        continue;
      }
      if (seenSet.has(msg.id)) continue;

      const createdMs = new Date(msg.createdAt).getTime();
      if (!isNaN(createdMs) && createdMs < cutoffMs) {
        newlyNotified.push(msg.id);
        continue;
      }

      let bodyPreview = translateText(lang, 'notifChatNewMessage');
      if (msg.type === 'voice') {
        bodyPreview = translateText(lang, 'notifChatVoiceMessage');
      } else if (msg.type === 'workout_share') {
        bodyPreview = msg.payload?.title
          ? `🏋️ ${msg.payload.title}`
          : translateText(lang, 'notifChatWorkoutCard');
      } else if (msg.type === 'rank_card') {
        bodyPreview = translateText(lang, 'notifChatRankCard');
      } else if (msg.type === 'cheer') {
        bodyPreview = msg.payload?.emoji || '🙌';
      } else if (!msg.decryptFailed && msg.text?.trim()) {
        bodyPreview = msg.text.trim().slice(0, 140);
      }

      const senderTitle =
        thread.friend.displayName ||
        (thread.friend.nickname ? `@${thread.friend.nickname}` : 'Iron Routine');
      const senderSubtitle =
        thread.friend.nickname && thread.friend.displayName
          ? `@${thread.friend.nickname}`
          : undefined;

      await Notifications.scheduleNotificationAsync({
        identifier: `chat_msg_${msg.id}`,
        content: {
          title: senderTitle,
          subtitle: senderSubtitle,
          body: bodyPreview,
          sound: 'default',
          interruptionLevel: 'active',
          data: {
            type: 'chat_message',
            friendId: thread.friend.userId,
            messageId: msg.id,
          },
          ...(Platform.OS === 'android' ? { channelId: CHAT_NOTIF_CHANNEL_ID } : {}),
        } as Notifications.NotificationContentInput,
        trigger: null,
      });

      newlyNotified.push(msg.id);
    }

    if (newlyNotified.length > 0) {
      await markChatIdsNotified(newlyNotified);
    }
  } catch (e) {
    console.warn('Error delivering chat message notification:', e);
  }
}

export async function scheduleTestRestNotification(): Promise<NotificationPermissionSummary & { scheduled: boolean }> {
  const perm = await ensureNotificationPermissions(true);
  if (!perm.granted) {
    return { ...perm, scheduled: false };
  }
  const settings = await getAppSettings();
  await cancelRestFinishedNotification();
  await ensureRestTimerChannel();
  const lang = getCurrentAppLanguage();
  const scheduled = await dispatchRestWave(
    5,
    translateText(lang, 'notifTestRestTitle'),
    translateText(lang, 'notifTestRestSub'),
    settings.restEndMultiBuzz
  );
  return { ...perm, scheduled };
}
