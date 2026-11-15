import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { Exercise, MuscleSubGroupId } from '../types/workout';
import {
  BODY_BACK_PARTS,
  BODY_FRONT_PARTS,
  BODY_OUTLINE_BACK,
  BODY_OUTLINE_FRONT,
  BodyPartVector,
} from '../data/bodySilhouettePaths';
import { MUSCLE_SUBGROUP_MAP } from '../data/muscleMap';
import { ExerciseRankStat, MuscleRankStat } from '../services/muscleAnalytics';

export type SilhouetteColorMode = 'priority' | 'ranks';
export type SilhouetteViewSide = 'both' | 'front' | 'back';

export interface EnrichedExerciseRankStat extends ExerciseRankStat {
  exercise: Exercise;
}

interface AnimatedBodySilhouetteProps {
  muscleStatsMap: Record<MuscleSubGroupId, MuscleRankStat>;
  colorMode: SilhouetteColorMode;
  onChangeColorMode: (mode: SilhouetteColorMode) => void;
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
  muscleStatsMap: Record<MuscleSubGroupId, MuscleRankStat>,
  colorMode: SilhouetteColorMode
): MuscleSubGroupId | null {
  if (INERT_SLUGS.has(slug)) return null;

  if (side === 'front') {
    switch (slug) {
      case 'chest': {
        const upper = muscleStatsMap.upper_chest;
        const mid = muscleStatsMap.mid_lower_chest;
        if (!upper || !mid) return 'mid_lower_chest';
        if (colorMode === 'priority') {
          return upper.relativeDevelopmentRatio <= mid.relativeDevelopmentRatio
            ? 'upper_chest'
            : 'mid_lower_chest';
        }
        return upper.effectiveSetsTotal > mid.effectiveSetsTotal
          ? 'upper_chest'
          : 'mid_lower_chest';
      }
      case 'deltoids': {
        const front = muscleStatsMap.front_delts;
        const sideDelt = muscleStatsMap.side_delts;
        if (!front || !sideDelt) return 'side_delts';
        if (colorMode === 'priority') {
          return sideDelt.relativeDevelopmentRatio <= front.relativeDevelopmentRatio
            ? 'side_delts'
            : 'front_delts';
        }
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
  colorMode: SilhouetteColorMode,
  isSelected: boolean,
  hasAnySelection: boolean,
  isDark: boolean
): { fill: string; fillOpacity: number; stroke: string; strokeWidth: number } {
  const baseEmpty = isDark ? '#27272A' : '#E4E4E7';
  const baseStroke = isDark ? '#18181B' : '#FAFAFA';

  if (!stat) {
    return {
      fill: baseEmpty,
      fillOpacity: 0.7,
      stroke: baseStroke,
      strokeWidth: 1,
    };
  }

  let fill = baseEmpty;
  let fillOpacity = 0.88;

  if (colorMode === 'priority') {
    if (stat.priorityStatus === 'neglected') {
      fill = '#F43F5E';
      fillOpacity = 0.92;
    } else if (stat.priorityStatus === 'lagging') {
      fill = '#F59E0B';
      fillOpacity = 0.86;
    } else if (stat.priorityStatus === 'balanced') {
      fill = '#10B981';
      fillOpacity = isDark ? 0.55 : 0.65;
    } else {
      fill = '#38BDF8';
      fillOpacity = isDark ? 0.65 : 0.75;
    }
  } else {
    if (stat.rank === 'F') {
      fill = isDark ? '#27272A' : '#D4D4D8';
      fillOpacity = 0.65;
    } else {
      fill = stat.rankMeta.color;
      fillOpacity = 0.9;
    }
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
      fillOpacity: Math.max(0.22, fillOpacity * 0.38),
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
  muscleStatsMap,
  colorMode,
  onChangeColorMode,
  selectedMuscle,
  onSelectMuscle,
  selectedMuscleExercises = [],
  onPressExercise,
}) => {
  const { theme, isDark } = useAppTheme();
  const [viewSide, setViewSide] = useState<SilhouetteViewSide>('both');

  // Animations
  const flipAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const detailBarAnim = useRef(new Animated.Value(0)).current;

  // Gentle continuous breathing animation for the silhouette
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  const selectedStat = selectedMuscle ? muscleStatsMap[selectedMuscle] : null;
  useEffect(() => {
    detailBarAnim.setValue(0);
    Animated.timing(detailBarAnim, {
      toValue: selectedStat ? selectedStat.progressPct : 0,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [selectedMuscle, selectedStat?.progressPct, detailBarAnim]);

  useEffect(() => {
    if (!selectedMuscle || viewSide === 'both') return;
    const meta = MUSCLE_SUBGROUP_MAP[selectedMuscle];
    if (!meta) return;
    if (meta.side === 'front' && viewSide === 'back') {
      triggerSideTransition('front');
    } else if (meta.side === 'back' && viewSide === 'front') {
      triggerSideTransition('back');
    }
  }, [selectedMuscle]);

  const triggerSideTransition = (nextSide: SilhouetteViewSide) => {
    if (nextSide === viewSide) return;
    try {
      Haptics.selectionAsync();
    } catch {}

    flipAnim.setValue(0.84);
    slideAnim.setValue(10);
    setViewSide(nextSide);

    Animated.parallel([
      Animated.spring(flipAnim, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

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

  const inertFill = isDark ? '#18181B' : '#F4F4F5';
  const outlineStroke = isDark ? '#3F3F46' : '#D4D4D8';

  const renderSingleBody = (side: 'front' | 'back', svgWidth: number, svgHeight: number) => {
    const parts: BodyPartVector[] = side === 'front' ? BODY_FRONT_PARTS : BODY_BACK_PARTS;
    const viewBox = side === 'front' ? '0 80 724 1320' : '724 80 724 1320';
    const outlinePath = side === 'front' ? BODY_OUTLINE_FRONT : BODY_OUTLINE_BACK;
    const centerX = side === 'front' ? 362 : 1086;

    return (
      <View style={styles.singleBodyCol}>
        <Svg width={svgWidth} height={svgHeight} viewBox={viewBox}>
          <Defs>
            <LinearGradient id={`glow-${side}`} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0%"
                stopColor={colorMode === 'priority' ? '#F43F5E' : theme.text}
                stopOpacity={isDark ? 0.08 : 0.05}
              />
              <Stop
                offset="100%"
                stopColor={colorMode === 'priority' ? '#F59E0B' : theme.text}
                stopOpacity={0.0}
              />
            </LinearGradient>
          </Defs>

          <Circle cx={centerX} cy={540} r={250} fill={`url(#glow-${side})`} />

          {parts.map((part) => {
            const isInert = INERT_SLUGS.has(part.slug);
            const allSides: Array<{ key: string; list: string[] }> = [
              { key: 'common', list: part.path.common || [] },
              { key: 'left', list: part.path.left || [] },
              { key: 'right', list: part.path.right || [] },
            ];

            return (
              <G key={`${side}-${part.slug}`}>
                {allSides.map(({ key, list }) =>
                  list.map((d, idx) => {
                    if (isInert) {
                      return (
                        <Path
                          key={`${side}-${part.slug}-${key}-${idx}`}
                          d={d}
                          fill={inertFill}
                          fillOpacity={0.65}
                        />
                      );
                    }

                    const muscleId = resolveMuscleIdForPath(
                      side,
                      part.slug,
                      idx,
                      muscleStatsMap,
                      colorMode
                    );

                    const isSelected = Boolean(
                      selectedMuscle &&
                        (selectedMuscle === muscleId ||
                          (part.slug === 'chest' &&
                            (selectedMuscle === 'upper_chest' ||
                              selectedMuscle === 'mid_lower_chest')) ||
                          (side === 'front' &&
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
                      colorMode,
                      isSelected,
                      Boolean(selectedMuscle),
                      isDark
                    );

                    return (
                      <Path
                        key={`${side}-${part.slug}-${key}-${idx}`}
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

        <Text style={[styles.sideCaption, { color: theme.textMuted }]}>
          {side === 'front' ? 'PRZÓD' : 'TYŁ'}
        </Text>
      </View>
    );
  };

  const priorityLegend = useMemo(
    () => [
      { label: 'Brak / Pilne', color: '#F43F5E' },
      { label: 'Odstaje', color: '#F59E0B' },
      { label: 'W balansie', color: '#10B981' },
      { label: 'Dominuje', color: '#38BDF8' },
    ],
    []
  );

  const rankLegend = useMemo(
    () => [
      { label: 'F-E', color: '#71717A' },
      { label: 'D', color: '#38BDF8' },
      { label: 'C', color: '#10B981' },
      { label: 'B-A', color: '#F59E0B' },
      { label: 'S / S+', color: '#A855F7' },
    ],
    []
  );

  return (
    <View style={styles.container}>
      {/* Top Minimalist Controls Row (No heavy borders) */}
      <View style={styles.controlsRow}>
        <View style={[styles.pillGroup, { backgroundColor: theme.bgSecondary }]}>
          <TouchableOpacity
            style={[
              styles.pillBtn,
              colorMode === 'priority' && { backgroundColor: theme.text },
            ]}
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
              onChangeColorMode('priority');
            }}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: colorMode === 'priority' ? '#F43F5E' : theme.textMuted },
              ]}
            />
            <Text
              style={[
                styles.pillBtnText,
                { color: colorMode === 'priority' ? theme.bg : theme.textMuted },
              ]}
            >
              Co teraz robić
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.pillBtn,
              colorMode === 'ranks' && { backgroundColor: theme.text },
            ]}
            onPress={() => {
              try {
                Haptics.selectionAsync();
              } catch {}
              onChangeColorMode('ranks');
            }}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.pillBtnText,
                { color: colorMode === 'ranks' ? theme.bg : theme.textMuted },
              ]}
            >
              Rangi F-S+
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.pillGroup, { backgroundColor: theme.bgSecondary }]}>
          {(
            [
              { id: 'both', label: 'Oba' },
              { id: 'front', label: 'Przód' },
              { id: 'back', label: 'Tył' },
            ] as const
          ).map((item) => {
            const active = viewSide === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.sideBtn, active && { backgroundColor: theme.card }]}
                onPress={() => triggerSideTransition(item.id)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.sideBtnText,
                    { color: active ? theme.text : theme.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Open Animated Silhouette Stage */}
      <Animated.View
        style={[
          styles.stageWrap,
          {
            opacity: flipAnim,
            transform: [
              { scaleX: flipAnim },
              { translateY: Animated.add(slideAnim, translateY) },
            ],
          },
        ]}
      >
        {viewSide === 'both' ? (
          <View style={styles.dualStageRow}>
            {renderSingleBody('front', 158, 305)}
            {renderSingleBody('back', 158, 305)}
          </View>
        ) : viewSide === 'front' ? (
          <View style={styles.singleStageCenter}>
            {renderSingleBody('front', 215, 390)}
          </View>
        ) : (
          <View style={styles.singleStageCenter}>
            {renderSingleBody('back', 215, 390)}
          </View>
        )}
      </Animated.View>

      {/* Minimalist Open Legend Strip */}
      <View style={styles.legendRow}>
        {(colorMode === 'priority' ? priorityLegend : rankLegend).map((item) => (
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
              borderLeftColor: selectedStat.rankMeta.color,
              borderTopColor: theme.hairline,
              borderBottomColor: theme.hairline,
            },
          ]}
        >
          <View style={styles.focusHeaderRow}>
            <View style={styles.focusTitleWrap}>
              <Text
                style={[
                  styles.focusRankLetter,
                  { color: selectedStat.rankMeta.color },
                ]}
              >
                {selectedStat.rank}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.focusMuscleName, { color: theme.text }]}>
                  {selectedStat.meta.label}
                </Text>
                <Text style={[styles.focusStatusSub, { color: theme.textMuted }]}>
                  {selectedStat.rankMeta.title} · {selectedStat.statusLabel}
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
                    backgroundColor: selectedStat.rankMeta.color,
                    width: detailBarAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={[styles.focusSetsText, { color: theme.textSecondary }]}>
              {Math.round(selectedStat.effectiveSetsTotal)} serii
              {selectedStat.nextTier ? ` (+${selectedStat.setsToNext} do ${selectedStat.nextTier})` : ''}
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
                    style={[
                      styles.focusExRank,
                      { color: exStat.rankMeta.color },
                    ]}
                  >
                    {exStat.rank}
                  </Text>
                  <Text
                    style={[styles.focusExName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {exStat.exercise.name}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text style={[styles.tapHint, { color: theme.textMuted }]}>
          Dotknij dowolnego mięśnia na sylwetce, aby sprawdzić rangę i ćwiczenia
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
    paddingBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: 3,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sideBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sideBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stageWrap: {
    paddingVertical: 6,
  },
  dualStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  singleStageCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleBodyCol: {
    alignItems: 'center',
  },
  sideCaption: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 2,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
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
  focusRankLetter: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  focusMuscleName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  focusStatusSub: {
    fontSize: 12,
    marginTop: 1,
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
  focusExRank: {
    fontSize: 12,
    fontWeight: '900',
  },
  focusExName: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
