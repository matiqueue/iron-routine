import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { DayPlan, Exercise, SetEntry } from '../types/workout';
import { RestTimerBar } from './RestTimerBar';
import { ExerciseDetailModal } from './ExerciseDetailModal';

interface ActiveWorkoutViewProps {
  dayPlan: DayPlan;
  dayProgress: { sets: { [exerciseId: string]: { [setIndex: number]: SetEntry } } };
  onUpdateSet: (
    exerciseId: string,
    setIndex: number,
    data: Partial<SetEntry>,
    restSeconds: number
  ) => void;
  onFinishWorkout: () => void;
  onExitWorkout: () => void;
}

export const ActiveWorkoutView: React.FC<ActiveWorkoutViewProps> = ({
  dayPlan,
  dayProgress,
  onUpdateSet,
  onFinishWorkout,
  onExitWorkout,
}) => {
  const { theme, isDark } = useAppTheme();
  const exercises = dayPlan.exercises || [];
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [detailModalExercise, setDetailModalExercise] = useState<Exercise | null>(null);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerLabel, setTimerLabel] = useState('');

  // Elapsed
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentExercise = exercises[currentExerciseIndex] || exercises[0];
  const nextExercise = exercises[currentExerciseIndex + 1];

  const totalSets = useMemo(
    () => exercises.reduce((acc, ex) => acc + ex.sets, 0),
    [exercises]
  );

  const completedSetsCount = useMemo(() => {
    let count = 0;
    for (const ex of exercises) {
      const setsObj = dayProgress.sets[ex.id] || {};
      for (const s of Object.values(setsObj)) {
        if (s?.completed) count++;
      }
    }
    return count;
  }, [exercises, dayProgress]);

  const progressPercent = totalSets > 0 ? Math.round((completedSetsCount / totalSets) * 100) : 0;

  const handleToggleSet = (setIdx: number) => {
    if (!currentExercise) return;
    const currentEntry = dayProgress.sets[currentExercise.id]?.[setIdx] || { completed: false };
    const willBeCompleted = !currentEntry.completed;

    try {
      if (willBeCompleted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}

    onUpdateSet(
      currentExercise.id,
      setIdx,
      { completed: willBeCompleted },
      currentExercise.rest
    );

    if (willBeCompleted) {
      setTimerSeconds(currentExercise.rest);
      setTimerLabel(`Przerwa po serii ${setIdx + 1}`);
      setTimerActive(true);
    }
  };

  const handleUpdateWeight = (setIdx: number, val: string) => {
    if (!currentExercise) return;
    onUpdateSet(currentExercise.id, setIdx, { weight: val }, 0);
  };

  const handleUpdateReps = (setIdx: number, val: string) => {
    if (!currentExercise) return;
    onUpdateSet(currentExercise.id, setIdx, { reps: val }, 0);
  };

  const handlePromptExit = () => {
    Alert.alert(
      'Przerwać trening?',
      'Dotychczasowy postęp w seriach jest bezpiecznie zapisany.',
      [
        { text: 'Kontynuuj', style: 'cancel' },
        { text: 'Wyjdź', style: 'destructive', onPress: onExitWorkout },
      ]
    );
  };

  if (!currentExercise) return null;

  const currentExerciseSets = dayProgress.sets[currentExercise.id] || {};

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { borderBottomColor: theme.hairline }]}>
        <TouchableOpacity onPress={handlePromptExit} style={styles.exitBtn} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color={theme.text} />
          <Text style={[styles.exitBtnText, { color: theme.text }]}>Wyjdź</Text>
        </TouchableOpacity>

        <View style={[styles.stopwatchPill, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <Ionicons name="stopwatch-outline" size={14} color={theme.textMuted} />
          <Text style={[styles.stopwatchText, { color: theme.text }]}>{formatTime(elapsedSeconds)}</Text>
        </View>

        <TouchableOpacity
          onPress={() => setDetailModalExercise(currentExercise)}
          style={[styles.infoBtn, { backgroundColor: theme.bgSecondary }]}
          activeOpacity={0.7}
        >
          <Ionicons name="information-circle-outline" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Thin Progress line */}
      <View style={[styles.progressTrack, { backgroundColor: theme.bgTertiary }]}>
        <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: theme.text }]} />
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Exercise Header */}
        <View style={styles.exerciseHeader}>
          <View style={styles.metaRow}>
            <Text style={[styles.catBadgeText, { color: theme.textMuted }]}>
              {currentExercise.category.toUpperCase()} • ĆWICZENIE {currentExerciseIndex + 1} Z {exercises.length}
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: theme.text }]}>{currentExercise.name}</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Cel: {currentExercise.sets} serie × {currentExercise.reps} • {currentExercise.rest}s przerwy
          </Text>

          {/* Quick buttons */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
              onPress={() => setDetailModalExercise(currentExercise)}
              activeOpacity={0.8}
            >
              <Ionicons name="image-outline" size={14} color={theme.text} />
              <Text style={[styles.quickBtnText, { color: theme.text }]}>Technika & foto</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickBtn, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
              onPress={() => {
                setTimerSeconds(currentExercise.rest);
                setTimerLabel(currentExercise.name);
                setTimerActive(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="timer-outline" size={14} color={theme.text} />
              <Text style={[styles.quickBtnText, { color: theme.text }]}>Włącz stoper ({currentExercise.rest}s)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sets List */}
        <View style={[styles.tableContainer, { borderTopColor: theme.hairline, borderBottomColor: theme.hairline }]}>
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, styles.thSet, { color: theme.textMuted }]}>SERIA</Text>
            <Text style={[styles.thText, styles.thTarget, { color: theme.textMuted }]}>CEL</Text>
            <Text style={[styles.thText, styles.thInput, { color: theme.textMuted }]}>KG</Text>
            <Text style={[styles.thText, styles.thInput, { color: theme.textMuted }]}>POWT.</Text>
            <Text style={[styles.thText, styles.thCheck, { color: theme.textMuted }]}>ZALICZ</Text>
          </View>

          {Array.from({ length: currentExercise.sets }).map((_, idx) => {
            const entry = currentExerciseSets[idx] || { completed: false };
            const isDone = !!entry.completed;

            return (
              <View
                key={idx}
                style={[
                  styles.setRow,
                  { borderTopColor: theme.hairline },
                  isDone && { backgroundColor: theme.bgSecondary },
                ]}
              >
                <View style={styles.thSet}>
                  <Text style={[styles.setNumberText, { color: isDone ? theme.text : theme.textMuted }]}>
                    {idx + 1}
                  </Text>
                </View>

                <View style={styles.thTarget}>
                  <Text style={[styles.targetRepsVal, { color: theme.textSecondary }]}>
                    {currentExercise.reps}
                  </Text>
                </View>

                <View style={styles.thInput}>
                  <TextInput
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.bgTertiary,
                        color: theme.text,
                        borderColor: isDone ? theme.text : theme.border,
                      },
                    ]}
                    placeholder="kg"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    value={entry.weight !== undefined ? String(entry.weight) : ''}
                    onChangeText={(val) => handleUpdateWeight(idx, val)}
                  />
                </View>

                <View style={styles.thInput}>
                  <TextInput
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: theme.bgTertiary,
                        color: theme.text,
                        borderColor: isDone ? theme.text : theme.border,
                      },
                    ]}
                    placeholder="powt."
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    value={entry.reps !== undefined ? String(entry.reps) : ''}
                    onChangeText={(val) => handleUpdateReps(idx, val)}
                  />
                </View>

                <View style={styles.thCheck}>
                  <TouchableOpacity
                    style={[
                      styles.checkBtn,
                      {
                        backgroundColor: isDone ? theme.primary : 'transparent',
                        borderColor: isDone ? theme.primary : theme.borderDark,
                      },
                    ]}
                    onPress={() => handleToggleSet(idx)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="checkmark"
                      size={16}
                      color={isDone ? theme.primaryText : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* Next exercise preview */}
        {nextExercise ? (
          <TouchableOpacity
            style={[styles.nextPreview, { borderColor: theme.hairline }]}
            onPress={() => setCurrentExerciseIndex((prev) => prev + 1)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.nextPreviewLabel, { color: theme.textMuted }]}>
                NASTĘPNE ĆWICZENIE
              </Text>
              <Text style={[styles.nextPreviewName, { color: theme.text }]}>
                {nextExercise.name}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        ) : null}

        {/* Navigation bottom */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[
              styles.navBtn,
              { borderColor: theme.border },
              currentExerciseIndex === 0 && { opacity: 0.3 },
            ]}
            disabled={currentExerciseIndex === 0}
            onPress={() => setCurrentExerciseIndex((prev) => Math.max(0, prev - 1))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
            <Text style={[styles.navBtnText, { color: theme.text }]}>Poprzednie</Text>
          </TouchableOpacity>

          {currentExerciseIndex < exercises.length - 1 ? (
            <TouchableOpacity
              style={[styles.navBtnNext, { backgroundColor: theme.primary }]}
              onPress={() => setCurrentExerciseIndex((prev) => Math.min(exercises.length - 1, prev + 1))}
              activeOpacity={0.8}
            >
              <Text style={[styles.navBtnNextText, { color: theme.primaryText }]}>Następne</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primaryText} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: theme.primary }]}
              onPress={onFinishWorkout}
              activeOpacity={0.8}
            >
              <Text style={[styles.finishBtnText, { color: theme.primaryText }]}>
                ZAKOŃCZ TRENING
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating rest timer */}
      {timerActive && (
        <RestTimerBar
          initialSeconds={timerSeconds}
          exerciseName={timerLabel}
          onClose={() => setTimerActive(false)}
        />
      )}

      {/* Technique Modal */}
      <ExerciseDetailModal
        visible={detailModalExercise !== null}
        exercise={detailModalExercise}
        onClose={() => setDetailModalExercise(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exitBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  stopwatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  stopwatchText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  infoBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    height: 2,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  exerciseHeader: {
    paddingVertical: 18,
  },
  metaRow: {
    marginBottom: 6,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tableContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  thSet: {
    width: 32,
    alignItems: 'center',
  },
  thTarget: {
    width: 60,
    alignItems: 'center',
  },
  thInput: {
    flex: 1,
    paddingHorizontal: 4,
  },
  thCheck: {
    width: 44,
    alignItems: 'flex-end',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  targetRepsVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputBox: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  checkBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  nextPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  nextPreviewLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  nextPreviewName: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 50,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  navBtnNext: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 13,
    borderRadius: 12,
  },
  navBtnNextText: {
    fontSize: 13,
    fontWeight: '800',
  },
  finishBtn: {
    flex: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  finishBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
