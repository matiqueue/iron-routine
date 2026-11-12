import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { DayPlan, Exercise, SetEntry } from '../types/workout';
import { RestTimerBar } from './RestTimerBar';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { getLastExerciseMetrics } from '../services/storage';

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
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [detailModalExercise, setDetailModalExercise] = useState<Exercise | null>(null);

  // Timer
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(90);
  const [timerLabel, setTimerLabel] = useState('');
  const [timerNextInfo, setTimerNextInfo] = useState('');

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

  // Smart auto-fill from previous workouts
  const [lastMetrics, setLastMetrics] = useState<{ weight?: string; reps?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentExercise) {
      getLastExerciseMetrics(currentExercise.id).then((metrics) => {
        if (isMounted) setLastMetrics(metrics);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentExercise?.id]);

  // When changing exercise, jump to first uncompleted set
  useEffect(() => {
    if (currentExercise) {
      const setsObj = dayProgress.sets[currentExercise.id] || {};
      let firstIncomplete = 0;
      for (let i = 0; i < currentExercise.sets; i++) {
        if (!setsObj[i]?.completed) {
          firstIncomplete = i;
          break;
        }
      }
      setCurrentSetIndex(firstIncomplete);
    }
  }, [currentExerciseIndex, currentExercise?.id]);

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

  if (!currentExercise) return null;

  const currentExerciseSets = dayProgress.sets[currentExercise.id] || {};
  const activeEntry: SetEntry = currentExerciseSets[currentSetIndex] || { completed: false };
  const isCurrentSetDone = !!activeEntry.completed;

  // Resolved weight and reps for the active set
  const displayWeight =
    activeEntry.weight !== undefined
      ? String(activeEntry.weight)
      : lastMetrics?.weight !== undefined
      ? String(lastMetrics.weight)
      : '';

  const displayReps =
    activeEntry.reps !== undefined
      ? String(activeEntry.reps)
      : lastMetrics?.reps !== undefined
      ? String(lastMetrics.reps)
      : '';

  const handleUpdateActiveWeight = (val: string) => {
    onUpdateSet(currentExercise.id, currentSetIndex, { weight: val }, 0);
  };

  const handleUpdateActiveReps = (val: string) => {
    onUpdateSet(currentExercise.id, currentSetIndex, { reps: val }, 0);
  };

  const handleAdjustWeight = (delta: number) => {
    const curVal = parseFloat((displayWeight || '60').replace(',', '.')) || 0;
    const nextVal = Math.max(0, Math.round((curVal + delta) * 10) / 10);
    handleUpdateActiveWeight(String(nextVal));
    try {
      Haptics.selectionAsync();
    } catch {}
  };

  const handleAdjustReps = (delta: number) => {
    const curVal = parseInt(displayReps || '10', 10) || 0;
    const nextVal = Math.max(1, curVal + delta);
    handleUpdateActiveReps(String(nextVal));
    try {
      Haptics.selectionAsync();
    } catch {}
  };

  const handleFillFromLast = () => {
    if (!lastMetrics) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    if (lastMetrics.weight) handleUpdateActiveWeight(lastMetrics.weight);
    if (lastMetrics.reps) handleUpdateActiveReps(lastMetrics.reps);
  };

  // Complete current set and auto-advance to currentSetIndex + 1
  const handleCompleteActiveSet = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const weightToSave = displayWeight || '60';
    const repsToSave = displayReps || String(currentExercise.reps);

    // Save set as completed
    onUpdateSet(
      currentExercise.id,
      currentSetIndex,
      {
        completed: true,
        weight: weightToSave,
        reps: repsToSave,
      },
      currentExercise.rest
    );

    // Propagate forward to next empty sets so user has easy defaults
    for (let i = currentSetIndex + 1; i < currentExercise.sets; i++) {
      const nextS = currentExerciseSets[i];
      if (!nextS?.weight) {
        onUpdateSet(currentExercise.id, i, { weight: weightToSave, reps: repsToSave }, 0);
      }
    }

    const nextSetIdx = currentSetIndex + 1;
    const isExerciseFinished = nextSetIdx >= currentExercise.sets;

    // Trigger animated rest countdown
    setTimerSeconds(currentExercise.rest);
    setTimerLabel(currentExercise.name);
    setTimerNextInfo(
      !isExerciseFinished
        ? `Przed serią ${nextSetIdx + 1} z ${currentExercise.sets}`
        : nextExercise
        ? `Kolejne ćwiczenie: ${nextExercise.name}`
        : 'Wszystkie ćwiczenia ukończone!'
    );
    setTimerActive(true);

    // Auto-advance to next set
    if (!isExerciseFinished) {
      setCurrentSetIndex(nextSetIdx);
    }
  };

  const handleToggleCompleteManually = () => {
    const willBeCompleted = !isCurrentSetDone;
    try {
      if (willBeCompleted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.selectionAsync();
      }
    } catch {}

    onUpdateSet(
      currentExercise.id,
      currentSetIndex,
      { completed: willBeCompleted },
      currentExercise.rest
    );
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

  const allSetsOfExerciseDone = useMemo(() => {
    for (let i = 0; i < currentExercise.sets; i++) {
      if (!currentExerciseSets[i]?.completed) return false;
    }
    return true;
  }, [currentExerciseSets, currentExercise.sets]);

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

      {/* Progress track */}
      <View style={[styles.progressTrack, { backgroundColor: theme.bgTertiary }]}>
        <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: theme.text }]} />
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Exercise Header - Clean & Focused */}
        <View style={styles.exerciseHeader}>
          <Text style={[styles.catBadgeText, { color: theme.textMuted }]}>
            {currentExercise.category.toUpperCase()} • ĆWICZENIE {currentExerciseIndex + 1} Z {exercises.length}
          </Text>
          <Text style={[styles.heroTitle, { color: theme.text }]}>{currentExercise.name}</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
            Plan: {currentExercise.sets} serie × {currentExercise.reps} • {currentExercise.rest}s odpoczynku
          </Text>
        </View>

        {/* Series Stepper / Selector Row */}
        <View style={styles.seriesSelectorWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seriesScroll}>
            {Array.from({ length: currentExercise.sets }).map((_, idx) => {
              const isSelected = idx === currentSetIndex;
              const sEntry = currentExerciseSets[idx];
              const isDone = !!sEntry?.completed;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.seriesPill,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : isDone
                        ? theme.bgSecondary
                        : theme.bgTertiary,
                      borderColor: isSelected
                        ? theme.primary
                        : isDone
                        ? theme.borderDark
                        : theme.border,
                    },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCurrentSetIndex(idx);
                  }}
                  activeOpacity={0.7}
                >
                  {isDone ? (
                    <Ionicons
                      name="checkmark"
                      size={14}
                      color={isSelected ? theme.primaryText : theme.text}
                      style={{ marginRight: 4 }}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.seriesPillText,
                      {
                        color: isSelected
                          ? theme.primaryText
                          : isDone
                          ? theme.text
                          : theme.textMuted,
                      },
                    ]}
                  >
                    Seria {idx + 1}
                  </Text>
                  {sEntry?.weight ? (
                    <Text
                      style={[
                        styles.seriesPillWeight,
                        {
                          color: isSelected
                            ? theme.primaryText
                            : isDone
                            ? theme.textSecondary
                            : theme.textMuted,
                        },
                      ]}
                    >
                      • {sEntry.weight}kg
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ACTIVE SERIES FOCUS CARD */}
        <View style={[styles.focusCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          {/* Card Header: SERIA X Z Y */}
          <View style={styles.focusHeader}>
            <View>
              <Text style={[styles.focusTitle, { color: theme.text }]}>
                SERIA {currentSetIndex + 1} Z {currentExercise.sets}
              </Text>
              <Text style={[styles.focusSubtitle, { color: theme.textMuted }]}>
                Cel: {currentExercise.reps} powt. • {currentExercise.rest}s przerwy
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isCurrentSetDone ? theme.primary : theme.card,
                  borderColor: isCurrentSetDone ? theme.primary : theme.border,
                },
              ]}
              onPress={handleToggleCompleteManually}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isCurrentSetDone ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={isCurrentSetDone ? theme.primaryText : theme.textMuted}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isCurrentSetDone ? theme.primaryText : theme.textMuted },
                ]}
              >
                {isCurrentSetDone ? 'ZALICZONA' : 'W TRAKCIE'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Steppers: KG and REPS */}
          <View style={styles.inputsGrid}>
            {/* Weight Input Box with Stepper */}
            <View style={styles.inputCol}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>CIĘŻAR (KG)</Text>
              <View style={[styles.stepperBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                  onPress={() => handleAdjustWeight(-2.5)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>-2.5</Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.stepperInput, { color: theme.text }]}
                  keyboardType="decimal-pad"
                  value={displayWeight}
                  onChangeText={handleUpdateActiveWeight}
                  placeholder={lastMetrics?.weight || 'kg'}
                  placeholderTextColor={theme.textMuted}
                />

                <TouchableOpacity
                  style={[styles.stepBtn, { borderLeftColor: theme.hairline }]}
                  onPress={() => handleAdjustWeight(2.5)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>+2.5</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Reps Input Box with Stepper */}
            <View style={styles.inputCol}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>POWTÓRZENIA</Text>
              <View style={[styles.stepperBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                  onPress={() => handleAdjustReps(-1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>-1</Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.stepperInput, { color: theme.text }]}
                  keyboardType="number-pad"
                  value={displayReps}
                  onChangeText={handleUpdateActiveReps}
                  placeholder={lastMetrics?.reps || '10'}
                  placeholderTextColor={theme.textMuted}
                />

                <TouchableOpacity
                  style={[styles.stepBtn, { borderLeftColor: theme.hairline }]}
                  onPress={() => handleAdjustReps(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Last session subtle hint */}
          {lastMetrics && (lastMetrics.weight || lastMetrics.reps) && !isCurrentSetDone ? (
            <TouchableOpacity
              style={styles.cleanHintRow}
              onPress={handleFillFromLast}
              activeOpacity={0.7}
            >
              <Ionicons name="flash-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.cleanHintText, { color: theme.textMuted }]}>
                Ostatnio: {lastMetrics.weight ? `${lastMetrics.weight} kg` : ''}
                {lastMetrics.weight && lastMetrics.reps ? ' × ' : ''}
                {lastMetrics.reps ? `${lastMetrics.reps} powt.` : ''} • <Text style={{ color: theme.text, fontWeight: '700' }}>Wstaw dane ➔</Text>
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* MAIN SET ACTION BUTTON */}
          {!isCurrentSetDone ? (
            <TouchableOpacity
              style={[styles.completeSetBtn, { backgroundColor: theme.primary }]}
              onPress={handleCompleteActiveSet}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color={theme.primaryText} />
              <Text style={[styles.completeSetBtnText, { color: theme.primaryText }]}>
                ZALICZ SERIĘ {currentSetIndex + 1} Z {currentExercise.sets}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.completedActionsRow}>
              <TouchableOpacity
                style={[styles.undoBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleToggleCompleteManually}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={theme.text} />
                <Text style={[styles.undoBtnText, { color: theme.text }]}>Cofnij zaliczenie</Text>
              </TouchableOpacity>

              {currentSetIndex < currentExercise.sets - 1 ? (
                <TouchableOpacity
                  style={[styles.nextSetBtn, { backgroundColor: theme.primary }]}
                  onPress={() => setCurrentSetIndex((prev) => prev + 1)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.nextSetBtnText, { color: theme.primaryText }]}>
                    Seria {currentSetIndex + 2} ➔
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>

        {/* Bottom Navigation */}
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
              <Text style={[styles.navBtnNextText, { color: theme.primaryText }]}>
                {nextExercise ? `Następne: ${nextExercise.name.split(' ')[0]}` : 'Następne'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.primaryText} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: theme.primary }]}
              onPress={onFinishWorkout}
              activeOpacity={0.8}
            >
              <Text style={[styles.finishBtnText, { color: theme.primaryText }]}>ZAKOŃCZ TRENING</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Modern Animated Rest Countdown Modal */}
      {timerActive && (
        <RestTimerBar
          initialSeconds={timerSeconds}
          exerciseName={timerLabel}
          nextSetInfo={timerNextInfo}
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
    paddingVertical: 16,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 27,
  },
  heroSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  quickBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
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
  seriesSelectorWrap: {
    marginBottom: 14,
  },
  seriesScroll: {
    gap: 8,
  },
  seriesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  seriesPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  seriesPillWeight: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  focusCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  focusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  focusTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  focusSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cleanHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    marginBottom: 8,
  },
  cleanHintText: {
    fontSize: 12,
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  inputCol: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 52,
  },
  stepBtn: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepperInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  quickAdjustRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  quickPill: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  completeSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
  },
  completeSetBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  completedActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  undoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
  },
  undoBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextSetBtn: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
  },
  nextSetBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  summarySection: {
    marginBottom: 20,
  },
  summaryHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summarySetText: {
    fontSize: 13,
    fontWeight: '800',
  },
  summaryMetrics: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryPending: {
    fontSize: 12,
  },
  summaryRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  doneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  doneTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editHint: {
    fontSize: 12,
    fontWeight: '700',
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
