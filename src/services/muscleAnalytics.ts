import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DayPlan,
  DayProgress,
  Exercise,
  MuscleSubGroupId,
  PRRecord,
  RankTier,
  WorkoutHistoryEntry,
} from '../types/workout';
import { resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import {
  getExerciseRankMeta,
  getMuscleRankMeta,
  MUSCLE_SUBGROUPS,
  MUSCLE_SUBGROUP_MAP,
  MuscleSubGroupMeta,
  RANK_TIERS,
  RankTierMeta,
  resolveExerciseMuscles,
} from '../data/muscleMap';

export type MusclePriorityStatus = 'neglected' | 'lagging' | 'balanced' | 'dominant';

export interface ExerciseRankStat {
  exerciseId: string;
  totalSets: number;
  recentSets30d: number;
  sessionsCount: number;
  lastTrainedDate?: string;
  rank: RankTier;
  rankMeta: RankTierMeta;
  progressPct: number;
  setsToNext: number;
  nextTier: RankTier | null;
  primaryMuscle: MuscleSubGroupId;
}

export interface MuscleRankStat {
  muscleId: MuscleSubGroupId;
  meta: MuscleSubGroupMeta;
  effectiveSetsTotal: number;
  effectiveSets30d: number;
  directSetsTotal: number;
  plannedWeeklySets: number;
  lastTrainedDate?: string;
  rank: RankTier;
  rankMeta: RankTierMeta;
  progressPct: number;
  setsToNext: number;
  nextTier: RankTier | null;
  /** 0..1 ratio vs user's strongest muscle */
  relativeDevelopmentRatio: number;
  /** Higher score = higher urgency to train next */
  priorityScore: number;
  priorityStatus: MusclePriorityStatus;
  statusLabel: string;
  recommendationText: string;
  recommendedExercises: Exercise[];
}

export interface PhysiqueAnalyticsReport {
  overallRank: RankTier;
  overallRankMeta: RankTierMeta;
  overallProgressPct: number;
  totalLifetimeSets: number;
  totalRecentSets30d: number;
  balanceScorePct: number;
  muscleStats: Record<MuscleSubGroupId, MuscleRankStat>;
  muscleStatsList: MuscleRankStat[];
  exerciseStats: Record<string, ExerciseRankStat>;
  topPriorities: MuscleRankStat[];
  strongestMuscles: MuscleRankStat[];
}

function getMondayDateOffset(mondayKey: string, dayId: string): string {
  const offsetMap: Record<string, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  };
  const base = new Date(mondayKey);
  if (isNaN(base.getTime())) return mondayKey;
  base.setDate(base.getDate() + (offsetMap[dayId] ?? 0));
  return base.toISOString().slice(0, 10);
}

export async function computePhysiqueAnalytics(params: {
  profileId: string;
  allExercises: Exercise[];
  activePlanDays: DayPlan[];
  workoutHistory: WorkoutHistoryEntry[];
}): Promise<PhysiqueAnalyticsReport> {
  const { profileId, allExercises, activePlanDays, workoutHistory } = params;

  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().slice(0, 10);

  const exerciseMap = new Map<string, Exercise>();
  for (const ex of allExercises) {
    const cid = resolveCanonicalExerciseId(ex.id, ex.name);
    if (!exerciseMap.has(cid)) {
      exerciseMap.set(cid, { ...ex, id: cid });
    }
  }

  const totalSetsByEx: Record<string, number> = {};
  const recent30dSetsByEx: Record<string, number> = {};
  const sessionDatesByEx: Record<string, Set<string>> = {};
  const lastDateByEx: Record<string, string> = {};

  const recordExerciseActivity = (canonicalId: string, setsCount: number, dateStr: string) => {
    if (setsCount <= 0) return;
    totalSetsByEx[canonicalId] = (totalSetsByEx[canonicalId] || 0) + setsCount;
    if (dateStr >= cutoff30Str) {
      recent30dSetsByEx[canonicalId] = (recent30dSetsByEx[canonicalId] || 0) + setsCount;
    }
    if (!sessionDatesByEx[canonicalId]) {
      sessionDatesByEx[canonicalId] = new Set();
    }
    sessionDatesByEx[canonicalId].add(dateStr);
    if (!lastDateByEx[canonicalId] || dateStr > lastDateByEx[canonicalId]) {
      lastDateByEx[canonicalId] = dateStr;
    }
  };

  const countedDayDates = new Set<string>();

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const weekPrefix = `@iron_routine_week_${profileId}_`;
    const prPrefix = `@iron_routine_prs_${profileId}_`;

    const weekKeys = allKeys.filter((k) => k.startsWith(weekPrefix));
    const prKeys = allKeys.filter((k) => k.startsWith(prPrefix));

    // 1. Scan all weekly progress logs
    await Promise.all(
      weekKeys.map(async (wKey) => {
        const mondayKey = wKey.slice(weekPrefix.length);
        const raw = await AsyncStorage.getItem(wKey);
        if (!raw) return;
        const weekData: Record<string, DayProgress> = JSON.parse(raw);
        for (const [dayId, dayProg] of Object.entries(weekData || {})) {
          const dateStr = dayProg?.finishedAt
            ? dayProg.finishedAt.slice(0, 10)
            : getMondayDateOffset(mondayKey, dayId);

          let dayHadSets = false;
          for (const [rawExId, setMap] of Object.entries(dayProg?.sets || {})) {
            let count = 0;
            for (const sEntry of Object.values(setMap || {})) {
              if (sEntry?.completed) count += 1;
            }
            if (count > 0) {
              dayHadSets = true;
              const cid = resolveCanonicalExerciseId(rawExId);
              recordExerciseActivity(cid, count, dateStr);
            }
          }
          if (dayHadSets) {
            countedDayDates.add(`${dateStr}_${dayId}`);
          }
        }
      })
    );

    // 2. Include workoutHistory entries that have exerciseSets not already in week logs
    for (const hist of workoutHistory) {
      const key = `${hist.date}_${hist.dayId}`;
      if (countedDayDates.has(key)) continue;
      if (hist.exerciseSets) {
        for (const [rawExId, count] of Object.entries(hist.exerciseSets)) {
          const cid = resolveCanonicalExerciseId(rawExId);
          recordExerciseActivity(cid, count, hist.date);
        }
        countedDayDates.add(key);
      }
    }

    // 3. Backfill from PR history for exercises where PR records exceed logged week sessions
    await Promise.all(
      prKeys.map(async (pKey) => {
        const rawExId = pKey.slice(prPrefix.length);
        const cid = resolveCanonicalExerciseId(rawExId);
        const raw = await AsyncStorage.getItem(pKey);
        if (!raw) return;
        const records: PRRecord[] = JSON.parse(raw);
        if (!Array.isArray(records) || records.length === 0) return;

        const existingDates = sessionDatesByEx[cid] || new Set<string>();
        const exDef = exerciseMap.get(cid);
        const fallbackSetsPerPR = Math.max(2, Math.min(4, exDef?.sets || 3));

        for (const rec of records) {
          const dStr = (rec.date || '').slice(0, 10);
          if (!dStr) continue;
          if (!existingDates.has(dStr)) {
            recordExerciseActivity(cid, fallbackSetsPerPR, dStr);
          }
        }
      })
    );
  } catch (e) {
    console.warn('Error computing physique analytics:', e);
  }

  // Build ExerciseRankStat map
  const exerciseStats: Record<string, ExerciseRankStat> = {};
  for (const ex of allExercises) {
    const cid = resolveCanonicalExerciseId(ex.id, ex.name);
    const totalSets = totalSetsByEx[cid] || 0;
    const recentSets30d = recent30dSetsByEx[cid] || 0;
    const sessionsCount = sessionDatesByEx[cid]?.size || 0;
    const lastTrainedDate = lastDateByEx[cid];
    const rankInfo = getExerciseRankMeta(totalSets);
    const muscleAssign = resolveExerciseMuscles(ex);

    const stat: ExerciseRankStat = {
      exerciseId: cid,
      totalSets,
      recentSets30d,
      sessionsCount,
      lastTrainedDate,
      rank: rankInfo.meta.tier,
      rankMeta: rankInfo.meta,
      progressPct: rankInfo.progressPct,
      setsToNext: rankInfo.setsToNext,
      nextTier: rankInfo.nextTier,
      primaryMuscle: muscleAssign.primary,
    };
    exerciseStats[cid] = stat;
    exerciseStats[ex.id] = stat;
  }

  // Planned weekly sets per sub-muscle from activePlanDays
  const plannedByMuscle: Record<MuscleSubGroupId, number> = {} as Record<MuscleSubGroupId, number>;
  const effTotalByMuscle: Record<MuscleSubGroupId, number> = {} as Record<MuscleSubGroupId, number>;
  const eff30dByMuscle: Record<MuscleSubGroupId, number> = {} as Record<MuscleSubGroupId, number>;
  const directTotalByMuscle: Record<MuscleSubGroupId, number> = {} as Record<MuscleSubGroupId, number>;
  const lastDateByMuscle: Record<MuscleSubGroupId, string | undefined> = {} as Record<
    MuscleSubGroupId,
    string | undefined
  >;

  for (const m of MUSCLE_SUBGROUPS) {
    plannedByMuscle[m.id] = 0;
    effTotalByMuscle[m.id] = 0;
    eff30dByMuscle[m.id] = 0;
    directTotalByMuscle[m.id] = 0;
  }

  for (const day of activePlanDays) {
    if (day.type !== 'workout' || !day.exercises?.length) continue;
    for (const ex of day.exercises) {
      const sets = ex.sets || 0;
      const assign = resolveExerciseMuscles(ex);
      plannedByMuscle[assign.primary] = (plannedByMuscle[assign.primary] || 0) + sets;
      for (const sec of assign.secondary) {
        plannedByMuscle[sec.muscle] =
          Math.round(((plannedByMuscle[sec.muscle] || 0) + sets * sec.weight) * 10) / 10;
      }
    }
  }

  // Accumulate effective muscle sets from all exercises with logged sets
  for (const [cid, setsCount] of Object.entries(totalSetsByEx)) {
    const exObj = exerciseMap.get(cid) || {
      id: cid,
      name: cid,
      category: 'ogolne' as const,
      sets: 3,
      reps: '8-12',
      rest: 90,
      description: '',
      imageUrl: '',
    };
    const assign = resolveExerciseMuscles(exObj);
    const recentCount = recent30dSetsByEx[cid] || 0;
    const lDate = lastDateByEx[cid];

    effTotalByMuscle[assign.primary] += setsCount;
    directTotalByMuscle[assign.primary] += setsCount;
    eff30dByMuscle[assign.primary] += recentCount;

    if (lDate && (!lastDateByMuscle[assign.primary] || lDate > lastDateByMuscle[assign.primary]!)) {
      lastDateByMuscle[assign.primary] = lDate;
    }

    for (const sec of assign.secondary) {
      effTotalByMuscle[sec.muscle] += setsCount * sec.weight;
      eff30dByMuscle[sec.muscle] += recentCount * sec.weight;
      if (lDate && (!lastDateByMuscle[sec.muscle] || lDate > lastDateByMuscle[sec.muscle]!)) {
        lastDateByMuscle[sec.muscle] = lDate;
      }
    }
  }

  // Compute max & median effective sets across the 19 muscles for relative balance
  const allEffValues = MUSCLE_SUBGROUPS.map((m) => effTotalByMuscle[m.id] || 0);
  const maxEffSets = Math.max(12, ...allEffValues);
  const sortedEff = [...allEffValues].sort((a, b) => a - b);
  const medianEffSets = sortedEff[Math.floor(sortedEff.length / 2)] || 0;
  const maxRankIndex = Math.max(
    1,
    ...MUSCLE_SUBGROUPS.map((m) => getMuscleRankMeta(effTotalByMuscle[m.id]).meta.index)
  );

  const muscleStats: Record<MuscleSubGroupId, MuscleRankStat> = {} as Record<
    MuscleSubGroupId,
    MuscleRankStat
  >;

  for (const m of MUSCLE_SUBGROUPS) {
    const effTotal = Math.round(effTotalByMuscle[m.id] * 10) / 10;
    const eff30d = Math.round(eff30dByMuscle[m.id] * 10) / 10;
    const directTotal = Math.round(directTotalByMuscle[m.id]);
    const planned = Math.round(plannedByMuscle[m.id] * 10) / 10;
    const rankInfo = getMuscleRankMeta(effTotal);
    const relativeRatio = Math.min(1, effTotal / maxEffSets);

    // Find best exercises for this muscle
    const primaryExercisesForMuscle = allExercises.filter(
      (ex) => resolveExerciseMuscles(ex).primary === m.id
    );

    const rankGap = maxRankIndex - rankInfo.meta.index;
    let priorityStatus: MusclePriorityStatus = 'balanced';
    let statusLabel = 'W normie';
    let priorityScore = Math.round((1 - relativeRatio) * 65);

    if (planned === 0) {
      priorityScore += 18;
    }
    if (eff30d < 4) {
      priorityScore += 17;
    }

    if (effTotal === 0 || (rankGap >= 2 && relativeRatio < 0.28)) {
      priorityStatus = 'neglected';
      statusLabel = 'Priorytet - Odstaje';
    } else if (rankGap >= 1 && relativeRatio < 0.55) {
      priorityStatus = 'lagging';
      statusLabel = 'Warto dopracować';
    } else if (relativeRatio >= 0.78 && effTotal >= 15) {
      priorityStatus = 'dominant';
      statusLabel = 'Partia dominująca';
    } else {
      priorityStatus = 'balanced';
      statusLabel = 'Zbalansowana';
    }

    const topRecEx = primaryExercisesForMuscle.slice(0, 3);
    const recNames = topRecEx.slice(0, 2).map((e) => e.name).join(' lub ');
    let recommendationText = '';
    if (priorityStatus === 'neglected') {
      recommendationText =
        planned === 0
          ? `Brak bezpośrednich serii w Twoim obecnym planie (${m.shortLabel}: Ranga ${rankInfo.meta.tier}). Dodaj ${recNames || 'ćwiczenie izolowane'} (${rankInfo.setsToNext} serii do rangi ${rankInfo.nextTier || 'E'}).`
          : `Partia odstaje względem reszty sylwetki (Ranga ${rankInfo.meta.tier}). Wykonaj ${rankInfo.setsToNext} serii (${recNames}), aby awansować na rangę ${rankInfo.nextTier || 'wyższą'}.`;
    } else if (priorityStatus === 'lagging') {
      recommendationText = `Brakuje ${rankInfo.setsToNext} efektywnych serii do rangi ${rankInfo.nextTier || 'S+'}. Dobry wybór na dziś: ${recNames}.`;
    } else if (priorityStatus === 'dominant') {
      recommendationText = `Jedna z Twoich najmocniej przepracowanych partii (${effTotal} serii efektywnych, Ranga ${rankInfo.meta.tier}). Podtrzymuj objętość.`;
    } else {
      recommendationText = `Rozwija się proporcjonalnie (${effTotal} serii, Ranga ${rankInfo.meta.tier}). Do rangi ${rankInfo.nextTier || 'S+'} zostało ${rankInfo.setsToNext} serii.`;
    }

    muscleStats[m.id] = {
      muscleId: m.id,
      meta: m,
      effectiveSetsTotal: effTotal,
      effectiveSets30d: eff30d,
      directSetsTotal: directTotal,
      plannedWeeklySets: planned,
      lastTrainedDate: lastDateByMuscle[m.id],
      rank: rankInfo.meta.tier,
      rankMeta: rankInfo.meta,
      progressPct: rankInfo.progressPct,
      setsToNext: rankInfo.setsToNext,
      nextTier: rankInfo.nextTier,
      relativeDevelopmentRatio: relativeRatio,
      priorityScore: Math.min(100, Math.max(0, priorityScore)),
      priorityStatus,
      statusLabel,
      recommendationText,
      recommendedExercises: topRecEx,
    };
  }

  const muscleStatsList = MUSCLE_SUBGROUPS.map((m) => muscleStats[m.id]);

  // Overall physique rank based on average effective sets across all 19 muscles
  const totalLifetimeSets = Object.values(totalSetsByEx).reduce((a, b) => a + b, 0);
  const totalRecentSets30d = Object.values(recent30dSetsByEx).reduce((a, b) => a + b, 0);
  const avgMuscleEffSets =
    allEffValues.reduce((a, b) => a + b, 0) / Math.max(1, MUSCLE_SUBGROUPS.length);
  const overallRankInfo = getMuscleRankMeta(avgMuscleEffSets);

  // Balance score (0..100%): measures how evenly distributed effective sets are across the 19 muscles
  let balanceScorePct = 0;
  if (totalLifetimeSets > 0) {
    const mean = avgMuscleEffSets;
    const variance =
      allEffValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / allEffValues.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;
    // Lower coefficient of variation = higher symmetry score
    const trainedRatio = allEffValues.filter((v) => v >= 3).length / allEffValues.length;
    balanceScorePct = Math.round(
      Math.max(18, Math.min(99, (1 - Math.min(1, cv * 0.55)) * 70 + trainedRatio * 30))
    );
  }

  const topPriorities = [...muscleStatsList]
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return a.effectiveSetsTotal - b.effectiveSetsTotal;
    })
    .slice(0, 3);

  const strongestMuscles = [...muscleStatsList]
    .sort((a, b) => b.effectiveSetsTotal - a.effectiveSetsTotal)
    .slice(0, 3);

  const fallbackMeta = RANK_TIERS[0];

  return {
    overallRank: totalLifetimeSets > 0 ? overallRankInfo.meta.tier : fallbackMeta.tier,
    overallRankMeta: totalLifetimeSets > 0 ? overallRankInfo.meta : fallbackMeta,
    overallProgressPct: totalLifetimeSets > 0 ? overallRankInfo.progressPct : 0,
    totalLifetimeSets,
    totalRecentSets30d,
    balanceScorePct,
    muscleStats,
    muscleStatsList,
    exerciseStats,
    topPriorities,
    strongestMuscles,
  };
}
