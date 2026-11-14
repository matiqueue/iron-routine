import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types/workout';
import { buildActiveSupplementsSummary, formatSupplementDose } from '../data/supplements';
import { getAppSettings } from './settings';
import { getActiveProfile } from './storage';

// Storage keys
const WEIGHT_NOTIF_STORAGE_KEY = '@iron_routine_daily_weight_notif_enabled';
const CREATINE_NOTIF_STORAGE_KEY = '@iron_routine_creatine_notif_enabled';
const CREATINE_TAKEN_KEY_PREFIX = '@iron_routine_creatine_taken_';

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
 * Allows confirming supplement intake directly from Lock Screen without opening app.
 */
export async function setupCreatineNotificationCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.MORNING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: 'Wziąłem porcję ✅',
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: CREATINE_ACTIONS.NOT_YET,
        buttonTitle: 'Przypomnij wieczorem ⏳',
        options: {
          opensAppToForeground: false,
        },
      },
    ]);

    await Notifications.setNotificationCategoryAsync(CREATINE_CATEGORIES.EVENING, [
      {
        identifier: CREATINE_ACTIONS.TAKEN,
        buttonTitle: 'Wziąłem porcję ✅',
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

async function getDynamicSupplementCopy(settings?: AppSettings): Promise<{
  title: string;
  body: string;
  eveningBody: string;
}> {
  const [resolvedSettings, profile] = await Promise.all([
    settings ? Promise.resolve(settings) : getAppSettings(),
    getActiveProfile().catch(() => null),
  ]);

  const activeSupps = (resolvedSettings.supplements || []).filter((s) => s.enabled);
  const weightKg = profile?.weight;

  if (activeSupps.length === 0) {
    return {
      title: 'Suplementacja 💧',
      body: 'Pamiętaj o dzisiejszym nawodnieniu i witaminach.',
      eveningBody: 'Sprawdź dzisiejszą listę suplementów przed snem.',
    };
  }

  if (activeSupps.length === 1) {
    const primary = activeSupps[0];
    const doseLabel = formatSupplementDose(primary, weightKg);
    return {
      title: `${primary.name} 💧`,
      body: `Zalecana dawka: ${doseLabel}. Czy wziąłeś już dziś?`,
      eveningBody: `Pamiętaj przed snem: ${primary.name} (${doseLabel}). Czy wzięte?`,
    };
  }

  const summary = buildActiveSupplementsSummary(activeSupps, weightKg);
  return {
    title: `Dzisiejsze suplementy (${activeSupps.length}) 💧`,
    body: `${summary} — czy dzisiejszy zestaw już wzięty?`,
    eveningBody: `Przed snem sprawdź zestaw: ${summary}.`,
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
        title: 'Suplementacja przed snem 🌙',
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
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        await AsyncStorage.setItem(WEIGHT_NOTIF_STORAGE_KEY, 'false');
        return false;
      }

      const settings = await getAppSettings();
      const targetHour = hour ?? settings.weightReminderHour ?? 8;

      await cancelDailyWeightReminder();

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

// ==================== WORKOUT REST TIMER ALARM-STYLE NOTIFICATIONS ====================

const REST_TIMER_CHANNEL_ID = 'rest_timer_alarm_v2';
const REST_TIMER_NOTIF_IDS = [
  'iron_routine_rest_alarm_1',
  'iron_routine_rest_alarm_2',
  'iron_routine_rest_alarm_3',
];

async function ensureRestTimerChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REST_TIMER_CHANNEL_ID, {
      name: 'Alarm końca przerwy',
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

/**
 * Schedules alarm-like multi-wave background alerts (with custom bundled alarm chime
 * + Time Sensitive interruption + Android max vibration pattern) so the user hears
 * and feels the end of rest even when screen is locked or app is backgrounded/closed.
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

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    await ensureRestTimerChannel();

    const baseSeconds = Math.max(2, Math.round(seconds));
    const offsets = settings.restEndMultiBuzz ? [0, 2, 4] : [0];
    const bodyText = nextInfo ? `${exerciseName} • ${nextInfo}` : exerciseName;

    await Promise.all(
      offsets.map((offset, idx) =>
        Notifications.scheduleNotificationAsync({
          identifier: REST_TIMER_NOTIF_IDS[idx],
          content: {
            title: idx === 0 ? '⏰ KONIEC PRZERWY — WRACAJ DO SERII!' : '⏰ CZAS NA SERIĘ!',
            body: bodyText,
            sound: 'rest_alarm.wav',
            interruptionLevel: settings.restTimeSensitive ? 'timeSensitive' : 'active',
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
  } catch (e) {
    console.warn('Error scheduling rest alarm notifications:', e);
  }
}
