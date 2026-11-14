import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { NewPRHighlight } from '../types/workout';

interface WorkoutSummaryModalProps {
  visible: boolean;
  dayName: string;
  completedSets: number;
  totalSets: number;
  durationMinutes?: number;
  totalVolumeKg?: number;
  newPRs?: NewPRHighlight[];
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  dayName,
  completedSets,
  totalSets,
  durationMinutes,
  totalVolumeKg,
  newPRs = [],
  onClose,
}) => {
  const { theme } = useAppTheme();
  const completionPct =
    totalSets > 0 ? Math.min(100, Math.round((completedSets / totalSets) * 100)) : 100;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.bgSecondary }]}>
            <Ionicons name="trophy-outline" size={32} color={theme.text} />
          </View>

          <Text style={[styles.title, { color: theme.text }]}>Trening ukończony</Text>
          <Text style={[styles.dayName, { color: theme.textMuted }]}>{dayName}</Text>

          <View style={[styles.statsRow, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {completedSets}/{totalSets}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Serie</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {totalVolumeKg && totalVolumeKg > 0 ? `${totalVolumeKg}` : `${completionPct}%`}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                {totalVolumeKg && totalVolumeKg > 0 ? 'Objętość (kg)' : 'Realizacja'}
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {durationMinutes ? `${durationMinutes}m` : `${completionPct}%`}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                {durationMinutes ? 'Czas' : 'Zrealizowano'}
              </Text>
            </View>
          </View>

          {newPRs.length > 0 && (
            <View style={[styles.prBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.prBoxTitle, { color: theme.text }]}>
                NOWE REKORDY PR ({newPRs.length})
              </Text>
              {newPRs.slice(0, 3).map((pr) => (
                <Text key={pr.exerciseId} style={[styles.prItemText, { color: theme.textSecondary }]}>
                  • {pr.exerciseName}: {pr.weight} kg × {pr.reps} (~{pr.estimated1RM} kg 1RM)
                </Text>
              ))}
            </View>
          )}

          <Text style={[styles.cheerText, { color: theme.textSecondary }]}>
            Wszystkie serie i statystyki zostały zapisane lokalnie w pamięci urządzenia. Odpocznij przed kolejną sesją.
          </Text>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Text style={[styles.btnText, { color: theme.primaryText }]}>Zamknij</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  dayName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  cheerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  btn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  prBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  prBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  prItemText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
