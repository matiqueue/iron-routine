import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  DayProgress,
  MuscleCategory,
  PRRecord,
  SetEntry,
  UserProfile,
  WeightEntry,
  WorkoutHistoryEntry,
} from '../types/workout';

const STORAGE_KEYS = {
  PROFILES: '@iron_routine_profiles',
  ACTIVE_PROFILE_ID: '@iron_routine_active_profile_id',
  PR_RECORDS_PREFIX: '@iron_routine_prs_',
  WEEK_PREFIX: '@iron_routine_week_',
  HISTORY_PREFIX: '@iron_routine_history_',
  WEIGHT_PREFIX: '@iron_routine_weight_',
};

const DEFAULT_PROFILE: UserProfile = {
  id: 'szymon_goral',
  name: 'Szymon Góral',
  height: 180,
  weight: 60.1,
  isOwner: true,
  createdAt: new Date().toISOString(),
  avatarColor: '#CCFF00',
};

// ==================== PROFILE MANAGEMENT ====================

export async function getProfiles(): Promise<UserProfile[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILES);
    if (!raw) {
      // Initialize with default profile
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify([DEFAULT_PROFILE]));
      await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, DEFAULT_PROFILE.id);
      return [DEFAULT_PROFILE];
    }
    const profiles: UserProfile[] = JSON.parse(raw);
    if (profiles.length === 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify([DEFAULT_PROFILE]));
      return [DEFAULT_PROFILE];
    }
    // Automatically sanitize and remove "(ja)" suffix if saved in storage
    let modified = false;
    const cleaned = profiles.map((p) => {
      if (p.name.includes('(ja)')) {
        modified = true;
        return { ...p, name: p.name.replace(/\s*\(ja\)/gi, '').trim() };
      }
      return p;
    });
    if (modified) {
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [DEFAULT_PROFILE];
  }
}

export async function getActiveProfile(): Promise<UserProfile> {
  try {
    const profiles = await getProfiles();
    const activeId = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
    const found = profiles.find((p) => p.id === activeId);
    return found || profiles[0] || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function setActiveProfileId(profileId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);
    Haptics.selectionAsync();
  } catch (error) {
    console.error('Error setting active profile:', error);
  }
}

export async function createProfile(name: string): Promise<UserProfile> {
  try {
    const profiles = await getProfiles();
    const colors = ['#CCFF00', '#38BDF8', '#F59E0B', '#A855F7', '#10B981', '#F43F5E'];
    const randomColor = colors[profiles.length % colors.length];

    const newProfile: UserProfile = {
      id: 'profile_' + Date.now(),
      name: name.trim() || 'Użytkownik',
      createdAt: new Date().toISOString(),
      avatarColor: randomColor,
    };

    const updated = [...profiles, newProfile];
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(updated));
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, newProfile.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return newProfile;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
}

// ==================== 1RM & PROGRESS TRACKER (MERITUM) ====================

// Epley formula for estimated 1 Rep Max
export function calculate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return Math.round(weight * 10) / 10;
  // Formula: 1RM = weight * (1 + reps / 30)
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export async function getExerciseHistory(
  exerciseId: string,
  profileId?: string
): Promise<PRRecord[]> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.PR_RECORDS_PREFIX}${pid}_${exerciseId}`);
    if (!raw) return [];
    const list: PRRecord[] = JSON.parse(raw);
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export async function getAllBestPRs(
  profileId?: string
): Promise<{ [exerciseId: string]: PRRecord }> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const keys = await AsyncStorage.getAllKeys();
    const prefix = `${STORAGE_KEYS.PR_RECORDS_PREFIX}${pid}_`;
    const exerciseKeys = keys.filter((k) => k.startsWith(prefix));

    if (exerciseKeys.length === 0) return {};

    const result: { [exId: string]: PRRecord } = {};

    await Promise.all(
      exerciseKeys.map(async (key) => {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          const exId = key.replace(prefix, '');
          const records: PRRecord[] = JSON.parse(value);
          if (records.length > 0) {
            // Sort by 1RM descending to find personal best
            const sorted = [...records].sort((a, b) => b.estimated1RM - a.estimated1RM);
            result[exId] = sorted[0];
          }
        }
      })
    );

    return result;
  } catch {
    return {};
  }
}

export async function addPRRecord(
  exerciseId: string,
  exerciseName: string,
  category: MuscleCategory,
  weight: number,
  reps: number,
  note?: string,
  profileId?: string
): Promise<PRRecord> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const storageKey = `${STORAGE_KEYS.PR_RECORDS_PREFIX}${pid}_${exerciseId}`;
    const raw = await AsyncStorage.getItem(storageKey);
    const history: PRRecord[] = raw ? JSON.parse(raw) : [];

    const newRecord: PRRecord = {
      id: 'pr_' + Date.now(),
      exerciseId,
      exerciseName,
      category,
      weight,
      reps,
      estimated1RM: calculate1RM(weight, reps),
      date: new Date().toISOString(),
      note: note?.trim(),
    };

    history.unshift(newRecord);
    await AsyncStorage.setItem(storageKey, JSON.stringify(history));

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    return newRecord;
  } catch (error) {
    console.error('Error saving PR record:', error);
    throw error;
  }
}

export async function deletePRRecord(
  recordId: string,
  exerciseId: string,
  profileId?: string
): Promise<void> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const storageKey = `${STORAGE_KEYS.PR_RECORDS_PREFIX}${pid}_${exerciseId}`;
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return;

    const history: PRRecord[] = JSON.parse(raw);
    const filtered = history.filter((r) => r.id !== recordId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting PR record:', error);
  }
}

// ==================== WORKOUTS & PROGRESS ====================

export function getMondayKey(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

export function getTodayDayId(): string {
  const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return dayMap[new Date().getDay()];
}

export async function loadDayProgress(
  dayId: string,
  weekKey: string = getMondayKey(),
  profileId?: string
): Promise<DayProgress> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { sets: {} };
    const weekData = JSON.parse(raw);
    return weekData[dayId] || { sets: {} };
  } catch {
    return { sets: {} };
  }
}

export async function saveSetEntry(
  dayId: string,
  exerciseId: string,
  setIndex: number,
  entry: Partial<SetEntry>,
  weekKey: string = getMondayKey(),
  profileId?: string
): Promise<DayProgress> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`;
    const raw = await AsyncStorage.getItem(key);
    const weekData = raw ? JSON.parse(raw) : {};

    if (!weekData[dayId]) weekData[dayId] = { sets: {} };
    if (!weekData[dayId].sets[exerciseId]) weekData[dayId].sets[exerciseId] = {};

    const currentEntry: SetEntry = weekData[dayId].sets[exerciseId][setIndex] || {
      completed: false,
    };

    const updatedEntry: SetEntry = {
      ...currentEntry,
      ...entry,
    };

    weekData[dayId].sets[exerciseId][setIndex] = updatedEntry;
    await AsyncStorage.setItem(key, JSON.stringify(weekData));

    return weekData[dayId];
  } catch (error) {
    console.error('Error saving set entry:', error);
    throw error;
  }
}

export async function resetDayProgress(
  dayId: string,
  weekKey: string = getMondayKey(),
  profileId?: string
): Promise<DayProgress> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`;
    const raw = await AsyncStorage.getItem(key);
    const weekData = raw ? JSON.parse(raw) : {};

    if (weekData[dayId]) {
      delete weekData[dayId];
      await AsyncStorage.setItem(key, JSON.stringify(weekData));
    }
    return { sets: {} };
  } catch {
    return { sets: {} };
  }
}

export async function markWorkoutCompleted(
  dayId: string,
  dayName: string,
  completedSets: number,
  totalSets: number,
  weekKey: string = getMondayKey(),
  profileId?: string
): Promise<void> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`;
    const raw = await AsyncStorage.getItem(key);
    const weekData = raw ? JSON.parse(raw) : {};

    if (!weekData[dayId]) weekData[dayId] = { sets: {} };
    const todayIso = new Date().toISOString();
    weekData[dayId].finishedAt = todayIso;
    await AsyncStorage.setItem(key, JSON.stringify(weekData));

    // Save to profile history
    const histKey = `${STORAGE_KEYS.HISTORY_PREFIX}${pid}`;
    const historyRaw = await AsyncStorage.getItem(histKey);
    const history: WorkoutHistoryEntry[] = historyRaw ? JSON.parse(historyRaw) : [];
    const dateStr = todayIso.split('T')[0];

    const existingIdx = history.findIndex((h) => h.date === dateStr && h.dayId === dayId);
    const entry: WorkoutHistoryEntry = {
      date: dateStr,
      dayId,
      dayName,
      completedSets,
      totalSets,
    };

    if (existingIdx >= 0) {
      history[existingIdx] = entry;
    } else {
      history.unshift(entry);
    }

    await AsyncStorage.setItem(histKey, JSON.stringify(history.slice(0, 60)));
  } catch (error) {
    console.error('Error marking workout completed:', error);
  }
}

export async function getWorkoutStreak(profileId?: string): Promise<number> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const histKey = `${STORAGE_KEYS.HISTORY_PREFIX}${pid}`;
    const raw = await AsyncStorage.getItem(histKey);
    if (!raw) return 0;
    const history: WorkoutHistoryEntry[] = JSON.parse(raw);
    if (history.length === 0) return 0;

    // Count consecutive workout days
    const uniqueDates = Array.from(new Set(history.map((h) => h.date))).sort().reverse();
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const entryDate = new Date(uniqueDates[i]);
      entryDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // If the most recent is today or yesterday, streak is active
      if (i === 0 && diffDays > 1) {
        return 0;
      }
      if (diffDays === i || diffDays === i + 1) {
        streak++;
      } else {
        break;
      }
    }
    return Math.max(streak, 1);
  } catch {
    return 0;
  }
}

export async function getLastExerciseMetrics(
  exerciseId: string,
  profileId?: string
): Promise<{ weight?: string; reps?: string }> {
  try {
    const history = await getExerciseHistory(exerciseId, profileId);
    if (history.length > 0) {
      return {
        weight: history[0].weight ? String(history[0].weight) : undefined,
        reps: history[0].reps ? String(history[0].reps) : undefined,
      };
    }
    return {};
  } catch {
    return {};
  }
}

// ==================== BODY WEIGHT & HEIGHT TRACKING ====================

export async function getWeightHistory(profileId?: string): Promise<WeightEntry[]> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`);
    if (!raw) {
      // Default initial record for Szymon
      const initialEntry: WeightEntry = {
        id: 'initial_weight',
        date: new Date().toISOString().slice(0, 10),
        weight: 60.1,
        note: 'Waga początkowa',
      };
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`,
        JSON.stringify([initialEntry])
      );
      return [initialEntry];
    }
    const parsed: WeightEntry[] = JSON.parse(raw);
    return parsed.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function addWeightEntry(
  weight: number,
  date?: string,
  note?: string,
  profileId?: string
): Promise<WeightEntry> {
  const pid = profileId || (await getActiveProfile()).id;
  const history = await getWeightHistory(pid);
  const entryDate = date || new Date().toISOString().slice(0, 10);

  // Check if today already has an entry - replace or add
  const existingIndex = history.findIndex((h) => h.date === entryDate);
  const newEntry: WeightEntry = {
    id: `weight_${Date.now()}`,
    date: entryDate,
    weight: Math.round(weight * 10) / 10,
    note,
  };

  if (existingIndex >= 0) {
    history[existingIndex] = newEntry;
  } else {
    history.unshift(newEntry);
  }

  const sorted = history.sort((a, b) => b.date.localeCompare(a.date));
  await AsyncStorage.setItem(`${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`, JSON.stringify(sorted));

  // Also update active profile's weight
  try {
    const profiles = await getProfiles();
    const target = profiles.find((p) => p.id === pid);
    if (target) {
      target.weight = newEntry.weight;
      await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    }
  } catch {}

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}

  return newEntry;
}

export async function deleteWeightEntry(id: string, profileId?: string): Promise<void> {
  const pid = profileId || (await getActiveProfile()).id;
  const history = await getWeightHistory(pid);
  const filtered = history.filter((h) => h.id !== id);
  await AsyncStorage.setItem(`${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`, JSON.stringify(filtered));
}

export async function updateProfileStats(
  profileId: string,
  height: number,
  weight: number
): Promise<UserProfile> {
  const profiles = await getProfiles();
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) throw new Error('Profile not found');

  profile.height = Math.round(height);
  profile.weight = Math.round(weight * 10) / 10;
  await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  return profile;
}
