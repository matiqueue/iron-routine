export type MuscleCategory = 'klatka' | 'plecy' | 'nogi' | 'barki' | 'ramiona' | 'brzuch' | 'ogolne';

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
  completedSets: number;
  totalSets: number;
  durationMinutes?: number;
}
