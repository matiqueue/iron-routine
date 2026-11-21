import { cloneExercise } from '../data/exerciseLibrary';
import {
  DayPlan,
  DayProgress,
  Exercise,
  SessionExerciseConfig,
  WorkoutHistoryEntry,
} from '../types/workout';

/**
 * Merges a day's baseline exercises with any ad-hoc session additions and applies
 * the user's custom session ordering without mutating original plan definitions.
 */
export function resolveOrderedSessionExercises(
  baseExercises: Exercise[] = [],
  config?: SessionExerciseConfig
): Exercise[] {
  const combined: Exercise[] = baseExercises.map(cloneExercise);
  const existingIds = new Set(combined.map((e) => e.id));

  for (const extra of config?.addedExercises || []) {
    if (!existingIds.has(extra.id)) {
      combined.push(cloneExercise(extra));
      existingIds.add(extra.id);
    }
  }

  const orderedIds = config?.orderedIds;
  if (!orderedIds?.length) return combined;

  const byId = new Map(combined.map((e) => [e.id, e]));
  const ordered: Exercise[] = [];
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found) ordered.push(found);
  }
  for (const ex of combined) {
    if (!ordered.some((o) => o.id === ex.id)) ordered.push(ex);
  }
  return ordered;
}

/**
 * Returns active (non-skipped) exercises for a session; falls back to full list
 * if every exercise happened to be marked skipped.
 */
export function resolveActiveSessionExercises(
  baseExercises: Exercise[] = [],
  config?: SessionExerciseConfig
): { ordered: Exercise[]; active: Exercise[] } {
  const ordered = resolveOrderedSessionExercises(baseExercises, config);
  const skippedSet = new Set(config?.skippedIds || []);
  const filtered = ordered.filter((ex) => !skippedSet.has(ex.id));
  return {
    ordered,
    active: filtered.length > 0 ? filtered : ordered,
  };
}

/**
 * Resolves which exercise index the workout should open/resume on:
 * 1. Exact saved `activeExerciseId` if still in the active exercise list
 * 2. Otherwise the first exercise that still has uncompleted sets (when prior sets exist)
 * 3. Fallback to index 0
 */
export function resolveResumeExerciseIndex(
  activeExercises: Exercise[],
  setsMap: DayProgress['sets'] | undefined,
  preferredExerciseId?: string
): number {
  if (!activeExercises.length) return 0;

  if (preferredExerciseId) {
    const preferredIdx = activeExercises.findIndex((ex) => ex.id === preferredExerciseId);
    if (preferredIdx >= 0) return preferredIdx;
  }

  if (setsMap) {
    let anyCompleted = false;
    let firstIncompleteIdx = -1;
    for (let i = 0; i < activeExercises.length; i++) {
      const ex = activeExercises[i];
      const exSets = setsMap[ex.id] || {};
      const doneCount = Object.values(exSets).filter((s) => s?.completed).length;
      if (doneCount > 0) anyCompleted = true;
      if (firstIncompleteIdx === -1 && doneCount < ex.sets) {
        firstIncompleteIdx = i;
      }
    }
    if (anyCompleted) {
      return firstIncompleteIdx >= 0 ? firstIncompleteIdx : activeExercises.length - 1;
    }
  }

  return 0;
}

export function countCompletedSetsInProgress(progress?: DayProgress): number {
  if (!progress?.sets) return 0;
  let count = 0;
  for (const exSets of Object.values(progress.sets)) {
    for (const entry of Object.values(exSets || {})) {
      if (entry?.completed) count++;
    }
  }
  return count;
}

export interface SuggestedWorkoutResolution {
  dayId: string;
  reason: 'paused' | 'next_in_sequence' | 'scheduled_today' | 'first_workout' | 'rest';
}

/**
 * Sequence-first workout resolver so users aren't trapped by rigid weekday matching:
 * 1. If any workout day this week is currently paused (has completed sets and no finishedAt), resume it!
 * 2. Otherwise inspect workout history for the last completed workout day in this plan and pick the NEXT
 *    workout day in plan order (wrapping around).
 * 3. Fallback when history has no match yet: if today's weekday is a workout day pick today,
 *    otherwise pick the first workout day in the plan (only returning today's rest day if plan has 0 workout days).
 */
export function resolveSuggestedWorkoutDay(
  planDays: DayPlan[],
  workoutHistory: WorkoutHistoryEntry[],
  weekProgressMap: Record<string, DayProgress>,
  todayDayId: string
): SuggestedWorkoutResolution {
  const workoutDays = planDays.filter(
    (d) => d.type !== 'rest' && d.type !== 'walk' && (d.exercises?.length || 0) > 0
  );

  if (workoutDays.length === 0) {
    return { dayId: todayDayId, reason: 'rest' };
  }

  // Priority 1: In-progress / paused workout this week
  for (const d of workoutDays) {
    const prog = weekProgressMap[d.id];
    if (prog && !prog.finishedAt && countCompletedSetsInProgress(prog) > 0) {
      return { dayId: d.id, reason: 'paused' };
    }
  }

  // Priority 2: Next workout day in sequence after most recently completed workout
  const workoutDayIds = new Set(workoutDays.map((d) => d.id));
  for (const entry of workoutHistory) {
    if (entry?.dayId && workoutDayIds.has(entry.dayId)) {
      const lastIdx = workoutDays.findIndex((d) => d.id === entry.dayId);
      if (lastIdx >= 0) {
        const nextDay = workoutDays[(lastIdx + 1) % workoutDays.length];
        return { dayId: nextDay.id, reason: 'next_in_sequence' };
      }
    }
  }

  // Priority 3: Today if it's a workout day, else first workout day in sequence
  if (workoutDayIds.has(todayDayId)) {
    return { dayId: todayDayId, reason: 'scheduled_today' };
  }
  return { dayId: workoutDays[0].id, reason: 'first_workout' };
}
