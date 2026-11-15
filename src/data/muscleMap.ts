import {
  Exercise,
  MuscleSubGroupId,
  RankTier,
} from '../types/workout';
import { resolveCanonicalExerciseId } from './exerciseLibrary';
import {
  EXERCISE_MUSCLE_MAP,
  ExerciseMuscleAssignment,
  getInvolvedMuscleCategories,
  MUSCLE_SUBGROUP_MAP,
  MUSCLE_SUBGROUPS,
  MuscleSubGroupMeta,
} from './exerciseAnatomyMap';

export {
  EXERCISE_MUSCLE_MAP,
  ExerciseMuscleAssignment,
  getInvolvedMuscleCategories,
  MUSCLE_SUBGROUP_MAP,
  MUSCLE_SUBGROUPS,
  MuscleSubGroupMeta,
};

export interface RankTierMeta {
  tier: RankTier;
  index: number; // 0..7
  title: string;
  subtitle: string;
  minExerciseSets: number;
  nextExerciseSets: number | null;
  minMuscleSets: number;
  nextMuscleSets: number | null;
  color: string;
  glow: string;
  badgeBg: string;
  badgeBorder: string;
}

export const RANK_TIERS: RankTierMeta[] = [
  {
    tier: 'F',
    index: 0,
    title: 'Nieodkryty',
    subtitle: 'Brak lub pierwsze 7 dni na siłowni',
    minExerciseSets: 0,
    nextExerciseSets: 6,
    minMuscleSets: 0,
    nextMuscleSets: 8,
    color: '#71717A',
    glow: 'rgba(113, 113, 122, 0.18)',
    badgeBg: 'rgba(113, 113, 122, 0.12)',
    badgeBorder: 'rgba(113, 113, 122, 0.35)',
  },
  {
    tier: 'E',
    index: 1,
    title: 'Wdrażanie',
    subtitle: 'Pierwsze regularne serie po tygodniu treningów',
    minExerciseSets: 6,
    nextExerciseSets: 12,
    minMuscleSets: 8,
    nextMuscleSets: 18,
    color: '#A1A1AA',
    glow: 'rgba(161, 161, 170, 0.22)',
    badgeBg: 'rgba(161, 161, 170, 0.14)',
    badgeBorder: 'rgba(161, 161, 170, 0.4)',
  },
  {
    tier: 'D',
    index: 2,
    title: 'Adept Żelaza',
    subtitle: 'Adaptacja techniki i pierwszy miesiąc pracy',
    minExerciseSets: 12,
    nextExerciseSets: 22,
    minMuscleSets: 18,
    nextMuscleSets: 36,
    color: '#38BDF8',
    glow: 'rgba(56, 189, 248, 0.28)',
    badgeBg: 'rgba(56, 189, 248, 0.14)',
    badgeBorder: 'rgba(56, 189, 248, 0.45)',
  },
  {
    tier: 'C',
    index: 3,
    title: 'Regularny',
    subtitle: 'Solidny fundament objętości (1-3 miesiące)',
    minExerciseSets: 22,
    nextExerciseSets: 55,
    minMuscleSets: 36,
    nextMuscleSets: 95,
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.28)',
    badgeBg: 'rgba(16, 185, 129, 0.14)',
    badgeBorder: 'rgba(16, 185, 129, 0.45)',
  },
  {
    tier: 'B',
    index: 4,
    title: 'Zaawansowany',
    subtitle: 'Konsekwencja w mikrocyklach (3-6 miesięcy)',
    minExerciseSets: 55,
    nextExerciseSets: 115,
    minMuscleSets: 95,
    nextMuscleSets: 200,
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.30)',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeBorder: 'rgba(168, 85, 247, 0.50)',
  },
  {
    tier: 'A',
    index: 5,
    title: 'Weteran',
    subtitle: 'Silnie zbudowana partia (pół roku - rok)',
    minExerciseSets: 115,
    nextExerciseSets: 230,
    minMuscleSets: 200,
    nextMuscleSets: 420,
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.32)',
    badgeBg: 'rgba(245, 158, 11, 0.16)',
    badgeBorder: 'rgba(245, 158, 11, 0.55)',
  },
  {
    tier: 'S',
    index: 6,
    title: 'Mistrz Partii',
    subtitle: 'Wieloletni staż treningowy (1-3 lata)',
    minExerciseSets: 230,
    nextExerciseSets: 650,
    minMuscleSets: 420,
    nextMuscleSets: 1200,
    color: '#F43F5E',
    glow: 'rgba(244, 63, 94, 0.35)',
    badgeBg: 'rgba(244, 63, 94, 0.18)',
    badgeBorder: 'rgba(244, 63, 94, 0.60)',
  },
  {
    tier: 'S+',
    index: 7,
    title: 'Elita / Żelazny Szczyt',
    subtitle: 'Ponad 3 lata systematycznej pracy i żelaznej rutyny',
    minExerciseSets: 650,
    nextExerciseSets: null,
    minMuscleSets: 1200,
    nextMuscleSets: null,
    color: '#FFFFFF',
    glow: 'rgba(255, 255, 255, 0.45)',
    badgeBg: 'rgba(255, 255, 255, 0.20)',
    badgeBorder: '#FFFFFF',
  },
];

export const RANK_TIER_MAP: Record<RankTier, RankTierMeta> = RANK_TIERS.reduce(
  (acc, item) => {
    acc[item.tier] = item;
    return acc;
  },
  {} as Record<RankTier, RankTierMeta>
);

export function getExerciseRankMeta(setsDone: number): {
  meta: RankTierMeta;
  progressPct: number;
  setsToNext: number;
  nextTier: RankTier | null;
} {
  const val = Math.max(0, Math.round(setsDone * 10) / 10);
  let matched = RANK_TIERS[0];
  for (const r of RANK_TIERS) {
    if (val >= r.minExerciseSets) {
      matched = r;
    }
  }
  if (matched.nextExerciseSets === null) {
    return { meta: matched, progressPct: 100, setsToNext: 0, nextTier: null };
  }
  const span = matched.nextExerciseSets - matched.minExerciseSets;
  const into = val - matched.minExerciseSets;
  const pct = Math.min(100, Math.max(0, Math.round((into / span) * 100)));
  const setsToNext = Math.max(0, Math.ceil(matched.nextExerciseSets - val));
  const nextTier = RANK_TIERS[matched.index + 1]?.tier || null;
  return { meta: matched, progressPct: pct, setsToNext, nextTier };
}

export function getMuscleRankMeta(effectiveSets: number): {
  meta: RankTierMeta;
  progressPct: number;
  setsToNext: number;
  nextTier: RankTier | null;
} {
  const val = Math.max(0, Math.round(effectiveSets * 10) / 10);
  let matched = RANK_TIERS[0];
  for (const r of RANK_TIERS) {
    if (val >= r.minMuscleSets) {
      matched = r;
    }
  }
  if (matched.nextMuscleSets === null) {
    return { meta: matched, progressPct: 100, setsToNext: 0, nextTier: null };
  }
  const span = matched.nextMuscleSets - matched.minMuscleSets;
  const into = val - matched.minMuscleSets;
  const pct = Math.min(100, Math.max(0, Math.round((into / span) * 100)));
  const setsToNext = Math.max(0, Math.ceil((matched.nextMuscleSets - val) * 10) / 10);
  const nextTier = RANK_TIERS[matched.index + 1]?.tier || null;
  return { meta: matched, progressPct: pct, setsToNext, nextTier };
}

export function resolveExerciseMuscles(
  exercise: Pick<Exercise, 'id' | 'name' | 'category' | 'primaryMuscle' | 'secondaryMuscles'>
): ExerciseMuscleAssignment {
  if (exercise.primaryMuscle) {
    return {
      primary: exercise.primaryMuscle,
      secondary:
        exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0
          ? exercise.secondaryMuscles
          : [],
    };
  }

  const canonicalId = resolveCanonicalExerciseId(exercise.id, exercise.name);
  if (EXERCISE_MUSCLE_MAP[canonicalId]) {
    return EXERCISE_MUSCLE_MAP[canonicalId];
  }

  const n = (exercise.name || '').toLowerCase();

  // Keyword inference for custom user exercises
  if (n.includes('nadgarst') || n.includes('przedram') || n.includes('młotk') || n.includes('hammer') || n.includes('nachwyt')) {
    return { primary: 'forearms', secondary: [{ muscle: 'biceps', weight: 0.4 }] };
  }
  if (n.includes('łydk') || n.includes('wspięc') || n.includes('calf')) {
    return { primary: 'calves', secondary: [{ muscle: 'hamstrings', weight: 0.15 }] };
  }
  if (n.includes('kaptur') || n.includes('szrugs') || n.includes('shrug')) {
    return { primary: 'traps', secondary: [{ muscle: 'forearms', weight: 0.35 }, { muscle: 'mid_back', weight: 0.25 }] };
  }
  if (n.includes('skośn') || n.includes('twist') || n.includes('rotacj')) {
    return { primary: 'obliques', secondary: [{ muscle: 'abs', weight: 0.4 }] };
  }
  if (n.includes('przywodz') || n.includes('adduct')) {
    return { primary: 'adductors', secondary: [{ muscle: 'glutes', weight: 0.2 }] };
  }
  if (n.includes('poślad') || n.includes('hip thrust') || n.includes('abduct') || n.includes('odwodz')) {
    return { primary: 'glutes', secondary: [{ muscle: 'hamstrings', weight: 0.35 }, { muscle: 'quads', weight: 0.2 }] };
  }
  if (n.includes('dwugłow') || n.includes('rdl') || n.includes('rumuńsk') || n.includes('leg curl') || n.includes('uginanie nóg')) {
    return { primary: 'hamstrings', secondary: [{ muscle: 'glutes', weight: 0.4 }, { muscle: 'lower_back', weight: 0.25 }] };
  }
  if (n.includes('triceps') || n.includes('francusk') || n.includes('prostowanie ramion') || n.includes('jm press')) {
    return { primary: 'triceps', secondary: [{ muscle: 'forearms', weight: 0.2 }, { muscle: 'front_delts', weight: 0.15 }] };
  }
  if (n.includes('biceps') || n.includes('modlitewnik') || n.includes('supinac') || n.includes('uginanie ramion')) {
    return { primary: 'biceps', secondary: [{ muscle: 'forearms', weight: 0.3 }] };
  }
  if (n.includes('tył bark') || n.includes('odwrotne rozpiętki') || n.includes('rear delt') || n.includes('face pull')) {
    return { primary: 'rear_delts', secondary: [{ muscle: 'mid_back', weight: 0.35 }, { muscle: 'traps', weight: 0.25 }] };
  }
  if (n.includes('bokiem') || n.includes('lateral')) {
    return { primary: 'side_delts', secondary: [{ muscle: 'traps', weight: 0.2 }, { muscle: 'front_delts', weight: 0.15 }] };
  }
  if (n.includes('skos') && exercise.category === 'klatka') {
    return { primary: 'upper_chest', secondary: [{ muscle: 'front_delts', weight: 0.4 }, { muscle: 'triceps', weight: 0.35 }, { muscle: 'mid_lower_chest', weight: 0.3 }] };
  }
  if (n.includes('wiosłow') || n.includes('row') || n.includes('t-bar')) {
    return { primary: 'mid_back', secondary: [{ muscle: 'lats', weight: 0.45 }, { muscle: 'biceps', weight: 0.3 }, { muscle: 'rear_delts', weight: 0.3 }] };
  }
  if (n.includes('martwy ciąg') || n.includes('prostownik') || n.includes('rzymsk')) {
    return { primary: 'lower_back', secondary: [{ muscle: 'glutes', weight: 0.45 }, { muscle: 'hamstrings', weight: 0.4 }, { muscle: 'forearms', weight: 0.3 }] };
  }

  // Default fallback by broad category
  switch (exercise.category) {
    case 'klatka':
      return { primary: 'mid_lower_chest', secondary: [{ muscle: 'front_delts', weight: 0.35 }, { muscle: 'triceps', weight: 0.35 }, { muscle: 'upper_chest', weight: 0.25 }] };
    case 'plecy':
      return { primary: 'lats', secondary: [{ muscle: 'mid_back', weight: 0.4 }, { muscle: 'biceps', weight: 0.35 }, { muscle: 'forearms', weight: 0.25 }] };
    case 'nogi':
      return { primary: 'quads', secondary: [{ muscle: 'glutes', weight: 0.4 }, { muscle: 'adductors', weight: 0.25 }] };
    case 'barki':
      return { primary: 'front_delts', secondary: [{ muscle: 'side_delts', weight: 0.4 }, { muscle: 'triceps', weight: 0.3 }] };
    case 'ramiona':
      return { primary: 'biceps', secondary: [{ muscle: 'triceps', weight: 0.35 }, { muscle: 'forearms', weight: 0.25 }] };
    case 'brzuch':
      return { primary: 'abs', secondary: [{ muscle: 'obliques', weight: 0.35 }] };
    default:
      return { primary: 'quads', secondary: [{ muscle: 'glutes', weight: 0.35 }, { muscle: 'calves', weight: 0.3 }] };
  }
}
