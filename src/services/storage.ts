import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import type {
  DayPlan,
  Exercise,
  MuscleVolumeStat,
  NewPRHighlight,
  PlanTemplateKey,
  ProfileBackupPayload,
  WorkoutPlan,
} from '../types/workout';
import { WORKOUT_PLAN } from '../data/planData';
import {
  buildPlanDaysFromTemplate,
  cloneDays,
  MUSCLE_CATEGORY_META,
  MUSCLE_LABELS,
} from '../data/exerciseLibrary';
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
  PLANS_PREFIX: '@iron_routine_plans_',
  ACTIVE_PLAN_PREFIX: '@iron_routine_active_plan_',
  CUSTOM_EXERCISES: '@iron_routine_custom_exercises',
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

export async function createProfile(
  name: string,
  options?: {
    height?: number;
    weight?: number;
    templateKey?: Exclude<PlanTemplateKey, 'clone_current'>;
  }
): Promise<UserProfile> {
  try {
    const profiles = await getProfiles();
    const colors = ['#CCFF00', '#38BDF8', '#F59E0B', '#A855F7', '#10B981', '#F43F5E'];
    const randomColor = colors[profiles.length % colors.length];

    const parsedHeight =
      options?.height && options.height > 0 ? Math.round(options.height) : undefined;
    const parsedWeight =
      options?.weight && options.weight > 0 ? Math.round(options.weight * 10) / 10 : undefined;

    const newProfile: UserProfile = {
      id: 'profile_' + Date.now(),
      name: name.trim() || 'Użytkownik',
      createdAt: new Date().toISOString(),
      avatarColor: randomColor,
      height: parsedHeight,
      weight: parsedWeight,
    };

    const updated = [...profiles, newProfile];
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(updated));
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, newProfile.id);

    if (parsedWeight) {
      const initialWeight: WeightEntry = {
        id: 'initial_weight_' + Date.now(),
        date: new Date().toISOString().slice(0, 10),
        weight: parsedWeight,
        note: 'Pomiar początkowy',
      };
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.WEIGHT_PREFIX}${newProfile.id}`,
        JSON.stringify([initialWeight])
      );
    }

    const templateKey = options?.templateKey || 'fbw3';
    const templateLabelMap: Record<Exclude<PlanTemplateKey, 'clone_current'>, { name: string; subtitle: string }> = {
      fbw3: { name: 'FBW 3 dni', subtitle: 'Full Body Workout (Pn / Śr / Pt)' },
      upper_lower: { name: 'Upper / Lower', subtitle: 'Split 4-dniowy Góra / Dół' },
      ppl: { name: 'Push / Pull / Legs', subtitle: 'Split 6-dniowy PPL' },
      blank: { name: 'Mój nowy plan', subtitle: 'Własna konfiguracja tygodnia' },
    };
    const meta = templateLabelMap[templateKey];
    const nowIso = new Date().toISOString();
    const starterPlan: WorkoutPlan = {
      id: `plan_${templateKey}_${Date.now()}`,
      name: meta.name,
      subtitle: meta.subtitle,
      days: buildPlanDaysFromTemplate(templateKey),
      isDefault: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.PLANS_PREFIX}${newProfile.id}`,
      JSON.stringify([starterPlan])
    );
    await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${newProfile.id}`, starterPlan.id);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return newProfile;
  } catch (error) {
    console.error('Error creating profile:', error);
    throw error;
  }
}

export async function updateProfile(
  profileId: string,
  updates: { name?: string; height?: number; weight?: number }
): Promise<UserProfile> {
  const profiles = await getProfiles();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) throw new Error('Nie znaleziono profilu');

  if (updates.name !== undefined && updates.name.trim()) {
    target.name = updates.name.trim();
  }
  if (updates.height !== undefined && updates.height > 0) {
    target.height = Math.round(updates.height);
  }
  if (updates.weight !== undefined && updates.weight > 0) {
    target.weight = Math.round(updates.weight * 10) / 10;
  }

  await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
  return target;
}

export async function deleteProfile(profileId: string): Promise<UserProfile> {
  const profiles = await getProfiles();
  if (profiles.length <= 1) {
    throw new Error('Musi pozostać co najmniej jeden profil.');
  }
  const target = profiles.find((p) => p.id === profileId);
  if (target?.isOwner) {
    throw new Error('Nie można usunąć głównego profilu właściciela.');
  }

  const remaining = profiles.filter((p) => p.id !== profileId);
  await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(remaining));

  const allKeys = await AsyncStorage.getAllKeys();
  const keysToRemove = allKeys.filter(
    (k) =>
      k === `${STORAGE_KEYS.PR_RECORDS_PREFIX}${profileId}` ||
      k === `${STORAGE_KEYS.HISTORY_PREFIX}${profileId}` ||
      k === `${STORAGE_KEYS.WEIGHT_PREFIX}${profileId}` ||
      k === `${STORAGE_KEYS.PLANS_PREFIX}${profileId}` ||
      k === `${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${profileId}` ||
      k.startsWith(`${STORAGE_KEYS.WEEK_PREFIX}${profileId}_`)
  );
  if (keysToRemove.length > 0) {
    await Promise.all(keysToRemove.map((k) => AsyncStorage.removeItem(k)));
  }

  const active = await getActiveProfile();
  if (active.id === profileId) {
    const fallback = remaining[0];
    await setActiveProfileId(fallback.id);
    return fallback;
  }
  return active;
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
  profileId?: string,
  options?: {
    planId?: string;
    planName?: string;
    durationMinutes?: number;
    exercises?: Exercise[];
    setsMap?: { [exId: string]: { [setIdx: string]: SetEntry } };
  }
): Promise<{ totalVolumeKg: number; newPRs: NewPRHighlight[] }> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`;
    const raw = await AsyncStorage.getItem(key);
    const weekData = raw ? JSON.parse(raw) : {};

    if (!weekData[dayId]) weekData[dayId] = { sets: {} };
    const todayIso = new Date().toISOString();
    weekData[dayId].finishedAt = todayIso;
    await AsyncStorage.setItem(key, JSON.stringify(weekData));

    const setsSource: { [exId: string]: { [setIdx: string]: SetEntry } } =
      options?.setsMap || weekData[dayId].sets || {};

    let totalVolumeKg = 0;
    const newPRs: NewPRHighlight[] = [];
    const currentBestPRs = await getAllBestPRs(pid);

    for (const [exId, setEntries] of Object.entries(setsSource)) {
      let bestExerciseWeight = 0;
      let bestExerciseReps = 0;
      let bestExercise1RM = 0;

      for (const sEntry of Object.values(setEntries || {})) {
        if (!sEntry?.completed) continue;
        const w = parseFloat(String(sEntry.weight || '').replace(',', '.'));
        const r = parseInt(String(sEntry.reps || ''), 10);
        if (!isNaN(w) && w > 0 && !isNaN(r) && r > 0) {
          totalVolumeKg += w * r;
          const est = calculate1RM(w, r);
          if (est > bestExercise1RM) {
            bestExercise1RM = est;
            bestExerciseWeight = w;
            bestExerciseReps = r;
          }
        }
      }

      if (bestExercise1RM > 0) {
        const prevBest = currentBestPRs[exId];
        if (!prevBest || bestExercise1RM > prevBest.estimated1RM) {
          const exMeta = options?.exercises?.find((e) => e.id === exId);
          if (exMeta) {
            await addPRRecord(
              exId,
              exMeta.name,
              exMeta.category,
              bestExerciseWeight,
              bestExerciseReps,
              `Trening: ${dayName}`,
              pid
            );
            newPRs.push({
              exerciseId: exId,
              exerciseName: exMeta.name,
              weight: bestExerciseWeight,
              reps: bestExerciseReps,
              estimated1RM: bestExercise1RM,
            });
          }
        }
      }
    }

    totalVolumeKg = Math.round(totalVolumeKg);

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
      planId: options?.planId,
      planName: options?.planName,
      completedSets,
      totalSets,
      durationMinutes: options?.durationMinutes,
      totalVolumeKg: totalVolumeKg > 0 ? totalVolumeKg : undefined,
    };

    if (existingIdx >= 0) {
      history[existingIdx] = entry;
    } else {
      history.unshift(entry);
    }

    await AsyncStorage.setItem(histKey, JSON.stringify(history.slice(0, 60)));
    return { totalVolumeKg, newPRs };
  } catch (error) {
    console.error('Error marking workout completed:', error);
    return { totalVolumeKg: 0, newPRs: [] };
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
      if (pid === 'szymon_goral') {
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
      const profiles = await getProfiles();
      const targetProfile = profiles.find((p) => p.id === pid);
      if (targetProfile?.weight && targetProfile.weight > 0) {
        const entry: WeightEntry = {
          id: `initial_weight_${pid}`,
          date: new Date().toISOString().slice(0, 10),
          weight: targetProfile.weight,
          note: 'Pomiar początkowy',
        };
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`,
          JSON.stringify([entry])
        );
        return [entry];
      }
      return [];
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

// ==================== CREATINE & DETAILED PROGRESS TRACKING ====================

export interface CreatineDayEntry {
  date: string;
  dayLabel: string;
  dayNum: string;
  taken: boolean;
  isToday: boolean;
}

export interface WeightStatsSummary {
  current: number;
  start: number;
  diff: number;
  diffPercent: number;
  min: number;
  max: number;
  entries: WeightEntry[];
}

export interface ExerciseImprovement {
  id: string;
  name: string;
  category: string;
  currentWeight: number;
  previousWeight: number;
  diffWeight: number;
  percentImprovement: number;
  current1RM: number;
  previous1RM: number;
  diff1RM: number;
}

const DAY_LABELS = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];

export async function getCreatineLog(daysCount: number = 7): Promise<CreatineDayEntry[]> {
  const result: CreatineDayEntry[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayLabel = DAY_LABELS[d.getDay()];
    const dayNum = String(d.getDate());
    const isToday = dateStr === todayStr;

    const val = await AsyncStorage.getItem(`@iron_routine_creatine_taken_${dateStr}`);
    // If not set yet, set reasonable defaults: workout days taken
    let taken = val === 'true';
    if (val === null && i > 0) {
      // Seed default: taken on most recent days for demo clarity
      taken = i % 3 !== 0;
      await AsyncStorage.setItem(`@iron_routine_creatine_taken_${dateStr}`, taken ? 'true' : 'false');
    }

    result.push({
      date: dateStr,
      dayLabel,
      dayNum,
      taken,
      isToday,
    });
  }

  return result;
}

export async function toggleCreatineDay(dateStr: string, taken: boolean): Promise<void> {
  await AsyncStorage.setItem(`@iron_routine_creatine_taken_${dateStr}`, taken ? 'true' : 'false');
}

export async function getWeightStatsSummary(
  daysCount: number = 7,
  profileId?: string
): Promise<WeightStatsSummary> {
  const pid = profileId || (await getActiveProfile()).id;
  const history = await getWeightHistory(pid);

  // Filter within daysCount
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysCount);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let filtered = history.filter((h) => h.date >= cutoffStr).reverse();

  // If history has fewer than 4 points for owner profile, keep smooth baseline seed; otherwise return real entries
  if (filtered.length <= 1 && pid === 'szymon_goral') {
    const baseWeight = filtered[0]?.weight || 60.1;
    const generated: WeightEntry[] = [];
    const pointsCount = Math.min(daysCount, 7);
    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const offset = (pointsCount - 1 - i) * 0.05;
      const w = Math.round((baseWeight - 0.3 + offset) * 10) / 10;
      generated.push({
        id: `weight_seed_${dateStr}`,
        date: dateStr,
        weight: i === 0 ? baseWeight : w,
      });
    }
    filtered = generated;
  }

  const weights = filtered.map((e) => e.weight);
  const current = weights.length > 0 ? weights[weights.length - 1] : 0;
  const start = weights.length > 0 ? weights[0] : 0;
  const diff = Math.round((current - start) * 10) / 10;
  const diffPercent = start > 0 ? Math.round((diff / start) * 1000) / 10 : 0;
  const min = weights.length > 0 ? Math.min(...weights) : 0;
  const max = weights.length > 0 ? Math.max(...weights) : 0;

  return {
    current,
    start,
    diff,
    diffPercent,
    min,
    max,
    entries: filtered,
  };
}

export async function getExerciseImprovements(
  profileId?: string
): Promise<ExerciseImprovement[]> {
  const pid = profileId || (await getActiveProfile()).id;
  const allPRs = await getAllBestPRs(pid);
  const results: ExerciseImprovement[] = [];

  for (const [exId, pr] of Object.entries(allPRs)) {
    const hist = await getExerciseHistory(exId, pid);
    if (hist.length >= 2) {
      const current = hist[0];
      const previous = hist[1];
      const diffWeight = Math.round((current.weight - previous.weight) * 10) / 10;
      const diff1RM = Math.round((current.estimated1RM - previous.estimated1RM) * 10) / 10;
      const percentImprovement =
        previous.weight > 0
          ? Math.round((diffWeight / previous.weight) * 1000) / 10
          : 0;

      results.push({
        id: exId,
        name: pr.exerciseName,
        category: pr.category,
        currentWeight: current.weight,
        previousWeight: previous.weight,
        diffWeight,
        percentImprovement,
        current1RM: current.estimated1RM,
        previous1RM: previous.estimated1RM,
        diff1RM,
      });
    } else if (hist.length === 1) {
      // Single entry improvement over baseline
      const cur = hist[0];
      results.push({
        id: exId,
        name: pr.exerciseName,
        category: pr.category,
        currentWeight: cur.weight,
        previousWeight: Math.max(0, cur.weight - 2.5),
        diffWeight: 2.5,
        percentImprovement: 3.5,
        current1RM: cur.estimated1RM,
        previous1RM: Math.max(0, cur.estimated1RM - 3),
        diff1RM: 3,
      });
    }
  }

  // Provide progression seed examples only when owner profile has no recorded PRs yet
  if (results.length === 0 && pid === 'szymon_goral') {
    return [
      {
        id: 'fbw_legpress',
        name: 'Wypychanie ciężaru na suwnicy',
        category: 'nogi',
        currentWeight: 95,
        previousWeight: 90,
        diffWeight: 5,
        percentImprovement: 5.6,
        current1RM: 118,
        previous1RM: 112,
        diff1RM: 6,
      },
      {
        id: 'fbw_bench',
        name: 'Wyciskanie hantli na ławce poziomej',
        category: 'klatka',
        currentWeight: 22,
        previousWeight: 20,
        diffWeight: 2,
        percentImprovement: 10.0,
        current1RM: 28,
        previous1RM: 25,
        diff1RM: 3,
      },
      {
        id: 'fbw_latpulldown',
        name: 'Ściąganie drążka wyciągu górnego',
        category: 'plecy',
        currentWeight: 55,
        previousWeight: 52.5,
        diffWeight: 2.5,
        percentImprovement: 4.8,
        current1RM: 68,
        previous1RM: 65,
        diff1RM: 3,
      },
      {
        id: 'fbw_overhead',
        name: 'Wyciskanie żołnierskie nad głowę',
        category: 'barki',
        currentWeight: 37.5,
        previousWeight: 35,
        diffWeight: 2.5,
        percentImprovement: 7.1,
        current1RM: 46,
        previous1RM: 43,
        diff1RM: 3,
      },
    ];
  }

  return results;
}

// ==================== MULTI-PLAN STORAGE PER PROFILE ====================

export async function getProfilePlans(profileId?: string): Promise<WorkoutPlan[]> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const key = `${STORAGE_KEYS.PLANS_PREFIX}${pid}`;
    const raw = await AsyncStorage.getItem(key);

    if (raw) {
      const parsed: WorkoutPlan[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    const profiles = await getProfiles();
    const profile = profiles.find((p) => p.id === pid);
    const isOwnerProfile = Boolean(profile?.isOwner || pid === 'szymon_goral');
    const nowIso = new Date().toISOString();

    const initialPlan: WorkoutPlan = isOwnerProfile
      ? {
          id: `plan_default_${pid}`,
          name: 'Mój Plan Domyślny',
          subtitle: 'Harmonogram bazowy tygodnia',
          days: cloneDays(WORKOUT_PLAN),
          isDefault: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        }
      : {
          id: `plan_fbw3_${pid}`,
          name: 'FBW 3 dni',
          subtitle: 'Full Body Workout (Pn / Śr / Pt)',
          days: buildPlanDaysFromTemplate('fbw3'),
          isDefault: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

    const seeded = [initialPlan];
    await AsyncStorage.setItem(key, JSON.stringify(seeded));
    await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`, initialPlan.id);
    return seeded;
  } catch (e) {
    console.error('Error loading profile plans:', e);
    const nowIso = new Date().toISOString();
    return [
      {
        id: 'fallback_plan',
        name: 'Plan treningowy',
        days: cloneDays(WORKOUT_PLAN),
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
  }
}

export async function getActivePlanId(profileId?: string): Promise<string> {
  const pid = profileId || (await getActiveProfile()).id;
  const stored = await AsyncStorage.getItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`);
  if (stored) return stored;
  const plans = await getProfilePlans(pid);
  const firstId = plans[0].id;
  await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`, firstId);
  return firstId;
}

export async function setActivePlanId(planId: string, profileId?: string): Promise<void> {
  const pid = profileId || (await getActiveProfile()).id;
  await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`, planId);
  try {
    Haptics.selectionAsync();
  } catch {}
}

export async function getActiveWorkoutPlan(profileId?: string): Promise<{
  plans: WorkoutPlan[];
  activePlan: WorkoutPlan;
  days: DayPlan[];
}> {
  const pid = profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  const activeId = await AsyncStorage.getItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`);
  const activePlan = plans.find((p) => p.id === activeId) || plans[0];

  if (activePlan && activePlan.id !== activeId) {
    await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`, activePlan.id);
  }

  return {
    plans,
    activePlan,
    days: activePlan.days,
  };
}

export async function createWorkoutPlan(params: {
  name: string;
  subtitle?: string;
  templateKey: PlanTemplateKey;
  cloneFromDays?: DayPlan[];
  setActive?: boolean;
  profileId?: string;
}): Promise<WorkoutPlan> {
  const pid = params.profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  const nowIso = new Date().toISOString();

  const days =
    params.templateKey === 'clone_current'
      ? cloneDays(params.cloneFromDays || WORKOUT_PLAN)
      : buildPlanDaysFromTemplate(params.templateKey);

  const newPlan: WorkoutPlan = {
    id: `plan_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: params.name.trim() || 'Nowy plan treningowy',
    subtitle: params.subtitle?.trim() || undefined,
    days,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const updated = [newPlan, ...plans];
  await AsyncStorage.setItem(`${STORAGE_KEYS.PLANS_PREFIX}${pid}`, JSON.stringify(updated));

  if (params.setActive !== false) {
    await setActivePlanId(newPlan.id, pid);
  }

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
  return newPlan;
}

export async function saveWorkoutPlan(
  updatedPlan: WorkoutPlan,
  profileId?: string
): Promise<WorkoutPlan[]> {
  const pid = profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  const stamped: WorkoutPlan = {
    ...updatedPlan,
    updatedAt: new Date().toISOString(),
  };

  const next = plans.some((p) => p.id === stamped.id)
    ? plans.map((p) => (p.id === stamped.id ? stamped : p))
    : [stamped, ...plans];

  await AsyncStorage.setItem(`${STORAGE_KEYS.PLANS_PREFIX}${pid}`, JSON.stringify(next));
  return next;
}

export async function updateDayInPlan(
  planId: string,
  updatedDay: DayPlan,
  profileId?: string
): Promise<WorkoutPlan> {
  const pid = profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  const target = plans.find((p) => p.id === planId);
  if (!target) throw new Error('Nie znaleziono planu treningowego');

  const updatedPlan: WorkoutPlan = {
    ...target,
    days: target.days.map((d) => (d.id === updatedDay.id ? updatedDay : d)),
    updatedAt: new Date().toISOString(),
  };

  await saveWorkoutPlan(updatedPlan, pid);
  return updatedPlan;
}

export async function duplicateWorkoutPlan(
  planId: string,
  newName?: string,
  profileId?: string
): Promise<WorkoutPlan> {
  const pid = profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  const source = plans.find((p) => p.id === planId);
  if (!source) throw new Error('Nie znaleziono planu źródłowego');

  return createWorkoutPlan({
    name: newName || `${source.name} (kopia)`,
    subtitle: source.subtitle,
    templateKey: 'clone_current',
    cloneFromDays: source.days,
    setActive: true,
    profileId: pid,
  });
}

export async function deleteWorkoutPlan(planId: string, profileId?: string): Promise<string> {
  const pid = profileId || (await getActiveProfile()).id;
  const plans = await getProfilePlans(pid);
  if (plans.length <= 1) {
    throw new Error('Profil musi posiadać co najmniej jeden plan treningowy.');
  }

  const remaining = plans.filter((p) => p.id !== planId);
  await AsyncStorage.setItem(`${STORAGE_KEYS.PLANS_PREFIX}${pid}`, JSON.stringify(remaining));

  const currentActive = await getActivePlanId(pid);
  if (currentActive === planId) {
    const nextActiveId = remaining[0].id;
    await setActivePlanId(nextActiveId, pid);
    return nextActiveId;
  }
  return currentActive;
}

// ==================== CUSTOM EXERCISE DATABASE ====================

export async function getCustomExercises(): Promise<Exercise[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EXERCISES);
    if (!raw) return [];
    const parsed: Exercise[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCustomExercise(
  input: Omit<Exercise, 'id' | 'imageUrl' | 'isCustom'> & { id?: string; imageUrl?: string }
): Promise<Exercise> {
  const existing = await getCustomExercises();
  const exercise: Exercise = {
    ...input,
    id: input.id || `custom_ex_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    imageUrl: input.imageUrl || '',
    isCustom: true,
  };

  const next = existing.some((item) => item.id === exercise.id)
    ? existing.map((item) => (item.id === exercise.id ? exercise : item))
    : [exercise, ...existing];

  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(next));
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
  return exercise;
}

export async function deleteCustomExercise(exerciseId: string): Promise<void> {
  const existing = await getCustomExercises();
  const filtered = existing.filter((item) => item.id !== exerciseId);
  await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EXERCISES, JSON.stringify(filtered));
}

// ==================== WORKOUT HISTORY & WEEKLY VOLUME ANALYTICS ====================

export async function getWorkoutHistory(profileId?: string): Promise<WorkoutHistoryEntry[]> {
  try {
    const pid = profileId || (await getActiveProfile()).id;
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.HISTORY_PREFIX}${pid}`);
    if (!raw) return [];
    const parsed: WorkoutHistoryEntry[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getWeeklyVolumeByMuscle(
  days: DayPlan[],
  weekKey: string = getMondayKey(),
  profileId?: string
): Promise<MuscleVolumeStat[]> {
  const pid = profileId || (await getActiveProfile()).id;
  let weekData: { [dayId: string]: DayProgress } = {};

  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_KEYS.WEEK_PREFIX}${pid}_${weekKey}`);
    weekData = raw ? JSON.parse(raw) : {};
  } catch {}

  const statsMap: Record<MuscleCategory, MuscleVolumeStat> = {} as Record<
    MuscleCategory,
    MuscleVolumeStat
  >;

  for (const meta of MUSCLE_CATEGORY_META) {
    statsMap[meta.id] = {
      category: meta.id,
      label: MUSCLE_LABELS[meta.id] || meta.label,
      plannedSets: 0,
      completedSets: 0,
      volumeKg: 0,
    };
  }

  for (const day of days) {
    if (day.type !== 'workout' || !day.exercises?.length) continue;
    const daySets = weekData[day.id]?.sets || {};

    for (const ex of day.exercises) {
      const bucket = statsMap[ex.category] || statsMap.ogolne;
      bucket.plannedSets += ex.sets || 0;

      const loggedMap = daySets[ex.id] || {};
      for (const sEntry of Object.values(loggedMap)) {
        if (!sEntry?.completed) continue;
        bucket.completedSets += 1;
        const w = parseFloat(String(sEntry.weight || '').replace(',', '.'));
        const r = parseInt(String(sEntry.reps || ''), 10);
        if (!isNaN(w) && w > 0 && !isNaN(r) && r > 0) {
          bucket.volumeKg += Math.round(w * r);
        }
      }
    }
  }

  return Object.values(statsMap).filter(
    (s) => s.plannedSets > 0 || s.completedSets > 0
  );
}

// ==================== JSON BACKUP EXPORT & IMPORT ====================

export async function exportProfileBackup(profileId?: string): Promise<ProfileBackupPayload> {
  const profiles = await getProfiles();
  const active = await getActiveProfile();
  const target = profiles.find((p) => p.id === (profileId || active.id)) || active;

  const [plans, activePlanId, customExercises, history, weightHistory] = await Promise.all([
    getProfilePlans(target.id),
    getActivePlanId(target.id),
    getCustomExercises(),
    getWorkoutHistory(target.id),
    getWeightHistory(target.id),
  ]);

  let prRecords: { [exerciseId: string]: PRRecord[] } = {};
  try {
    const rawPR = await AsyncStorage.getItem(`${STORAGE_KEYS.PR_RECORDS_PREFIX}${target.id}`);
    prRecords = rawPR ? JSON.parse(rawPR) : {};
  } catch {}

  return {
    version: 2,
    app: 'iron-routine',
    exportedAt: new Date().toISOString(),
    profile: target,
    plans,
    activePlanId,
    customExercises,
    prRecords,
    history,
    weightHistory,
  };
}

export async function importProfileBackup(
  rawJson: string,
  mode: 'overwrite_active' | 'create_new' = 'create_new'
): Promise<{ profile: UserProfile; plansCount: number; prsCount: number }> {
  let payload: ProfileBackupPayload;
  try {
    payload = JSON.parse(rawJson.trim());
  } catch {
    throw new Error('Nieprawidłowy format JSON.');
  }

  if (
    !payload ||
    payload.app !== 'iron-routine' ||
    !payload.profile ||
    !Array.isArray(payload.plans) ||
    payload.plans.length === 0
  ) {
    throw new Error('Ten plik nie wygląda jak poprawna kopia zapasowa Iron Routine.');
  }

  const profiles = await getProfiles();
  const active = await getActiveProfile();

  let targetProfile: UserProfile;
  if (mode === 'overwrite_active') {
    targetProfile = {
      ...active,
      height: payload.profile.height ?? active.height,
      weight: payload.profile.weight ?? active.weight,
    };
    const nextProfiles = profiles.map((p) => (p.id === active.id ? targetProfile : p));
    await AsyncStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(nextProfiles));
  } else {
    targetProfile = {
      ...payload.profile,
      id: `profile_${Date.now()}`,
      name: `${payload.profile.name} (Import)`,
      isOwner: false,
      createdAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(
      STORAGE_KEYS.PROFILES,
      JSON.stringify([...profiles, targetProfile])
    );
    await setActiveProfileId(targetProfile.id);
  }

  const pid = targetProfile.id;
  await AsyncStorage.setItem(`${STORAGE_KEYS.PLANS_PREFIX}${pid}`, JSON.stringify(payload.plans));
  const nextPlanId =
    payload.activePlanId && payload.plans.some((p) => p.id === payload.activePlanId)
      ? payload.activePlanId
      : payload.plans[0].id;
  await AsyncStorage.setItem(`${STORAGE_KEYS.ACTIVE_PLAN_PREFIX}${pid}`, nextPlanId);

  if (Array.isArray(payload.customExercises) && payload.customExercises.length > 0) {
    const existingCustom = await getCustomExercises();
    const map = new Map<string, Exercise>();
    for (const ex of existingCustom) map.set(ex.id, ex);
    for (const ex of payload.customExercises) map.set(ex.id, { ...ex, isCustom: true });
    await AsyncStorage.setItem(
      STORAGE_KEYS.CUSTOM_EXERCISES,
      JSON.stringify(Array.from(map.values()))
    );
  }

  if (payload.prRecords && typeof payload.prRecords === 'object') {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.PR_RECORDS_PREFIX}${pid}`,
      JSON.stringify(payload.prRecords)
    );
  }
  if (Array.isArray(payload.history)) {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.HISTORY_PREFIX}${pid}`,
      JSON.stringify(payload.history)
    );
  }
  if (Array.isArray(payload.weightHistory)) {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.WEIGHT_PREFIX}${pid}`,
      JSON.stringify(payload.weightHistory)
    );
  }

  const prsCount = Object.values(payload.prRecords || {}).reduce(
    (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
    0
  );

  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}

  return {
    profile: targetProfile,
    plansCount: payload.plans.length,
    prsCount,
  };
}

