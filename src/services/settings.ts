import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types/workout';
import { DEFAULT_SUPPLEMENTS, mergeWithDefaultSupplements } from '../data/supplements';

const SETTINGS_STORAGE_KEY = '@iron_routine_app_settings';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  hapticsEnabled: true,
  hapticsIntensity: 'strong',
  restEndMultiBuzz: true,
  restNotificationsEnabled: true,
  restTimeSensitive: true,
  creatineRemindersEnabled: true,
  creatineMorningHour: 9,
  creatineEveningHour: 22,
  weightReminderEnabled: true,
  weightReminderHour: 8,
  defaultRestSeconds: 120,
  supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
  healthSyncEnabled: false,
};

let cachedSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
};

export function getCachedAppSettings(): AppSettings {
  return cachedSettings;
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      cachedSettings = {
        ...DEFAULT_APP_SETTINGS,
        supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
      };
      return cachedSettings;
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    cachedSettings = {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      supplements: mergeWithDefaultSupplements(parsed.supplements),
    };
    return cachedSettings;
  } catch {
    cachedSettings = {
      ...DEFAULT_APP_SETTINGS,
      supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
    };
    return cachedSettings;
  }
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next: AppSettings = {
    ...current,
    ...patch,
    supplements: patch.supplements
      ? mergeWithDefaultSupplements(patch.supplements)
      : current.supplements,
  };
  cachedSettings = next;
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function resetAppSettings(): Promise<AppSettings> {
  cachedSettings = {
    ...DEFAULT_APP_SETTINGS,
    supplements: DEFAULT_SUPPLEMENTS.map((s) => ({ ...s })),
  };
  await AsyncStorage.removeItem(SETTINGS_STORAGE_KEY);
  return cachedSettings;
}
