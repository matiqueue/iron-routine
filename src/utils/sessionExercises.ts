import { cloneExercise } from '../data/exerciseLibrary';
import { Exercise, SessionExerciseConfig } from '../types/workout';

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
