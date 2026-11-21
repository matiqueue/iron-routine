import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SmartScrollView } from '../components/SmartScrollView';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import {
  DayPlan,
  DayProgress,
  Exercise,
  HealthDailySummary,
  PRRecord,
  UserProfile,
  WorkoutPlan,
} from '../types/workout';
import { getDayBannerTagMeta, resolveDayBannerTag } from '../data/dayTags';
import {
  countCompletedSetsInProgress,
  resolveActiveSessionExercises,
} from '../utils/sessionExercises';
import { triggerSelectionHaptic } from '../services/haptics';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { DayBannerArtwork } from '../components/DayBannerArtwork';
import { DayExercisePreviewList } from '../components/DayExercisePreviewList';
import { HoldToStartButton } from '../components/HoldToStartButton';
import { BottomSheetScrollView, InteractiveBottomSheet } from '../components/InteractiveBottomSheet';
import { MinimalistBackdrop } from '../components/MinimalistBackdrop';
import { RestDayView } from '../components/RestDayView';

interface TodayScreenProps {
  activeProfile: UserProfile;
  activePlan: WorkoutPlan | null;
  planDays: DayPlan[];
  todayDayId: string;
  suggestedDayId: string;
  suggestedReason: 'paused' | 'next_in_sequence' | 'scheduled_today' | 'first_workout' | 'rest';
  currentPlan: DayPlan;
  dayProgress: DayProgress;
  weekProgressMap: Record<string, DayProgress>;
  streak: number;
  bestPRs: { [exerciseId: string]: PRRecord };
  healthSummary: HealthDailySummary | null;
  isHealthLoading?: boolean;
  onRefreshHealth?: () => void;
  onConnectHealth: () => void;
  onConfigureSession?: () => void;
  onOpenPlanManager: () => void;
  onOpenBodyStats: () => void;
  onSelectWorkoutDay: (dayId: string) => void;
  onStartWorkout: (dayId?: string) => void;
  onOpenExerciseDetail: (ex: Exercise) => void;
  onSwitchToPlanTab: () => void;
}

const AnimatedMiniBar: React.FC<{
  pct: number;
  color: string;
  trackColor: string;
  delayMs?: number;
}> = React.memo(({ pct, color, trackColor }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={[styles.miniBarTrack, { backgroundColor: trackColor }]}>
      <View
        style={[
          styles.miniBarFill,
          {
            backgroundColor: color,
            width: `${clamped}%`,
          },
        ]}
      />
    </View>
  );
});

export const TodayScreen: React.FC<TodayScreenProps> = ({
  activeProfile,
  activePlan,
  planDays,
  todayDayId,
  suggestedDayId,
  suggestedReason,
  currentPlan,
  dayProgress,
  weekProgressMap,
  streak,
  bestPRs,
  healthSummary,
  isHealthLoading = false,
  onRefreshHealth,
  onConnectHealth,
  onOpenPlanManager,
  onOpenBodyStats,
  onSelectWorkoutDay,
  onStartWorkout,
  onOpenExerciseDetail,
  onSwitchToPlanTab,
}) => {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const { t, dayLabel, dayTagLabel, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const dateLocale = localeCode;

  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const heroSlideX = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(1)).current;

  const workoutDaysInSequence = useMemo(
    () =>
      planDays.filter(
        (d) => d.type !== 'rest' && d.type !== 'walk' && (d.exercises?.length || 0) > 0
      ),
    [planDays]
  );

  const todayPlanMeta = useMemo(
    () => planDays.find((d) => d.id === todayDayId),
    [planDays, todayDayId]
  );
  const isTodayScheduledRest =
    todayPlanMeta && (todayPlanMeta.type === 'rest' || todayPlanMeta.type === 'walk');

  const currentSeqIdx = useMemo(
    () => workoutDaysInSequence.findIndex((d) => d.id === currentPlan.id),
    [workoutDaysInSequence, currentPlan.id]
  );

  const animateSwitchWorkout = useCallback(
    (targetDayId: string, direction: -1 | 0 | 1) => {
      if (targetDayId === currentPlan.id) return;
      triggerSelectionHaptic();
      onSelectWorkoutDay(targetDayId);
      if (direction === 0) return;
      heroSlideX.setValue(direction * 22);
      heroFade.setValue(0.35);
      Animated.parallel([
        Animated.timing(heroSlideX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(heroFade, {
          toValue: 1,
          duration: 190,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [currentPlan.id, onSelectWorkoutDay, heroSlideX, heroFade]
  );

  const stepSequence = useCallback(
    (delta: -1 | 1) => {
      const len = workoutDaysInSequence.length;
      if (len <= 1) return;
      const baseIdx = currentSeqIdx >= 0 ? currentSeqIdx : 0;
      const nextIdx = (baseIdx + delta + len) % len;
      animateSwitchWorkout(workoutDaysInSequence[nextIdx].id, delta);
    },
    [workoutDaysInSequence, currentSeqIdx, animateSwitchWorkout]
  );

  const stepSequenceRef = useRef(stepSequence);
  stepSequenceRef.current = stepSequence;
  const hasMultipleWorkoutsRef = useRef(workoutDaysInSequence.length > 1);
  hasMultipleWorkoutsRef.current = workoutDaysInSequence.length > 1;

  const heroSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        hasMultipleWorkoutsRef.current &&
        Math.abs(g.dx) > 16 &&
        Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -34) {
          stepSequenceRef.current(1);
        } else if (g.dx > 34) {
          stepSequenceRef.current(-1);
        }
      },
    })
  ).current;

  const bannerTag = resolveDayBannerTag(currentPlan);
  const tagMeta = getDayBannerTagMeta(bannerTag);
  const firstName = activeProfile?.name?.trim().split(' ')[0] || t('athleteFallback');
  const skippedIds = dayProgress.sessionConfig?.skippedIds || [];

  const { ordered: sessionPreviewExercises, active: activePreviewList } = useMemo(
    () => resolveActiveSessionExercises(currentPlan.exercises || [], dayProgress.sessionConfig),
    [currentPlan.exercises, dayProgress.sessionConfig]
  );

  const totalExercises = sessionPreviewExercises.length;
  const activeExercisesCount = activePreviewList.length;
  const totalSets = useMemo(
    () => activePreviewList.reduce((acc, e) => acc + e.sets, 0),
    [activePreviewList]
  );

  const completedSetsToday = useMemo(() => {
    let count = 0;
    for (const ex of activePreviewList) {
      const setsMap = dayProgress.sets?.[ex.id] || {};
      count += Object.values(setsMap).filter((s) => s?.completed).length;
    }
    return count;
  }, [activePreviewList, dayProgress.sets]);

  const isRestOrWalk = currentPlan.type === 'rest' || currentPlan.type === 'walk';
  const isCurrentDayPaused =
    !isRestOrWalk && !dayProgress.finishedAt && completedSetsToday > 0;

  const glassSurfaceBg = isDark
    ? 'rgba(39, 39, 42, 0.62)'
    : 'rgba(244, 244, 245, 0.84)';
  const glassSurfaceBorder = isDark
    ? 'rgba(255, 255, 255, 0.11)'
    : 'rgba(24, 24, 27, 0.08)';

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <MinimalistBackdrop
        variant="diagonal"
        showCornerGlows={false}
      />
      <SmartScrollView
        style={[styles.tabScroll, { backgroundColor: 'transparent' }]}
        contentContainerStyle={[
          styles.tabContent,
          { paddingTop: Math.max(insets.top + 8, 18) },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* Open Editorial Header with Glassmorphic Action Pills */}
      <View style={styles.topHeader}>
        <View style={styles.greetingCol}>
          <Text style={[styles.dateLabel, { color: theme.textMuted }]} numberOfLines={1}>
            {new Date()
              .toLocaleDateString(dateLocale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
              .toUpperCase()}
          </Text>
          <Text
            style={[styles.greeting, { color: theme.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {t('greetingHello', { name: firstName })}
          </Text>
        </View>

        {/* Right Actions: Glassmorphic Theme Toggle + Active Plan Switcher Pill */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              {
                backgroundColor: glassSurfaceBg,
                borderColor: glassSurfaceBorder,
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              toggleTheme();
            }}
            activeOpacity={0.7}
            accessibilityLabel={t('switchThemeA11y')}
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={17}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.planPill,
              {
                backgroundColor: glassSurfaceBg,
                borderColor: glassSurfaceBorder,
              },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              onOpenPlanManager();
            }}
            activeOpacity={0.75}
            accessibilityLabel={t('switchPlanA11y')}
          >
            <Ionicons name="layers-outline" size={14} color={theme.text} />
            <Text style={[styles.planPillText, { color: theme.text }]} numberOfLines={1}>
              {activePlan?.name || t('choosePlanBtn')}
            </Text>
            <Ionicons name="chevron-down" size={13} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Open Telemetry & Streak Strip (No Card Box - Editorial Hairline Layout) */}
      <View
        style={[
          styles.openStreakStrip,
          {
            borderTopColor: theme.hairline,
            borderBottomColor: theme.hairline,
          },
        ]}
      >
        <View style={styles.streakLeftBlock}>
          <View
            style={[
              styles.flameGlassOrb,
              {
                backgroundColor:
                  streak > 0
                    ? 'rgba(245, 158, 11, 0.14)'
                    : glassSurfaceBg,
                borderColor:
                  streak > 0
                    ? 'rgba(245, 158, 11, 0.32)'
                    : glassSurfaceBorder,
              },
            ]}
          >
            <AnimatedIcon
              name="flame"
              preset="flame"
              size={24}
              color={streak > 0 ? '#F59E0B' : theme.textMuted}
              active={streak > 0}
            />
          </View>
          <View style={styles.streakTextCol}>
            <Text style={[styles.streakEyebrow, { color: theme.textMuted }]}>
              {t('trainingRegularityKicker')}
            </Text>
            <Text style={[styles.streakTitle, { color: theme.text }]} numberOfLines={1}>
              {streak} {streak === 1 ? t('streakDayOne') : t('streakDaysMany')}
            </Text>
          </View>
        </View>

        <View style={styles.streakRightTelemetry}>
          {!isRestOrWalk && totalSets > 0 && (
            <>
              <View style={styles.telemetryMiniCol}>
                <Text style={[styles.telemetryMiniVal, { color: theme.text }]}>
                  {completedSetsToday}/{totalSets}
                </Text>
                <Text style={[styles.telemetryMiniLabel, { color: theme.textMuted }]}>
                  {t('setsTodayLabel')}
                </Text>
              </View>
              <View style={[styles.verticalHairline, { backgroundColor: theme.hairline }]} />
            </>
          )}

          <TouchableOpacity
            style={styles.telemetryWeightBtn}
            onPress={() => {
              triggerSelectionHaptic();
              onOpenBodyStats();
            }}
            activeOpacity={0.75}
          >
            <Text style={[styles.telemetryMiniVal, { color: theme.text }]}>
              {activeProfile?.weight ? `${activeProfile.weight} kg` : '-- kg'}
            </Text>
            <View style={styles.telemetryWeightSubRow}>
              <Text style={[styles.telemetryMiniLabel, { color: '#38BDF8' }]}>
                {t('weightShort')}
              </Text>
              <Ionicons name="chevron-forward" size={10} color="#38BDF8" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rest / Active Recovery Day View or Workout Day (Clean Original Layout + Integrated Hero Sequence Control) */}
      {isRestOrWalk ? (
        <>
          <RestDayView dayPlan={currentPlan} />
          {workoutDaysInSequence.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                const targetId =
                  workoutDaysInSequence.some((d) => d.id === suggestedDayId)
                    ? suggestedDayId
                    : workoutDaysInSequence[0].id;
                animateSwitchWorkout(targetId, 1);
              }}
              activeOpacity={0.82}
              style={[
                styles.backToQueueBtn,
                {
                  backgroundColor: glassSurfaceBg,
                  borderColor: glassSurfaceBorder,
                },
              ]}
            >
              <Ionicons name="barbell-outline" size={16} color="#38BDF8" />
              <Text style={[styles.backToQueueText, { color: theme.text }]}>
                {t('backToWorkoutQueue')}
              </Text>
              <Ionicons name="arrow-forward" size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
          <OpenBiometricsAndRecoverySection
            weight={activeProfile?.weight}
            height={activeProfile?.height}
            summary={healthSummary}
            isWorkoutDay={false}
            isLoading={isHealthLoading}
            onOpenBodyStats={onOpenBodyStats}
            onRefresh={onRefreshHealth}
            onConnect={onConnectHealth}
          />
        </>
      ) : (
        <>
          {/* PRESERVED: Iconic Hero Banner Card — now swipeable with integrated sequence pill & split progress bar */}
          <View
            {...heroSwipePanResponder.panHandlers}
            style={[
              styles.heroCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
              <DayBannerArtwork tag={bannerTag} />
            </View>

            <Animated.View
              style={[
                styles.heroInner,
                {
                  opacity: heroFade,
                  transform: [{ translateX: heroSlideX }],
                },
              ]}
            >
              {/* Top Row: Tag + Status on left, Compact Integrated Sequence Stepper on right */}
              <View style={styles.heroTopHeaderRow}>
                <View style={styles.heroTagRow}>
                  <View style={[styles.heroTagPill, { backgroundColor: theme.primary }]}>
                    <AnimatedIcon
                      name={tagMeta.icon as any}
                      preset={
                        currentPlan.type === 'rest'
                          ? 'moon'
                          : currentPlan.type === 'walk'
                          ? 'footsteps'
                          : 'barbell'
                      }
                      size={12}
                      color={theme.primaryText}
                      active
                    />
                    <Text style={[styles.heroTagText, { color: theme.primaryText }]}>
                      {dayTagLabel(bannerTag, tagMeta.label).toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.heroDayStatusPill,
                      {
                        backgroundColor: isCurrentDayPaused
                          ? 'rgba(245, 158, 11, 0.16)'
                          : dayProgress.finishedAt
                          ? 'rgba(16, 185, 129, 0.16)'
                          : currentPlan.id === suggestedDayId && suggestedReason !== 'rest'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : glassSurfaceBg,
                        borderColor: isCurrentDayPaused
                          ? 'rgba(245, 158, 11, 0.42)'
                          : dayProgress.finishedAt
                          ? 'rgba(16, 185, 129, 0.42)'
                          : currentPlan.id === suggestedDayId && suggestedReason !== 'rest'
                          ? 'rgba(56, 189, 248, 0.38)'
                          : glassSurfaceBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.heroDayStatusText,
                        {
                          color: isCurrentDayPaused
                            ? '#F59E0B'
                            : dayProgress.finishedAt
                            ? '#10B981'
                            : currentPlan.id === suggestedDayId && suggestedReason !== 'rest'
                            ? '#38BDF8'
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      {dayLabel(currentPlan.id, true).toUpperCase()}
                      {isCurrentDayPaused
                        ? ` · ${t('sequencePausedBadge')}`
                        : dayProgress.finishedAt
                        ? ` · ${t('sequenceDoneBadge')}`
                        : currentPlan.id === suggestedDayId && suggestedReason !== 'rest'
                        ? ` · ${t('sequenceNextBadge')}`
                        : ''}
                    </Text>
                  </View>
                </View>

                {workoutDaysInSequence.length > 1 && (
                  <View
                    style={[
                      styles.heroStepperPill,
                      {
                        backgroundColor: glassSurfaceBg,
                        borderColor: glassSurfaceBorder,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => stepSequence(-1)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 4 }}
                      style={styles.heroStepperArrowBtn}
                      activeOpacity={0.65}
                    >
                      <Ionicons name="chevron-back" size={14} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        triggerSelectionHaptic();
                        setShowQueueSheet(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                      style={styles.heroStepperCenterBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.heroStepperText, { color: theme.text }]}>
                        {(currentSeqIdx >= 0 ? currentSeqIdx : 0) + 1}/{workoutDaysInSequence.length}
                      </Text>
                      <Ionicons name="chevron-down" size={11} color={theme.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => stepSequence(1)}
                      hitSlop={{ top: 10, bottom: 10, left: 4, right: 10 }}
                      style={styles.heroStepperArrowBtn}
                      activeOpacity={0.65}
                    >
                      <Ionicons name="chevron-forward" size={14} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={[styles.heroTitle, { color: theme.text }]}>{currentPlan.name}</Text>

              {currentPlan.subtitle ? (
                <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                  {currentPlan.subtitle}
                </Text>
              ) : null}

              {totalExercises > 0 && (
                <View style={styles.heroMetaLine}>
                  <View
                    style={[
                      styles.heroMetaBadge,
                      {
                        backgroundColor: glassSurfaceBg,
                        borderColor: glassSurfaceBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.heroMetaText, { color: theme.text }]}>
                      {t('exercisesCountText', { count: totalExercises })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroMetaBadge,
                      {
                        backgroundColor: glassSurfaceBg,
                        borderColor: glassSurfaceBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.heroMetaText, { color: theme.text }]}>
                      {totalSets} {t('setsWord')}
                    </Text>
                  </View>
                  {currentPlan.time ? (
                    <View
                      style={[
                        styles.heroMetaBadge,
                        {
                          backgroundColor: glassSurfaceBg,
                          borderColor: glassSurfaceBorder,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        },
                      ]}
                    >
                      <Ionicons name="time-outline" size={11} color={theme.textSecondary} />
                      <Text style={[styles.heroMetaText, { color: theme.text }]}>
                        {currentPlan.time}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Ultra-clean segmented split sequence progress bar at bottom edge of Hero Card */}
              {workoutDaysInSequence.length > 1 && (
                <View style={styles.heroSegmentsRow}>
                  {workoutDaysInSequence.map((d, segIdx) => {
                    const isActive = d.id === currentPlan.id;
                    const prog = weekProgressMap[d.id];
                    const done = Boolean(prog?.finishedAt);
                    const paused = Boolean(prog && !prog.finishedAt && countCompletedSetsInProgress(prog) > 0);
                    const barColor = paused
                      ? '#F59E0B'
                      : done
                      ? '#10B981'
                      : isActive
                      ? '#38BDF8'
                      : isDark
                      ? 'rgba(255,255,255,0.16)'
                      : 'rgba(15,23,42,0.14)';

                    return (
                      <TouchableOpacity
                        key={d.id}
                        style={styles.heroSegmentTouch}
                        onPress={() => {
                          if (isActive) return;
                          animateSwitchWorkout(
                            d.id,
                            segIdx > (currentSeqIdx >= 0 ? currentSeqIdx : 0) ? 1 : -1
                          );
                        }}
                        activeOpacity={0.75}
                      >
                        <View
                          style={[
                            styles.heroSegmentBar,
                            {
                              backgroundColor: barColor,
                              height: isActive ? 4 : 3,
                              opacity: isActive || done || paused ? 1 : 0.7,
                            },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </View>

          {/* Open Editorial Warmup Accent Strip (No Heavy Box) */}
          {currentPlan.warmup ? (
            <View
              style={[
                styles.openWarmupStrip,
                {
                  borderLeftColor: '#10B981',
                  backgroundColor: isDark
                    ? 'rgba(16, 185, 129, 0.06)'
                    : 'rgba(16, 185, 129, 0.08)',
                },
              ]}
            >
              <View style={styles.warmupHeaderLine}>
                <Ionicons name="sparkles-outline" size={13} color="#10B981" />
                <Text style={[styles.warmupEyebrow, { color: '#10B981' }]}>
                  {t('warmupMobilityUpper')}
                </Text>
              </View>
              <Text style={[styles.warmupBody, { color: theme.textSecondary }]}>
                {currentPlan.warmup}
              </Text>
            </View>
          ) : null}

          {/* PRESERVED: HOLD TO START BUTTON */}
          {totalExercises > 0 ? (
            <View style={styles.startStack}>
              <HoldToStartButton
                onComplete={() => onStartWorkout(currentPlan.id)}
                title={
                  isCurrentDayPaused
                    ? t('todayResumeWorkout').toUpperCase()
                    : t('todayStartWorkout').toUpperCase()
                }
                subtitle={
                  isCurrentDayPaused
                    ? `${completedSetsToday}/${totalSets} ${t('sets').toLowerCase()}`
                    : dayProgress.sessionConfig
                    ? `${activeExercisesCount} · ${totalSets} ${t('sets').toLowerCase()}`
                    : t('todayEditSession')
                }
              />
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.emptySetupBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={onSwitchToPlanTab}
              activeOpacity={0.75}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.text} />
              <Text style={[styles.emptySetupBtnText, { color: theme.text }]}>
                {t('addExercisesInPlanHint')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Open Biometrics & System Health Recovery Section (Osiągi Editorial Style) */}
          <OpenBiometricsAndRecoverySection
            weight={activeProfile?.weight}
            height={activeProfile?.height}
            summary={healthSummary}
            isWorkoutDay={true}
            isLoading={isHealthLoading}
            onOpenBodyStats={onOpenBodyStats}
            onRefresh={onRefreshHealth}
            onConnect={onConnectHealth}
          />

          {/* Open Timeline List of Today's Exercises (No Card Boxes) */}
          {totalExercises > 0 && (
            <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
              <View style={styles.openSectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                    {t('exercisesInDayUpper', { count: activeExercisesCount })} ({activeExercisesCount}/{totalExercises})
                  </Text>
                  <Text style={[styles.sectionHeading, { color: theme.text }]}>
                    {t('exercisesInBlock')}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.weekGlassPill,
                    {
                      backgroundColor: glassSurfaceBg,
                      borderColor: glassSurfaceBorder,
                    },
                  ]}
                  onPress={onSwitchToPlanTab}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.weekGlassPillText, { color: theme.text }]}>
                    {t('wholeWeek')}
                  </Text>
                  <Ionicons name="arrow-forward" size={12} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <DayExercisePreviewList
                exercises={sessionPreviewExercises}
                daySets={dayProgress.sets}
                bestPRs={bestPRs}
                skippedIds={skippedIds}
                onPressExercise={onOpenExerciseDetail}
              />
            </View>
          )}
        </>
      )}
      </SmartScrollView>

      {/* Clean On-Demand Workout Queue Sheet (opened by tapping 2/4 ▾ inside Hero Card) */}
      {showQueueSheet && (
        <InteractiveBottomSheet
          visible={true}
          onClose={() => setShowQueueSheet(false)}
          title={t('pickWorkoutSheetTitle')}
          subtitle={t('pickWorkoutSheetSub')}
          initialHeightPercent={0.62}
        >
          <BottomSheetScrollView
            contentContainerStyle={styles.queueSheetContent}
            showsVerticalScrollIndicator={false}
          >
            {workoutDaysInSequence.map((d, idx) => {
              const isSelected = currentPlan.id === d.id;
              const prog = weekProgressMap[d.id];
              const doneSets = countCompletedSetsInProgress(prog);
              const isPaused = Boolean(prog && !prog.finishedAt && doneSets > 0);
              const isDone = Boolean(prog?.finishedAt);
              const isSuggested = d.id === suggestedDayId;
              const exCount = d.exercises?.length || 0;
              const setSum = (d.exercises || []).reduce((acc, e) => acc + e.sets, 0);

              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => {
                    setShowQueueSheet(false);
                    animateSwitchWorkout(
                      d.id,
                      idx > (currentSeqIdx >= 0 ? currentSeqIdx : 0)
                        ? 1
                        : idx < (currentSeqIdx >= 0 ? currentSeqIdx : 0)
                        ? -1
                        : 0
                    );
                  }}
                  activeOpacity={0.78}
                  style={[
                    styles.queueSheetRow,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? 'rgba(56, 189, 248, 0.12)'
                          : 'rgba(56, 189, 248, 0.09)'
                        : theme.bgSecondary,
                      borderColor: isSelected
                        ? '#38BDF8'
                        : isPaused
                        ? 'rgba(245, 158, 11, 0.45)'
                        : theme.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.queueIndexBadge,
                      {
                        backgroundColor: isDone
                          ? '#10B981'
                          : isPaused
                          ? '#F59E0B'
                          : isSelected
                          ? '#38BDF8'
                          : theme.card,
                        borderColor: isDone || isPaused || isSelected ? 'transparent' : theme.border,
                      },
                    ]}
                  >
                    {isDone ? (
                      <Ionicons name="checkmark" size={16} color="#09090B" />
                    ) : (
                      <Text
                        style={[
                          styles.queueIndexText,
                          {
                            color: isPaused || isSelected ? '#09090B' : theme.text,
                          },
                        ]}
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.queueTitleLine}>
                      <Text style={[styles.queueRowTitle, { color: theme.text }]} numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={[styles.queueDayChip, { color: theme.textMuted }]}>
                        {dayLabel(d.id, true).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.queueRowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                      {t('exercisesCountText', { count: exCount })} · {setSum} {t('setsWord')}
                    </Text>
                  </View>

                  {isPaused ? (
                    <View style={[styles.queueBadge, { backgroundColor: 'rgba(245, 158, 11, 0.16)' }]}>
                      <Text style={[styles.queueBadgeText, { color: '#F59E0B' }]}>
                        {t('sequencePausedBadge')}
                      </Text>
                    </View>
                  ) : isDone ? (
                    <View style={[styles.queueBadge, { backgroundColor: 'rgba(16, 185, 129, 0.16)' }]}>
                      <Text style={[styles.queueBadgeText, { color: '#10B981' }]}>
                        {t('sequenceDoneBadge')}
                      </Text>
                    </View>
                  ) : isSuggested && suggestedReason !== 'rest' ? (
                    <View style={[styles.queueBadge, { backgroundColor: 'rgba(56, 189, 248, 0.16)' }]}>
                      <Text style={[styles.queueBadgeText, { color: '#38BDF8' }]}>
                        {t('sequenceNextBadge')}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}

            {isTodayScheduledRest && todayPlanMeta && (
              <TouchableOpacity
                onPress={() => {
                  setShowQueueSheet(false);
                  animateSwitchWorkout(todayPlanMeta.id, 0);
                }}
                activeOpacity={0.78}
                style={[
                  styles.queueSheetRow,
                  {
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                    marginTop: 6,
                  },
                ]}
              >
                <View
                  style={[
                    styles.queueIndexBadge,
                    { backgroundColor: 'rgba(16, 185, 129, 0.14)', borderColor: 'transparent' },
                  ]}
                >
                  <Ionicons name="moon-outline" size={16} color="#10B981" />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.queueRowTitle, { color: theme.text }]} numberOfLines={1}>
                    {t('sequenceRestChip')}
                  </Text>
                  <Text style={[styles.queueRowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {todayPlanMeta.name}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </BottomSheetScrollView>
        </InteractiveBottomSheet>
      )}
    </View>
  );
};

interface OpenBiometricsAndRecoverySectionProps {
  weight?: number;
  height?: number;
  summary: HealthDailySummary | null;
  isWorkoutDay: boolean;
  isLoading?: boolean;
  onOpenBodyStats: () => void;
  onRefresh?: () => void;
  onConnect: () => void;
}

const OpenBiometricsAndRecoverySection: React.FC<
  OpenBiometricsAndRecoverySectionProps
> = ({
  weight,
  height,
  summary,
  isLoading = false,
  onOpenBodyStats,
  onRefresh,
  onConnect,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, localeCode } = useLanguage();
  const isConnected = Boolean(summary?.authorized);
  const platformLabel = Platform.OS === 'ios' ? 'APPLE HEALTH' : 'HEALTH CONNECT';

  const bmiValue = useMemo(() => {
    if (!weight || !height || height < 100) return null;
    const hMeters = height / 100;
    return (weight / (hMeters * hMeters)).toFixed(1);
  }, [weight, height]);

  const stepsPct = summary?.steps ? Math.min(100, Math.round((summary.steps / 10000) * 100)) : 12;
  const sleepPct = summary?.sleepHours
    ? Math.min(100, Math.round((summary.sleepHours / 8) * 100))
    : 12;
  const kcalPct = summary?.activeCalories
    ? Math.min(100, Math.round((summary.activeCalories / 600) * 100))
    : 12;

  const glassPillBg = isDark
    ? 'rgba(39, 39, 42, 0.65)'
    : 'rgba(244, 244, 245, 0.86)';
  const glassPillBorder = isDark
    ? 'rgba(255, 255, 255, 0.11)'
    : 'rgba(24, 24, 27, 0.08)';

  return (
    <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
      <View style={styles.openSectionHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowWithIcon}>
            <AnimatedIcon
              name="heart"
              preset="heart"
              size={12}
              color="#EF4444"
              active={isConnected}
            />
            <Text style={[styles.sectionEyebrow, { color: theme.textMuted, marginBottom: 0 }]}>
              {t('biometricsKicker')} · {platformLabel}
            </Text>
          </View>
          <Text style={[styles.sectionHeading, { color: theme.text, marginTop: 2 }]}>
            {t('readinessAndParams')}
          </Text>
        </View>

        <View style={styles.headerRightPills}>
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              onOpenBodyStats();
            }}
            style={[
              styles.glassMiniActionBtn,
              { backgroundColor: glassPillBg, borderColor: glassPillBorder },
            ]}
            activeOpacity={0.75}
          >
            <Ionicons name="scale-outline" size={13} color={theme.text} />
            <Text style={[styles.glassMiniActionText, { color: theme.text }]}>
              {t('weightShort')}
            </Text>
          </TouchableOpacity>

          {isConnected ? (
            <TouchableOpacity
              onPress={() => {
                triggerSelectionHaptic();
                onRefresh?.();
              }}
              disabled={isLoading}
              style={[
                styles.glassIconBtn,
                { backgroundColor: glassPillBg, borderColor: glassPillBorder },
              ]}
              activeOpacity={0.75}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="refresh-outline" size={14} color={theme.text} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onConnect}
              disabled={isLoading}
              style={[styles.healthConnectBtn, { backgroundColor: theme.text }]}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.bg} />
              ) : (
                <>
                  <Ionicons name="link-outline" size={13} color={theme.bg} />
                  <Text style={[styles.healthConnectText, { color: theme.bg }]}>
                    {t('connectAction')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Open 4-Column Telemetry Strip (Weight, BMI/Height, Steps, Sleep/Kcal) */}
      <View style={styles.openTelemetryGrid}>
        <TouchableOpacity
          style={styles.telemetryCell}
          onPress={() => {
            triggerSelectionHaptic();
            onOpenBodyStats();
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.telemetryCellLabel, { color: theme.textMuted }]}>
            {t('bodyWeightUpper')}
          </Text>
          <Text style={[styles.telemetryCellValue, { color: theme.text }]}>
            {weight ? `${weight} kg` : '-- kg'}
          </Text>
          <AnimatedMiniBar
            pct={weight ? 78 : 15}
            color="#38BDF8"
            trackColor={theme.bgSecondary}
            delayMs={0}
          />
          <Text style={[styles.telemetryCellSub, { color: theme.textSecondary }]}>
            {bmiValue ? `BMI ${bmiValue}` : height ? `${height} cm` : t('setWeightAction')}
          </Text>
        </TouchableOpacity>

        <View style={[styles.cellDivider, { backgroundColor: theme.hairline }]} />

        <View style={styles.telemetryCell}>
          <Text style={[styles.telemetryCellLabel, { color: theme.textMuted }]}>
            {t('stepsTodayUpper')}
          </Text>
          <Text style={[styles.telemetryCellValue, { color: theme.text }]}>
            {isConnected && summary?.steps !== null && summary?.steps !== undefined
              ? summary.steps.toLocaleString(localeCode)
              : '--'}
          </Text>
          <AnimatedMiniBar
            pct={isConnected ? stepsPct : 12}
            color="#10B981"
            trackColor={theme.bgSecondary}
            delayMs={60}
          />
          <Text style={[styles.telemetryCellSub, { color: theme.textSecondary }]}>
            {isConnected && summary?.steps
              ? t('goalPctLabel', { pct: Math.min(100, Math.round((summary.steps / 10000) * 100)) })
              : t('goal10kLabel')}
          </Text>
        </View>

        <View style={[styles.cellDivider, { backgroundColor: theme.hairline }]} />

        <View style={styles.telemetryCell}>
          <Text style={[styles.telemetryCellLabel, { color: theme.textMuted }]}>
            {t('sleepNightUpper')}
          </Text>
          <Text style={[styles.telemetryCellValue, { color: theme.text }]}>
            {isConnected && summary?.sleepHours !== null && summary?.sleepHours !== undefined
              ? `${summary.sleepHours} h`
              : '-- h'}
          </Text>
          <AnimatedMiniBar
            pct={isConnected ? sleepPct : 12}
            color="#A855F7"
            trackColor={theme.bgSecondary}
            delayMs={120}
          />
          <Text style={[styles.telemetryCellSub, { color: theme.textSecondary }]}>
            {isConnected && summary?.sleepHours
              ? summary.sleepHours >= 7
                ? t('optimalSleep')
                : t('shortSleep')
              : t('sleepNormSub')}
          </Text>
        </View>

        <View style={[styles.cellDivider, { backgroundColor: theme.hairline }]} />

        <View style={styles.telemetryCell}>
          <Text style={[styles.telemetryCellLabel, { color: theme.textMuted }]}>
            {t('activeKcalUpper')}
          </Text>
          <Text style={[styles.telemetryCellValue, { color: theme.text }]}>
            {isConnected &&
            summary?.activeCalories !== null &&
            summary?.activeCalories !== undefined
              ? `${summary.activeCalories}`
              : isConnected && summary?.distanceKm
              ? `${summary.distanceKm} km`
              : '--'}
          </Text>
          <AnimatedMiniBar
            pct={isConnected ? kcalPct : 12}
            color="#F59E0B"
            trackColor={theme.bgSecondary}
            delayMs={180}
          />
          <Text style={[styles.telemetryCellSub, { color: theme.textSecondary }]}>
            {isConnected && summary?.activeCalories !== null
              ? t('burnedToday')
              : t('noDataLabel')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabScroll: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 92,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    gap: 10,
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
  },
  dateLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 19,
    borderWidth: 1,
    maxWidth: 156,
  },
  planPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  openStreakStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  heroTopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  heroDayStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroDayStatusText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  heroStepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 3,
    paddingVertical: 3,
    gap: 1,
    flexShrink: 0,
  },
  heroStepperArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStepperCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    height: 24,
  },
  heroStepperText: {
    fontSize: 11.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  heroSegmentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  heroSegmentTouch: {
    flex: 1,
    paddingVertical: 5,
  },
  heroSegmentBar: {
    width: '100%',
    borderRadius: 999,
  },
  backToQueueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 8,
  },
  backToQueueText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  queueSheetContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 8,
  },
  queueSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  queueIndexBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueIndexText: {
    fontSize: 14,
    fontWeight: '900',
  },
  queueTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  queueRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 1,
  },
  queueDayChip: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  queueRowSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  queueBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  queueBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  streakLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  flameGlassOrb: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakTextCol: {
    flex: 1,
    minWidth: 0,
  },
  streakEyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  streakTitle: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  streakRightTelemetry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  telemetryMiniCol: {
    alignItems: 'flex-end',
  },
  telemetryWeightBtn: {
    alignItems: 'flex-end',
  },
  telemetryMiniVal: {
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  telemetryWeightSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  telemetryMiniLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginTop: 1,
  },
  verticalHairline: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    minHeight: 168,
    justifyContent: 'flex-end',
  },
  heroInner: {
    padding: 18,
  },
  heroTagRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    minWidth: 0,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heroTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  heroTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  heroTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 19,
    fontWeight: '500',
  },
  heroMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  heroMetaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  heroMetaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  openWarmupStrip: {
    borderLeftWidth: 3,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    gap: 4,
  },
  warmupHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warmupEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  warmupBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  emptySetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptySetupBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bodyStatsActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  bodyStatsActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  startStack: {
    gap: 10,
    marginBottom: 6,
  },
  openSection: {
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  openSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  eyebrowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  headerRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  glassMiniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  glassMiniActionText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  glassIconBtn: {
    width: 31,
    height: 31,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
  },
  healthConnectText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  openTelemetryGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingBottom: 6,
  },
  telemetryCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    gap: 5,
  },
  cellDivider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 4,
    marginHorizontal: 4,
  },
  telemetryCellLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  telemetryCellValue: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  telemetryCellSub: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  miniBarTrack: {
    width: '100%',
    height: 3.5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: 3.5,
    borderRadius: 999,
  },
  weekGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  weekGlassPillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
