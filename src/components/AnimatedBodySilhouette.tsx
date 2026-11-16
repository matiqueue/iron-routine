import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
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
  onPressExercise?: (exercise: Exercise) => void;
}

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

export const AnimatedBodySilhouette: React.FC<AnimatedBodySilhouetteProps> = React.memo(({
  gender = 'male',
  muscleStatsMap,
  selectedMuscle,
  onSelectMuscle,
  selectedMuscleExercises = [],
  onPressExercise,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, exerciseName } = useLanguage();
  const [viewSide, setViewSide] = useState<SilhouetteViewSide>('front');
  const viewSideRef = useRef<SilhouetteViewSide>('front');
  const isAnimatingRef = useRef(false);

  // Stationary in-place axis rotation animations (ZERO horizontal translation!)
  const flipScaleX = useRef(new Animated.Value(1)).current;
  const flipScaleY = useRef(new Animated.Value(1)).current;
  const flipOpacity = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    viewSideRef.current = viewSide;
  }, [viewSide]);

  useEffect(() => {
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
  }, [floatAnim]);

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

  return (
    <View style={styles.container}>
      {/* Minimalist Side Status Header (no gender label!) */}
      <View style={styles.sideHeaderRow}>
        <View style={styles.sideTagWrap}>
          <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.sideTagText, { color: theme.text }]}>
            {viewSide === 'front' ? t('frontSilhouetteCaps') : t('backSilhouetteCaps')}
          </Text>
        </View>
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
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
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
            <RadialGradient id="silhouetteStageAura" cx="50%" cy="46%" r="54%">
              <Stop
                offset="0%"
                stopColor={isDark ? '#38BDF8' : '#10B981'}
                stopOpacity={isDark ? 0.08 : 0.045}
              />
              <Stop
                offset="65%"
                stopColor="#10B981"
                stopOpacity={isDark ? 0.025 : 0.015}
              />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#silhouetteGrid)" />
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#silhouetteStageAura)" />
        </Svg>

        {/* Minimalist Corner Calibration Ticks */}
        <View
          pointerEvents="none"
          style={[
            styles.cornerTick,
            styles.cornerTL,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)' },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cornerTick,
            styles.cornerTR,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)' },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cornerTick,
            styles.cornerBL,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)' },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.cornerTick,
            styles.cornerBR,
            { borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.14)' },
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
          <Svg width={240} height={415} viewBox={viewBox}>
            <Defs>
              <LinearGradient id={`glow-${viewSide}`} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor="#10B981"
                  stopOpacity={isDark ? 0.11 : 0.06}
                />
                <Stop
                  offset="100%"
                  stopColor="#38BDF8"
                  stopOpacity={0.0}
                />
              </LinearGradient>
            </Defs>

            {/* Subtle Central Axis Reference Line & Ambient Aura */}
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
            <Circle cx={centerX} cy={560} r={275} fill={`url(#glow-${viewSide})`} />

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
  quickFlipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
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
});
