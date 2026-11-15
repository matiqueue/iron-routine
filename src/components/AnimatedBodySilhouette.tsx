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
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
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
): { fill: string; fillOpacity: number; stroke: string; strokeWidth: number } {
  const baseEmpty = isDark ? '#27272A' : '#E4E4E7';
  const baseStroke = isDark ? '#18181B' : '#FAFAFA';

  // Untrained muscles (0 sets) are ALWAYS neutral gray, never red!
  if (!stat || stat.effectiveSetsTotal <= 0 || stat.priorityStatus === 'untrained') {
    if (hasAnySelection && isSelected) {
      return {
        fill: isDark ? '#52525B' : '#A1A1AA',
        fillOpacity: 0.95,
        stroke: isDark ? '#FFFFFF' : '#09090B',
        strokeWidth: 3.2,
      };
    }
    return {
      fill: baseEmpty,
      fillOpacity: hasAnySelection ? 0.35 : 0.78,
      stroke: baseStroke,
      strokeWidth: 1,
    };
  }

  let fill = baseEmpty;
  let fillOpacity = 0.88;

  if (stat.priorityStatus === 'neglected' || stat.priorityStatus === 'lagging') {
    fill = '#F59E0B';
    fillOpacity = 0.88;
  } else if (stat.priorityStatus === 'balanced') {
    fill = '#10B981';
    fillOpacity = isDark ? 0.72 : 0.78;
  } else {
    fill = '#38BDF8';
    fillOpacity = isDark ? 0.85 : 0.88;
  }

  if (hasAnySelection) {
    if (isSelected) {
      return {
        fill,
        fillOpacity: 1,
        stroke: isDark ? '#FFFFFF' : '#09090B',
        strokeWidth: 3.5,
      };
    }
    return {
      fill,
      fillOpacity: Math.max(0.24, fillOpacity * 0.4),
      stroke: baseStroke,
      strokeWidth: 0.8,
    };
  }

  return {
    fill,
    fillOpacity,
    stroke: baseStroke,
    strokeWidth: 1.2,
  };
}

export const AnimatedBodySilhouette: React.FC<AnimatedBodySilhouetteProps> = ({
  gender = 'male',
  muscleStatsMap,
  selectedMuscle,
  onSelectMuscle,
  selectedMuscleExercises = [],
  onPressExercise,
}) => {
  const { theme, isDark } = useAppTheme();
  const [viewSide, setViewSide] = useState<SilhouetteViewSide>('front');
  const viewSideRef = useRef<SilhouetteViewSide>('front');
  const isAnimatingRef = useRef(false);

  // Animations
  const flipScaleX = useRef(new Animated.Value(1)).current;
  const flipOpacity = useRef(new Animated.Value(1)).current;
  const dragOffsetX = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const hintPulseAnim = useRef(new Animated.Value(0)).current;
  const detailBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    viewSideRef.current = viewSide;
  }, [viewSide]);

  // Gentle continuous breathing + swipe arrow nudge animation
  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const hintLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintPulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(hintPulseAnim, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    hintLoop.start();
    return () => {
      floatLoop.stop();
      hintLoop.stop();
    };
  }, [floatAnim, hintPulseAnim]);

  const selectedStat = selectedMuscle ? muscleStatsMap[selectedMuscle] : null;
  useEffect(() => {
    detailBarAnim.setValue(0);
    Animated.timing(detailBarAnim, {
      toValue: selectedStat ? Math.min(100, Math.round(selectedStat.relativeDevelopmentRatio * 100)) : 0,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [selectedMuscle, selectedStat?.relativeDevelopmentRatio, detailBarAnim]);

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

      Animated.parallel([
        Animated.timing(flipScaleX, {
          toValue: 0.08,
          duration: 135,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flipOpacity, {
          toValue: 0.35,
          duration: 135,
          useNativeDriver: true,
        }),
      ]).start(() => {
        viewSideRef.current = next;
        setViewSide(next);
        dragOffsetX.setValue(0);

        Animated.parallel([
          Animated.spring(flipScaleX, {
            toValue: 1,
            friction: 6,
            tension: 75,
            useNativeDriver: true,
          }),
          Animated.timing(flipOpacity, {
            toValue: 1,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start(() => {
          isAnimatingRef.current = false;
        });
      });
    },
    [dragOffsetX, flipOpacity, flipScaleX]
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
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderMove: (_, gestureState) => {
          const clampedDx = Math.max(-48, Math.min(48, gestureState.dx * 0.45));
          dragOffsetX.setValue(clampedDx);
          const scalePreview = Math.max(0.76, 1 - Math.abs(gestureState.dx) / 280);
          flipScaleX.setValue(scalePreview);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 28 || Math.abs(gestureState.vx) > 0.35) {
            rotateToSide();
          } else {
            Animated.parallel([
              Animated.spring(dragOffsetX, {
                toValue: 0,
                useNativeDriver: true,
              }),
              Animated.spring(flipScaleX, {
                toValue: 1,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(dragOffsetX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(flipScaleX, {
              toValue: 1,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [dragOffsetX, flipScaleX, rotateToSide]
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
    outputRange: [0, -4],
  });

  const leftArrowShift = hintPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const rightArrowShift = hintPulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  const inertFill = isDark ? '#18181B' : '#F4F4F5';
  const outlineStroke = isDark ? '#3F3F46' : '#D4D4D8';

  const isFemale = gender === 'female';
  const parts: BodyPartVector[] =
    viewSide === 'front'
      ? isFemale
        ? BODY_FEMALE_FRONT_PARTS
        : BODY_FRONT_PARTS
      : isFemale
      ? BODY_FEMALE_BACK_PARTS
      : BODY_BACK_PARTS;

  const viewBox =
    viewSide === 'front'
      ? isFemale
        ? '-50 50 734 1390'
        : '0 80 724 1320'
      : isFemale
      ? '756 50 774 1390'
      : '724 80 724 1320';

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
        ? 317
        : 362
      : isFemale
      ? 1143
      : 1086;

  const activityLegend = useMemo(
    () => [
      { label: 'Brak serii (0)', color: isDark ? '#3F3F46' : '#D4D4D8' },
      { label: 'Niska objętość', color: '#F59E0B' },
      { label: 'W balansie', color: '#10B981' },
      { label: 'Dominuje', color: '#38BDF8' },
    ],
    [isDark]
  );

  return (
    <View style={styles.container}>
      {/* Minimalist Side Status Header */}
      <View style={styles.sideHeaderRow}>
        <View style={styles.sideTagWrap}>
          <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
          <Text style={[styles.sideTagText, { color: theme.text }]}>
            {viewSide === 'front' ? 'PRZÓD SYLWETKI' : 'TYŁ SYLWETKI'}
          </Text>
        </View>
        <Text style={[styles.sideCounterText, { color: theme.textMuted }]}>
          {isFemale ? 'Model Kobiecy' : 'Model Męski'} · {viewSide === 'front' ? '1 / 2' : '2 / 2'}
        </Text>
      </View>

      {/* Interactive Swipe-to-Rotate Silhouette Stage */}
      <View {...panResponder.panHandlers} style={styles.swipeZone}>
        <Animated.View
          style={[
            styles.stageWrap,
            {
              opacity: flipOpacity,
              transform: [
                { translateX: dragOffsetX },
                { scaleX: flipScaleX },
                { translateY },
              ],
            },
          ]}
        >
          <Svg width={235} height={410} viewBox={viewBox}>
            <Defs>
              <LinearGradient id={`glow-${viewSide}`} x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0%"
                  stopColor="#10B981"
                  stopOpacity={isDark ? 0.09 : 0.05}
                />
                <Stop
                  offset="100%"
                  stopColor="#38BDF8"
                  stopOpacity={0.0}
                />
              </LinearGradient>
            </Defs>

            <Circle cx={centerX} cy={540} r={260} fill={`url(#glow-${viewSide})`} />

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
                            fillOpacity={0.65}
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
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ) : null}
          </Svg>
        </Animated.View>

        {/* Animated Swipe Prompt */}
        <TouchableOpacity
          style={styles.swipePromptBtn}
          onPress={() => rotateToSide()}
          activeOpacity={0.7}
        >
          <Animated.View style={{ transform: [{ translateX: leftArrowShift }] }}>
            <Ionicons name="chevron-back" size={14} color={theme.textMuted} />
          </Animated.View>
          <Ionicons name="sync-outline" size={13} color={theme.textSecondary} />
          <Text style={[styles.swipePromptText, { color: theme.textSecondary }]}>
            Przesuń w bok, aby obrócić ({viewSide === 'front' ? 'Pokaż tył' : 'Pokaż przód'})
          </Text>
          <Animated.View style={{ transform: [{ translateX: rightArrowShift }] }}>
            <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Minimalist Open Legend Strip */}
      <View style={styles.legendRow}>
        {activityLegend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
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
                  : '#F59E0B',
              borderTopColor: theme.hairline,
              borderBottomColor: theme.hairline,
            },
          ]}
        >
          <View style={styles.focusHeaderRow}>
            <View style={styles.focusTitleWrap}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.focusMuscleName, { color: theme.text }]}>
                  {selectedStat.meta.label}
                </Text>
                <Text style={[styles.focusStatusSub, { color: theme.textMuted }]}>
                  {selectedStat.statusLabel} · {Math.round(selectedStat.effectiveSetsTotal)} serii łącznie ({Math.round(selectedStat.effectiveSets30d)} w 30 dni)
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
              <Animated.View
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
                    width: detailBarAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.focusSetsText, { color: theme.textSecondary }]}>
              {Math.round(selectedStat.relativeDevelopmentRatio * 100)}% balansu
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
                  <Text
                    style={[styles.focusExName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {exStat.exercise.name}
                  </Text>
                  <Text style={[styles.focusExSets, { color: theme.textMuted }]}>
                    {exStat.totalSets} serii
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.tapHint, { color: theme.textMuted }]}>
          Dotknij dowolnego mięśnia na sylwetce, aby zobaczyć bilans objętości i ćwiczenia
        </Text>
      )}
    </View>
  );
};

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
  sideCounterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  swipeZone: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  stageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipePromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  swipePromptText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSwatch: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tapHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  focusStrip: {
    marginTop: 10,
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
    letterSpacing: -0.2,
  },
  focusStatusSub: {
    fontSize: 12,
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
    borderRadius: 999,
    overflow: 'hidden',
  },
  focusFill: {
    height: '100%',
    borderRadius: 999,
  },
  focusSetsText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  focusExercisesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  focusExPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '100%',
  },
  focusExName: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  focusExSets: {
    fontSize: 11,
    fontWeight: '700',
  },
});
