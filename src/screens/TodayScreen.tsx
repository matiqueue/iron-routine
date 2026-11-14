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
import { useAppTheme } from '../context/ThemeContext';
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
import { resolveActiveSessionExercises } from '../utils/sessionExercises';
import { triggerSelectionHaptic } from '../services/haptics';
import { generateHealthCoachingInsight } from '../services/health';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { DayBannerArtwork } from '../components/DayBannerArtwork';
import { DayExercisePreviewList } from '../components/DayExercisePreviewList';
import { HoldToStartButton } from '../components/HoldToStartButton';
import { RestDayView } from '../components/RestDayView';

interface TodayScreenProps {
  activeProfile: UserProfile;
  activePlan: WorkoutPlan | null;
  currentPlan: DayPlan;
  dayProgress: DayProgress;
  streak: number;
  bestPRs: { [exerciseId: string]: PRRecord };
  healthSummary: HealthDailySummary | null;
  isHealthLoading?: boolean;
  onRefreshHealth?: () => void;
  onConnectHealth: () => void;
  onConfigureSession: () => void;
  onOpenPlanManager: () => void;
  onOpenBodyStats: () => void;
  onStartWorkout: (dayId?: string) => void;
  onOpenExerciseDetail: (ex: Exercise) => void;
  onSwitchToPlanTab: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  activeProfile,
  activePlan,
  currentPlan,
  dayProgress,
  streak,
  bestPRs,
  healthSummary,
  isHealthLoading = false,
  onRefreshHealth,
  onConnectHealth,
  onConfigureSession,
  onOpenPlanManager,
  onOpenBodyStats,
  onStartWorkout,
  onOpenExerciseDetail,
  onSwitchToPlanTab,
}) => {
  const { theme, isDark, toggleTheme } = useAppTheme();

  const bannerTag = resolveDayBannerTag(currentPlan);
  const tagMeta = getDayBannerTagMeta(bannerTag);
  const firstName = activeProfile?.name?.trim().split(' ')[0] || 'Zawodniku';
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

  const isRestOrWalk = currentPlan.type === 'rest' || currentPlan.type === 'walk';

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Responsive Top Header Bar (375pt+ safe) */}
      <View style={styles.topHeader}>
        <View style={styles.greetingCol}>
          <Text style={[styles.dateLabel, { color: theme.textMuted }]} numberOfLines={1}>
            {new Date()
              .toLocaleDateString('pl-PL', {
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
            Cześć, {firstName}
          </Text>
        </View>

        {/* Right Actions: Theme toggle + Active Plan Switcher Pill */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.actionIconBtn,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              toggleTheme();
            }}
            activeOpacity={0.7}
            accessibilityLabel="Przełącz motyw"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planPill, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            onPress={() => {
              triggerSelectionHaptic();
              onOpenPlanManager();
            }}
            activeOpacity={0.75}
            accessibilityLabel="Zmień aktywny plan treningowy"
          >
            <Ionicons name="layers-outline" size={15} color={theme.text} />
            <Text style={[styles.planPillText, { color: theme.text }]} numberOfLines={1}>
              {activePlan?.name || 'Wybierz plan'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Streak & Active Plan Ribbon */}
      <View
        style={[
          styles.streakRibbon,
          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
        ]}
      >
        <View style={styles.streakLeft}>
          <View
            style={[styles.streakIconWrap, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <AnimatedIcon
              name="flame"
              preset="flame"
              size={19}
              color={streak > 0 ? '#F59E0B' : theme.textMuted}
              active={streak > 0}
            />
          </View>
          <View style={styles.streakTextCol}>
            <Text style={[styles.streakTitle, { color: theme.text }]} numberOfLines={1}>
              {streak} {streak === 1 ? 'dzień' : 'dni'} serii treningowej
            </Text>
            <Text style={[styles.streakSub, { color: theme.textMuted }]} numberOfLines={1}>
              {activePlan?.name
                ? `Plan: ${activePlan.name}`
                : 'Czysta dyscyplina, utrzymaj rytm'}
            </Text>
          </View>
        </View>
      </View>

      {/* Rest / Active Recovery Day View or Workout Day */}
      {isRestOrWalk ? (
        <>
          <RestDayView dayPlan={currentPlan} />
          <BodyStatsQuickCard
            weight={activeProfile?.weight}
            height={activeProfile?.height}
            onPress={onOpenBodyStats}
            marginTop={14}
          />
          <HealthRecoveryCard
            summary={healthSummary}
            isWorkoutDay={false}
            isLoading={isHealthLoading}
            onRefresh={onRefreshHealth}
            onConnect={onConnectHealth}
          />
        </>
      ) : (
        <>
          {/* Universal SVG Artwork Hero Banner (every plan & every day) */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: theme.card, borderColor: theme.border },
            ]}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <DayBannerArtwork tag={bannerTag} />
            </View>

            <View style={styles.heroInner}>
              <View style={styles.heroTagRow}>
                <View style={[styles.heroTagPill, { backgroundColor: theme.primary }]}>
                  <Ionicons name={tagMeta.icon as any} size={11} color={theme.primaryText} />
                  <Text style={[styles.heroTagText, { color: theme.primaryText }]}>
                    {tagMeta.label.toUpperCase()}
                  </Text>
                </View>

                {currentPlan.time ? (
                  <View
                    style={[
                      styles.heroTimePill,
                      { backgroundColor: theme.bgSecondary, borderColor: theme.border },
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
                      { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.heroMetaText, { color: theme.text }]}>
                      {totalExercises} ćwiczeń
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.heroMetaBadge,
                      { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.heroMetaText, { color: theme.text }]}>
                      {totalSets} serii
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Warmup tip if available */}
          {currentPlan.warmup ? (
            <View
              style={[
                styles.warmupCard,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.text}
                style={{ marginTop: 1 }}
              />
              <View style={styles.warmupTextCol}>
                <Text style={[styles.warmupHeader, { color: theme.text }]}>
                  Rozgrzewka i mobilizacja
                </Text>
                <Text style={[styles.warmupBody, { color: theme.textSecondary }]}>
                  {currentPlan.warmup}
                </Text>
              </View>
            </View>
          ) : null}

          {/* HOLD TO START BUTTON or Empty Setup CTA */}
          {totalExercises > 0 ? (
            <View style={styles.startStack}>
              <TouchableOpacity
                style={[
                  styles.configureSessionBtn,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
                onPress={() => {
                  triggerSelectionHaptic();
                  onConfigureSession();
                }}
                activeOpacity={0.78}
              >
                <View style={styles.configureLeft}>
                  <View
                    style={[
                      styles.configureIconWrap,
                      { backgroundColor: theme.card, borderColor: theme.border },
                    ]}
                  >
                    <AnimatedIcon
                      name="options-outline"
                      preset="barbell"
                      size={17}
                      color={theme.text}
                      active={false}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.configureTitle, { color: theme.text }]} numberOfLines={1}>
                      Konfiguruj dzisiejszą sesję
                    </Text>
                    <Text style={[styles.configureSub, { color: theme.textMuted }]} numberOfLines={1}>
                      {dayProgress.sessionConfig
                        ? `Aktywne: ${activeExercisesCount}/${totalExercises} ćwiczeń · własna kolejność`
                        : 'Zaznacz ćwiczenia i ustaw kolejność przed startem'}
                    </Text>
                  </View>
                </View>
                <View style={styles.bodyStatsActionWrap}>
                  <Text style={[styles.bodyStatsActionText, { color: theme.text }]}>Ustaw</Text>
                  <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
                </View>
              </TouchableOpacity>

              <HoldToStartButton
                onComplete={() => onStartWorkout(currentPlan.id)}
                title="PRZYTRZYMAJ, ABY ZACZĄĆ"
                subtitle={
                  dayProgress.sessionConfig
                    ? `Gotowe (${activeExercisesCount} ćwiczeń, ${totalSets} serii) · przytrzymaj`
                    : 'Przytrzymaj, przed startem potwierdzisz ćwiczenia i kolejność'
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
                Dodaj ćwiczenia w zakładce Plan
              </Text>
            </TouchableOpacity>
          )}

          {/* Body Stats Quick Card */}
          <BodyStatsQuickCard
            weight={activeProfile?.weight}
            height={activeProfile?.height}
            onPress={onOpenBodyStats}
          />

          {/* System Health Recovery Card (Apple Health / Health Connect) */}
          <HealthRecoveryCard
            summary={healthSummary}
            isWorkoutDay={true}
            isLoading={isHealthLoading}
            onRefresh={onRefreshHealth}
            onConnect={onConnectHealth}
          />

          {/* Upgraded Modern Card List of Today's Exercises (No thumbnails, high clarity) */}
          {totalExercises > 0 && (
            <View style={styles.todayExercises}>
              <View style={[styles.sectionDivider, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                  ĆWICZENIA W DZISIEJSZYM BLOKU ({activeExercisesCount}/{totalExercises})
                </Text>
                <TouchableOpacity onPress={onSwitchToPlanTab} activeOpacity={0.7}>
                  <Text style={[styles.sectionAction, { color: theme.text }]}>Tydzień →</Text>
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
    </ScrollView>
  );
};

interface BodyStatsQuickCardProps {
  weight?: number;
  height?: number;
  onPress: () => void;
  marginTop?: number;
}

const BodyStatsQuickCard: React.FC<BodyStatsQuickCardProps> = ({
  weight,
  height,
  onPress,
  marginTop = 0,
}) => {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      style={[
        styles.bodyStatsRow,
        { backgroundColor: theme.bgSecondary, borderColor: theme.border, marginTop },
      ]}
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      activeOpacity={0.75}
    >
      <View style={styles.bodyStatsLeft}>
        <View
          style={[
            styles.bodyStatsIconWrap,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons name="scale-outline" size={19} color={theme.text} />
        </View>
        <View style={styles.bodyStatsTextCol}>
          <View style={styles.bodyStatsTitleRow}>
            <Text style={[styles.bodyStatsTitle, { color: theme.text }]}>
              {weight ? `${weight} kg` : 'Dodaj wagę'}
            </Text>
            <Text style={[styles.bodyStatsDot, { color: theme.textMuted }]}>•</Text>
            <Text style={[styles.bodyStatsHeight, { color: theme.textSecondary }]}>
              {height ? `${height} cm` : 'Wzrost'}
            </Text>
          </View>
          <Text style={[styles.bodyStatsSub, { color: theme.textMuted }]} numberOfLines={1}>
            Codzienne ważenie i parametry ciała
          </Text>
        </View>
      </View>

      <View style={styles.bodyStatsActionWrap}>
        <Text style={[styles.bodyStatsActionText, { color: theme.text }]}>Waga</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

interface HealthRecoveryCardProps {
  summary: HealthDailySummary | null;
  isWorkoutDay: boolean;
  isLoading?: boolean;
  onRefresh?: () => void;
  onConnect: () => void;
}

const HealthRecoveryCard: React.FC<HealthRecoveryCardProps> = ({
  summary,
  isWorkoutDay,
  isLoading = false,
  onRefresh,
  onConnect,
}) => {
  const { theme } = useAppTheme();
  const isConnected = Boolean(summary?.authorized);
  const insight = generateHealthCoachingInsight(summary, isWorkoutDay);
  const platformLabel = Platform.OS === 'ios' ? 'APPLE HEALTH' : 'HEALTH CONNECT';
  const accentBorder =
    insight.tone === 'warning'
      ? 'rgba(245, 158, 11, 0.35)'
      : insight.tone === 'good'
      ? 'rgba(16, 185, 129, 0.32)'
      : theme.border;

  return (
    <View
      style={[
        styles.healthCard,
        { backgroundColor: theme.bgSecondary, borderColor: theme.border },
      ]}
    >
      <View style={styles.healthTopRow}>
        <View style={styles.healthTitleRow}>
          <AnimatedIcon
            name="heart"
            preset="heart"
            size={15}
            color="#EF4444"
            active={isConnected}
          />
          <Text style={[styles.healthTitle, { color: theme.textMuted }]}>{platformLabel}</Text>
        </View>

        {isConnected ? (
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              onRefresh?.();
            }}
            disabled={isLoading}
            style={[styles.healthRefreshBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
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
            style={[styles.healthConnectBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <>
                <Ionicons name="link-outline" size={13} color={theme.primaryText} />
                <Text style={[styles.healthConnectText, { color: theme.primaryText }]}>Połącz</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {isConnected && summary ? (
        <View style={styles.healthMetricsRow}>
          <View style={[styles.healthMetricBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <AnimatedIcon name="footsteps-outline" preset="footsteps" size={14} color={theme.text} active />
            <Text style={[styles.healthMetricVal, { color: theme.text }]} numberOfLines={1}>
              {summary.steps !== null ? summary.steps.toLocaleString('pl-PL') : '-'}
            </Text>
            <Text style={[styles.healthMetricLbl, { color: theme.textMuted }]}>Kroki</Text>
          </View>

          <View style={[styles.healthMetricBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <AnimatedIcon name="moon-outline" preset="moon" size={14} color={theme.text} active />
            <Text style={[styles.healthMetricVal, { color: theme.text }]} numberOfLines={1}>
              {summary.sleepHours !== null ? `${summary.sleepHours} h` : '-'}
            </Text>
            <Text style={[styles.healthMetricLbl, { color: theme.textMuted }]}>Sen</Text>
          </View>

          <View style={[styles.healthMetricBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="flame-outline" size={14} color="#F59E0B" />
            <Text style={[styles.healthMetricVal, { color: theme.text }]} numberOfLines={1}>
              {summary.activeCalories !== null
                ? `${summary.activeCalories}`
                : summary.distanceKm !== null
                ? `${summary.distanceKm} km`
                : '-'}
            </Text>
            <Text style={[styles.healthMetricLbl, { color: theme.textMuted }]}>
              {summary.activeCalories !== null ? 'Kcal' : 'Dystans'}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.healthTipBox,
          { backgroundColor: theme.card, borderColor: accentBorder },
        ]}
      >
        <Ionicons
          name={insight.icon}
          size={16}
          color={
            insight.tone === 'warning'
              ? '#F59E0B'
              : insight.tone === 'good'
              ? '#10B981'
              : theme.text
          }
          style={{ marginTop: 1 }}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.healthTipHeadline, { color: theme.text }]}>{insight.headline}</Text>
          <Text style={[styles.healthTipText, { color: theme.textSecondary }]}>{insight.tip}</Text>
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
    paddingBottom: 118,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 4,
    gap: 10,
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
  },
  dateLabel: {
    fontSize: 11,
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
    maxWidth: 152,
  },
  planPillText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  streakRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  streakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakTextCol: {
    flex: 1,
    minWidth: 0,
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  streakSub: {
    fontSize: 12,
    marginTop: 2,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
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
  warmupCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  warmupTextCol: {
    flex: 1,
    minWidth: 0,
  },
  warmupHeader: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
  },
  warmupBody: {
    fontSize: 13,
    lineHeight: 18,
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
  bodyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    gap: 10,
  },
  bodyStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  bodyStatsIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyStatsTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bodyStatsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  bodyStatsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  bodyStatsDot: {
    fontSize: 14,
  },
  bodyStatsHeight: {
    fontSize: 14,
    fontWeight: '600',
  },
  bodyStatsSub: {
    fontSize: 12,
    marginTop: 2,
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
  todayExercises: {
    marginTop: 4,
  },
  startStack: {
    gap: 10,
    marginBottom: 2,
  },
  configureSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  configureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  configureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  configureTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  configureSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  healthCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 18,
    gap: 11,
  },
  healthTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  healthTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  healthRefreshBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  healthConnectText: {
    fontSize: 12,
    fontWeight: '800',
  },
  healthMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  healthMetricBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },
  healthMetricVal: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  healthMetricLbl: {
    fontSize: 10,
    fontWeight: '700',
  },
  healthTipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  healthTipHeadline: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  healthTipText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    flexShrink: 1,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '800',
  },
});
