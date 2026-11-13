import type { UserProfile, WorkoutPlan } from '../types/workout';

export interface LocalDeviceSeedConfig {
  seedVersion: string;
  profile: UserProfile;
  plans: WorkoutPlan[];
  activePlanId: string;
  replaceExampleProfiles?: boolean;
}

// Public builds intentionally contain zero preloaded example profiles or plans.
export const LOCAL_DEVICE_SEED: LocalDeviceSeedConfig | null = null;
