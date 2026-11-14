import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { PlanTemplateKey, UserProfile, WorkoutPlan } from '../types/workout';
import { PLAN_TEMPLATE_OPTIONS } from '../data/exerciseLibrary';
import {
  createWorkoutPlan,
  deleteWorkoutPlan,
  duplicateWorkoutPlan,
  saveWorkoutPlan,
  setActivePlanId,
} from '../services/storage';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';

interface PlanManagerModalProps {
  visible: boolean;
  onClose: () => void;
  activeProfile: UserProfile;
  plans: WorkoutPlan[];
  activePlan: WorkoutPlan;
  onPlansUpdated: (nextActivePlanId?: string) => Promise<void> | void;
}

export const PlanManagerModal: React.FC<PlanManagerModalProps> = ({
  visible,
  onClose,
  activeProfile,
  plans,
  activePlan,
  onPlansUpdated,
}) => {
  const { theme } = useAppTheme();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplateKey>('fbw3');

  const [renamingPlanId, setRenamingPlanId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameSubText, setRenameSubText] = useState('');

  const handleActivatePlan = async (planId: string) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    await setActivePlanId(planId, activeProfile.id);
    await onPlansUpdated(planId);
    onClose();
  };

  const handleStartCreate = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowCreateForm((prev) => !prev);
  };

  const handleCreatePlan = async () => {
    const trimmed = newName.trim();
    const fallbackTemplate = PLAN_TEMPLATE_OPTIONS.find((t) => t.id === selectedTemplate);
    const finalName =
      trimmed ||
      (selectedTemplate === 'clone_current'
        ? `${activePlan.name} (Nowy)`
        : fallbackTemplate?.label || 'Nowy plan');

    const created = await createWorkoutPlan({
      name: finalName,
      subtitle: newSubtitle.trim() || fallbackTemplate?.subtitle,
      templateKey: selectedTemplate,
      cloneFromDays: selectedTemplate === 'clone_current' ? activePlan.days : undefined,
      setActive: true,
      profileId: activeProfile.id,
    });

    setNewName('');
    setNewSubtitle('');
    setShowCreateForm(false);
    await onPlansUpdated(created.id);
    onClose();
  };

  const handleDuplicate = async (plan: WorkoutPlan) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    const dup = await duplicateWorkoutPlan(plan.id, `${plan.name} (kopia)`, activeProfile.id);
    await onPlansUpdated(dup.id);
  };

  const handleStartRename = (plan: WorkoutPlan) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (renamingPlanId === plan.id) {
      setRenamingPlanId(null);
      return;
    }
    setRenamingPlanId(plan.id);
    setRenameText(plan.name);
    setRenameSubText(plan.subtitle || '');
  };

  const handleConfirmRename = async (plan: WorkoutPlan) => {
    const trimmed = renameText.trim();
    if (!trimmed) {
      Alert.alert('Brak nazwy', 'Nazwa planu nie może być pusta.');
      return;
    }
    await saveWorkoutPlan(
      {
        ...plan,
        name: trimmed,
        subtitle: renameSubText.trim() || undefined,
      },
      activeProfile.id
    );
    setRenamingPlanId(null);
    await onPlansUpdated();
  };

  const handleDelete = (plan: WorkoutPlan) => {
    if (plans.length <= 1) {
      Alert.alert('Nie można usunąć', 'Profil musi posiadać co najmniej jeden aktywny plan.');
      return;
    }

    Alert.alert(
      'Usunąć plan treningowy?',
      `Plan „${plan.name}” zostanie trwale usunięty dla profilu ${activeProfile.name}.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń plan',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextActiveId = await deleteWorkoutPlan(plan.id, activeProfile.id);
              await onPlansUpdated(nextActiveId);
            } catch (e: any) {
              Alert.alert('Błąd', e?.message || 'Nie udało się usunąć planu.');
            }
          },
        },
      ]
    );
  };

  const getPlanStats = (plan: WorkoutPlan) => {
    const workoutDays = plan.days.filter((d) => d.type === 'workout');
    const exCount = workoutDays.reduce((sum, d) => sum + (d.exercises?.length || 0), 0);
    return `${workoutDays.length} dni tren. • ${exCount} ćwiczeń`;
  };

  const templates: { id: PlanTemplateKey; label: string; subtitle: string; summary: string }[] = [
    ...PLAN_TEMPLATE_OPTIONS,
    {
      id: 'clone_current',
      label: 'Kopia bieżącego',
      subtitle: `Na bazie: ${activePlan.name}`,
      summary: 'Sklonuj wszystkie dni i ćwiczenia obecnie wybranego planu.',
    },
  ];

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title="Plany treningowe"
      subtitle={`Profil: ${activeProfile.name} • ${plans.length} ${plans.length === 1 ? 'plan' : 'plany'}`}
      initialHeightPercent={0.86}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Toggle New Plan Form */}
          <TouchableOpacity
            style={[
              styles.newPlanTrigger,
              {
                backgroundColor: showCreateForm ? theme.bgSecondary : theme.primary,
                borderColor: showCreateForm ? theme.border : theme.primary,
              },
            ]}
            onPress={handleStartCreate}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showCreateForm ? 'close' : 'add'}
              size={18}
              color={showCreateForm ? theme.text : theme.primaryText}
            />
            <Text
              style={[
                styles.newPlanTriggerText,
                { color: showCreateForm ? theme.text : theme.primaryText },
              ]}
            >
              {showCreateForm ? 'Anuluj tworzenie planu' : 'Utwórz nowy plan treningowy'}
            </Text>
          </TouchableOpacity>

          {/* Inline Plan Builder */}
          {showCreateForm && (
            <View
              style={[
                styles.createBox,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.sectionKicker, { color: theme.textMuted }]}>
                NOWY PLAN DLA {activeProfile.name.toUpperCase()}
              </Text>

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Nazwa planu (np. Masa — Push Pull Legs)"
                placeholderTextColor={theme.textMuted}
                value={newName}
                onChangeText={setNewName}
              />

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Krótki opis / cel (opcjonalnie)"
                placeholderTextColor={theme.textMuted}
                value={newSubtitle}
                onChangeText={setNewSubtitle}
              />

              <Text style={[styles.sectionKicker, { color: theme.textMuted, marginTop: 6 }]}>
                SZABLON STARTOWY
              </Text>

              <View style={styles.templateGrid}>
                {templates.map((tpl) => {
                  const selected = selectedTemplate === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.templateCard,
                        {
                          backgroundColor: selected ? theme.primary : theme.card,
                          borderColor: selected ? theme.primary : theme.border,
                        },
                      ]}
                      onPress={() => {
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                        setSelectedTemplate(tpl.id);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.tplLabel,
                          { color: selected ? theme.primaryText : theme.text },
                        ]}
                      >
                        {tpl.label}
                      </Text>
                      <Text
                        style={[
                          styles.tplSummary,
                          {
                            color: selected ? theme.primaryText : theme.textMuted,
                            opacity: selected ? 0.85 : 1,
                          },
                        ]}
                      >
                        {tpl.summary}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.confirmCreateBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreatePlan}
                activeOpacity={0.85}
              >
                <Text style={[styles.confirmCreateText, { color: theme.primaryText }]}>
                  Utwórz i aktywuj plan
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Plans List */}
          <Text style={[styles.listTitle, { color: theme.textMuted }]}>
            ZAPISANE PLANY ({plans.length})
          </Text>

          {plans.map((plan) => {
            const isActive = plan.id === activePlan.id;
            const isRenaming = renamingPlanId === plan.id;

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.bgSecondary,
                    borderColor: isActive ? theme.text : theme.border,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.planMainRow}
                  onPress={() => handleActivatePlan(plan.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <View style={styles.planTitleRow}>
                      <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                      {isActive && (
                        <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                          <Text style={[styles.activeBadgeText, { color: theme.primaryText }]}>
                            AKTYWNY
                          </Text>
                        </View>
                      )}
                    </View>
                    {plan.subtitle ? (
                      <Text style={[styles.planSub, { color: theme.textSecondary }]}>
                        {plan.subtitle}
                      </Text>
                    ) : null}
                    <Text style={[styles.planStats, { color: theme.textMuted }]}>
                      {getPlanStats(plan)}
                    </Text>
                  </View>

                  {isActive ? (
                    <Ionicons name="checkmark-circle" size={22} color={theme.text} />
                  ) : (
                    <View style={[styles.usePill, { borderColor: theme.borderDark }]}>
                      <Text style={[styles.usePillText, { color: theme.text }]}>Wybierz</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isRenaming ? (
                  <View style={[styles.renameBox, { borderTopColor: theme.hairline }]}>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                      ]}
                      value={renameText}
                      onChangeText={setRenameText}
                      placeholder="Nazwa planu..."
                      placeholderTextColor={theme.textMuted}
                    />
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                      ]}
                      value={renameSubText}
                      onChangeText={setRenameSubText}
                      placeholder="Podtytuł (opcjonalnie)..."
                      placeholderTextColor={theme.textMuted}
                    />
                    <View style={styles.renameBtns}>
                      <TouchableOpacity
                        style={[styles.smallBtn, { borderColor: theme.border }]}
                        onPress={() => setRenamingPlanId(null)}
                      >
                        <Text style={[styles.smallBtnText, { color: theme.textMuted }]}>Anuluj</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.smallBtnSolid, { backgroundColor: theme.primary }]}
                        onPress={() => handleConfirmRename(plan)}
                      >
                        <Text style={[styles.smallBtnText, { color: theme.primaryText }]}>Zapisz</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.actionsStrip, { borderTopColor: theme.hairline }]}>
                    <TouchableOpacity
                      style={styles.actionChip}
                      onPress={() => handleStartRename(plan)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={14} color={theme.textSecondary} />
                      <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>
                        Nazwa
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionChip}
                      onPress={() => handleDuplicate(plan)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="copy-outline" size={14} color={theme.textSecondary} />
                      <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>
                        Duplikuj
                      </Text>
                    </TouchableOpacity>

                    {plans.length > 1 && (
                      <TouchableOpacity
                        style={styles.actionChip}
                        onPress={() => handleDelete(plan)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={14} color={theme.textMuted} />
                        <Text style={[styles.actionChipText, { color: theme.textMuted }]}>
                          Usuń
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  newPlanTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  newPlanTriggerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  createBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  templateGrid: {
    gap: 8,
    marginBottom: 12,
  },
  templateCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tplLabel: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  tplSummary: {
    fontSize: 12,
    lineHeight: 17,
  },
  confirmCreateBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCreateText: {
    fontSize: 14,
    fontWeight: '800',
  },
  listTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 10,
  },
  planCard: {
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
  },
  planMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  planName: {
    fontSize: 16,
    fontWeight: '800',
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planSub: {
    fontSize: 13,
    marginTop: 2,
  },
  planStats: {
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
  usePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  usePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  renameBox: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  renameBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  smallBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnSolid: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
