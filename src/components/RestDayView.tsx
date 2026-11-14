import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppTheme } from '../context/ThemeContext';
import { DayPlan } from '../types/workout';
import { getDayBannerTagMeta, resolveDayBannerTag } from '../data/dayTags';
import { triggerImpactHaptic } from '../services/haptics';
import { DayBannerArtwork } from './DayBannerArtwork';

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
    triggerImpactHaptic('light');
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  };

  const bannerTag = resolveDayBannerTag(dayPlan);
  const tagMeta = getDayBannerTagMeta(bannerTag);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <DayBannerArtwork tag={bannerTag} compact />
        </View>
        <View style={styles.hero}>
          <View style={[styles.tagBadge, { backgroundColor: theme.primary }]}>
            <Ionicons name={tagMeta.icon as any} size={11} color={theme.primaryText} />
            <Text style={[styles.tag, { color: theme.primaryText }]}>
              {tagMeta.label.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{dayPlan.name}</Text>
          {dayPlan.subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{dayPlan.subtitle}</Text>
          ) : null}
          {dayPlan.warmup ? (
            <Text style={[styles.desc, { color: theme.textMuted }]}>{dayPlan.warmup}</Text>
          ) : null}
        </View>
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
    paddingTop: 2,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 145,
    justifyContent: 'flex-end',
  },
  hero: {
    padding: 18,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    marginBottom: 10,
  },
  tag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
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
