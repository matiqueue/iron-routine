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
                <Text style={styles.dayEmoji}>{day.emoji}</Text>
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
                { backgroundColor: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.45)' },
              ]}
            >
              <View style={styles.bannerBadge}>
                <Text style={styles.bannerBadgeText}>
                  {currentPlan.badgeEmoji} {currentPlan.type === 'rest' ? 'REGENERACJA' : 'TRENING SIŁOWY'}
                </Text>
              </View>
              <Text style={styles.bannerTitle}>{currentPlan.name}</Text>
              <Text style={styles.bannerSubtitle}>{currentPlan.subtitle}</Text>
              <View style={styles.bannerMetaRow}>
                <Text style={styles.bannerMetaText}>⏱️ {currentPlan.time}</Text>
                {currentPlan.exercises && (
                  <>
                    <Text style={styles.bannerMetaDot}>•</Text>
                    <Text style={styles.bannerMetaText}>🎯 {currentPlan.exercises.length} ćwiczeń</Text>
                    <Text style={styles.bannerMetaDot}>•</Text>
                    <Text style={styles.bannerMetaText}>
                      ⚡ {currentPlan.exercises.reduce((acc, e) => acc + e.sets, 0)} serii
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
            <Text style={styles.warmupIcon}>💡</Text>
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

            {currentPlan.exercises.map((exercise, index) => {
              const isExpanded = expandedExerciseId === exercise.id;

              return (
                <View
                  key={exercise.id}
                  style={[
                    styles.exerciseItem,
                    { borderBottomColor: theme.hairline },
                    isExpanded && { backgroundColor: theme.bgSecondary, borderRadius: 14, marginVertical: 6 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.exerciseHeaderRow}
                    onPress={() => toggleExpand(exercise.id)}
                    activeOpacity={0.7}
                  >
                    {/* Thumbnail Image */}
                    {exercise.imageUrl ? (
                      <Image
                        source={{ uri: exercise.imageUrl }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.bgTertiary }]}>
                        <Ionicons name="barbell-outline" size={18} color={theme.textMuted} />
                      </View>
                    )}

                    <View style={styles.exerciseInfo}>
                      <Text style={[styles.exerciseName, { color: theme.text }]}>
                        {exercise.name}
                      </Text>
                      <View style={styles.metaRow}>
                        <View style={[styles.categoryTag, { backgroundColor: theme.bgTertiary }]}>
                          <Text style={[styles.categoryTagText, { color: theme.textSecondary }]}>
                            {exercise.category.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.repsInfo, { color: theme.textSecondary }]}>
                          {exercise.sets} serie × {exercise.reps}
                        </Text>
                        <Text style={[styles.restPill, { color: theme.textMuted }]}>
                          ⏱️ {exercise.rest}s
                        </Text>
                      </View>
                    </View>

                    <Ionicons
                      name={isExpanded ? 'chevron-up-circle' : 'chevron-down'}
                      size={20}
                      color={isExpanded ? theme.text : theme.textMuted}
                    />
                  </TouchableOpacity>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Full preview image */}
                      <View style={styles.largeImgWrap}>
                        <Image
                          source={{ uri: exercise.imageUrl }}
                          style={styles.largeImg}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={[styles.fullImgBtn, { backgroundColor: isDark ? '#000' : '#FFF' }]}
                          onPress={() => setModalExercise(exercise)}
                        >
                          <Ionicons name="expand" size={13} color={theme.text} />
                          <Text style={[styles.fullImgBtnText, { color: theme.text }]}>
                            Pełny opis
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={[styles.expandedDesc, { color: theme.textSecondary }]}>
                        {exercise.description}
                      </Text>

                      {exercise.note ? (
                        <View style={[styles.expandedTip, { borderLeftColor: theme.text }]}>
                          <Text style={[styles.expandedTipText, { color: theme.textMuted }]}>
                            💡 {exercise.note}
                          </Text>
                        </View>
                      ) : null}

                      {onSelectExerciseForPR && (
                        <TouchableOpacity
                          style={[styles.prActionBtn, { backgroundColor: theme.primary }]}
                          onPress={() => onSelectExerciseForPR(exercise)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="trophy-outline" size={15} color={theme.primaryText} />
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
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  daySelectorWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    marginTop: 6,
  },
  daySelectorScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 58,
    gap: 2,
  },
  dayEmoji: {
    fontSize: 14,
  },
  dayShort: {
    fontSize: 13,
    fontWeight: '800',
  },
  daySub: {
    fontSize: 9,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 60,
  },
  bannerWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 18,
    justifyContent: 'flex-end',
  },
  bannerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  bannerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  bannerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  bannerMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bannerMetaDot: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  warmupNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  warmupIcon: {
    fontSize: 18,
  },
  warmupTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  warmupDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
  },
  startWorkoutBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  exerciseSection: {
    marginTop: 4,
  },
  sectionDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHint: {
    fontSize: 11,
  },
  exerciseItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  thumbnailPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  repsInfo: {
    fontSize: 12,
    fontWeight: '600',
  },
  restPill: {
    fontSize: 11,
  },
  expandedContent: {
    paddingTop: 12,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  largeImgWrap: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  largeImg: {
    width: '100%',
    height: '100%',
  },
  fullImgBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fullImgBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  expandedDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  expandedTip: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginBottom: 14,
  },
  expandedTipText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  prActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  prActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
