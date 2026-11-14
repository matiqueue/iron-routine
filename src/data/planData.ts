import { DayPlan, Exercise } from '../types/workout';
import {
  buildPlanDaysFromTemplate,
  DEFAULT_DAYS_OF_WEEK,
  EXERCISE_LIBRARY,
  resolveCanonicalExerciseId,
} from './exerciseLibrary';

export const DAYS_OF_WEEK = DEFAULT_DAYS_OF_WEEK;
export const WORKOUT_PLAN: DayPlan[] = buildPlanDaysFromTemplate('blank');
export { EXERCISE_LIBRARY };

/**
 * Merges exercises from user plans, custom exercises, and the built-in gym catalog
 * while deduplicating by canonical ID (earlier arrays take precedence for reps/sets overrides).
 */
export function mergeAllExercises(...groups: Exercise[][]): Exercise[] {
  const seen = new Set<string>();
  const merged: Exercise[] = [];

  for (const group of groups) {
    for (const ex of group) {
      if (!ex?.id) continue;
      const cid = resolveCanonicalExerciseId(ex.id, ex.name);
      if (seen.has(cid)) continue;
      seen.add(cid);
      merged.push(cid === ex.id ? ex : { ...ex, id: cid });
    }
  }

  for (const libEx of EXERCISE_LIBRARY) {
    if (!seen.has(libEx.id)) {
      seen.add(libEx.id);
      merged.push(libEx);
    }
  }

  return merged;
}

export function getAllExercises(): Exercise[] {
  return EXERCISE_LIBRARY;
}

export function getExerciseById(id: string): Exercise | undefined {
  const cid = resolveCanonicalExerciseId(id);
  return EXERCISE_LIBRARY.find((e) => e.id === cid);
}
