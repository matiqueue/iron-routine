import { cloneExercise } from '../data/exerciseLibrary';
import { DayProgress, Exercise, SessionExerciseConfig } from '../types/workout';

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
