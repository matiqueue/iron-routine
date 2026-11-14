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

export interface DayPlan {
  id: string; // 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  name: string;
  subtitle: string;
  iconName: string; // Ionicons name
  badgeEmoji?: string;
  bannerUrl?: string;
  time: string;
  type: DayType;
  warmup?: string;
  exercises?: Exercise[];
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
}
