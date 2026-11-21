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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
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
  const barScaleAnim = useRef(new Animated.Value(isSelected ? 1.07 : 1)).current;

  useEffect(() => {
    barScaleAnim.stopAnimation();
    Animated.timing(barScaleAnim, {
      toValue: isSelected ? 1.07 : 1,
      duration: 165,
      easing: Easing.out(Easing.cubic),
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
          borderWidth: 1.5,
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
  onSelectTier: (tier: RankTier) => void;
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
    onSelectTier,
  }) => {
    const badgePopAnim = useRef(new Animated.Value(isSelected ? 1 : 0)).current;

    useEffect(() => {
      badgePopAnim.stopAnimation();
      Animated.timing(badgePopAnim, {
        toValue: isSelected ? 1 : 0,
        duration: 165,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [isSelected, badgePopAnim]);

    const badgeTranslateY = badgePopAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -3],
    });

    return (
      <TouchableOpacity
        style={[
          styles.spectrumColWrap,
          {
            borderWidth: 1,
            borderRadius: 14,
            backgroundColor: isSelected ? `${color}16` : 'transparent',
            borderColor: isSelected ? `${color}55` : 'transparent',
          },
          anySelected && !isSelected && { opacity: 0.56 },
        ]}
        onPress={() => onSelectTier(tier)}
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

        {/* Keep RankCrestIcon at exact 1:1 scale so iOS vector rendering is ALWAYS razor-sharp */}
        <Animated.View
          style={{
            transform: [{ translateY: badgeTranslateY }],
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
}> = React.memo(({ tier, color, titleText, subtitleText, bgColor, titleColor, subColor }) => {
  const revealAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    revealAnim.stopAnimation();
    barAnim.stopAnimation();
    revealAnim.setValue(0);
    barAnim.setValue(0);

    Animated.parallel([
      Animated.timing(revealAnim, {
        toValue: 1,
        duration: 185,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(barAnim, {
        toValue: 1,
        duration: 215,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [tier, revealAnim, barAnim]);

  const cardTranslateY = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });
  const textTranslateX = revealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <Animated.View
      style={[
        styles.tierSpotlightRow,
        {
          borderLeftColor: 'transparent',
          borderLeftWidth: 0,
          borderColor: `${color}3A`,
          backgroundColor: bgColor,
          opacity: revealAnim,
          transform: [{ translateY: cardTranslateY }],
        },
      ]}
    >
      {/* Crisp vertical accent bar reveal (zero SVG scaling -> zero pixelation, 120fps) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ scaleY: barAnim }],
        }}
      />
      <View style={{ paddingLeft: 4 }}>
        <RankCrestIcon tier={tier} size={46} isSelected />
      </View>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: textTranslateX }],
        }}
      >
        <Text style={[styles.tierSpotlightTitle, { color: titleColor }]}>
          {titleText}
        </Text>
        <Text style={[styles.tierSpotlightSub, { color: subColor }]}>
          {subtitleText}
        </Text>
      </Animated.View>
    </Animated.View>
  );
});

const OneWaySupplementRow: React.FC<{
  id: string;
  name: string;
  dose?: string | null;
  isChecked: boolean;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  bgColor: string;
  borderColor: string;
  onMarkTaken: (id: string) => void;
}> = React.memo(
  ({
    id,
    name,
    dose,
    isChecked,
    isDark,
    textColor,
    mutedColor,
    bgColor,
    borderColor,
    onMarkTaken,
  }) => {
    const checkPopAnim = useRef(new Animated.Value(isChecked ? 1 : 0)).current;
    const rippleAnim = useRef(new Animated.Value(0)).current;
    const prevCheckedRef = useRef(isChecked);

    useEffect(() => {
      if (isChecked && !prevCheckedRef.current) {
        checkPopAnim.setValue(0);
        rippleAnim.setValue(0);
        Animated.parallel([
          Animated.spring(checkPopAnim, {
            toValue: 1,
            friction: 5.2,
            tension: 170,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      } else if (isChecked) {
        checkPopAnim.setValue(1);
      } else {
        checkPopAnim.setValue(0);
      }
      prevCheckedRef.current = isChecked;
    }, [isChecked, checkPopAnim, rippleAnim]);

    const checkScale = checkPopAnim.interpolate({
      inputRange: [0, 0.55, 1],
      outputRange: [0.35, 1.18, 1],
    });
    const rippleScale = rippleAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.85, 1.9],
    });
    const rippleOpacity = rippleAnim.interpolate({
      inputRange: [0, 0.35, 1],
      outputRange: [0, 0.55, 0],
    });

    return (
      <TouchableOpacity
        disabled={isChecked}
        onPress={() => {
          if (isChecked) return;
          onMarkTaken(id);
        }}
        activeOpacity={0.76}
        style={[
          styles.oneWaySuppRow,
          {
            backgroundColor: isChecked
              ? isDark
                ? 'rgba(16, 185, 129, 0.12)'
                : 'rgba(16, 185, 129, 0.09)'
              : bgColor,
            borderColor: isChecked
              ? 'rgba(16, 185, 129, 0.45)'
              : borderColor,
          },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[
              styles.oneWaySuppName,
              {
                color: isChecked ? (isDark ? '#A7F3D0' : '#065F46') : textColor,
              },
            ]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {dose ? (
            <Text style={[styles.oneWaySuppDose, { color: mutedColor }]} numberOfLines={1}>
              {dose}
            </Text>
          ) : null}
        </View>

        <View style={styles.oneWayCheckWrap}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.oneWayCheckRipple,
              {
                opacity: rippleOpacity,
                transform: [{ scale: rippleScale }],
              },
            ]}
          />
          {isChecked ? (
            <Animated.View
              style={[
                styles.oneWayCheckFilled,
                {
                  opacity: checkPopAnim,
                  transform: [{ scale: checkScale }],
                },
              ]}
            >
              <Ionicons name="checkmark" size={16} color="#09090B" />
            </Animated.View>
          ) : (
            <View
              style={[
                styles.oneWayCheckEmpty,
                {
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.22)'
                    : 'rgba(15,23,42,0.22)',
                },
              ]}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

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
  const [quickWeighInput, setQuickWeighInput] = useState('');
  const [skippedWeighDate, setSkippedWeighDate] = useState<string | null>(null);
  const [showWeightSheet, setShowWeightSheet] = useState(false);
  const [weightSheetOffsetDays, setWeightSheetOffsetDays] = useState(0);
  const [weightSheetInput, setWeightSheetInput] = useState('');
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [showAllJournalWorkouts, setShowAllJournalWorkouts] = useState(false);
  const [showAllWeightLogs, setShowAllWeightLogs] = useState(false);
  const [weeklyChartMode, setWeeklyChartMode] = useState<'volume' | 'sets'>('volume');
  const [selectedChartPoint, setSelectedChartPoint] = useState<{
    chartId: string;
    index: number;
  } | null>(null);
  const [enabledSupplements, setEnabledSupplements] = useState<SupplementItem[]>([]);
  const [todayTakenSuppIds, setTodayTakenSuppIds] = useState<string[]>([]);
  const [suppLog7Days, setSuppLog7Days] = useState<CreatineDayEntry[]>([]);

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
    const skipKey = `@iron_routine:weighin_skip_${effectiveProfileId}`;
    const [prs, weights, hist, custom, favs, appSettings, takenToday, supp7, skippedDateRaw] = await Promise.all([
      getAllBestPRs(effectiveProfileId),
      getWeightHistory(effectiveProfileId),
      getWorkoutHistory(effectiveProfileId),
      getCustomExercises(),
      getFavoriteExerciseIds(),
      getAppSettings(),
      getSupplementDayTakenIds(todayKey, effectiveProfileId),
      getCreatineLog(7, effectiveProfileId),
      AsyncStorage.getItem(skipKey).catch(() => null),
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
    setSkippedWeighDate(skippedDateRaw || null);
    if (weights.length > 0) {
      setQuickWeighInput((prev) => (prev ? prev : String(weights[0].weight)));
    } else if (activeProfile?.weight) {
      setQuickWeighInput((prev) => (prev ? prev : String(activeProfile.weight)));
    }

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

  const handleSelectMuscle = useCallback((muscleId: MuscleSubGroupId | null) => {
    setSelectedMuscle(muscleId);
    if (muscleId) {
      setExpandedMuscleId(muscleId);
    }
  }, []);

  const handleSelectRankTier = useCallback((tier: RankTier) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSelectedRankTier((prev) => (prev === tier ? null : tier));
  }, []);

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

  const openWeightSheet = useCallback(
    (offsetDays = 0, existingWeight?: number) => {
      try {
        Haptics.selectionAsync();
      } catch {}
      const clampedOffset = Math.min(0, Math.max(-365, offsetDays));
      const targetKey = getLocalDateKeyOffset(clampedOffset);
      const match = weightHistory.find((w) => w.date.slice(0, 10) === targetKey);
      const seed =
        existingWeight ??
        match?.weight ??
        weightHistory[0]?.weight ??
        activeProfile?.weight ??
        75;
      setWeightSheetOffsetDays(clampedOffset);
      setWeightSheetInput(String(seed));
      setShowWeightSheet(true);
    },
    [weightHistory, activeProfile?.weight]
  );

  const changeWeightSheetOffset = useCallback(
    (nextOffset: number) => {
      const clamped = Math.min(0, Math.max(-365, nextOffset));
      if (clamped === weightSheetOffsetDays) return;
      try {
        Haptics.selectionAsync();
      } catch {}
      setWeightSheetOffsetDays(clamped);
      const targetKey = getLocalDateKeyOffset(clamped);
      const match = weightHistory.find((w) => w.date.slice(0, 10) === targetKey);
      if (match) {
        setWeightSheetInput(String(match.weight));
      }
    },
    [weightHistory, weightSheetOffsetDays]
  );

  const adjustWeightInput = useCallback(
    (current: string, delta: number, setter: (v: string) => void) => {
      try {
        Haptics.selectionAsync();
      } catch {}
      const parsed = parseFloat(current.replace(',', '.'));
      const base = isNaN(parsed)
        ? weightHistory[0]?.weight || activeProfile?.weight || 75
        : parsed;
      const next = Math.max(25, Math.min(300, Math.round((base + delta) * 10) / 10));
      setter(next.toFixed(1));
    },
    [weightHistory, activeProfile?.weight]
  );

  const handleSaveQuickTodayWeight = async () => {
    const val = parseFloat(quickWeighInput.replace(',', '.'));
    if (isNaN(val) || val < 25 || val > 300) {
      Alert.alert(t('invalidWeightTitle'), t('invalidWeightBody'));
      return;
    }
    const todayKey = getLocalDateKey();
    await addWeightEntry(val, todayKey, undefined, effectiveProfileId);
    if (activeProfile) {
      await updateProfileStats(
        effectiveProfileId,
        activeProfile.height || 180,
        val
      ).catch(() => {});
    }
    await loadAllAnalytics();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleSkipWeighToday = async () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const todayKey = getLocalDateKey();
    setSkippedWeighDate(todayKey);
    await AsyncStorage.setItem(
      `@iron_routine:weighin_skip_${effectiveProfileId}`,
      todayKey
    ).catch(() => {});
  };

  const handleSaveSheetWeight = async () => {
    const val = parseFloat(weightSheetInput.replace(',', '.'));
    if (isNaN(val) || val < 25 || val > 300) {
      Alert.alert(t('invalidWeightTitle'), t('invalidWeightBody'));
      return;
    }
    const targetDateKey = getLocalDateKeyOffset(weightSheetOffsetDays);
    await addWeightEntry(val, targetDateKey, undefined, effectiveProfileId);
    setShowWeightSheet(false);
    await loadAllAnalytics();
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleRemoveWeight = async (id: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
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

  const resolveEffectiveTakenIds = useCallback(
    (rawIds: string[]): string[] => {
      if (rawIds.includes('__all__')) {
        return enabledSupplements.length > 0 ? enabledSupplements.map((s) => s.id) : ['__all__'];
      }
      return rawIds;
    },
    [enabledSupplements]
  );

  // One-way supplement marking: once marked taken for today, cannot be unchecked
  const handleMarkSupplementTaken = useCallback(
    async (suppId: string) => {
      const todayKey = getLocalDateKey();
      const current = resolveEffectiveTakenIds(todayTakenSuppIds);
      if (current.includes(suppId)) return;
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      const next = [...current, suppId];
      setTodayTakenSuppIds(next);
      await setSupplementDayTakenIds(next, todayKey, effectiveProfileId);
      const updatedLog = await getCreatineLog(7, effectiveProfileId);
      setSuppLog7Days(updatedLog);
      void syncEveningSuppNotifState(next.length > 0);
    },
    [effectiveProfileId, resolveEffectiveTakenIds, todayTakenSuppIds]
  );

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

  const chronologicalWeightHistory = useMemo(
    () => [...weightHistory].sort((a, b) => a.date.localeCompare(b.date)),
    [weightHistory]
  );

  const recentWeightHistory = useMemo(
    () => [...chronologicalWeightHistory].reverse(),
    [chronologicalWeightHistory]
  );

  const filteredWeightPoints = useMemo(
    () => filterByRange(chronologicalWeightHistory, weightChartRange),
    [chronologicalWeightHistory, weightChartRange]
  );

  const chronologicalPRHistory = useMemo(
    () => [...prHistory].sort((a, b) => a.date.localeCompare(b.date)),
    [prHistory]
  );

  const filteredPRPoints = useMemo(
    () => filterByRange(chronologicalPRHistory, prChartRange),
    [chronologicalPRHistory, prChartRange]
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

  // Real 30-day & weekly training telemetry for the redesigned Statystyki dashboard
  const statsAnalytics = useMemo(() => {
    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const cutoff30 = getLocalDateKeyOffset(-29, now);

    // Compute Monday of current week (ISO Mon=0 .. Sun=6)
    const todayDow = (now.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const thisWeekMondayKey = getLocalDateKeyOffset(-todayDow, now);

    let workouts30d = 0;
    let sets30d = 0;
    let volume30dKg = 0;
    let durationSum = 0;
    let durationCount = 0;
    let thisWeekWorkouts = 0;

    // Aggregate per-day intensity map for calendar-aligned heatmap
    const dayStatsMap: Record<string, { sets: number; volume: number; count: number }> = {};

    for (const h of workoutHistory) {
      const dk = h.date.slice(0, 10);
      const prev = dayStatsMap[dk] || { sets: 0, volume: 0, count: 0 };
      dayStatsMap[dk] = {
        sets: prev.sets + (h.completedSets || 0),
        volume: prev.volume + (h.totalVolumeKg || 0),
        count: prev.count + 1,
      };

      if (dk >= cutoff30 && dk <= todayKey) {
        workouts30d += 1;
        sets30d += h.completedSets || 0;
        volume30dKg += h.totalVolumeKg || 0;
        if (h.durationMinutes && h.durationMinutes > 0) {
          durationSum += h.durationMinutes;
          durationCount += 1;
        }
      }
      if (dk >= thisWeekMondayKey && dk <= todayKey) {
        thisWeekWorkouts += 1;
      }
    }

    const avgDurationMin = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;

    // 7-week rolling Monday–Sunday load series (6 past weeks + current week)
    const weeklySeries: Array<{
      key: string;
      label: string;
      volumeKg: number;
      sets: number;
      sessions: number;
      isCurrent: boolean;
    }> = [];

    for (let w = 6; w >= 0; w--) {
      const startOffset = -(todayDow + w * 7);
      const endOffset = startOffset + 6;
      const startKey = getLocalDateKeyOffset(startOffset, now);
      const endKey = getLocalDateKeyOffset(endOffset, now);
      let vol = 0;
      let sets = 0;
      let sessions = 0;
      for (const h of workoutHistory) {
        const dk = h.date.slice(0, 10);
        if (dk >= startKey && dk <= endKey) {
          vol += h.totalVolumeKg || 0;
          sets += h.completedSets || 0;
          sessions += 1;
        }
      }
      const startDate = parseLocalDateKey(startKey);
      const shortDateLabel = `${startDate.getDate()}.${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      weeklySeries.push({
        key: startKey,
        label: w === 0 ? t('journalDateToday') : shortDateLabel,
        volumeKg: Math.round(vol),
        sets,
        sessions,
        isCurrent: w === 0,
      });
    }

    // 4-week calendar-aligned Mon–Sun heatmap (28 cells ending on current week's Sunday)
    const heatmapCells: Array<{
      key: string;
      dayNum: string;
      intensity: 0 | 1 | 2 | 3;
      isToday: boolean;
      isFuture: boolean;
      sets: number;
    }> = [];
    for (let w = 3; w >= 0; w--) {
      for (let d = 0; d < 7; d++) {
        const offset = -(todayDow + w * 7) + d;
        const iso = getLocalDateKeyOffset(offset, now);
        const dt = parseLocalDateKey(iso);
        const isFuture = offset > 0;
        const rec = dayStatsMap[iso];
        let intensity: 0 | 1 | 2 | 3 = 0;
        if (rec && rec.count > 0) {
          if (rec.sets >= 18 || rec.volume >= 7000) intensity = 3;
          else if (rec.sets >= 10 || rec.volume >= 3000) intensity = 2;
          else intensity = 1;
        }
        heatmapCells.push({
          key: iso,
          dayNum: String(dt.getDate()),
          intensity,
          isToday: offset === 0,
          isFuture,
          sets: rec?.sets || 0,
        });
      }
    }

    // Localized Monday..Sunday 2-letter headers
    const weekdayHeaders: string[] = [];
    const baseMon = parseLocalDateKey(thisWeekMondayKey);
    for (let d = 0; d < 7; d++) {
      const dd = new Date(baseMon.getTime() + d * 24 * 60 * 60 * 1000);
      const raw = dd.toLocaleDateString(localeCode, { weekday: 'short' }).replace('.', '');
      weekdayHeaders.push(raw.slice(0, 2).toUpperCase());
    }

    const active28Count = last28Days.filter((d) => d.active).length;

    return {
      workouts30d,
      sets30d,
      volume30dKg: Math.round(volume30dKg),
      avgDurationMin,
      thisWeekWorkouts,
      active28Count,
      weeklySeries,
      heatmapCells,
      weekdayHeaders,
    };
  }, [workoutHistory, last28Days, localeCode, t]);

  const renderOpenLineChart = (
    points: Array<{ value: number; label: string }>,
    strokeColor: string,
    unitLabel: string,
    chartId = 'main',
    widthOverride?: number
  ) => {
    if (points.length === 0) {
      return (
        <View style={[styles.emptyChartOpen, { borderTopColor: theme.hairline }]}>
          <Ionicons name="analytics-outline" size={22} color={theme.textMuted} />
          <Text style={[styles.emptyChartText, { color: theme.textMuted }]}>
            {t('noWeightInRange')}
          </Text>
        </View>
      );
    }

    const chartW = Math.max(240, widthOverride ?? SCREEN_WIDTH - 40);
    const chartH = 166;
    const padL = 10;
    const padR = 10;
    const padT = 24;
    const padB = 18;
    const innerW = chartW - padL - padR;
    const innerH = chartH - padT - padB;

    const vals = points.map((p) => p.value);
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const avgVal = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    const rawSpan = rawMax - rawMin;
    const padVal = rawSpan > 0 ? rawSpan * 0.18 : 0.6;
    const scaleMin = Math.max(0, rawMin - padVal);
    const scaleMax = rawMax + padVal;
    const span = Math.max(0.5, scaleMax - scaleMin);

    const coords = points.map((p, idx) => {
      const x =
        points.length === 1
          ? padL + innerW / 2
          : padL + (idx / (points.length - 1)) * innerW;
      const y =
        points.length === 1
          ? padT + innerH / 2
          : padT + innerH - ((p.value - scaleMin) / span) * innerH;
      return { x, y, ...p };
    });

    // Smooth Catmull-Rom Cubic Bezier spline (clamped safely inside vertical bounds)
    let lineD = '';
    if (coords.length === 1) {
      const c = coords[0];
      lineD = `M ${(c.x - 28).toFixed(1)} ${c.y.toFixed(1)} L ${(c.x + 28).toFixed(1)} ${c.y.toFixed(1)}`;
    } else {
      lineD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = i > 0 ? coords[i - 1] : coords[i];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = i < coords.length - 2 ? coords[i + 2] : p2;
        const clampY = (val: number) => Math.max(padT - 4, Math.min(padT + innerH + 2, val));
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = clampY(p1.y + (p2.y - p0.y) / 6);
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = clampY(p2.y - (p3.y - p1.y) / 6);
        lineD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    const bottomY = padT + innerH;
    const areaD =
      coords.length === 1
        ? `M ${(coords[0].x - 28).toFixed(1)} ${bottomY.toFixed(1)} L ${(coords[0].x - 28).toFixed(1)} ${coords[0].y.toFixed(1)} L ${(coords[0].x + 28).toFixed(1)} ${coords[0].y.toFixed(1)} L ${(coords[0].x + 28).toFixed(1)} ${bottomY.toFixed(1)} Z`
        : `${lineD} L ${coords[coords.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)} L ${coords[0].x.toFixed(1)} ${bottomY.toFixed(1)} Z`;

    const gradId = `unifiedSplineGrad_${chartId}`;
    const activeIdx =
      selectedChartPoint &&
      selectedChartPoint.chartId === chartId &&
      selectedChartPoint.index < coords.length
        ? selectedChartPoint.index
        : null;
    const highlightPt = activeIdx !== null ? coords[activeIdx] : coords[coords.length - 1];
    const firstLabel = points[0]?.label || '';
    const lastLabel = points[points.length - 1]?.label || '';

    return (
      <View style={styles.openSplineWrap}>
        {/* Floating inspected point badge when user taps any point on the spline */}
        {activeIdx !== null && highlightPt && (
          <View
            style={[
              styles.splineTooltipPill,
              {
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : '#FFFFFF',
                borderColor: `${strokeColor}66`,
              },
            ]}
          >
            <View style={[styles.splineTooltipDot, { backgroundColor: strokeColor }]} />
            <Text style={[styles.splineTooltipDate, { color: theme.textSecondary }]}>
              {highlightPt.label}
            </Text>
            <Text style={[styles.splineTooltipVal, { color: theme.text }]}>
              {highlightPt.value.toFixed(1)} {unitLabel}
            </Text>
          </View>
        )}

        <View style={{ position: 'relative', width: chartW, height: chartH }}>
          <Svg width={chartW} height={chartH}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={strokeColor} stopOpacity={isDark ? 0.34 : 0.24} />
                <Stop offset="70%" stopColor={strokeColor} stopOpacity={isDark ? 0.06 : 0.04} />
                <Stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
              </LinearGradient>
            </Defs>

            {[0, 0.5, 1].map((ratio, i) => {
              const y = padT + ratio * innerH;
              return (
                <Line
                  key={i}
                  x1={padL}
                  y1={y}
                  x2={chartW - padR}
                  y2={y}
                  stroke={isDark ? 'rgba(255,255,255,0.075)' : 'rgba(15,23,42,0.075)'}
                  strokeDasharray="3 5"
                  strokeWidth={1}
                />
              );
            })}

            {areaD ? <Path d={areaD} fill={`url(#${gradId})`} /> : null}
            {lineD ? (
              <Path
                d={lineD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}

            {/* Active vertical guide beam when inspecting a point */}
            {activeIdx !== null && highlightPt && (
              <Line
                x1={highlightPt.x}
                y1={padT - 4}
                x2={highlightPt.x}
                y2={bottomY}
                stroke={strokeColor}
                strokeOpacity={0.45}
                strokeDasharray="3 3"
                strokeWidth={1.2}
              />
            )}

            {coords.length <= 18 &&
              coords.map((c, idx) => {
                const isHighlighted =
                  activeIdx !== null ? idx === activeIdx : idx === coords.length - 1;
                if (isHighlighted) return null;
                return (
                  <Circle
                    key={idx}
                    cx={c.x}
                    cy={c.y}
                    r={2.8}
                    fill={theme.bg}
                    stroke={strokeColor}
                    strokeOpacity={0.8}
                    strokeWidth={1.6}
                  />
                );
              })}

            {/* Highlighted / Latest glowing double-ring beacon */}
            {highlightPt && (
              <G>
                <Circle
                  cx={highlightPt.x}
                  cy={highlightPt.y}
                  r={11}
                  fill={strokeColor}
                  fillOpacity={0.18}
                />
                <Circle
                  cx={highlightPt.x}
                  cy={highlightPt.y}
                  r={5.2}
                  fill={strokeColor}
                  stroke={theme.bg}
                  strokeWidth={2.2}
                />
              </G>
            )}
          </Svg>

          {/* Interactive tap columns for effortless point inspection */}
          {coords.length > 1 && (
            <View style={styles.splineTouchLayer}>
              {coords.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.splineTouchSlice}
                  activeOpacity={1}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    setSelectedChartPoint((prev) =>
                      prev && prev.chartId === chartId && prev.index === idx
                        ? null
                        : { chartId, index: idx }
                    );
                  }}
                />
              ))}
            </View>
          )}
        </View>

        {/* Clean Axis Endpoints */}
        <View style={styles.unifiedChartDateRow}>
          <Text style={[styles.unifiedChartDateText, { color: theme.textMuted }]}>
            {firstLabel}
          </Text>
          {points.length > 1 && (
            <Text style={[styles.unifiedChartDateText, { color: theme.textMuted }]}>
              {t('journalEntriesCount', { count: points.length })}
            </Text>
          )}
          <Text style={[styles.unifiedChartDateText, { color: theme.textMuted }]}>
            {lastLabel}
          </Text>
        </View>

        {/* Open Hairline Min · Avg · Max Telemetry Strip */}
        <View
          style={[
            styles.openSplineStatsRow,
            {
              borderTopColor: theme.hairline,
              borderBottomColor: theme.hairline,
            },
          ]}
        >
          <View style={styles.unifiedChartStatCell}>
            <Text style={[styles.unifiedChartStatLbl, { color: theme.textMuted }]}>MIN</Text>
            <Text style={[styles.unifiedChartStatVal, { color: theme.text }]}>
              {rawMin.toFixed(1)} {unitLabel}
            </Text>
          </View>
          <View style={[styles.unifiedChartStatDiv, { backgroundColor: theme.hairline }]} />
          <View style={styles.unifiedChartStatCell}>
            <Text style={[styles.unifiedChartStatLbl, { color: theme.textMuted }]}>
              {t('journalAvgShort')}
            </Text>
            <Text style={[styles.unifiedChartStatVal, { color: strokeColor }]}>
              {avgVal.toFixed(1)} {unitLabel}
            </Text>
          </View>
          <View style={[styles.unifiedChartStatDiv, { backgroundColor: theme.hairline }]} />
          <View style={styles.unifiedChartStatCell}>
            <Text style={[styles.unifiedChartStatLbl, { color: theme.textMuted }]}>MAX</Text>
            <Text style={[styles.unifiedChartStatVal, { color: theme.text }]}>
              {rawMax.toFixed(1)} {unitLabel}
            </Text>
          </View>
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
                          onSelectTier={handleSelectRankTier}
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
              SUB-VIEW 3: STATYSTYKI (ATMOSPHERIC TELEMETRY & BIOMETRICS)
             ========================================================= */}
          {subView === 'journal' && (() => {
            const todayKey = getLocalDateKey();
            const hasWeighedToday = chronologicalWeightHistory.some(
              (w) => w.date.slice(0, 10) === todayKey
            );
            const showDailyWeighPrompt = !hasWeighedToday && skippedWeighDate !== todayKey;
            const latestWeightEntry =
              chronologicalWeightHistory[chronologicalWeightHistory.length - 1] || null;
            const firstWeightEntry = chronologicalWeightHistory[0] || null;
            const currentWeightVal = latestWeightEntry?.weight ?? activeProfile?.weight ?? null;
            const weightDelta =
              latestWeightEntry && firstWeightEntry && chronologicalWeightHistory.length >= 2
                ? latestWeightEntry.weight - firstWeightEntry.weight
                : null;
            const bmiVal =
              currentWeightVal && activeProfile?.height && activeProfile.height > 100
                ? currentWeightVal / Math.pow(activeProfile.height / 100, 2)
                : null;
            const bmiStatus =
              bmiVal === null
                ? null
                : bmiVal < 18.5
                ? { label: t('statsBmiUnder'), color: '#38BDF8' }
                : bmiVal < 25
                ? { label: t('statsBmiNormal'), color: '#10B981' }
                : { label: t('statsBmiOver'), color: '#F59E0B' };
            const bmiNeedlePct =
              bmiVal === null
                ? 50
                : Math.max(4, Math.min(96, ((bmiVal - 15) / (33 - 15)) * 100));

            const effectiveTaken = resolveEffectiveTakenIds(todayTakenSuppIds);
            const hasSuppItems = enabledSupplements.length > 0;
            const totalSuppItems = hasSuppItems ? enabledSupplements.length : 1;
            const takenSuppCount = hasSuppItems
              ? enabledSupplements.filter((s) => effectiveTaken.includes(s.id)).length
              : todayTakenSuppIds.length > 0
              ? 1
              : 0;
            const allSuppDone = takenSuppCount >= totalSuppItems && totalSuppItems > 0;
            const suppTaken7d = suppLog7Days.filter((e) => e.taken).length;

            // Hero Circular Ring Geometry (86x86, r=35)
            const ringSize = 86;
            const ringR = 35;
            const ringCirc = 2 * Math.PI * ringR;
            const ringRatio = Math.min(1, statsAnalytics.active28Count / 16);
            const ringDashOffset =
              statsAnalytics.active28Count === 0
                ? ringCirc
                : ringCirc * (1 - Math.max(0.08, ringRatio));

            const heroHasVolume = statsAnalytics.volume30dKg > 0;
            const heroPrimaryValue = heroHasVolume
              ? statsAnalytics.volume30dKg >= 1000
                ? `${(statsAnalytics.volume30dKg / 1000).toFixed(1)} t`
                : `${statsAnalytics.volume30dKg.toLocaleString(localeCode)} kg`
              : `${statsAnalytics.sets30d}`;
            const heroPrimarySub = heroHasVolume
              ? t('statsHeroVolumeTitle')
              : t('statsHeroSetsTitle');

            // 7-week pillar chart geometry
            const barChartW = SCREEN_WIDTH - 40;
            const barChartH = 132;
            const barTopPad = 24;
            const barBottomPad = 24;
            const barPlotH = barChartH - barTopPad - barBottomPad;
            const weeklyValues = statsAnalytics.weeklySeries.map((w) =>
              weeklyChartMode === 'volume' ? w.volumeKg : w.sets
            );
            const weeklyMax = Math.max(1, ...weeklyValues);
            const peakWeekIdx = weeklyValues.reduce(
              (best, val, i) => (val > weeklyValues[best] ? i : best),
              0
            );

            // Heatmap cell sizing (7 exact Mon-Sun columns)
            const heatmapCellW = Math.floor((SCREEN_WIDTH - 40 - 6 * 7) / 7);
            const visibleWeightRows = showAllWeightLogs
              ? recentWeightHistory.slice(0, 12)
              : recentWeightHistory.slice(0, 3);

            return (
              <View style={styles.openPage}>
                {/* 1. ATMOSPHERIC TELEMETRY HERO STAGE */}
                <View
                  style={[
                    styles.statsHeroStage,
                    {
                      backgroundColor: isDark ? '#0B111C' : '#F1F6FD',
                      borderColor: isDark
                        ? 'rgba(56, 189, 248, 0.2)'
                        : 'rgba(14, 165, 233, 0.18)',
                    },
                  ]}
                >
                  {/* Atmospheric Radial Glow & Precision Orbital Arcs */}
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 360 190"
                      preserveAspectRatio="xMidYMid slice"
                    >
                      <Defs>
                        <RadialGradient id="statsHeroCyanBloom" cx="16%" cy="22%" r="64%">
                          <Stop
                            offset="0%"
                            stopColor="#38BDF8"
                            stopOpacity={isDark ? 0.24 : 0.16}
                          />
                          <Stop
                            offset="62%"
                            stopColor="#38BDF8"
                            stopOpacity={isDark ? 0.05 : 0.03}
                          />
                          <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                        </RadialGradient>
                        <RadialGradient id="statsHeroEmeraldBloom" cx="92%" cy="82%" r="54%">
                          <Stop
                            offset="0%"
                            stopColor="#10B981"
                            stopOpacity={isDark ? 0.2 : 0.14}
                          />
                          <Stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </RadialGradient>
                      </Defs>
                      <Rect x="0" y="0" width="360" height="190" fill="url(#statsHeroCyanBloom)" />
                      <Rect
                        x="0"
                        y="0"
                        width="360"
                        height="190"
                        fill="url(#statsHeroEmeraldBloom)"
                      />
                      <Circle
                        cx="324"
                        cy="26"
                        r="78"
                        fill="none"
                        stroke="#38BDF8"
                        strokeOpacity={isDark ? 0.11 : 0.12}
                        strokeWidth={1}
                        strokeDasharray="4 6"
                      />
                      <Circle
                        cx="324"
                        cy="26"
                        r="118"
                        fill="none"
                        stroke={isDark ? '#FFFFFF' : '#0F172A'}
                        strokeOpacity={isDark ? 0.045 : 0.04}
                        strokeWidth={1}
                      />
                    </Svg>
                  </View>

                  {/* Hero Main Row: Precision Activity Ring + 30d Tonnage / Sets */}
                  <View style={styles.statsHeroTopRow}>
                    <View style={styles.statsRingWrap}>
                      <Svg width={ringSize} height={ringSize}>
                        <Defs>
                          <LinearGradient id="statsRingGrad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0%" stopColor="#38BDF8" />
                            <Stop offset="100%" stopColor="#10B981" />
                          </LinearGradient>
                        </Defs>
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringR}
                          fill="none"
                          stroke={
                            isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'
                          }
                          strokeWidth={7}
                        />
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringR}
                          fill="none"
                          stroke="url(#statsRingGrad)"
                          strokeWidth={7}
                          strokeLinecap="round"
                          strokeDasharray={`${ringCirc} ${ringCirc}`}
                          strokeDashoffset={ringDashOffset}
                          rotation={-90}
                          origin={`${ringSize / 2}, ${ringSize / 2}`}
                        />
                      </Svg>
                      <View style={styles.statsRingCenter}>
                        <Text style={[styles.statsRingVal, { color: theme.text }]}>
                          {statsAnalytics.active28Count}
                        </Text>
                        <Text style={[styles.statsRingLbl, { color: theme.textMuted }]}>
                          {t('statsConsistencyLabel')}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.statsHeroCopyCol}>
                      <Text style={styles.statsHeroEyebrow}>
                        {t('statsHeroEyebrow30d')}
                      </Text>
                      <Text
                        style={[styles.statsHeroBigVal, { color: theme.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                      >
                        {heroPrimaryValue}
                      </Text>
                      <View style={styles.statsHeroSubRow}>
                        <Text style={[styles.statsHeroSubLabel, { color: theme.textSecondary }]}>
                          {heroPrimarySub}
                        </Text>
                        {statsAnalytics.thisWeekWorkouts > 0 && (
                          <View style={styles.statsHeroWeekPill}>
                            <Ionicons name="flash" size={11} color="#10B981" />
                            <Text style={styles.statsHeroWeekPillText}>
                              {statsAnalytics.thisWeekWorkouts} / 7d
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Compact 4-Column Telemetry Strip inside Hero */}
                  <View
                    style={[
                      styles.statsHeroKpiStrip,
                      {
                        borderTopColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(15,23,42,0.08)',
                      },
                    ]}
                  >
                    {[
                      {
                        label: t('statsMetricWorkouts'),
                        val: String(statsAnalytics.workouts30d),
                        dot: '#38BDF8',
                      },
                      {
                        label: t('statsMetricSets'),
                        val: String(statsAnalytics.sets30d),
                        dot: '#A855F7',
                      },
                      {
                        label: t('statsMetricAvgTime'),
                        val: statsAnalytics.avgDurationMin
                          ? `${statsAnalytics.avgDurationMin}m`
                          : '—',
                        dot: '#F59E0B',
                      },
                      {
                        label: t('statsMetricSupps7d'),
                        val: `${suppTaken7d}/7`,
                        dot: '#10B981',
                      },
                    ].map((kpi, idx) => (
                      <React.Fragment key={kpi.label}>
                        {idx > 0 && (
                          <View
                            style={[
                              styles.statsHeroKpiDiv,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(15,23,42,0.08)',
                              },
                            ]}
                          />
                        )}
                        <View style={styles.statsHeroKpiCell}>
                          <Text style={[styles.statsHeroKpiVal, { color: theme.text }]}>
                            {kpi.val}
                          </Text>
                          <View style={styles.statsHeroKpiLblRow}>
                            <View
                              style={[styles.statsHeroKpiDot, { backgroundColor: kpi.dot }]}
                            />
                            <Text
                              style={[styles.statsHeroKpiLbl, { color: theme.textMuted }]}
                              numberOfLines={1}
                            >
                              {kpi.label}
                            </Text>
                          </View>
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                </View>

                {/* 2. SLIM CONTEXTUAL DAILY WEIGH-IN STRIP (auto-hides once weighed or skipped today) */}
                {showDailyWeighPrompt && (
                  <View
                    style={[
                      styles.slimWeighStrip,
                      {
                        backgroundColor: isDark
                          ? 'rgba(56, 189, 248, 0.08)'
                          : 'rgba(14, 165, 233, 0.06)',
                        borderColor: isDark
                          ? 'rgba(56, 189, 248, 0.32)'
                          : 'rgba(14, 165, 233, 0.26)',
                      },
                    ]}
                  >
                    <View style={styles.slimWeighTopRow}>
                      <View style={styles.slimWeighTitleRow}>
                        <Ionicons name="scale-outline" size={16} color="#38BDF8" />
                        <Text
                          style={[styles.slimWeighTitle, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {t('journalWeighPromptTitle')}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={handleSkipWeighToday}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.slimWeighSkipText, { color: theme.textMuted }]}>
                          {t('journalSkipWeighToday')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.weightStepperRow}>
                      <TouchableOpacity
                        style={[
                          styles.weightStepBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(15,23,42,0.06)',
                          },
                        ]}
                        onPress={() =>
                          adjustWeightInput(quickWeighInput, -0.1, setQuickWeighInput)
                        }
                        activeOpacity={0.75}
                      >
                        <Ionicons name="remove" size={17} color={theme.text} />
                      </TouchableOpacity>

                      <View
                        style={[
                          styles.weightStepInputWrap,
                          {
                            backgroundColor: isDark ? 'rgba(9,9,11,0.55)' : '#FFFFFF',
                            borderColor: isDark
                              ? 'rgba(255,255,255,0.1)'
                              : 'rgba(15,23,42,0.1)',
                          },
                        ]}
                      >
                        <TextInput
                          style={[styles.weightStepInput, { color: theme.text }]}
                          placeholder="75.0"
                          placeholderTextColor={theme.textMuted}
                          keyboardType="decimal-pad"
                          value={quickWeighInput}
                          onChangeText={setQuickWeighInput}
                          textAlign="center"
                        />
                        <Text style={[styles.weightStepUnit, { color: theme.textMuted }]}>
                          kg
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.weightStepBtn,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(15,23,42,0.06)',
                          },
                        ]}
                        onPress={() =>
                          adjustWeightInput(quickWeighInput, 0.1, setQuickWeighInput)
                        }
                        activeOpacity={0.75}
                      >
                        <Ionicons name="add" size={17} color={theme.text} />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.dailyWeighSaveBtn, { backgroundColor: '#38BDF8' }]}
                        onPress={handleSaveQuickTodayWeight}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="checkmark" size={16} color="#09090B" />
                        <Text style={styles.dailyWeighSaveText}>{t('save')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 3. OPEN EDITORIAL SECTION: MASA CIAŁA & TREND */}
                <View style={styles.openSectionNoBorder}>
                  <View style={styles.statsWeightHeaderRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                        {t('bodyWeightUpper')}
                      </Text>
                      <View style={styles.statsSculptedWeightRow}>
                        <Text style={[styles.statsSculptedWeightVal, { color: theme.text }]}>
                          {currentWeightVal !== null ? currentWeightVal.toFixed(1) : '--'}
                        </Text>
                        <Text style={[styles.statsSculptedWeightUnit, { color: theme.textMuted }]}>
                          kg
                        </Text>
                        {weightDelta !== null && (
                          <View
                            style={[
                              styles.weightDeltaPill,
                              {
                                backgroundColor:
                                  weightDelta <= 0
                                    ? 'rgba(16, 185, 129, 0.14)'
                                    : 'rgba(56, 189, 248, 0.14)',
                              },
                            ]}
                          >
                            <Ionicons
                              name={weightDelta <= 0 ? 'trending-down' : 'trending-up'}
                              size={12}
                              color={weightDelta <= 0 ? '#10B981' : '#38BDF8'}
                            />
                            <Text
                              style={[
                                styles.weightDeltaPillText,
                                { color: weightDelta <= 0 ? '#10B981' : '#38BDF8' },
                              ]}
                            >
                              {weightDelta > 0 ? '+' : ''}
                              {weightDelta.toFixed(1)} kg
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.journalAddWeightBtn,
                        {
                          backgroundColor: isDark
                            ? 'rgba(56, 189, 248, 0.15)'
                            : 'rgba(14, 165, 233, 0.1)',
                          borderColor: isDark
                            ? 'rgba(56, 189, 248, 0.35)'
                            : 'rgba(14, 165, 233, 0.28)',
                        },
                      ]}
                      onPress={() => openWeightSheet(0)}
                      activeOpacity={0.78}
                    >
                      <Ionicons name="add" size={15} color="#38BDF8" />
                      <Text
                        style={[
                          styles.journalAddWeightText,
                          { color: isDark ? '#7DD3FC' : '#0284C7' },
                        ]}
                      >
                        {t('journalLogWeightBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statsWeightToolbar}>
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
                            onPress={() => {
                              setSelectedChartPoint(null);
                              setWeightChartRange(r.id);
                            }}
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
                      label: parseLocalDateKey(w.date).toLocaleDateString(localeCode, {
                        day: 'numeric',
                        month: 'short',
                      }),
                    })),
                    '#38BDF8',
                    'kg',
                    'weight',
                    SCREEN_WIDTH - 40
                  )}

                  {/* Precision Visual BMI Spectrum Needle Bar */}
                  {bmiVal !== null && bmiStatus && (
                    <View style={styles.bmiSpectrumWrap}>
                      <View style={styles.bmiSpectrumTopRow}>
                        <Text style={[styles.bmiSpectrumTitle, { color: theme.textSecondary }]}>
                          BMI{' '}
                          <Text style={{ color: theme.text, fontWeight: '900' }}>
                            {bmiVal.toFixed(1)}
                          </Text>
                        </Text>
                        <View
                          style={[
                            styles.bmiStatusPill,
                            { backgroundColor: `${bmiStatus.color}1C` },
                          ]}
                        >
                          <View
                            style={[styles.bmiStatusDot, { backgroundColor: bmiStatus.color }]}
                          />
                          <Text style={[styles.bmiStatusText, { color: bmiStatus.color }]}>
                            {bmiStatus.label}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.bmiBarTrack}>
                        <View
                          style={[
                            styles.bmiBarSeg,
                            { flex: 1.9, backgroundColor: 'rgba(56, 189, 248, 0.55)' },
                          ]}
                        />
                        <View
                          style={[
                            styles.bmiBarSeg,
                            { flex: 3.6, backgroundColor: 'rgba(16, 185, 129, 0.78)' },
                          ]}
                        />
                        <View
                          style={[
                            styles.bmiBarSeg,
                            { flex: 4.5, backgroundColor: 'rgba(245, 158, 11, 0.6)' },
                          ]}
                        />
                        <View
                          style={[
                            styles.bmiNeedle,
                            {
                              left: `${bmiNeedlePct}%`,
                              backgroundColor: theme.text,
                              borderColor: theme.bg,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}

                  {/* Compact Collapsible Weight Log Rows (tap any row to edit past date/weight) */}
                  {visibleWeightRows.length > 0 && (
                    <View style={styles.openWeightLogWrap}>
                      {visibleWeightRows.map((w, idx) => {
                        const prevEntry = recentWeightHistory[idx + 1];
                        const stepDiff = prevEntry ? w.weight - prevEntry.weight : null;
                        const entryDate = parseLocalDateKey(w.date);
                        const todayDate = parseLocalDateKey(todayKey);
                        const dayDiff = Math.round(
                          (entryDate.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000)
                        );
                        return (
                          <TouchableOpacity
                            key={w.id}
                            activeOpacity={0.72}
                            onPress={() => openWeightSheet(Math.min(0, dayDiff), w.weight)}
                            style={[
                              styles.simpleLogRow,
                              { borderBottomColor: theme.hairline },
                            ]}
                          >
                            <View style={styles.weightLogLeft}>
                              <Text style={[styles.simpleLogDate, { color: theme.textSecondary }]}>
                                {dayDiff === 0
                                  ? t('journalDateToday')
                                  : dayDiff === -1
                                  ? t('journalDateYesterday')
                                  : entryDate.toLocaleDateString(localeCode, {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                              </Text>
                            </View>
                            <View style={styles.simpleLogRight}>
                              {stepDiff !== null && Math.abs(stepDiff) >= 0.05 && (
                                <Text
                                  style={[
                                    styles.weightLogStepDiff,
                                    { color: stepDiff < 0 ? '#10B981' : '#38BDF8' },
                                  ]}
                                >
                                  {stepDiff > 0 ? '+' : ''}
                                  {stepDiff.toFixed(1)}
                                </Text>
                              )}
                              <Text style={[styles.simpleLogVal, { color: theme.text }]}>
                                {w.weight} kg
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleRemoveWeight(w.id)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}

                      {recentWeightHistory.length > 3 && (
                        <TouchableOpacity
                          style={styles.expandInlineLink}
                          onPress={() => setShowAllWeightLogs((v) => !v)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.expandInlineLinkText, { color: '#38BDF8' }]}>
                            {showAllWeightLogs
                              ? t('lessLabel')
                              : t('allCountLabel', { count: recentWeightHistory.length })}
                          </Text>
                          <Ionicons
                            name={showAllWeightLogs ? 'chevron-up' : 'chevron-down'}
                            size={13}
                            color="#38BDF8"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* 4. OPEN EDITORIAL SECTION: SUPLEMENTACJA (One-Way Animated Check, ZERO heading/mark-all clutter) */}
                <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                  <View style={styles.openSectionHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.sectionEyebrow,
                          { color: allSuppDone ? '#10B981' : theme.textMuted, marginBottom: 0 },
                        ]}
                      >
                        {t('journalSuppEyebrow')}
                      </Text>
                      {!allSuppDone && (
                        <Text style={[styles.suppOneWayHint, { color: theme.textMuted }]}>
                          {t('journalSuppTakenOneWayHint')}
                        </Text>
                      )}
                    </View>
                    <View
                      style={[
                        styles.suppStatusBadge,
                        {
                          backgroundColor: allSuppDone
                            ? 'rgba(16, 185, 129, 0.14)'
                            : theme.bgSecondary,
                          borderColor: allSuppDone ? '#10B981' : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.suppStatusBadgeText,
                          { color: allSuppDone ? '#10B981' : theme.textSecondary },
                        ]}
                      >
                        {allSuppDone
                          ? t('journalSuppTakenBadge')
                          : hasSuppItems
                          ? `${takenSuppCount}/${totalSuppItems}`
                          : t('journalSuppPendingBadge')}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.oneWaySuppList}>
                    {hasSuppItems ? (
                      enabledSupplements.map((supp) => {
                        const isChecked = effectiveTaken.includes(supp.id);
                        const suppDisplayName = getTranslatedSupplement(
                          supp.id,
                          'name',
                          supp.name,
                          (localeCode.slice(0, 2) as any) || 'pl'
                        );
                        const dose = formatSupplementDose(supp, activeProfile?.weight);
                        return (
                          <OneWaySupplementRow
                            key={supp.id}
                            id={supp.id}
                            name={suppDisplayName}
                            dose={dose}
                            isChecked={isChecked}
                            isDark={isDark}
                            textColor={theme.text}
                            mutedColor={theme.textMuted}
                            bgColor={
                              isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.03)'
                            }
                            borderColor={theme.hairline}
                            onMarkTaken={handleMarkSupplementTaken}
                          />
                        );
                      })
                    ) : (
                      <OneWaySupplementRow
                        id="__all__"
                        name={t('journalSuppEyebrow')}
                        isChecked={allSuppDone}
                        isDark={isDark}
                        textColor={theme.text}
                        mutedColor={theme.textMuted}
                        bgColor={isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.03)'}
                        borderColor={theme.hairline}
                        onMarkTaken={handleMarkSupplementTaken}
                      />
                    )}
                  </View>

                  {suppLog7Days.length > 0 && (
                    <View style={styles.openSupp7dRow}>
                      {suppLog7Days.map((entry) => (
                        <View key={entry.date} style={styles.suppWeekCell}>
                          <View
                            style={[
                              styles.suppWeekPillBar,
                              {
                                backgroundColor: entry.taken
                                  ? '#10B981'
                                  : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(15,23,42,0.06)',
                                borderColor: entry.isToday ? theme.text : 'transparent',
                                borderWidth: entry.isToday ? 1.4 : 0,
                              },
                            ]}
                          >
                            <Ionicons
                              name={entry.taken ? 'checkmark' : 'remove'}
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
                  )}
                </View>

                {/* 5. OPEN EDITORIAL SECTION: 7-WEEK TRAINING LOAD & WEEKDAY-ALIGNED HEATMAP */}
                <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                  <View style={styles.openSectionHeader}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                        {t('statsWeeklyRhythmEyebrow')}
                      </Text>
                      <Text style={[styles.sectionHeading, { color: theme.text }]}>
                        {t('statsWeeklyLoadHeading')}
                      </Text>
                    </View>
                    <View style={[styles.rangePills, { backgroundColor: theme.bgSecondary }]}>
                      {(
                        [
                          { id: 'volume', label: t('statsToggleVolume') },
                          { id: 'sets', label: t('statsToggleSets') },
                        ] as const
                      ).map((m) => {
                        const active = weeklyChartMode === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[
                              styles.rangePillBtn,
                              active && { backgroundColor: theme.text },
                            ]}
                            onPress={() => {
                              try {
                                Haptics.selectionAsync();
                              } catch {}
                              setWeeklyChartMode(m.id);
                            }}
                          >
                            <Text
                              style={[
                                styles.rangePillText,
                                { color: active ? theme.bg : theme.textMuted },
                              ]}
                            >
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 7-Week Gradient Pillar Bar Chart */}
                  <View style={styles.weeklyBarsWrap}>
                    <Svg width={barChartW} height={barChartH}>
                      <Defs>
                        <LinearGradient id="weeklyBarActiveGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#38BDF8" stopOpacity={1} />
                          <Stop offset="100%" stopColor="#0284C7" stopOpacity={0.72} />
                        </LinearGradient>
                        <LinearGradient id="weeklyBarHistGrad" x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor="#10B981" stopOpacity={0.85} />
                          <Stop offset="100%" stopColor="#10B981" stopOpacity={0.28} />
                        </LinearGradient>
                      </Defs>

                      {[0, 0.5, 1].map((r, i) => {
                        const y = barTopPad + r * barPlotH;
                        return (
                          <Line
                            key={i}
                            x1={0}
                            y1={y}
                            x2={barChartW}
                            y2={y}
                            stroke={
                              isDark ? 'rgba(255,255,255,0.065)' : 'rgba(15,23,42,0.07)'
                            }
                            strokeDasharray="3 5"
                            strokeWidth={1}
                          />
                        );
                      })}

                      {statsAnalytics.weeklySeries.map((wk, idx) => {
                        const val = weeklyChartMode === 'volume' ? wk.volumeKg : wk.sets;
                        const slotW = barChartW / statsAnalytics.weeklySeries.length;
                        const pillW = Math.min(28, Math.max(16, slotW * 0.48));
                        const cx = slotW * idx + slotW / 2;
                        const ratio = val > 0 ? Math.max(0.1, val / weeklyMax) : 0;
                        const h = val > 0 ? Math.max(8, ratio * barPlotH) : 4;
                        const y = barTopPad + barPlotH - h;
                        const showTopVal =
                          val > 0 && (wk.isCurrent || idx === peakWeekIdx);
                        const formattedTopVal =
                          weeklyChartMode === 'volume'
                            ? val >= 1000
                              ? `${(val / 1000).toFixed(1)}t`
                              : `${val}`
                            : `${val}`;

                        return (
                          <G key={wk.key}>
                            {/* Subtle track pillar */}
                            <Rect
                              x={cx - pillW / 2}
                              y={barTopPad}
                              width={pillW}
                              height={barPlotH}
                              rx={7}
                              fill={
                                isDark
                                  ? 'rgba(255,255,255,0.035)'
                                  : 'rgba(15,23,42,0.035)'
                              }
                            />
                            {/* Active / Historical gradient pillar */}
                            <Rect
                              x={cx - pillW / 2}
                              y={y}
                              width={pillW}
                              height={h}
                              rx={7}
                              fill={
                                val === 0
                                  ? isDark
                                    ? 'rgba(255,255,255,0.1)'
                                    : 'rgba(15,23,42,0.1)'
                                  : wk.isCurrent
                                  ? 'url(#weeklyBarActiveGrad)'
                                  : 'url(#weeklyBarHistGrad)'
                              }
                            />
                            {showTopVal && (
                              <SvgText
                                x={cx}
                                y={Math.max(12, y - 6)}
                                textAnchor="middle"
                                fontSize="10"
                                fontWeight="800"
                                fill={wk.isCurrent ? '#38BDF8' : theme.textSecondary}
                              >
                                {formattedTopVal}
                              </SvgText>
                            )}
                            <SvgText
                              x={cx}
                              y={barChartH - 6}
                              textAnchor="middle"
                              fontSize="9.5"
                              fontWeight={wk.isCurrent ? '800' : '600'}
                              fill={wk.isCurrent ? theme.text : theme.textMuted}
                            >
                              {wk.label}
                            </SvgText>
                          </G>
                        );
                      })}
                    </Svg>
                  </View>

                  {/* Weekday-Aligned 28-Day Precision Activity Heatmap */}
                  <View style={styles.heatmapBlock}>
                    <View style={styles.heatmapHeaderRow}>
                      <Text style={[styles.heatmapSubLabel, { color: theme.textSecondary }]}>
                        {t('last28DaysHeading')}
                      </Text>
                      <Text style={[styles.heatmapSubMeta, { color: '#10B981' }]}>
                        {t('workoutsCountLabel', { count: statsAnalytics.active28Count })}
                      </Text>
                    </View>

                    <View style={styles.heatmapWeekdayRow}>
                      {statsAnalytics.weekdayHeaders.map((wd, i) => (
                        <Text
                          key={`${wd}_${i}`}
                          style={[
                            styles.heatmapWeekdayText,
                            { width: heatmapCellW, color: theme.textMuted },
                          ]}
                        >
                          {wd}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.heatmapGrid}>
                      {statsAnalytics.heatmapCells.map((cell) => {
                        const bg = cell.isFuture
                          ? 'transparent'
                          : cell.intensity === 3
                          ? '#38BDF8'
                          : cell.intensity === 2
                          ? '#10B981'
                          : cell.intensity === 1
                          ? isDark
                            ? 'rgba(16, 185, 129, 0.45)'
                            : 'rgba(16, 185, 129, 0.38)'
                          : isDark
                          ? 'rgba(255,255,255,0.055)'
                          : 'rgba(15,23,42,0.055)';
                        return (
                          <View
                            key={cell.key}
                            style={[
                              styles.heatmapCell,
                              {
                                width: heatmapCellW,
                                backgroundColor: bg,
                                borderColor: cell.isToday
                                  ? theme.text
                                  : cell.isFuture
                                  ? theme.hairline
                                  : 'transparent',
                                borderWidth: cell.isToday ? 1.5 : cell.isFuture ? 1 : 0,
                                borderStyle: cell.isFuture ? 'dashed' : 'solid',
                                opacity: cell.isFuture ? 0.35 : 1,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.heatmapCellText,
                                {
                                  color:
                                    cell.intensity >= 2
                                      ? '#09090B'
                                      : cell.intensity === 1
                                      ? isDark
                                        ? '#ECFDF5'
                                        : '#065F46'
                                      : theme.textMuted,
                                },
                              ]}
                            >
                              {cell.dayNum}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* 6. OPEN EDITORIAL SECTION: RECENT WORKOUTS TIMELINE */}
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
                        onPress={() => setShowAllJournalWorkouts((v) => !v)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.sectionRightMeta, { color: '#38BDF8' }]}>
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
                    <View style={styles.timelineListWrap}>
                      {(showAllJournalWorkouts
                        ? workoutHistory.slice(-15)
                        : workoutHistory.slice(-4)
                      )
                        .slice()
                        .reverse()
                        .map((entry, idx, arr) => {
                          const isLast = idx === arr.length - 1;
                          return (
                            <View key={`${entry.date}-${idx}`} style={styles.timelineRow}>
                              {/* Left Editorial Vertical Rail + Node */}
                              <View style={styles.timelineRailCol}>
                                <View
                                  style={[
                                    styles.timelineNodeDot,
                                    {
                                      backgroundColor: idx === 0 ? '#38BDF8' : '#10B981',
                                    },
                                  ]}
                                />
                                {!isLast && (
                                  <View
                                    style={[
                                      styles.timelineRailLine,
                                      { backgroundColor: theme.hairline },
                                    ]}
                                  />
                                )}
                              </View>

                              {/* Right Session Telemetry */}
                              <View
                                style={[
                                  styles.timelineContent,
                                  !isLast && {
                                    borderBottomWidth: StyleSheet.hairlineWidth,
                                    borderBottomColor: theme.hairline,
                                  },
                                ]}
                              >
                                <View style={styles.timelineTopLine}>
                                  <Text
                                    style={[styles.workoutLogTitle, { color: theme.text }]}
                                    numberOfLines={1}
                                  >
                                    {entry.dayName}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.timelineDateRight,
                                      { color: theme.textMuted },
                                    ]}
                                  >
                                    {parseLocalDateKey(entry.date).toLocaleDateString(
                                      localeCode,
                                      {
                                        day: 'numeric',
                                        month: 'short',
                                      }
                                    )}
                                  </Text>
                                </View>

                                <View style={styles.timelineMetaChipsRow}>
                                  <View
                                    style={[
                                      styles.timelineChip,
                                      { backgroundColor: theme.bgSecondary },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.timelineChipText,
                                        { color: theme.textSecondary },
                                      ]}
                                    >
                                      {entry.completedSets}/{entry.totalSets} {t('setsWord')}
                                    </Text>
                                  </View>
                                  {entry.durationMinutes ? (
                                    <View
                                      style={[
                                        styles.timelineChip,
                                        { backgroundColor: theme.bgSecondary },
                                      ]}
                                    >
                                      <Ionicons
                                        name="time-outline"
                                        size={11}
                                        color={theme.textMuted}
                                      />
                                      <Text
                                        style={[
                                          styles.timelineChipText,
                                          { color: theme.textSecondary },
                                        ]}
                                      >
                                        {entry.durationMinutes} min
                                      </Text>
                                    </View>
                                  ) : null}
                                  {entry.totalVolumeKg ? (
                                    <View
                                      style={[
                                        styles.timelineChip,
                                        { backgroundColor: 'rgba(56, 189, 248, 0.12)' },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.timelineChipText,
                                          { color: '#38BDF8', fontWeight: '800' },
                                        ]}
                                      >
                                        {entry.totalVolumeKg >= 1000
                                          ? `${(entry.totalVolumeKg / 1000).toFixed(1)} t`
                                          : `${entry.totalVolumeKg.toLocaleString(localeCode)} kg`}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>
              </View>
            );
          })()}
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
                  label: parseLocalDateKey(p.date.slice(0, 10)).toLocaleDateString(localeCode, {
                    day: 'numeric',
                    month: 'short',
                  }),
                })),
                selectedExerciseRankStat?.rankMeta.color || '#10B981',
                'kg',
                'pr',
                SCREEN_WIDTH - 40
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

      {/* =========================================================
          BODY WEIGHT LOGGER SHEET (TODAY OR ANY PAST DAY)
         ========================================================= */}
      <InteractiveBottomSheet
        visible={showWeightSheet}
        onClose={() => setShowWeightSheet(false)}
        title={t('journalLogWeightSheetTitle')}
        subtitle={t('journalLogWeightSheetSub')}
        initialHeightPercent={0.56}
      >
        <BottomSheetScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.weightSheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Date Chips */}
          <View style={styles.weightQuickDatesRow}>
            {[
              { offset: 0, label: t('journalDateToday') },
              { offset: -1, label: t('journalDateYesterday') },
              { offset: -2, label: t('journalDateDaysAgo', { count: 2 }) },
              { offset: -3, label: t('journalDateDaysAgo', { count: 3 }) },
            ].map((chip) => {
              const active = weightSheetOffsetDays === chip.offset;
              return (
                <TouchableOpacity
                  key={chip.offset}
                  onPress={() => changeWeightSheetOffset(chip.offset)}
                  activeOpacity={0.78}
                  style={[
                    styles.weightDateChip,
                    {
                      backgroundColor: active
                        ? '#38BDF8'
                        : theme.bgSecondary,
                      borderColor: active ? '#38BDF8' : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.weightDateChipText,
                      { color: active ? '#09090B' : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {chip.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Any-Day Calendar Stepper (step backwards arbitrarily far) */}
          <View
            style={[
              styles.weightDateStepperBox,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => changeWeightSheetOffset(weightSheetOffsetDays - 1)}
              style={styles.weightDateNavBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <View style={styles.weightDateCenter}>
              <Ionicons name="calendar-outline" size={15} color="#38BDF8" />
              <Text style={[styles.weightDateCenterText, { color: theme.text }]}>
                {parseLocalDateKey(
                  getLocalDateKeyOffset(weightSheetOffsetDays)
                ).toLocaleDateString(localeCode, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>

            <TouchableOpacity
              disabled={weightSheetOffsetDays >= 0}
              onPress={() => changeWeightSheetOffset(weightSheetOffsetDays + 1)}
              style={[
                styles.weightDateNavBtn,
                weightSheetOffsetDays >= 0 && { opacity: 0.3 },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Weight Value Stepper & Input */}
          <View style={styles.weightSheetInputRow}>
            <TouchableOpacity
              style={[
                styles.weightSheetStepBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() =>
                adjustWeightInput(weightSheetInput, -0.5, setWeightSheetInput)
              }
              activeOpacity={0.75}
            >
              <Text style={[styles.weightSheetStepLbl, { color: theme.text }]}>-0.5</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.weightSheetStepBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() =>
                adjustWeightInput(weightSheetInput, -0.1, setWeightSheetInput)
              }
              activeOpacity={0.75}
            >
              <Text style={[styles.weightSheetStepLbl, { color: theme.text }]}>-0.1</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.weightSheetCenterInputWrap,
                { backgroundColor: theme.bgSecondary, borderColor: '#38BDF8' },
              ]}
            >
              <TextInput
                style={[styles.weightSheetCenterInput, { color: theme.text }]}
                placeholder="75.0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                value={weightSheetInput}
                onChangeText={setWeightSheetInput}
                textAlign="center"
              />
              <Text style={[styles.weightSheetCenterUnit, { color: theme.textMuted }]}>kg</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.weightSheetStepBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() =>
                adjustWeightInput(weightSheetInput, 0.1, setWeightSheetInput)
              }
              activeOpacity={0.75}
            >
              <Text style={[styles.weightSheetStepLbl, { color: theme.text }]}>+0.1</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.weightSheetStepBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() =>
                adjustWeightInput(weightSheetInput, 0.5, setWeightSheetInput)
              }
              activeOpacity={0.75}
            >
              <Text style={[styles.weightSheetStepLbl, { color: theme.text }]}>+0.5</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.weightSheetSaveBtn, { backgroundColor: '#38BDF8' }]}
            onPress={handleSaveSheetWeight}
            activeOpacity={0.82}
          >
            <Ionicons name="checkmark-circle" size={18} color="#09090B" />
            <Text style={styles.weightSheetSaveBtnText}>{t('save')}</Text>
          </TouchableOpacity>
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
    paddingVertical: 30,
    alignItems: 'center',
    gap: 8,
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
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
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
    gap: 7,
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
  // Unified Spline Chart styles (shared by Weight & 1RM charts)
  unifiedChartBox: {
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  unifiedChartDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: -2,
    marginBottom: 8,
  },
  unifiedChartDateText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  unifiedChartStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unifiedChartStatCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  unifiedChartStatDiv: {
    width: StyleSheet.hairlineWidth,
    height: 24,
  },
  unifiedChartStatLbl: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  unifiedChartStatVal: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  // Redesigned Journal Sub-Tab styles
  journalPage: {
    gap: 14,
    paddingTop: 10,
  },
  journalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  journalCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dailyWeighCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  dailyWeighHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  dailyWeighIconOrb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyWeighTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  dailyWeighSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  weightStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightStepBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightStepInputWrap: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 4,
  },
  weightStepInput: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 54,
    paddingVertical: 0,
  },
  weightStepUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
  dailyWeighSaveBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dailyWeighSaveText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#09090B',
  },
  dailyWeighSkipBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  dailyWeighSkipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  weightDeltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  weightDeltaPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  weightBmiPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  weightBmiText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  journalAddWeightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  journalAddWeightText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  journalChartToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  journalWeightLogWrap: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  weightLogLeft: {
    flex: 1,
    minWidth: 0,
  },
  weightLogStepDiff: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  // One-way animated supplements checklist
  suppOneWayHint: {
    fontSize: 11.5,
    fontWeight: '500',
    marginTop: 2,
  },
  oneWaySuppList: {
    gap: 8,
    marginTop: 2,
  },
  oneWaySuppRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  oneWaySuppName: {
    fontSize: 14,
    fontWeight: '800',
  },
  oneWaySuppDose: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  oneWayCheckWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneWayCheckRipple: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
  },
  oneWayCheckFilled: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oneWayCheckEmpty: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.8,
  },
  // Past/Today Weight Logger Sheet
  weightSheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 14,
  },
  weightQuickDatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weightDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  weightDateChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  weightDateStepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  weightDateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightDateCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  weightDateCenterText: {
    fontSize: 14,
    fontWeight: '800',
  },
  weightSheetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weightSheetStepBtn: {
    paddingHorizontal: 10,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightSheetStepLbl: {
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  weightSheetCenterInputWrap: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 3,
  },
  weightSheetCenterInput: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 58,
    paddingVertical: 0,
  },
  weightSheetCenterUnit: {
    fontSize: 13,
    fontWeight: '700',
  },
  weightSheetSaveBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  weightSheetSaveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#09090B',
  },
  // Open Interactive Spline Chart styles
  openSplineWrap: {
    marginTop: 6,
    marginBottom: 6,
  },
  splineTooltipPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  splineTooltipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  splineTooltipDate: {
    fontSize: 11,
    fontWeight: '700',
  },
  splineTooltipVal: {
    fontSize: 12.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  splineTouchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  splineTouchSlice: {
    flex: 1,
    height: '100%',
  },
  openSplineStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Redesigned Statystyki Atmospheric Hero Stage & Editorial Sections
  statsHeroStage: {
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 16,
  },
  statsHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statsRingWrap: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRingVal: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  statsRingLbl: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: -1,
  },
  statsHeroCopyCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  statsHeroEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: '#38BDF8',
  },
  statsHeroBigVal: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    lineHeight: 36,
  },
  statsHeroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  statsHeroSubLabel: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  statsHeroWeekPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  statsHeroWeekPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#10B981',
    fontVariant: ['tabular-nums'],
  },
  statsHeroKpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statsHeroKpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statsHeroKpiDiv: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  statsHeroKpiVal: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  statsHeroKpiLblRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsHeroKpiDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statsHeroKpiLbl: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  slimWeighStrip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 8,
  },
  slimWeighTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  slimWeighTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
    minWidth: 0,
  },
  slimWeighTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  slimWeighSkipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  statsWeightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  statsSculptedWeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  statsSculptedWeightVal: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    fontVariant: ['tabular-nums'],
    lineHeight: 40,
  },
  statsSculptedWeightUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsWeightToolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 2,
  },
  bmiSpectrumWrap: {
    marginTop: 12,
    gap: 7,
  },
  bmiSpectrumTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bmiSpectrumTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  bmiStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  bmiStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bmiStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bmiBarTrack: {
    height: 7,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    position: 'relative',
  },
  bmiBarSeg: {
    height: 7,
    borderRadius: 999,
  },
  bmiNeedle: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2.5,
    marginLeft: -6.5,
  },
  openWeightLogWrap: {
    marginTop: 10,
  },
  expandInlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 10,
    paddingBottom: 2,
  },
  expandInlineLinkText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  openSupp7dRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 14,
  },
  suppWeekPillBar: {
    width: '100%',
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weeklyBarsWrap: {
    marginTop: 4,
    marginBottom: 14,
  },
  heatmapBlock: {
    gap: 8,
    marginTop: 2,
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heatmapSubLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  heatmapSubMeta: {
    fontSize: 12,
    fontWeight: '800',
  },
  heatmapWeekdayRow: {
    flexDirection: 'row',
    gap: 7,
  },
  heatmapWeekdayText: {
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  heatmapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  heatmapCell: {
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapCellText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  // Editorial Vertical Timeline for Recent Sessions
  timelineListWrap: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineRailCol: {
    width: 14,
    alignItems: 'center',
  },
  timelineNodeDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 14,
  },
  timelineRailLine: {
    width: 1.5,
    flex: 1,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 11,
    gap: 7,
  },
  timelineTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineDateRight: {
    fontSize: 11.5,
    fontWeight: '700',
    flexShrink: 0,
  },
  timelineMetaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timelineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
  },
  timelineChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
