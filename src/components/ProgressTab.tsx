import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import {
  DayPlan,
  Exercise,
  MuscleSubGroupId,
  PRRecord,
  RankTier,
  UserProfile,
  WeightEntry,
  WorkoutHistoryEntry,
  WorkoutPlan,
} from '../types/workout';
import {
  EXERCISE_LIBRARY,
  resolveCanonicalExerciseId,
} from '../data/exerciseLibrary';
import {
  getExerciseRankMeta,
  MUSCLE_SUBGROUPS,
  RANK_TIERS,
  RANK_TIER_MAP,
  resolveExerciseMuscles,
} from '../data/muscleMap';
import { mergeAllExercises, WORKOUT_PLAN } from '../data/planData';
import {
  addPRRecord,
  addWeightEntry,
  deletePRRecord,
  deleteWeightEntry,
  getAllBestPRs,
  getCustomExercises,
  getExerciseHistory,
  getWeightHistory,
  getWorkoutHistory,
  updateProfileStats,
} from '../services/storage';
import {
  computePhysiqueAnalytics,
  MuscleRankStat,
  PhysiqueAnalyticsReport,
} from '../services/muscleAnalytics';
import {
  AnimatedBodySilhouette,
  EnrichedExerciseRankStat,
} from './AnimatedBodySilhouette';
import { RankCrestIcon } from './RankCrestIcon';
import { BottomSheetScrollView, InteractiveBottomSheet } from './InteractiveBottomSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface ProgressTabProps {
  activeProfile?: UserProfile | null;
  activePlan?: WorkoutPlan | null;
  profilePlans?: WorkoutPlan[];
  profileId?: string;
  extraExercises?: Exercise[];
  refreshKey?: number;
  focusedExercise?: Exercise | null;
  onClearFocusedExercise?: () => void;
}

type SubViewTab = 'physique' | 'exercises' | 'journal';
type ChartRange = '7d' | '30d' | 'all';

const SUB_TABS: Array<{ id: SubViewTab; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap; a11y: string }> = [
  { id: 'physique', icon: 'body-outline', activeIcon: 'body', a11y: 'Sylwetka' },
  { id: 'exercises', icon: 'barbell-outline', activeIcon: 'barbell', a11y: 'Ćwiczenia' },
  { id: 'journal', icon: 'stats-chart-outline', activeIcon: 'stats-chart', a11y: 'Dziennik' },
];

const SLIDER_PADDING = 3;
const SLIDER_SLOT_W = 46;
const SLIDER_WIDTH = SLIDER_SLOT_W * 3 + SLIDER_PADDING * 2; // 144px

/**
 * Lightweight zero-JS-animation progress fill bar for instant tab switching.
 */
const AnimatedFillBar: React.FC<{
  pct: number;
  color: string;
  trackColor: string;
  height?: number;
  delayMs?: number;
}> = React.memo(({ pct, color, trackColor, height = 5 }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.barTrack, { backgroundColor: trackColor, height }]}>
      <View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            height,
            width: `${clamped}%`,
          },
        ]}
      />
    </View>
  );
});

const AnimatedVerticalSpectrumBar: React.FC<{
  pct: number;
  color: string;
  trackColor: string;
  isSelected: boolean;
  delayMs?: number;
}> = React.memo(({ pct, color, trackColor, isSelected }) => {
  const clamped = Math.max(10, Math.min(100, pct));
  return (
    <View
      style={[
        styles.spectrumColTrack,
        {
          backgroundColor: trackColor,
          borderColor: isSelected ? color : 'transparent',
          borderWidth: isSelected ? 1.5 : 0,
        },
      ]}
    >
      <View
        style={[
          styles.spectrumColFill,
          {
            backgroundColor: color,
            opacity: isSelected ? 1 : 0.85,
            height: `${clamped}%`,
          },
        ]}
      />
    </View>
  );
});

export const ProgressTab: React.FC<ProgressTabProps> = ({
  activeProfile,
  activePlan,
  profilePlans = [],
  profileId,
  extraExercises = [],
  refreshKey = 0,
  focusedExercise,
  onClearFocusedExercise,
}) => {
  const { theme, isDark } = useAppTheme();
  const effectiveProfileId = activeProfile?.id || profileId || 'default';

  // Top sub-view navigation + silky 120fps icon-only sliding pill thumb
  const [subView, setSubView] = useState<SubViewTab>('physique');
  const [sliderVisualIdx, setSliderVisualIdx] = useState(0);
  const subViewRef = useRef<SubViewTab>('physique');
  const grantXRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const hoverIdxRef = useRef(0);
  const navThumbAnim = useRef(new Animated.Value(0)).current;
  const navScaleAnim = useRef(new Animated.Value(1)).current;
  const viewFadeAnim = useRef(new Animated.Value(1)).current;

  const scrollViewRef = useRef<any>(null);

  useEffect(() => {
    subViewRef.current = subView;
    const idx = SUB_TABS.findIndex((t) => t.id === subView);
    if (idx >= 0) setSliderVisualIdx(idx);
  }, [subView]);

  // Silhouette & muscle states
  const [muscleSortMode, setMuscleSortMode] = useState<'priority' | 'rank'>('rank');
  const sortThumbAnim = useRef(new Animated.Value(0)).current;
  const [selectedRankTier, setSelectedRankTier] = useState<RankTier | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleSubGroupId | null>(null);
  const [expandedMuscleId, setExpandedMuscleId] = useState<MuscleSubGroupId | null>(null);
  const [showAllMuscles, setShowAllMuscles] = useState(false);
  const [physiqueReport, setPhysiqueReport] = useState<PhysiqueAnalyticsReport | null>(null);

  // Exercises sub-view filter & search
  const [muscleFilter, setMuscleFilter] = useState<MuscleSubGroupId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Exercise progression sheet
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [bestPRs, setBestPRs] = useState<{ [id: string]: PRRecord }>({});
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [prHistory, setPrHistory] = useState<PRRecord[]>([]);
  const [prChartRange, setPrChartRange] = useState<ChartRange>('all');
  const [manualWeight, setManualWeight] = useState('');
  const [manualReps, setManualReps] = useState('');

  // Journal sub-view state
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [weightChartRange, setWeightChartRange] = useState<ChartRange>('30d');
  const [newWeightInput, setNewWeightInput] = useState('');
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [showAllJournalWorkouts, setShowAllJournalWorkouts] = useState(false);

  const allExercises = useMemo(() => {
    const planExercises: Exercise[] = [];
    for (const p of profilePlans) {
      for (const d of p.days || []) {
        if (d.exercises) planExercises.push(...d.exercises);
      }
    }
    const merged = mergeAllExercises(customExercises, EXERCISE_LIBRARY);
    const seenNames = new Set(merged.map((e) => e.name.trim().toLowerCase()));
    const combinedExtras = [...extraExercises, ...planExercises];
    const extras: Exercise[] = [];
    for (const e of combinedExtras) {
      const lower = (e.name || '').trim().toLowerCase();
      if (lower && !seenNames.has(lower) && !merged.some((m) => m.id === e.id)) {
        seenNames.add(lower);
        extras.push(e);
      }
    }
    return [...merged, ...extras];
  }, [customExercises, extraExercises, profilePlans]);

  const activePlanDays: DayPlan[] = useMemo(
    () => (activePlan?.days?.length ? activePlan.days : WORKOUT_PLAN),
    [activePlan]
  );

  const loadAllAnalytics = useCallback(async () => {
    const [prs, weights, hist, custom] = await Promise.all([
      getAllBestPRs(effectiveProfileId),
      getWeightHistory(effectiveProfileId),
      getWorkoutHistory(effectiveProfileId),
      getCustomExercises(),
    ]);

    setBestPRs(prs);
    setWeightHistory(weights);
    setWorkoutHistory(hist);
    setCustomExercises(custom);

    const catalog = mergeAllExercises(custom, [
      ...EXERCISE_LIBRARY,
      ...extraExercises,
    ]);
    const report = await computePhysiqueAnalytics({
      profileId: effectiveProfileId,
      allExercises: catalog,
      activePlanDays,
      workoutHistory: hist,
    });
    setPhysiqueReport(report);
  }, [effectiveProfileId, extraExercises, activePlanDays]);

  useEffect(() => {
    loadAllAnalytics();
  }, [loadAllAnalytics, refreshKey]);

  const openExerciseDetail = useCallback(
    async (exercise: Exercise) => {
      try {
        Haptics.selectionAsync();
      } catch {}
      setSelectedExercise(exercise);
      const canonicalId = resolveCanonicalExerciseId(exercise.id, exercise.name);
      const history = await getExerciseHistory(canonicalId, effectiveProfileId);
      setPrHistory(history);
    },
    [effectiveProfileId]
  );

  useEffect(() => {
    if (focusedExercise) {
      openExerciseDetail(focusedExercise);
      onClearFocusedExercise?.();
    }
  }, [focusedExercise, openExerciseDetail, onClearFocusedExercise]);

  const handleSwitchSubView = useCallback(
    (next: SubViewTab, animateThumb = true) => {
      const targetIdx = SUB_TABS.findIndex((t) => t.id === next);
      if (targetIdx < 0) return;

      if (animateThumb) {
        Animated.parallel([
          Animated.spring(navThumbAnim, {
            toValue: targetIdx,
            friction: 7,
            tension: 110,
            useNativeDriver: true,
          }),
          Animated.spring(navScaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 120,
            useNativeDriver: true,
          }),
        ]).start();
      }

      if (next === subViewRef.current) return;

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      subViewRef.current = next;
      setSliderVisualIdx(targetIdx);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      viewFadeAnim.setValue(0.25);

      React.startTransition(() => {
        setSubView(next);
      });

      Animated.timing(viewFadeAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [navScaleAnim, navThumbAnim, viewFadeAnim]
  );

  const navPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const lx = Math.max(0, Math.min(SLIDER_WIDTH, evt.nativeEvent.locationX));
          grantXRef.current = lx;
          const curIdx = SUB_TABS.findIndex((t) => t.id === subViewRef.current);
          const touchedIdx = Math.max(
            0,
            Math.min(SUB_TABS.length - 1, Math.floor((lx - SLIDER_PADDING) / SLIDER_SLOT_W))
          );
          dragStartIndexRef.current = touchedIdx === curIdx ? curIdx : touchedIdx;
          hoverIdxRef.current = touchedIdx;
          setSliderVisualIdx(touchedIdx);
          try {
            Haptics.selectionAsync();
          } catch {}
          Animated.parallel([
            Animated.spring(navScaleAnim, {
              toValue: 0.94,
              friction: 8,
              tension: 140,
              useNativeDriver: true,
            }),
            Animated.spring(navThumbAnim, {
              toValue: touchedIdx,
              friction: 9,
              tension: 160,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderMove: (_, gestureState) => {
          const currentX = grantXRef.current + gestureState.dx;
          const rawIdx = (currentX - SLIDER_PADDING - SLIDER_SLOT_W / 2) / SLIDER_SLOT_W;
          const clampedIdx = Math.max(0, Math.min(SUB_TABS.length - 1, rawIdx));
          navThumbAnim.setValue(clampedIdx);

          const nearestIdx = Math.round(clampedIdx);
          if (nearestIdx !== hoverIdxRef.current) {
            hoverIdxRef.current = nearestIdx;
            setSliderVisualIdx(nearestIdx);
            try {
              Haptics.selectionAsync();
            } catch {}
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          const moved = Math.abs(gestureState.dx) > 4;
          const currentX = grantXRef.current + gestureState.dx;
          const targetIdx = moved
            ? Math.max(
                0,
                Math.min(
                  SUB_TABS.length - 1,
                  Math.round((currentX - SLIDER_PADDING - SLIDER_SLOT_W / 2) / SLIDER_SLOT_W)
                )
              )
            : Math.max(
                0,
                Math.min(
                  SUB_TABS.length - 1,
                  Math.floor((grantXRef.current - SLIDER_PADDING) / SLIDER_SLOT_W)
                )
              );

          const targetTab = SUB_TABS[targetIdx]?.id || subViewRef.current;
          handleSwitchSubView(targetTab, true);
        },
        onPanResponderTerminate: () => {
          const curIdx = SUB_TABS.findIndex((t) => t.id === subViewRef.current);
          setSliderVisualIdx(curIdx >= 0 ? curIdx : 0);
          Animated.parallel([
            Animated.spring(navThumbAnim, {
              toValue: curIdx >= 0 ? curIdx : 0,
              friction: 7,
              tension: 110,
              useNativeDriver: true,
            }),
            Animated.spring(navScaleAnim, {
              toValue: 1,
              friction: 6,
              tension: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [handleSwitchSubView, navScaleAnim, navThumbAnim]
  );

  const handleSwitchSortMode = (mode: 'rank' | 'priority') => {
    if (mode === muscleSortMode) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMuscleSortMode(mode);
    Animated.spring(sortThumbAnim, {
      toValue: mode === 'rank' ? 0 : 1,
      friction: 7,
      tension: 85,
      useNativeDriver: true,
    }).start();
  };

  const handleSelectMuscle = (muscleId: MuscleSubGroupId | null) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedMuscle(muscleId);
    if (muscleId) {
      setExpandedMuscleId(muscleId);
    }
  };

  const handleToggleMuscleRow = (muscleId: MuscleSubGroupId) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedMuscleId === muscleId) {
      setExpandedMuscleId(null);
      setSelectedMuscle(null);
    } else {
      setExpandedMuscleId(muscleId);
      setSelectedMuscle(muscleId);
    }
  };

  const handleAddManualPR = async () => {
    if (!selectedExercise) return;
    const w = parseFloat(manualWeight.replace(',', '.'));
    const r = parseInt(manualReps, 10);
    if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
      Alert.alert('Błędne dane', 'Podaj prawidłowy ciężar (kg) i liczbę powtórzeń.');
      return;
    }
    const canonicalId = resolveCanonicalExerciseId(selectedExercise.id, selectedExercise.name);
    await addPRRecord(
      canonicalId,
      selectedExercise.name,
      selectedExercise.category,
      w,
      r,
      undefined,
      effectiveProfileId
    );
    setManualWeight('');
    setManualReps('');
    const updatedHistory = await getExerciseHistory(canonicalId, effectiveProfileId);
    setPrHistory(updatedHistory);
    await loadAllAnalytics();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleDeletePRPoint = async (recordId: string) => {
    if (!selectedExercise) return;
    const canonicalId = resolveCanonicalExerciseId(selectedExercise.id, selectedExercise.name);
    await deletePRRecord(canonicalId, recordId, effectiveProfileId);
    const updated = await getExerciseHistory(canonicalId, effectiveProfileId);
    setPrHistory(updated);
    await loadAllAnalytics();
  };

  const handleSaveWeight = async () => {
    const val = parseFloat(newWeightInput.replace(',', '.'));
    if (isNaN(val) || val < 25 || val > 300) {
      Alert.alert('Nieprawidłowa waga', 'Wpisz wagę w kilogramach (np. 82.5).');
      return;
    }
    await addWeightEntry(val, undefined, undefined, effectiveProfileId);
    if (activeProfile) {
      await updateProfileStats(
        effectiveProfileId,
        activeProfile.height || 180,
        val
      ).catch(() => {});
    }
    setNewWeightInput('');
    await loadAllAnalytics();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleRemoveWeight = async (id: string) => {
    await deleteWeightEntry(id, effectiveProfileId);
    await loadAllAnalytics();
  };

  // Exercises grouped by muscle for the inline accordion & Exercises tab
  const exercisesByMuscle = useMemo(() => {
    const map: Record<MuscleSubGroupId, EnrichedExerciseRankStat[]> = {} as any;
    for (const m of MUSCLE_SUBGROUPS) {
      map[m.id] = [];
    }

    for (const ex of allExercises) {
      const canonicalId = resolveCanonicalExerciseId(ex.id, ex.name);
      const existingStat = physiqueReport?.exerciseStats[canonicalId];
      const primary = existingStat?.primaryMuscle || resolveExerciseMuscles(ex).primary;
      const fallbackMeta = getExerciseRankMeta(0);

      const enriched: EnrichedExerciseRankStat = existingStat
        ? { ...existingStat, exercise: ex }
        : {
            exerciseId: canonicalId,
            totalSets: 0,
            recentSets30d: 0,
            sessionsCount: 0,
            rank: fallbackMeta.meta.tier,
            rankMeta: fallbackMeta.meta,
            progressPct: fallbackMeta.progressPct,
            setsToNext: fallbackMeta.setsToNext,
            nextTier: fallbackMeta.nextTier,
            primaryMuscle: primary,
            exercise: ex,
          };

      if (map[primary] && !map[primary].some((item) => item.exerciseId === canonicalId)) {
        map[primary].push(enriched);
      }
    }

    for (const m of MUSCLE_SUBGROUPS) {
      map[m.id].sort((a, b) => {
        const aPR = bestPRs[a.exerciseId];
        const bPR = bestPRs[b.exerciseId];
        const aHasProgress = a.totalSets > 0 || Boolean(aPR) ? 1 : 0;
        const bHasProgress = b.totalSets > 0 || Boolean(bPR) ? 1 : 0;
        if (bHasProgress !== aHasProgress) return bHasProgress - aHasProgress;
        if (b.totalSets !== a.totalSets) return b.totalSets - a.totalSets;
        const a1RM = aPR?.estimated1RM || 0;
        const b1RM = bPR?.estimated1RM || 0;
        if (b1RM !== a1RM) return b1RM - a1RM;
        return a.exercise.name.localeCompare(b.exercise.name, 'pl');
      });
    }
    return map;
  }, [allExercises, physiqueReport, bestPRs]);

  const filteredMuscleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = MUSCLE_SUBGROUPS.filter((m) => {
      if (muscleFilter !== 'all' && m.id !== muscleFilter) return false;
      const list = exercisesByMuscle[m.id] || [];
      if (!q) return list.length > 0;
      return (
        m.label.toLowerCase().includes(q) ||
        list.some((ex) => ex.exercise.name.toLowerCase().includes(q))
      );
    });

    return [...matched].sort((a, b) => {
      const aStat = physiqueReport?.muscleStats[a.id];
      const bStat = physiqueReport?.muscleStats[b.id];
      const aExList = exercisesByMuscle[a.id] || [];
      const bExList = exercisesByMuscle[b.id] || [];
      const aExProgress = aExList.some((e) => e.totalSets > 0 || Boolean(bestPRs[e.exerciseId]));
      const bExProgress = bExList.some((e) => e.totalSets > 0 || Boolean(bestPRs[e.exerciseId]));
      const aHas = (aStat?.effectiveSetsTotal || 0) > 0 || aExProgress ? 1 : 0;
      const bHas = (bStat?.effectiveSetsTotal || 0) > 0 || bExProgress ? 1 : 0;
      if (bHas !== aHas) return bHas - aHas;
      const aScore = aStat?.effectiveSetsTotal || 0;
      const bScore = bStat?.effectiveSetsTotal || 0;
      if (bScore !== aScore) return bScore - aScore;
      return 0;
    });
  }, [muscleFilter, searchQuery, exercisesByMuscle, physiqueReport, bestPRs]);

  const orderedMuscleList = useMemo(() => {
    if (!physiqueReport) return [];
    let list = [...physiqueReport.muscleStatsList];
    if (selectedRankTier) {
      list = list.filter((m) => m.rank === selectedRankTier);
    }

    const hasMuscleProgress = (m: MuscleRankStat): number => {
      if (m.effectiveSetsTotal > 0) return 1;
      const groupEx = exercisesByMuscle[m.muscleId] || [];
      return groupEx.some((e) => e.totalSets > 0 || Boolean(bestPRs[e.exerciseId])) ? 1 : 0;
    };

    if (muscleSortMode === 'priority') {
      const priorityOrder: Record<MuscleRankStat['priorityStatus'], number> = {
        neglected: 0,
        lagging: 1,
        balanced: 2,
        dominant: 3,
        untrained: 4,
      };
      return list.sort((a, b) => {
        const bHas = hasMuscleProgress(b);
        const aHas = hasMuscleProgress(a);
        if (bHas !== aHas) return bHas - aHas;
        if (priorityOrder[a.priorityStatus] !== priorityOrder[b.priorityStatus]) {
          return priorityOrder[a.priorityStatus] - priorityOrder[b.priorityStatus];
        }
        return a.relativeDevelopmentRatio - b.relativeDevelopmentRatio;
      });
    }
    return list.sort((a, b) => {
      const bHas = hasMuscleProgress(b);
      const aHas = hasMuscleProgress(a);
      if (bHas !== aHas) return bHas - aHas;
      return b.effectiveSetsTotal - a.effectiveSetsTotal;
    });
  }, [physiqueReport, muscleSortMode, selectedRankTier, exercisesByMuscle, bestPRs]);

  const tierDistribution = useMemo(() => {
    const counts: Record<RankTier, number> = {
      F: 0,
      E: 0,
      D: 0,
      C: 0,
      B: 0,
      A: 0,
      S: 0,
      'S+': 0,
    };
    if (!physiqueReport) return counts;
    for (const m of physiqueReport.muscleStatsList) {
      counts[m.rank] = (counts[m.rank] || 0) + 1;
    }
    return counts;
  }, [physiqueReport]);

  // Muscles closest to unlocking their next rank emblem
  const closestToRankUp = useMemo(() => {
    if (!physiqueReport) return [];
    return [...physiqueReport.muscleStatsList]
      .filter((m) => m.nextTier !== null)
      .sort((a, b) => {
        if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
        return a.setsToNext - b.setsToNext;
      })
      .slice(0, 3);
  }, [physiqueReport]);

  const overallAverageProgress = useMemo(() => {
    if (!physiqueReport || physiqueReport.muscleStatsList.length === 0) return 0;
    const sum = physiqueReport.muscleStatsList.reduce((acc, m) => acc + m.progressPct, 0);
    return Math.round(sum / physiqueReport.muscleStatsList.length);
  }, [physiqueReport]);

  const filterByRange = <T extends { date: string }>(items: T[], range: ChartRange): T[] => {
    if (range === 'all') return items;
    const days = range === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 86400000;
    return items.filter((i) => new Date(i.date).getTime() >= cutoff);
  };

  const filteredWeightPoints = useMemo(
    () => filterByRange(weightHistory, weightChartRange),
    [weightHistory, weightChartRange]
  );

  const filteredPRPoints = useMemo(
    () => filterByRange(prHistory, prChartRange),
    [prHistory, prChartRange]
  );

  const last28Days = useMemo(() => {
    const workedDates = new Set(workoutHistory.map((h) => h.date.slice(0, 10)));
    const out: Array<{ key: string; label: string; active: boolean; isToday: boolean }> = [];
    const now = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        key: iso,
        label: String(d.getDate()),
        active: workedDates.has(iso),
        isToday: i === 0,
      });
    }
    return out;
  }, [workoutHistory]);

  const renderOpenLineChart = (
    points: Array<{ value: number; label: string }>,
    strokeColor: string,
    unitLabel: string
  ) => {
    if (points.length === 0) {
      return (
        <View style={styles.emptyChartOpen}>
          <Text style={[styles.emptyChartText, { color: theme.textMuted }]}>
            Brak zapisanych pomiarów w wybranym okresie
          </Text>
        </View>
      );
    }

    const chartW = SCREEN_WIDTH - 40;
    const chartH = 150;
    const padL = 8;
    const padR = 8;
    const padT = 18;
    const padB = 26;
    const innerW = chartW - padL - padR;
    const innerH = chartH - padT - padB;

    const vals = points.map((p) => p.value);
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = Math.max(1, maxVal - minVal);

    const coords = points.map((p, idx) => {
      const x =
        points.length === 1
          ? padL + innerW / 2
          : padL + (idx / (points.length - 1)) * innerW;
      const y =
        points.length === 1
          ? padT + innerH / 2
          : padT + innerH - ((p.value - minVal) / span) * innerH;
      return { x, y, ...p };
    });

    const lineD = coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');

    const areaD =
      coords.length > 1
        ? `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(
            1
          )} L ${coords[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
        : '';

    return (
      <View style={styles.openChartWrap}>
        <Svg width={chartW} height={chartH}>
          <Defs>
            <LinearGradient id="openChartGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </LinearGradient>
          </Defs>

          {[0, 0.5, 1].map((t, i) => {
            const y = padT + t * innerH;
            return (
              <Line
                key={i}
                x1={padL}
                y1={y}
                x2={chartW - padR}
                y2={y}
                stroke={theme.hairline}
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            );
          })}

          {areaD ? <Path d={areaD} fill="url(#openChartGrad)" /> : null}
          {coords.length > 1 ? (
            <Path
              d={lineD}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {coords.map((c, idx) => (
            <Circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={idx === coords.length - 1 ? 5 : 3.5}
              fill={idx === coords.length - 1 ? strokeColor : theme.bg}
              stroke={strokeColor}
              strokeWidth={2}
            />
          ))}
        </Svg>

        <View style={styles.chartAxisLabels}>
          <Text style={[styles.chartAxisText, { color: theme.textMuted }]}>
            Min: {minVal} {unitLabel}
          </Text>
          <Text style={[styles.chartAxisText, { color: theme.text }]}>
            Max: {maxVal} {unitLabel}
          </Text>
        </View>
      </View>
    );
  };

  const selectedExerciseCanonicalId = selectedExercise
    ? resolveCanonicalExerciseId(selectedExercise.id, selectedExercise.name)
    : null;
  const selectedExerciseRankStat =
    selectedExerciseCanonicalId && physiqueReport
      ? physiqueReport.exerciseStats[selectedExerciseCanonicalId]
      : null;

  const thumbTranslateX = navThumbAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, SLIDER_SLOT_W, SLIDER_SLOT_W * 2],
  });

  const visibleMuscles =
    selectedRankTier || showAllMuscles
      ? orderedMuscleList
      : orderedMuscleList.slice(0, 5);
  const canToggleMoreMuscles = !selectedRankTier && orderedMuscleList.length > 5;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Open Editorial Header with Silky 120fps Icon-Only Glass Pill Slider */}
      <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: theme.text }]}>Osiągi</Text>

          <View
            {...navPanResponder.panHandlers}
            style={[
              styles.navPills,
              {
                width: SLIDER_WIDTH,
                backgroundColor: isDark
                  ? 'rgba(39, 39, 42, 0.72)'
                  : 'rgba(244, 244, 245, 0.88)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.11)'
                  : 'rgba(24, 24, 27, 0.08)',
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.navPillAnimatedThumb,
                {
                  width: SLIDER_SLOT_W,
                  backgroundColor: theme.text,
                  transform: [
                    { translateX: thumbTranslateX },
                    { scale: navScaleAnim },
                  ],
                },
              ]}
            />
            {SUB_TABS.map((tab, idx) => {
              const active = sliderVisualIdx === idx;
              return (
                <View
                  key={tab.id}
                  pointerEvents="none"
                  accessibilityLabel={tab.a11y}
                  style={styles.navPillBtn}
                >
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={17}
                    color={active ? theme.bg : theme.textMuted}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: viewFadeAnim }}>
          {/* =========================================================
              SUB-VIEW 1: SYLWETKA (OPEN ANATOMY & MUSCLE RANKS)
             ========================================================= */}
          {subView === 'physique' && (
            <View style={styles.openPage}>
              {/* Open Hero Rank Showcase & Telemetry Strip */}
              <View style={[styles.heroShowcaseWrap, { borderBottomColor: theme.hairline }]}>
                <View style={styles.heroCrestBlock}>
                  <RankCrestIcon
                    tier={physiqueReport?.overallRank || 'F'}
                    size={58}
                    progressPct={overallAverageProgress}
                  />
                  <View style={styles.heroCrestTextCol}>
                    <Text style={[styles.heroCrestEyebrow, { color: theme.textMuted }]}>
                      RANGA OGÓLNA
                    </Text>
                    <Text style={[styles.heroCrestTitle, { color: theme.text }]}>
                      {physiqueReport?.overallRankMeta.title || 'Nowicjusz'}
                    </Text>
                    <Text
                      style={[
                        styles.heroCrestSub,
                        { color: physiqueReport?.overallRankMeta.color || theme.textSecondary },
                      ]}
                    >
                      Śr. postęp tieru: {overallAverageProgress}%
                    </Text>
                  </View>
                </View>

                <View style={styles.heroStatsRightRow}>
                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {physiqueReport?.balanceScorePct ?? 100}%
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      Balans
                    </Text>
                  </View>

                  <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {physiqueReport?.totalLifetimeSets ?? 0}
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      Serie
                    </Text>
                  </View>

                  <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {Object.keys(bestPRs).length}
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      Rekordy
                    </Text>
                  </View>
                </View>
              </View>

              {/* Open 2D Animated Anatomical Silhouette (Swipe to Rotate, Gender-aware) */}
              {physiqueReport && (
                <AnimatedBodySilhouette
                  gender={activeProfile?.gender || 'male'}
                  muscleStatsMap={physiqueReport.muscleStats}
                  selectedMuscle={selectedMuscle}
                  onSelectMuscle={handleSelectMuscle}
                  selectedMuscleExercises={
                    selectedMuscle ? exercisesByMuscle[selectedMuscle] || [] : []
                  }
                  onPressExercise={openExerciseDetail}
                />
              )}

              {/* Open Interactive Rank Evolution & Emblems (F -> S+) */}
              {physiqueReport && (
                <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                  <View style={styles.openSectionHeader}>
                    <View>
                      <Text
                        style={[
                          styles.sectionEyebrow,
                          { color: physiqueReport.overallRankMeta.color },
                        ]}
                      >
                        EMBLEMATY PROGRESJI (F - S+)
                      </Text>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        Drabina rang i odznak
                      </Text>
                    </View>
                    {selectedRankTier ? (
                      <TouchableOpacity
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch {}
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setSelectedRankTier(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sectionRightMeta, { color: theme.text }]}>
                          Pokaż wszystkie ({physiqueReport.muscleStatsList.length})
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                        Dotknij odznaki, by filtrować
                      </Text>
                    )}
                  </View>

                  {/* 8-Column Interactive Emblem + Spectrum Chart */}
                  <View style={styles.spectrumGridRow}>
                    {RANK_TIERS.map((tierObj, idx) => {
                      const count = tierDistribution[tierObj.tier] || 0;
                      const isSelected = selectedRankTier === tierObj.tier;
                      const heightPct =
                        count === 0
                          ? 12
                          : Math.min(100, Math.max(24, Math.round((count / 10) * 100)));

                      return (
                        <TouchableOpacity
                          key={tierObj.tier}
                          style={[
                            styles.spectrumColWrap,
                            isSelected && {
                              backgroundColor: `${tierObj.color}14`,
                              borderRadius: 14,
                            },
                          ]}
                          onPress={() => {
                            try {
                              Haptics.selectionAsync();
                            } catch {}
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setSelectedRankTier(
                              selectedRankTier === tierObj.tier ? null : tierObj.tier
                            );
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.spectrumCountLabel,
                              {
                                color: count > 0 ? theme.text : theme.textMuted,
                                opacity: count > 0 ? 1 : 0.45,
                              },
                            ]}
                          >
                            {count}
                          </Text>

                          <AnimatedVerticalSpectrumBar
                            pct={heightPct}
                            color={count > 0 || isSelected ? tierObj.color : theme.border}
                            trackColor={theme.bgSecondary}
                            isSelected={isSelected}
                            delayMs={idx * 40}
                          />

                          <RankCrestIcon
                            tier={tierObj.tier}
                            size={34}
                            isSelected={isSelected}
                            dimmed={count === 0 && !isSelected}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Selected Tier Info Strip */}
                  {selectedRankTier ? (
                    <View
                      style={[
                        styles.tierSpotlightRow,
                        {
                          borderLeftColor: RANK_TIER_MAP[selectedRankTier].color,
                          backgroundColor: theme.bgSecondary,
                        },
                      ]}
                    >
                      <RankCrestIcon tier={selectedRankTier} size={46} isSelected />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tierSpotlightTitle, { color: theme.text }]}>
                          Ranga {selectedRankTier} ({RANK_TIER_MAP[selectedRankTier].title}) ·{' '}
                          {tierDistribution[selectedRankTier]} z 19 partii
                        </Text>
                        <Text style={[styles.tierSpotlightSub, { color: theme.textSecondary }]}>
                          {RANK_TIER_MAP[selectedRankTier].subtitle} · próg: od{' '}
                          {RANK_TIER_MAP[selectedRankTier].minMuscleSets} serii partii ({RANK_TIER_MAP[selectedRankTier].minExerciseSets} serii ćwiczenia)
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Closest to Rank-Up Milestone Strip ("Najbliżej awansu") */}
                  {closestToRankUp.length > 0 && (
                    <View style={[styles.milestoneBlock, { borderTopColor: theme.hairline }]}>
                      <View style={styles.milestoneHeaderRow}>
                        <Ionicons name="sparkles-outline" size={13} color="#10B981" />
                        <Text style={[styles.milestoneHeaderTitle, { color: theme.textSecondary }]}>
                          NAJBLIŻEJ KOLEJNEJ RANGI
                        </Text>
                      </View>

                      {closestToRankUp.map((mStat, i) => (
                        <TouchableOpacity
                          key={mStat.muscleId}
                          style={styles.milestoneRow}
                          onPress={() => handleSelectMuscle(mStat.muscleId)}
                          activeOpacity={0.75}
                        >
                          <RankCrestIcon tier={mStat.rank} size={28} />
                          <View style={{ flex: 1, gap: 4 }}>
                            <View style={styles.milestoneTextLine}>
                              <Text style={[styles.milestoneMuscleName, { color: theme.text }]}>
                                {mStat.meta.label}
                              </Text>
                              <Text style={[styles.milestoneRemaining, { color: theme.textMuted }]}>
                                jeszcze {mStat.setsToNext} serii ({mStat.progressPct}%)
                              </Text>
                            </View>
                            <AnimatedFillBar
                              pct={mStat.progressPct}
                              color={
                                mStat.nextTier
                                  ? RANK_TIER_MAP[mStat.nextTier].color
                                  : mStat.rankMeta.color
                              }
                              trackColor={theme.bgSecondary}
                              height={4}
                              delayMs={i * 60}
                            />
                          </View>
                          <Ionicons
                            name="arrow-forward"
                            size={12}
                            color={theme.textMuted}
                          />
                          {mStat.nextTier && (
                            <RankCrestIcon tier={mStat.nextTier} size={28} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Open Coach Priority Section ("Co teraz robić") */}
              {physiqueReport && physiqueReport.topPriorities.length > 0 && (
                <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                  <View style={styles.openSectionHeader}>
                    <View>
                      <Text style={[styles.sectionEyebrow, { color: '#F59E0B' }]}>
                        REKOMENDACJA TRENINGOWA
                      </Text>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        Co teraz trenować?
                      </Text>
                    </View>
                    <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                      Top 3 priorytety
                    </Text>
                  </View>

                  {physiqueReport.topPriorities.map((stat) => {
                    const isFocused = selectedMuscle === stat.muscleId;
                    const topEx = (exercisesByMuscle[stat.muscleId] || [])[0];
                    const dotColor =
                      stat.priorityStatus === 'untrained'
                        ? '#71717A'
                        : '#F59E0B';

                    return (
                      <TouchableOpacity
                        key={stat.muscleId}
                        style={[
                          styles.priorityOpenRow,
                          { borderBottomColor: theme.hairline },
                        ]}
                        onPress={() => handleSelectMuscle(isFocused ? null : stat.muscleId)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.priorityAccentBar, { backgroundColor: dotColor }]} />

                        <View style={{ flex: 1, gap: 4 }}>
                          <View style={styles.priorityTitleLine}>
                            <Text style={[styles.priorityName, { color: theme.text }]}>
                              {stat.meta.label}
                            </Text>
                            <Text
                              style={[
                                styles.priorityReasonTag,
                                { color: dotColor },
                              ]}
                            >
                              {stat.priorityStatus === 'untrained'
                                ? 'Brak serii (0)'
                                : `${Math.round(stat.relativeDevelopmentRatio * 100)}% normy`}
                            </Text>
                          </View>

                          <Text
                            style={[styles.priorityHint, { color: theme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {topEx
                              ? `Polecane: ${topEx.exercise.name} (${topEx.totalSets} serii)`
                              : stat.recommendationText}
                          </Text>
                        </View>

                        <RankCrestIcon tier={stat.rank} size={34} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Open Full-Width Animated Muscle Ranking List (19 muscles, NO cards) */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <View style={styles.openSectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                      {selectedRankTier
                        ? `FILTR RANGI ${selectedRankTier} (${orderedMuscleList.length})`
                        : 'WSZYSTKIE PARTIE (19)'}
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      Rangi rozwoju mięśni
                    </Text>
                  </View>

                  <View style={[styles.sortPillsRow, { backgroundColor: theme.bgSecondary }]}>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.sortAnimatedThumb,
                        {
                          backgroundColor: theme.text,
                          transform: [
                            {
                              translateX: sortThumbAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 68],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                    <TouchableOpacity
                      style={styles.sortMiniPill}
                      onPress={() => handleSwitchSortMode('rank')}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.sortMiniText,
                          { color: muscleSortMode === 'rank' ? theme.bg : theme.textMuted },
                        ]}
                      >
                        Wg rangi
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sortMiniPill}
                      onPress={() => handleSwitchSortMode('priority')}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.sortMiniText,
                          { color: muscleSortMode === 'priority' ? theme.bg : theme.textMuted },
                        ]}
                      >
                        Braki
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {orderedMuscleList.length === 0 ? (
                  <Text style={[styles.inlineEmptyText, { color: theme.textMuted }]}>
                    Brak partii mięśniowych w wybranej randze {selectedRankTier}.
                  </Text>
                ) : (
                  <>
                    {visibleMuscles.map((stat, idx) => {
                      const isExpanded = expandedMuscleId === stat.muscleId;
                      const muscleExList = exercisesByMuscle[stat.muscleId] || [];
                      const barColor =
                        stat.effectiveSetsTotal === 0
                          ? '#71717A'
                          : stat.rankMeta.color;

                      return (
                        <View
                          key={stat.muscleId}
                          style={[
                            styles.muscleOpenRowWrap,
                            { borderBottomColor: theme.hairline },
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.muscleOpenRow}
                            onPress={() => handleToggleMuscleRow(stat.muscleId)}
                            activeOpacity={0.7}
                          >
                            <RankCrestIcon
                              tier={stat.rank}
                              size={38}
                              progressPct={stat.progressPct}
                            />

                            <View style={styles.muscleMiddleCol}>
                              <View style={styles.muscleRowHeaderLine}>
                                <Text style={[styles.muscleRowTitle, { color: theme.text }]}>
                                  {stat.meta.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.muscleRowSets,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {Math.round(stat.effectiveSetsTotal)} serii
                                  {stat.nextTier ? ` (+${stat.setsToNext} → ${stat.nextTier})` : ' (MAX)'}
                                </Text>
                              </View>

                              <AnimatedFillBar
                                pct={stat.progressPct}
                                color={barColor}
                                trackColor={theme.bgSecondary}
                                height={5}
                                delayMs={Math.min(idx * 25, 300)}
                              />
                            </View>

                            <Ionicons
                              name={isExpanded ? 'chevron-up' : 'chevron-forward'}
                              size={16}
                              color={theme.textMuted}
                            />
                          </TouchableOpacity>

                          {/* Smooth Inline Expanded Exercises for this Muscle */}
                          {isExpanded && (
                            <View style={styles.inlineExerciseList}>
                              {muscleExList.length === 0 ? (
                                <Text style={[styles.inlineEmptyText, { color: theme.textMuted }]}>
                                  Brak przypisanych ćwiczeń w bazie
                                </Text>
                              ) : (
                                muscleExList.map((exStat) => {
                                  const pr = bestPRs[exStat.exerciseId];
                                  return (
                                    <TouchableOpacity
                                      key={exStat.exerciseId}
                                      style={styles.inlineExerciseRow}
                                      onPress={() => openExerciseDetail(exStat.exercise)}
                                      activeOpacity={0.7}
                                    >
                                      <RankCrestIcon tier={exStat.rank} size={26} />
                                      <View style={{ flex: 1 }}>
                                        <Text
                                          style={[styles.inlineExName, { color: theme.text }]}
                                          numberOfLines={1}
                                        >
                                          {exStat.exercise.name}
                                        </Text>
                                        <Text
                                          style={[
                                            styles.inlineExSub,
                                            { color: theme.textMuted },
                                          ]}
                                        >
                                          {exStat.totalSets} serii
                                          {pr
                                            ? ` · PR ${pr.weight} kg × ${pr.reps}`
                                            : ' · Brak PR'}
                                        </Text>
                                      </View>
                                      <Ionicons
                                        name="stats-chart-outline"
                                        size={14}
                                        color={theme.textSecondary}
                                      />
                                    </TouchableOpacity>
                                  );
                                })
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {canToggleMoreMuscles && (
                      <TouchableOpacity
                        style={[
                          styles.loadAllMusclesBtn,
                          {
                            backgroundColor: theme.bgSecondary,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => {
                          try {
                            Haptics.selectionAsync();
                          } catch {}
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setShowAllMuscles((v) => !v);
                        }}
                        activeOpacity={0.78}
                      >
                        <Text style={[styles.loadAllMusclesText, { color: theme.text }]}>
                          {showAllMuscles
                            ? 'Pokaż mniej (top 5)'
                            : `Załaduj wszystkie partie (${orderedMuscleList.length})`}
                        </Text>
                        <Ionicons
                          name={showAllMuscles ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>
          )}

          {/* =========================================================
              SUB-VIEW 2: ĆWICZENIA (OPEN GROUPED EXERCISE RANKS F-S+)
             ========================================================= */}
          {subView === 'exercises' && (
            <View style={styles.openPage}>
              <View
                style={[
                  styles.openSearchRow,
                  { backgroundColor: theme.bgSecondary },
                ]}
              >
                <Ionicons name="search" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.openSearchInput, { color: theme.text }]}
                  placeholder="Szukaj ćwiczenia lub mięśnia..."
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillsScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor:
                        muscleFilter === 'all' ? theme.text : theme.bgSecondary,
                    },
                  ]}
                  onPress={() => setMuscleFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: muscleFilter === 'all' ? theme.bg : theme.textSecondary },
                    ]}
                  >
                    Wszystkie (19)
                  </Text>
                </TouchableOpacity>

                {MUSCLE_SUBGROUPS.map((m) => {
                  const active = muscleFilter === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: active ? theme.text : theme.bgSecondary,
                        },
                      ]}
                      onPress={() => setMuscleFilter(active ? 'all' : m.id)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: active ? theme.bg : theme.textSecondary },
                        ]}
                      >
                        {m.shortLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filteredMuscleGroups.map((mGroup) => {
                const mStat = physiqueReport?.muscleStats[mGroup.id];
                const q = searchQuery.trim().toLowerCase();
                const exList = (exercisesByMuscle[mGroup.id] || []).filter(
                  (e) =>
                    !q ||
                    e.exercise.name.toLowerCase().includes(q) ||
                    mGroup.label.toLowerCase().includes(q)
                );

                if (exList.length === 0) return null;

                return (
                  <View
                    key={mGroup.id}
                    style={[styles.openGroupBlock, { borderTopColor: theme.hairline }]}
                  >
                    <View style={styles.openGroupHeader}>
                      <View style={styles.openGroupTitleWrap}>
                        <RankCrestIcon tier={mStat?.rank || 'F'} size={30} />
                        <Text style={[styles.openGroupTitle, { color: theme.text }]}>
                          {mGroup.label}
                        </Text>
                      </View>
                      <Text style={[styles.openGroupMeta, { color: theme.textMuted }]}>
                        {Math.round(mStat?.effectiveSetsTotal || 0)} serii
                      </Text>
                    </View>

                    {exList.map((exStat, idx) => {
                      const pr = bestPRs[exStat.exerciseId];
                      return (
                        <TouchableOpacity
                          key={exStat.exerciseId}
                          style={[
                            styles.openExerciseItem,
                            { borderBottomColor: theme.hairline },
                          ]}
                          onPress={() => openExerciseDetail(exStat.exercise)}
                          activeOpacity={0.7}
                        >
                          <RankCrestIcon
                            tier={exStat.rank}
                            size={34}
                            progressPct={exStat.progressPct}
                          />

                          <View style={styles.openExBody}>
                            <View style={styles.openExTopLine}>
                              <Text
                                style={[styles.openExTitle, { color: theme.text }]}
                                numberOfLines={1}
                              >
                                {exStat.exercise.name}
                              </Text>
                              <Text
                                style={[
                                  styles.openExSetsCount,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {exStat.totalSets} serii
                              </Text>
                            </View>

                            <AnimatedFillBar
                              pct={exStat.progressPct}
                              color={exStat.rankMeta.color}
                              trackColor={theme.bgSecondary}
                              height={4}
                              delayMs={Math.min(idx * 20, 240)}
                            />

                            <View style={styles.openExBottomLine}>
                              <Text style={[styles.openExMeta, { color: theme.textMuted }]}>
                                {exStat.exercise.equipment || 'Ćwiczenie'} · {exStat.rankMeta.title}
                              </Text>
                              {pr ? (
                                <Text style={[styles.openExPR, { color: theme.text }]}>
                                  PR {pr.weight} kg × {pr.reps}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <Ionicons
                            name="chevron-forward"
                            size={15}
                            color={theme.textMuted}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}

          {/* =========================================================
              SUB-VIEW 3: DZIENNIK (WEIGHT & ACTIVITY LOG)
             ========================================================= */}
          {subView === 'journal' && (
            <View style={styles.openPage}>
              {/* Open Weight Section */}
              <View style={styles.openSectionNoBorder}>
                <View style={styles.openSectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                      MASA CIAŁA
                    </Text>
                    <View style={styles.weightHeroRow}>
                      <Text style={[styles.weightHeroBig, { color: theme.text }]}>
                        {weightHistory.length > 0
                          ? `${weightHistory[weightHistory.length - 1].weight} kg`
                          : activeProfile?.weight
                          ? `${activeProfile.weight} kg`
                          : '-- kg'}
                      </Text>
                      {weightHistory.length >= 2 && (
                        <Text
                          style={[
                            styles.weightDeltaText,
                            {
                              color:
                                weightHistory[weightHistory.length - 1].weight -
                                  weightHistory[0].weight <=
                                0
                                  ? '#10B981'
                                  : '#38BDF8',
                            },
                          ]}
                        >
                          {(
                            weightHistory[weightHistory.length - 1].weight -
                            weightHistory[0].weight
                          ).toFixed(1)}{' '}
                          kg od startu
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={[styles.rangePills, { backgroundColor: theme.bgSecondary }]}>
                    {(
                      [
                        { id: '7d', label: '7D' },
                        { id: '30d', label: '30D' },
                        { id: 'all', label: 'MAX' },
                      ] as const
                    ).map((r) => {
                      const active = weightChartRange === r.id;
                      return (
                        <TouchableOpacity
                          key={r.id}
                          style={[
                            styles.rangePillBtn,
                            active && { backgroundColor: theme.text },
                          ]}
                          onPress={() => setWeightChartRange(r.id)}
                        >
                          <Text
                            style={[
                              styles.rangePillText,
                              { color: active ? theme.bg : theme.textMuted },
                            ]}
                          >
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {renderOpenLineChart(
                  filteredWeightPoints.map((w) => ({
                    value: w.weight,
                    label: w.date.slice(5, 10),
                  })),
                  '#38BDF8',
                  'kg'
                )}

                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={[
                      styles.inlineInput,
                      {
                        backgroundColor: theme.bgSecondary,
                        color: theme.text,
                      },
                    ]}
                    placeholder="Wpisz dzisiejszą wagę (kg)..."
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    value={newWeightInput}
                    onChangeText={setNewWeightInput}
                  />
                  <TouchableOpacity
                    style={[styles.inlineActionBtn, { backgroundColor: theme.text }]}
                    onPress={handleSaveWeight}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.inlineActionBtnText, { color: theme.bg }]}>
                      Zapisz
                    </Text>
                  </TouchableOpacity>
                </View>

                {weightHistory
                  .slice(-5)
                  .reverse()
                  .map((w) => (
                    <View
                      key={w.id}
                      style={[styles.simpleLogRow, { borderBottomColor: theme.hairline }]}
                    >
                      <Text style={[styles.simpleLogDate, { color: theme.textMuted }]}>
                        {new Date(w.date).toLocaleDateString('pl-PL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={styles.simpleLogRight}>
                        <Text style={[styles.simpleLogVal, { color: theme.text }]}>
                          {w.weight} kg
                        </Text>
                        <TouchableOpacity onPress={() => handleRemoveWeight(w.id)}>
                          <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
              </View>

              {/* Open 28-Day Activity Matrix */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <View style={styles.openSectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                      REGULARNOŚĆ
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      Ostatnie 28 dni
                    </Text>
                  </View>
                  <Text style={[styles.sectionRightMeta, { color: theme.textSecondary }]}>
                    {last28Days.filter((d) => d.active).length} treningów
                  </Text>
                </View>

                <View style={styles.dotsGrid}>
                  {last28Days.map((day) => (
                    <View
                      key={day.key}
                      style={[
                        styles.dayDotBox,
                        {
                          backgroundColor: day.active
                            ? '#10B981'
                            : theme.bgSecondary,
                          borderColor: day.isToday ? theme.text : 'transparent',
                          borderWidth: day.isToday ? 1.5 : 0,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayDotLabel,
                          {
                            color: day.active ? '#09090B' : theme.textMuted,
                          },
                        ]}
                      >
                        {day.label}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Open Recent Workouts Timeline */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <View style={styles.openSectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                      HISTORIA SESJI
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      Ostatnie treningi
                    </Text>
                  </View>
                  {workoutHistory.length > 4 ? (
                    <TouchableOpacity
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowAllJournalWorkouts((v) => !v);
                      }}
                    >
                      <Text style={[styles.sectionRightMeta, { color: theme.text }]}>
                        {showAllJournalWorkouts ? 'Mniej' : `Wszystkie (${workoutHistory.length})`}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                      Łącznie {workoutHistory.length}
                    </Text>
                  )}
                </View>

                {workoutHistory.length === 0 ? (
                  <Text style={[styles.emptyLineText, { color: theme.textMuted }]}>
                    Nie ukończono jeszcze żadnego treningu
                  </Text>
                ) : (
                  (showAllJournalWorkouts ? workoutHistory.slice(-15) : workoutHistory.slice(-4))
                    .slice()
                    .reverse()
                    .map((entry, idx) => (
                      <View
                        key={`${entry.date}-${idx}`}
                        style={[styles.workoutLogRow, { borderBottomColor: theme.hairline }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.workoutLogTitle, { color: theme.text }]}>
                            {entry.dayName}
                          </Text>
                          <Text style={[styles.workoutLogSub, { color: theme.textMuted }]}>
                            {new Date(entry.date).toLocaleDateString('pl-PL', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                            })}
                            {entry.durationMinutes ? ` · ${entry.durationMinutes} min` : ''}
                            {entry.totalVolumeKg
                              ? ` · ${entry.totalVolumeKg.toLocaleString('pl-PL')} kg`
                              : ''}
                          </Text>
                        </View>
                        <Text style={[styles.workoutLogSets, { color: theme.textSecondary }]}>
                          {entry.completedSets}/{entry.totalSets} serii
                        </Text>
                      </View>
                    ))
                )}
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* =========================================================
          EXERCISE DETAIL & 1RM PROGRESSION BOTTOM SHEET (OPEN STYLE)
         ========================================================= */}
      <InteractiveBottomSheet
        visible={selectedExercise !== null}
        onClose={() => setSelectedExercise(null)}
        title={selectedExercise?.name || 'Progresja ćwiczenia'}
        subtitle={
          selectedExerciseRankStat
            ? `Ranga ${selectedExerciseRankStat.rank} (${selectedExerciseRankStat.rankMeta.title}) · ${selectedExerciseRankStat.totalSets} serii`
            : 'Historia rekordów 1RM i serii'
        }
        initialHeightPercent={0.86}
      >
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {selectedExerciseRankStat && (
              <View
                style={[
                  styles.sheetRankStrip,
                  { borderBottomColor: theme.hairline },
                ]}
              >
                <View style={styles.sheetRankTop}>
                  <RankCrestIcon
                    tier={selectedExerciseRankStat.rank}
                    size={54}
                    progressPct={selectedExerciseRankStat.progressPct}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetRankTitle, { color: theme.text }]}>
                      {selectedExerciseRankStat.rankMeta.title}
                    </Text>
                    <Text style={[styles.sheetRankSub, { color: theme.textMuted }]}>
                      {selectedExerciseRankStat.nextTier
                        ? `Brakuje ${selectedExerciseRankStat.setsToNext} serii do rangi ${selectedExerciseRankStat.nextTier}`
                        : 'Osiągnięto najwyższą rangę S+'}
                    </Text>
                  </View>
                  <Text style={[styles.sheetSetsCount, { color: theme.text }]}>
                    {selectedExerciseRankStat.totalSets} serii
                  </Text>
                </View>

                <AnimatedFillBar
                  pct={selectedExerciseRankStat.progressPct}
                  color={selectedExerciseRankStat.rankMeta.color}
                  trackColor={theme.bgSecondary}
                  height={6}
                />
              </View>
            )}

            {/* 1RM Progression Chart */}
            <View style={styles.sheetSection}>
              <View style={styles.openSectionHeader}>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  Estymowany 1RM (kg)
                </Text>
                <View style={[styles.rangePills, { backgroundColor: theme.bgSecondary }]}>
                  {(
                    [
                      { id: '7d', label: '7D' },
                      { id: '30d', label: '30D' },
                      { id: 'all', label: 'MAX' },
                    ] as const
                  ).map((r) => {
                    const active = prChartRange === r.id;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.rangePillBtn,
                          active && { backgroundColor: theme.text },
                        ]}
                        onPress={() => setPrChartRange(r.id)}
                      >
                        <Text
                          style={[
                            styles.rangePillText,
                            { color: active ? theme.bg : theme.textMuted },
                          ]}
                        >
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {renderOpenLineChart(
                filteredPRPoints.map((p) => ({
                  value: p.estimated1RM,
                  label: p.date.slice(5, 10),
                })),
                selectedExerciseRankStat?.rankMeta.color || '#10B981',
                'kg'
              )}
            </View>

            {/* Manual PR Entry */}
            <View style={[styles.sheetSection, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                DODAJ WYNIK RĘCZNIE
              </Text>
              <View style={styles.inlineInputRow}>
                <TextInput
                  style={[
                    styles.inlineInput,
                    { backgroundColor: theme.bgSecondary, color: theme.text },
                  ]}
                  placeholder="Ciężar (kg)"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  value={manualWeight}
                  onChangeText={setManualWeight}
                />
                <TextInput
                  style={[
                    styles.inlineInput,
                    { backgroundColor: theme.bgSecondary, color: theme.text },
                  ]}
                  placeholder="Powtórzenia"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  value={manualReps}
                  onChangeText={setManualReps}
                />
                <TouchableOpacity
                  style={[styles.inlineActionBtn, { backgroundColor: theme.text }]}
                  onPress={handleAddManualPR}
                >
                  <Text style={[styles.inlineActionBtnText, { color: theme.bg }]}>
                    Dodaj
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* PR History List */}
            <View style={[styles.sheetSection, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                ZAPISANE REKORDY ({prHistory.length})
              </Text>
              {prHistory.length === 0 ? (
                <Text style={[styles.emptyLineText, { color: theme.textMuted }]}>
                  Brak zapisanych wyników dla tego ćwiczenia
                </Text>
              ) : (
                [...prHistory].reverse().map((rec) => (
                  <View
                    key={rec.id}
                    style={[styles.simpleLogRow, { borderBottomColor: theme.hairline }]}
                  >
                    <Text style={[styles.simpleLogDate, { color: theme.textMuted }]}>
                      {new Date(rec.date).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                    <View style={styles.simpleLogRight}>
                      <Text style={[styles.simpleLogVal, { color: theme.text }]}>
                        {rec.weight} kg × {rec.reps} (~{rec.estimated1RM} kg)
                      </Text>
                      <TouchableOpacity onPress={() => handleDeletePRPoint(rec.id)}>
                        <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          </BottomSheetScrollView>
      </InteractiveBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.7,
    flexShrink: 0,
  },
  navPills: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 999,
    padding: SLIDER_PADDING,
    borderWidth: 1,
    overflow: 'hidden',
  },
  navPillAnimatedThumb: {
    position: 'absolute',
    top: SLIDER_PADDING,
    bottom: SLIDER_PADDING,
    left: SLIDER_PADDING,
    borderRadius: 999,
  },
  navPillBtn: {
    width: SLIDER_SLOT_W,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    zIndex: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  openPage: {
    paddingTop: 6,
  },
  heroShowcaseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    gap: 10,
  },
  heroCrestBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1.15,
  },
  heroCrestTextCol: {
    flex: 1,
  },
  heroCrestEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroCrestTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  heroCrestSub: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  heroStatsRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  heroMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  verticalHairline: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  openSection: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  openSectionNoBorder: {
    paddingTop: 10,
  },
  openSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionRightMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  spectrumGridRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 4,
  },
  spectrumColWrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  spectrumCountLabel: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  spectrumColTrack: {
    width: 14,
    height: 68,
    borderRadius: 999,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  spectrumColFill: {
    width: '100%',
    borderRadius: 999,
  },
  tierSpotlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 3,
    borderRadius: 12,
  },
  tierSpotlightTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  tierSpotlightSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  milestoneBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  milestoneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  milestoneTextLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneMuscleName: {
    fontSize: 13,
    fontWeight: '700',
  },
  milestoneRemaining: {
    fontSize: 11,
    fontWeight: '600',
  },
  priorityOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  priorityAccentBar: {
    width: 3,
    height: 34,
    borderRadius: 2,
  },
  priorityTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityName: {
    fontSize: 15,
    fontWeight: '700',
  },
  priorityReasonTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  priorityHint: {
    fontSize: 12,
  },
  sortPillsRow: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 999,
    padding: 2,
    overflow: 'hidden',
  },
  sortAnimatedThumb: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    width: 68,
    borderRadius: 999,
  },
  sortMiniPill: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    borderRadius: 999,
    zIndex: 2,
  },
  sortMiniText: {
    fontSize: 11,
    fontWeight: '700',
  },
  muscleOpenRowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  muscleOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
  },
  muscleMiddleCol: {
    flex: 1,
    gap: 6,
  },
  muscleRowHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muscleRowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  muscleRowSets: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 999,
  },
  inlineExerciseList: {
    paddingLeft: 44,
    paddingBottom: 12,
    gap: 8,
  },
  inlineEmptyText: {
    fontSize: 12,
    paddingVertical: 4,
  },
  inlineExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  inlineExName: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineExSub: {
    fontSize: 11,
    marginTop: 1,
  },
  loadAllMusclesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  loadAllMusclesText: {
    fontSize: 13,
    fontWeight: '800',
  },
  openSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 8,
    marginBottom: 10,
  },
  openSearchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterPillsScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  openGroupBlock: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  openGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  openGroupTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openGroupTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  openGroupMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  openExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  openExBody: {
    flex: 1,
    gap: 5,
  },
  openExTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  openExTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  openExSetsCount: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  openExBottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  openExMeta: {
    fontSize: 11,
    fontWeight: '500',
  },
  openExPR: {
    fontSize: 11,
    fontWeight: '700',
  },
  weightHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  weightHeroBig: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  weightDeltaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rangePills: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 2,
  },
  rangePillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  openChartWrap: {
    marginVertical: 10,
  },
  chartAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chartAxisText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyChartOpen: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyChartText: {
    fontSize: 13,
  },
  inlineInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  inlineInput: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: '600',
  },
  inlineActionBtn: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  inlineActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  simpleLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  simpleLogDate: {
    fontSize: 13,
  },
  simpleLogRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  simpleLogVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  dayDotBox: {
    width: (SCREEN_WIDTH - 40 - 6 * 8) / 7,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyLineText: {
    fontSize: 13,
    paddingVertical: 10,
  },
  workoutLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workoutLogTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  workoutLogSub: {
    fontSize: 12,
    marginTop: 2,
  },
  workoutLogSets: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sheetRankStrip: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sheetRankTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetRankTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetRankSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetSetsCount: {
    fontSize: 15,
    fontWeight: '800',
  },
  sheetSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
