import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
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
  SilhouetteColorMode,
} from './AnimatedBodySilhouette';
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

/**
 * Smoothly animated horizontal progress bar that fills on mount/update.
 */
const AnimatedFillBar: React.FC<{
  pct: number;
  color: string;
  trackColor: string;
  height?: number;
  delayMs?: number;
}> = ({ pct, color, trackColor, height = 5, delayMs = 0 }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const timing = Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, pct)),
      duration: 560,
      delay: delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    timing.start();
    return () => timing.stop();
  }, [pct, delayMs, anim]);

  return (
    <View style={[styles.barTrack, { backgroundColor: trackColor, height }]}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            height,
            width: anim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </View>
  );
};

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
  const { theme } = useAppTheme();
  const effectiveProfileId = activeProfile?.id || profileId || 'default';

  // Top sub-view navigation
  const [subView, setSubView] = useState<SubViewTab>('physique');
  const viewFadeAnim = useRef(new Animated.Value(1)).current;
  const viewSlideAnim = useRef(new Animated.Value(0)).current;

  // Silhouette & muscle states
  const [colorMode, setColorMode] = useState<SilhouetteColorMode>('priority');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleSubGroupId | null>(null);
  const [expandedMuscleId, setExpandedMuscleId] = useState<MuscleSubGroupId | null>(null);
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

  const handleSwitchSubView = (next: SubViewTab) => {
    if (next === subView) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    viewFadeAnim.setValue(0);
    viewSlideAnim.setValue(12);
    setSubView(next);

    Animated.parallel([
      Animated.timing(viewFadeAnim, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(viewSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
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
        if (b.totalSets !== a.totalSets) return b.totalSets - a.totalSets;
        return a.exercise.name.localeCompare(b.exercise.name, 'pl');
      });
    }
    return map;
  }, [allExercises, physiqueReport]);

  const filteredMuscleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MUSCLE_SUBGROUPS.filter((m) => {
      if (muscleFilter !== 'all' && m.id !== muscleFilter) return false;
      const list = exercisesByMuscle[m.id] || [];
      if (!q) return list.length > 0;
      return (
        m.label.toLowerCase().includes(q) ||
        list.some((ex) => ex.exercise.name.toLowerCase().includes(q))
      );
    });
  }, [muscleFilter, searchQuery, exercisesByMuscle]);

  const orderedMuscleList = useMemo(() => {
    if (!physiqueReport) return [];
    const list = [...physiqueReport.muscleStatsList];
    if (colorMode === 'priority') {
      const priorityOrder: Record<MuscleRankStat['priorityStatus'], number> = {
        neglected: 0,
        lagging: 1,
        balanced: 2,
        dominant: 3,
      };
      return list.sort((a, b) => {
        if (priorityOrder[a.priorityStatus] !== priorityOrder[b.priorityStatus]) {
          return priorityOrder[a.priorityStatus] - priorityOrder[b.priorityStatus];
        }
        return a.relativeDevelopmentRatio - b.relativeDevelopmentRatio;
      });
    }
    return list.sort((a, b) => b.effectiveSetsTotal - a.effectiveSetsTotal);
  }, [physiqueReport, colorMode]);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Open Editorial Header */}
      <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Osiągi</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Anatomia · Rangi F-S+ · Progresja
            </Text>
          </View>

          <View style={[styles.navPills, { backgroundColor: theme.bgSecondary }]}>
            {(
              [
                { id: 'physique', label: 'Sylwetka' },
                { id: 'exercises', label: 'Ćwiczenia' },
                { id: 'journal', label: 'Dziennik' },
              ] as const
            ).map((tab) => {
              const active = subView === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.navPillBtn,
                    active && { backgroundColor: theme.text },
                  ]}
                  onPress={() => handleSwitchSubView(tab.id)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.navPillText,
                      { color: active ? theme.bg : theme.textMuted },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: viewFadeAnim,
            transform: [{ translateY: viewSlideAnim }],
          }}
        >
          {/* =========================================================
              SUB-VIEW 1: SYLWETKA (OPEN ANATOMY & MUSCLE RANKS)
             ========================================================= */}
          {subView === 'physique' && (
            <View style={styles.openPage}>
              {/* Open Borderless Hero Metric Strip */}
              <View style={[styles.heroMetricsStrip, { borderBottomColor: theme.hairline }]}>
                <View style={styles.heroMetricItem}>
                  <Text
                    style={[
                      styles.heroRankBig,
                      {
                        color:
                          physiqueReport?.overallRankMeta.color || theme.text,
                      },
                    ]}
                  >
                    {physiqueReport?.overallRank || 'F'}
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                    Ranga ogólna
                  </Text>
                </View>

                <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                <View style={styles.heroMetricItem}>
                  <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                    {physiqueReport?.balanceScorePct ?? 100}%
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                    Balans ciała
                  </Text>
                </View>

                <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                <View style={styles.heroMetricItem}>
                  <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                    {physiqueReport?.totalLifetimeSets ?? 0}
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                    Serie łącznie
                  </Text>
                </View>

                <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                <View style={styles.heroMetricItem}>
                  <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                    {Object.keys(bestPRs).length}
                  </Text>
                  <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                    Rekordy PR
                  </Text>
                </View>
              </View>

              {/* Open 2D Animated Anatomical Silhouette */}
              {physiqueReport && (
                <AnimatedBodySilhouette
                  muscleStatsMap={physiqueReport.muscleStats}
                  colorMode={colorMode}
                  onChangeColorMode={setColorMode}
                  selectedMuscle={selectedMuscle}
                  onSelectMuscle={handleSelectMuscle}
                  selectedMuscleExercises={
                    selectedMuscle ? exercisesByMuscle[selectedMuscle] || [] : []
                  }
                  onPressExercise={openExerciseDetail}
                />
              )}

              {/* Open Coach Priority Section ("Co teraz robić") */}
              {physiqueReport && physiqueReport.topPriorities.length > 0 && (
                <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                  <View style={styles.openSectionHeader}>
                    <View>
                      <Text style={[styles.sectionEyebrow, { color: '#F43F5E' }]}>
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
                      stat.priorityStatus === 'neglected' ? '#F43F5E' : '#F59E0B';

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
                              {stat.priorityStatus === 'neglected'
                                ? 'Brak aktywności'
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

                        <Text
                          style={[
                            styles.priorityRankChar,
                            { color: stat.rankMeta.color },
                          ]}
                        >
                          {stat.rank}
                        </Text>
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
                      WSZYSTKIE PARTIE (19)
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      Rangi rozwoju mięśni
                    </Text>
                  </View>
                  <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                    Dotknij po ćwiczenia
                  </Text>
                </View>

                {orderedMuscleList.map((stat, idx) => {
                  const isExpanded = expandedMuscleId === stat.muscleId;
                  const muscleExList = exercisesByMuscle[stat.muscleId] || [];
                  const barColor =
                    colorMode === 'priority'
                      ? stat.priorityStatus === 'neglected'
                        ? '#F43F5E'
                        : stat.priorityStatus === 'lagging'
                        ? '#F59E0B'
                        : stat.priorityStatus === 'dominant'
                        ? '#38BDF8'
                        : '#10B981'
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
                        <View style={styles.muscleRankCol}>
                          <Text
                            style={[
                              styles.muscleRankLetter,
                              { color: stat.rankMeta.color },
                            ]}
                          >
                            {stat.rank}
                          </Text>
                        </View>

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
                              {stat.nextTier ? ` (+${stat.setsToNext} do ${stat.nextTier})` : ''}
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
                                  <Text
                                    style={[
                                      styles.inlineExRank,
                                      { color: exStat.rankMeta.color },
                                    ]}
                                  >
                                    {exStat.rank}
                                  </Text>
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
                        <Text
                          style={[
                            styles.openGroupRank,
                            { color: mStat?.rankMeta.color || theme.textMuted },
                          ]}
                        >
                          {mStat?.rank || 'F'}
                        </Text>
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
                          <Text
                            style={[
                              styles.openExRankLetter,
                              { color: exStat.rankMeta.color },
                            ]}
                          >
                            {exStat.rank}
                          </Text>

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
              SUB-VIEW 3: DZIENNIK (OPEN WEIGHT & ACTIVITY LOG)
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
                  <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                    Łącznie {workoutHistory.length}
                  </Text>
                </View>

                {workoutHistory.length === 0 ? (
                  <Text style={[styles.emptyLineText, { color: theme.textMuted }]}>
                    Nie ukończono jeszcze żadnego treningu
                  </Text>
                ) : (
                  workoutHistory
                    .slice(-10)
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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
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
                  <Text
                    style={[
                      styles.sheetRankBig,
                      { color: selectedExerciseRankStat.rankMeta.color },
                    ]}
                  >
                    {selectedExerciseRankStat.rank}
                  </Text>
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
        </KeyboardAvoidingView>
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
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  navPills: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
  },
  navPillBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  navPillText: {
    fontSize: 12,
    fontWeight: '700',
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
  heroMetricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  heroMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroRankBig: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  heroMetricValue: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  heroMetricLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  verticalHairline: {
    width: StyleSheet.hairlineWidth,
    height: 28,
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
  priorityRankChar: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
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
  muscleRankCol: {
    width: 32,
    alignItems: 'center',
  },
  muscleRankLetter: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
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
  inlineExRank: {
    width: 24,
    fontSize: 14,
    fontWeight: '900',
  },
  inlineExName: {
    fontSize: 14,
    fontWeight: '600',
  },
  inlineExSub: {
    fontSize: 11,
    marginTop: 1,
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
  openGroupRank: {
    fontSize: 18,
    fontWeight: '900',
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
  openExRankLetter: {
    width: 28,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
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
  },
  openExPR: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  weightHeroRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  weightHeroBig: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
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
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rangePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openChartWrap: {
    marginVertical: 8,
  },
  emptyChartOpen: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 12,
  },
  chartAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  chartAxisText: {
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    fontSize: 13,
  },
  inlineActionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
  },
  simpleLogRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  simpleLogVal: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  dayDotBox: {
    width: (SCREEN_WIDTH - 40 - 6 * 8) / 7,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyLineText: {
    fontSize: 13,
    paddingVertical: 8,
  },
  workoutLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workoutLogTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  workoutLogSub: {
    fontSize: 12,
    marginTop: 2,
  },
  workoutLogSets: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
  sheetRankBig: {
    fontSize: 34,
    fontWeight: '900',
  },
  sheetRankTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sheetRankSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetSetsCount: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  sheetSection: {
    marginTop: 18,
    paddingTop: 14,
    gap: 8,
  },
});
