import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';

interface WorkoutSummaryModalProps {
  visible: boolean;
  dayName: string;
  completedSets: number;
  totalSets: number;
  onClose: () => void;
}

export const WorkoutSummaryModal: React.FC<WorkoutSummaryModalProps> = ({
  visible,
  dayName,
  completedSets,
  totalSets,
  onClose,
}) => {
  const { theme } = useAppTheme();

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
              <Text style={[styles.statNumber, { color: theme.text }]}>{completedSets}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Wykonane</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.text }]}>{totalSets}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Wszystkie</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

            <View style={styles.statBox}>
              <Text style={[styles.statNumber, { color: theme.text }]}>100%</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Zrealizowano</Text>
            </View>
          </View>

          <Text style={[styles.cheerText, { color: theme.textSecondary }]}>
            Wszystkie serie zostały zapisane w pamięci Twojego iPhone'a. Odpocznij i przygotuj się na kolejną sesję.
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
});
