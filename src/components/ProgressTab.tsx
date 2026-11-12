import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Animated,
  LayoutAnimation,
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
  getCreatineLog,
  toggleCreatineDay,
  getWeightStatsSummary,
  getExerciseImprovements,
  CreatineDayEntry,
  WeightStatsSummary,
  ExerciseImprovement,
} from '../services/storage';

interface ProgressTabProps {
  activeProfile: UserProfile;
  onOpenProfileModal: () => void;
}

type ViewMode = 'stats' | 'exercises';
type Timeframe = '7d' | '30d' | '90d';

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

  // Mode: Stats & Trends vs Exercise PR list
  const [viewMode, setViewMode] = useState<ViewMode>('stats');
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');

  // Animation values for mode and timeframe transitions
  const modeFadeAnim = useRef(new Animated.Value(1)).current;
  const modeSlideAnim = useRef(new Animated.Value(0)).current;

  const handleSwitchMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    try {
      Haptics.selectionAsync();
    } catch {}

    modeFadeAnim.setValue(0);
    modeSlideAnim.setValue(8);
    setViewMode(mode);

    Animated.parallel([
      Animated.timing(modeFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(modeSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSwitchTimeframe = (tf: Timeframe) => {
    if (tf === timeframe) return;
    try {
      Haptics.selectionAsync();
    } catch {}

    modeFadeAnim.setValue(0.3);
    modeSlideAnim.setValue(6);
    setTimeframe(tf);

    Animated.parallel([
      Animated.timing(modeFadeAnim, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(modeSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Stats data
  const [creatineLog, setCreatineLog] = useState<CreatineDayEntry[]>([]);
  const [weightStats, setWeightStats] = useState<WeightStatsSummary | null>(null);
  const [improvements, setImprovements] = useState<ExerciseImprovement[]>([]);

  // PR Records State
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

  const loadData = useCallback(async () => {
    try {
      const records = await getAllBestPRs(activeProfile.id);
      setBestPRs(records);

      const daysCount = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;

      const [cLog, wStats, imp] = await Promise.all([
        getCreatineLog(timeframe === '7d' ? 7 : 14),
        getWeightStatsSummary(daysCount, activeProfile.id),
        getExerciseImprovements(activeProfile.id),
      ]);

      setCreatineLog(cLog);
      setWeightStats(wStats);
      setImprovements(imp);
    } catch (e) {
      console.warn('Error loading progress stats:', e);
    }
  }, [activeProfile.id, timeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleCreatine = async (entry: CreatineDayEntry) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
      const nextState = !entry.taken;
      await toggleCreatineDay(entry.date, nextState);
      setCreatineLog((prev) =>
        prev.map((item) => (item.date === entry.date ? { ...item, taken: nextState } : item))
      );
    } catch (e) {
      console.warn('Error toggling creatine day', e);
    }
  };

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
      await loadData();
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
            await loadData();
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

  const statsSummary = useMemo(() => {
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

  const creatineStats = useMemo(() => {
    const count = creatineLog.filter((c) => c.taken).length;
    const total = creatineLog.length;
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    const todayTaken = creatineLog.find((c) => c.isToday)?.taken ?? false;
    return { count, total, percent, todayTaken };
  }, [creatineLog]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Title */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Osiągi & Statystyki</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          Monitoruj progres siły, wagę i regularność kreatyny
        </Text>
      </View>

      {/* Main Segmented Mode Switcher */}
      <View style={styles.modeSwitchWrapper}>
        <View style={[styles.modeSwitchBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.modeBtn,
              viewMode === 'stats' && {
                backgroundColor: theme.card,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
            onPress={() => handleSwitchMode('stats')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="analytics-outline"
              size={16}
              color={viewMode === 'stats' ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                { color: viewMode === 'stats' ? theme.text : theme.textMuted },
                viewMode === 'stats' && { fontWeight: '900' },
              ]}
            >
              Statystyki & Trendy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeBtn,
              viewMode === 'exercises' && {
                backgroundColor: theme.card,
                shadowColor: '#000',
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              },
            ]}
            onPress={() => handleSwitchMode('exercises')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trophy-outline"
              size={16}
              color={viewMode === 'exercises' ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.modeBtnText,
                { color: viewMode === 'exercises' ? theme.text : theme.textMuted },
                viewMode === 'exercises' && { fontWeight: '900' },
              ]}
            >
              Rekordy PR ({statsSummary.totalCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Animated Mode / Timeframe Content Container */}
      <Animated.View
        style={{
          flex: 1,
          opacity: modeFadeAnim,
          transform: [{ translateY: modeSlideAnim }],
        }}
      >
        {/* ==================== VIEW 1: STATS & TRENDS ==================== */}
        {viewMode === 'stats' ? (
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Timeframe Filter */}
            <View style={styles.timeframeRow}>
              {(['7d', '30d', '90d'] as Timeframe[]).map((tf) => {
                const isSelected = timeframe === tf;
                const label = tf === '7d' ? 'Ostatnie 7 dni' : tf === '30d' ? '30 dni' : '90 dni';
                return (
                  <TouchableOpacity
                    key={tf}
                    style={[
                      styles.tfPill,
                      {
                        backgroundColor: isSelected ? theme.primary : theme.bgSecondary,
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => handleSwitchTimeframe(tf)}
                    activeOpacity={0.7}
                  >
                  <Text
                    style={[
                      styles.tfPillText,
                      { color: isSelected ? theme.primaryText : theme.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* SECTION 1: BODY WEIGHT CHART & BALANCE */}
          <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardKicker, { color: theme.textMuted }]}>MASA CIAŁA</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Waga i bilans ({timeframe})</Text>
              </View>

              {weightStats ? (
                <View style={styles.weightDeltaBadge}>
                  <Ionicons
                    name={weightStats.diff >= 0 ? 'trending-up' : 'trending-down'}
                    size={16}
                    color={theme.text}
                  />
                  <Text style={[styles.weightDeltaText, { color: theme.text }]}>
                    {weightStats.diff > 0 ? `+${weightStats.diff}` : `${weightStats.diff}`} kg ({weightStats.diffPercent > 0 ? `+${weightStats.diffPercent}` : `${weightStats.diffPercent}`}%)
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Quick Metrics Line */}
            {weightStats ? (
              <View style={styles.metricsSummaryRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Aktualna</Text>
                  <Text style={[styles.metricVal, { color: theme.text }]}>{weightStats.current} kg</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Początkowa</Text>
                  <Text style={[styles.metricVal, { color: theme.text }]}>{weightStats.start} kg</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: theme.textMuted }]}>Wzrost</Text>
                  <Text style={[styles.metricVal, { color: theme.text }]}>{activeProfile.height || 180} cm</Text>
                </View>
              </View>
            ) : null}

            {/* Native Clean Monochromatic Bar Chart */}
            {weightStats && weightStats.entries.length > 0 ? (
              <View style={styles.chartWrapper}>
                <View style={styles.chartBarsContainer}>
                  {weightStats.entries.slice(-7).map((entry, idx) => {
                    const min = weightStats.min;
                    const max = weightStats.max;
                    const span = Math.max(0.6, max - min);
                    // Compute relative height percent between 30% and 95%
                    const heightPercent = Math.min(
                      95,
                      Math.max(30, 30 + ((entry.weight - min) / span) * 65)
                    );
                    const isLatest = idx === weightStats.entries.slice(-7).length - 1;

                    return (
                      <View key={entry.id || idx} style={styles.chartCol}>
                        <Text style={[styles.chartBarValue, { color: isLatest ? theme.text : theme.textMuted }]}>
                          {entry.weight}
                        </Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${heightPercent}%`,
                                backgroundColor: isLatest ? theme.text : theme.borderDark,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.chartBarDay, { color: isLatest ? theme.text : theme.textMuted }]}>
                          {entry.date.slice(5).replace('-', '/')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.insightPill, { backgroundColor: theme.card, borderColor: theme.hairline }]}>
              <Ionicons name="sparkles-outline" size={15} color={theme.text} />
              <Text style={[styles.insightText, { color: theme.textSecondary }]}>
                Wzrost z 60.1 kg pod plan FBW 4-dniowy. Rekomendowane tempo masy: +0.2-0.3 kg / tydzień.
              </Text>
            </View>
          </View>

          {/* SECTION 2: CREATINE 5G TRACKER & HEATMAP */}
          <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardKicker, { color: theme.textMuted }]}>SUPLEMENTACJA</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Kreatyna 5g (Regularność)</Text>
              </View>

              <View
                style={[
                  styles.creatineBadge,
                  {
                    backgroundColor: creatineStats.todayTaken ? theme.primary : theme.bgTertiary,
                    borderColor: creatineStats.todayTaken ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.creatineBadgeText,
                    { color: creatineStats.todayTaken ? theme.primaryText : theme.text },
                  ]}
                >
                  {creatineStats.todayTaken ? 'DZISIAJ: WZIĘTA ✅' : 'DZISIAJ: DO WZIĘCIA ⏳'}
                </Text>
              </View>
            </View>

            <Text style={[styles.creatineSubtitle, { color: theme.textSecondary }]}>
              Regularność w wybranym okresie: <Text style={{ fontWeight: '800', color: theme.text }}>{creatineStats.count}/{creatineStats.total} dni ({creatineStats.percent}%)</Text>
            </Text>

            {/* Interactive Creatine Week Ribbon */}
            <View style={styles.creatineRibbon}>
              {creatineLog.slice(-7).map((item) => {
                return (
                  <TouchableOpacity
                    key={item.date}
                    style={[
                      styles.dayCircleCol,
                      item.isToday && { backgroundColor: theme.card, borderRadius: 14, paddingVertical: 4 },
                    ]}
                    onPress={() => handleToggleCreatine(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dayLabelText, { color: item.isToday ? theme.text : theme.textMuted }]}>
                      {item.dayLabel}
                    </Text>
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: item.taken ? theme.text : 'transparent',
                          borderColor: item.taken ? theme.text : theme.borderDark,
                        },
                      ]}
                    >
                      {item.taken ? (
                        <Ionicons name="checkmark" size={14} color={theme.bg} />
                      ) : (
                        <Text style={[styles.emptyX, { color: theme.textMuted }]}>—</Text>
                      )}
                    </View>
                    <Text style={[styles.dayNumText, { color: theme.textMuted }]}>
                      {item.dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.creatineTip, { color: theme.textMuted }]}>
              Dotknij dnia, aby szybko zmienić status. Przypomnienia iOS aktywne (09:00 rano & 22:00 przed snem).
            </Text>
          </View>

          {/* SECTION 3: STRENGTH IMPROVEMENT & DELTAS */}
          <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <View style={styles.cardHeaderRow}>
              <View>
                <Text style={[styles.cardKicker, { color: theme.textMuted }]}>POSTĘPY SIŁOWE</Text>
                <Text style={[styles.cardTitle, { color: theme.text }]}>Wzrosty ciężarów & 1RM</Text>
              </View>
            </View>

            <Text style={[styles.creatineSubtitle, { color: theme.textSecondary }]}>
              Porównanie z poprzednimi sesjami treningowymi (FBW):
            </Text>

            <View style={styles.improvementsList}>
              {improvements.map((item) => (
                <View
                  key={item.id}
                  style={[styles.improvementRow, { borderBottomColor: theme.hairline }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.impName, { color: theme.text }]}>{item.name}</Text>
                    <View style={styles.impSubRow}>
                      <View style={[styles.catTag, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.catTagText, { color: theme.textSecondary }]}>
                          {item.category.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[styles.impPrevText, { color: theme.textMuted }]}>
                        Poprzednio: {item.previousWeight} kg
                      </Text>
                    </View>
                  </View>

                  <View style={styles.impRight}>
                    <View style={styles.impWeightRow}>
                      <Text style={[styles.impWeightCur, { color: theme.text }]}>
                        {item.currentWeight} kg
                      </Text>
                      <View style={[styles.deltaChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Ionicons name="arrow-up" size={11} color={theme.text} />
                        <Text style={[styles.deltaChipText, { color: theme.text }]}>
                          +{item.diffWeight} kg (+{item.percentImprovement}%)
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.imp1RM, { color: theme.textMuted }]}>
                      1RM: ~{item.current1RM} kg (+{item.diff1RM} kg)
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ==================== VIEW 2: EXERCISE PR LIST ==================== */
        <>
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

          {/* List of Exercises */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listInner}
            showsVerticalScrollIndicator={false}
          >
            {/* KPI Cards Strip - scrolls away so user has maximum space for exercises */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Ionicons name="trophy-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>{statsSummary.totalCount}</Text>
                <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Rekordów</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Ionicons name="barbell-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>
                  {statsSummary.maxWeight > 0 ? `${statsSummary.maxWeight} kg` : '—'}
                </Text>
                <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Maks. Ciężar</Text>
              </View>

              <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Ionicons name="flash-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>
                  {statsSummary.max1RM > 0 ? `${statsSummary.max1RM} kg` : '—'}
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
        </>
      )}
      </Animated.View>

      {/* Modal Dodawania / Edycji PR */}
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
                    ~{currentEst1RM} kg
                  </Text>
                </View>

                {/* Note input */}
                <TextInput
                  style={[
                    styles.noteField,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Notatka (opcjonalnie, np. RPE 9, łatwa seria)..."
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

              {/* History of this exercise */}
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: theme.text }]}>
                  Historia serii ({history.length})
                </Text>
                {history.length === 0 ? (
                  <Text style={[styles.historyEmpty, { color: theme.textMuted }]}>
                    Brak zapisanych serii dla tego ćwiczenia. Wpisz swój pierwszy wynik powyżej!
                  </Text>
                ) : (
                  history.map((rec) => (
                    <View
                      key={rec.id}
                      style={[styles.historyRow, { borderBottomColor: theme.hairline }]}
                    >
                      <View>
                        <View style={styles.histNumbers}>
                          <Text style={[styles.histWeight, { color: theme.text }]}>
                            {rec.weight} kg
                          </Text>
                          <Text style={[styles.histReps, { color: theme.textSecondary }]}>
                            × {rec.reps} powt.
                          </Text>
                        </View>
                        {rec.note ? (
                          <Text style={[styles.histDate, { color: theme.textMuted }]}>
                            {rec.note}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.histMeta}>
                        <Text style={[styles.hist1RM, { color: theme.textSecondary }]}>
                          1RM: ~{rec.estimated1RM} kg
                        </Text>
                        <Text style={[styles.histDate, { color: theme.textMuted }]}>
                          {rec.date.slice(0, 10)}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDeleteRecord(rec)}
                        style={styles.trashBtn}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
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
    paddingTop: 14,
    paddingBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  modeSwitchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 14,
    marginTop: 4,
  },
  modeSwitchBox: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  modeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tfPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  tfPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  card: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  weightDeltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CED4DA',
  },
  weightDeltaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricsSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginBottom: 14,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  chartWrapper: {
    paddingVertical: 12,
    marginBottom: 10,
  },
  chartBarsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: 4,
  },
  chartCol: {
    alignItems: 'center',
    flex: 1,
  },
  chartBarValue: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  barTrack: {
    width: 18,
    height: 100,
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderRadius: 9,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 9,
  },
  chartBarDay: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  insightText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    fontWeight: '600',
  },
  creatineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  creatineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  creatineSubtitle: {
    fontSize: 13,
    marginBottom: 14,
  },
  creatineRibbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 10,
  },
  dayCircleCol: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 2,
  },
  dayLabelText: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyX: {
    fontSize: 14,
    fontWeight: '700',
  },
  dayNumText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
  },
  creatineTip: {
    fontSize: 11,
    marginTop: 4,
  },
  improvementsList: {
    marginTop: 4,
  },
  improvementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  impName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  impSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  impPrevText: {
    fontSize: 12,
  },
  impRight: {
    alignItems: 'flex-end',
  },
  impWeightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  impWeightCur: {
    fontSize: 16,
    fontWeight: '900',
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  deltaChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  imp1RM: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
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
