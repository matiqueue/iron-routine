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

const CATEGORIES: { id: MuscleCategory | 'wszystkie'; label: string }[] = [
  { id: 'wszystkie', label: 'Wszystkie' },
  { id: 'klatka', label: 'Klatka' },
  { id: 'plecy', label: 'Plecy' },
  { id: 'nogi', label: 'Nogi' },
  { id: 'barki', label: 'Barki' },
  { id: 'ramiona', label: 'Ramiona' },
  { id: 'brzuch', label: 'Brzuch' },
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

      {/* Search Input */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
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
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
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

      {/* List of Exercises (NO THUMBNAILS - airy and typographic) */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listInner}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Cards Strip - scrolls away so user has maximum space for exercises */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Ionicons name="trophy-outline" size={20} color={theme.text} />
            <Text style={[styles.kpiVal, { color: theme.text }]}>{stats.totalCount}</Text>
            <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Rekordów</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Ionicons name="barbell-outline" size={20} color={theme.text} />
            <Text style={[styles.kpiVal, { color: theme.text }]}>
              {stats.maxWeight > 0 ? `${stats.maxWeight} kg` : '—'}
            </Text>
            <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Maks. Ciężar</Text>
          </View>

          <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <Ionicons name="flash-outline" size={20} color={theme.text} />
            <Text style={[styles.kpiVal, { color: theme.text }]}>
              {stats.max1RM > 0 ? `${stats.max1RM} kg` : '—'}
            </Text>
            <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Top 1RM</Text>
          </View>
        </View>
        {filteredExercises.length === 0 ? (
          <View style={styles.emptyView}>
            <Ionicons name="search-outline" size={28} color={theme.textMuted} style={{ marginBottom: 8 }} />
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
                <View style={styles.rowLeft}>
                  <Text style={[styles.exTitle, { color: theme.text }]}>
                    {exercise.name}
                  </Text>
                  <View style={styles.subMeta}>
                    <View style={[styles.catTag, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
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
                        1RM: ~{pr.estimated1RM} kg
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.addBadge, { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary }]}>
                      <Ionicons name="add" size={15} color={theme.text} />
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
                  Nowy wynik dla ćwiczenia
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
                    Szacowany 1RM z tej serii:
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
                  Historia wyników ({history.length})
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
                          1RM: ~{record.estimated1RM} kg
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
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiVal: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  kpiLbl: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  categoryWrap: {
    marginBottom: 14,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 1,
  },
  catPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listInner: {
    paddingHorizontal: 20,
    paddingBottom: 85,
  },
  emptyView: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
    minHeight: 80,
  },
  rowLeft: {
    flex: 1,
  },
  exTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginBottom: 6,
  },
  subMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planHint: {
    fontSize: 14,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  prResultCol: {
    alignItems: 'flex-end',
  },
  prWeightText: {
    fontSize: 21,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  prRepsText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pr1RMText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  addBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  addBadgeText: {
    fontSize: 14,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: {
    padding: 20,
  },
  formContainer: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  formHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 14,
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
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
    fontSize: 22,
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
    paddingVertical: 7,
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  projectionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  projectionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  projectionValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  noteField: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 14,
  },
  saveBtn: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  historySection: {
    marginBottom: 24,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  historyEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  histWeight: {
    fontSize: 18,
    fontWeight: '900',
  },
  histReps: {
    fontSize: 13,
    fontWeight: '600',
  },
  histMeta: {
    alignItems: 'flex-end',
  },
  hist1RM: {
    fontSize: 12,
    fontWeight: '600',
  },
  histDate: {
    fontSize: 11,
    marginTop: 1,
  },
  trashBtn: {
    padding: 6,
  },
});
