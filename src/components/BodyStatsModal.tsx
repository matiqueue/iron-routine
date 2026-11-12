import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { UserProfile, WeightEntry } from '../types/workout';
import {
  getWeightHistory,
  addWeightEntry,
  deleteWeightEntry,
  updateProfileStats,
} from '../services/storage';
import {
  isDailyWeightReminderEnabled,
  setDailyWeightReminder,
  isCreatineReminderEnabled,
  setCreatineReminderEnabled,
  sendTestCreatineNotification,
} from '../services/notifications';
import { InteractiveBottomSheet } from './InteractiveBottomSheet';

interface BodyStatsModalProps {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

export const BodyStatsModal: React.FC<BodyStatsModalProps> = ({
  visible,
  profile,
  onClose,
  onProfileUpdated,
}) => {
  const { theme, isDark } = useAppTheme();

  const [history, setHistory] = useState<WeightEntry[]>([]);
  const [currentWeight, setCurrentWeight] = useState<number>(profile.weight || 60.1);
  const [currentHeight, setCurrentHeight] = useState<number>(profile.height || 180);

  // Form input
  const [inputWeight, setInputWeight] = useState<string>(String(profile.weight || 60.1));
  const [inputHeight, setInputHeight] = useState<string>(String(profile.height || 180));
  const [isEditingHeight, setIsEditingHeight] = useState<boolean>(false);

  // Notification toggles
  const [notifEnabled, setNotifEnabled] = useState<boolean>(false);
  const [creatineNotifEnabled, setCreatineNotifEnabled] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      const hist = await getWeightHistory(profile.id);
      setHistory(hist);
      if (hist.length > 0) {
        setCurrentWeight(hist[0].weight);
        setInputWeight(String(hist[0].weight));
      }
      const enabled = await isDailyWeightReminderEnabled();
      setNotifEnabled(enabled);

      const creatineEnabled = await isCreatineReminderEnabled();
      setCreatineNotifEnabled(creatineEnabled);
    } catch (e) {
      console.warn('Error loading body stats', e);
    }
  }, [profile.id]);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

  const bmi = useMemo(() => {
    if (!currentHeight || currentHeight <= 0) return 0;
    const heightInMeters = currentHeight / 100;
    const val = currentWeight / (heightInMeters * heightInMeters);
    return Math.round(val * 10) / 10;
  }, [currentWeight, currentHeight]);

  const bmiCategory = useMemo(() => {
    if (bmi < 18.5) return 'Szczupła sylwetka (budowanie masy)';
    if (bmi < 25) return 'Prawidłowa masa ciała (zdrowy zakres)';
    if (bmi < 30) return 'Masa podwyższona';
    return 'Wysoka masa ciała';
  }, [bmi]);

  const handleAdjustWeight = (delta: number) => {
    const cur = parseFloat(inputWeight.replace(',', '.')) || currentWeight;
    const next = Math.max(30, Math.round((cur + delta) * 10) / 10);
    setInputWeight(String(next));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const handleSaveWeight = async () => {
    const val = parseFloat(inputWeight.replace(',', '.'));
    if (isNaN(val) || val < 30 || val > 300) {
      Alert.alert('Błędna waga', 'Podaj poprawną masę ciała w kg (np. 60.1).');
      return;
    }

    try {
      const entry = await addWeightEntry(val, undefined, undefined, profile.id);
      setCurrentWeight(entry.weight);
      const updatedHist = await getWeightHistory(profile.id);
      setHistory(updatedHist);

      if (onProfileUpdated) {
        onProfileUpdated({ ...profile, weight: entry.weight, height: currentHeight });
      }
    } catch (e) {
      console.error('Error saving weight', e);
    }
  };

  const handleSaveHeight = async () => {
    const h = parseInt(inputHeight, 10);
    if (isNaN(h) || h < 100 || h > 250) {
      Alert.alert('Błędny wzrost', 'Podaj poprawny wzrost w cm (np. 180).');
      return;
    }

    try {
      setCurrentHeight(h);
      setIsEditingHeight(false);
      const updated = await updateProfileStats(profile.id, h, currentWeight);
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.error('Error saving height', e);
    }
  };

  const handleDeleteEntry = (entry: WeightEntry) => {
    Alert.alert('Usunąć wpis wagi?', `${entry.weight} kg z dnia ${entry.date}`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await deleteWeightEntry(entry.id, profile.id);
          const updatedHist = await getWeightHistory(profile.id);
          setHistory(updatedHist);
          if (updatedHist.length > 0) {
            setCurrentWeight(updatedHist[0].weight);
          }
        },
      },
    ]);
  };

  const handleToggleNotif = async (val: boolean) => {
    try {
      Haptics.selectionAsync();
      const success = await setDailyWeightReminder(val);
      setNotifEnabled(success);
      if (val && !success) {
        Alert.alert(
          'Brak uprawnień',
          'Włącz powiadomienia w ustawieniach systemu iOS, aby otrzymywać codzienne przypomnienie o ważeniu.'
        );
      }
    } catch (e) {
      console.warn('Error toggling notif', e);
    }
  };

  const handleToggleCreatineNotif = async (val: boolean) => {
    try {
      Haptics.selectionAsync();
      const success = await setCreatineReminderEnabled(val);
      setCreatineNotifEnabled(success);
      if (val && !success) {
        Alert.alert(
          'Brak uprawnień',
          'Włącz powiadomienia w ustawieniach systemu iOS, aby otrzymywać interaktywne powiadomienia o kreatynie.'
        );
      }
    } catch (e) {
      console.warn('Error toggling creatine notif', e);
    }
  };

  const handleTestCreatineNotif = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendTestCreatineNotification();
      Alert.alert(
        'Powiadomienie testowe wysłane! 💧',
        'Zablokuj iPhone\'a lub odczekaj 3 sekundy. Na banerze/lockscreenie pojawi się powiadomienie z przyciskami:\n\n• [Wziąłem (5g) ✅]\n• [Nie jeszcze ⏳]\n\nMożesz bezpośrednio z ekranu blokady potwierdzić zażycie!'
      );
    } catch (e) {
      console.warn('Error sending test notif', e);
    }
  };

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title="Waga & Sylwetka"
      subtitle="Pomiary ciała i codzienne monitorowanie"
      initialHeightPercent={0.88}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* KPI Cards Strip */}
            <View style={styles.kpiRow}>
              <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Ionicons name="scale-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>{currentWeight} kg</Text>
                <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Aktualna waga</Text>
              </View>

              <TouchableOpacity
                style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                onPress={() => setIsEditingHeight(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="resize-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>{currentHeight} cm</Text>
                <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Wzrost (edytuj)</Text>
              </TouchableOpacity>

              <View style={[styles.kpiCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Ionicons name="fitness-outline" size={20} color={theme.text} />
                <Text style={[styles.kpiVal, { color: theme.text }]}>{bmi}</Text>
                <Text style={[styles.kpiLbl, { color: theme.textMuted }]}>Wskaźnik BMI</Text>
              </View>
            </View>

            {/* BMI status banner */}
            <View style={[styles.statusBanner, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusTitle, { color: theme.text }]}>{bmiCategory}</Text>
                <Text style={[styles.statusSub, { color: theme.textMuted }]}>
                  Przy 180 cm waga 60.1 kg to idealna baza pod budowanie suchej masy mięśniowej (FBW).
                </Text>
              </View>
            </View>

            {/* Height Edit Inline */}
            {isEditingHeight && (
              <View style={[styles.editBox, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Text style={[styles.boxTitle, { color: theme.text }]}>Zmień wzrost (cm)</Text>
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                    keyboardType="number-pad"
                    value={inputHeight}
                    onChangeText={setInputHeight}
                  />
                  <TouchableOpacity
                    style={[styles.saveSmallBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSaveHeight}
                  >
                    <Text style={[styles.saveSmallBtnText, { color: theme.primaryText }]}>Zapisz</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelSmallBtn, { backgroundColor: theme.bgTertiary }]}
                    onPress={() => setIsEditingHeight(false)}
                  >
                    <Text style={[styles.cancelSmallBtnText, { color: theme.text }]}>Anuluj</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Daily Weight Logger Card */}
            <View style={[styles.cardSection, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.boxTitle, { color: theme.text }]}>Zapisz wagę na dziś</Text>

              <View style={styles.stepperWrapper}>
                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleAdjustWeight(-0.1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>-0.1</Text>
                </TouchableOpacity>

                <View style={[styles.weightInputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.weightInputText, { color: theme.text }]}
                    keyboardType="decimal-pad"
                    value={inputWeight}
                    onChangeText={setInputWeight}
                  />
                  <Text style={[styles.kgUnit, { color: theme.textMuted }]}>kg</Text>
                </View>

                <TouchableOpacity
                  style={[styles.stepBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => handleAdjustWeight(0.1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepBtnText, { color: theme.text }]}>+0.1</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                onPress={handleSaveWeight}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle-outline" size={17} color={theme.primaryText} />
                <Text style={[styles.saveBtnText, { color: theme.primaryText }]}>
                  ZAPISZ DZISIEJSZĄ WAGĘ
                </Text>
              </TouchableOpacity>
            </View>

            {/* Daily Weight Reminder Toggle */}
            <View style={[styles.notifRow, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.notifIconWrap}>
                <Ionicons name="notifications-outline" size={20} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, { color: theme.text }]}>
                  Codzienne ważenie (08:00)
                </Text>
                <Text style={[styles.notifSub, { color: theme.textMuted }]}>
                  Przypomnienie o porannym pomiarze na czczo
                </Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={handleToggleNotif}
                trackColor={{ false: theme.border, true: theme.text }}
                thumbColor={theme.card}
              />
            </View>

            {/* Creatine Interactive Reminder (09:00 & 22:00) */}
            <View style={[styles.notifRow, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.notifIconWrap}>
                <Ionicons name="water-outline" size={20} color={theme.text} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.notifTitle, { color: theme.text }]}>
                  Kreatyna 5g (09:00 / 22:00)
                </Text>
                <Text style={[styles.notifSub, { color: theme.textMuted }]}>
                  Interaktywne z poziomu lockscreena. Pyta o 09:00, a jeśli zaznaczysz „Nie jeszcze” — zapyta o 22:00.
                </Text>
              </View>
              <Switch
                value={creatineNotifEnabled}
                onValueChange={handleToggleCreatineNotif}
                trackColor={{ false: theme.border, true: theme.text }}
                thumbColor={theme.card}
              />
            </View>

            {creatineNotifEnabled && (
              <TouchableOpacity
                style={[styles.testNotifBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
                onPress={handleTestCreatineNotif}
                activeOpacity={0.7}
              >
                <Ionicons name="flash-outline" size={15} color={theme.text} />
                <Text style={[styles.testNotifBtnText, { color: theme.text }]}>
                  Przetestuj interaktywne powiadomienie (3s)
                </Text>
              </TouchableOpacity>
            )}

            {/* Weight History List */}
            <View style={styles.historySection}>
              <Text style={[styles.historyHeader, { color: theme.text }]}>
                Historia pomiarów ({history.length})
              </Text>

              {history.length === 0 ? (
                <Text style={[styles.emptyHist, { color: theme.textMuted }]}>
                  Brak wcześniejszych wpisów. Zapisz swój pierwszy pomiar powyżej!
                </Text>
              ) : (
                history.map((entry, idx) => {
                  const prev = history[idx + 1];
                  const diff = prev ? Math.round((entry.weight - prev.weight) * 10) / 10 : 0;

                  return (
                    <View
                      key={entry.id}
                      style={[styles.histRow, { borderBottomColor: theme.hairline }]}
                    >
                      <View>
                        <Text style={[styles.histDate, { color: theme.text }]}>
                          {new Date(entry.date).toLocaleDateString('pl-PL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </Text>
                        {entry.note ? (
                          <Text style={[styles.histNote, { color: theme.textMuted }]}>
                            {entry.note}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.histRight}>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.histVal, { color: theme.text }]}>
                            {entry.weight} kg
                          </Text>
                          {diff !== 0 ? (
                            <Text style={[styles.histDiff, { color: theme.textSecondary }]}>
                              {diff > 0 ? `+${diff}` : diff} kg
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          onPress={() => handleDeleteEntry(entry)}
                          style={styles.trashBtn}
                        >
                          <Ionicons name="trash-outline" size={15} color={theme.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  kpiLbl: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  statusSub: {
    fontSize: 12,
    lineHeight: 17,
  },
  editBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  editRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  saveSmallBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  saveSmallBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  cancelSmallBtn: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  cancelSmallBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardSection: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  stepperWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  weightInputBox: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  weightInputText: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  kgUnit: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  testNotifBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    marginTop: -4,
  },
  testNotifBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  notifSub: {
    fontSize: 12,
    marginTop: 2,
  },
  historySection: {
    marginBottom: 30,
  },
  historyHeader: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  emptyHist: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  histRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  histDate: {
    fontSize: 14,
    fontWeight: '700',
  },
  histNote: {
    fontSize: 12,
    marginTop: 2,
  },
  histRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  histVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  histDiff: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  trashBtn: {
    padding: 6,
  },
});
