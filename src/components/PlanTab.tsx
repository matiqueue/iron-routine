import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { DAYS_OF_WEEK, WORKOUT_PLAN } from '../data/planData';
import { Exercise, DayPlan } from '../types/workout';
import { ExerciseDetailModal } from './ExerciseDetailModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PlanTabProps {
  onSelectExerciseForPR?: (exercise: Exercise) => void;
  onStartWorkoutForDay?: (dayId: string) => void;
}

export const PlanTab: React.FC<PlanTabProps> = ({
  onSelectExerciseForPR,
  onStartWorkoutForDay,
}) => {
  const { theme, isDark } = useAppTheme();
  const [selectedDayId, setSelectedDayId] = useState<string>('mon');
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [modalExercise, setModalExercise] = useState<Exercise | null>(null);

  const currentPlan: DayPlan =
    WORKOUT_PLAN.find((d) => d.id === selectedDayId) || WORKOUT_PLAN[0];

  const toggleExpand = (id: string) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedExerciseId((prev) => (prev === id ? null : id));
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Editorial Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Plan treningowy</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Rozkład tygodnia • Technika • Progres
        </Text>
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
            const plan = WORKOUT_PLAN.find((p) => p.id === day.id);
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
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedDayId(day.id);
                  setExpandedExerciseId(null);
                }}
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
        {/* Banner with image */}
        {currentPlan.bannerUrl ? (
          <View style={styles.bannerWrapper}>
            <Image
              source={{ uri: currentPlan.bannerUrl }}
              style={styles.bannerImage}
              resizeMode="cover"
            />
            <View
              style={[
                styles.bannerOverlay,
                { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.52)' },
              ]}
            >
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>
                  {currentPlan.type === 'rest' ? 'REGENERACJA' : 'TRENING SIŁOWY'}
                </Text>
              </View>
              <Text style={styles.bannerTitle}>{currentPlan.name}</Text>
              <Text style={styles.bannerSubtitle}>{currentPlan.subtitle}</Text>
              <View style={styles.bannerMetaRow}>
                <View style={styles.metaTimeWrap}>
                  <Ionicons name="time-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.bannerMetaText}>{currentPlan.time}</Text>
                </View>
                {currentPlan.exercises && (
                  <>
                    <Text style={styles.bannerMetaDot}>•</Text>
                    <Text style={styles.bannerMetaText}>{currentPlan.exercises.length} ćwiczeń</Text>
                    <Text style={styles.bannerMetaDot}>•</Text>
                    <Text style={styles.bannerMetaText}>
                      {currentPlan.exercises.reduce((acc, e) => acc + e.sets, 0)} serii
                    </Text>
                  </>
                )}
              </View>
            </View>
          </View>
        ) : null}

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
        {currentPlan.type === 'workout' && onStartWorkoutForDay && (
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

        {/* Exercise List */}
        {currentPlan.exercises && currentPlan.exercises.length > 0 && (
          <View style={styles.exerciseSection}>
            <View style={[styles.sectionDivider, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                ĆWICZENIA ({currentPlan.exercises.length})
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textMuted }]}>
                Dotknij, aby rozwinąć
              </Text>
            </View>

            {currentPlan.exercises.map((exercise) => {
              const isExpanded = expandedExerciseId === exercise.id;

              return (
                <View
                  key={exercise.id}
                  style={[
                    styles.exerciseItem,
                    { borderBottomColor: theme.hairline },
                    isExpanded && { backgroundColor: theme.bgSecondary, borderRadius: 16, marginVertical: 8, paddingHorizontal: 16 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.exerciseHeaderRow}
                    onPress={() => toggleExpand(exercise.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.exerciseInfo}>
                      <Text style={[styles.exerciseName, { color: theme.text }]}>
                        {exercise.name}
                      </Text>
                      <View style={styles.metaRow}>
                        <View style={[styles.categoryTag, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                          <Text style={[styles.categoryTagText, { color: theme.textSecondary }]}>
                            {exercise.category.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.repsInfo, { color: theme.textSecondary }]}>
                          {exercise.sets} serie × {exercise.reps}
                        </Text>
                        <View style={styles.restTagWrap}>
                          <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                          <Text style={[styles.restPill, { color: theme.textMuted }]}>
                            {exercise.rest}s
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={isExpanded ? theme.text : theme.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Expanded detail - ONLY SHOW IMAGE WHEN EXPANDED */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Full preview image */}
                      {exercise.imageUrl ? (
                        <View style={styles.largeImgWrap}>
                          <Image
                            source={{ uri: exercise.imageUrl }}
                            style={styles.largeImg}
                            resizeMode="cover"
                          />
                          <TouchableOpacity
                            style={[styles.fullImgBtn, { backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}
                            onPress={() => setModalExercise(exercise)}
                          >
                            <Ionicons name="expand" size={13} color={theme.text} />
                            <Text style={[styles.fullImgBtnText, { color: theme.text }]}>
                              Pełny opis
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}

                      <Text style={[styles.expandedDesc, { color: theme.textSecondary }]}>
                        {exercise.description}
                      </Text>

                      {exercise.note ? (
                        <View style={[styles.expandedTip, { borderLeftColor: theme.text }]}>
                          <Text style={[styles.expandedTipText, { color: theme.textMuted }]}>
                            {exercise.note}
                          </Text>
                        </View>
                      ) : null}

                      {onSelectExerciseForPR && (
                        <TouchableOpacity
                          style={[styles.prActionBtn, { backgroundColor: theme.primary }]}
                          onPress={() => onSelectExerciseForPR(exercise)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trophy-outline" size={16} color={theme.primaryText} />
                          <Text style={[styles.prActionBtnText, { color: theme.primaryText }]}>
                            Zapisz lub zobacz rekord w Osiągach
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ExerciseDetailModal
        visible={modalExercise !== null}
        exercise={modalExercise}
        onClose={() => setModalExercise(null)}
        onOpenPR={onSelectExerciseForPR}
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
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 85,
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
});
