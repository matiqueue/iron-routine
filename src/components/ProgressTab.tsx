import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { Exercise, MuscleCategory, PRRecord, UserProfile } from '../types/workout';
import { getAllExercises } from '../data/planData';
import {
  getAllBestPRs,
  getExerciseHistory,
  addPRRecord,
  deletePRRecord,
  calculate1RM,
} from '../services/storage';

interface ProgressTabProps {
  activeProfile: UserProfile;
  onOpenProfileModal: () => void;
}

const CATEGORIES: { id: MuscleCategory | 'wszystkie'; label: string; emoji: string }[] = [
  { id: 'wszystkie', label: 'Wszystkie', emoji: '✨' },
  { id: 'klatka', label: 'Klatka', emoji: '💪' },
  { id: 'plecy', label: 'Plecy', emoji: '🦅' },
  { id: 'nogi', label: 'Nogi', emoji: '🦵' },
  { id: 'barki', label: 'Barki', emoji: '🛡️' },
  { id: 'ramiona', label: 'Ramiona', emoji: '🦾' },
  { id: 'brzuch', label: 'Brzuch', emoji: '⚡' },
];

export const ProgressTab: React.FC<ProgressTabProps> = ({
  activeProfile,
  onOpenProfileModal,
}) => {
  const { theme, isDark } = useAppTheme();
  const [bestPRs, setBestPRs] = useState<{ [exerciseId: string]: PRRecord }>({});
  const [selectedCategory, setSelectedCategory] = useState<MuscleCategory | 'wszystkie'>('wszystkie');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<PRRecord[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form Inputs
  const [inputWeight, setInputWeight] = useState('80');
  const [inputReps, setInputReps] = useState('8');
  const [inputNote, setInputNote] = useState('');

  const allExercises = useMemo(() => getAllExercises(), []);

  const loadPRs = useCallback(async () => {
    try {
      const records = await getAllBestPRs(activeProfile.id);
      setBestPRs(records);
    } catch (e) {
      console.warn('Error loading best PRs', e);
    }
  }, [activeProfile.id]);

  useEffect(() => {
    loadPRs();
  }, [loadPRs]);

  const handleOpenExercise = async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    const hist = await getExerciseHistory(exercise.id, activeProfile.id);
    setHistory(hist);

    if (hist.length > 0) {
      setInputWeight(String(hist[0].weight));
      setInputReps(String(hist[0].reps));
    } else {
      setInputWeight('60');
      setInputReps('8');
    }
    setInputNote('');
    setModalVisible(true);
  };

  const handleSaveRecord = async () => {
    if (!selectedExercise) return;
    const w = parseFloat(inputWeight.replace(',', '.'));
    const r = parseInt(inputReps, 10);

    if (isNaN(w) || w <= 0 || isNaN(r) || r <= 0) {
      Alert.alert('Błędne dane', 'Podaj poprawny ciężar (kg) i liczbę powtórzeń.');
      return;
    }

    try {
      await addPRRecord(
        selectedExercise.id,
        selectedExercise.name,
        selectedExercise.category,
        w,
        r,
        inputNote,
        activeProfile.id
      );

      const updatedHist = await getExerciseHistory(selectedExercise.id, activeProfile.id);
      setHistory(updatedHist);
      await loadPRs();
      setInputNote('');
    } catch (e) {
      console.error('Error saving PR:', e);
    }
  };

  const handleDeleteRecord = (record: PRRecord) => {
    Alert.alert(
      'Usunąć rekord?',
      `${record.weight} kg × ${record.reps} z dnia ${record.date.slice(0, 10)}`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            if (!selectedExercise) return;
            await deletePRRecord(record.id, selectedExercise.id, activeProfile.id);
            const updatedHist = await getExerciseHistory(selectedExercise.id, activeProfile.id);
            setHistory(updatedHist);
            await loadPRs();
          },
        },
      ]
    );
  };

  const adjustWeight = (delta: number) => {
    const cur = parseFloat(inputWeight.replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 10) / 10);
    setInputWeight(String(next));
  };

  const adjustReps = (delta: number) => {
    const cur = parseInt(inputReps, 10) || 0;
    const next = Math.max(1, cur + delta);
    setInputReps(String(next));
  };

  const currentEst1RM = useMemo(() => {
    const w = parseFloat(inputWeight.replace(',', '.')) || 0;
    const r = parseInt(inputReps, 10) || 0;
    return calculate1RM(w, r);
  }, [inputWeight, inputReps]);

  const stats = useMemo(() => {
    const values = Object.values(bestPRs);
    const totalCount = values.length;
    let maxWeight = 0;
    let max1RM = 0;

    for (const pr of values) {
      if (pr.weight > maxWeight) maxWeight = pr.weight;
      if (pr.estimated1RM > max1RM) max1RM = pr.estimated1RM;
    }

    return { totalCount, maxWeight, max1RM };
  }, [bestPRs]);

  const filteredExercises = useMemo(() => {
    return allExercises.filter((ex) => {
      const matchCat = selectedCategory === 'wszystkie' || ex.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [allExercises, selectedCategory, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Osiągi & Rekordy</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Śledź swoje maksy siłowe i szacowany 1RM
        </Text>
      </View>

      {/* KPI Cards Strip */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <Text style={styles.kpiEmoji}>🏆</Text>
          <Text style={[styles.kpiVal, { color: theme.text }]}>{stats.totalCount}</Text>
          <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Rekordów</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <Text style={styles.kpiEmoji}>⚡</Text>
          <Text style={[styles.kpiVal, { color: theme.text }]}>
            {stats.maxWeight > 0 ? `${stats.maxWeight} kg` : '—'}
          </Text>
          <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Max Ciężar</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <Text style={styles.kpiEmoji}>🎯</Text>
          <Text style={[styles.kpiVal, { color: theme.text }]}>
            {stats.max1RM > 0 ? `${stats.max1RM} kg` : '—'}
          </Text>
          <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Top 1RM</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
        <Ionicons name="search" size={17} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Szukaj ćwiczenia..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={17} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Pills */}
      <View style={styles.categoryWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catPill,
                  {
                    backgroundColor: isActive ? theme.primary : theme.bgSecondary,
                    borderColor: isActive ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedCategory(cat.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text
                  style={[
                    styles.catPillText,
                    { color: isActive ? theme.primaryText : theme.text },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* List of Exercises */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      >
        {filteredExercises.length === 0 ? (
          <View style={styles.emptyView}>
            <Text style={{ fontSize: 24, marginBottom: 6 }}>🔍</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Nie znaleziono pasujących ćwiczeń
            </Text>
          </View>
        ) : (
          filteredExercises.map((exercise) => {
            const pr = bestPRs[exercise.id];

            return (
              <TouchableOpacity
                key={exercise.id}
                style={[
                  styles.exerciseRow,
                  { borderBottomColor: theme.hairline },
                ]}
                onPress={() => handleOpenExercise(exercise)}
                activeOpacity={0.75}
              >
                {/* Thumbnail Image */}
                {exercise.imageUrl ? (
                  <Image
                    source={{ uri: exercise.imageUrl }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumbnailPlaceholder, { backgroundColor: theme.bgTertiary }]}>
                    <Ionicons name="barbell-outline" size={18} color={theme.textMuted} />
                  </View>
                )}

                <View style={styles.rowLeft}>
                  <Text style={[styles.exTitle, { color: theme.text }]}>
                    {exercise.name}
                  </Text>
                  <View style={styles.subMeta}>
                    <View style={[styles.catTag, { backgroundColor: theme.bgTertiary }]}>
                      <Text style={[styles.catTagText, { color: theme.textSecondary }]}>
                        {exercise.category.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.planHint, { color: theme.textMuted }]}>
                      Plan: {exercise.sets} × {exercise.reps}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowRight}>
                  {pr ? (
                    <View style={styles.prResultCol}>
                      <Text style={[styles.prWeightText, { color: theme.text }]}>
                        {pr.weight} kg
                      </Text>
                      <Text style={[styles.prRepsText, { color: theme.textSecondary }]}>
                        × {pr.reps} powt.
                      </Text>
                      <Text style={[styles.pr1RMText, { color: theme.textMuted }]}>
                        ⚡ 1RM: ~{pr.estimated1RM} kg
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.addBadge, { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary }]}>
                      <Ionicons name="add" size={14} color={theme.text} />
                      <Text style={[styles.addBadgeText, { color: theme.text }]}>Dodaj</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />

          <View style={[styles.modalSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.hairline }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.modalCategory, { color: theme.textMuted }]}>
                  {selectedExercise?.category.toUpperCase()}
                </Text>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {selectedExercise?.name}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Form */}
              <View style={[styles.formContainer, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Text style={[styles.formHeaderTitle, { color: theme.text }]}>
                  ✍️ Zapisz nowy wynik
                </Text>

                <View style={styles.formInputsRow}>
                  {/* Weight */}
                  <View style={styles.inputCol}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>CIĘŻAR (KG)</Text>
                    <View style={[styles.stepperContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <TextInput
                        style={[styles.stepperInput, { color: theme.text }]}
                        keyboardType="decimal-pad"
                        value={inputWeight}
                        onChangeText={setInputWeight}
                      />
                      <View style={styles.stepperActions}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                          onPress={() => adjustWeight(2.5)}
                        >
                          <Text style={[styles.stepBtnText, { color: theme.text }]}>+2.5</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustWeight(-2.5)}>
                          <Text style={[styles.stepBtnText, { color: theme.text }]}>-2.5</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Reps */}
                  <View style={styles.inputCol}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>POWTÓRZENIA</Text>
                    <View style={[styles.stepperContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <TextInput
                        style={[styles.stepperInput, { color: theme.text }]}
                        keyboardType="number-pad"
                        value={inputReps}
                        onChangeText={setInputReps}
                      />
                      <View style={styles.stepperActions}>
                        <TouchableOpacity
                          style={[styles.stepBtn, { borderRightColor: theme.hairline }]}
                          onPress={() => adjustReps(1)}
                        >
                          <Text style={[styles.stepBtnText, { color: theme.text }]}>+1</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.stepBtn} onPress={() => adjustReps(-1)}>
                          <Text style={[styles.stepBtnText, { color: theme.text }]}>-1</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 1RM projection banner */}
                <View style={[styles.projectionBanner, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
                  <Text style={[styles.projectionLabel, { color: theme.textSecondary }]}>
                    ⚡ Szacowany 1RM z tej serii:
                  </Text>
                  <Text style={[styles.projectionValue, { color: theme.text }]}>
                    {currentEst1RM} kg
                  </Text>
                </View>

                {/* Optional note */}
                <TextInput
                  style={[
                    styles.noteField,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Notatka (opcjonalnie, np. czysty bój)..."
                  placeholderTextColor={theme.textMuted}
                  value={inputNote}
                  onChangeText={setInputNote}
                />

                {/* Save button */}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleSaveRecord}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                    ZAPISZ REKORD
                  </Text>
                </TouchableOpacity>
              </View>

              {/* History Timeline */}
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  📜 Historia postępów ({history.length})
                </Text>

                {history.length === 0 ? (
                  <Text style={[styles.historyEmpty, { color: theme.textMuted }]}>
                    Brak wcześniejszych wpisów. Zapisz swój pierwszy wynik powyżej!
                  </Text>
                ) : (
                  history.map((record) => (
                    <View
                      key={record.id}
                      style={[styles.historyRow, { borderBottomColor: theme.hairline }]}
                    >
                      <View style={styles.histNumbers}>
                        <Text style={[styles.histWeight, { color: theme.text }]}>
                          {record.weight} kg
                        </Text>
                        <Text style={[styles.histReps, { color: theme.textSecondary }]}>
                          × {record.reps} powt.
                        </Text>
                      </View>

                      <View style={styles.histMeta}>
                        <Text style={[styles.hist1RM, { color: theme.textMuted }]}>
                          ⚡ 1RM: ~{record.estimated1RM} kg
                        </Text>
                        <Text style={[styles.histDate, { color: theme.textMuted }]}>
                          {new Date(record.date).toLocaleDateString('pl-PL', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteRecord(record)}
                        style={styles.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 2,
  },
  kpiEmoji: {
    fontSize: 16,
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  kpiLbl: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryWrap: {
    marginBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  catEmoji: {
    fontSize: 12,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listInner: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  emptyView: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 10,
  },
  thumbnailPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLeft: {
    flex: 1,
  },
  exTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  subMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  planHint: {
    fontSize: 11,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  prResultCol: {
    alignItems: 'flex-end',
  },
  prWeightText: {
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  prRepsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pr1RMText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  addBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  addBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCategory: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: 20,
  },
  formContainer: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  formHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  stepperContainer: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperInput: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    paddingVertical: 8,
  },
  stepperActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#CED4DA',
  },
  stepBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },
  stepBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  projectionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  projectionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectionValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  noteField: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 13,
    marginBottom: 12,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  historySection: {
    marginBottom: 24,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  historyEmpty: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  histWeight: {
    fontSize: 16,
    fontWeight: '800',
  },
  histReps: {
    fontSize: 12,
    fontWeight: '600',
  },
  histMeta: {
    alignItems: 'flex-end',
  },
  hist1RM: {
    fontSize: 11,
    fontWeight: '600',
  },
  histDate: {
    fontSize: 10,
    marginTop: 1,
  },
  trashBtn: {
    padding: 6,
  },
});
