import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { triggerImpactHaptic, triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { BottomSheetScrollView, InteractiveBottomSheet } from './InteractiveBottomSheet';

const SHORT_DAY_LABELS: Record<string, string> = {
  mon: 'Pn',
  tue: 'Wt',
  wed: 'Śr',
  thu: 'Cz',
  fri: 'Pt',
  sat: 'Sb',
  sun: 'Nd',
};

const TEMPLATE_ICONS: Record<PlanTemplateKey, keyof typeof Ionicons.glyphMap> = {
  fbw3: 'barbell-outline',
  ppl: 'flame-outline',
  upper_lower: 'swap-vertical-outline',
  blank: 'document-outline',
  clone_current: 'copy-outline',
};

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
    triggerImpactHaptic('light');
    await setActivePlanId(planId, activeProfile.id);
    await onPlansUpdated(planId);
    onClose();
  };

  const handleStartCreate = () => {
    triggerSelectionHaptic();
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

    triggerNotificationHaptic('success');
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
    triggerSelectionHaptic();
    const dup = await duplicateWorkoutPlan(plan.id, `${plan.name} (kopia)`, activeProfile.id);
    await onPlansUpdated(dup.id);
  };

  const handleStartRename = (plan: WorkoutPlan) => {
    triggerSelectionHaptic();
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
    triggerNotificationHaptic('success');
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
      Alert.alert('Nie można usunąć', 'Konto musi posiadać co najmniej jeden aktywny plan.');
      return;
    }

    triggerImpactHaptic('medium');
    Alert.alert(
      'Usunąć plan treningowy?',
      `Plan „${plan.name}” zostanie trwale usunięty. Twoje rekordy (PR) i historia serii pozostają bezpieczne.`,
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

  const getPlanMetrics = (plan: WorkoutPlan) => {
    const workoutDays = plan.days.filter((d) => d.type === 'workout');
    const exCount = workoutDays.reduce((sum, d) => sum + (d.exercises?.length || 0), 0);
    const totalSets = workoutDays.reduce(
      (sum, d) => sum + (d.exercises || []).reduce((s, ex) => s + (ex.sets || 0), 0),
      0
    );
    return {
      workoutDaysCount: workoutDays.length,
      exCount,
      totalSets,
    };
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
      subtitle={`${plans.length} ${plans.length === 1 ? 'plan' : 'plany'} • Wspólne rekordy PR`}
      initialHeightPercent={0.86}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <BottomSheetScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Shared Stats Info Strip */}
          <View
            style={[
              styles.infoBanner,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
          >
            <View style={[styles.infoIconBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Ionicons name="trophy-outline" size={15} color={theme.text} />
            </View>
            <Text style={[styles.infoBannerText, { color: theme.textSecondary }]}>
              Statystyki i rekordy ćwiczeń są wspólne dla wszystkich planów konta {activeProfile.name}.
            </Text>
          </View>

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
            activeOpacity={0.82}
          >
            <Ionicons
              name={showCreateForm ? 'close-circle-outline' : 'add-circle'}
              size={19}
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
                NOWY PLAN TRENINGOWY
              </Text>

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Nazwa planu (np. Masa - Push Pull Legs)"
                placeholderTextColor={theme.textMuted}
                value={newName}
                onChangeText={setNewName}
              />

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                ]}
                placeholder="Krótki cel lub notatka (opcjonalnie)"
                placeholderTextColor={theme.textMuted}
                value={newSubtitle}
                onChangeText={setNewSubtitle}
              />

              <Text style={[styles.sectionKicker, { color: theme.textMuted, marginTop: 8 }]}>
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
                        triggerSelectionHaptic();
                        setSelectedTemplate(tpl.id);
                      }}
                      activeOpacity={0.78}
                    >
                      <View
                        style={[
                          styles.templateIconWrap,
                          {
                            backgroundColor: selected ? 'rgba(255,255,255,0.14)' : theme.bgSecondary,
                            borderColor: selected ? 'rgba(255,255,255,0.2)' : theme.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name={TEMPLATE_ICONS[tpl.id] || 'layers-outline'}
                          size={17}
                          color={selected ? theme.primaryText : theme.text}
                        />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
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
                      </View>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={19}
                        color={selected ? theme.primaryText : theme.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.confirmCreateBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreatePlan}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={18} color={theme.primaryText} />
                <Text style={[styles.confirmCreateText, { color: theme.primaryText }]}>
                  Utwórz i aktywuj plan
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Plans List */}
          <View style={styles.listHeaderRow}>
            <Text style={[styles.listTitle, { color: theme.textMuted }]}>
              TWOJE PLANY ({plans.length})
            </Text>
            <Text style={[styles.listHint, { color: theme.textMuted }]}>
              Dotknij, aby przełączyć
            </Text>
          </View>

          {plans.map((plan) => {
            const isActive = plan.id === activePlan.id;
            const isRenaming = renamingPlanId === plan.id;
            const metrics = getPlanMetrics(plan);

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isActive ? theme.card : theme.bgSecondary,
                    borderColor: isActive ? theme.text : theme.border,
                    borderWidth: isActive ? 1.5 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.planMainRow}
                  onPress={() => handleActivatePlan(plan.id)}
                  activeOpacity={0.78}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.planTitleRow}>
                      <Text
                        style={[styles.planName, { color: theme.text }]}
                        numberOfLines={1}
                      >
                        {plan.name}
                      </Text>
                      {isActive && (
                        <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                          <Text style={[styles.activeBadgeText, { color: theme.primaryText }]}>
                            AKTYWNY
                          </Text>
                        </View>
                      )}
                    </View>

                    {plan.subtitle ? (
                      <Text
                        style={[styles.planSub, { color: theme.textSecondary }]}
                        numberOfLines={2}
                      >
                        {plan.subtitle}
                      </Text>
                    ) : null}

                    {/* 7-day weekly visual rhythm pills */}
                    <View style={styles.weekDotsRow}>
                      {plan.days.slice(0, 7).map((d) => {
                        const isWorkout = d.type === 'workout';
                        const isWalk = d.type === 'walk';
                        return (
                          <View
                            key={d.id}
                            style={[
                              styles.weekDot,
                              {
                                backgroundColor: isWorkout
                                  ? isActive
                                    ? theme.primary
                                    : theme.bgTertiary
                                  : isWalk
                                  ? theme.bgTertiary
                                  : 'transparent',
                                borderColor: isWorkout
                                  ? isActive
                                    ? theme.primary
                                    : theme.borderDark
                                  : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.weekDotText,
                                {
                                  color: isWorkout && isActive
                                    ? theme.primaryText
                                    : isWorkout
                                    ? theme.text
                                    : theme.textMuted,
                                },
                              ]}
                            >
                              {SHORT_DAY_LABELS[d.id] || d.name.slice(0, 2)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    <Text style={[styles.planStats, { color: theme.textMuted }]}>
                      {metrics.workoutDaysCount} dni tren. · {metrics.exCount} ćwiczeń ·{' '}
                      {metrics.totalSets} serii
                    </Text>
                  </View>

                  {isActive ? (
                    <View style={[styles.activeCheckCircle, { backgroundColor: theme.primary }]}>
                      <Ionicons name="checkmark" size={16} color={theme.primaryText} />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.usePill,
                        { backgroundColor: theme.card, borderColor: theme.borderDark },
                      ]}
                    >
                      <Text style={[styles.usePillText, { color: theme.text }]}>Aktywuj</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {isRenaming ? (
                  <View
                    style={[
                      styles.renameBox,
                      { borderTopColor: theme.hairline, backgroundColor: theme.bgSecondary },
                    ]}
                  >
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
                        style={[styles.smallBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
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
                  <View
                    style={[
                      styles.actionsStrip,
                      { borderTopColor: theme.hairline, backgroundColor: theme.bgSecondary },
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleStartRename(plan)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="pencil-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>
                        Edytuj nazwę
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                      onPress={() => handleDuplicate(plan)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="copy-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.actionChipText, { color: theme.textSecondary }]}>
                        Duplikuj
                      </Text>
                    </TouchableOpacity>

                    {plans.length > 1 && (
                      <TouchableOpacity
                        style={[styles.actionChip, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => handleDelete(plan)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="trash-outline" size={13} color={theme.textMuted} />
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
        </BottomSheetScrollView>
      </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 42,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoIconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  newPlanTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  newPlanTriggerText: {
    fontSize: 14,
    fontWeight: '800',
  },
  createBox: {
    padding: 15,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 9,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 9,
  },
  templateGrid: {
    gap: 9,
    marginBottom: 14,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  templateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tplLabel: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  tplSummary: {
    fontSize: 12,
    lineHeight: 16,
  },
  confirmCreateBtn: {
    height: 46,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCreateText: {
    fontSize: 14,
    fontWeight: '800',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  listHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  planCard: {
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
  },
  planMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    gap: 12,
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
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  activeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  planSub: {
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
  },
  weekDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 10,
  },
  weekDot: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  weekDotText: {
    fontSize: 10,
    fontWeight: '800',
  },
  planStats: {
    fontSize: 11.5,
    marginTop: 8,
    fontWeight: '600',
  },
  activeCheckCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  usePill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    flexShrink: 0,
  },
  usePillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  renameBox: {
    padding: 14,
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
    borderRadius: 9,
    borderWidth: 1,
  },
  smallBtnSolid: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
