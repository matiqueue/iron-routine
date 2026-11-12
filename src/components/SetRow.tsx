import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { THEME } from '../constants/theme';
import { SetEntry } from '../types/workout';

interface SetRowProps {
  setIndex: number;
  targetReps: string;
  entry?: SetEntry;
  lastWeightHint?: string;
  onToggleComplete: () => void;
  onUpdateWeight: (weight: string) => void;
  onUpdateReps: (reps: string) => void;
}

export const SetRow: React.FC<SetRowProps> = ({
  setIndex,
  targetReps,
  entry = { completed: false },
  lastWeightHint,
  onToggleComplete,
  onUpdateWeight,
  onUpdateReps,
}) => {
  const isDone = !!entry.completed;

  const handleToggle = () => {
    try {
      Haptics.impactAsync(
        isDone ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
    } catch {}
    onToggleComplete();
  };

  return (
    <View style={[styles.row, isDone && styles.rowCompleted]}>
      {/* Set Number */}
      <View style={styles.colSet}>
        <View style={[styles.setBadge, isDone && styles.setBadgeDone]}>
          <Text style={[styles.setText, isDone && styles.setTextDone]}>
            {setIndex + 1}
          </Text>
        </View>
      </View>

      {/* Target Reps Reference */}
      <View style={styles.colTarget}>
        <Text style={styles.targetReps}>{targetReps}</Text>
      </View>

      {/* Weight Input (kg) */}
      <View style={styles.colInput}>
        <TextInput
          style={[styles.input, isDone && styles.inputDone]}
          placeholder={lastWeightHint ? `${lastWeightHint}kg` : '—'}
          placeholderTextColor={THEME.colors.textMuted}
          keyboardType="numeric"
          value={entry.weight ?? ''}
          onChangeText={onUpdateWeight}
          maxLength={6}
          selectTextOnFocus
        />
      </View>

      {/* Actual Reps Input */}
      <View style={styles.colInput}>
        <TextInput
          style={[styles.input, isDone && styles.inputDone]}
          placeholder={targetReps}
          placeholderTextColor={THEME.colors.textMuted}
          keyboardType="numeric"
          value={entry.reps ?? ''}
          onChangeText={onUpdateReps}
          maxLength={4}
          selectTextOnFocus
        />
      </View>

      {/* Complete Checkbox Button */}
      <View style={styles.colCheck}>
        <TouchableOpacity
          onPress={handleToggle}
          activeOpacity={0.7}
          style={[styles.checkBtn, isDone && styles.checkBtnDone]}
        >
          <Ionicons
            name={isDone ? 'checkmark' : 'ellipse-outline'}
            size={20}
            color={isDone ? '#000000' : THEME.colors.borderLight}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.bgCard,
  },
  rowCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  colSet: {
    width: 36,
  },
  setBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: THEME.colors.bgCardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  setBadgeDone: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  setText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  setTextDone: {
    color: '#000',
  },
  colTarget: {
    width: 58,
    alignItems: 'center',
  },
  targetReps: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  colInput: {
    flex: 1,
    marginHorizontal: 4,
  },
  input: {
    height: 34,
    backgroundColor: THEME.colors.bgInput,
    borderRadius: THEME.radius.sm,
    color: THEME.colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  inputDone: {
    borderColor: THEME.colors.primaryGlow,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  colCheck: {
    width: 44,
    alignItems: 'flex-end',
  },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.bgCardElevated,
  },
  checkBtnDone: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
