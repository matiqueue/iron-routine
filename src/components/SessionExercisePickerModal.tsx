import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  LayoutChangeEvent,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { BottomSheetScrollView, InteractiveBottomSheet, useBottomSheetContext } from './InteractiveBottomSheet';
import { ExerciseLibraryContent } from './ExerciseLibraryContent';
import { DayProgress, Exercise, SessionExerciseConfig } from '../types/workout';
import { cloneExercise } from '../data/exerciseLibrary';
import {
  triggerImpactHaptic,
  triggerNotificationHaptic,
  triggerSelectionHaptic,
} from '../services/haptics';

interface SessionExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  extraLibraryExercises?: Exercise[];
  dayProgress: DayProgress;
  initialConfig?: SessionExerciseConfig;
  mode?: 'start' | 'edit';
  onConfirm: (config: SessionExerciseConfig) => void;
  onLibraryChanged?: () => void;
}

const ROW_GAP = 8;
const DEFAULT_ROW_HEIGHT = 68;

const SessionChecklistView: React.FC<{
  orderedExercises: Exercise[];
  dayProgress: DayProgress;
  skippedSet: Set<string>;
  draggingId: string | null;
  dragYAnim: Animated.Value;
  mode: 'start' | 'edit';
  onToggleExercise: (id: string) => void;
  onSelectAll: () => void;
  onResetOrder: () => void;
  onRowLayout: (id: string, e: LayoutChangeEvent) => void;
  getDragPanResponder: (id: string) => PanResponderInstance;
  onOpenLibrary: () => void;
  onConfirm: () => void;
}> = ({
  orderedExercises,
  dayProgress,
  skippedSet,
  draggingId,
  dragYAnim,
  mode,
  onToggleExercise,
  onSelectAll,
  onResetOrder,
  onRowLayout,
  getDragPanResponder,
  onOpenLibrary,
  onConfirm,
}) => {
  const { theme } = useAppTheme();
  const activeCount = orderedExercises.filter((e) => !skippedSet.has(e.id)).length;

  return (
    <View style={styles.wrapper}>
      <View style={styles.toolbar}>
        <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
          Wybrane: <Text style={{ color: theme.text, fontWeight: '800' }}>{activeCount}</Text> z{' '}
          {orderedExercises.length}
        </Text>
        <View style={styles.toolbarActions}>
          {skippedSet.size > 0 && (
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: theme.bgTertiary }]}
              onPress={onSelectAll}
            >
              <Text style={[styles.toolBtnText, { color: theme.text }]}>Wszystkie</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.toolBtn, { backgroundColor: theme.bgTertiary }]}
            onPress={onResetOrder}
          >
            <Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>Domyślna</Text>
          </TouchableOpacity>
        </View>
      </View>

      <BottomSheetScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!draggingId}
      >
        {orderedExercises.map((ex, idx) => {
          const isSkipped = skippedSet.has(ex.id);
          const isDragging = draggingId === ex.id;
          const loggedCount = Object.values(dayProgress.sets?.[ex.id] || {}).filter(
            (s) => s?.completed
          ).length;
          const dragPan = getDragPanResponder(ex.id);

          return (
            <Animated.View
              key={ex.id}
              onLayout={(e) => onRowLayout(ex.id, e)}
              style={[
                styles.row,
                {
                  backgroundColor: isDragging
                    ? theme.bgCardElevated
                    : isSkipped
                    ? theme.bgSecondary
                    : theme.card,
                  borderColor: isDragging
                    ? theme.text
                    : isSkipped
                    ? theme.border
                    : theme.borderDark,
                  opacity: isDragging ? 0.96 : isSkipped ? 0.62 : 1,
                  zIndex: isDragging ? 99 : 1,
                  elevation: isDragging ? 10 : 0,
                },
                isDragging
                  ? {
                      transform: [{ translateY: dragYAnim }, { scale: 1.02 }],
                      shadowColor: '#000',
                      shadowOpacity: 0.28,
                      shadowRadius: 10,
                      shadowOffset: { width: 0, height: 6 },
                    }
                  : undefined,
              ]}
            >
              <TouchableOpacity
                style={styles.rowTapArea}
                activeOpacity={0.75}
                onPress={() => onToggleExercise(ex.id)}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: !isSkipped ? theme.text : 'transparent',
                      borderColor: !isSkipped ? theme.text : theme.textMuted,
                    },
                  ]}
                >
                  {!isSkipped && <Ionicons name="checkmark" size={14} color={theme.bg} />}
                </View>

                <View
                  style={[
                    styles.orderBadge,
                    { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.orderBadgeText, { color: theme.textMuted }]}>
                    {idx + 1}
                  </Text>
                </View>

                <View style={styles.rowInfo}>
                  <View style={styles.rowTitleLine}>
                    <Text
                      style={[
                        styles.rowTitle,
                        { color: theme.text },
                        isSkipped && styles.rowTitleSkipped,
                      ]}
                      numberOfLines={2}
                    >
                      {ex.name}
                    </Text>
                  </View>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {isSkipped ? 'Pominięte na dziś' : `${ex.sets} × ${ex.reps} powt.`}
                    {loggedCount > 0 ? ` • Zrobiono ${loggedCount}/${ex.sets}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>

              <View
                {...dragPan.panHandlers}
                style={[
                  styles.dragHandle,
                  {
                    backgroundColor: isDragging ? theme.primary : theme.bgSecondary,
                    borderColor: isDragging ? theme.primary : theme.border,
                  },
                ]}
                accessibilityLabel="Przeciągnij, aby zmienić kolejność"
              >
                <Ionicons
                  name="reorder-three"
                  size={21}
                  color={isDragging ? theme.primaryText : theme.textSecondary}
                />
              </View>
            </Animated.View>
          );
        })}
        <View style={{ height: 18 }} />
      </BottomSheetScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary },
          ]}
          onPress={() => {
            triggerSelectionHaptic();
            onOpenLibrary();
          }}
          activeOpacity={0.78}
        >
          <Ionicons name="add-circle-outline" size={18} color={theme.text} />
          <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
            Dodaj dodatkowe ćwiczenie z bazy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: theme.text }]}
          activeOpacity={0.85}
          onPress={onConfirm}
        >
          <Ionicons name={mode === 'start' ? 'play' : 'checkmark-done'} size={18} color={theme.bg} />
          <Text style={[styles.confirmBtnText, { color: theme.bg }]}>
            {mode === 'start'
              ? `Rozpocznij trening (${activeCount} ćw.)`
              : `Zastosuj wybór (${activeCount} ćw.)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const SessionExercisePickerModal: React.FC<SessionExercisePickerModalProps> = ({
  visible,
  onClose,
  exercises,
  extraLibraryExercises = [],
  dayProgress,
  initialConfig,
  mode = 'edit',
  onConfirm,
  onLibraryChanged,
}) => {
  const { theme } = useAppTheme();
  const [viewMode, setViewMode] = useState<'order' | 'library'>('order');
  const [addedExercises, setAddedExercises] = useState<Exercise[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [skippedSet, setSkippedSet] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const prevVisibleRef = useRef(false);
  const orderedIdsRef = useRef<string[]>([]);
  orderedIdsRef.current = orderedIds;

  const rowHeightsRef = useRef<Record<string, number>>({});
  const dragYAnim = useRef(new Animated.Value(0)).current;
  const dragStateRef = useRef<{
    id: string;
    currentIndex: number;
    swapAccumulatedDy: number;
  } | null>(null);
  const panRespondersRef = useRef<Record<string, PanResponderInstance>>({});

  useEffect(() => {
    const justOpened = !prevVisibleRef.current && visible;
    prevVisibleRef.current = visible;
    if (!justOpened) return;

    const savedAdded = (initialConfig?.addedExercises || []).filter(
      (extra) => !exercises.some((b) => b.id === extra.id)
    );
    const combined = [...exercises, ...savedAdded];
    const allIds = combined.map((e) => e.id);

    setAddedExercises(savedAdded.map(cloneExercise));
    setViewMode('order');

    if (initialConfig?.orderedIds?.length) {
      const validSaved = initialConfig.orderedIds.filter((id) => allIds.includes(id));
      const missingNew = allIds.filter((id) => !validSaved.includes(id));
      const nextOrder = [...validSaved, ...missingNew];
      orderedIdsRef.current = nextOrder;
      setOrderedIds(nextOrder);
      setSkippedSet(new Set((initialConfig.skippedIds || []).filter((id) => allIds.includes(id))));
    } else {
      orderedIdsRef.current = allIds;
      setOrderedIds(allIds);
      setSkippedSet(new Set());
    }
    setDraggingId(null);
    dragStateRef.current = null;
    dragYAnim.setValue(0);
  }, [visible, exercises, initialConfig, dragYAnim]);

  const combinedExercises = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const ex of exercises) map.set(ex.id, ex);
    for (const ex of addedExercises) {
      if (!map.has(ex.id)) map.set(ex.id, ex);
    }
    return Array.from(map.values());
  }, [exercises, addedExercises]);

  const orderedExercises: Exercise[] = orderedIds
    .map((id) => combinedExercises.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e));

  const activeCount = orderedExercises.filter((e) => !skippedSet.has(e.id)).length;

  const toggleExercise = (id: string) => {
    if (draggingId) return;
    triggerSelectionHaptic();
    setSkippedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddFromLibrary = (picked: Exercise) => {
    triggerNotificationHaptic('success');
    const cloned = cloneExercise(picked);
    const alreadyExists = combinedExercises.some((e) => e.id === cloned.id);
    const item = alreadyExists ? { ...cloned, id: `${cloned.id}_session_${Date.now()}` } : cloned;

    setAddedExercises((prev) => [...prev, item]);
    const nextOrder = [...orderedIdsRef.current, item.id];
    orderedIdsRef.current = nextOrder;
    setOrderedIds(nextOrder);
    setViewMode('order');
  };

  const getDragPanResponder = (exerciseId: string): PanResponderInstance => {
    if (!panRespondersRef.current[exerciseId]) {
      panRespondersRef.current[exerciseId] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: () => {
          const idx = orderedIdsRef.current.indexOf(exerciseId);
          if (idx === -1) return;
          dragYAnim.stopAnimation();
          dragYAnim.setValue(0);
          dragStateRef.current = {
            id: exerciseId,
            currentIndex: idx,
            swapAccumulatedDy: 0,
          };
          setDraggingId(exerciseId);
          triggerImpactHaptic('light');
        },
        onPanResponderMove: (_, gestureState) => {
          const st = dragStateRef.current;
          if (!st || st.id !== exerciseId) return;

          let localDy = gestureState.dy - st.swapAccumulatedDy;
          const list = orderedIdsRef.current;

          if (localDy > 0 && st.currentIndex < list.length - 1) {
            const nextId = list[st.currentIndex + 1];
            const nextStep = (rowHeightsRef.current[nextId] || DEFAULT_ROW_HEIGHT) + ROW_GAP;
            if (localDy > nextStep * 0.52) {
              const updated = [...list];
              updated[st.currentIndex] = nextId;
              updated[st.currentIndex + 1] = st.id;
              orderedIdsRef.current = updated;
              setOrderedIds(updated);
              st.currentIndex += 1;
              st.swapAccumulatedDy += nextStep;
              localDy = gestureState.dy - st.swapAccumulatedDy;
              triggerSelectionHaptic();
            }
          } else if (localDy < 0 && st.currentIndex > 0) {
            const prevId = list[st.currentIndex - 1];
            const prevStep = (rowHeightsRef.current[prevId] || DEFAULT_ROW_HEIGHT) + ROW_GAP;
            if (localDy < -(prevStep * 0.52)) {
              const updated = [...list];
              updated[st.currentIndex] = prevId;
              updated[st.currentIndex - 1] = st.id;
              orderedIdsRef.current = updated;
              setOrderedIds(updated);
              st.currentIndex -= 1;
              st.swapAccumulatedDy -= prevStep;
              localDy = gestureState.dy - st.swapAccumulatedDy;
              triggerSelectionHaptic();
            }
          }

          dragYAnim.setValue(localDy);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: () => {
          dragStateRef.current = null;
          Animated.spring(dragYAnim, {
            toValue: 0,
            friction: 8,
            tension: 120,
            useNativeDriver: true,
          }).start(() => {
            setDraggingId(null);
          });
          triggerImpactHaptic('light');
        },
        onPanResponderTerminate: () => {
          dragStateRef.current = null;
          dragYAnim.setValue(0);
          setDraggingId(null);
        },
      });
    }
    return panRespondersRef.current[exerciseId];
  };

  const handleRowLayout = (id: string, e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 20) {
      rowHeightsRef.current[id] = h;
    }
  };

  const handleSelectAll = () => {
    triggerSelectionHaptic();
    setSkippedSet(new Set());
  };

  const handleResetOrder = () => {
    triggerSelectionHaptic();
    const defaultIds = combinedExercises.map((e) => e.id);
    orderedIdsRef.current = defaultIds;
    setOrderedIds(defaultIds);
    setSkippedSet(new Set());
  };

  const handleConfirm = () => {
    if (activeCount === 0) {
      Alert.alert(
        'Wybierz minimum jedno ćwiczenie',
        'Zaznacz przynajmniej jedno ćwiczenie do wykonania w dzisiejszym treningu.'
      );
      return;
    }
    triggerImpactHaptic('medium');
    onConfirm({
      orderedIds: orderedIdsRef.current,
      skippedIds: orderedIdsRef.current.filter((id) => skippedSet.has(id)),
      addedExercises: addedExercises.length > 0 ? addedExercises : undefined,
    });
    onClose();
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={
        viewMode === 'library'
          ? 'Dodaj ćwiczenie do sesji'
          : mode === 'start'
          ? 'Konfiguracja dzisiejszej sesji'
          : 'Kolejność i wybór ćwiczeń'
      }
      subtitle={
        viewMode === 'library'
          ? 'Wybierz z bazy lub utwórz własne na dzisiejszy trening'
          : 'Odznacz pomijane lub przytrzymaj ≡ i przeciągnij'
      }
      initialHeightPercent={0.86}
      headerRight={
        viewMode === 'library' ? (
          <TouchableOpacity
            style={[
              styles.backPillBtn,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setViewMode('order');
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={14} color={theme.text} />
            <Text style={[styles.backPillText, { color: theme.text }]}>Wróć</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      <DragLockSync locked={Boolean(draggingId)} />
      {viewMode === 'library' ? (
        <ExerciseLibraryContent
          mode="pick"
          alreadyInDayIds={combinedExercises.map((e) => e.id)}
          extraExercises={extraLibraryExercises}
          onSelectExercise={handleAddFromLibrary}
          onLibraryChanged={onLibraryChanged}
        />
      ) : (
        <SessionChecklistView
          orderedExercises={orderedExercises}
          dayProgress={dayProgress}
          skippedSet={skippedSet}
          draggingId={draggingId}
          dragYAnim={dragYAnim}
          mode={mode}
          onToggleExercise={toggleExercise}
          onSelectAll={handleSelectAll}
          onResetOrder={handleResetOrder}
          onRowLayout={handleRowLayout}
          getDragPanResponder={getDragPanResponder}
          onOpenLibrary={() => setViewMode('library')}
          onConfirm={handleConfirm}
        />
      )}
    </InteractiveBottomSheet>
  );
};

const DragLockSync: React.FC<{ locked: boolean }> = ({ locked }) => {
  const { setDragLock } = useBottomSheetContext();
  useEffect(() => {
    setDragLock(locked);
    return () => setDragLock(false);
  }, [locked, setDragLock]);
  return null;
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  countLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toolBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    marginBottom: 8,
    gap: 10,
  },
  rowTapArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  rowTitleSkipped: {
    textDecorationLine: 'line-through',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  dragHandle: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  backPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  backPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
