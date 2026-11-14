import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { DayProgress, Exercise, SessionExerciseConfig } from '../types/workout';
import { triggerImpactHaptic, triggerSelectionHaptic } from '../services/haptics';

interface SessionExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  dayProgress: DayProgress;
  initialConfig?: SessionExerciseConfig;
  mode?: 'start' | 'edit';
  onConfirm: (config: SessionExerciseConfig) => void;
  onOpenAddExercise?: () => void;
}

export const SessionExercisePickerModal: React.FC<SessionExercisePickerModalProps> = ({
  visible,
  onClose,
  exercises,
  dayProgress,
  initialConfig,
  mode = 'edit',
  onConfirm,
  onOpenAddExercise,
}) => {
  const { theme } = useAppTheme();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [skippedSet, setSkippedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    const allIds = exercises.map((e) => e.id);
    if (initialConfig?.orderedIds?.length) {
      const validSaved = initialConfig.orderedIds.filter((id) => allIds.includes(id));
      const missingNew = allIds.filter((id) => !validSaved.includes(id));
      setOrderedIds([...validSaved, ...missingNew]);
      setSkippedSet(new Set((initialConfig.skippedIds || []).filter((id) => allIds.includes(id))));
    } else {
      setOrderedIds(allIds);
      setSkippedSet(new Set());
    }
  }, [visible, exercises, initialConfig]);

  const orderedExercises: Exercise[] = orderedIds
    .map((id) => exercises.find((e) => e.id === id))
    .filter((e): e is Exercise => Boolean(e));

  const activeCount = orderedExercises.filter((e) => !skippedSet.has(e.id)).length;

  const toggleExercise = (id: string) => {
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

  const moveExercise = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedIds.length) return;
    triggerImpactHaptic('light');
    setOrderedIds((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleSelectAll = () => {
    triggerSelectionHaptic();
    setSkippedSet(new Set());
  };

  const handleResetOrder = () => {
    triggerSelectionHaptic();
    setOrderedIds(exercises.map((e) => e.id));
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
      orderedIds,
      skippedIds: orderedIds.filter((id) => skippedSet.has(id)),
    });
    onClose();
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={mode === 'start' ? 'Konfiguracja dzisiejszej sesji' : 'Kolejność i wybór ćwiczeń'}
      subtitle="Odznacz pomijane ćwiczenia lub zamień ich kolejność"
      initialHeightPercent={0.84}
    >
      <View style={styles.wrapper}>
        {/* Quick Toolbar */}
        <View style={styles.toolbar}>
          <Text style={[styles.countLabel, { color: theme.textSecondary }]}>
            Wybrane: <Text style={{ color: theme.text, fontWeight: '800' }}>{activeCount}</Text> z{' '}
            {orderedExercises.length}
          </Text>
          <View style={styles.toolbarActions}>
            {skippedSet.size > 0 && (
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: theme.bgTertiary }]}
                onPress={handleSelectAll}
              >
                <Text style={[styles.toolBtnText, { color: theme.text }]}>Wszystkie</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.toolBtn, { backgroundColor: theme.bgTertiary }]}
              onPress={handleResetOrder}
            >
              <Text style={[styles.toolBtnText, { color: theme.textSecondary }]}>Domyślna</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {orderedExercises.map((ex, idx) => {
            const isSkipped = skippedSet.has(ex.id);
            const loggedCount = Object.values(dayProgress.sets?.[ex.id] || {}).filter(
              (s) => s?.completed
            ).length;

            return (
              <View
                key={ex.id}
                style={[
                  styles.row,
                  {
                    backgroundColor: isSkipped ? theme.bgSecondary : theme.card,
                    borderColor: isSkipped ? theme.border : theme.borderDark,
                    opacity: isSkipped ? 0.62 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.rowTapArea}
                  activeOpacity={0.75}
                  onPress={() => toggleExercise(ex.id)}
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

                <View style={styles.reorderGroup}>
                  <TouchableOpacity
                    disabled={idx === 0}
                    onPress={() => moveExercise(idx, -1)}
                    style={[
                      styles.moveBtn,
                      { backgroundColor: theme.bgTertiary, opacity: idx === 0 ? 0.3 : 1 },
                    ]}
                  >
                    <Ionicons name="chevron-up" size={16} color={theme.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={idx === orderedExercises.length - 1}
                    onPress={() => moveExercise(idx, 1)}
                    style={[
                      styles.moveBtn,
                      {
                        backgroundColor: theme.bgTertiary,
                        opacity: idx === orderedExercises.length - 1 ? 0.3 : 1,
                      },
                    ]}
                  >
                    <Ionicons name="chevron-down" size={16} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 18 }} />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
          {onOpenAddExercise && (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary }]}
              onPress={() => {
                onClose();
                setTimeout(() => onOpenAddExercise(), 220);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.text} />
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
                Dodaj dodatkowe ćwiczenie z bazy
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: theme.text }]}
            activeOpacity={0.85}
            onPress={handleConfirm}
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
    </InteractiveBottomSheet>
  );
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
  reorderGroup: {
    flexDirection: 'row',
    gap: 5,
    flexShrink: 0,
  },
  moveBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
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
});
