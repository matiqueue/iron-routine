export type MuscleCategory = 'klatka' | 'plecy' | 'nogi' | 'barki' | 'ramiona' | 'brzuch' | 'ogolne';

export type MuscleSubGroupId =
  | 'upper_chest'
  | 'mid_lower_chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'traps'
  | 'lats'
  | 'mid_back'
  | 'lower_back'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'adductors'
  | 'calves';

export type RankTier = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'S+';

export type EquipmentType = 'Sztanga' | 'Hantle' | 'Maszyna' | 'Wyciąg' | 'Masa ciała' | 'Inne';

export interface SecondaryMuscleWeight {
  muscle: MuscleSubGroupId;
  weight: number; // e.g. 0.35 - 0.5
}

export interface Exercise {
  id: string;
  name: string;
  category: MuscleCategory;
  primaryMuscle?: MuscleSubGroupId;
  secondaryMuscles?: SecondaryMuscleWeight[];
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

export type AppLanguage = 'pl' | 'en' | 'de' | 'fr' | 'es';

export interface AppSettings {
  language: AppLanguage;
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
  calendarSyncEnabled: boolean;
  remindersSyncEnabled: boolean;
  preferredWorkoutHour: number;
  preferredWorkoutMinute: number;
  workoutDurationMinutes: number;
  lastCalendarSyncAt?: string;
  calendarSyncedIds?: string[];
  reminderSyncedIds?: string[];
}

export type PlanTemplateKey = 'blank' | 'fbw3' | 'ppl' | 'upper_lower' | 'split4' | 'clone_current';

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

export type UserGender = 'male' | 'female';

export interface UserProfile {
  id: string;
  name: string;
  nickname?: string;
  nicknameUpdatedAt?: string;
  statusNote?: string;
  showActivityToFriends?: boolean;
  isOwner?: boolean;
  createdAt: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  gender?: UserGender;
  height?: number; // in cm (e.g. 180)
  weight?: number; // in kg (e.g. 60.1)
  cloudUserId?: string;
  cloudProvider?: 'apple' | 'google';
  cloudEmail?: string;
  lastCloudSyncAt?: string;
}

export interface FriendMuscleHighlight {
  muscleId: MuscleSubGroupId;
  rank: RankTier;
  effectiveSetsTotal: number;
}

export interface FriendPRHighlight {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
}

export interface FriendProfileSummary {
  userId: string;
  nickname: string;
  displayName: string;
  e2eePublicKey?: string | null;
  avatarColor?: string;
  avatarUrl?: string | null;
  gender?: UserGender;
  overallRank: RankTier;
  overallProgressPct: number;
  balanceScorePct: number;
  streak: number;
  totalWorkouts: number;
  totalSets: number;
  weeklyWorkouts: number;
  topMuscles: FriendMuscleHighlight[];
  recentPrs: FriendPRHighlight[];
  lastWorkoutAt?: string | null;
  lastActiveAt?: string | null;
  statusNote?: string;
  showActivityToFriends?: boolean;
  cheersCount?: number;
  cheeredByMe?: boolean;
}

export interface FriendRequestRecord {
  id: string;
  fromUserId: string;
  fromNickname: string;
  fromDisplayName: string;
  fromRank?: RankTier;
  fromAvatarColor?: string;
  fromAvatarUrl?: string | null;
  toUserId: string;
  toNickname: string;
  toDisplayName?: string;
  createdAt: string;
}

export type SocialActivityType = 'workout' | 'pr' | 'rank' | 'cheer' | 'status';

export interface SocialActivityItem {
  id: string;
  userId: string;
  nickname: string;
  displayName: string;
  avatarColor?: string;
  avatarUrl?: string | null;
  type: SocialActivityType;
  title: string;
  subtitle?: string;
  rankTier?: RankTier;
  createdAt: string;
  cheersCount: number;
  cheeredByMe?: boolean;
}

export type ChatMessageType =
  | 'text'
  | 'cheer'
  | 'workout_share'
  | 'rank_card'
  | 'voice'
  | 'image'
  | 'system';

export interface ChatMessagePayload {
  title?: string;
  subtitle?: string;
  rank?: RankTier;
  streak?: number;
  sets?: number;
  volumeKg?: number;
  emoji?: string;
  audioBase64?: string;
  audioMime?: string;
  durationSec?: number;
  waveform?: number[];
  imageBase64?: string;
  imageMime?: string;
  imageWidth?: number;
  imageHeight?: number;
  systemAction?: 'theme_change';
  actorName?: string;
  themeId?: string;
  wallpaperId?: string;
}

export interface SharedChatTheme {
  themeId: string;
  wallpaperId: string;
  customUri?: string | null;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  type: ChatMessageType;
  text: string;
  payload?: ChatMessagePayload;
  isEncrypted?: boolean;
  decryptFailed?: boolean;
  ciphertext?: string;
  nonce?: string;
  senderPublicKey?: string;
  recipientPublicKey?: string;
  alg?: string;
  editedAt?: string | null;
  createdAt: string;
  reactions?: Record<string, string[]>;
}

export interface FriendChatThreadSummary {
  friend: FriendProfileSummary;
  lastMessage?: ChatMessage | null;
  unreadCount: number;
}

export interface PendingCheerBurst {
  fromUserId: string;
  fromNickname: string;
  fromDisplayName: string;
  fromAvatarUrl?: string | null;
  count: number;
}

export interface SocialHubData {
  myProfile: FriendProfileSummary | null;
  friends: FriendChatThreadSummary[];
  incomingRequests: FriendRequestRecord[];
  outgoingRequests: FriendRequestRecord[];
  activities: SocialActivityItem[];
  pendingCheerBursts?: PendingCheerBurst[];
  totalUnread: number;
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
  exerciseSets?: { [exerciseId: string]: number };
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
  favoriteExerciseIds?: string[];
  prRecords: { [exerciseId: string]: PRRecord[] };
  history: WorkoutHistoryEntry[];
  weightHistory: WeightEntry[];
  settings?: AppSettings;
}
