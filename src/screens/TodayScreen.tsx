import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
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

      {/* Sequence-First Workout Queue Switcher (de-coupled from strict weekday lock!) */}
      {workoutDaysInSequence.length > 0 && (
        <View style={styles.sequenceBlock}>
          <View style={styles.sequenceHeaderRow}>
            <Text style={[styles.sequenceEyebrow, { color: theme.textMuted }]}>
              {t('sequenceQueueTitle')}
            </Text>
            {isTodayScheduledRest && todayPlanMeta && (
              <TouchableOpacity
                onPress={() => {
                  triggerSelectionHaptic();
                  onSelectWorkoutDay(todayPlanMeta.id);
                }}
                activeOpacity={0.75}
                style={[
                  styles.restQuickPill,
                  {
                    backgroundColor:
                      currentPlan.id === todayPlanMeta.id
                        ? 'rgba(16, 185, 129, 0.16)'
                        : glassSurfaceBg,
                    borderColor:
                      currentPlan.id === todayPlanMeta.id
                        ? '#10B981'
                        : glassSurfaceBorder,
                  },
                ]}
              >
                <Ionicons
                  name="moon-outline"
                  size={11}
                  color={currentPlan.id === todayPlanMeta.id ? '#10B981' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.restQuickPillText,
                    {
                      color:
                        currentPlan.id === todayPlanMeta.id ? '#10B981' : theme.textSecondary,
                    },
                  ]}
                >
                  {t('sequenceRestChip')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            contentContainerStyle={styles.sequenceRowContent}
          >
            {workoutDaysInSequence.map((d, seqIdx) => {
              const isSelected = currentPlan.id === d.id;
              const prog = weekProgressMap[d.id];
              const doneSets = countCompletedSetsInProgress(prog);
              const isPaused = Boolean(prog && !prog.finishedAt && doneSets > 0);
              const isDoneThisWeek = Boolean(prog?.finishedAt);
              const isSuggested = d.id === suggestedDayId;

              return (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => {
                    if (isSelected) return;
                    triggerSelectionHaptic();
                    onSelectWorkoutDay(d.id);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.seqCard,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : glassSurfaceBg,
                      borderColor: isSelected
                        ? theme.primary
                        : isPaused
                        ? 'rgba(245, 158, 11, 0.55)'
                        : isSuggested
                        ? 'rgba(56, 189, 248, 0.5)'
                        : glassSurfaceBorder,
                    },
                  ]}
                >
                  <View style={styles.seqCardTop}>
                    <Text
                      style={[
                        styles.seqOrderTag,
                        {
                          color: isSelected
                            ? theme.primaryText
                            : theme.textMuted,
                          opacity: isSelected ? 0.78 : 1,
                        },
                      ]}
                    >
                      #{seqIdx + 1} · {dayLabel(d.id, true).toUpperCase()}
                    </Text>

                    {isPaused ? (
                      <View
                        style={[
                          styles.seqStatusBadge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(245, 158, 11, 0.28)'
                              : 'rgba(245, 158, 11, 0.16)',
                          },
                        ]}
                      >
                        <View style={[styles.seqStatusDot, { backgroundColor: '#F59E0B' }]} />
                        <Text
                          style={[
                            styles.seqStatusText,
                            { color: isSelected ? theme.primaryText : '#F59E0B' },
                          ]}
                        >
                          {t('sequencePausedBadge')}
                        </Text>
                      </View>
                    ) : isDoneThisWeek ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={isSelected ? theme.primaryText : '#10B981'}
                      />
                    ) : isSuggested && suggestedReason !== 'rest' ? (
                      <View
                        style={[
                          styles.seqStatusBadge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(56, 189, 248, 0.28)'
                              : 'rgba(56, 189, 248, 0.16)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.seqStatusText,
                            { color: isSelected ? theme.primaryText : '#38BDF8' },
                          ]}
                        >
                          {t('sequenceNextBadge')}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.seqCardName,
                      { color: isSelected ? theme.primaryText : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Rest / Active Recovery Day View or Workout Day */}
      {isRestOrWalk ? (
        <>
          <RestDayView dayPlan={currentPlan} />
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
          {/* PRESERVED: Universal SVG Artwork Hero Banner (Day Card) */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
              <DayBannerArtwork tag={bannerTag} />
            </View>

            <View style={styles.heroInner}>
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

                {currentPlan.time ? (
                  <View
                    style={[
                      styles.heroTimePill,
                      {
                        backgroundColor: glassSurfaceBg,
                        borderColor: glassSurfaceBorder,
                      },
                    ]}
                  >
                    <Ionicons name="time-outline" size={12} color={theme.text} />
                    <Text style={[styles.heroTimeText, { color: theme.text }]}>
                      {currentPlan.time}
                    </Text>
                  </View>
                ) : null}
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
                </View>
              )}
            </View>
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
    marginBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sequenceBlock: {
    marginBottom: 14,
  },
  sequenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  sequenceEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  restQuickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  restQuickPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  sequenceRowContent: {
    gap: 8,
    paddingRight: 6,
  },
  seqCard: {
    minWidth: 132,
    maxWidth: 174,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1,
    gap: 5,
  },
  seqCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  seqOrderTag: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  seqStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  seqStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  seqStatusText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  seqCardName: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.2,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
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
