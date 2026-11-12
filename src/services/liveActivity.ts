import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';

let currentActivityId: string | null = null;

export interface WorkoutLiveActivityParams {
  workoutName: string;
  exerciseName: string;
  currentSet: number; // 1-based index (e.g. 1 of 4)
  totalSets: number;
  completedSets: number;
  totalWorkoutSets: number;
  isRest?: boolean;
  restSeconds?: number;
  nextExerciseName?: string;
}

const DEFAULT_CONFIG: LiveActivity.LiveActivityConfig = {
  backgroundColor: '#121214',
  titleColor: '#FFFFFF',
  subtitleColor: '#A1A1AA',
  progressViewTint: '#FFFFFF',
  progressViewLabelColor: '#71717A',
  timerType: 'digital',
};

/**
 * Starts a persistent Lock Screen and Dynamic Island Live Activity for the active workout.
 */
export async function startWorkoutLiveActivity(params: WorkoutLiveActivityParams): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;

  try {
    // If an activity is already running, stop it first to prevent duplicates
    if (currentActivityId) {
      await stopWorkoutLiveActivity({
        summaryTitle: 'Nowy trening',
        summarySubtitle: 'Rozpoczęto nową sesję',
      });
    }

    const progress =
      params.totalWorkoutSets > 0
        ? Math.min(1, Math.max(0, params.completedSets / params.totalWorkoutSets))
        : 0;

    const activityId = LiveActivity.startActivity(
      {
        title: params.exerciseName,
        subtitle: `Seria ${params.currentSet} z ${params.totalSets} • ${params.workoutName}`,
        progressBar: { progress },
      },
      DEFAULT_CONFIG
    );

    if (activityId) {
      currentActivityId = activityId;
      return activityId;
    }
  } catch (error) {
    console.warn('[LiveActivity] Failed to start live activity:', error);
  }

  return null;
}

/**
 * Updates the existing workout Live Activity with real-time set, exercise, or rest countdown state.
 */
export async function updateWorkoutLiveActivity(params: WorkoutLiveActivityParams): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    // If no activity is active, try to start one
    if (!currentActivityId) {
      await startWorkoutLiveActivity(params);
      return;
    }

    if (params.isRest && params.restSeconds && params.restSeconds > 0) {
      const targetDate = Date.now() + params.restSeconds * 1000;
      const subtitle = params.nextExerciseName
        ? `Następnie: ${params.nextExerciseName}`
        : `Następnie: Seria ${params.currentSet} z ${params.totalSets}`;

      LiveActivity.updateActivity(currentActivityId, {
        title: 'Odpoczynek',
        subtitle,
        progressBar: { date: targetDate },
      });
    } else {
      const progress =
        params.totalWorkoutSets > 0
          ? Math.min(1, Math.max(0, params.completedSets / params.totalWorkoutSets))
          : 0;

      LiveActivity.updateActivity(currentActivityId, {
        title: params.exerciseName,
        subtitle: `Seria ${params.currentSet} z ${params.totalSets} • ${params.workoutName}`,
        progressBar: { progress },
      });
    }
  } catch (error) {
    console.warn('[LiveActivity] Failed to update live activity:', error);
  }
}

/**
 * Stops and cleanly dismisses the workout Live Activity.
 */
export async function stopWorkoutLiveActivity(summary?: {
  summaryTitle?: string;
  summarySubtitle?: string;
}): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    if (currentActivityId) {
      LiveActivity.stopActivity(currentActivityId, {
        title: summary?.summaryTitle || 'Trening ukończony! 🏆',
        subtitle: summary?.summarySubtitle || 'Świetna robota, regeneruj siły!',
        progressBar: { progress: 1.0 },
      });
      currentActivityId = null;
    }
  } catch (error) {
    console.warn('[LiveActivity] Failed to stop live activity:', error);
    currentActivityId = null;
  }
}
