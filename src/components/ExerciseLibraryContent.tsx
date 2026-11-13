import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { EquipmentType, Exercise, MuscleCategory } from '../types/workout';
import {
  EQUIPMENT_OPTIONS,
  EXERCISE_LIBRARY,
  MUSCLE_CATEGORY_META,
  cloneExercise,
} from '../data/exerciseLibrary';
import { mergeAllExercises } from '../data/planData';
import {
  deleteCustomExercise,
  getCustomExercises,
  saveCustomExercise,
} from '../services/storage';

export type LibraryCategoryFilter = MuscleCategory | 'wszystkie' | 'wlasne';

interface ExerciseLibraryContentProps {
  mode?: 'pick' | 'manage' | 'swap';
  alreadyInDayIds?: string[];
  extraExercises?: Exercise[];
  onSelectExercise?: (exercise: Exercise) => void;
  onLibraryChanged?: () => void;
}

export const ExerciseLibraryContent: React.FC<ExerciseLibraryContentProps> = ({
  mode = 'pick',
  alreadyInDayIds = [],
  extraExercises = [],
  onSelectExercise,
  onLibraryChanged,
}) => {
  const { theme } = useAppTheme();

  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LibraryCategoryFilter>('wszystkie');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inline custom exercise creator
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MuscleCategory>('klatka');
  const [newEquipment, setNewEquipment] = useState<EquipmentType>('Sztanga');
  const [newSets, setNewSets] = useState('3');
  const [newReps, setNewReps] = useState('8-12');
  const [newRest, setNewRest] = useState('90');
  const [newDesc, setNewDesc] = useState('');
  const [newNote, setNewNote] = useState('');

  const loadCustom = useCallback(async () => {
    const list = await getCustomExercises();
    setCustomExercises(list);
  }, []);

  useEffect(() => {
    loadCustom();
  }, [loadCustom]);

  const allLibrary = useMemo(() => {
    // Custom first, then built-in gym catalog, then unique extra plan exercises (if not matching by name)
    const base = mergeAllExercises(customExercises, EXERCISE_LIBRARY);
    const seenNames = new Set(base.map((e) => e.name.trim().toLowerCase()));
    const uniqueExtras = extraExercises.filter(
      (e) => e.name && !seenNames.has(e.name.trim().toLowerCase()) && !base.some((b) => b.id === e.id)
    );
    return [...base, ...uniqueExtras];
  }, [customExercises, extraExercises]);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allLibrary.filter((ex) => {
      if (selectedCategory === 'wlasne' && !ex.isCustom) return false;
      if (
        selectedCategory !== 'wszystkie' &&
        selectedCategory !== 'wlasne' &&
        ex.category !== selectedCategory
      ) {
        return false;
      }

      if (!q) return true;
      return (
        ex.name.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        (ex.equipment || '').toLowerCase().includes(q) ||
        (ex.description || '').toLowerCase().includes(q)
      );
    });
  }, [allLibrary, selectedCategory, searchQuery]);

  const handleToggleCreateForm = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCreateForm((prev) => !prev);
  };

  const handleCreateCustomExercise = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      Alert.alert('Brak nazwy', 'Wpisz nazwę nowego ćwiczenia.');
      return;
    }

    const parsedSets = Math.max(1, Math.min(12, parseInt(newSets, 10) || 3));
    const parsedRest = Math.max(15, Math.min(600, parseInt(newRest, 10) || 90));
    const trimmedReps = newReps.trim() || '8-12';

    const created = await saveCustomExercise({
      name: trimmedName,
      category: newCategory,
      equipment: newEquipment,
      sets: parsedSets,
      reps: trimmedReps,
      rest: parsedRest,
      description:
        newDesc.trim() ||
        'Kontroluj pełen zakres ruchu i utrzymuj stabilną pozycję ciała w każdej serii.',
      note: newNote.trim() || undefined,
      ab: newCategory === 'brzuch' ? true : undefined,
    });

    setNewName('');
    setNewDesc('');
    setNewNote('');
    setShowCreateForm(false);
    await loadCustom();
    onLibraryChanged?.();

    if ((mode === 'pick' || mode === 'swap') && onSelectExercise) {
      onSelectExercise(cloneExercise(created));
    }
  };

  const handleDeleteCustom = (ex: Exercise) => {
    Alert.alert(
      'Usunąć własne ćwiczenie?',
      `Ćwiczenie „${ex.name}” zostanie usunięte z Twojej bazy (pozostanie w zapisanych już dniach planu).`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomExercise(ex.id);
            await loadCustom();
            onLibraryChanged?.();
          },
        },
      ]
    );
  };

  const handleRowPress = (ex: Exercise) => {
    try {
      Haptics.selectionAsync();
    } catch {}

    if ((mode === 'pick' || mode === 'swap') && onSelectExercise) {
      onSelectExercise(cloneExercise(ex));
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === ex.id ? null : ex.id));
  };

  const filterTabs: { id: LibraryCategoryFilter; label: string }[] = [
    { id: 'wszystkie', label: `Wszystkie (${allLibrary.length})` },
    ...(customExercises.length > 0
      ? [{ id: 'wlasne' as LibraryCategoryFilter, label: `Własne (${customExercises.length})` }]
      : []),
    ...MUSCLE_CATEGORY_META.map((m) => ({ id: m.id as LibraryCategoryFilter, label: m.label })),
  ];

  return (
    <View style={styles.container}>
      {/* Search + Custom Exercise Trigger */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}
        >
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Szukaj ćwiczenia lub sprzętu..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.newBtn,
            {
              backgroundColor: showCreateForm ? theme.primary : theme.bgSecondary,
              borderColor: showCreateForm ? theme.primary : theme.border,
            },
          ]}
          onPress={handleToggleCreateForm}
          activeOpacity={0.75}
        >
          <Ionicons
            name={showCreateForm ? 'close' : 'add'}
            size={18}
            color={showCreateForm ? theme.primaryText : theme.text}
          />
          <Text
            style={[
              styles.newBtnText,
              { color: showCreateForm ? theme.primaryText : theme.text },
            ]}
          >
            Własne
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter Pills */}
      {!showCreateForm && (
        <View style={styles.filterWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {filterTabs.map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: active ? theme.primary : theme.bgSecondary,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    try {
                      Haptics.selectionAsync();
                    } catch {}
                    setSelectedCategory(tab.id);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: active ? theme.primaryText : theme.text },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Inline Custom Exercise Form */}
        {showCreateForm ? (
          <View
            style={[
              styles.createCard,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.formTitle, { color: theme.text }]}>
              Nowe własne ćwiczenie
            </Text>
            <Text style={[styles.formSub, { color: theme.textMuted }]}>
              Zostanie zapisane lokalnie i będzie dostępne we wszystkich planach oraz Osiągach.
            </Text>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>NAZWA ĆWICZENIA</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="np. Wyciskanie na maszynie Smitha..."
              placeholderTextColor={theme.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>PARTIA MIĘŚNIOWA</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {MUSCLE_CATEGORY_META.map((cat) => {
                const active = newCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setNewCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.primaryText : theme.text },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SPRZĘT</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {EQUIPMENT_OPTIONS.map((eq) => {
                const active = newEquipment === eq;
                return (
                  <TouchableOpacity
                    key={eq}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? theme.primary : theme.card,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => setNewEquipment(eq)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? theme.primaryText : theme.text },
                      ]}
                    >
                      {eq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.defaultsGrid}>
              <View style={styles.defaultCol}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SERIE</Text>
                <TextInput
                  style={[
                    styles.smallInput,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  keyboardType="number-pad"
                  value={newSets}
                  onChangeText={setNewSets}
                />
              </View>
              <View style={styles.defaultCol}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>POWTÓRZENIA</Text>
                <TextInput
                  style={[
                    styles.smallInput,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  value={newReps}
                  onChangeText={setNewReps}
                  placeholder="8-12"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.defaultCol}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>PRZERWA (S)</Text>
                <TextInput
                  style={[
                    styles.smallInput,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  keyboardType="number-pad"
                  value={newRest}
                  onChangeText={setNewRest}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              OPIS TECHNIKI (OPCJONALNIE)
            </Text>
            <TextInput
              style={[
                styles.multiInput,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="Krótki opis ruchu lub ustawienia maszyny..."
              placeholderTextColor={theme.textMuted}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
            />

            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              WSKAZÓWKA (OPCJONALNIE)
            </Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
              ]}
              placeholder="np. Pauza 1s na dole, tempo 3-1-1..."
              placeholderTextColor={theme.textMuted}
              value={newNote}
              onChangeText={setNewNote}
            />

            <TouchableOpacity
              style={[styles.saveCustomBtn, { backgroundColor: theme.primary }]}
              onPress={handleCreateCustomExercise}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={theme.primaryText} />
              <Text style={[styles.saveCustomBtnText, { color: theme.primaryText }]}>
                {mode === 'pick' || mode === 'swap'
                  ? 'Zapisz i dodaj do treningu'
                  : 'Zapisz w bazie ćwiczeń'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : filteredExercises.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="barbell-outline" size={30} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              Brak pasujących ćwiczeń
            </Text>
            <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>
              Zmień wyszukiwanie lub dodaj własne ćwiczenie przyciskiem „+ Własne”.
            </Text>
          </View>
        ) : (
          filteredExercises.map((ex) => {
            const isAdded = alreadyInDayIds.includes(ex.id);
            const isExpanded = expandedId === ex.id;

            return (
              <View
                key={ex.id}
                style={[styles.exRowWrap, { borderBottomColor: theme.hairline }]}
              >
                <TouchableOpacity
                  style={styles.exRow}
                  onPress={() => handleRowPress(ex)}
                  activeOpacity={0.7}
                >
                  <View style={styles.exInfo}>
                    <View style={styles.exTitleLine}>
                      <Text style={[styles.exName, { color: theme.text }]}>{ex.name}</Text>
                      {ex.isCustom && (
                        <View style={[styles.customBadge, { backgroundColor: theme.primary }]}>
                          <Text style={[styles.customBadgeText, { color: theme.primaryText }]}>
                            WŁASNE
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.exMetaRow}>
                      <View
                        style={[
                          styles.catTag,
                          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                        ]}
                      >
                        <Text style={[styles.catTagText, { color: theme.textSecondary }]}>
                          {ex.category.toUpperCase()}
                        </Text>
                      </View>
                      {ex.equipment && (
                        <Text style={[styles.metaText, { color: theme.textMuted }]}>
                          {ex.equipment}
                        </Text>
                      )}
                      <Text style={[styles.metaText, { color: theme.textMuted }]}>
                        • {ex.sets} × {ex.reps} • {ex.rest}s
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exActions}>
                    <TouchableOpacity
                      style={[styles.infoIconBtn, { backgroundColor: theme.bgSecondary }]}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId((prev) => (prev === ex.id ? null : ex.id));
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'information-outline'}
                        size={16}
                        color={theme.text}
                      />
                    </TouchableOpacity>

                    {mode === 'pick' || mode === 'swap' ? (
                      <View
                        style={[
                          styles.addPill,
                          {
                            backgroundColor: isAdded ? theme.bgSecondary : theme.primary,
                            borderColor: isAdded ? theme.border : theme.primary,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isAdded ? 'checkmark' : 'add'}
                          size={15}
                          color={isAdded ? theme.textMuted : theme.primaryText}
                        />
                        <Text
                          style={[
                            styles.addPillText,
                            { color: isAdded ? theme.textMuted : theme.primaryText },
                          ]}
                        >
                          {mode === 'swap' ? 'Zamień' : isAdded ? 'Dodano' : 'Dodaj'}
                        </Text>
                      </View>
                    ) : ex.isCustom ? (
                      <TouchableOpacity
                        style={styles.deleteIconBtn}
                        onPress={() => handleDeleteCustom(ex)}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={[styles.expandedBox, { backgroundColor: theme.bgSecondary }]}>
                    <Text style={[styles.expandedDesc, { color: theme.textSecondary }]}>
                      {ex.description}
                    </Text>
                    {ex.note ? (
                      <Text style={[styles.expandedNote, { color: theme.textMuted }]}>
                        Wskazówka: {ex.note}
                      </Text>
                    ) : null}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  newBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterWrap: {
    marginBottom: 8,
  },
  filterScroll: {
    gap: 6,
    paddingRight: 10,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 32,
  },
  createCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  formSub: {
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  multiInput: {
    minHeight: 68,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chipRow: {
    gap: 6,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  defaultsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  defaultCol: {
    flex: 1,
  },
  smallInput: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  saveCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    marginTop: 14,
  },
  saveCustomBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  exRowWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    gap: 10,
  },
  exInfo: {
    flex: 1,
  },
  exTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  exName: {
    fontSize: 15,
    fontWeight: '700',
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  exMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  catTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  addPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deleteIconBtn: {
    padding: 6,
  },
  expandedBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  expandedDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  expandedNote: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
});
