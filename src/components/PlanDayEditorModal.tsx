import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { DayBannerTag, DayPlan, DayType, Exercise } from '../types/workout';
import { cloneExercise } from '../data/exerciseLibrary';
import { DAY_BANNER_TAG_OPTIONS, resolveDayBannerTag } from '../data/dayTags';
import { DayBannerArtwork } from './DayBannerArtwork';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';
import { ExerciseLibraryContent } from './ExerciseLibraryContent';

interface PlanDayEditorModalProps {
  visible: boolean;
  onClose: () => void;
  dayPlan: DayPlan | null;
  dayLabel: string;
  extraExercises?: Exercise[];
  onSaveDay: (updatedDay: DayPlan) => Promise<void> | void;
  onLibraryChanged?: () => void;
}

const DAY_TYPE_OPTIONS: { id: DayType; label: string; icon: string }[] = [
  { id: 'workout', label: 'Trening', icon: 'barbell-outline' },
  { id: 'walk', label: 'Cardio / Spacer', icon: 'walk-outline' },
  { id: 'rest', label: 'Odpoczynek', icon: 'bed-outline' },
];

export const PlanDayEditorModal: React.FC<PlanDayEditorModalProps> = ({
  visible,
  onClose,
  dayPlan,
  dayLabel,
  extraExercises = [],
  onSaveDay,
  onLibraryChanged,
}) => {
  const { theme } = useAppTheme();

  const [viewMode, setViewMode] = useState<'day' | 'library'>('day');
  const [swapIndex, setSwapIndex] = useState<number | null>(null);

  const [dayType, setDayType] = useState<DayType>('workout');
  const [bannerTag, setBannerTag] = useState<DayBannerTag>('fbw');
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [time, setTime] = useState('');
  const [warmup, setWarmup] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    if (visible && dayPlan) {
      setViewMode('day');
      setSwapIndex(null);
      setDayType(dayPlan.type);
      setBannerTag(resolveDayBannerTag(dayPlan));
      setName(dayPlan.name);
      setSubtitle(dayPlan.subtitle || '');
      setTime(dayPlan.time || '');
      setWarmup(dayPlan.warmup || '');
      setExercises((dayPlan.exercises || []).map(cloneExercise));
    }
  }, [visible, dayPlan]);

  if (!dayPlan) return null;

  const handleSelectDayType = (nextType: DayType) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDayType(nextType);
    if (nextType === 'rest' && (!name.trim() || name === dayPlan.name)) {
      if (dayPlan.type === 'workout') {
        setName('Dzień regeneracji');
        setSubtitle('Odpoczynek, sen i nawodnienie');
        setTime('Regeneracja');
      }
      setBannerTag('rest');
    } else if (nextType === 'walk') {
      if (dayPlan.type === 'workout') {
        setName('Aktywna regeneracja');
        setSubtitle('Spacer 8 000 kroków & mobilność');
        setTime('35-45 min');
      }
      setBannerTag('cardio');
    } else if (nextType === 'workout' && dayPlan.type !== 'workout') {
      setName('Nowy trening');
      setSubtitle('Skonfiguruj partie i ćwiczenia');
      setTime('60 min');
      if (bannerTag === 'rest') setBannerTag('fbw');
    }
  };

  const handleMoveExercise = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= exercises.length) return;
    try {
      Haptics.selectionAsync();
    } catch {}
    const copy = [...exercises];
    const tmp = copy[index];
    copy[index] = copy[target];
    copy[target] = tmp;
    setExercises(copy);
  };

  const handleRemoveExercise = (index: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateExerciseField = <K extends keyof Exercise>(
    index: number,
    field: K,
    value: Exercise[K]
  ) => {
    setExercises((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleOpenPicker = (targetSwapIndex: number | null) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    setSwapIndex(targetSwapIndex);
    setViewMode('library');
  };

  const handlePickedExercise = (picked: Exercise) => {
    if (swapIndex !== null) {
      setExercises((prev) =>
        prev.map((item, idx) => (idx === swapIndex ? cloneExercise(picked) : item))
      );
      setSwapIndex(null);
      setViewMode('day');
    } else {
      // Allow re-adding or prevent exact duplicate cleanly with unique suffix only if needed
      const alreadyExists = exercises.some((e) => e.id === picked.id);
      const nextItem = alreadyExists
        ? { ...cloneExercise(picked), id: `${picked.id}_ex_${Date.now()}` }
        : cloneExercise(picked);
      setExercises((prev) => [...prev, nextItem]);
      setViewMode('day');
    }
  };

  const handleSave = async () => {
    const iconName =
      dayType === 'workout'
        ? dayPlan.iconName && dayPlan.iconName !== 'bed-outline'
          ? dayPlan.iconName
          : 'barbell-outline'
        : dayType === 'walk'
        ? 'walk-outline'
        : 'bed-outline';

    const updated: DayPlan = {
      ...dayPlan,
      type: dayType,
      iconName,
      bannerTag,
      name: name.trim() || (dayType === 'workout' ? 'Trening' : 'Dzień regeneracji'),
      subtitle: subtitle.trim(),
      time: time.trim() || (dayType === 'workout' ? '60 min' : 'Regeneracja'),
      warmup: warmup.trim() || undefined,
      exercises: dayType === 'workout' ? exercises : [],
    };

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    await onSaveDay(updated);
    onClose();
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={
        viewMode === 'library'
          ? swapIndex !== null
            ? 'Zamień ćwiczenie'
            : 'Dodaj ćwiczenie z bazy'
          : `Edycja: ${dayLabel}`
      }
      subtitle={
        viewMode === 'library'
          ? 'Wybierz pozycję z bazy lub utwórz własne ćwiczenie'
          : 'Typ dnia, opis oraz dobór ćwiczeń i serii'
      }
      initialHeightPercent={0.92}
      headerRight={
        viewMode === 'library' ? (
          <TouchableOpacity
            style={[styles.backPill, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            onPress={() => {
              setSwapIndex(null);
              setViewMode('day');
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="arrow-back" size={14} color={theme.text} />
            <Text style={[styles.backPillText, { color: theme.text }]}>Wróć</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {viewMode === 'library' ? (
          <ExerciseLibraryContent
            mode={swapIndex !== null ? 'swap' : 'pick'}
            alreadyInDayIds={exercises.map((e) => e.id)}
            extraExercises={extraExercises}
            onSelectExercise={handlePickedExercise}
            onLibraryChanged={onLibraryChanged}
          />
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Day Type Selector */}
              <Text style={[styles.kicker, { color: theme.textMuted }]}>CHARAKTER DNIA</Text>
              <View
                style={[
                  styles.segmentedWrap,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
              >
                {DAY_TYPE_OPTIONS.map((opt) => {
                  const active = dayType === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[
                        styles.segmentBtn,
                        active && { backgroundColor: theme.card, borderColor: theme.border },
                      ]}
                      onPress={() => handleSelectDayType(opt.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={15}
                        color={active ? theme.text : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          { color: active ? theme.text : theme.textMuted },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Banner Tag & Artwork Selector */}
              <Text style={[styles.kicker, { color: theme.textMuted }]}>TAG I GRAFIKA BANERA</Text>
              <View
                style={[
                  styles.bannerPreviewBox,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
              >
                <DayBannerArtwork tag={bannerTag} compact />
                <View style={styles.bannerPreviewOverlay}>
                  <Text style={[styles.bannerPreviewTitle, { color: theme.text }]} numberOfLines={1}>
                    {DAY_BANNER_TAG_OPTIONS.find((t) => t.id === bannerTag)?.badge || 'FULL BODY'}
                  </Text>
                  <Text style={[styles.bannerPreviewSub, { color: theme.textSecondary }]} numberOfLines={1}>
                    {DAY_BANNER_TAG_OPTIONS.find((t) => t.id === bannerTag)?.label || ''}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagScroll}
              >
                {DAY_BANNER_TAG_OPTIONS.map((tagOpt) => {
                  const selected = bannerTag === tagOpt.id;
                  return (
                    <TouchableOpacity
                      key={tagOpt.id}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: selected ? theme.primary : theme.bgSecondary,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                        setBannerTag(tagOpt.id);
                      }}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={tagOpt.icon as any}
                        size={14}
                        color={selected ? theme.primaryText : theme.text}
                      />
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: selected ? theme.primaryText : theme.text },
                        ]}
                      >
                        {tagOpt.shortLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Metadata Inputs */}
              <View style={styles.metaCard}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>NAZWA DNIA</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                  ]}
                  value={name}
                  onChangeText={setName}
                  placeholder="np. Push — Klatka & Barki"
                  placeholderTextColor={theme.textMuted}
                />

                <View style={styles.twoCol}>
                  <View style={{ flex: 1.4 }}>
                    <Text style={[styles.kicker, { color: theme.textMuted }]}>PODTYTUŁ / PARTIE</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                      ]}
                      value={subtitle}
                      onChangeText={setSubtitle}
                      placeholder="np. Klatka • Barki • Triceps"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>

                  <View style={{ flex: 0.8 }}>
                    <Text style={[styles.kicker, { color: theme.textMuted }]}>CZAS</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                      ]}
                      value={time}
                      onChangeText={setTime}
                      placeholder="60 min"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>

                <Text style={[styles.kicker, { color: theme.textMuted }]}>
                  {dayType === 'workout' ? 'ROZGRZEWKA / NOTATKA' : 'WSKAZÓWKI REGENERACYJNE'}
                </Text>
                <TextInput
                  style={[
                    styles.multiInput,
                    { backgroundColor: theme.bgSecondary, borderColor: theme.border, color: theme.text },
                  ]}
                  value={warmup}
                  onChangeText={setWarmup}
                  placeholder="np. 5 min orbitrek, rotatory barków gumą..."
                  placeholderTextColor={theme.textMuted}
                  multiline
                />
              </View>

              {/* Exercises Configurator */}
              {dayType === 'workout' && (
                <View style={styles.exSection}>
                  <View style={styles.exSectionHeader}>
                    <Text style={[styles.kicker, { color: theme.textMuted, marginBottom: 0 }]}>
                      ĆWICZENIA W TYM DNIU ({exercises.length})
                    </Text>

                    <TouchableOpacity
                      style={[styles.addExBtn, { backgroundColor: theme.primary }]}
                      onPress={() => handleOpenPicker(null)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={16} color={theme.primaryText} />
                      <Text style={[styles.addExBtnText, { color: theme.primaryText }]}>
                        Dodaj z bazy
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {exercises.length === 0 ? (
                    <TouchableOpacity
                      style={[
                        styles.emptyExBox,
                        { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                      ]}
                      onPress={() => handleOpenPicker(null)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="barbell-outline" size={26} color={theme.textMuted} />
                      <Text style={[styles.emptyExTitle, { color: theme.text }]}>
                        Brak ćwiczeń w tym dniu
                      </Text>
                      <Text style={[styles.emptyExDesc, { color: theme.textMuted }]}>
                        Dotknij tutaj, aby wybrać ćwiczenia z bazy lub utworzyć własne.
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    exercises.map((ex, idx) => (
                      <View
                        key={`${ex.id}_${idx}`}
                        style={[
                          styles.exEditorCard,
                          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                        ]}
                      >
                        <View style={styles.exEditorHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.exIdxLabel, { color: theme.textMuted }]}>
                              #{idx + 1} • {ex.category.toUpperCase()}
                            </Text>
                            <Text style={[styles.exTitle, { color: theme.text }]}>{ex.name}</Text>
                          </View>

                          <View style={styles.exTopActions}>
                            <TouchableOpacity
                              style={[
                                styles.iconMiniBtn,
                                { borderColor: theme.border },
                                idx === 0 && { opacity: 0.3 },
                              ]}
                              disabled={idx === 0}
                              onPress={() => handleMoveExercise(idx, -1)}
                            >
                              <Ionicons name="arrow-up" size={14} color={theme.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.iconMiniBtn,
                                { borderColor: theme.border },
                                idx === exercises.length - 1 && { opacity: 0.3 },
                              ]}
                              disabled={idx === exercises.length - 1}
                              onPress={() => handleMoveExercise(idx, 1)}
                            >
                              <Ionicons name="arrow-down" size={14} color={theme.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.iconMiniBtn, { borderColor: theme.border }]}
                              onPress={() => handleOpenPicker(idx)}
                            >
                              <Ionicons name="swap-horizontal" size={14} color={theme.text} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.iconMiniBtn, { borderColor: theme.border }]}
                              onPress={() => handleRemoveExercise(idx)}
                            >
                              <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Sets / Reps / Rest controls */}
                        <View style={styles.controlsGrid}>
                          {/* Sets */}
                          <View style={styles.ctrlBox}>
                            <Text style={[styles.ctrlLabel, { color: theme.textMuted }]}>SERIE</Text>
                            <View
                              style={[
                                styles.stepperRow,
                                { backgroundColor: theme.card, borderColor: theme.border },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.stepTap}
                                onPress={() =>
                                  handleUpdateExerciseField(
                                    idx,
                                    'sets',
                                    Math.max(1, (ex.sets || 1) - 1)
                                  )
                                }
                              >
                                <Text style={[styles.stepChar, { color: theme.text }]}>−</Text>
                              </TouchableOpacity>
                              <Text style={[styles.stepVal, { color: theme.text }]}>{ex.sets}</Text>
                              <TouchableOpacity
                                style={styles.stepTap}
                                onPress={() =>
                                  handleUpdateExerciseField(
                                    idx,
                                    'sets',
                                    Math.min(12, (ex.sets || 1) + 1)
                                  )
                                }
                              >
                                <Text style={[styles.stepChar, { color: theme.text }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Reps */}
                          <View style={styles.ctrlBox}>
                            <Text style={[styles.ctrlLabel, { color: theme.textMuted }]}>
                              POWTÓRZENIA
                            </Text>
                            <TextInput
                              style={[
                                styles.repsInput,
                                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                              ]}
                              value={ex.reps}
                              onChangeText={(txt) => handleUpdateExerciseField(idx, 'reps', txt)}
                              placeholder="8-12"
                              placeholderTextColor={theme.textMuted}
                            />
                          </View>

                          {/* Rest */}
                          <View style={styles.ctrlBox}>
                            <Text style={[styles.ctrlLabel, { color: theme.textMuted }]}>
                              PRZERWA (S)
                            </Text>
                            <View
                              style={[
                                styles.stepperRow,
                                { backgroundColor: theme.card, borderColor: theme.border },
                              ]}
                            >
                              <TouchableOpacity
                                style={styles.stepTap}
                                onPress={() =>
                                  handleUpdateExerciseField(
                                    idx,
                                    'rest',
                                    Math.max(15, (ex.rest || 60) - 15)
                                  )
                                }
                              >
                                <Text style={[styles.stepChar, { color: theme.text }]}>−</Text>
                              </TouchableOpacity>
                              <Text style={[styles.stepVal, { color: theme.text }]}>{ex.rest}s</Text>
                              <TouchableOpacity
                                style={styles.stepTap}
                                onPress={() =>
                                  handleUpdateExerciseField(
                                    idx,
                                    'rest',
                                    Math.min(600, (ex.rest || 60) + 15)
                                  )
                                }
                              >
                                <Text style={[styles.stepChar, { color: theme.text }]}>+</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>

                        <TextInput
                          style={[
                            styles.noteInput,
                            { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                          ]}
                          value={ex.note || ''}
                          onChangeText={(txt) => handleUpdateExerciseField(idx, 'note', txt)}
                          placeholder="Opcjonalna wskazówka / tempo / RIR..."
                          placeholderTextColor={theme.textMuted}
                        />
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

            {/* Footer Save Button */}
            <View style={[styles.footer, { borderTopColor: theme.hairline }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={18} color={theme.primaryText} />
                <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                  Zapisz dzień w planie
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  backPill: {
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metaCard: {
    marginBottom: 16,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 8,
  },
  bannerPreviewBox: {
    height: 66,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    marginBottom: 10,
  },
  bannerPreviewOverlay: {
    paddingHorizontal: 14,
    gap: 2,
  },
  bannerPreviewTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  bannerPreviewSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  tagScroll: {
    gap: 7,
    paddingBottom: 14,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  multiInput: {
    minHeight: 62,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  exSection: {
    marginTop: 4,
  },
  exSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addExBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyExBox: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyExTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyExDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  exEditorCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  exEditorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  exIdxLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  exTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  exTopActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  ctrlBox: {
    flex: 1,
  },
  ctrlLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
  },
  stepTap: {
    paddingHorizontal: 10,
    height: '100%',
    justifyContent: 'center',
  },
  stepChar: {
    fontSize: 16,
    fontWeight: '800',
  },
  stepVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  repsInput: {
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  noteInput: {
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12,
  },
  footer: {
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
