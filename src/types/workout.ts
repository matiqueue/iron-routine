export type MuscleCategory = 'klatka' | 'plecy' | 'nogi' | 'barki' | 'ramiona' | 'brzuch' | 'ogolne';

export type EquipmentType = 'Sztanga' | 'Hantle' | 'Maszyna' | 'Wyciąg' | 'Masa ciała' | 'Inne';

export interface Exercise {
  id: string;
  name: string;
  category: MuscleCategory;
  sets: number;
  reps: string;
  rest: number; // in seconds
  note?: string;
  description: string;
  imageUrl: string;
  ab?: boolean;
  equipment?: EquipmentType;
  isCustom?: boolean;
}

export type DayType = 'workout' | 'walk' | 'rest';

export type DayBannerTag =
  | 'push'
  | 'pull'
  | 'legs'
  | 'upper'
  | 'lower'
  | 'fbw'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'cardio'
  | 'rest';

export interface DayPlan {
  id: string; // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  name: string;
  subtitle: string;
  iconName: string; // Ionicons name
  badgeEmoji?: string;
  bannerUrl?: string;
  bannerTag?: DayBannerTag;
  time: string;
  type: DayType;
  warmup?: string;
  exercises?: Exercise[];
}

export interface SessionExerciseConfig {
  orderedIds: string[];
  skippedIds: string[];
  /** Extra ad-hoc exercises picked from the library for this day's session only */
  addedExercises?: Exercise[];
}

export type SupplementDosingMode = 'recommended' | 'per_kg' | 'fixed';

export interface SupplementItem {
  id: string;
  name: string;
  enabled: boolean;
  dosingMode: SupplementDosingMode;
  recommendedText: string;
  perKgGrams?: number;
  fixedAmountText?: string;
  timing?: 'morning' | 'pre_workout' | 'post_workout' | 'evening' | 'anytime';
  isCustom?: boolean;
}

export interface HealthDailySummary {
  platformAvailable: boolean;
  authorized: boolean;
  steps: number | null;
  sleepHours: number | null;
  activeCalories: number | null;
  distanceKm: number | null;
  lastSyncedAt?: string;
}

export interface AppSettings {
  hapticsEnabled: boolean;
  hapticsIntensity: 'subtle' | 'medium' | 'strong';
  restEndMultiBuzz: boolean;
  restNotificationsEnabled: boolean;
  restTimeSensitive: boolean;
  creatineRemindersEnabled: boolean;
  creatineMorningHour: number;
  creatineEveningHour: number;
  weightReminderEnabled: boolean;
  weightReminderHour: number;
  defaultRestSeconds: number;
  supplements: SupplementItem[];
  healthSyncEnabled: boolean;
}

export type PlanTemplateKey = 'blank' | 'fbw3' | 'ppl' | 'upper_lower' | 'clone_current';

export interface WorkoutPlan {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  days: DayPlan[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SetEntry {
  completed: boolean;
  weight?: string; // in kg
  reps?: string;
}

export interface DayProgress {
  sets: { [exerciseId: string]: { [setIndex: number]: SetEntry } };
  finishedAt?: string; // ISO string
  sessionConfig?: SessionExerciseConfig;
}

export interface UserProfile {
  id: string;
  name: string;
  isOwner?: boolean;
  createdAt: string;
  avatarColor?: string;
  height?: number; // in cm (e.g. 180)
  weight?: number; // in kg (e.g. 60.1)
}

export interface WeightEntry {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  weight: number; // in kg (e.g. 60.1)
  note?: string;
}

export interface PRRecord {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: MuscleCategory;
  weight: number; // in kg
  reps: number;
  estimated1RM: number;
  date: string; // ISO string or YYYY-MM-DD
  note?: string;
}

export interface WorkoutHistoryEntry {
  date: string; // YYYY-MM-DD
  dayId: string;
  dayName: string;
  planId?: string;
  planName?: string;
  completedSets: number;
  totalSets: number;
  durationMinutes?: number;
  totalVolumeKg?: number;
}

export interface NewPRHighlight {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  estimated1RM: number;
}

export interface MuscleVolumeStat {
  category: MuscleCategory;
  label: string;
  plannedSets: number;
  completedSets: number;
  volumeKg: number;
}

export interface DayMetaInfo {
  id: string;
  label: string;
  short: string;
}

export interface ProfileBackupPayload {
  version: 2;
  app: 'iron-routine';
  exportedAt: string;
  profile: UserProfile;
  plans: WorkoutPlan[];
  activePlanId?: string;
  customExercises: Exercise[];
  prRecords: { [exerciseId: string]: PRRecord[] };
  history: WorkoutHistoryEntry[];
  weightHistory: WeightEntry[];
  settings?: AppSettings;
}
