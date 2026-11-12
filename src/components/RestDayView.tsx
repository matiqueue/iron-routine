import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { DayPlan } from '../types/workout';

interface RestDayViewProps {
  dayPlan: DayPlan;
}

export const RestDayView: React.FC<RestDayViewProps> = ({ dayPlan }) => {
  const { theme } = useAppTheme();
  const isWalk = dayPlan.type === 'walk';
  const storageKey = `@iron_routine_rest_habits_${dayPlan.id}`;

  const [habits, setHabits] = useState<{ [key: string]: boolean }>({
    walk: false,
    water: false,
    sleep: false,
    stretch: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw) setHabits(JSON.parse(raw));
      } catch {}
    })();
  }, [dayPlan.id]);

  const toggleHabit = async (key: string) => {
    const updated = { ...habits, [key]: !habits[key] };
    setHabits(updated);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.hero}>
        <Ionicons
          name={(dayPlan.iconName as any) || 'bed-outline'}
          size={32}
          color={theme.text}
          style={{ marginBottom: 8 }}
        />
        <Text style={[styles.tag, { color: theme.textMuted }]}>REGENERACJA</Text>
        <Text style={[styles.title, { color: theme.text }]}>{dayPlan.name}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{dayPlan.subtitle}</Text>
        <Text style={[styles.desc, { color: theme.textMuted }]}>{dayPlan.warmup}</Text>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>CELE REGENERACYJNE</Text>

      {isWalk ? (
        <TouchableOpacity
          style={[
            styles.habitRow,
            {
              backgroundColor: habits.walk ? theme.bgSecondary : 'transparent',
              borderColor: habits.walk ? theme.text : theme.hairline,
            },
          ]}
          activeOpacity={0.7}
          onPress={() => toggleHabit('walk')}
        >
          <View style={styles.habitIconCol}>
            <Ionicons name="footsteps-outline" size={20} color={theme.text} />
          </View>
          <View style={styles.habitTextCol}>
            <Text style={[styles.habitTitle, { color: theme.text }]}>Aktywny spacer</Text>
            <Text style={[styles.habitDesc, { color: theme.textMuted }]}>
              6 000 – 10 000 kroków na świeżym powietrzu
            </Text>
          </View>
          <View style={[styles.checkCircle, habits.walk && { backgroundColor: theme.text }]}>
            {habits.walk && <Ionicons name="checkmark" size={14} color={theme.card} />}
          </View>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[
          styles.habitRow,
          {
            backgroundColor: habits.water ? theme.bgSecondary : 'transparent',
            borderColor: habits.water ? theme.text : theme.hairline,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => toggleHabit('water')}
      >
        <View style={styles.habitIconCol}>
          <Ionicons name="water-outline" size={20} color={theme.text} />
        </View>
        <View style={styles.habitTextCol}>
          <Text style={[styles.habitTitle, { color: theme.text }]}>Nawodnienie</Text>
          <Text style={[styles.habitDesc, { color: theme.textMuted }]}>
            Minimum 3 litry wody w ciągu dnia
          </Text>
        </View>
        <View style={[styles.checkCircle, habits.water && { backgroundColor: theme.text }]}>
          {habits.water && <Ionicons name="checkmark" size={14} color={theme.card} />}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.habitRow,
          {
            backgroundColor: habits.sleep ? theme.bgSecondary : 'transparent',
            borderColor: habits.sleep ? theme.text : theme.hairline,
          },
        ]}
        activeOpacity={0.7}
        onPress={() => toggleHabit('sleep')}
      >
        <View style={styles.habitIconCol}>
          <Ionicons name="moon-outline" size={20} color={theme.text} />
        </View>
        <View style={styles.habitTextCol}>
          <Text style={[styles.habitTitle, { color: theme.text }]}>Głęboki sen</Text>
          <Text style={[styles.habitDesc, { color: theme.textMuted }]}>
            7.5 – 8.5 godzin nieprzerwanego snu
          </Text>
        </View>
        <View style={[styles.checkCircle, habits.sleep && { backgroundColor: theme.text }]}>
          {habits.sleep && <Ionicons name="checkmark" size={14} color={theme.card} />}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  hero: {
    paddingVertical: 16,
  },
  tag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  desc: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 10,
  },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  habitIconCol: {
    marginRight: 12,
  },
  habitTextCol: {
    flex: 1,
  },
  habitTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  habitDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#8E8E93',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
