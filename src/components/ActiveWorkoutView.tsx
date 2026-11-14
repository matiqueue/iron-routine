import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  Animated,
  PanResponder,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { DayPlan, DayProgress, Exercise, SessionExerciseConfig, SetEntry } from '../types/workout';
import { RestTimerBar } from './RestTimerBar';
import { AnimatedIcon } from './AnimatedIcon';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { ExerciseLibraryContent } from './ExerciseLibraryContent';
import { SessionExercisePickerModal } from './SessionExercisePickerModal';
import { calculate1RM, getLastExerciseMetrics } from '../services/storage';
import { cloneExercise } from '../data/exerciseLibrary';
import { resolveOrderedSessionExercises } from '../utils/sessionExercises';
import { updateWorkoutLiveActivity } from '../services/liveActivity';
import {
  cancelRestFinishedNotification,
  ensureNotificationPermissions,
  scheduleRestFinishedNotification,
} from '../services/notifications';
import { getAppSettings } from '../services/settings';
import {
  triggerImpactHaptic,
  triggerNotificationHaptic,
  triggerSelectionHaptic,
} from '../services/haptics';

export interface ActiveWorkoutFinishSummary {
  durationMinutes: number;
  totalVolumeKg: number;
  exercises: Exercise[];
  completedSets: number;
  totalSets: number;
}

interface ActiveWorkoutViewProps {
  dayPlan: DayPlan;
  profileId?: string;
  extraLibraryExercises?: Exercise[];
  dayProgress: DayProgress;
  autoOpenSessionPicker?: boolean;
  onUpdateSet: (
    exerciseId: string,
    setIndex: number,
    data: Partial<SetEntry>,
    restSeconds: number
  ) => void;
  onSaveSessionConfig?: (config: SessionExerciseConfig) => void;
  onFinishWorkout: (summary?: ActiveWorkoutFinishSummary) => void;
  onExitWorkout: () => void;
}

const getSetRows = (totalSets: number): number[][] => {
  if (totalSets <= 3) {
    return [Array.from({ length: totalSets }, (_, i) => i)];
  }
  if (totalSets === 4) {
    return [[0, 1], [2, 3]];
  }
  if (totalSets === 5) {
    return [[0, 1, 2], [3, 4]];
  }
  if (totalSets === 6) {
    return [[0, 1, 2], [3, 4, 5]];
  }
  const perRow = totalSets > 6 ? 4 : 3;
  const rows: number[][] = [];
  for (let i = 0; i < totalSets; i += perRow) {
    const row: number[] = [];
    for (let j = i; j < Math.min(i + perRow, totalSets); j++) {
      row.push(j);
    }
    rows.push(row);
  }
  return rows;
};

export const ActiveWorkoutView: React.FC<ActiveWorkoutViewProps> = ({
  dayPlan,
  profileId,
  extraLibraryExercises = [],
  dayProgress,
  autoOpenSessionPicker = false,
  onUpdateSet,
  onSaveSessionConfig,
  onFinishWorkout,
  onExitWorkout,
}) => {
  const { theme, isDark } = useAppTheme();
  const [allSessionExercises, setAllSessionExercises] = useState<Exercise[]>(() =>
    resolveOrderedSessionExercises(dayPlan.exercises || [], dayProgress.sessionConfig)
  );
  const [skippedIds, setSkippedIds] = useState<string[]>(
    () => dayProgress.sessionConfig?.skippedIds || []
  );
  const [showSessionPicker, setShowSessionPicker] = useState<boolean>(autoOpenSessionPicker);
  const [sessionPickerMode, setSessionPickerMode] = useState<'start' | 'edit'>(
    autoOpenSessionPicker ? 'start' : 'edit'
  );

  const exercises = useMemo(() => {
    const skippedSet = new Set(skippedIds);
    const filtered = allSessionExercises.filter((ex) => !skippedSet.has(ex.id));
    return filtered.length > 0 ? filtered : allSessionExercises;
  }, [allSessionExercises, skippedIds]);

  const [extraSetsMap, setExtraSetsMap] = useState<{ [exId: string]: number }>({});
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [detailModalExercise, setDetailModalExercise] = useState<Exercise | null>(null);

  // Session overview & ad-hoc exercise drawer (single modal avoids stacked RN modal bug on iOS)
  const [showOverviewSheet, setShowOverviewSheet] = useState(false);
  const [overviewMode, setOverviewMode] = useState<'list' | 'library'>('list');
  const [swapExerciseIdx, setSwapExerciseIdx] = useState<number | null>(null);

  const prevDayPlanIdRef = useRef(dayPlan.id);
  useEffect(() => {
    setAllSessionExercises(
      resolveOrderedSessionExercises(dayPlan.exercises || [], dayProgress.sessionConfig)
    );
    setSkippedIds(dayProgress.sessionConfig?.skippedIds || []);
    setExtraSetsMap({});
    setCurrentExerciseIndex(0);
    setCurrentSetIndex(0);
  }, [dayPlan.id]);

  useEffect(() => {
    getAppSettings().then((s) => {
      if (s.restNotificationsEnabled) {
        ensureNotificationPermissions(true);
      }
    });
    return () => {
      cancelRestFinishedNotification();
    };
  }, []);

  // Rest Timer State
  const [isResting, setIsResting] = useState(false);
  const [isRestFinished, setIsRestFinished] = useState(false);
  const [isRestModalVisible, setIsRestModalVisible] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState(90);
  const [restModalSeedSecs, setRestModalSeedSecs] = useState(90);
  const [restModalTargetMs, setRestModalTargetMs] = useState<number | undefined>(undefined);
  const [timerLabel, setTimerLabel] = useState('');
  const [timerNextInfo, setTimerNextInfo] = useState('');
  const restEndTimeRef = useRef<number>(0);
  const restFinishNotifiedRef = useRef(false);

  // Background-persistent tick for rest timer (no in-app haptic; background alarm handles outside-app alert)
  useEffect(() => {
    if (!isResting) return;

    const tick = () => {
      const diff = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      setRestSecondsLeft(diff);
      if (diff <= 0) {
        setIsResting(false);
        setIsRestFinished(true);
        if (!restFinishNotifiedRef.current) {
          restFinishNotifiedRef.current = true;
          if (AppState.currentState === 'active') {
            cancelRestFinishedNotification();
          }
        }
      }
    };

    tick();
    const interval = setInterval(tick, 500);

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        tick();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isResting]);

  // Elapsed
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Animations: directional slide & crossfade for exercise changes
  const exerciseSlideAnim = useRef(new Animated.Value(0)).current;
  const exerciseFadeAnim = useRef(new Animated.Value(1)).current;
  // Animations: spring scale & fade for switching sets within active exercise
  const cardScaleAnim = useRef(new Animated.Value(1)).current;
  const cardFadeAnim = useRef(new Animated.Value(1)).current;
  // Animations: tactile bounce for complete set button
  const completeBtnScale = useRef(new Animated.Value(1)).current;
  const isTransitioningRef = useRef(false);

  // Directional exercise change with smooth physics
  const handleTransitionExercise = (targetIndex: number) => {
    if (
      targetIndex < 0 ||
      targetIndex >= exercises.length ||
      targetIndex === currentExerciseIndex ||
      isTransitioningRef.current
    ) {
      return;
    }

    triggerImpactHaptic('light');

    const direction = targetIndex > currentExerciseIndex ? 1 : -1;
    isTransitioningRef.current = true;

    // Slide out in navigation direction
    Animated.parallel([
      Animated.timing(exerciseSlideAnim, {
        toValue: -32 * direction,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(exerciseFadeAnim, {
        toValue: 0.1,
        duration: 110,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentExerciseIndex(targetIndex);

      // Start position for incoming exercise
      exerciseSlideAnim.setValue(32 * direction);
      exerciseFadeAnim.setValue(0.1);

      // Slide in from opposite side with snappy spring
      Animated.parallel([
        Animated.spring(exerciseSlideAnim, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(exerciseFadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(() => {
        isTransitioningRef.current = false;
      });
    });
  };

  // Series change animation
  const handleChangeSetIndex = (newSetIdx: number) => {
    if (newSetIdx === currentSetIndex) return;
    triggerSelectionHaptic();

    cardScaleAnim.setValue(0.96);
    cardFadeAnim.setValue(0.55);
    setCurrentSetIndex(newSetIdx);

    Animated.parallel([
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 65,
        useNativeDriver: true,
      }),
      Animated.timing(cardFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Header swipe responder: horizontal flick to navigate exercises
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -40) {
          handleTransitionExercise(currentExerciseIndex + 1);
        } else if (gesture.dx > 40) {
          handleTransitionExercise(currentExerciseIndex - 1);
        }
      },
    })
  ).current;

  const workoutStartTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!workoutStartTimeRef.current) {
      workoutStartTimeRef.current = Date.now();
    }
    const updateElapsed = () => {
      const diff = Math.floor((Date.now() - workoutStartTimeRef.current) / 1000);
      setElapsedSeconds(Math.max(0, diff));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateElapsed();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentExercise = exercises[currentExerciseIndex] || exercises[0];
  const currentExerciseId = currentExercise?.id;
  const currentExerciseName = currentExercise?.name;
  const nextExercise = exercises[currentExerciseIndex + 1];

  const dayProgressRef = useRef(dayProgress);
  const extraSetsMapRef = useRef(extraSetsMap);
  const currentExerciseRef = useRef(currentExercise);
  useEffect(() => {
    dayProgressRef.current = dayProgress;
    extraSetsMapRef.current = extraSetsMap;
    currentExerciseRef.current = currentExercise;
  }, [dayProgress, extraSetsMap, currentExercise]);

  // Smart auto-fill from previous workouts
  const [lastMetrics, setLastMetrics] = useState<{ weight?: string; reps?: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentExerciseId) {
      getLastExerciseMetrics(currentExerciseId, profileId).then((metrics) => {
        if (isMounted) setLastMetrics(metrics);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentExerciseId, profileId]);

  const getEffectiveSets = useCallback(
    (ex: Exercise): number => {
      const extra = extraSetsMap[ex.id] || 0;
      const loggedIndices = Object.keys(dayProgress.sets[ex.id] || {}).map((k) => Number(k));
      const maxLogged = loggedIndices.length > 0 ? Math.max(...loggedIndices) + 1 : 0;
      return Math.max(ex.sets + extra, maxLogged);
    },
    [extraSetsMap, dayProgress.sets]
  );

  const currentTotalSets = currentExercise ? getEffectiveSets(currentExercise) : 0;

  // When changing exercise, jump to first uncompleted set
  useEffect(() => {
    const activeEx = currentExerciseRef.current;
    if (!activeEx) return;
    const setsObj = dayProgressRef.current.sets[activeEx.id] || {};
    const extra = extraSetsMapRef.current[activeEx.id] || 0;
    const loggedIndices = Object.keys(setsObj).map((k) => Number(k));
    const maxLogged = loggedIndices.length > 0 ? Math.max(...loggedIndices) + 1 : 0;
    const effSets = Math.max(activeEx.sets + extra, maxLogged);
    let firstIncomplete = 0;
    for (let i = 0; i < effSets; i++) {
      if (!setsObj[i]?.completed) {
        firstIncomplete = i;
        break;
      }
    }
    setCurrentSetIndex(firstIncomplete);
  }, [currentExerciseIndex, currentExerciseId]);

  const totalSets = useMemo(
    () => exercises.reduce((acc, ex) => acc + getEffectiveSets(ex), 0),
    [exercises, getEffectiveSets]
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

  // Synchronize Live Activity on Lock Screen and Dynamic Island
  useEffect(() => {
    if (!currentExerciseId || !currentExerciseName) return;

    if (isResting && restEndTimeRef.current > Date.now()) {
      const secsRemaining = Math.max(1, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      updateWorkoutLiveActivity({
        workoutName: dayPlan.name,
        exerciseName: currentExerciseName,
        currentSet: currentSetIndex + 1,
        totalSets: currentTotalSets,
        completedSets: completedSetsCount,
        totalWorkoutSets: totalSets,
        isRest: true,
        isRestFinished: false,
        restSeconds: secsRemaining,
        nextExerciseName: timerNextInfo,
      });
    } else if (isRestFinished) {
      updateWorkoutLiveActivity({
        workoutName: dayPlan.name,
        exerciseName: currentExerciseName,
        currentSet: currentSetIndex + 1,
        totalSets: currentTotalSets,
        completedSets: completedSetsCount,
        totalWorkoutSets: totalSets,
        isRest: true,
        isRestFinished: true,
        restSeconds: 0,
        nextExerciseName: timerNextInfo,
      });
    } else {
      updateWorkoutLiveActivity({
        workoutName: dayPlan.name,
        exerciseName: currentExerciseName,
        currentSet: currentSetIndex + 1,
        totalSets: currentTotalSets,
        completedSets: completedSetsCount,
        totalWorkoutSets: totalSets,
        isRest: false,
        isRestFinished: false,
      });
    }
  }, [
    currentExerciseId,
    currentExerciseName,
    currentTotalSets,
    currentSetIndex,
    completedSetsCount,
    totalSets,
    isResting,
    isRestFinished,
    restModalTargetMs,
    dayPlan.name,
    timerNextInfo,
  ]);

  const currentExerciseSets = useMemo(
    () => (currentExerciseId ? dayProgress.sets[currentExerciseId] || {} : {}),
    [currentExerciseId, dayProgress.sets]
  );
  const activeEntry: SetEntry = currentExerciseSets[currentSetIndex] || { completed: false };
  const isCurrentSetDone = !!activeEntry.completed;

  // Local synchronous draft state prevents TextInput resets/overwrites while typing or clearing
  const draftKey = `${currentExerciseId || ''}_${currentSetIndex}`;
  const prevDraftKeyRef = useRef<string>('');
  const hasEditedWeightRef = useRef<boolean>(false);
  const hasEditedRepsRef = useRef<boolean>(false);

  const resolvedSavedWeight =
    activeEntry.weight !== undefined
      ? String(activeEntry.weight)
      : lastMetrics?.weight !== undefined
      ? String(lastMetrics.weight)
      : '';

  const resolvedSavedReps =
    activeEntry.reps !== undefined
      ? String(activeEntry.reps)
      : lastMetrics?.reps !== undefined
      ? String(lastMetrics.reps)
      : '';

  const [weightDraft, setWeightDraft] = useState<string>(resolvedSavedWeight);
  const [repsDraft, setRepsDraft] = useState<string>(resolvedSavedReps);

  useEffect(() => {
    if (prevDraftKeyRef.current !== draftKey) {
      prevDraftKeyRef.current = draftKey;
      hasEditedWeightRef.current = false;
      hasEditedRepsRef.current = false;
      setWeightDraft(resolvedSavedWeight);
      setRepsDraft(resolvedSavedReps);
      return;
    }

    if (!hasEditedWeightRef.current && weightDraft !== resolvedSavedWeight) {
      setWeightDraft(resolvedSavedWeight);
    }
    if (!hasEditedRepsRef.current && repsDraft !== resolvedSavedReps) {
      setRepsDraft(resolvedSavedReps);
    }
  }, [draftKey, resolvedSavedWeight, resolvedSavedReps, weightDraft, repsDraft]);

  const liveEst1RM = useMemo(() => {
    const w = parseFloat((weightDraft || '').replace(',', '.'));
    const r = parseInt(repsDraft || '', 10);
    if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) return 0;
    return calculate1RM(w, r);
  }, [weightDraft, repsDraft]);

  if (!currentExercise) return null;

  const handleUpdateActiveWeight = (val: string) => {
    hasEditedWeightRef.current = true;
    setWeightDraft(val);
    onUpdateSet(currentExercise.id, currentSetIndex, { weight: val }, 0);
  };

  const handleUpdateActiveReps = (val: string) => {
    hasEditedRepsRef.current = true;
    setRepsDraft(val);
    onUpdateSet(currentExercise.id, currentSetIndex, { reps: val }, 0);
  };

  const handleAdjustWeight = (delta: number) => {
    const baseStr = weightDraft !== '' ? weightDraft : lastMetrics?.weight || '60';
    const curVal = parseFloat(baseStr.replace(',', '.')) || 0;
    const nextVal = Math.max(0, Math.round((curVal + delta) * 10) / 10);
    handleUpdateActiveWeight(String(nextVal));
    triggerSelectionHaptic();
  };

  const handleAdjustReps = (delta: number) => {
    const baseStr = repsDraft !== '' ? repsDraft : lastMetrics?.reps || '10';
    const curVal = parseInt(baseStr, 10) || 0;
    const nextVal = Math.max(1, curVal + delta);
    handleUpdateActiveReps(String(nextVal));
    triggerSelectionHaptic();
  };

  const handleFillFromLast = () => {
    if (!lastMetrics) return;
    triggerSelectionHaptic();
    if (lastMetrics.weight) handleUpdateActiveWeight(lastMetrics.weight);
    if (lastMetrics.reps) handleUpdateActiveReps(lastMetrics.reps);
  };

  // Complete current set and auto-advance to currentSetIndex + 1
  const handleCompleteActiveSet = () => {
    triggerNotificationHaptic('success');

    // Tactile button punch animation
    Animated.sequence([
      Animated.timing(completeBtnScale, {
        toValue: 0.94,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(completeBtnScale, {
        toValue: 1,
        friction: 4,
        tension: 85,
        useNativeDriver: true,
      }),
    ]).start();

    const weightToSave = weightDraft !== '' ? weightDraft : lastMetrics?.weight || '60';
    const repsToSave = repsDraft !== '' ? repsDraft : lastMetrics?.reps || String(currentExercise.reps);

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
    for (let i = currentSetIndex + 1; i < currentTotalSets; i++) {
      const nextS = currentExerciseSets[i];
      if (!nextS?.weight) {
        onUpdateSet(currentExercise.id, i, { weight: weightToSave, reps: repsToSave }, 0);
      }
    }

    const nextSetIdx = currentSetIndex + 1;
    const isExerciseFinished = nextSetIdx >= currentTotalSets;

    // Trigger animated rest countdown + local notification
    const restDur = currentExercise.rest;
    const targetEndMs = Date.now() + restDur * 1000;
    restEndTimeRef.current = targetEndMs;
    restFinishNotifiedRef.current = false;
    setIsRestFinished(false);
    setRestSecondsLeft(restDur);
    setRestModalSeedSecs(restDur);
    setRestModalTargetMs(targetEndMs);
    setTimerLabel(currentExercise.name);
    const nextInfoStr = !isExerciseFinished
      ? `Przed serią ${nextSetIdx + 1} z ${currentTotalSets}`
      : nextExercise
      ? `Kolejne ćwiczenie: ${nextExercise.name}`
      : 'Wszystkie ćwiczenia ukończone!';
    setTimerNextInfo(nextInfoStr);
    setIsResting(true);
    setIsRestModalVisible(true);
    scheduleRestFinishedNotification(restDur, currentExercise.name, nextInfoStr);

    // Auto-advance to next set with spring animation
    if (!isExerciseFinished) {
      handleChangeSetIndex(nextSetIdx);
    }
  };

  const handleFinishRestExplicitly = () => {
    triggerNotificationHaptic('success');
    cancelRestFinishedNotification();
    restFinishNotifiedRef.current = false;
    setIsResting(false);
    setIsRestFinished(false);
    setRestModalTargetMs(undefined);
    setIsRestModalVisible(false);
  };

  const handleHideRestModal = () => {
    // Only minimizes the modal sheet - break continues running in background & on Dynamic Island!
    setIsRestModalVisible(false);
  };

  const handleToggleCompleteManually = () => {
    const willBeCompleted = !isCurrentSetDone;
    if (willBeCompleted) {
      triggerNotificationHaptic('success');
    } else {
      triggerSelectionHaptic();
    }

    onUpdateSet(
      currentExercise.id,
      currentSetIndex,
      { completed: willBeCompleted },
      currentExercise.rest
    );
  };

  const handleAddBonusSet = () => {
    triggerSelectionHaptic();
    const nextTarget = currentTotalSets + 1;
    setExtraSetsMap((prev) => ({
      ...prev,
      [currentExercise.id]: Math.max(0, nextTarget - currentExercise.sets),
    }));
    handleChangeSetIndex(nextTarget - 1);
  };

  const handleRemoveBonusSet = () => {
    if (currentTotalSets <= currentExercise.sets) return;
    triggerSelectionHaptic();
    const nextExtra = Math.max(0, (extraSetsMap[currentExercise.id] || 0) - 1);
    setExtraSetsMap((prev) => ({ ...prev, [currentExercise.id]: nextExtra }));
    if (currentSetIndex >= currentExercise.sets + nextExtra) {
      setCurrentSetIndex(Math.max(0, currentExercise.sets + nextExtra - 1));
    }
  };

  const handleTriggerFinish = () => {
    cancelRestFinishedNotification();
    let totalVolumeKg = 0;
    for (const ex of exercises) {
      const setsMap = dayProgress.sets[ex.id] || {};
      for (const sEntry of Object.values(setsMap)) {
        if (!sEntry?.completed) continue;
        const w = parseFloat(String(sEntry.weight || '').replace(',', '.'));
        const r = parseInt(String(sEntry.reps || ''), 10);
        if (!isNaN(w) && w > 0 && !isNaN(r) && r > 0) {
          totalVolumeKg += w * r;
        }
      }
    }

    onFinishWorkout({
      durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      totalVolumeKg: Math.round(totalVolumeKg),
      exercises,
      completedSets: completedSetsCount,
      totalSets,
    });
  };

  const handleApplySessionConfig = (config: SessionExerciseConfig) => {
    const reordered = resolveOrderedSessionExercises(allSessionExercises, config);
    const persistedAdded = reordered.filter(
      (ex) => !(dayPlan.exercises || []).some((base) => base.id === ex.id)
    );
    const mergedConfig: SessionExerciseConfig = {
      orderedIds: reordered.map((e) => e.id),
      skippedIds: config.skippedIds,
      addedExercises: persistedAdded.length > 0 ? persistedAdded : undefined,
    };

    setAllSessionExercises(reordered);
    setSkippedIds(config.skippedIds);
    onSaveSessionConfig?.(mergedConfig);

    const skippedSet = new Set(config.skippedIds);
    const activeAfter = reordered.filter((e) => !skippedSet.has(e.id));
    if (activeAfter.length > 0) {
      const currentPos = currentExercise
        ? activeAfter.findIndex((e) => e.id === currentExercise.id)
        : 0;
      setCurrentExerciseIndex(currentPos >= 0 ? currentPos : 0);
      setCurrentSetIndex(0);
    }
  };

  const handlePickSessionExercise = (picked: Exercise) => {
    triggerNotificationHaptic('success');
    const fresh = cloneExercise(picked);
    let nextAllList: Exercise[];

    if (swapExerciseIdx !== null) {
      const targetEx = exercises[swapExerciseIdx];
      nextAllList = allSessionExercises.map((item) =>
        targetEx && item.id === targetEx.id ? fresh : item
      );
      setAllSessionExercises(nextAllList);
      setCurrentExerciseIndex(swapExerciseIdx);
      setCurrentSetIndex(0);
    } else {
      const alreadyExists = allSessionExercises.some((e) => e.id === fresh.id);
      const nextItem = alreadyExists
        ? { ...fresh, id: `${fresh.id}_session_${Date.now()}` }
        : fresh;
      nextAllList = [...allSessionExercises, nextItem];
      setAllSessionExercises(nextAllList);
      const skippedSet = new Set(skippedIds);
      const nextActiveCount = nextAllList.filter((e) => !skippedSet.has(e.id)).length;
      setCurrentExerciseIndex(Math.max(0, nextActiveCount - 1));
      setCurrentSetIndex(0);
    }

    const persistedAdded = nextAllList.filter(
      (ex) => !(dayPlan.exercises || []).some((b) => b.id === ex.id)
    );
    onSaveSessionConfig?.({
      orderedIds: nextAllList.map((e) => e.id),
      skippedIds,
      addedExercises: persistedAdded.length > 0 ? persistedAdded : undefined,
    });

    setSwapExerciseIdx(null);
    setOverviewMode('list');
    setShowOverviewSheet(false);
  };

  const handlePromptExit = () => {
    Alert.alert(
      'Przerwać trening?',
      'Dotychczasowy postęp w seriach jest bezpiecznie zapisany.',
      [
        { text: 'Kontynuuj', style: 'cancel' },
        {
          text: 'Wyjdź',
          style: 'destructive',
          onPress: () => {
            cancelRestFinishedNotification();
            onExitWorkout();
          },
        },
      ]
    );
  };

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

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              setSessionPickerMode('edit');
              setShowSessionPicker(true);
            }}
            style={[styles.pickerPillBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="checkbox-outline" size={16} color={theme.text} />
            <Text style={[styles.pickerPillText, { color: theme.text }]} numberOfLines={1}>
              Wybór
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setOverviewMode('list');
              setSwapExerciseIdx(null);
              setShowOverviewSheet(true);
            }}
            style={[styles.infoBtn, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={20} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDetailModalExercise(currentExercise)}
            style={[styles.infoBtn, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress track */}
      <View style={[styles.progressTrack, { backgroundColor: theme.bgTertiary }]}>
        <View style={[styles.progressBar, { width: `${progressPercent}%`, backgroundColor: theme.text }]} />
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Animated Exercise Content Container */}
        <Animated.View
          style={{
            opacity: exerciseFadeAnim,
            transform: [{ translateX: exerciseSlideAnim }],
          }}
        >
          {/* Exercise Header - Clean, Focused & Swipeable */}
          <View style={styles.exerciseHeader} {...headerPanResponder.panHandlers}>
            <TouchableOpacity
              style={styles.catBadgeBtn}
              onPress={() => {
                setOverviewMode('list');
                setSwapExerciseIdx(null);
                setShowOverviewSheet(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.catBadgeText, { color: theme.textMuted }]}>
                {currentExercise.category.toUpperCase()} • ĆWICZENIE {currentExerciseIndex + 1} Z {exercises.length}
              </Text>
              <Ionicons name="chevron-down" size={13} color={theme.textMuted} />
            </TouchableOpacity>
            <Text style={[styles.heroTitle, { color: theme.text }]}>{currentExercise.name}</Text>
            <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Plan: {currentTotalSets} serie × {currentExercise.reps} • {currentExercise.rest}s odpoczynku
            </Text>
          </View>

          {/* Series Stepper / Selector Grid - No horizontal scroll, wrapping downward & stretching full width */}
          <View style={styles.seriesSelectorWrap}>
            {getSetRows(currentTotalSets).map((row, rIdx) => (
              <View key={rIdx} style={styles.seriesRow}>
                {row.map((idx) => {
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
                      onPress={() => handleChangeSetIndex(idx)}
                      activeOpacity={0.7}
                    >
                      {isDone ? (
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={isSelected ? theme.primaryText : theme.text}
                          style={{ marginRight: 3 }}
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
                        numberOfLines={1}
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
                          numberOfLines={1}
                        >
                          • {sEntry.weight}kg
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Dynamic Bonus Set Controls */}
          <View style={styles.bonusSetRow}>
            <TouchableOpacity
              style={[styles.bonusSetPill, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
              onPress={handleAddBonusSet}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={13} color={theme.text} />
              <Text style={[styles.bonusSetText, { color: theme.text }]}>Dodaj serię</Text>
            </TouchableOpacity>

            {(extraSetsMap[currentExercise.id] || 0) > 0 && (
              <TouchableOpacity
                style={[styles.bonusSetPill, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
                onPress={handleRemoveBonusSet}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={13} color={theme.textMuted} />
                <Text style={[styles.bonusSetText, { color: theme.textMuted }]}>Usuń dodatkową</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ACTIVE SERIES FOCUS CARD with Spring Bounce on Set Switch */}
          <Animated.View
            style={[
              styles.focusCard,
              {
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
                opacity: cardFadeAnim,
                transform: [{ scale: cardScaleAnim }],
              },
            ]}
          >
          {/* Card Header: SERIA X Z Y */}
          <View style={styles.focusHeader}>
            <View>
              <Text style={[styles.focusTitle, { color: theme.text }]}>
                SERIA {currentSetIndex + 1} Z {currentTotalSets}
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
                  value={weightDraft}
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
                  value={repsDraft}
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

          {/* Last session subtle hint + live 1RM */}
          {(lastMetrics && (lastMetrics.weight || lastMetrics.reps) && !isCurrentSetDone) || liveEst1RM > 0 ? (
            <View style={styles.hintAnd1rmRow}>
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
                    {lastMetrics.reps ? `${lastMetrics.reps}` : ''} • <Text style={{ color: theme.text, fontWeight: '700' }}>Wstaw ➔</Text>
                  </Text>
                </TouchableOpacity>
              ) : <View />}

              {liveEst1RM > 0 && (
                <Text style={[styles.live1rmText, { color: theme.textMuted }]}>
                  Szac. 1RM: <Text style={{ color: theme.text, fontWeight: '800' }}>~{liveEst1RM} kg</Text>
                </Text>
              )}
            </View>
          ) : null}

          {/* MAIN SET ACTION BUTTON */}
          {!isCurrentSetDone ? (
            <Animated.View style={{ transform: [{ scale: completeBtnScale }] }}>
              <TouchableOpacity
                style={[styles.completeSetBtn, { backgroundColor: theme.primary }]}
                onPress={handleCompleteActiveSet}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={20} color={theme.primaryText} />
                <Text style={[styles.completeSetBtnText, { color: theme.primaryText }]}>
                  ZALICZ SERIĘ {currentSetIndex + 1} Z {currentTotalSets}
                </Text>
              </TouchableOpacity>
            </Animated.View>
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

              {currentSetIndex < currentTotalSets - 1 ? (
                <TouchableOpacity
                  style={[styles.nextSetBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleChangeSetIndex(currentSetIndex + 1)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.nextSetBtnText, { color: theme.primaryText }]}>
                    Seria {currentSetIndex + 2} ➔
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </Animated.View>
      </Animated.View>

        {/* Bottom Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[
              styles.navBtn,
              { borderColor: theme.border },
              currentExerciseIndex === 0 && { opacity: 0.3 },
            ]}
            disabled={currentExerciseIndex === 0}
            onPress={() => handleTransitionExercise(currentExerciseIndex - 1)}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={16} color={theme.text} />
            <Text style={[styles.navBtnText, { color: theme.text }]}>Poprzednie</Text>
          </TouchableOpacity>

          {currentExerciseIndex < exercises.length - 1 ? (
            <TouchableOpacity
              style={[styles.navBtnNext, { backgroundColor: theme.primary }]}
              onPress={() => handleTransitionExercise(currentExerciseIndex + 1)}
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
              onPress={handleTriggerFinish}
              activeOpacity={0.8}
            >
              <Text style={[styles.finishBtnText, { color: theme.primaryText }]}>ZAKOŃCZ TRENING</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating Minimized Rest / Rest-Finished Alert Banner */}
      {(isResting || isRestFinished) && !isRestModalVisible && (
        <View style={styles.floatingRestContainer}>
          <TouchableOpacity
            style={[
              styles.floatingRestBar,
              {
                backgroundColor: isRestFinished ? theme.primary : theme.card,
                borderColor: isRestFinished ? theme.primary : theme.border,
              },
            ]}
            onPress={() => {
              setRestModalSeedSecs(restSecondsLeft);
              setRestModalTargetMs(isRestFinished ? Date.now() : restEndTimeRef.current);
              setIsRestModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.floatingRestLeft}>
              <View
                style={[
                  styles.floatingTimerBadge,
                  { backgroundColor: isRestFinished ? theme.primaryText : theme.primary },
                ]}
              >
                {isRestFinished ? (
                  <AnimatedIcon
                    name="notifications"
                    preset="bell"
                    size={16}
                    color={theme.primary}
                    active={true}
                  />
                ) : (
                  <Ionicons name="timer" size={16} color={theme.primaryText} />
                )}
              </View>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={[
                      styles.floatingTimerTime,
                      { color: isRestFinished ? theme.primaryText : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {isRestFinished ? 'KONIEC PRZERWY!' : formatTime(restSecondsLeft)}
                  </Text>
                  {!isRestFinished && (
                    <Text style={[styles.floatingTapHint, { color: theme.textMuted }]} numberOfLines={1}>
                      • Dotknij
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    styles.floatingTimerNext,
                    { color: isRestFinished ? theme.primaryText : theme.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {isRestFinished
                    ? 'Czas na kolejną serię!'
                    : timerNextInfo || 'Odpoczynek przed kolejną serią'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.floatingFinishBtn,
                {
                  backgroundColor: isRestFinished
                    ? theme.primaryText
                    : isDark
                    ? '#27272A'
                    : '#E5E5EA',
                  borderColor: isRestFinished ? theme.primaryText : theme.border,
                },
              ]}
              onPress={handleFinishRestExplicitly}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isRestFinished ? 'play' : 'checkmark-done'}
                size={14}
                color={isRestFinished ? theme.primary : theme.text}
              />
              <Text
                style={[
                  styles.floatingFinishBtnText,
                  { color: isRestFinished ? theme.primary : theme.text },
                ]}
              >
                {isRestFinished ? 'Start' : 'Zakończ'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}

      {/* Modern Animated Rest Countdown Modal */}
      {isRestModalVisible && (
        <RestTimerBar
          initialSeconds={restModalSeedSecs}
          targetEndTimeMs={restModalTargetMs}
          exerciseName={timerLabel}
          nextSetInfo={timerNextInfo}
          onSecondsChanged={(newSecs) => {
            const newEnd = Date.now() + newSecs * 1000;
            restEndTimeRef.current = newEnd;
            restFinishNotifiedRef.current = newSecs <= 0;
            setRestSecondsLeft(newSecs);
            setRestModalTargetMs(newEnd);
            if (newSecs > 0) {
              setIsRestFinished(false);
              setIsResting(true);
            }
            scheduleRestFinishedNotification(
              newSecs,
              timerLabel || currentExercise.name,
              timerNextInfo
            );
            updateWorkoutLiveActivity({
              workoutName: dayPlan.name,
              exerciseName: currentExercise.name,
              currentSet: currentSetIndex + 1,
              totalSets: currentTotalSets,
              completedSets: completedSetsCount,
              totalWorkoutSets: totalSets,
              isRest: true,
              restSeconds: newSecs,
              nextExerciseName: timerNextInfo,
            });
          }}
          onFinishRest={handleFinishRestExplicitly}
          onClose={handleHideRestModal}
        />
      )}

      {/* Session Overview & Ad-hoc Swap/Add Sheet */}
      <InteractiveBottomSheet
        visible={showOverviewSheet}
        onClose={() => {
          setOverviewMode('list');
          setSwapExerciseIdx(null);
          setShowOverviewSheet(false);
        }}
        title={
          overviewMode === 'library'
            ? swapExerciseIdx !== null
              ? 'Zamień ćwiczenie na dziś'
              : 'Dodaj ćwiczenie do sesji'
            : 'Przegląd sesji treningowej'
        }
        subtitle={
          overviewMode === 'library'
            ? 'Zmiana dotyczy tylko dzisiejszego treningu'
            : `${completedSetsCount}/${totalSets} ukończonych serii • ${formatTime(elapsedSeconds)}`
        }
        initialHeightPercent={0.88}
        headerRight={
          overviewMode === 'library' ? (
            <TouchableOpacity
              style={[
                styles.sheetBackPill,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() => {
                setSwapExerciseIdx(null);
                setOverviewMode('list');
              }}
            >
              <Ionicons name="arrow-back" size={14} color={theme.text} />
              <Text style={[styles.sheetBackText, { color: theme.text }]}>Wróć</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        {overviewMode === 'library' ? (
          <ExerciseLibraryContent
            mode={swapExerciseIdx !== null ? 'swap' : 'pick'}
            alreadyInDayIds={exercises.map((e) => e.id)}
            extraExercises={extraLibraryExercises}
            onSelectExercise={handlePickSessionExercise}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
            {exercises.map((ex, idx) => {
              const effTotal = getEffectiveSets(ex);
              const exSets = dayProgress.sets[ex.id] || {};
              const done = Object.values(exSets).filter((s) => s?.completed).length;
              const isCurrent = idx === currentExerciseIndex;

              return (
                <View
                  key={`${ex.id}_${idx}`}
                  style={[
                    styles.sessionRow,
                    {
                      backgroundColor: isCurrent ? theme.bgSecondary : 'transparent',
                      borderBottomColor: theme.hairline,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={{ flex: 1, paddingRight: 8 }}
                    onPress={() => {
                      setCurrentExerciseIndex(idx);
                      setShowOverviewSheet(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sessionExCat, { color: theme.textMuted }]}>
                      #{idx + 1} • {ex.category.toUpperCase()}
                    </Text>
                    <Text style={[styles.sessionExName, { color: theme.text }]}>{ex.name}</Text>
                    <Text style={[styles.sessionExStatus, { color: theme.textSecondary }]}>
                      {done}/{effTotal} serii • {ex.reps} powt.
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.swapMiniBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => {
                      setSwapExerciseIdx(idx);
                      setOverviewMode('library');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="swap-horizontal" size={14} color={theme.text} />
                    <Text style={[styles.swapMiniText, { color: theme.text }]}>Zamień</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity
              style={[
                styles.addSessionExBtn,
                { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary },
              ]}
              onPress={() => {
                setSwapExerciseIdx(null);
                setOverviewMode('library');
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="add" size={18} color={theme.text} />
              <Text style={[styles.addSessionExText, { color: theme.text }]}>
                Dodaj dodatkowe ćwiczenie do dzisiaj
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.overviewFinishBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                setShowOverviewSheet(false);
                handleTriggerFinish();
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.overviewFinishText, { color: theme.primaryText }]}>
                ZAKOŃCZ TRENING ({completedSetsCount}/{totalSets})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </InteractiveBottomSheet>

      {/* Technique Modal */}
      <ExerciseDetailModal
        visible={detailModalExercise !== null}
        exercise={detailModalExercise}
        onClose={() => setDetailModalExercise(null)}
      />

      {/* Exercise Checklist & Order Modal (start or mid-workout) */}
      <SessionExercisePickerModal
        visible={showSessionPicker}
        onClose={() => setShowSessionPicker(false)}
        exercises={allSessionExercises}
        extraLibraryExercises={extraLibraryExercises}
        dayProgress={dayProgress}
        initialConfig={{
          orderedIds: allSessionExercises.map((e) => e.id),
          skippedIds,
          addedExercises: allSessionExercises.filter(
            (ex) => !(dayPlan.exercises || []).some((b) => b.id === ex.id)
          ),
        }}
        mode={sessionPickerMode}
        onConfirm={handleApplySessionConfig}
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
    paddingHorizontal: 14,
    paddingVertical: 11,
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
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  stopwatchText: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  pickerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  pickerPillText: {
    fontSize: 11,
    fontWeight: '700',
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
    gap: 8,
  },
  seriesRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  seriesPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
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
    marginLeft: 3,
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
    gap: 8,
    marginBottom: 14,
  },
  inputCol: {
    flex: 1,
    minWidth: 0,
  },
  inputLabel: {
    fontSize: 10,
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
    height: 50,
  },
  stepBtn: {
    width: 38,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 2,
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
  floatingRestContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    zIndex: 999,
  },
  floatingRestBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingRestLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingTimerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTimerTime: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  floatingTapHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  floatingTimerNext: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  floatingFinishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  floatingFinishBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  catBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bonusSetRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  bonusSetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  bonusSetText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hintAnd1rmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  live1rmText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetBackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  sheetBackText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sessionExCat: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sessionExName: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  sessionExStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  swapMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  swapMiniText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addSessionExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 14,
  },
  addSessionExText: {
    fontSize: 13,
    fontWeight: '700',
  },
  overviewFinishBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewFinishText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
