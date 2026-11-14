import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types/workout';
import { getAppSettings } from './settings';

// Storage keys
const WEIGHT_NOTIF_STORAGE_KEY = '@iron_routine_daily_weight_notif_enabled';
const CREATINE_NOTIF_STORAGE_KEY = '@iron_routine_creatine_notif_enabled';
const CREATINE_TAKEN_KEY_PREFIX = '@iron_routine_creatine_taken_';

// Notification categories
export const CREATINE_CATEGORIES = {
  MORNING: 'creatine-morning',
  EVENING: 'creatine-evening',
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

// Global notification handler for when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure interactive iOS notification categories and buttons.
 * Allows user to answer directly from lockscreen / banner.
 */
export async function setupCreatineNotificationCategories(): Promise<void> {
  try {
    // 09:00 Morning Category: "Wziąłem (5g) ✅" or "Nie jeszcze ⏳"
    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.MORNING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: 'Wziąłem (5g) ✅',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: CREATINE_ACTIONS.NOT_YET,
        buttonTitle: 'Nie jeszcze ⏳',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    // 22:00 Evening Category: "Wziąłem (5g) ✅" or "Dziś pomijam ❌"
    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.EVENING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: 'Wziąłem (5g) ✅',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: CREATINE_ACTIONS.SKIP,
        buttonTitle: 'Dziś pomijam ❌',
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

// ==================== CREATINE STATUS STORAGE ====================

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
    console.warn('Error saving creatine status:', e);
  }
}

// ==================== CREATINE NOTIFICATION SCHEDULING ====================

export async function isCreatineReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(CREATINE_NOTIF_STORAGE_KEY);
    // Enabled by default unless explicitly turned off
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

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.CREATINE_EVENING,
      content: {
        title: 'Kreatyna przed snem 🌙',
        body: 'Pamiętaj o dzisiejszej dawce kreatyny (5g)! Czy wziąłeś?',
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
    console.warn('Error scheduling evening creatine reminder', e);
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

    // Cancel old ones first
    await cancelAllCreatineReminders();

    // 1. Schedule Morning reminder daily
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIF_IDS.CREATINE_MORNING,
      content: {
        title: 'Kreatyna (5g) 💧',
        body: 'Czy wziąłeś już dzisiaj swoją porcję kreatyny?',
        categoryIdentifier: CREATINE_CATEGORIES.MORNING,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: targetMorning,
        minute: 0,
      },
    });

    // 2. Schedule Evening reminder if not already taken today
    const takenToday = await hasTakenCreatineToday();
    if (!takenToday) {
      await scheduleEveningCreatineReminder(targetEvening);
    }
  } catch (e) {
    console.warn('Error scheduling creatine reminders', e);
  }
}

export async function setCreatineReminderEnabled(enabled: boolean): Promise<boolean> {
  try {
    if (enabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
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
    console.warn('Error setting creatine reminder:', e);
    return false;
  }
}

/**
 * Handle user interacting with notification buttons on lockscreen / banner.
 */
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  try {
    const actionId = response.actionIdentifier;
    const todayStr = new Date().toISOString().slice(0, 10);

    if (actionId === CREATINE_ACTIONS.TAKEN) {
      await setCreatineTakenToday(true);
      // User confirmed taking creatine today -> cancel the 22:00 evening reminder!
      await cancelEveningCreatineReminder();
      console.log(`[Notification] Creatine marked TAKEN for ${todayStr}. Evening 22:00 reminder cancelled.`);
    } else if (actionId === CREATINE_ACTIONS.NOT_YET) {
      await setCreatineTakenToday(false);
      // User answered NOT YET -> ensure evening reminder at 22:00 is active!
      await scheduleEveningCreatineReminder();
      console.log(`[Notification] Creatine NOT YET for ${todayStr}. Evening 22:00 reminder scheduled.`);
    } else if (actionId === CREATINE_ACTIONS.SKIP) {
      await setCreatineTakenToday(false);
      console.log(`[Notification] Creatine SKIPPED for ${todayStr}.`);
    }
  } catch (e) {
    console.warn('Error handling notification response:', e);
  }
}

/**
 * Instant test trigger (3 seconds) to verify custom lockscreen notification buttons on physical iPhone.
 */
export async function sendTestCreatineNotification(): Promise<void> {
  await setupCreatineNotificationCategories();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Kreatyna (5g) 💧',
      body: 'Czy wziąłeś już dzisiaj swoją porcję kreatyny? (Test)',
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
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        await AsyncStorage.setItem(WEIGHT_NOTIF_STORAGE_KEY, 'false');
        return false;
      }

      const settings = await getAppSettings();
      const targetHour = hour ?? settings.weightReminderHour ?? 8;

      await cancelDailyWeightReminder();

      // Schedule daily recurring reminder
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIF_IDS.WEIGHT,
        content: {
          title: 'Poranne ważenie ⚖️',
          body: 'Wejdź na wagę na czczo i zapisz dzisiejszy wynik w Iron Routine.',
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

// ==================== WORKOUT REST TIMER NOTIFICATION ====================

const REST_TIMER_CHANNEL_ID = 'rest_timer_urgent';
const REST_TIMER_NOTIF_ID = 'iron_routine_rest_timer_done';

async function ensureRestTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: 'Koniec przerwy w treningu',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 350, 150, 350, 150, 450],
      enableVibrate: true,
      sound: 'default',
    });
  } catch {}
}

export async function cancelRestFinishedNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REST_TIMER_NOTIF_ID);
  } catch {}
}

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

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await ensureRestTimerChannel();

    await Notifications.scheduleNotificationAsync({
      identifier: REST_TIMER_NOTIF_ID,
      content: {
        title: 'KONIEC PRZERWY — WRACAJ DO SERII!',
        body: nextInfo ? `${exerciseName} • ${nextInfo}` : exerciseName,
        sound: true,
        interruptionLevel: settings.restTimeSensitive ? 'timeSensitive' : 'active',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(2, Math.round(seconds)),
        repeats: false,
        ...(Platform.OS === 'android' ? { channelId: REST_TIMER_CHANNEL_ID } : {}),
      },
    });
  } catch (e) {
    console.warn('Error scheduling rest notification:', e);
  }
}
