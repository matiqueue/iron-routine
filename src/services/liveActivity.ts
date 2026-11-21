import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';
import { getCurrentAppLanguage } from './settings';
import { translateText } from '../i18n/translations';

let currentActivityId: string | null = null;
let startPromise: Promise<string | null> | null = null;
let isLiveActivitySessionActive = false;

export interface WorkoutLiveActivityParams {
  workoutName: string;
  exerciseName: string;
  currentSet: number; // 1-based index (e.g. 1 of 4)
  totalSets: number;
  completedSets: number;
  totalWorkoutSets: number;
  isRest?: boolean;
  isRestPaused?: boolean;
  isRestFinished?: boolean;
  restSeconds?: number;
  pausedRestSeconds?: number;
  nextExerciseName?: string;
}

function formatLiveRestSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
  isLiveActivitySessionActive = true;
  if (startPromise) return startPromise;

  startPromise = (async () => {
    try {
      const lang = getCurrentAppLanguage();

      // Stop any prior tracked activity first to prevent duplicate Dynamic Island pills
      if (currentActivityId) {
        try {
          LiveActivity.stopActivity(currentActivityId, {
            title: translateText(lang, 'laNewWorkout'),
            subtitle: translateText(lang, 'laNewSession'),
            progressBar: { progress: 1.0 },
          });
        } catch {}
        currentActivityId = null;
      }

      if (!isLiveActivitySessionActive) return null;

      const progress =
        params.totalWorkoutSets > 0
          ? Math.min(1, Math.max(0, params.completedSets / params.totalWorkoutSets))
          : 0;

      const activityId = LiveActivity.startActivity(
        {
          title: params.exerciseName,
          subtitle: `${translateText(lang, 'laSetOfTotal', {
            current: params.currentSet,
            total: params.totalSets,
          })} • ${params.workoutName}`,
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
    } finally {
      startPromise = null;
    }

    return null;
  })();

  return startPromise;
}

/**
 * Updates the existing workout Live Activity with real-time set, exercise, or rest countdown state.
 */
export async function updateWorkoutLiveActivity(params: WorkoutLiveActivityParams): Promise<void> {
  if (Platform.OS !== 'ios' || !isLiveActivitySessionActive) return;

  try {
    if (startPromise) {
      await startPromise;
    }
    if (!isLiveActivitySessionActive) return;
    if (!currentActivityId) {
      await startWorkoutLiveActivity(params);
      return;
    }

    const progress =
      params.totalWorkoutSets > 0
        ? Math.min(1, Math.max(0, params.completedSets / params.totalWorkoutSets))
        : 0;

    const lang = getCurrentAppLanguage();
    const setLabel = translateText(lang, 'laSetOfTotal', {
      current: params.currentSet,
      total: params.totalSets,
    });

    if (params.isRestPaused) {
      const pausedTime = formatLiveRestSeconds(params.pausedRestSeconds ?? params.restSeconds ?? 0);
      LiveActivity.updateActivity(currentActivityId, {
        title: translateText(lang, 'laRestPaused', { time: pausedTime }),
        subtitle: `${params.exerciseName} • ${setLabel}`,
        progressBar: { progress },
      });
    } else if (params.isRestFinished) {
      LiveActivity.updateActivity(currentActivityId, {
        title: translateText(lang, 'laRestFinished'),
        subtitle: `${params.exerciseName} • ${setLabel}`,
        progressBar: { progress },
      });
    } else if (params.isRest && params.restSeconds && params.restSeconds > 0) {
      const targetDate = Date.now() + params.restSeconds * 1000;
      const subtitle = params.nextExerciseName
        ? translateText(lang, 'laNextEx', { name: params.nextExerciseName })
        : translateText(lang, 'laNextSet', {
            current: params.currentSet,
            total: params.totalSets,
          });

      LiveActivity.updateActivity(currentActivityId, {
        title: translateText(lang, 'restFallbackTitle'),
        subtitle,
        progressBar: { date: targetDate },
      });
    } else {
      LiveActivity.updateActivity(currentActivityId, {
        title: params.exerciseName,
        subtitle: `${setLabel} • ${params.workoutName}`,
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
  isLiveActivitySessionActive = false;
  if (Platform.OS !== 'ios') return;

  try {
    if (startPromise) {
      await startPromise.catch(() => {});
    }
    if (currentActivityId) {
      const lang = getCurrentAppLanguage();
      LiveActivity.stopActivity(currentActivityId, {
        title: summary?.summaryTitle || `${translateText(lang, 'workoutCompletedTitle')} 🏆`,
        subtitle: summary?.summarySubtitle || translateText(lang, 'laGreatJob'),
        progressBar: { progress: 1.0 },
      });
      currentActivityId = null;
    }
  } catch (error) {
    console.warn('[LiveActivity] Failed to stop live activity:', error);
    currentActivityId = null;
  }
}
