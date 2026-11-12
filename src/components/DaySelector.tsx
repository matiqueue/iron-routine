import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { DAYS_OF_WEEK, WORKOUT_PLAN } from '../data/planData';

interface DaySelectorProps {
  selectedDayId: string;
  onSelectDay: (dayId: string) => void;
  dayCompletions: { [dayId: string]: { completed: boolean; percent: number } };
}

export const DaySelector: React.FC<DaySelectorProps> = ({
  selectedDayId,
  onSelectDay,
  dayCompletions,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = selectedDayId === day.id;
          const plan = WORKOUT_PLAN.find((p) => p.id === day.id);
          const completion = dayCompletions[day.id] || { completed: false, percent: 0 };
          const isRest = plan?.type === 'rest' || plan?.type === 'walk';

          return (
            <TouchableOpacity
              key={day.id}
              activeOpacity={0.7}
              onPress={() => onSelectDay(day.id)}
              style={[
                styles.dayPill,
                isSelected && styles.dayPillSelected,
                completion.completed && !isSelected && styles.dayPillCompleted,
              ]}
            >
              <Text style={[styles.dayShort, isSelected && styles.textSelected]}>
                {day.short}
              </Text>

              <Ionicons
                name={(plan?.iconName as any) || 'fitness'}
                size={16}
                color={isSelected ? THEME.colors.bg : THEME.colors.primary}
              />

              {/* Progress indicator or checkmark */}
              <View style={styles.indicatorContainer}>
                {completion.completed ? (
                  <View style={styles.doneDot} />
                ) : completion.percent > 0 ? (
                  <Text style={[styles.pctText, isSelected && styles.pctTextSelected]}>
                    {completion.percent}%
                  </Text>
                ) : (
                  <View style={[styles.idleDot, isRest && styles.restDot]} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: THEME.spacing.sm,
    backgroundColor: THEME.colors.bg,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.lg,
    gap: 8,
  },
  dayPill: {
    width: 62,
    paddingVertical: 10,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.bgCard,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    minHeight: 80,
  },
  dayPillSelected: {
    backgroundColor: THEME.colors.bgCardElevated,
    borderColor: THEME.colors.primary,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  dayPillCompleted: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  dayShort: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
  },
  textSelected: {
    color: THEME.colors.text,
  },
  dayIcon: {
    fontSize: 20,
    marginVertical: 4,
  },
  indicatorContainer: {
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.colors.primary,
  },
  pctText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.accentOrange,
  },
  pctTextSelected: {
    color: THEME.colors.primary,
  },
  idleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: THEME.colors.borderLight,
  },
  restDot: {
    backgroundColor: THEME.colors.accentBlue,
  },
});
