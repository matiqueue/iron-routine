import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { Exercise, SetEntry } from '../types/workout';
import { SetRow } from './SetRow';

interface ExerciseCardProps {
  exercise: Exercise;
  exerciseProgress?: { [setIndex: number]: SetEntry };
  lastWeightHint?: string;
  onToggleSet: (setIndex: number, restSeconds: number) => void;
  onUpdateSetWeight: (setIndex: number, weight: string) => void;
  onUpdateSetReps: (setIndex: number, reps: string) => void;
  onStartTimer: (seconds: number, exerciseName: string) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  exerciseProgress = {},
  lastWeightHint,
  onToggleSet,
  onUpdateSetWeight,
  onUpdateSetReps,
  onStartTimer,
}) => {
  const completedCount = Object.values(exerciseProgress).filter((s) => s?.completed).length;
  const isAllDone = completedCount >= exercise.sets;

  return (
    <View style={[styles.card, isAllDone && styles.cardAllDone]}>
      {/* Exercise Header */}
      <View style={styles.header}>
        <View style={styles.titleArea}>
          <Text style={[styles.title, isAllDone && styles.titleDone]}>
            {exercise.name}
          </Text>

          <View style={styles.badgesRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{exercise.sets} serie</Text>
            </View>

            <TouchableOpacity
              onPress={() => onStartTimer(exercise.rest, exercise.name)}
              activeOpacity={0.7}
              style={styles.restBadge}
            >
              <Ionicons name="timer-outline" size={13} color={THEME.colors.accentOrange} />
              <Text style={styles.restBadgeText}>{exercise.rest}s przerwy</Text>
            </TouchableOpacity>

            {exercise.ab ? (
              <View style={styles.abBadge}>
                <Text style={styles.abBadgeText}>BRZUCH</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.progressCol}>
          <Text style={[styles.progressRatio, isAllDone && styles.progressRatioDone]}>
            {completedCount}/{exercise.sets}
          </Text>
        </View>
      </View>

      {/* Note / Technique tip */}
      {exercise.note ? (
        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={14} color={THEME.colors.textSecondary} />
          <Text style={styles.noteText}>{exercise.note}</Text>
        </View>
      ) : null}

      {/* Table Sub-header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.thSet]}>SERIA</Text>
        <Text style={[styles.thText, styles.thTarget]}>CEL</Text>
        <Text style={[styles.thText, styles.thInput]}>KG</Text>
        <Text style={[styles.thText, styles.thInput]}>POWT.</Text>
        <Text style={[styles.thText, styles.thCheck]}>STATUS</Text>
      </View>

      {/* Set Rows */}
      {Array.from({ length: exercise.sets }).map((_, idx) => (
        <SetRow
          key={idx}
          setIndex={idx}
          targetReps={exercise.reps}
          entry={exerciseProgress[idx]}
          lastWeightHint={lastWeightHint}
          onToggleComplete={() => onToggleSet(idx, exercise.rest)}
          onUpdateWeight={(val) => onUpdateSetWeight(idx, val)}
          onUpdateReps={(val) => onUpdateSetReps(idx, val)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.bgCard,
    borderRadius: THEME.radius.lg,
    marginHorizontal: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  cardAllDone: {
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  titleArea: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    lineHeight: 22,
  },
  titleDone: {
    color: THEME.colors.textSecondary,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    backgroundColor: THEME.colors.bgCardElevated,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.xs,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  restBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.accentOrangeGlow,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.xs,
  },
  restBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.accentOrange,
  },
  abBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.xs,
  },
  abBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.accentPurple,
  },
  progressCol: {
    alignItems: 'flex-end',
  },
  progressRatio: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    backgroundColor: THEME.colors.bgCardElevated,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: THEME.radius.sm,
  },
  progressRatioDone: {
    color: THEME.colors.primary,
    backgroundColor: THEME.colors.primaryGlow,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  noteText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  thText: {
    fontSize: 10,
    fontWeight: '800',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  thSet: {
    width: 36,
  },
  thTarget: {
    width: 58,
    textAlign: 'center',
  },
  thInput: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 4,
  },
  thCheck: {
    width: 44,
    textAlign: 'right',
  },
});
