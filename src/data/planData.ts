import { DayPlan, Exercise } from '../types/workout';
import { WORKOUT_PLAN as IMPORTED_PLAN, DAYS_OF_WEEK as IMPORTED_DAYS } from './myPlan';

export const DAYS_OF_WEEK = IMPORTED_DAYS;
export const WORKOUT_PLAN: DayPlan[] = IMPORTED_PLAN;

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
