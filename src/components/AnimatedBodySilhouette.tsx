import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Pattern,
  Rect,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useIsScreenActive } from '../context/TabActivityContext';
import { Exercise, MuscleSubGroupId, UserGender } from '../types/workout';
import {
  BODY_BACK_PARTS,
  BODY_FEMALE_BACK_PARTS,
  BODY_FEMALE_FRONT_PARTS,
  BODY_FRONT_PARTS,
  BODY_OUTLINE_BACK,
  BODY_OUTLINE_FEMALE_BACK,
  BODY_OUTLINE_FEMALE_FRONT,
  BODY_OUTLINE_FRONT,
  BodyPartVector,
} from '../data/bodySilhouettePaths';
import { MUSCLE_SUBGROUP_MAP } from '../data/muscleMap';
import { ExerciseRankStat, MuscleRankStat } from '../services/muscleAnalytics';
import { RankCrestIcon } from './RankCrestIcon';

export type SilhouetteViewSide = 'front' | 'back';

export interface EnrichedExerciseRankStat extends ExerciseRankStat {
  exercise: Exercise;
}

interface AnimatedBodySilhouetteProps {
  gender?: UserGender;
  muscleStatsMap: Record<MuscleSubGroupId, MuscleRankStat>;
  selectedMuscle: MuscleSubGroupId | null;
  onSelectMuscle: (muscle: MuscleSubGroupId | null) => void;
  selectedMuscleExercises?: EnrichedExerciseRankStat[];
  exercisesByMuscle?: Record<string, EnrichedExerciseRankStat[]>;
  isTabActive?: boolean;
  onPressExercise?: (exercise: Exercise) => void;
}

/**
 * Normalized focal anchors (dx, dy in -0.5..0.5 of SVG box) for each anatomical
 * muscle group so Fullscreen Zoom glides directly onto the tapped muscle.
 */
const MUSCLE_FOCUS_ANCHORS: Record<MuscleSubGroupId, { fx: number; fy: number }> = {
  traps: { fx: -0.05, fy: -0.29 },
  upper_chest: { fx: -0.06, fy: -0.24 },
  mid_lower_chest: { fx: -0.06, fy: -0.2 },
  front_delts: { fx: -0.17, fy: -0.22 },
  side_delts: { fx: -0.2, fy: -0.21 },
  rear_delts: { fx: -0.18, fy: -0.22 },
  biceps: { fx: -0.22, fy: -0.14 },
  triceps: { fx: -0.21, fy: -0.14 },
  forearms: { fx: -0.27, fy: -0.02 },
  abs: { fx: 0, fy: -0.09 },
  obliques: { fx: -0.11, fy: -0.08 },
  lats: { fx: -0.12, fy: -0.16 },
  mid_back: { fx: -0.04, fy: -0.18 },
  lower_back: { fx: 0, fy: -0.04 },
  glutes: { fx: -0.08, fy: 0.04 },
  quads: { fx: -0.09, fy: 0.16 },
  hamstrings: { fx: -0.09, fy: 0.16 },
  adductors: { fx: -0.04, fy: 0.14 },
  calves: { fx: -0.09, fy: 0.34 },
};

const INERT_SLUGS = new Set([
  'head',
  'hair',
  'neck',
  'hands',
  'knees',
  'ankles',
  'feet',
]);

/**
 * Resolves which of our 19 anatomical sub-muscles a given SVG path belongs to.
 */
function resolveMuscleIdForPath(
  side: 'front' | 'back',
  slug: string,
  pathIndex: number,
  muscleStatsMap: Record<MuscleSubGroupId, MuscleRankStat>
): MuscleSubGroupId | null {
  if (INERT_SLUGS.has(slug)) return null;

  if (side === 'front') {
    switch (slug) {
      case 'chest': {
        const upper = muscleStatsMap.upper_chest;
        const mid = muscleStatsMap.mid_lower_chest;
        if (!upper || !mid) return 'mid_lower_chest';
        return upper.effectiveSetsTotal > mid.effectiveSetsTotal
          ? 'upper_chest'
          : 'mid_lower_chest';
      }
      case 'deltoids': {
        const front = muscleStatsMap.front_delts;
        const sideDelt = muscleStatsMap.side_delts;
        if (!front || !sideDelt) return 'side_delts';
        return sideDelt.effectiveSetsTotal >= front.effectiveSetsTotal
          ? 'side_delts'
          : 'front_delts';
      }
      case 'biceps':
        return 'biceps';
      case 'triceps':
        return 'triceps';
      case 'forearm':
        return 'forearms';
      case 'trapezius':
        return 'traps';
      case 'abs':
        return 'abs';
      case 'obliques':
        return 'obliques';
      case 'quadriceps':
        return 'quads';
      case 'adductors':
        return 'adductors';
      case 'calves':
      case 'tibialis':
        return 'calves';
      default:
        return null;
    }
  } else {
    switch (slug) {
      case 'trapezius':
        return 'traps';
      case 'deltoids':
        return 'rear_delts';
      case 'upper-back':
        return pathIndex === 1 ? 'lats' : 'mid_back';
      case 'lower-back':
        return 'lower_back';
      case 'triceps':
        return 'triceps';
      case 'forearm':
        return 'forearms';
      case 'gluteal':
        return 'glutes';
      case 'hamstring':
        return 'hamstrings';
      case 'adductors':
        return 'adductors';
      case 'calves':
        return 'calves';
      default:
        return null;
    }
  }
}

function getMuscleFillStyle(
  stat: MuscleRankStat | undefined,
  isSelected: boolean,
  hasAnySelection: boolean,
  isDark: boolean
): {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
} {
  const baseEmpty = isDark ? '#3F3F46' : '#D4D4D8';
  const baseStroke = isDark ? '#27272A' : '#E4E4E7';

  // Untrained muscles (0 sets) are ALWAYS translucent neutral gray
  if (!stat || stat.effectiveSetsTotal <= 0 || stat.priorityStatus === 'untrained') {
    if (hasAnySelection && isSelected) {
      return {
        fill: isDark ? '#71717A' : '#A1A1AA',
        fillOpacity: 0.62,
        stroke: isDark ? '#FAFAFA' : '#18181B',
        strokeWidth: 2.6,
        strokeOpacity: 0.9,
      };
    }
    return {
      fill: baseEmpty,
      fillOpacity: hasAnySelection ? 0.18 : isDark ? 0.3 : 0.42,
      stroke: baseStroke,
      strokeWidth: 1,
      strokeOpacity: 0.55,
    };
  }

  let fill = baseEmpty;
  let fillOpacity = isDark ? 0.48 : 0.54;

  if (stat.priorityStatus === 'neglected' || stat.priorityStatus === 'lagging') {
    fill = isDark ? '#FFE033' : '#FACC15';
    fillOpacity = isDark ? 0.84 : 0.88;
  } else if (stat.priorityStatus === 'balanced') {
    fill = isDark ? '#22C55E' : '#10B981';
    fillOpacity = isDark ? 0.82 : 0.85;
  } else {
    fill = isDark ? '#38BDF8' : '#0EA5E9';
    fillOpacity = isDark ? 0.86 : 0.88;
  }

  const strokeColor =
    stat.priorityStatus === 'neglected' || stat.priorityStatus === 'lagging'
      ? isDark
        ? '#FEF08A'
        : '#CA8A04'
      : fill;

  if (hasAnySelection) {
    if (isSelected) {
      return {
        fill,
        fillOpacity: 0.96,
        stroke: isDark ? '#FFFFFF' : '#09090B',
        strokeWidth: 2.8,
        strokeOpacity: 0.98,
      };
    }
    return {
      fill,
      fillOpacity: 0.28,
      stroke: baseStroke,
      strokeWidth: 0.9,
      strokeOpacity: 0.45,
    };
  }

  return {
    fill,
    fillOpacity,
    stroke: strokeColor,
    strokeWidth: 1.35,
    strokeOpacity: 0.88,
  };
}

const EMPTY_SILHOUETTE_EXERCISES: EnrichedExerciseRankStat[] = [];

export const AnimatedBodySilhouette: React.FC<AnimatedBodySilhouetteProps> = React.memo(({
  gender = 'male',
  muscleStatsMap,
  selectedMuscle,
  onSelectMuscle,
  selectedMuscleExercises = EMPTY_SILHOUETTE_EXERCISES,
  exercisesByMuscle,
  isTabActive = true,
  onPressExercise,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, exerciseName, rankTitle } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [viewSide, setViewSide] = useState<SilhouetteViewSide>('front');
  const viewSideRef = useRef<SilhouetteViewSide>('front');
  const isAnimatingRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Stationary in-place axis rotation animations (ZERO horizontal translation!)
  const flipScaleX = useRef(new Animated.Value(1)).current;
  const flipScaleY = useRef(new Animated.Value(1)).current;
  const flipOpacity = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  // Fullscreen zoom-to-muscle & card slide animations
  const isScreenActive = useIsScreenActive();
  const fsZoomScale = useRef(new Animated.Value(1)).current;
  const fsZoomX = useRef(new Animated.Value(0)).current;
  const fsZoomY = useRef(new Animated.Value(0)).current;
  const fsCardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    viewSideRef.current = viewSide;
  }, [viewSide]);

  useEffect(() => {
    if (!isScreenActive || (!isTabActive && !isFullscreen)) return;
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    return () => {
      floatLoop.stop();
    };
  }, [floatAnim, isFullscreen, isTabActive, isScreenActive]);

  const selectedStat = selectedMuscle ? muscleStatsMap[selectedMuscle] : null;

  const rotateToSide = useCallback(
    (targetSide?: SilhouetteViewSide) => {
      if (isAnimatingRef.current) return;
      const current = viewSideRef.current;
      const next = targetSide || (current === 'front' ? 'back' : 'front');
      if (next === current) return;

      isAnimatingRef.current = true;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}

      // Phase 1: Rotate in-place around central vertical spine to 90deg edge
      Animated.parallel([
        Animated.timing(flipScaleX, {
          toValue: 0.03,
          duration: 140,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(flipScaleY, {
          toValue: 0.975,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flipOpacity, {
          toValue: 0.45,
          duration: 140,
          useNativeDriver: true,
        }),
      ]).start(() => {
        viewSideRef.current = next;
        setViewSide(next);

        // Phase 2: Unfold smoothly in the exact same spot
        Animated.parallel([
          Animated.spring(flipScaleX, {
            toValue: 1,
            friction: 7,
            tension: 82,
            useNativeDriver: true,
          }),
          Animated.spring(flipScaleY, {
            toValue: 1,
            friction: 7,
            tension: 82,
            useNativeDriver: true,
          }),
          Animated.timing(flipOpacity, {
            toValue: 1,
            duration: 170,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimatingRef.current = false;
        });
      });
    },
    [flipOpacity, flipScaleX, flipScaleY]
  );

  // Auto-flip when user selects a muscle from the list that belongs to the opposite side
  useEffect(() => {
    if (!selectedMuscle) return;
    const meta = MUSCLE_SUBGROUP_MAP[selectedMuscle];
    if (!meta) return;
    if (meta.side === 'front' && viewSideRef.current === 'back') {
      rotateToSide('front');
    } else if (meta.side === 'back' && viewSideRef.current === 'front') {
      rotateToSide('back');
    }
  }, [selectedMuscle, rotateToSide]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15,
        onPanResponderMove: (_, gestureState) => {
          // Rotate strictly in place around central vertical spine (no horizontal shift!)
          const progress = Math.min(1, Math.abs(gestureState.dx) / 140);
          flipScaleX.setValue(Math.max(0.28, 1 - progress * 0.72));
          flipScaleY.setValue(1 - progress * 0.02);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 24 || Math.abs(gestureState.vx) > 0.3) {
            rotateToSide();
          } else {
            Animated.parallel([
              Animated.spring(flipScaleX, {
                toValue: 1,
                useNativeDriver: true,
              }),
              Animated.spring(flipScaleY, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(flipScaleX, {
              toValue: 1,
              useNativeDriver: true,
            }),
            Animated.spring(flipScaleY, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [flipScaleX, flipScaleY, rotateToSide]
  );

  const handleMusclePress = (muscleId: MuscleSubGroupId | null) => {
    if (!muscleId) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (muscleId === 'mid_lower_chest' && selectedMuscle === 'mid_lower_chest') {
      onSelectMuscle('upper_chest');
      return;
    }
    if (muscleId === 'upper_chest' && selectedMuscle === 'upper_chest') {
      onSelectMuscle(null);
      return;
    }

    if (muscleId === 'side_delts' && selectedMuscle === 'side_delts') {
      onSelectMuscle('front_delts');
      return;
    }
    if (muscleId === 'front_delts' && selectedMuscle === 'front_delts') {
      onSelectMuscle(null);
      return;
    }

    onSelectMuscle(selectedMuscle === muscleId ? null : muscleId);
  };

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  const inertFill = isDark ? '#27272A' : '#E4E4E7';
  const outlineStroke = isDark ? '#52525B' : '#A1A1AA';

  const isFemale = gender === 'female';
  const parts: BodyPartVector[] =
    viewSide === 'front'
      ? isFemale
        ? BODY_FEMALE_FRONT_PARTS
        : BODY_FRONT_PARTS
      : isFemale
      ? BODY_FEMALE_BACK_PARTS
      : BODY_BACK_PARTS;

  // Exact midline-aligned viewBoxes so Front and Back stand in the exact same pixel position!
  const viewBox =
    viewSide === 'front'
      ? isFemale
        ? '-50.5 15 740 1445'
        : '-11.2 80 724 1320'
      : isFemale
      ? '773.5 15 740 1445'
      : '724.6 80 724 1320';

  const outlinePath =
    viewSide === 'front'
      ? isFemale
        ? BODY_OUTLINE_FEMALE_FRONT
        : BODY_OUTLINE_FRONT
      : isFemale
      ? BODY_OUTLINE_FEMALE_BACK
      : BODY_OUTLINE_BACK;

  const centerX =
    viewSide === 'front'
      ? isFemale
        ? 319.5
        : 350.8
      : isFemale
      ? 1143.5
      : 1086.6;

  const activityLegend = useMemo(
    () => [
      { label: t('legendNoSets'), color: isDark ? '#3F3F46' : '#D4D4D8' },
      { label: t('legendLowVol'), color: isDark ? '#FFE033' : '#FACC15' },
      { label: t('legendBalanced'), color: isDark ? '#22C55E' : '#10B981' },
      { label: t('legendDominant'), color: isDark ? '#38BDF8' : '#0EA5E9' },
    ],
    [isDark, t]
  );

  const fsTopBarH = Math.max(insets.top + 56, 88);
  const fsBottomPad = Math.max(insets.bottom + 14, 24);
  const fsStageH = Math.max(380, screenHeight - fsTopBarH - fsBottomPad);
  const fsSvgW = Math.min(screenWidth - 36, 300);
  const fsSvgH = Math.min(fsStageH - 24, Math.round(fsSvgW * (415 / 240)));

  useEffect(() => {
    if (!isFullscreen) {
      fsZoomScale.setValue(1);
      fsZoomX.setValue(0);
      fsZoomY.setValue(0);
      fsCardAnim.setValue(0);
      return;
    }

    if (selectedMuscle) {
      const anchor = MUSCLE_FOCUS_ANCHORS[selectedMuscle] || { fx: 0, fy: -0.1 };
      const z = 1.92;
      const dx = anchor.fx * fsSvgW;
      const dy = anchor.fy * fsSvgH;
      const targetPanX = -screenWidth * 0.24 - dx * z;
      const targetPanY = -fsStageH * 0.04 - dy * z;

      fsCardAnim.setValue(0);
      Animated.parallel([
        Animated.spring(fsZoomScale, {
          toValue: z,
          friction: 8,
          tension: 76,
          useNativeDriver: true,
        }),
        Animated.spring(fsZoomX, {
          toValue: targetPanX,
          friction: 8,
          tension: 76,
          useNativeDriver: true,
        }),
        Animated.spring(fsZoomY, {
          toValue: targetPanY,
          friction: 8,
          tension: 76,
          useNativeDriver: true,
        }),
        Animated.spring(fsCardAnim, {
          toValue: 1,
          friction: 7.5,
          tension: 92,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(fsZoomScale, {
          toValue: 1,
          friction: 8,
          tension: 82,
          useNativeDriver: true,
        }),
        Animated.spring(fsZoomX, {
          toValue: 0,
          friction: 8,
          tension: 82,
          useNativeDriver: true,
        }),
        Animated.spring(fsZoomY, {
          toValue: 0,
          friction: 8,
          tension: 82,
          useNativeDriver: true,
        }),
        Animated.timing(fsCardAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    fsCardAnim,
    fsStageH,
    fsSvgH,
    fsSvgW,
    fsZoomScale,
    fsZoomX,
    fsZoomY,
    isFullscreen,
    screenWidth,
    selectedMuscle,
  ]);

  const fullscreenExercises = useMemo(() => {
    if (selectedMuscle && exercisesByMuscle?.[selectedMuscle]) {
      return exercisesByMuscle[selectedMuscle];
    }
    return selectedMuscleExercises;
  }, [exercisesByMuscle, selectedMuscle, selectedMuscleExercises]);

  const renderBodySvg = (svgW: number, svgH: number) => (
    <Svg width={svgW} height={svgH} viewBox={viewBox}>
      {/* Subtle Central Axis Reference Line (no green circle glow behind silhouette) */}
      <Line
        x1={centerX}
        y1={120}
        x2={centerX}
        y2={1380}
        stroke={isDark ? '#27272A' : '#E4E4E7'}
        strokeWidth={1.5}
        strokeDasharray="6 10"
        strokeOpacity={0.45}
      />

      {parts.map((part) => {
        const isInert = INERT_SLUGS.has(part.slug);
        const allSides: Array<{ key: string; list: string[] }> = [
          { key: 'common', list: part.path.common || [] },
          { key: 'left', list: part.path.left || [] },
          { key: 'right', list: part.path.right || [] },
        ];

        return (
          <G key={`${viewSide}-${part.slug}`}>
            {allSides.map(({ key, list }) =>
              list.map((d, idx) => {
                if (isInert) {
                  return (
                    <Path
                      key={`${viewSide}-${part.slug}-${key}-${idx}`}
                      d={d}
                      fill={inertFill}
                      fillOpacity={isDark ? 0.38 : 0.52}
                    />
                  );
                }

                const muscleId = resolveMuscleIdForPath(
                  viewSide,
                  part.slug,
                  idx,
                  muscleStatsMap
                );

                const isSelected = Boolean(
                  selectedMuscle &&
                    (selectedMuscle === muscleId ||
                      (part.slug === 'chest' &&
                        (selectedMuscle === 'upper_chest' ||
                          selectedMuscle === 'mid_lower_chest')) ||
                      (viewSide === 'front' &&
                        part.slug === 'deltoids' &&
                        (selectedMuscle === 'front_delts' ||
                          selectedMuscle === 'side_delts')))
                );

                const stat =
                  selectedMuscle && isSelected
                    ? muscleStatsMap[selectedMuscle]
                    : muscleId
                    ? muscleStatsMap[muscleId]
                    : undefined;

                const style = getMuscleFillStyle(
                  stat,
                  isSelected,
                  Boolean(selectedMuscle),
                  isDark
                );

                return (
                  <Path
                    key={`${viewSide}-${part.slug}-${key}-${idx}`}
                    d={d}
                    fill={style.fill}
                    fillOpacity={style.fillOpacity}
                    stroke={style.stroke}
                    strokeWidth={style.strokeWidth}
                    strokeOpacity={style.strokeOpacity}
                    onPress={() => handleMusclePress(muscleId)}
                  />
                );
              })
            )}
          </G>
        );
      })}

      {outlinePath ? (
        <Path
          d={outlinePath}
          fill="none"
          stroke={outlineStroke}
          strokeWidth={2.1}
          strokeOpacity={isDark ? 0.72 : 0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      ) : null}
    </Svg>
  );

  const selectedStatusAccent = !selectedStat
    ? theme.textMuted
    : selectedStat.effectiveSetsTotal === 0
    ? isDark
      ? '#71717A'
      : '#A1A1AA'
    : selectedStat.priorityStatus === 'dominant'
    ? '#38BDF8'
    : selectedStat.priorityStatus === 'balanced'
    ? '#10B981'
    : isDark
    ? '#FDE047'
    : '#FACC15';

  return (
    <View style={styles.container}>
      {/* Minimalist Side Status Header with Flip & Fullscreen Buttons */}
      <View style={styles.sideHeaderRow}>
        <View style={styles.sideTagWrap}>
          <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.sideTagText, { color: theme.text }]}>
            {viewSide === 'front' ? t('frontSilhouetteCaps') : t('backSilhouetteCaps')}
          </Text>
        </View>
        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={[
              styles.quickFlipChip,
              {
                backgroundColor: isDark
                  ? 'rgba(39, 39, 42, 0.55)'
                  : 'rgba(244, 244, 245, 0.78)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : 'rgba(24, 24, 27, 0.08)',
              },
            ]}
            onPress={() => rotateToSide()}
            activeOpacity={0.75}
          >
            <Ionicons name="sync-outline" size={12} color={theme.textSecondary} />
            <Text style={[styles.sideCounterText, { color: theme.textSecondary }]}>
              {viewSide === 'front' ? t('viewCounterFront') : t('viewCounterBack')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.fullscreenBtnChip,
              {
                backgroundColor: isDark
                  ? 'rgba(39, 39, 42, 0.65)'
                  : 'rgba(244, 244, 245, 0.88)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.14)'
                  : 'rgba(24, 24, 27, 0.1)',
              },
            ]}
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
              setIsFullscreen(true);
            }}
            activeOpacity={0.75}
            accessibilityLabel={t('anatomyFullscreenTitle')}
          >
            <Ionicons name="expand-outline" size={14} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Interactive Swipe-to-Rotate Silhouette Stage with Minimalist Architectural Grid */}
      <View
        {...panResponder.panHandlers}
        style={[
          styles.swipeZone,
          {
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(24, 24, 27, 0.014)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(24, 24, 27, 0.06)',
          },
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        >
          <Defs>
            <Pattern
              id="silhouetteGrid"
              width={44}
              height={44}
              patternUnits="userSpaceOnUse"
            >
              <Path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke={isDark ? 'rgba(255, 255, 255, 0.058)' : 'rgba(24, 24, 27, 0.052)'}
                strokeWidth={0.9}
              />
              <Circle
                cx={0}
                cy={0}
                r={1.15}
                fill={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(24, 24, 27, 0.12)'}
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#silhouetteGrid)" />
        </Svg>

        {/* Minimalist Corner Calibration Ticks */}
        <View
          style={[
            styles.cornerTick,
            styles.cornerTL,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)', pointerEvents: 'none' },
          ]}
        />
        <View
          style={[
            styles.cornerTick,
            styles.cornerTR,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)', pointerEvents: 'none' },
          ]}
        />
        <View
          style={[
            styles.cornerTick,
            styles.cornerBL,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)', pointerEvents: 'none' },
          ]}
        />
        <View
          style={[
            styles.cornerTick,
            styles.cornerBR,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)', pointerEvents: 'none' },
          ]}
        />

        <Animated.View
          style={[
            styles.stageWrap,
            {
              opacity: flipOpacity,
              transform: [
                { scaleX: flipScaleX },
                { scaleY: flipScaleY },
                { translateY },
              ],
            },
          ]}
        >
          {renderBodySvg(240, 415)}
        </Animated.View>
      </View>

      {/* Minimalist Open Legend Strip */}
      <View style={styles.legendRow}>
        {activityLegend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View
              style={[
                styles.legendSwatch,
                { backgroundColor: item.color, opacity: 0.96 },
              ]}
            />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Open Selected Muscle Focus Strip */}
      {selectedStat ? (
        <View
          style={[
            styles.focusStrip,
            {
              borderLeftColor:
                selectedStat.effectiveSetsTotal === 0
                  ? isDark
                    ? '#52525B'
                    : '#A1A1AA'
                  : selectedStat.priorityStatus === 'dominant'
                  ? '#38BDF8'
                  : selectedStat.priorityStatus === 'balanced'
                  ? '#10B981'
                  : isDark
                  ? '#FDE047'
                  : '#FACC15',
              borderTopColor: theme.hairline,
              borderBottomColor: theme.hairline,
            },
          ]}
        >
          <View style={styles.focusHeaderRow}>
            <View style={styles.focusTitleWrap}>
              <RankCrestIcon
                tier={selectedStat.rank}
                size={40}
                progressPct={selectedStat.progressPct}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.focusMuscleName, { color: theme.text }]}>
                  {muscleLabel(selectedStat.meta.id)}
                </Text>
                <Text style={[styles.focusStatusSub, { color: theme.textMuted }]}>
                  {selectedStat.statusLabel} ·{' '}
                  {t('setsTotal30d', {
                    total: Math.round(selectedStat.effectiveSetsTotal),
                    d30: Math.round(selectedStat.effectiveSets30d),
                  })}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => onSelectMuscle(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.focusProgressRow}>
            <View style={[styles.focusTrack, { backgroundColor: theme.bgSecondary }]}>
              <View
                style={[
                  styles.focusFill,
                  {
                    backgroundColor:
                      selectedStat.effectiveSetsTotal === 0
                        ? isDark
                          ? '#52525B'
                          : '#A1A1AA'
                        : selectedStat.priorityStatus === 'dominant'
                        ? '#38BDF8'
                        : selectedStat.priorityStatus === 'balanced'
                        ? '#10B981'
                        : '#F59E0B',
                    width: `${Math.max(
                      0,
                      Math.min(100, Math.round(selectedStat.relativeDevelopmentRatio * 100))
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.focusSetsText, { color: theme.textSecondary }]}>
              {t('balancePct', {
                pct: Math.round(selectedStat.relativeDevelopmentRatio * 100),
              })}
            </Text>
          </View>

          {selectedMuscleExercises.length > 0 && (
            <View style={styles.focusExercisesWrap}>
              {selectedMuscleExercises.slice(0, 4).map((exStat) => (
                <TouchableOpacity
                  key={exStat.exerciseId}
                  style={[styles.focusExPill, { backgroundColor: theme.bgSecondary }]}
                  onPress={() => onPressExercise?.(exStat.exercise)}
                  activeOpacity={0.7}
                >
                  <RankCrestIcon tier={exStat.rank} size={22} />
                  <Text
                    style={[styles.focusExName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {exerciseName(exStat.exercise.id, exStat.exercise.name)}
                  </Text>
                  <Text style={[styles.focusExSets, { color: theme.textMuted }]}>
                    {exStat.totalSets} {t('setsWord')}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.tapHint, { color: theme.textMuted }]}>
          {t('tapMuscleHint')}
        </Text>
      )}

      {/* Fullscreen Interactive Anatomical Zoom Explorer + Side Detail Card */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={[styles.fsRoot, { backgroundColor: theme.bg }]}>
          {/* Subtle architectural blueprint grid background (zero green glow) */}
          <Svg
            width="100%"
            height="100%"
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          >
            <Defs>
              <Pattern
                id="fsSilhouetteGrid"
                width={44}
                height={44}
                patternUnits="userSpaceOnUse"
              >
                <Path
                  d="M 44 0 L 0 0 0 44"
                  fill="none"
                  stroke={isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(24, 24, 27, 0.048)'}
                  strokeWidth={0.9}
                />
                <Circle
                  cx={0}
                  cy={0}
                  r={1.15}
                  fill={isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(24, 24, 27, 0.12)'}
                />
              </Pattern>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#fsSilhouetteGrid)" />
          </Svg>

          {/* Top Floating Controls Bar */}
          <View
            style={[
              styles.fsTopBar,
              {
                paddingTop: Math.max(insets.top + 8, 18),
                borderBottomColor: theme.hairline,
                backgroundColor: isDark ? 'rgba(9, 9, 12, 0.72)' : 'rgba(255, 255, 255, 0.82)',
              },
            ]}
          >
            <View style={styles.fsTitleGroup}>
              <Text style={[styles.fsTitle, { color: theme.text }]}>
                {t('anatomyFullscreenTitle')}
              </Text>
              <Text style={[styles.fsSubTitle, { color: theme.textMuted }]}>
                {viewSide === 'front' ? t('frontSilhouetteCaps') : t('backSilhouetteCaps')}
              </Text>
            </View>

            <View style={styles.fsControlsRight}>
              {selectedMuscle && (
                <TouchableOpacity
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    onSelectMuscle(null);
                  }}
                  style={[
                    styles.fsPillBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(15,23,42,0.07)',
                      borderColor: theme.border,
                    },
                  ]}
                  activeOpacity={0.78}
                >
                  <Ionicons name="contract-outline" size={14} color={theme.text} />
                  <Text style={[styles.fsPillBtnText, { color: theme.text }]}>
                    {t('resetZoomBtn')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => rotateToSide()}
                style={[
                  styles.fsPillBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.1)'
                      : 'rgba(15,23,42,0.07)',
                    borderColor: theme.border,
                  },
                ]}
                activeOpacity={0.78}
              >
                <Ionicons name="sync-outline" size={14} color={theme.text} />
                <Text style={[styles.fsPillBtnText, { color: theme.text }]}>
                  {viewSide === 'front' ? t('viewCounterFront') : t('viewCounterBack')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsFullscreen(false)}
                style={[
                  styles.fsCloseCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(15,23,42,0.08)',
                  },
                ]}
                activeOpacity={0.78}
              >
                <Ionicons name="close" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Main Interactive Zoom Stage */}
          <View {...panResponder.panHandlers} style={styles.fsStageArea}>
            {selectedMuscle && (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => onSelectMuscle(null)}
              />
            )}

            <Animated.View
              style={{
                opacity: flipOpacity,
                transform: [
                  { translateX: fsZoomX },
                  { translateY: fsZoomY },
                  { scale: fsZoomScale },
                  { scaleX: flipScaleX },
                  { scaleY: flipScaleY },
                ],
              }}
            >
              {renderBodySvg(fsSvgW, fsSvgH)}
            </Animated.View>

            {/* Sleek Floating Muscle Detail Card beside the zoomed anatomy */}
            {selectedStat && (
              <Animated.View
                style={[
                  styles.fsDetailCard,
                  {
                    width: Math.min(220, Math.round(screenWidth * 0.56)),
                    maxHeight: Math.round(fsStageH * 0.74),
                    top: Math.max(16, Math.round(fsStageH * 0.14)),
                    backgroundColor: isDark
                      ? 'rgba(17, 17, 22, 0.92)'
                      : 'rgba(255, 255, 255, 0.94)',
                    borderColor: selectedStatusAccent,
                    opacity: fsCardAnim,
                    transform: [
                      {
                        translateX: fsCardAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [34, 0],
                        }),
                      },
                      {
                        scale: fsCardAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View
                  style={[styles.fsCardAccentBar, { backgroundColor: selectedStatusAccent }]}
                />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.fsCardScrollContent}
                >
                  <View style={styles.fsCardHeaderRow}>
                    <RankCrestIcon
                      tier={selectedStat.rank}
                      size={44}
                      progressPct={selectedStat.progressPct}
                      animated
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.fsCardMuscleName, { color: theme.text }]} numberOfLines={2}>
                        {muscleLabel(selectedStat.meta.id)}
                      </Text>
                      <Text style={[styles.fsCardRankTitle, { color: selectedStatusAccent }]}>
                        {rankTitle(selectedStat.rank)}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.fsStatusPill,
                      {
                        backgroundColor: `${selectedStatusAccent}1F`,
                        borderColor: `${selectedStatusAccent}55`,
                      },
                    ]}
                  >
                    <View style={[styles.fsStatusDot, { backgroundColor: selectedStatusAccent }]} />
                    <Text
                      style={[styles.fsStatusPillText, { color: selectedStatusAccent }]}
                      numberOfLines={1}
                    >
                      {selectedStat.statusLabel}
                    </Text>
                  </View>

                  {/* Rank Progress */}
                  <View style={styles.fsProgressBlock}>
                    <View style={styles.fsProgressHeader}>
                      <Text style={[styles.fsProgressLabel, { color: theme.textMuted }]}>
                        {t('rankProgressLabel')}
                      </Text>
                      <Text style={[styles.fsProgressPct, { color: theme.text }]}>
                        {selectedStat.progressPct}%
                      </Text>
                    </View>
                    <View style={[styles.fsProgressTrack, { backgroundColor: theme.bgSecondary }]}>
                      <View
                        style={[
                          styles.fsProgressFill,
                          {
                            backgroundColor: selectedStatusAccent,
                            width: `${Math.max(4, Math.min(100, selectedStat.progressPct))}%`,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Telemetry Metrics Grid */}
                  <View style={styles.fsMetricsGrid}>
                    <View style={[styles.fsMetricBox, { backgroundColor: theme.bgSecondary }]}>
                      <Text style={[styles.fsMetricVal, { color: theme.text }]}>
                        {Math.round(selectedStat.effectiveSetsTotal)}
                      </Text>
                      <Text style={[styles.fsMetricLbl, { color: theme.textMuted }]} numberOfLines={1}>
                        {t('seriesMetricLabel')}
                      </Text>
                    </View>
                    <View style={[styles.fsMetricBox, { backgroundColor: theme.bgSecondary }]}>
                      <Text style={[styles.fsMetricVal, { color: theme.text }]}>
                        {Math.round(selectedStat.effectiveSets30d)}
                      </Text>
                      <Text style={[styles.fsMetricLbl, { color: theme.textMuted }]} numberOfLines={1}>
                        30d
                      </Text>
                    </View>
                    <View style={[styles.fsMetricBox, { backgroundColor: theme.bgSecondary }]}>
                      <Text style={[styles.fsMetricVal, { color: theme.text }]}>
                        {Math.round(selectedStat.relativeDevelopmentRatio * 100)}%
                      </Text>
                      <Text style={[styles.fsMetricLbl, { color: theme.textMuted }]} numberOfLines={1}>
                        {t('balanceMetricLabel')}
                      </Text>
                    </View>
                  </View>

                  {/* Exercises for this muscle */}
                  {fullscreenExercises.length > 0 && (
                    <View style={styles.fsExercisesList}>
                      {fullscreenExercises.slice(0, 4).map((exStat) => (
                        <TouchableOpacity
                          key={exStat.exerciseId}
                          style={[
                            styles.fsExerciseRow,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(15,23,42,0.05)',
                            },
                          ]}
                          onPress={() => {
                            setIsFullscreen(false);
                            onPressExercise?.(exStat.exercise);
                          }}
                          activeOpacity={0.75}
                        >
                          <RankCrestIcon tier={exStat.rank} size={20} />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.fsExerciseName, { color: theme.text }]} numberOfLines={1}>
                              {exerciseName(exStat.exercise.id, exStat.exercise.name)}
                            </Text>
                            <Text style={[styles.fsExerciseSets, { color: theme.textMuted }]}>
                              {exStat.totalSets} {t('setsWord')}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </Animated.View>
            )}

            {/* Bottom hint / Legend inside Fullscreen */}
            {!selectedMuscle && (
              <View
                style={[
                  styles.fsBottomHintWrap,
                  { bottom: Math.max(insets.bottom + 14, 24), pointerEvents: 'none' },
                ]}
              >
                <View
                  style={[
                    styles.fsBottomHintPill,
                    {
                      backgroundColor: isDark
                        ? 'rgba(24,24,28,0.88)'
                        : 'rgba(255,255,255,0.9)',
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons name="search" size={13} color={theme.textSecondary} />
                  <Text style={[styles.fsBottomHintText, { color: theme.textSecondary }]}>
                    {t('tapMuscleToZoomHint')}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  sideHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sideTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sideTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickFlipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  fullscreenBtnChip: {
    width: 30,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideCounterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  swipeZone: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cornerTick: {
    position: 'absolute',
    width: 11,
    height: 11,
    zIndex: 3,
  },
  cornerTL: {
    top: 8,
    left: 8,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopLeftRadius: 3,
  },
  cornerTR: {
    top: 8,
    right: 8,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderTopRightRadius: 3,
  },
  cornerBL: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
    borderBottomLeftRadius: 3,
  },
  cornerBR: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 3,
  },
  stageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tapHint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 6,
  },
  focusStrip: {
    marginTop: 6,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 4,
    borderLeftWidth: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  focusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  focusTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  focusMuscleName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  focusStatusSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  focusProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  focusTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  focusFill: {
    height: 6,
    borderRadius: 3,
  },
  focusSetsText: {
    fontSize: 11,
    fontWeight: '700',
    minWidth: 74,
    textAlign: 'right',
  },
  focusExercisesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  focusExPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    maxWidth: '100%',
  },
  focusExName: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  focusExSets: {
    fontSize: 11,
    fontWeight: '600',
  },
  fsRoot: {
    flex: 1,
  },
  fsTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
  },
  fsTitleGroup: {
    gap: 2,
  },
  fsTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  fsSubTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  fsControlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fsPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fsPillBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  fsCloseCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsStageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fsDetailCard: {
    position: 'absolute',
    right: 12,
    borderRadius: 22,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 14,
  },
  fsCardAccentBar: {
    height: 3.5,
    width: '100%',
  },
  fsCardScrollContent: {
    padding: 13,
    gap: 10,
  },
  fsCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fsCardMuscleName: {
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 18,
  },
  fsCardRankTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  fsStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  fsStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fsStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  fsProgressBlock: {
    gap: 5,
  },
  fsProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fsProgressLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fsProgressPct: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  fsProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fsProgressFill: {
    height: 6,
    borderRadius: 3,
  },
  fsMetricsGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  fsMetricBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 2,
  },
  fsMetricVal: {
    fontSize: 13.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  fsMetricLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fsExercisesList: {
    gap: 6,
  },
  fsExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
  },
  fsExerciseName: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  fsExerciseSets: {
    fontSize: 10,
    fontWeight: '600',
  },
  fsBottomHintWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  fsBottomHintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fsBottomHintText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
