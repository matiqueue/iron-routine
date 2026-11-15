import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import {
  Exercise,
  MuscleCategory,
  MuscleSubGroupId,
  MuscleVolumeStat,
  PRRecord,
  SupplementItem,
  UserProfile,
  WorkoutHistoryEntry,
  WorkoutPlan,
} from '../types/workout';
import { getAllExercises, mergeAllExercises } from '../data/planData';
import { resolveCanonicalExerciseId } from '../data/exerciseLibrary';
import {
  MUSCLE_SUBGROUPS,
  MUSCLE_SUBGROUP_MAP,
  resolveExerciseMuscles,
  getExerciseRankMeta,
} from '../data/muscleMap';
import { formatSupplementDose } from '../data/supplements';
import { getAppSettings } from '../services/settings';
import {
  getAllBestPRs,
  getExerciseHistory,
  addPRRecord,
  deletePRRecord,
  calculate1RM,
  getCreatineLog,
  toggleCreatineDay,
  getWeightStatsSummary,
  getExerciseImprovements,
  getWeeklyVolumeByMuscle,
  getWorkoutHistory,
  getCustomExercises,
  CreatineDayEntry,
  WeightStatsSummary,
  ExerciseImprovement,
} from '../services/storage';
import {
  computePhysiqueAnalytics,
  PhysiqueAnalyticsReport,
} from '../services/muscleAnalytics';
import { ModernSplineChart } from './ModernSplineChart';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { MuscleModel3D, ModelColorMode } from './MuscleModel3D';
import { RankBadge } from './RankBadge';

interface ProgressTabProps {
  activeProfile: UserProfile;
  activePlan?: WorkoutPlan | null;
  profilePlans?: WorkoutPlan[];
  refreshKey?: number;
  onOpenProfileModal?: () => void;
}

type ViewMode = 'anatomy' | 'exercises' | 'telemetry';
type Timeframe = '7d' | '30d' | '90d';

const PARENT_FILTERS: { id: MuscleCategory | 'wszystkie'; label: string }[] = [
  { id: 'wszystkie', label: 'Wszystkie (19)' },
  { id: 'klatka', label: 'Klatka' },
  { id: 'barki', label: 'Barki' },
  { id: 'ramiona', label: 'Ramiona' },
  { id: 'plecy', label: 'Plecy' },
  { id: 'brzuch', label: 'Brzuch' },
  { id: 'nogi', label: 'Nogi' },
];

export const ProgressTab: React.FC<ProgressTabProps> = ({
  activeProfile,
  activePlan,
  profilePlans = [],
  refreshKey = 0,
}) => {
  const { theme } = useAppTheme();

  // Sub-views: 1. 3D Anatomy & Ranks, 2. Exercises grouped by muscle, 3. Body & Session Log
  const [viewMode, setViewMode] = useState<ViewMode>('anatomy');
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');

  // 3D Model state
  const [selectedMuscle3D, setSelectedMuscle3D] = useState<MuscleSubGroupId | null>(null);
  const [modelColorMode, setModelColorMode] = useState<ModelColorMode>('priority');
  const [anatomyParentFilter, setAnatomyParentFilter] = useState<MuscleCategory | 'wszystkie'>('wszystkie');

  // Exercises view filter by 19 detailed muscles
  const [selectedSubMuscleFilter, setSelectedSubMuscleFilter] = useState<MuscleSubGroupId | 'wszystkie'>('wszystkie');
  const [searchQuery, setSearchQuery] = useState('');

  // Animations
  const modeFadeAnim = useRef(new Animated.Value(1)).current;
  const modeSlideAnim = useRef(new Animated.Value(0)).current;

  const handleSwitchMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    try {
      Haptics.selectionAsync();
    } catch {}

    modeFadeAnim.setValue(0);
    modeSlideAnim.setValue(8);
    setViewMode(mode);

    Animated.parallel([
      Animated.timing(modeFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(modeSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSwitchTimeframe = (tf: Timeframe) => {
    if (tf === timeframe) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    setTimeframe(tf);
  };

  // Telemetry & PR Data State
  const [creatineLog, setCreatineLog] = useState<CreatineDayEntry[]>([]);
  const [weightStats, setWeightStats] = useState<WeightStatsSummary | null>(null);
  const [improvements, setImprovements] = useState<ExerciseImprovement[]>([]);
  const [bestPRs, setBestPRs] = useState<{ [exerciseId: string]: PRRecord }>({});
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<MuscleVolumeStat[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeSupplements, setActiveSupplements] = useState<SupplementItem[]>([]);
  const [physiqueReport, setPhysiqueReport] = useState<PhysiqueAnalyticsReport | null>(null);

  // Exercise Modal State
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<PRRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [inputWeight, setInputWeight] = useState('80');
  const [inputReps, setInputReps] = useState('8');
  const [inputNote, setInputNote] = useState('');

  const allExercises = useMemo(() => {
    const planExercises = [
      ...(activePlan?.days || []).flatMap((d) => d.exercises || []),
      ...profilePlans.flatMap((p) => p.days.flatMap((d) => d.exercises || [])),
    ];
    return mergeAllExercises(planExercises, customExercises, getAllExercises());
  }, [activePlan, profilePlans, customExercises]);

  const loadData = useCallback(async () => {
    try {
      const records = await getAllBestPRs(activeProfile.id);
      setBestPRs(records);

      const daysCount = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const planDaysForVol = activePlan?.days || [];

      const [cLog, wStats, imp, customList, volStats, histList, appSettings] = await Promise.all([
        getCreatineLog(timeframe === '7d' ? 7 : 14),
        getWeightStatsSummary(daysCount, activeProfile.id),
        getExerciseImprovements(activeProfile.id),
        getCustomExercises(),
        getWeeklyVolumeByMuscle(planDaysForVol, undefined, activeProfile.id),
        getWorkoutHistory(activeProfile.id),
        getAppSettings(),
      ]);

      setCreatineLog(cLog);
      setWeightStats(wStats);
      setImprovements(imp);
      setCustomExercises(customList);
      setWeeklyVolume(volStats);
      setWorkoutHistory(histList);
      setActiveSupplements((appSettings.supplements || []).filter((s) => s.enabled));

      const mergedEx = mergeAllExercises(
        [
          ...(activePlan?.days || []).flatMap((d) => d.exercises || []),
          ...profilePlans.flatMap((p) => p.days.flatMap((d) => d.exercises || [])),
        ],
        customList,
        getAllExercises()
      );

      const report = await computePhysiqueAnalytics({
        profileId: activeProfile.id,
        allExercises: mergedEx,
        activePlanDays: planDaysForVol,
        workoutHistory: histList,
      });
      setPhysiqueReport(report);
    } catch (e) {
      console.warn('Error loading progress stats:', e);
    }
  }, [activeProfile.id, timeframe, activePlan, profilePlans]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  const handleToggleCreatine = async (entry: CreatineDayEntry) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      const nextState = !entry.taken;
      await toggleCreatineDay(entry.date, nextState);
      setCreatineLog((prev) =>
        prev.map((item) => (item.date === entry.date ? { ...item, taken: nextState } : item))
      );
    } catch (e) {
      console.warn('Error toggling creatine day', e);
    }
  };

  const handleOpenExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    const hist = await getExerciseHistory(exercise.id, activeProfile.id);
    setHistory(hist);

    if (hist.length > 0) {
      setInputWeight(String(hist[0].weight));
      setInputReps(String(hist[0].reps));
    } else {
      setInputWeight('60');
      setInputReps('8');
    }
    setInputNote('');
    setModalVisible(true);
  };

  const handleJumpToMuscleExercises = (muscleId: MuscleSubGroupId) => {
    setSelectedSubMuscleFilter(muscleId);
    handleSwitchMode('exercises');
  };

  const handleSaveRecord = async () => {
    if (!selectedExercise) return;
    const w = parseFloat(inputWeight.replace(',', '.'));
    const r = parseInt(inputReps, 10);

    if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
      Alert.alert('Błędne dane', 'Podaj poprawny ciężar (kg) i liczbę powtórzeń.');
      return;
    }

    try {
      await addPRRecord(
        selectedExercise.id,
        selectedExercise.name,
        selectedExercise.category,
        w,
        r,
        inputNote,
        activeProfile.id
      );

      const updatedHist = await getExerciseHistory(selectedExercise.id, activeProfile.id);
      setHistory(updatedHist);
      await loadData();
      setInputNote('');
    } catch (e) {
      console.error('Error saving PR:', e);
    }
  };

  const handleDeleteRecord = (record: PRRecord) => {
    Alert.alert(
      'Usunąć rekord?',
      `${record.weight} kg × ${record.reps} z dnia ${record.date.slice(0, 10)}`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            if (!selectedExercise) return;
            await deletePRRecord(record.id, selectedExercise.id, activeProfile.id);
            const updatedHist = await getExerciseHistory(selectedExercise.id, activeProfile.id);
            setHistory(updatedHist);
            await loadData();
          },
        },
      ]
    );
  };

  const adjustWeight = (delta: number) => {
    const cur = parseFloat(inputWeight.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    setInputWeight(String(next));
  };

  const adjustReps = (delta: number) => {
    const cur = parseInt(inputReps, 10) || 0;
    const next = Math.max(1, cur + delta);
    setInputReps(String(next));
  };

  const currentEst1RM = useMemo(() => {
    const w = parseFloat(inputWeight.replace(',', '.')) || 0;
    const r = parseInt(inputReps, 10) || 0;
    return calculate1RM(w, r);
  }, [inputWeight, inputReps]);

  // Filtered 19 muscle cards in View 1
  const filteredMuscleStats = useMemo(() => {
    if (!physiqueReport) return [];
    const list = physiqueReport.muscleStatsList;
    if (anatomyParentFilter === 'wszystkie') return list;
    return list.filter((m) => m.meta.parentCategory === anatomyParentFilter);
  }, [physiqueReport, anatomyParentFilter]);

  // Exercises grouped by 19 anatomical sub-muscles for View 2
  const groupedExercisesByMuscle = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const groups: {
      muscleId: MuscleSubGroupId;
      muscleLabel: string;
      parentLabel: string;
      exercises: Exercise[];
    }[] = [];

    const targetMuscles =
      selectedSubMuscleFilter === 'wszystkie'
        ? MUSCLE_SUBGROUPS
        : MUSCLE_SUBGROUPS.filter((m) => m.id === selectedSubMuscleFilter);

    for (const m of targetMuscles) {
      const matching = allExercises
        .filter((ex) => {
          const assign = resolveExerciseMuscles(ex);
          if (assign.primary !== m.id) return false;
          if (!q) return true;
          return (
            ex.name.toLowerCase().includes(q) ||
            m.label.toLowerCase().includes(q) ||
            (ex.equipment || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          const cidA = resolveCanonicalExerciseId(a.id, a.name);
          const cidB = resolveCanonicalExerciseId(b.id, b.name);
          const setsA = physiqueReport?.exerciseStats[cidA]?.totalSets || 0;
          const setsB = physiqueReport?.exerciseStats[cidB]?.totalSets || 0;
          if (setsB !== setsA) return setsB - setsA;
          const prA = bestPRs[cidA] ? 1 : 0;
          const prB = bestPRs[cidB] ? 1 : 0;
          return prB - prA;
        });

      if (matching.length > 0) {
        groups.push({
          muscleId: m.id,
          muscleLabel: m.label,
          parentLabel: m.parentLabel,
          exercises: matching,
        });
      }
    }

    return groups;
  }, [allExercises, selectedSubMuscleFilter, searchQuery, physiqueReport, bestPRs]);

  const creatineStats = useMemo(() => {
    const count = creatineLog.filter((c) => c.taken).length;
    const total = creatineLog.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    const todayTaken = creatineLog.find((c) => c.isToday)?.taken ?? false;
    return { count, total, percent, todayTaken };
  }, [creatineLog]);

  const selectedExerciseRankStat = useMemo(() => {
    if (!selectedExercise) return null;
    const cid = resolveCanonicalExerciseId(selectedExercise.id, selectedExercise.name);
    if (physiqueReport?.exerciseStats[cid]) {
      return physiqueReport.exerciseStats[cid];
    }
    const fallback = getExerciseRankMeta(history.length * (selectedExercise.sets || 3));
    return {
      totalSets: history.length * (selectedExercise.sets || 3),
      rank: fallback.meta.tier,
      rankMeta: fallback.meta,
      progressPct: fallback.progressPct,
      setsToNext: fallback.setsToNext,
      nextTier: fallback.nextTier,
    };
  }, [selectedExercise, physiqueReport, history.length]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Header with Overall Physique Rank Badge */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerKicker, { color: theme.textMuted }]}>
              TELEMETRIA SYLWETKI • 19 PARTII
            </Text>
            <Text style={[styles.title, { color: theme.text }]}>Osiągi & Rangi</Text>
          </View>

          {physiqueReport ? (
            <View style={[styles.overallBadgeBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <RankBadge
                tier={physiqueReport.overallRank}
                size="md"
                progressPct={physiqueReport.overallProgressPct}
              />
              <View style={{ marginLeft: 9 }}>
                <Text style={[styles.overallBadgeKicker, { color: theme.textMuted }]}>
                  SYLWETKA
                </Text>
                <Text style={[styles.overallBadgeTitle, { color: theme.text }]}>
                  {physiqueReport.overallRankMeta.title}
                </Text>
                <Text style={[styles.overallBadgeSub, { color: theme.textSecondary }]}>
                  Balans {physiqueReport.balanceScorePct}%
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      {/* 3-Tab Segmented Switcher */}
      <View style={styles.modeSwitchWrapper}>
        <View style={[styles.modeSwitchBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              viewMode === 'anatomy' && {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => handleSwitchMode('anatomy')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="body-outline"
              size={15}
              color={viewMode === 'anatomy' ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                { color: viewMode === 'anatomy' ? theme.text : theme.textMuted },
                viewMode === 'anatomy' && { fontWeight: '900' },
              ]}
            >
              Model 3D & Rangi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              viewMode === 'exercises' && {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => handleSwitchMode('exercises')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="barbell-outline"
              size={15}
              color={viewMode === 'exercises' ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                { color: viewMode === 'exercises' ? theme.text : theme.textMuted },
                viewMode === 'exercises' && { fontWeight: '900' },
              ]}
            >
              Ćwiczenia (F-S+)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              viewMode === 'telemetry' && {
                backgroundColor: theme.card,
                borderColor: theme.border,
              },
            ]}
            onPress={() => handleSwitchMode('telemetry')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="stats-chart-outline"
              size={15}
              color={viewMode === 'telemetry' ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                { color: viewMode === 'telemetry' ? theme.text : theme.textMuted },
                viewMode === 'telemetry' && { fontWeight: '900' },
              ]}
            >
              Ciało & Dziennik
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: modeFadeAnim,
          transform: [{ translateY: modeSlideAnim }],
        }}
      >
        {/* ==================== VIEW 1: 3D ANATOMY & MUSCLE RANKS ==================== */}
        {viewMode === 'anatomy' ? (
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Top 3-Column Bento KPI Strip */}
            {physiqueReport ? (
              <View style={styles.bentoTopStrip}>
                <View style={[styles.bentoMiniCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                  <Text style={[styles.bentoMiniLabel, { color: theme.textMuted }]}>SERIE ŁĄCZNIE</Text>
                  <Text style={[styles.bentoMiniVal, { color: theme.text }]}>
                    {physiqueReport.totalLifetimeSets}
                  </Text>
                  <Text style={[styles.bentoMiniSub, { color: theme.textSecondary }]}>
                    +{physiqueReport.totalRecentSets30d} w 30 dni
                  </Text>
                </View>

                <View style={[styles.bentoMiniCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                  <Text style={[styles.bentoMiniLabel, { color: theme.textMuted }]}>SYMETRIA 3D</Text>
                  <Text style={[styles.bentoMiniVal, { color: theme.text }]}>
                    {physiqueReport.balanceScorePct}%
                  </Text>
                  <Text style={[styles.bentoMiniSub, { color: theme.textSecondary }]}>
                    Balans 19 partii
                  </Text>
                </View>

                <View style={[styles.bentoMiniCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                  <Text style={[styles.bentoMiniLabel, { color: theme.textMuted }]}>TOP PARTIA</Text>
                  <Text style={[styles.bentoMiniVal, { color: theme.text }]} numberOfLines={1}>
                    {physiqueReport.strongestMuscles[0]?.meta.shortLabel || '-'}
                  </Text>
                  <Text
                    style={[
                      styles.bentoMiniSub,
                      { color: physiqueReport.strongestMuscles[0]?.rankMeta.color || theme.textSecondary },
                    ]}
                  >
                    Ranga {physiqueReport.strongestMuscles[0]?.rank || 'F'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Interactive 3D Human Muscle Model */}
            {physiqueReport ? (
              <MuscleModel3D
                muscleStats={physiqueReport.muscleStats}
                selectedMuscle={selectedMuscle3D}
                onSelectMuscle={(mId) =>
                  setSelectedMuscle3D((prev) => (prev === mId ? null : mId))
                }
                colorMode={modelColorMode}
                onChangeColorMode={setModelColorMode}
              />
            ) : null}

            {/* Bento Coach Card: "Co teraz trenować?" (Priority Recommendations) */}
            {physiqueReport && physiqueReport.topPriorities.length > 0 ? (
              <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={[styles.cardKicker, { color: '#F43F5E' }]}>
                      REKOMENDACJA ANATOMICZNA
                    </Text>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                      Co teraz trenować?
                    </Text>
                  </View>
                  <View style={[styles.coachPill, { backgroundColor: 'rgba(244,63,94,0.14)', borderColor: 'rgba(244,63,94,0.4)' }]}>
                    <Ionicons name="analytics-outline" size={12} color="#F43F5E" style={{ display: 'none' }} />
                    <Text style={styles.coachPillText}>3 PRIORYTETY</Text>
                  </View>
                </View>

                <Text style={[styles.coachIntroText, { color: theme.textSecondary }]}>
                  Partie odstające pod względem przepracowanych serii względem Twoich dominujących grup. Dotknij partii, aby obrócić model 3D:
                </Text>

                <View style={styles.priorityList}>
                  {physiqueReport.topPriorities.map((stat, idx) => {
                    const isFocused = selectedMuscle3D === stat.muscleId;
                    return (
                      <TouchableOpacity
                        key={stat.muscleId}
                        style={[
                          styles.priorityItemCard,
                          {
                            backgroundColor: theme.card,
                            borderColor: isFocused ? '#FFFFFF' : theme.border,
                          },
                        ]}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setSelectedMuscle3D(stat.muscleId);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={styles.priorityTopRow}>
                          <RankBadge tier={stat.rank} size="md" progressPct={stat.progressPct} />
                          <View style={{ flex: 1, marginLeft: 11 }}>
                            <View style={styles.priorityTitleLine}>
                              <Text style={[styles.priorityMuscleName, { color: theme.text }]}>
                                #{idx + 1} {stat.meta.label}
                              </Text>
                              <Text
                                style={[
                                  styles.priorityDeltaBadge,
                                  {
                                    color:
                                      stat.priorityStatus === 'neglected' ? '#F43F5E' : '#F59E0B',
                                  },
                                ]}
                              >
                                {stat.statusLabel}
                              </Text>
                            </View>
                            <Text style={[styles.priorityReason, { color: theme.textSecondary }]}>
                              {stat.recommendationText}
                            </Text>
                          </View>
                        </View>

                        {/* Quick Exercise Suggestions */}
                        {stat.recommendedExercises.length > 0 ? (
                          <View style={styles.recExRow}>
                            {stat.recommendedExercises.slice(0, 2).map((ex) => (
                              <TouchableOpacity
                                key={ex.id}
                                style={[
                                  styles.recExChip,
                                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                                ]}
                                onPress={() => handleOpenExercise(ex)}
                              >
                                <Ionicons name="barbell-outline" size={12} color={theme.text} />
                                <Text
                                  style={[styles.recExChipText, { color: theme.text }]}
                                  numberOfLines={1}
                                >
                                  {ex.name}
                                </Text>
                              </TouchableOpacity>
                            ))}

                            <TouchableOpacity
                              style={[styles.recJumpBtn, { borderColor: theme.border }]}
                              onPress={() => handleJumpToMuscleExercises(stat.muscleId)}
                            >
                              <Text style={[styles.recJumpBtnText, { color: theme.textSecondary }]}>
                                Wszystkie →
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* 19 Muscles Bento Grid with F -> S+ Ranks */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>
                    DRABINKA RANG (F → S+)
                  </Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Wszystkie partie mięśniowe (19)
                  </Text>
                </View>
              </View>

              {/* Parent Category Filter Pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.parentFilterRow}
              >
                {PARENT_FILTERS.map((pf) => {
                  const active = anatomyParentFilter === pf.id;
                  return (
                    <TouchableOpacity
                      key={pf.id}
                      style={[
                        styles.filterPill,
                        {
                          backgroundColor: active ? theme.primary : theme.card,
                          borderColor: active ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setAnatomyParentFilter(pf.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          { color: active ? theme.primaryText : theme.text },
                        ]}
                      >
                        {pf.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 2-Column Bento Grid of Muscle Rank Cards */}
              <View style={styles.muscleBentoGrid}>
                {filteredMuscleStats.map((stat) => {
                  const isSelected = selectedMuscle3D === stat.muscleId;
                  return (
                    <TouchableOpacity
                      key={stat.muscleId}
                      style={[
                        styles.muscleBentoTile,
                        {
                          backgroundColor: theme.card,
                          borderColor: isSelected ? '#FFFFFF' : theme.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedMuscle3D(stat.muscleId);
                      }}
                      onLongPress={() => handleJumpToMuscleExercises(stat.muscleId)}
                      activeOpacity={0.78}
                    >
                      <View style={styles.muscleTileTop}>
                        <View style={{ flex: 1, paddingRight: 6 }}>
                          <Text style={[styles.muscleTileParent, { color: theme.textMuted }]}>
                            {stat.meta.parentLabel.toUpperCase()}
                          </Text>
                          <Text
                            style={[styles.muscleTileTitle, { color: theme.text }]}
                            numberOfLines={1}
                          >
                            {stat.meta.shortLabel}
                          </Text>
                        </View>
                        <RankBadge tier={stat.rank} size="sm" />
                      </View>

                      <View style={styles.muscleTileProgressWrap}>
                        <View style={styles.muscleTileNumbersRow}>
                          <Text style={[styles.muscleTileSets, { color: theme.text }]}>
                            {stat.effectiveSetsTotal} serii
                          </Text>
                          <Text style={[styles.muscleTileNext, { color: theme.textMuted }]}>
                            {stat.nextTier ? `→ ${stat.nextTier} (${stat.setsToNext})` : 'MAX'}
                          </Text>
                        </View>
                        <View style={[styles.muscleTileBarTrack, { backgroundColor: theme.bgTertiary }]}>
                          <View
                            style={[
                              styles.muscleTileBarFill,
                              {
                                width: `${stat.progressPct}%`,
                                backgroundColor: stat.rankMeta.color,
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <View style={styles.muscleTileFooter}>
                        <Text
                          style={[
                            styles.muscleTileStatus,
                            {
                              color:
                                stat.priorityStatus === 'neglected'
                                  ? '#F43F5E'
                                  : stat.priorityStatus === 'lagging'
                                  ? '#F59E0B'
                                  : stat.priorityStatus === 'dominant'
                                  ? '#38BDF8'
                                  : theme.textSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {stat.statusLabel}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleJumpToMuscleExercises(stat.muscleId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        ) : viewMode === 'exercises' ? (
          /* ==================== VIEW 2: EXERCISES GROUPED BY 19 MUSCLES (F -> S+) ==================== */
          <>
            {/* Search Bar */}
            <View style={[styles.searchWrapper, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Ionicons name="search" size={18} color={theme.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Szukaj ćwiczenia lub partii (np. przedramię, łydka)..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* 19-Muscle Filter Carousel */}
            <View style={styles.categoryWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                <TouchableOpacity
                  style={[
                    styles.catPill,
                    {
                      backgroundColor:
                        selectedSubMuscleFilter === 'wszystkie' ? theme.primary : theme.bgSecondary,
                      borderColor:
                        selectedSubMuscleFilter === 'wszystkie' ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedSubMuscleFilter('wszystkie');
                  }}
                >
                  <Text
                    style={[
                      styles.catPillText,
                      {
                        color:
                          selectedSubMuscleFilter === 'wszystkie' ? theme.primaryText : theme.text,
                      },
                    ]}
                  >
                    Wszystkie mięśnie (19)
                  </Text>
                </TouchableOpacity>

                {MUSCLE_SUBGROUPS.map((m) => {
                  const isActive = selectedSubMuscleFilter === m.id;
                  const mRank = physiqueReport?.muscleStats[m.id]?.rank || 'F';
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.catPill,
                        {
                          backgroundColor: isActive ? theme.primary : theme.bgSecondary,
                          borderColor: isActive ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSelectedSubMuscleFilter(m.id);
                      }}
                    >
                      <Text
                        style={[
                          styles.catPillText,
                          { color: isActive ? theme.primaryText : theme.text },
                        ]}
                      >
                        {m.shortLabel} ({mRank})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Grouped Exercise List by Anatomical Muscle */}
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listInner}
              showsVerticalScrollIndicator={false}
            >
              {groupedExercisesByMuscle.length === 0 ? (
                <View style={styles.emptyView}>
                  <Ionicons name="search-outline" size={28} color={theme.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                    Nie znaleziono pasujących ćwiczeń
                  </Text>
                </View>
              ) : (
                groupedExercisesByMuscle.map((group) => {
                  const muscleStat = physiqueReport?.muscleStats[group.muscleId];
                  return (
                    <View
                      key={group.muscleId}
                      style={[
                        styles.muscleGroupSection,
                        { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                      ]}
                    >
                      {/* Muscle Section Header */}
                      <View style={[styles.muscleGroupHeader, { borderBottomColor: theme.hairline }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.muscleGroupKicker, { color: theme.textMuted }]}>
                            {group.parentLabel.toUpperCase()} • {group.exercises.length} ĆWICZEŃ
                          </Text>
                          <Text style={[styles.muscleGroupTitle, { color: theme.text }]}>
                            {group.muscleLabel}
                          </Text>
                        </View>
                        {muscleStat ? (
                          <View style={styles.muscleGroupRight}>
                            <Text style={[styles.muscleGroupSets, { color: theme.textSecondary }]}>
                              {muscleStat.effectiveSetsTotal} serii
                            </Text>
                            <RankBadge tier={muscleStat.rank} size="sm" />
                          </View>
                        ) : null}
                      </View>

                      {/* Exercises inside this muscle group */}
                      {group.exercises.map((exercise, idx) => {
                        const cid = resolveCanonicalExerciseId(exercise.id, exercise.name);
                        const pr = bestPRs[cid] || bestPRs[exercise.id];
                        const exRank =
                          physiqueReport?.exerciseStats[cid] ||
                          physiqueReport?.exerciseStats[exercise.id];
                        const assign = resolveExerciseMuscles(exercise);
                        const secLabels = assign.secondary
                          .slice(0, 2)
                          .map((s) => MUSCLE_SUBGROUP_MAP[s.muscle]?.shortLabel)
                          .filter(Boolean)
                          .join(', ');

                        return (
                          <TouchableOpacity
                            key={exercise.id}
                            style={[
                              styles.exerciseRankRow,
                              idx < group.exercises.length - 1 && {
                                borderBottomWidth: 1,
                                borderBottomColor: theme.hairline,
                              },
                            ]}
                            onPress={() => handleOpenExercise(exercise)}
                            activeOpacity={0.75}
                          >
                            {/* Left: Activity Rank Badge (F..S+) */}
                            <RankBadge
                              tier={exRank?.rank || 'F'}
                              size="md"
                              progressPct={exRank?.progressPct ?? 0}
                            />

                            {/* Center: Exercise Name, Secondary Muscles & Set Progression */}
                            <View style={styles.exCenterCol}>
                              <Text style={[styles.exTitle, { color: theme.text }]}>
                                {exercise.name}
                              </Text>

                              <Text style={[styles.exSetsProgressText, { color: theme.textSecondary }]}>
                                <Text style={{ fontWeight: '800', color: theme.text }}>
                                  {exRank?.totalSets || 0} serii
                                </Text>
                                {exRank?.nextTier
                                  ? ` • Brakuje ${exRank.setsToNext} do rangi ${exRank.nextTier}`
                                  : ' • Maksymalna ranga S+'}
                              </Text>

                              {secLabels ? (
                                <Text style={[styles.exSecondaryText, { color: theme.textMuted }]}>
                                  Pomocniczo: {secLabels}
                                </Text>
                              ) : null}
                            </View>

                            {/* Right: PR Weight / 1RM or Add button */}
                            <View style={styles.rowRight}>
                              {pr ? (
                                <View style={styles.prResultCol}>
                                  <Text style={[styles.prWeightText, { color: theme.text }]}>
                                    {pr.weight} kg
                                  </Text>
                                  <Text style={[styles.prRepsText, { color: theme.textSecondary }]}>
                                    × {pr.reps}
                                  </Text>
                                  <Text style={[styles.pr1RMText, { color: theme.textMuted }]}>
                                    1RM ~{pr.estimated1RM}
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  style={[
                                    styles.addBadge,
                                    { borderColor: theme.borderDark, backgroundColor: theme.card },
                                  ]}
                                >
                                  <Ionicons name="add" size={14} color={theme.text} />
                                  <Text style={[styles.addBadgeText, { color: theme.text }]}>
                                    Wynik
                                  </Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </>
        ) : (
          /* ==================== VIEW 3: BODY TELEMETRY & SESSION LOG ==================== */
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Timeframe Filter */}
            <View style={styles.timeframeRow}>
              {(['7d', '30d', '90d'] as Timeframe[]).map((tf) => {
                const isSelected = timeframe === tf;
                const label = tf === '7d' ? '7 dni' : tf === '30d' ? '30 dni' : '90 dni';
                return (
                  <TouchableOpacity
                    key={tf}
                    style={[
                      styles.tfPill,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.bgSecondary,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handleSwitchTimeframe(tf)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tfPillText,
                        { color: isSelected ? theme.primaryText : theme.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SECTION 1: BODY WEIGHT CHART & BALANCE */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>MASA CIAŁA</Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Waga i bilans ({timeframe})
                  </Text>
                </View>

                {weightStats ? (
                  <View style={styles.weightDeltaBadge}>
                    <Ionicons
                      name={weightStats.diff >= 0 ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={theme.text}
                    />
                    <Text style={[styles.weightDeltaText, { color: theme.text }]}>
                      {weightStats.diff > 0 ? `+${weightStats.diff}` : `${weightStats.diff}`} kg (
                      {weightStats.diffPercent > 0
                        ? `+${weightStats.diffPercent}`
                        : `${weightStats.diffPercent}`}
                      %)
                    </Text>
                  </View>
                ) : null}
              </View>

              {weightStats ? (
                <View style={styles.metricsSummaryRow}>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Aktualna</Text>
                    <Text style={[styles.metricVal, { color: theme.text }]}>
                      {weightStats.current > 0 ? `${weightStats.current} kg` : '-'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Początkowa</Text>
                    <Text style={[styles.metricVal, { color: theme.text }]}>
                      {weightStats.start > 0 ? `${weightStats.start} kg` : '-'}
                    </Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Wzrost</Text>
                    <Text style={[styles.metricVal, { color: theme.text }]}>
                      {activeProfile.height ? `${activeProfile.height} cm` : '-'}
                    </Text>
                  </View>
                </View>
              ) : null}

              {weightStats && weightStats.entries.length > 0 ? (
                <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ModernSplineChart
                    entries={weightStats.entries}
                    timeframe={timeframe === '90d' ? 'all' : timeframe}
                    onTimeframeChange={(tf) => handleSwitchTimeframe(tf === 'all' ? '90d' : tf)}
                    height={190}
                  />
                </View>
              ) : null}

              <View style={[styles.insightPill, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
                <Ionicons name="sparkles-outline" size={15} color={theme.text} />
                <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                  {weightStats && weightStats.entries.length >= 2
                    ? `Bilans w tym okresie: ${
                        weightStats.diff > 0 ? `+${weightStats.diff}` : weightStats.diff
                      } kg (${
                        weightStats.diffPercent > 0
                          ? `+${weightStats.diffPercent}`
                          : weightStats.diffPercent
                      }%) • Plan: ${activePlan?.name || 'Domyślny'}.`
                    : weightStats && weightStats.entries.length === 1
                    ? `Zapisana waga: ${weightStats.current} kg. Kolejne ważenia wyświetlą wykres trendu.`
                    : `Brak zapisanych pomiarów wagi dla profilu ${activeProfile.name}.`}
                </Text>
              </View>
            </View>

            {/* SECTION 2: SUPPLEMENT TRACKER & HEATMAP */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>SUPLEMENTACJA</Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Regularność i dawki</Text>
                </View>

                <View
                  style={[
                    styles.creatineBadge,
                    {
                      backgroundColor: creatineStats.todayTaken ? theme.primary : theme.bgTertiary,
                      borderColor: creatineStats.todayTaken ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.creatineBadgeText,
                      { color: creatineStats.todayTaken ? theme.primaryText : theme.text },
                    ]}
                  >
                    {creatineStats.todayTaken ? 'DZISIAJ: WZIĘTE' : 'DZISIAJ: DO WZIĘCIA'}
                  </Text>
                </View>
              </View>

              {activeSupplements.length > 0 && (
                <View style={styles.suppChipsWrap}>
                  {activeSupplements.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.suppChip,
                        { backgroundColor: theme.card, borderColor: theme.border },
                      ]}
                    >
                      <Text style={[styles.suppChipText, { color: theme.text }]}>
                        {item.name} ·{' '}
                        <Text style={{ color: theme.textSecondary }}>
                          {formatSupplementDose(item, weightStats?.current ?? activeProfile.weight)}
                        </Text>
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.creatineSubtitle, { color: theme.textSecondary }]}>
                Regularność w wybranym okresie:{' '}
                <Text style={{ fontWeight: '800', color: theme.text }}>
                  {creatineStats.count}/{creatineStats.total} dni ({creatineStats.percent}%)
                </Text>
              </Text>

              <View style={styles.creatineRibbon}>
                {creatineLog.slice(-7).map((item) => (
                  <TouchableOpacity
                    key={item.date}
                    style={[
                      styles.dayCircleCol,
                      item.isToday && {
                        backgroundColor: theme.card,
                        borderRadius: 14,
                        paddingVertical: 4,
                      },
                    ]}
                    onPress={() => handleToggleCreatine(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayLabelText,
                        { color: item.isToday ? theme.text : theme.textMuted },
                      ]}
                    >
                      {item.dayLabel}
                    </Text>
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: item.taken ? theme.text : 'transparent',
                          borderColor: item.taken ? theme.text : theme.borderDark,
                        },
                      ]}
                    >
                      {item.taken ? (
                        <Ionicons name="checkmark" size={14} color={theme.bg} />
                      ) : (
                        <Text style={[styles.emptyX, { color: theme.textMuted }]}>-</Text>
                      )}
                    </View>
                    <Text style={[styles.dayNumText, { color: theme.textMuted }]}>
                      {item.dayNum}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* SECTION 3: STRENGTH IMPROVEMENT & DELTAS */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>POSTĘPY SIŁOWE</Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>Wzrosty ciężarów & 1RM</Text>
                </View>
              </View>

              {improvements.length === 0 ? (
                <Text style={[styles.emptyBlockText, { color: theme.textMuted }]}>
                  Zapisz wyniki w treningach lub w zakładce Ćwiczenia, aby śledzić przyrosty ciężarów i 1RM.
                </Text>
              ) : (
                <View style={styles.improvementsList}>
                  {improvements.map((item) => (
                    <View
                      key={item.id}
                      style={[styles.improvementRow, { borderBottomColor: theme.hairline }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.impName, { color: theme.text }]}>{item.name}</Text>
                        <View style={styles.impSubRow}>
                          <View
                            style={[
                              styles.catTag,
                              { backgroundColor: theme.card, borderColor: theme.border },
                            ]}
                          >
                            <Text style={[styles.catTagText, { color: theme.textSecondary }]}>
                              {item.category.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={[styles.impPrevText, { color: theme.textMuted }]}>
                            Poprzednio: {item.previousWeight} kg
                          </Text>
                        </View>
                      </View>

                      <View style={styles.impRight}>
                        <View style={styles.impWeightRow}>
                          <Text style={[styles.impWeightCur, { color: theme.text }]}>
                            {item.currentWeight} kg
                          </Text>
                          <View
                            style={[
                              styles.deltaChip,
                              { backgroundColor: theme.card, borderColor: theme.border },
                            ]}
                          >
                            <Ionicons
                              name={item.diffWeight >= 0 ? 'arrow-up' : 'arrow-down'}
                              size={11}
                              color={theme.text}
                            />
                            <Text style={[styles.deltaChipText, { color: theme.text }]}>
                              {item.diffWeight >= 0 ? `+${item.diffWeight}` : item.diffWeight} kg
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.imp1RM, { color: theme.textMuted }]}>
                          1RM: ~{item.current1RM} kg (
                          {item.diff1RM >= 0 ? `+${item.diff1RM}` : item.diff1RM} kg)
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* SECTION 4: WEEKLY MUSCLE VOLUME BREAKDOWN */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>
                    OBJĘTOŚĆ TYGODNIOWA
                  </Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Realizacja bieżącego tygodnia
                  </Text>
                </View>
              </View>

              {weeklyVolume.length === 0 ? (
                <Text style={[styles.emptyBlockText, { color: theme.textMuted }]}>
                  Brak zaplanowanych ćwiczeń w aktywnym planie.
                </Text>
              ) : (
                <View style={styles.volumeList}>
                  {weeklyVolume.map((vol) => {
                    const pct =
                      vol.plannedSets > 0
                        ? Math.min(100, Math.round((vol.completedSets / vol.plannedSets) * 100))
                        : 0;
                    return (
                      <View key={vol.category} style={styles.volumeRow}>
                        <View style={styles.volumeLabelLine}>
                          <Text style={[styles.volumeCatName, { color: theme.text }]}>
                            {vol.label}
                          </Text>
                          <Text style={[styles.volumeMetaText, { color: theme.textMuted }]}>
                            {vol.completedSets}/{vol.plannedSets} serii
                            {vol.volumeKg > 0 ? ` • ${vol.volumeKg} kg` : ''}
                          </Text>
                        </View>
                        <View style={[styles.volumeTrack, { backgroundColor: theme.bgTertiary }]}>
                          <View
                            style={[
                              styles.volumeFill,
                              { width: `${pct}%`, backgroundColor: theme.text },
                            ]}
                          />
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* SECTION 5: WORKOUT HISTORY LOG */}
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={[styles.cardKicker, { color: theme.textMuted }]}>DZIENNIK SESJI</Text>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>
                    Historia treningów ({workoutHistory.length})
                  </Text>
                </View>
              </View>

              {workoutHistory.length === 0 ? (
                <Text style={[styles.emptyBlockText, { color: theme.textMuted }]}>
                  Ukończ pierwszy trening, aby pojawił się tutaj wraz z objętością i czasem trwania.
                </Text>
              ) : (
                <>
                  {(showAllHistory ? workoutHistory : workoutHistory.slice(0, 5)).map(
                    (entry, idx) => (
                      <View
                        key={`${entry.date}_${entry.dayId}_${idx}`}
                        style={[styles.workoutHistRow, { borderBottomColor: theme.hairline }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.workoutHistTitle, { color: theme.text }]}>
                            {entry.dayName}
                          </Text>
                          <Text style={[styles.workoutHistSub, { color: theme.textMuted }]}>
                            {entry.date}
                            {entry.planName ? ` • ${entry.planName}` : ''}
                          </Text>
                        </View>

                        <View style={styles.workoutHistRight}>
                          <Text style={[styles.workoutHistSets, { color: theme.text }]}>
                            {entry.completedSets}/{entry.totalSets} serii
                          </Text>
                          <Text style={[styles.workoutHistMeta, { color: theme.textMuted }]}>
                            {entry.durationMinutes ? `${entry.durationMinutes} min` : ''}
                            {entry.durationMinutes && entry.totalVolumeKg ? ' • ' : ''}
                            {entry.totalVolumeKg ? `${entry.totalVolumeKg} kg` : ''}
                          </Text>
                        </View>
                      </View>
                    )
                  )}

                  {workoutHistory.length > 5 && (
                    <TouchableOpacity
                      style={[styles.showMoreHistBtn, { borderColor: theme.border }]}
                      onPress={() => setShowAllHistory((prev) => !prev)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.showMoreHistText, { color: theme.text }]}>
                        {showAllHistory
                          ? 'Zwiń historię'
                          : `Pokaż wszystkie (${workoutHistory.length})`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        )}
      </Animated.View>

      {/* Modal Dodawania / Edycji PR oraz Rangi Ćwiczenia */}
      <InteractiveBottomSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={selectedExercise?.name || 'Nowy wynik'}
        subtitle={
          selectedExercise
            ? `${
                MUSCLE_SUBGROUP_MAP[resolveExerciseMuscles(selectedExercise).primary]?.label ||
                selectedExercise.category.toUpperCase()
              } • Ranga i Rekordy`
            : undefined
        }
        initialHeightPercent={0.88}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Exercise Rank Progress Banner inside Modal */}
            {selectedExerciseRankStat ? (
              <View
                style={[
                  styles.modalRankCard,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
              >
                <RankBadge
                  tier={selectedExerciseRankStat.rank}
                  size="lg"
                  progressPct={selectedExerciseRankStat.progressPct}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.modalRankKicker, { color: theme.textMuted }]}>
                    RANGA ĆWICZENIA (STAŻ SERII)
                  </Text>
                  <Text style={[styles.modalRankTitle, { color: theme.text }]}>
                    Ranga {selectedExerciseRankStat.rank} • {selectedExerciseRankStat.rankMeta.title}
                  </Text>
                  <Text style={[styles.modalRankSub, { color: theme.textSecondary }]}>
                    Wykonano łącznie {selectedExerciseRankStat.totalSets} serii
                    {selectedExerciseRankStat.nextTier
                      ? ` • Brakuje ${selectedExerciseRankStat.setsToNext} serii do rangi ${selectedExerciseRankStat.nextTier}`
                      : ' • Osiągnięto maksymalną rangę S+'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Form */}
            <View style={[styles.formContainer, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.formHeaderTitle, { color: theme.text }]}>
                Nowy wynik dla ćwiczenia
              </Text>

              <View style={styles.formInputsRow}>
                {/* Weight */}
                <View style={styles.inputCol}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>CIĘŻAR (KG)</Text>
                  <View style={[styles.stepperContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.stepperInput, { color: theme.text }]}
                      keyboardType="decimal-pad"
                      value={inputWeight}
                      onChangeText={setInputWeight}
                    />
                    <View style={styles.stepperActions}>
                      <TouchableOpacity
                        style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                        onPress={() => adjustWeight(2.5)}
                      >
                        <Text style={[styles.stepBtnText, { color: theme.text }]}>+2.5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(-2.5)}>
                        <Text style={[styles.stepBtnText, { color: theme.text }]}>-2.5</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Reps */}
                <View style={styles.inputCol}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>POWTÓRZENIA</Text>
                  <View style={[styles.stepperContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.stepperInput, { color: theme.text }]}
                      keyboardType="number-pad"
                      value={inputReps}
                      onChangeText={setInputReps}
                    />
                    <View style={styles.stepperActions}>
                      <TouchableOpacity
                        style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                        onPress={() => adjustReps(1)}
                      >
                        <Text style={[styles.stepBtnText, { color: theme.text }]}>+1</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => adjustReps(-1)}>
                        <Text style={[styles.stepBtnText, { color: theme.text }]}>-1</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* 1RM projection banner */}
              <View style={[styles.projectionBanner, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
                <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                  Szacowany 1RM z tej serii:
                </Text>
                <Text style={[styles.projectionValue, { color: theme.text }]}>
                  ~{currentEst1RM} kg
                </Text>
              </View>

              {currentEst1RM > 0 && (
                <View style={[styles.pctTableRow, { borderColor: theme.hairline }]}>
                  {[90, 85, 80, 75, 70].map((pct) => {
                    const val = Math.round(currentEst1RM * (pct / 100) * 2) / 2;
                    return (
                      <View key={pct} style={styles.pctCell}>
                        <Text style={[styles.pctCellLabel, { color: theme.textMuted }]}>{pct}%</Text>
                        <Text style={[styles.pctCellVal, { color: theme.text }]}>{val}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <TextInput
                style={[
                  styles.noteField,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Notatka (opcjonalnie, np. RPE 9, łatwa seria)..."
                placeholderTextColor={theme.textMuted}
                value={inputNote}
                onChangeText={setInputNote}
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveRecord}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                  ZAPISZ REKORD
                </Text>
              </TouchableOpacity>
            </View>

            {/* History of this exercise */}
            <View style={styles.historySection}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>
                Historia serii PR ({history.length})
              </Text>
              {history.length === 0 ? (
                <Text style={[styles.historyEmpty, { color: theme.textMuted }]}>
                  Brak zapisanych serii PR dla tego ćwiczenia. Wpisz swój pierwszy wynik powyżej!
                </Text>
              ) : (
                history.map((rec) => (
                  <View
                    key={rec.id}
                    style={[styles.historyRow, { borderBottomColor: theme.hairline }]}
                  >
                    <View>
                      <View style={styles.histNumbers}>
                        <Text style={[styles.histWeight, { color: theme.text }]}>
                          {rec.weight} kg
                        </Text>
                        <Text style={[styles.histReps, { color: theme.textSecondary }]}>
                          × {rec.reps} powt.
                        </Text>
                      </View>
                      {rec.note ? (
                        <Text style={[styles.histDate, { color: theme.textMuted }]}>
                          {rec.note}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.histMeta}>
                      <Text style={[styles.hist1RM, { color: theme.textSecondary }]}>
                        1RM: ~{rec.estimated1RM} kg
                      </Text>
                      <Text style={[styles.histDate, { color: theme.textMuted }]}>
                        {rec.date.slice(0, 10)}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteRecord(rec)}
                      style={styles.trashBtn}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  overallBadgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  overallBadgeKicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  overallBadgeTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
  overallBadgeSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  modeSwitchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  modeSwitchBox: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 11,
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  bentoTopStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bentoMiniCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  bentoMiniLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  bentoMiniVal: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  bentoMiniSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.3,
  },
  coachPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coachPillText: {
    color: '#F43F5E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  coachIntroText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  priorityList: {
    gap: 10,
  },
  priorityItemCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  priorityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  priorityMuscleName: {
    fontSize: 14,
    fontWeight: '900',
  },
  priorityDeltaBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  priorityReason: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  recExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  recExChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '42%',
  },
  recExChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  recJumpBtn: {
    marginLeft: 'auto',
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  recJumpBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  parentFilterRow: {
    gap: 7,
    paddingBottom: 12,
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  muscleBentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  muscleBentoTile: {
    width: '48.5%',
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
  },
  muscleTileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  muscleTileParent: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  muscleTileTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  muscleTileProgressWrap: {
    marginTop: 9,
  },
  muscleTileNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  muscleTileSets: {
    fontSize: 11,
    fontWeight: '800',
  },
  muscleTileNext: {
    fontSize: 10,
    fontWeight: '700',
  },
  muscleTileBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  muscleTileBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  muscleTileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  muscleTileStatus: {
    fontSize: 10,
    fontWeight: '700',
    flex: 1,
  },
  // View 2: Exercises grouped by muscle
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryWrap: {
    marginBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  list: {
    flex: 1,
  },
  listInner: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  muscleGroupSection: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
  },
  muscleGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  muscleGroupKicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  muscleGroupTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  muscleGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleGroupSets: {
    fontSize: 11,
    fontWeight: '800',
  },
  exerciseRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 11,
  },
  exCenterCol: {
    flex: 1,
  },
  exTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  exSetsProgressText: {
    fontSize: 11,
    marginTop: 3,
  },
  exSecondaryText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  prResultCol: {
    alignItems: 'flex-end',
  },
  prWeightText: {
    fontSize: 15,
    fontWeight: '900',
  },
  prRepsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pr1RMText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  addBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  addBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyView: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // View 3: Telemetry styles
  timeframeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tfPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
  },
  tfPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  weightDeltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weightDeltaText: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginBottom: 8,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(150,150,150,0.2)',
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  creatineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  creatineBadgeText: {
    fontSize: 10,
    fontWeight: '900',
  },
  suppChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  suppChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  suppChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  creatineSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  creatineRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dayCircleCol: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  dayLabelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyX: {
    fontSize: 12,
    fontWeight: '700',
  },
  dayNumText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyBlockText: {
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 8,
  },
  improvementsList: {
    marginTop: 4,
  },
  improvementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  impName: {
    fontSize: 14,
    fontWeight: '800',
  },
  impSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  catTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  catTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  impPrevText: {
    fontSize: 11,
  },
  impRight: {
    alignItems: 'flex-end',
  },
  impWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  impWeightCur: {
    fontSize: 15,
    fontWeight: '900',
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  deltaChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  imp1RM: {
    fontSize: 11,
    marginTop: 2,
  },
  volumeList: {
    gap: 10,
    marginTop: 4,
  },
  volumeRow: {
    gap: 5,
  },
  volumeLabelLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  volumeCatName: {
    fontSize: 13,
    fontWeight: '800',
  },
  volumeMetaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  volumeTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  volumeFill: {
    height: '100%',
    borderRadius: 4,
  },
  workoutHistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  workoutHistTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  workoutHistSub: {
    fontSize: 11,
    marginTop: 2,
  },
  workoutHistRight: {
    alignItems: 'flex-end',
  },
  workoutHistSets: {
    fontSize: 13,
    fontWeight: '800',
  },
  workoutHistMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  showMoreHistBtn: {
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
  },
  showMoreHistText: {
    fontSize: 12,
    fontWeight: '800',
  },
  // Modal styles
  modalScroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalRankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
  },
  modalRankKicker: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  modalRankTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  modalRankSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  formContainer: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 18,
  },
  formHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  stepperContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperInput: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 10,
  },
  stepperActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRightWidth: 0.5,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  projectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 10,
  },
  projectionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  projectionValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  pctTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 12,
  },
  pctCell: {
    alignItems: 'center',
    flex: 1,
  },
  pctCellLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  pctCellVal: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  noteField: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  historySection: {
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },
  historyEmpty: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  histNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  histWeight: {
    fontSize: 15,
    fontWeight: '900',
  },
  histReps: {
    fontSize: 13,
    fontWeight: '700',
  },
  histMeta: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
    marginRight: 12,
  },
  hist1RM: {
    fontSize: 12,
    fontWeight: '700',
  },
  histDate: {
    fontSize: 11,
    marginTop: 2,
  },
  trashBtn: {
    padding: 6,
  },
});
