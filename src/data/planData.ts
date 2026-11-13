import { DayPlan, Exercise } from '../types/workout';
import { WORKOUT_PLAN as IMPORTED_PLAN, DAYS_OF_WEEK as IMPORTED_DAYS } from './myPlan';
import { EXERCISE_LIBRARY } from './exerciseLibrary';

export const DAYS_OF_WEEK = IMPORTED_DAYS;
export const WORKOUT_PLAN: DayPlan[] = IMPORTED_PLAN;
export { EXERCISE_LIBRARY };

/**
 * Merges exercises from user plans, custom exercises, and the built-in gym catalog
 * while deduplicating by ID (earlier arrays take precedence for reps/sets overrides).
 */
export function mergeAllExercises(...groups: Exercise[][]): Exercise[] {
  const seen = new Set<string>();
  const merged: Exercise[] = [];

  for (const group of groups) {
    for (const ex of group) {
      if (!ex?.id || seen.has(ex.id)) continue;
      seen.add(ex.id);
      merged.push(ex);
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
  const map = new Map<string, Exercise>();
  for (const day of WORKOUT_PLAN) {
    if (day.exercises) {
      for (const ex of day.exercises) {
        if (!map.has(ex.id)) {
          map.set(ex.id, ex);
        }
      }
    }
  }
  return Array.from(map.values());
}

export function getExerciseById(id: string): Exercise | undefined {
  for (const day of WORKOUT_PLAN) {
    if (day.exercises) {
      const found = day.exercises.find((e) => e.id === id);
      if (found) return found;
    }
  }
  return undefined;
}
