import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { DAYS_OF_WEEK, WORKOUT_PLAN } from '../data/planData';
import { getDayBannerTagMeta, resolveDayBannerTag } from '../data/dayTags';
import { Exercise, DayPlan, PRRecord, WorkoutPlan } from '../types/workout';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { PlanDayEditorModal } from './PlanDayEditorModal';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { DayBannerArtwork } from './DayBannerArtwork';
import { DayExercisePreviewList } from './DayExercisePreviewList';
import { updateDayInPlan } from '../services/storage';
import { triggerSelectionHaptic } from '../services/haptics';

interface PlanTabProps {
  profileId?: string;
  activePlan?: WorkoutPlan | null;
  allPlansCount?: number;
  extraLibraryExercises?: Exercise[];
  bestPRs?: { [exerciseId: string]: PRRecord };
  onOpenPlanManager?: () => void;
  onPlanUpdated?: () => Promise<void> | void;
  onLibraryChanged?: () => void;
  onSelectExerciseForPR?: (exercise: Exercise) => void;
  onStartWorkoutForDay?: (dayId: string) => void;
}

export const PlanTab: React.FC<PlanTabProps> = ({
  profileId,
  activePlan,
  allPlansCount = 1,
  extraLibraryExercises = [],
  bestPRs = {},
  onOpenPlanManager,
  onPlanUpdated,
  onLibraryChanged,
  onSelectExerciseForPR,
  onStartWorkoutForDay,
}) => {
  const { theme } = useAppTheme();
  const [selectedDayId, setSelectedDayId] = useState<string>('mon');
  const [modalExercise, setModalExercise] = useState<Exercise | null>(null);
  const [editingDay, setEditingDay] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const planDays: DayPlan[] = activePlan?.days?.length ? activePlan.days : WORKOUT_PLAN;

  // Smooth animated transition when switching days
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  const handleSelectDay = (dayId: string) => {
    if (dayId === selectedDayId) return;
    triggerSelectionHaptic();

    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(10);
    setSelectedDayId(dayId);

    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const currentPlan: DayPlan =
    planDays.find((d) => d.id === selectedDayId) || planDays[0];
  const currentDayMeta =
    DAYS_OF_WEEK.find((d) => d.id === currentPlan.id) || DAYS_OF_WEEK[0];
  const resolvedBannerTag = resolveDayBannerTag(currentPlan);
  const tagMeta = getDayBannerTagMeta(resolvedBannerTag);

  const handleSaveEditedDay = async (updatedDay: DayPlan) => {
    if (!activePlan) return;
    await updateDayInPlan(activePlan.id, updatedDay, profileId);
    await onPlanUpdated?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Editorial Title + Plan Switcher */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: theme.text }]}>Plan treningowy</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
              Rozkład tygodnia • Technika • Konfigurator
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.libraryBtn,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setShowLibrary(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="barbell-outline" size={16} color={theme.text} />
            <Text style={[styles.libraryBtnText, { color: theme.text }]}>Baza</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.planControlsRow}>
          <TouchableOpacity
            style={[
              styles.planSelectorPill,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              onOpenPlanManager?.();
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="layers-outline" size={15} color={theme.text} />
            <Text style={[styles.planSelectorText, { color: theme.text }]} numberOfLines={1}>
              {activePlan?.name || 'Mój Plan'}
            </Text>
            <Text style={[styles.planCountBadge, { color: theme.textMuted }]}>
              ({allPlansCount})
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.editDayHeaderBtn,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setEditingDay(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={15} color={theme.text} />
            <Text style={[styles.editDayHeaderBtnText, { color: theme.text }]}>Edytuj dzień</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day Selector Pills */}
      <View style={[styles.daySelectorWrapper, { borderBottomColor: theme.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daySelectorScroll}
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = day.id === selectedDayId;
            const plan = planDays.find((p) => p.id === day.id);
            const isRest = plan?.type === 'rest';

            return (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.bgSecondary,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => handleSelectDay(day.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayShort,
                    { color: isSelected ? theme.primaryText : theme.text },
                  ]}
                >
                  {day.short}
                </Text>
                <Text
                  style={[
                    styles.daySub,
                    { color: isSelected ? theme.primaryText : theme.textMuted },
                  ]}
                >
                  {isRest ? 'Wolne' : 'Trening'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Day Content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          }}
        >
        {/* Universal Tagged Monochrome Graphic Banner */}
        <View
          style={[
            styles.monoBannerCard,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}
        >
          <DayBannerArtwork tag={resolvedBannerTag} />

          <View style={styles.monoBannerTop}>
            <View style={[styles.monoBannerBadge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.monoBannerBadgeText, { color: theme.primaryText }]}>
                {tagMeta.badge}
              </Text>
            </View>
            <Ionicons
              name={(tagMeta.icon as any) || (currentPlan.iconName as any) || 'barbell-outline'}
              size={22}
              color={theme.text}
            />
          </View>

          <Text style={[styles.monoBannerTitle, { color: theme.text }]}>
            {currentPlan.name}
          </Text>
          {currentPlan.subtitle ? (
            <Text style={[styles.monoBannerSubtitle, { color: theme.textSecondary }]}>
              {currentPlan.subtitle}
            </Text>
          ) : null}

          <View style={styles.bannerMetaRow}>
            <View style={styles.metaTimeWrap}>
              <Ionicons name="time-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                {currentPlan.time}
              </Text>
            </View>
            {currentPlan.type === 'workout' && (
              <>
                <Text style={[styles.monoMetaDot, { color: theme.textMuted }]}>•</Text>
                <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                  {currentPlan.exercises?.length || 0} ćwiczeń
                </Text>
                <Text style={[styles.monoMetaDot, { color: theme.textMuted }]}>•</Text>
                <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                  {(currentPlan.exercises || []).reduce((acc, e) => acc + e.sets, 0)} serii
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Warmup advice */}
        {currentPlan.warmup ? (
          <View style={[styles.warmupNotice, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={20} color={theme.text} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.warmupTitle, { color: theme.text }]}>Wskazówka rozgrzewkowa</Text>
              <Text style={[styles.warmupDesc, { color: theme.textSecondary }]}>
                {currentPlan.warmup}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Start workout button */}
        {currentPlan.type === 'workout' &&
          currentPlan.exercises &&
          currentPlan.exercises.length > 0 &&
          onStartWorkoutForDay && (
            <TouchableOpacity
              style={[styles.startWorkoutBtn, { backgroundColor: theme.primary }]}
              onPress={() => onStartWorkoutForDay(currentPlan.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="play" size={16} color={theme.primaryText} />
              <Text style={[styles.startWorkoutBtnText, { color: theme.primaryText }]}>
                ROZPOCZNIJ TEN TRENING
              </Text>
            </TouchableOpacity>
          )}

        {/* Empty workout day prompt */}
        {currentPlan.type === 'workout' &&
          (!currentPlan.exercises || currentPlan.exercises.length === 0) && (
            <TouchableOpacity
              style={[
                styles.emptyDayCard,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() => setEditingDay(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.text} />
              <Text style={[styles.emptyDayTitle, { color: theme.text }]}>
                Ten dzień nie ma jeszcze ćwiczeń
              </Text>
              <Text style={[styles.emptyDaySub, { color: theme.textMuted }]}>
                Dotknij, aby dobrać ćwiczenia z bazy siłowni lub zmienić dzień na regenerację.
              </Text>
            </TouchableOpacity>
          )}

        {/* Upgraded Athletic Exercise List */}
        {currentPlan.exercises && currentPlan.exercises.length > 0 && (
          <View style={styles.exerciseSection}>
            <View style={[styles.sectionDivider, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                ĆWICZENIA W DNIU ({currentPlan.exercises.length})
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textMuted }]}>
                Dotknij po technikę i PR
              </Text>
            </View>

            <DayExercisePreviewList
              exercises={currentPlan.exercises}
              bestPRs={bestPRs}
              onPressExercise={(exercise) => setModalExercise(exercise)}
            />
          </View>
        )}
        </Animated.View>
      </ScrollView>

      <ExerciseDetailModal
        visible={modalExercise !== null}
        exercise={modalExercise}
        onClose={() => setModalExercise(null)}
        onOpenPR={onSelectExerciseForPR}
      />

      <PlanDayEditorModal
        visible={editingDay}
        onClose={() => setEditingDay(false)}
        dayPlan={currentPlan}
        dayLabel={currentDayMeta.label}
        extraExercises={extraLibraryExercises}
        onSaveDay={handleSaveEditedDay}
        onLibraryChanged={onLibraryChanged}
      />

      <ExerciseLibraryModal
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
        mode="manage"
        extraExercises={extraLibraryExercises}
        onLibraryChanged={onLibraryChanged}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  daySelectorWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    marginTop: 10,
  },
  daySelectorScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  dayPill: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 68,
    gap: 4,
  },
  dayShort: {
    fontSize: 17,
    fontWeight: '900',
  },
  daySub: {
    fontSize: 12,
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 112,
  },
  bannerWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 20,
    justifyContent: 'flex-end',
  },
  bannerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  bannerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerMetaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bannerMetaDot: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  warmupNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  warmupTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  warmupDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 22,
  },
  startWorkoutBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  exerciseSection: {
    marginTop: 6,
  },
  sectionDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHint: {
    fontSize: 13,
  },
  exerciseItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  repsInfo: {
    fontSize: 14,
    fontWeight: '600',
  },
  restTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restPill: {
    fontSize: 13,
    fontWeight: '600',
  },
  expandedContent: {
    paddingTop: 16,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  largeImgWrap: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  largeImg: {
    width: '100%',
    height: '100%',
  },
  fullImgBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullImgBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandedDesc: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 14,
  },
  expandedTip: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    marginBottom: 16,
  },
  expandedTipText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  prActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  prActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  libraryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  planControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  planSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  planSelectorText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  planCountBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  editDayHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  editDayHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monoBannerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  monoBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monoBannerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  monoBannerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  monoBannerTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  monoBannerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  monoMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  monoMetaDot: {
    fontSize: 11,
  },
  emptyDayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  emptyDayTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyDaySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
