import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MinimalistBackdrop } from './MinimalistBackdrop';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useIsScreenActive } from '../context/TabActivityContext';
import { matchesExerciseSearch } from '../i18n/exerciseTranslations';
import { getTranslatedSupplement } from '../i18n/translations';
import { getLocalDateKey, getLocalDateKeyOffset, parseLocalDateKey } from '../utils/localDate';
import { SmartScrollView } from './SmartScrollView';
import {
  DayPlan,
  Exercise,
  MuscleSubGroupId,
  PRRecord,
  RankTier,
  SupplementItem,
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
  CreatineDayEntry,
  deletePRRecord,
  deleteWeightEntry,
  getAllBestPRs,
  getCreatineLog,
  getCustomExercises,
  getExerciseHistory,
  getFavoriteExerciseIds,
  getSupplementDayTakenIds,
  getWeightHistory,
  getWorkoutHistory,
  setSupplementDayTakenIds,
  updateProfileStats,
} from '../services/storage';
import { getAppSettings } from '../services/settings';
import { formatSupplementDose } from '../data/supplements';
import {
  cancelEveningCreatineReminder,
  scheduleEveningCreatineReminder,
} from '../services/notifications';
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
import { AnimatedIcon } from './AnimatedIcon';
import { BottomSheetScrollView, InteractiveBottomSheet } from './InteractiveBottomSheet';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface ProgressTabProps {
  activeProfile?: UserProfile | null;
  activePlan?: WorkoutPlan | null;
  profilePlans?: WorkoutPlan[];
  profileId?: string;
  extraExercises?: Exercise[];
  refreshKey?: number;
  isTabActive?: boolean;
  focusedExercise?: Exercise | null;
  onClearFocusedExercise?: () => void;
}

type SubViewTab = 'physique' | 'exercises' | 'journal';
type ChartRange = '7d' | '30d' | 'all';

const SUB_TABS: Array<{ id: SubViewTab; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap; a11yKey: 'silhouetteTabLabel' | 'exercisesTabLabel' | 'journalTabLabel' }> = [
  { id: 'physique', icon: 'body-outline', activeIcon: 'body', a11yKey: 'silhouetteTabLabel' },
  { id: 'exercises', icon: 'barbell-outline', activeIcon: 'barbell', a11yKey: 'exercisesTabLabel' },
  { id: 'journal', icon: 'stats-chart-outline', activeIcon: 'stats-chart', a11yKey: 'journalTabLabel' },
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
  const barScaleAnim = useRef(new Animated.Value(isSelected ? 1.08 : 1)).current;

  useEffect(() => {
    Animated.spring(barScaleAnim, {
      toValue: isSelected ? 1.1 : 1,
      tension: 140,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [isSelected, barScaleAnim]);

  return (
    <Animated.View
      style={[
        styles.spectrumColTrack,
        {
          backgroundColor: trackColor,
          borderColor: isSelected ? color : 'transparent',
          borderWidth: isSelected ? 1.5 : 0,
          transform: [{ scaleY: barScaleAnim }],
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
    </Animated.View>
  );
});

const RankLadderColumn: React.FC<{
  tier: RankTier;
  color: string;
  count: number;
  heightPct: number;
  isSelected: boolean;
  anySelected: boolean;
  trackColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  onPress: () => void;
}> = React.memo(
  ({
    tier,
    color,
    count,
    heightPct,
    isSelected,
    anySelected,
    trackColor,
    textColor,
    mutedColor,
    borderColor,
    onPress,
  }) => {
    const badgePopAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      Animated.spring(badgePopAnim, {
        toValue: isSelected ? 1 : 0,
        tension: 150,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }, [isSelected, badgePopAnim]);

    const badgeTranslateY = badgePopAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -5],
    });
    const badgeScale = badgePopAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.14],
    });

    return (
      <TouchableOpacity
        style={[
          styles.spectrumColWrap,
          isSelected && {
            backgroundColor: `${color}16`,
            borderColor: `${color}55`,
            borderWidth: 1,
            borderRadius: 14,
          },
          anySelected && !isSelected && { opacity: 0.56 },
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.spectrumCountLabel,
            {
              color: isSelected ? color : count > 0 ? textColor : mutedColor,
              opacity: isSelected || count > 0 ? 1 : 0.45,
            },
          ]}
        >
          {count}
        </Text>

        <AnimatedVerticalSpectrumBar
          pct={heightPct}
          color={count > 0 || isSelected ? color : borderColor}
          trackColor={trackColor}
          isSelected={isSelected}
        />

        <Animated.View
          style={{
            transform: [{ translateY: badgeTranslateY }, { scale: badgeScale }],
          }}
        >
          <RankCrestIcon
            tier={tier}
            size={34}
            isSelected={isSelected}
            dimmed={count === 0 && !isSelected}
          />
        </Animated.View>
      </TouchableOpacity>
    );
  }
);

const RankSpotlightDropCard: React.FC<{
  tier: RankTier;
  color: string;
  titleText: string;
  subtitleText: string;
  bgColor: string;
  titleColor: string;
  subColor: string;
}> = ({ tier, color, titleText, subtitleText, bgColor, titleColor, subColor }) => {
  const dropAnim = useRef(new Animated.Value(0)).current;
  const crestAnim = useRef(new Animated.Value(0)).current;
  const sheenAnim = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    dropAnim.stopAnimation();
    crestAnim.stopAnimation();
    sheenAnim.stopAnimation();

    dropAnim.setValue(0);
    crestAnim.setValue(0);
    sheenAnim.setValue(-1);

    Animated.parallel([
      Animated.spring(dropAnim, {
        toValue: 1,
        tension: 120,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(crestAnim, {
        toValue: 1,
        tension: 105,
        friction: 6.5,
        useNativeDriver: true,
      }),
      Animated.timing(sheenAnim, {
        toValue: 1.35,
        duration: 620,
        delay: 70,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tier, dropAnim, crestAnim, sheenAnim]);

  const cardTranslateY = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-22, 0],
  });
  const cardScale = dropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });
  const crestTranslateY = crestAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-14, 0],
  });
  const crestScale = crestAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });
  const crestRotate = crestAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-14deg', '0deg'],
  });
  const sheenTranslateX = sheenAnim.interpolate({
    inputRange: [-1, 1.35],
    outputRange: [-220, 420],
  });

  return (
    <Animated.View
      style={[
        styles.tierSpotlightRow,
        {
          borderLeftColor: color,
          borderColor: `${color}38`,
          backgroundColor: bgColor,
          opacity: dropAnim,
          transform: [{ translateY: cardTranslateY }, { scale: cardScale }],
        },
      ]}
    >
      {/* Sweeping metallic highlight streak */}
      <Animated.View
        style={[
          styles.tierSpotlightSheen,
          {
            pointerEvents: 'none',
            backgroundColor: `${color}1C`,
            transform: [{ translateX: sheenTranslateX }, { skewX: '-22deg' }],
          },
        ]}
      />
      <Animated.View
        style={{
          transform: [
            { translateY: crestTranslateY },
            { scale: crestScale },
            { rotate: crestRotate },
          ],
        }}
      >
        <RankCrestIcon tier={tier} size={50} isSelected animated />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.tierSpotlightTitle, { color: titleColor }]}>
          {titleText}
        </Text>
        <Text style={[styles.tierSpotlightSub, { color: subColor }]}>
          {subtitleText}
        </Text>
      </View>
    </Animated.View>
  );
};

const EMPTY_PLANS: WorkoutPlan[] = [];
const EMPTY_EXERCISES: Exercise[] = [];

export const ProgressTab: React.FC<ProgressTabProps> = ({
  activeProfile,
  activePlan,
  profilePlans = EMPTY_PLANS,
  profileId,
  extraExercises = EMPTY_EXERCISES,
  refreshKey = 0,
  isTabActive = true,
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
  const isScreenActive = useIsScreenActive();
  const heroCrestPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTabActive || !isScreenActive) {
      heroCrestPulse.stopAnimation();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroCrestPulse, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroCrestPulse, {
          toValue: 0,
          duration: 1700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heroCrestPulse, isTabActive, isScreenActive]);

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
  const [expandedExGroups, setExpandedExGroups] = useState<Record<string, boolean>>({});

  // Exercise progression sheet
  const { t, localeCode, muscleLabel, exerciseName, rankTitle, rankSubtitle, equipmentLabel } = useLanguage();
  const insets = useSafeAreaInsets();
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
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
  const [enabledSupplements, setEnabledSupplements] = useState<SupplementItem[]>([]);
  const [todayTakenSuppIds, setTodayTakenSuppIds] = useState<string[]>([]);
  const [suppLog7Days, setSuppLog7Days] = useState<CreatineDayEntry[]>([]);
  const [bodyWeightUnitLabel] = useState('kg');

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

  const extraExercisesRef = useRef<Exercise[]>(extraExercises);
  extraExercisesRef.current = extraExercises;
  const activePlanDaysRef = useRef<DayPlan[]>(activePlanDays);
  activePlanDaysRef.current = activePlanDays;
  const analyticsLoadSeqRef = useRef(0);

  const planContentKey = useMemo(
    () =>
      activePlanDays
        .map((d) => `${d.id}:${(d.exercises || []).map((e) => `${e.id}:${e.sets}`).join(',')}`)
        .join('|'),
    [activePlanDays]
  );

  const loadAllAnalytics = useCallback(async () => {
    const seq = ++analyticsLoadSeqRef.current;
    const todayKey = getLocalDateKey();
    const [prs, weights, hist, custom, favs, appSettings, takenToday, supp7] = await Promise.all([
      getAllBestPRs(effectiveProfileId),
      getWeightHistory(effectiveProfileId),
      getWorkoutHistory(effectiveProfileId),
      getCustomExercises(),
      getFavoriteExerciseIds(),
      getAppSettings(),
      getSupplementDayTakenIds(todayKey, effectiveProfileId),
      getCreatineLog(7, effectiveProfileId),
    ]);
    if (seq !== analyticsLoadSeqRef.current) return;

    setBestPRs(prs);
    setWeightHistory(weights);
    setWorkoutHistory(hist);
    setCustomExercises(custom);
    setFavoriteIds(favs);
    setEnabledSupplements((appSettings.supplements || []).filter((s) => s.enabled));
    setTodayTakenSuppIds(takenToday);
    setSuppLog7Days(supp7);

    const catalog = mergeAllExercises(custom, [
      ...EXERCISE_LIBRARY,
      ...extraExercisesRef.current,
    ]);
    const report = await computePhysiqueAnalytics({
      profileId: effectiveProfileId,
      allExercises: catalog,
      activePlanDays: activePlanDaysRef.current,
      workoutHistory: hist,
    });
    if (seq !== analyticsLoadSeqRef.current) return;
    setPhysiqueReport(report);
  }, [effectiveProfileId, planContentKey]);

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

  const isDraggingNavRef = useRef(false);

  const handleSwitchSubView = useCallback(
    (next: SubViewTab, animateThumb = true) => {
      const targetIdx = SUB_TABS.findIndex((t) => t.id === next);
      if (targetIdx < 0) return;

      if (animateThumb) {
        Animated.parallel([
          Animated.spring(navThumbAnim, {
            toValue: targetIdx,
            friction: 7,
            tension: 96,
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
        Haptics.selectionAsync();
      } catch {}

      subViewRef.current = next;
      setSliderVisualIdx(targetIdx);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      viewFadeAnim.setValue(0.84);

      React.startTransition(() => {
        setSubView(next);
      });

      Animated.timing(viewFadeAnim, {
        toValue: 1,
        duration: 135,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [navScaleAnim, navThumbAnim, viewFadeAnim]
  );

  const handleSwitchSubViewRef = useRef(handleSwitchSubView);
  handleSwitchSubViewRef.current = handleSwitchSubView;

  const navPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.1,
        onPanResponderGrant: () => {
          isDraggingNavRef.current = true;
          const curIdx = Math.max(
            0,
            SUB_TABS.findIndex((t) => t.id === subViewRef.current)
          );
          dragStartIndexRef.current = curIdx;
          hoverIdxRef.current = curIdx;
          Animated.spring(navScaleAnim, {
            toValue: 0.95,
            friction: 8,
            tension: 140,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gestureState) => {
          const rawIdx = dragStartIndexRef.current + gestureState.dx / SLIDER_SLOT_W;
          const clampedIdx = Math.max(0, Math.min(SUB_TABS.length - 1, rawIdx));
          navThumbAnim.setValue(clampedIdx);

          const nearestIdx = Math.round(clampedIdx);
          if (nearestIdx !== hoverIdxRef.current) {
            hoverIdxRef.current = nearestIdx;
            setSliderVisualIdx(nearestIdx);
            const targetTab = SUB_TABS[nearestIdx]?.id;
            if (targetTab && targetTab !== subViewRef.current) {
              try {
                Haptics.selectionAsync();
              } catch {}
              handleSwitchSubViewRef.current(targetTab, false);
            }
          }
        },
        onPanResponderRelease: () => {
          isDraggingNavRef.current = false;
          const targetIdx = Math.max(
            0,
            SUB_TABS.findIndex((t) => t.id === subViewRef.current)
          );
          Animated.parallel([
            Animated.spring(navThumbAnim, {
              toValue: targetIdx,
              friction: 7,
              tension: 96,
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
        onPanResponderTerminate: () => {
          isDraggingNavRef.current = false;
          const curIdx = Math.max(
            0,
            SUB_TABS.findIndex((t) => t.id === subViewRef.current)
          );
          setSliderVisualIdx(curIdx);
          Animated.parallel([
            Animated.spring(navThumbAnim, {
              toValue: curIdx,
              friction: 7,
              tension: 96,
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
    [navScaleAnim, navThumbAnim]
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
      Alert.alert(t('invalidDataTitle'), t('invalidDataBody'));
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
      Alert.alert(t('invalidWeightTitle'), t('invalidWeightBody'));
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

  const syncEveningSuppNotifState = async (anyTaken: boolean) => {
    try {
      const s = await getAppSettings();
      if (!s.creatineRemindersEnabled) return;
      if (anyTaken) {
        await cancelEveningCreatineReminder();
      } else {
        await scheduleEveningCreatineReminder(s.creatineEveningHour, s.creatineEveningMinute);
      }
    } catch {}
  };

  const resolveEffectiveTakenIds = (rawIds: string[]): string[] => {
    if (rawIds.includes('__all__')) {
      return enabledSupplements.length > 0 ? enabledSupplements.map((s) => s.id) : ['__all__'];
    }
    return rawIds;
  };

  const handleToggleSupplementItem = async (suppId: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const todayKey = getLocalDateKey();
    const current = resolveEffectiveTakenIds(todayTakenSuppIds);
    const exists = current.includes(suppId);
    const next = exists ? current.filter((id) => id !== suppId) : [...current, suppId];
    setTodayTakenSuppIds(next);
    await setSupplementDayTakenIds(next, todayKey, effectiveProfileId);
    const updatedLog = await getCreatineLog(7, effectiveProfileId);
    setSuppLog7Days(updatedLog);
    void syncEveningSuppNotifState(next.length > 0);
  };

  const handleToggleAllSupplementsToday = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    const todayKey = getLocalDateKey();
    const current = resolveEffectiveTakenIds(todayTakenSuppIds);
    const targetIds = enabledSupplements.length > 0 ? enabledSupplements.map((s) => s.id) : ['__all__'];
    const allTakenNow = targetIds.every((id) => current.includes(id));
    const next = allTakenNow ? [] : targetIds;
    setTodayTakenSuppIds(next);
    await setSupplementDayTakenIds(next, todayKey, effectiveProfileId);
    const updatedLog = await getCreatineLog(7, effectiveProfileId);
    setSuppLog7Days(updatedLog);
    void syncEveningSuppNotifState(next.length > 0);
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

    const favSet = new Set(favoriteIds);
    for (const m of MUSCLE_SUBGROUPS) {
      map[m.id].sort((a, b) => {
        const aFav = favSet.has(a.exerciseId) || favSet.has(a.exercise.id) ? 1 : 0;
        const bFav = favSet.has(b.exerciseId) || favSet.has(b.exercise.id) ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        const aPR = bestPRs[a.exerciseId];
        const bPR = bestPRs[b.exerciseId];
        const aHasProgress = a.totalSets > 0 || Boolean(aPR) ? 1 : 0;
        const bHasProgress = b.totalSets > 0 || Boolean(bPR) ? 1 : 0;
        if (bHasProgress !== aHasProgress) return bHasProgress - aHasProgress;
        if (b.totalSets !== a.totalSets) return b.totalSets - a.totalSets;
        const a1RM = aPR?.estimated1RM || 0;
        const b1RM = bPR?.estimated1RM || 0;
        if (b1RM !== a1RM) return b1RM - a1RM;
        return exerciseName(a.exercise.id, a.exercise.name).localeCompare(
          exerciseName(b.exercise.id, b.exercise.name),
          localeCode
        );
      });
    }
    return map;
  }, [allExercises, physiqueReport, bestPRs, favoriteIds, exerciseName, localeCode]);

  const filteredMuscleGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = MUSCLE_SUBGROUPS.filter((m) => {
      if (muscleFilter !== 'all' && m.id !== muscleFilter) return false;
      const list = exercisesByMuscle[m.id] || [];
      if (!q) return list.length > 0;
      return (
        m.label.toLowerCase().includes(q) ||
        muscleLabel(m.id).toLowerCase().includes(q) ||
        list.some((ex) =>
          matchesExerciseSearch(
            q,
            ex.exercise.id,
            ex.exercise.name,
            [exerciseName(ex.exercise.id, ex.exercise.name)],
            ex.exerciseId
          )
        )
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
  }, [muscleFilter, searchQuery, exercisesByMuscle, physiqueReport, bestPRs, muscleLabel, exerciseName]);

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
    const cutoffKey = getLocalDateKeyOffset(-days);
    return items.filter((i) => i.date.slice(0, 10) >= cutoffKey);
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
      const iso = getLocalDateKeyOffset(-i, now);
      const d = parseLocalDateKey(iso);
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
            {t('noWeightInRange')}
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
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.hairline,
            paddingTop: Math.max(insets.top + 8, 16),
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Text style={[styles.title, { color: theme.text }]}>{t('progressTitle')}</Text>

          <View
            {...navPanResponder.panHandlers}
            style={[
              styles.navPills,
              {
                width: SLIDER_WIDTH,
                backgroundColor: isDark
                  ? 'rgba(24, 24, 30, 0.44)'
                  : 'rgba(255, 255, 255, 0.46)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.16)'
                  : 'rgba(15, 23, 42, 0.11)',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.navPillAnimatedThumb,
                {
                  width: SLIDER_SLOT_W,
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.88)'
                    : 'rgba(15, 23, 42, 0.86)',
                  pointerEvents: 'none',
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
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleSwitchSubView(tab.id, true)}
                  activeOpacity={0.78}
                  accessibilityLabel={t(tab.a11yKey)}
                  style={styles.navPillBtn}
                >
                  <Ionicons
                    name={active ? tab.activeIcon : tab.icon}
                    size={17}
                    color={active ? theme.bg : theme.textMuted}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <SmartScrollView
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
                    size={62}
                    progressPct={overallAverageProgress}
                    animated
                  />
                  <View style={styles.heroCrestTextCol}>
                    <Text style={[styles.heroCrestEyebrow, { color: theme.textMuted }]}>
                      {t('overallRankCaps')}
                    </Text>
                    <Text style={[styles.heroCrestTitle, { color: theme.text }]}>
                      {rankTitle(physiqueReport?.overallRank || 'F')}
                    </Text>
                    <Text
                      style={[
                        styles.heroCrestSub,
                        { color: physiqueReport?.overallRankMeta.color || theme.textSecondary },
                      ]}
                    >
                      {t('avgTierProgress', { pct: overallAverageProgress })}
                    </Text>
                  </View>
                </View>

                <View style={styles.heroStatsRightRow}>
                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {physiqueReport?.balanceScorePct ?? 100}%
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      {t('balanceMetricLabel')}
                    </Text>
                  </View>

                  <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {physiqueReport?.totalLifetimeSets ?? 0}
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      {t('seriesMetricLabel')}
                    </Text>
                  </View>

                  <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />

                  <View style={styles.heroMetricItem}>
                    <Text style={[styles.heroMetricValue, { color: theme.text }]}>
                      {Object.keys(bestPRs).length}
                    </Text>
                    <Text style={[styles.heroMetricLabel, { color: theme.textMuted }]}>
                      {t('recordsMetricLabel')}
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
                  exercisesByMuscle={exercisesByMuscle}
                  isTabActive={isTabActive}
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
                        {t('emblemsProgressionCaps')}
                      </Text>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        {t('rankLadderHeading')}
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
                          {t('showAllCount', { count: physiqueReport.muscleStatsList.length })}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {/* 8-Column Interactive Emblem + Spectrum Chart */}
                  <View style={styles.spectrumGridRow}>
                    {RANK_TIERS.map((tierObj) => {
                      const count = tierDistribution[tierObj.tier] || 0;
                      const isSelected = selectedRankTier === tierObj.tier;
                      const heightPct =
                        count === 0
                          ? 12
                          : Math.min(100, Math.max(24, Math.round((count / 10) * 100)));

                      return (
                        <RankLadderColumn
                          key={tierObj.tier}
                          tier={tierObj.tier}
                          color={tierObj.color}
                          count={count}
                          heightPct={heightPct}
                          isSelected={isSelected}
                          anySelected={selectedRankTier !== null}
                          trackColor={theme.bgSecondary}
                          textColor={theme.text}
                          mutedColor={theme.textMuted}
                          borderColor={theme.border}
                          onPress={() => {
                            try {
                              Haptics.selectionAsync();
                            } catch {}
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setSelectedRankTier(
                              selectedRankTier === tierObj.tier ? null : tierObj.tier
                            );
                          }}
                        />
                      );
                    })}
                  </View>

                  {/* Selected Tier Info Strip (Dynamic spring entrance + sheen sweep) */}
                  {selectedRankTier ? (
                    <RankSpotlightDropCard
                      tier={selectedRankTier}
                      color={RANK_TIER_MAP[selectedRankTier].color}
                      bgColor={theme.bgSecondary}
                      titleColor={theme.text}
                      subColor={theme.textSecondary}
                      titleText={t('tierSpotlightTitle', {
                        tier: selectedRankTier,
                        title: rankTitle(selectedRankTier),
                        count: tierDistribution[selectedRankTier],
                      })}
                      subtitleText={t('rankThresholdInfo', {
                        subtitle: rankSubtitle(selectedRankTier),
                        muscleSets: RANK_TIER_MAP[selectedRankTier].minMuscleSets,
                        exSets: RANK_TIER_MAP[selectedRankTier].minExerciseSets,
                      })}
                    />
                  ) : null}

                  {/* Closest to Rank-Up Milestone Strip ("Najbliżej awansu") */}
                  {closestToRankUp.length > 0 && (
                    <View style={[styles.milestoneBlock, { borderTopColor: theme.hairline }]}>
                      <View style={styles.milestoneHeaderRow}>
                        <AnimatedIcon name="sparkles-outline" preset="pulse" size={13} color="#10B981" active />
                        <Text style={[styles.milestoneHeaderTitle, { color: theme.textSecondary }]}>
                          {t('closestRankKicker')}
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
                                {muscleLabel(mStat.muscleId)}
                              </Text>
                              <Text style={[styles.milestoneRemaining, { color: theme.textMuted }]}>
                                {t('moreSetsNeededPct', {
                                  sets: mStat.setsToNext,
                                  pct: mStat.progressPct,
                                })}
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
                        {t('trainingRecCaps')}
                      </Text>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        {t('whatToTrainNow')}
                      </Text>
                    </View>
                    <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                      {t('top3Priorities')}
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
                              {muscleLabel(stat.muscleId)}
                            </Text>
                            <Text
                              style={[
                                styles.priorityReasonTag,
                                { color: dotColor },
                              ]}
                            >
                              {stat.priorityStatus === 'untrained'
                                ? t('legendNoSets')
                                : t('normPct', {
                                    pct: Math.round(stat.relativeDevelopmentRatio * 100),
                                  })}
                            </Text>
                          </View>

                          <Text
                            style={[styles.priorityHint, { color: theme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {topEx
                              ? t('recommendedExSets', {
                                  name: exerciseName(topEx.exercise.id, topEx.exercise.name),
                                  sets: topEx.totalSets,
                                })
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
                        ? t('rankFilterCaps', {
                            tier: selectedRankTier,
                            count: orderedMuscleList.length,
                          })
                        : t('allMuscles19Caps')}
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      {t('muscleRanksTitle')}
                    </Text>
                  </View>

                  <View style={[styles.sortPillsRow, { backgroundColor: theme.bgSecondary }]}>
                    <Animated.View
                      style={[
                        styles.sortAnimatedThumb,
                        {
                          backgroundColor: theme.text,
                          pointerEvents: 'none',
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
                        {t('sortByRank')}
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
                        {t('sortByGaps')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {orderedMuscleList.length === 0 ? (
                  <Text style={[styles.inlineEmptyText, { color: theme.textMuted }]}>
                    {t('noMusclesInTier', { tier: selectedRankTier || '' })}
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
                                  {muscleLabel(stat.muscleId)}
                                </Text>
                                <Text
                                  style={[
                                    styles.muscleRowSets,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {Math.round(stat.effectiveSetsTotal)} {t('setsWord')}
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
                                  {t('noAssignedExercises')}
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
                                          {exerciseName(exStat.exercise.id, exStat.exercise.name)}
                                        </Text>
                                        <Text
                                          style={[
                                            styles.inlineExSub,
                                            { color: theme.textMuted },
                                          ]}
                                        >
                                          {exStat.totalSets} {t('setsWord')}
                                          {pr
                                            ? ` · PR ${pr.weight} kg × ${pr.reps}`
                                            : ` · ${t('noPrYet')}`}
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
                            ? t('progressShowTop')
                            : `${t('progressLoadAll')} (${orderedMuscleList.length})`}
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
                  placeholder={t('searchExOrMusclePlaceholder')}
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
                    {t('all')} (19)
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
                        {muscleLabel(m.id, true)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {filteredMuscleGroups.map((mGroup) => {
                const mStat = physiqueReport?.muscleStats[mGroup.id];
                const q = searchQuery.trim().toLowerCase();
                const translatedGroupLabel = muscleLabel(mGroup.id).toLowerCase();
                const exList = (exercisesByMuscle[mGroup.id] || []).filter(
                  (e) =>
                    !q ||
                    mGroup.label.toLowerCase().includes(q) ||
                    translatedGroupLabel.includes(q) ||
                    matchesExerciseSearch(
                      q,
                      e.exercise.id,
                      e.exercise.name,
                      [exerciseName(e.exercise.id, e.exercise.name)],
                      e.exerciseId
                    )
                );

                if (exList.length === 0) return null;

                const isGroupExpanded = Boolean(expandedExGroups[mGroup.id]);
                const visibleExList = q || isGroupExpanded ? exList : exList.slice(0, 3);
                const hasMoreEx = !q && exList.length > 3;

                return (
                  <View
                    key={mGroup.id}
                    style={[styles.openGroupBlock, { borderTopColor: theme.hairline }]}
                  >
                    <View style={styles.openGroupHeader}>
                      <View style={styles.openGroupTitleWrap}>
                        <RankCrestIcon tier={mStat?.rank || 'F'} size={30} />
                        <Text style={[styles.openGroupTitle, { color: theme.text }]}>
                          {muscleLabel(mGroup.id)}
                        </Text>
                      </View>
                      <Text style={[styles.openGroupMeta, { color: theme.textMuted }]}>
                        {Math.round(mStat?.effectiveSetsTotal || 0)} {t('setsWord')}
                      </Text>
                    </View>

                    {visibleExList.map((exStat, idx) => {
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
                                {exerciseName(exStat.exercise.id, exStat.exercise.name)}
                              </Text>
                              <Text
                                style={[
                                  styles.openExSetsCount,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {exStat.totalSets} {t('setsWord')}
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
                                {exStat.exercise.equipment
                                  ? equipmentLabel(exStat.exercise.equipment)
                                  : t('exerciseFallbackWord')}{' '}
                                · {rankTitle(exStat.rank)}
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

                    {hasMoreEx && (
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
                          setExpandedExGroups((prev) => ({
                            ...prev,
                            [mGroup.id]: !prev[mGroup.id],
                          }));
                        }}
                        activeOpacity={0.78}
                      >
                        <Text style={[styles.loadAllMusclesText, { color: theme.text }]}>
                          {isGroupExpanded
                            ? t('progressShowTop')
                            : `${t('progressLoadAll')} (${exList.length})`}
                        </Text>
                        <Ionicons
                          name={isGroupExpanded ? 'chevron-up' : 'chevron-down'}
                          size={15}
                          color={theme.textSecondary}
                        />
                      </TouchableOpacity>
                    )}
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
                      {t('bodyWeightUpper')}
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
                          {t('fromStartKg', {
                            diff: (
                              weightHistory[weightHistory.length - 1].weight -
                              weightHistory[0].weight
                            ).toFixed(1),
                          })}
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
                    placeholder={t('enterTodayWeightPlaceholder')}
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
                      {t('save')}
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
                        {parseLocalDateKey(w.date).toLocaleDateString(localeCode, {
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

              {/* Open Today's Supplements Check-In ("Czy brałeś dziś suple?") */}
              {(() => {
                const effectiveTaken = resolveEffectiveTakenIds(todayTakenSuppIds);
                const hasItems = enabledSupplements.length > 0;
                const totalItems = hasItems ? enabledSupplements.length : 1;
                const takenCount = hasItems
                  ? enabledSupplements.filter((s) => effectiveTaken.includes(s.id)).length
                  : todayTakenSuppIds.length > 0
                  ? 1
                  : 0;
                const allDone = takenCount >= totalItems && totalItems > 0;

                return (
                  <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                    <View style={styles.openSectionHeader}>
                      <View>
                        <Text style={[styles.sectionEyebrow, { color: allDone ? '#10B981' : theme.textMuted }]}>
                          {t('journalSuppEyebrow')}
                        </Text>
                        <Text style={[styles.sectionHeading, { color: theme.text }]}>
                          {t('journalSuppHeading')}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.suppStatusBadge,
                          {
                            backgroundColor: allDone
                              ? 'rgba(16, 185, 129, 0.14)'
                              : theme.bgSecondary,
                            borderColor: allDone ? '#10B981' : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.suppStatusBadgeText,
                            { color: allDone ? '#10B981' : theme.textSecondary },
                          ]}
                        >
                          {allDone
                            ? t('journalSuppTakenBadge')
                            : hasItems
                            ? `${takenCount}/${totalItems}`
                            : t('journalSuppPendingBadge')}
                        </Text>
                      </View>
                    </View>

                    {hasItems && (
                      <View style={styles.suppChipsWrap}>
                        {enabledSupplements.map((supp) => {
                          const isChecked = effectiveTaken.includes(supp.id);
                          const suppDisplayName = getTranslatedSupplement(
                            supp.id,
                            'name',
                            supp.name,
                            (localeCode.slice(0, 2) as any) || 'pl'
                          );
                          const dose = formatSupplementDose(supp, activeProfile?.weight);
                          return (
                            <TouchableOpacity
                              key={supp.id}
                              style={[
                                styles.suppChip,
                                {
                                  backgroundColor: isChecked
                                    ? 'rgba(16, 185, 129, 0.14)'
                                    : theme.bgSecondary,
                                  borderColor: isChecked ? '#10B981' : theme.border,
                                },
                              ]}
                              onPress={() => handleToggleSupplementItem(supp.id)}
                              activeOpacity={0.75}
                            >
                              <Ionicons
                                name={isChecked ? 'checkmark-circle' : 'ellipse-outline'}
                                size={16}
                                color={isChecked ? '#10B981' : theme.textMuted}
                              />
                              <View style={{ flexShrink: 1 }}>
                                <Text
                                  style={[styles.suppChipName, { color: theme.text }]}
                                  numberOfLines={1}
                                >
                                  {suppDisplayName}
                                </Text>
                                {dose ? (
                                  <Text
                                    style={[styles.suppChipDose, { color: theme.textMuted }]}
                                    numberOfLines={1}
                                  >
                                    {dose}
                                  </Text>
                                ) : null}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.suppMarkAllBtn,
                        {
                          backgroundColor: allDone ? 'rgba(16, 185, 129, 0.14)' : theme.text,
                          borderColor: allDone ? '#10B981' : theme.text,
                        },
                      ]}
                      onPress={handleToggleAllSupplementsToday}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={allDone ? 'checkmark-done-circle' : 'sparkles-outline'}
                        size={17}
                        color={allDone ? '#10B981' : theme.bg}
                      />
                      <Text
                        style={[
                          styles.suppMarkAllText,
                          { color: allDone ? '#10B981' : theme.bg },
                        ]}
                      >
                        {allDone ? t('journalSuppAllDoneBtn') : t('journalSuppMarkAllBtn')}
                      </Text>
                    </TouchableOpacity>

                    {suppLog7Days.length > 0 && (
                      <View style={styles.suppWeekWrap}>
                        <Text style={[styles.suppWeekLabel, { color: theme.textMuted }]}>
                          {t('journalSuppLast7Days')}
                        </Text>
                        <View style={styles.suppWeekRow}>
                          {suppLog7Days.map((entry) => (
                            <View key={entry.date} style={styles.suppWeekCell}>
                              <View
                                style={[
                                  styles.suppWeekDot,
                                  {
                                    backgroundColor: entry.taken ? '#10B981' : theme.bgSecondary,
                                    borderColor: entry.isToday ? theme.text : 'transparent',
                                    borderWidth: entry.isToday ? 1.5 : 0,
                                  },
                                ]}
                              >
                                <Ionicons
                                  name={entry.taken ? 'checkmark' : 'close'}
                                  size={12}
                                  color={entry.taken ? '#09090B' : theme.textMuted}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.suppWeekDay,
                                  { color: entry.isToday ? theme.text : theme.textMuted },
                                ]}
                              >
                                {entry.dayLabel}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Open 28-Day Activity Matrix */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <View style={styles.openSectionHeader}>
                  <View>
                    <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                      {t('regularityCaps')}
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      {t('last28DaysHeading')}
                    </Text>
                  </View>
                  <Text style={[styles.sectionRightMeta, { color: theme.textSecondary }]}>
                    {t('workoutsCountLabel', {
                      count: last28Days.filter((d) => d.active).length,
                    })}
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
                      {t('sessionHistoryCaps')}
                    </Text>
                    <Text style={[styles.sectionHeading, { color: theme.text }]}>
                      {t('recentWorkoutsHeading')}
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
                        {showAllJournalWorkouts
                          ? t('lessLabel')
                          : t('allCountLabel', { count: workoutHistory.length })}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.sectionRightMeta, { color: theme.textMuted }]}>
                      {t('totalCountLabel', { count: workoutHistory.length })}
                    </Text>
                  )}
                </View>

                {workoutHistory.length === 0 ? (
                  <Text style={[styles.emptyLineText, { color: theme.textMuted }]}>
                    {t('noWorkoutsCompleted')}
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
                            {parseLocalDateKey(entry.date).toLocaleDateString(localeCode, {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                            })}
                            {entry.durationMinutes ? ` · ${entry.durationMinutes} min` : ''}
                            {entry.totalVolumeKg
                              ? ` · ${entry.totalVolumeKg.toLocaleString(localeCode)} kg`
                              : ''}
                          </Text>
                        </View>
                        <Text style={[styles.workoutLogSets, { color: theme.textSecondary }]}>
                          {entry.completedSets}/{entry.totalSets} {t('setsWord')}
                        </Text>
                      </View>
                    ))
                )}
              </View>
            </View>
          )}
        </Animated.View>
      </SmartScrollView>

      {/* =========================================================
          EXERCISE DETAIL & 1RM PROGRESSION BOTTOM SHEET (OPEN STYLE)
         ========================================================= */}
      <InteractiveBottomSheet
        visible={selectedExercise !== null}
        onClose={() => setSelectedExercise(null)}
        title={
          selectedExercise
            ? exerciseName(selectedExercise.id, selectedExercise.name)
            : t('exerciseProgressionTitle')
        }
        subtitle={
          selectedExerciseRankStat
            ? t('exRankSetsSub', {
                rank: selectedExerciseRankStat.rank,
                title: rankTitle(selectedExerciseRankStat.rank),
                sets: selectedExerciseRankStat.totalSets,
              })
            : t('history1rmSub')
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
                      {rankTitle(selectedExerciseRankStat.rank)}
                    </Text>
                    <Text style={[styles.sheetRankSub, { color: theme.textMuted }]}>
                      {selectedExerciseRankStat.nextTier
                        ? t('setsMissingToRank', {
                            sets: selectedExerciseRankStat.setsToNext,
                            nextTier: selectedExerciseRankStat.nextTier,
                          })
                        : t('highestRankReached')}
                    </Text>
                  </View>
                  <Text style={[styles.sheetSetsCount, { color: theme.text }]}>
                    {selectedExerciseRankStat.totalSets} {t('setsWord')}
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
                  {t('estimated1rmHeading')}
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
                {t('addResultManuallyUpper')}
              </Text>
              <View style={styles.inlineInputRow}>
                <TextInput
                  style={[
                    styles.inlineInput,
                    { backgroundColor: theme.bgSecondary, color: theme.text },
                  ]}
                  placeholder={t('weightKgPlaceholder')}
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
                  placeholder={t('repsPlaceholder')}
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
                    {t('add')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* PR History List */}
            <View style={[styles.sheetSection, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                {t('savedRecordsCaps', { count: prHistory.length })}
              </Text>
              {prHistory.length === 0 ? (
                <Text style={[styles.emptyLineText, { color: theme.textMuted }]}>
                  {t('noSavedResultsForEx')}
                </Text>
              ) : (
                [...prHistory].reverse().map((rec) => (
                  <View
                    key={rec.id}
                    style={[styles.simpleLogRow, { borderBottomColor: theme.hairline }]}
                  >
                    <Text style={[styles.simpleLogDate, { color: theme.textMuted }]}>
                      {new Date(rec.date).toLocaleDateString(localeCode, {
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
    paddingBottom: 92,
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
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderLeftWidth: 3.5,
    borderWidth: 1,
    borderRadius: 14,
  },
  tierSpotlightSheen: {
    position: 'absolute',
    top: -12,
    bottom: -12,
    width: 72,
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
  suppStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  suppStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  suppChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  suppChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '48%',
  },
  suppChipName: {
    fontSize: 13,
    fontWeight: '700',
  },
  suppChipDose: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  suppMarkAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  suppMarkAllText: {
    fontSize: 13,
    fontWeight: '800',
  },
  suppWeekWrap: {
    marginTop: 12,
    gap: 6,
  },
  suppWeekLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  suppWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  suppWeekCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  suppWeekDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suppWeekDay: {
    fontSize: 10,
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
