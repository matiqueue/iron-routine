import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { AppSettings, HealthDailySummary, SupplementItem, UserProfile } from '../types/workout';
import {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  updateAppSettings,
} from '../services/settings';
import {
  triggerImpactHaptic,
  triggerNotificationHaptic,
  triggerSelectionHaptic,
} from '../services/haptics';
import {
  ensureNotificationPermissions,
  getNotificationPermissionSummary,
  NotificationPermissionSummary,
  scheduleTestRestNotification,
  syncRemindersWithSettings,
} from '../services/notifications';
import { fetchTodayHealthSummary, requestHealthPermissions } from '../services/health';
import { buildActiveSupplementsSummary } from '../data/supplements';
import {
  exportProfileBackup,
  getCustomExercises,
  importPlansFromSeedOrBackupJson,
  importProfileBackup,
  resetAllAppData,
  updateProfile,
} from '../services/storage';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { ExerciseLibraryModal } from '../components/ExerciseLibraryModal';
import { InteractiveBottomSheet } from '../components/InteractiveBottomSheet';
import { SupplementConfigurator } from '../components/SupplementConfigurator';
import { AnimatedIcon } from '../components/AnimatedIcon';

interface SettingsScreenProps {
  activeProfile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onSettingsUpdated?: (next: AppSettings) => void;
  onDataImported: () => Promise<void> | void;
  onLibraryChanged?: () => Promise<void> | void;
  onHealthSynced?: (summary: HealthDailySummary | null) => void;
  onAppReset: () => void;
}

const INTENSITY_OPTIONS: Array<{ value: AppSettings['hapticsIntensity']; label: string }> = [
  { value: 'subtle', label: 'Delikatna' },
  { value: 'medium', label: 'Średnia' },
  { value: 'strong', label: 'Mocna' },
];

const REST_PRESETS = [60, 90, 120, 180];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  activeProfile,
  onProfileUpdated,
  onSettingsUpdated,
  onDataImported,
  onLibraryChanged,
  onHealthSynced,
  onAppReset,
}) => {
  const { theme, isDark, toggleTheme } = useAppTheme();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [nameInput, setNameInput] = useState(activeProfile.name || '');
  const [heightInput, setHeightInput] = useState(
    activeProfile.height ? String(activeProfile.height) : ''
  );
  const [weightInput, setWeightInput] = useState(
    activeProfile.weight ? String(activeProfile.weight) : ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [customCount, setCustomCount] = useState(0);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [showSuppEditor, setShowSuppEditor] = useState(false);

  const [healthSummary, setHealthSummary] = useState<HealthDailySummary | null>(null);
  const [isSyncingHealth, setIsSyncingHealth] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermissionSummary | null>(null);

  const [showImportSheet, setShowImportSheet] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isBusyIO, setIsBusyIO] = useState(false);

  useEffect(() => {
    setNameInput(activeProfile.name || '');
    setHeightInput(activeProfile.height ? String(activeProfile.height) : '');
    setWeightInput(activeProfile.weight ? String(activeProfile.weight) : '');
  }, [activeProfile.id, activeProfile.name, activeProfile.height, activeProfile.weight]);

  const loadMeta = async () => {
    const [loadedSettings, custom, permSummary] = await Promise.all([
      getAppSettings(),
      getCustomExercises(),
      getNotificationPermissionSummary(),
    ]);
    setSettings(loadedSettings);
    setCustomCount(custom.length);
    setNotifPerm(permSummary);
    if (loadedSettings.healthSyncEnabled) {
      const h = await fetchTodayHealthSummary();
      setHealthSummary(h);
      onHealthSynced?.(h);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const handlePatchSettings = async (
    patch: Partial<AppSettings>,
    resyncNotifications = false
  ) => {
    const next = await updateAppSettings(patch);
    setSettings(next);
    onSettingsUpdated?.(next);
    if (resyncNotifications) {
      await syncRemindersWithSettings(next);
    }
  };

  const handleSupplementsChange = async (nextSupps: SupplementItem[]) => {
    await handlePatchSettings({ supplements: nextSupps }, true);
  };

  const handleToggleHealthSync = async (enabled: boolean) => {
    triggerSelectionHaptic();
    if (!enabled) {
      await handlePatchSettings({ healthSyncEnabled: false });
      setHealthSummary(null);
      onHealthSynced?.(null);
      return;
    }

    setIsSyncingHealth(true);
    try {
      const granted = await requestHealthPermissions();
      if (!granted) {
        Alert.alert(
          'Brak dostępu',
          Platform.OS === 'ios'
            ? 'Włącz uprawnienia dla Iron Routine w aplikacji Zdrowie (Apple Health) -> Udostępnianie.'
            : 'Zezwól Iron Routine na odczyt danych w Health Connect.'
        );
        await handlePatchSettings({ healthSyncEnabled: false });
        return;
      }

      await handlePatchSettings({ healthSyncEnabled: true });
      const summary = await fetchTodayHealthSummary();
      setHealthSummary(summary);
      onHealthSynced?.(summary);
      triggerNotificationHaptic('success');
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleRefreshHealth = async () => {
    triggerSelectionHaptic();
    setIsSyncingHealth(true);
    try {
      const summary = await fetchTodayHealthSummary();
      setHealthSummary(summary);
      onHealthSynced?.(summary);
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleSaveProfile = async () => {
    const cleanName = nameInput.trim();
    if (!cleanName) {
      Alert.alert('Brak imienia', 'Wpisz swoje imię lub pseudonim.');
      return;
    }
    const parsedHeight = parseFloat(heightInput.replace(',', '.'));
    const parsedWeight = parseFloat(weightInput.replace(',', '.'));
    setIsSavingProfile(true);
    try {
      const updated = await updateProfile(activeProfile.id, {
        name: cleanName,
        height: !isNaN(parsedHeight) && parsedHeight > 50 ? parsedHeight : undefined,
        weight: !isNaN(parsedWeight) && parsedWeight > 20 ? parsedWeight : undefined,
      });
      triggerNotificationHaptic('success');
      onProfileUpdated(updated);
      Alert.alert('Zapisano', 'Dane profilu zostały zaktualizowane.');
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Nie udało się zapisać profilu.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportJson = async () => {
    setIsBusyIO(true);
    try {
      const payload = await exportProfileBackup(activeProfile.id);
      const jsonStr = JSON.stringify(payload, null, 2);
      await Share.share({
        title: `Iron Routine - ${activeProfile.name}`,
        message: jsonStr,
      });
    } catch (e: any) {
      Alert.alert('Błąd eksportu', e?.message || 'Nie udało się wyeksportować danych.');
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleImportPlansOnly = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Puste pole', 'Wklej najpierw kod JSON planu lub backupu.');
      return;
    }
    setIsBusyIO(true);
    try {
      const res = await importPlansFromSeedOrBackupJson(importJsonText);
      await onDataImported();
      await loadMeta();
      setImportJsonText('');
      setShowImportSheet(false);
      Alert.alert(
        'Plany dodane',
        `Zaimportowano ${res.importedCount} ${res.importedCount === 1 ? 'plan' : 'planów'}. Twoje statystyki i rekordy zostały zachowane.`
      );
    } catch (e: any) {
      Alert.alert('Błąd importu', e?.message || 'Nieprawidłowy format JSON.');
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleImportFullBackup = async () => {
    if (!importJsonText.trim()) {
      Alert.alert('Puste pole', 'Wklej najpierw kod JSON backupu.');
      return;
    }
    setIsBusyIO(true);
    try {
      const res = await importProfileBackup(importJsonText, 'overwrite_active');
      await onDataImported();
      await loadMeta();
      setImportJsonText('');
      setShowImportSheet(false);
      Alert.alert(
        'Przywrócono profil',
        `Załadowano ${res.plansCount} planów oraz rekordy z ${res.prsCount} ćwiczeń.`
      );
    } catch (e: any) {
      Alert.alert('Błąd importu', e?.message || 'Nieprawidłowy format JSON.');
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleConfirmResetApp = () => {
    Alert.alert(
      'Wyzerować aplikację?',
      'Usuniesz lokalnie profil, wszystkie plany treningowe, historię sesji, wagę oraz rekordy 1RM. Operacji nie można cofnąć.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Wyzeruj wszystko',
          style: 'destructive',
          onPress: async () => {
            await resetAllAppData();
            onAppReset();
          },
        },
      ]
    );
  };

  const switchTrack = {
    false: isDark ? '#27272A' : '#E5E7EB',
    true: theme.primary,
  };
  const switchThumb = isDark ? (settings.hapticsEnabled ? '#000000' : '#FFFFFF') : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerEyebrow, { color: theme.textMuted }]}>SYSTEM I PREFERENCJE</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]}>USTAWIENIA</Text>
          <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
            Jeden profil na urządzenie. Wszystkie rekordy i postępy są automatycznie przypisane do konta.
          </Text>
        </View>

        {/* SECTION 1: PROFILE */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="person-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>PROFIL SPORTOWCA</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: theme.primary }]}>
              <Text style={[styles.badgeChipText, { color: theme.primaryText }]}>AKTYWNY</Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>IMIĘ / NAZWA</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Twoje imię"
            placeholderTextColor={theme.textMuted}
          />

          <View style={styles.twoColRow}>
            <View style={styles.col}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>WZROST (CM)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                ]}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType="number-pad"
                placeholder="np. 180"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={styles.col}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>WAGA STARTOWA (KG)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
                ]}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="np. 82.5"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={handleSaveProfile}
            disabled={isSavingProfile}
            activeOpacity={0.85}
          >
            {isSavingProfile ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                ZAPISZ DANE PROFILU
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION 2: HAPTICS & REST */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="pulse-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>HAPTYKA I PRZERWA</Text>
            </View>
            <TouchableOpacity
              style={[styles.testPillBtn, { borderColor: theme.border }]}
              onPress={() => triggerImpactHaptic('heavy')}
              activeOpacity={0.75}
            >
              <Ionicons name="radio-outline" size={12} color={theme.text} />
              <Text style={[styles.testPillText, { color: theme.text }]}>Testuj</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Wibracje haptyczne</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Informacja zwrotna przy seriach i nawigacji
              </Text>
            </View>
            <Switch
              value={settings.hapticsEnabled}
              onValueChange={(v) => {
                handlePatchSettings({ hapticsEnabled: v }).then(() => {
                  if (v) triggerSelectionHaptic();
                });
              }}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>SIŁA WIBRACJI</Text>
          <View style={[styles.segmentRow, { opacity: settings.hapticsEnabled ? 1 : 0.45 }]}>
            {INTENSITY_OPTIONS.map((opt) => {
              const active = settings.hapticsIntensity === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  disabled={!settings.hapticsEnabled}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active ? theme.primary : theme.bg,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={async () => {
                    await handlePatchSettings({ hapticsIntensity: opt.value });
                    triggerImpactHaptic(
                      opt.value === 'subtle' ? 'light' : opt.value === 'medium' ? 'medium' : 'heavy'
                    );
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.primaryText : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Potrójny sygnał w tle</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Seria 3 powiadomień co 2s po skończonej przerwie poza aplikacją
              </Text>
            </View>
            <Switch
              value={settings.restEndMultiBuzz}
              disabled={!settings.restNotificationsEnabled}
              onValueChange={(v) => handlePatchSettings({ restEndMultiBuzz: v })}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
            DOMYŚLNA PRZERWA NOWYCH ĆWICZEŃ
          </Text>
          <View style={styles.segmentRow}>
            {REST_PRESETS.map((secs) => {
              const active = settings.defaultRestSeconds === secs;
              return (
                <TouchableOpacity
                  key={secs}
                  style={[
                    styles.segmentBtn,
                    {
                      backgroundColor: active ? theme.primary : theme.bg,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    handlePatchSettings({ defaultRestSeconds: secs });
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? theme.primaryText : theme.text },
                    ]}
                  >
                    {secs}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SECTION 3: NOTIFICATIONS & REMINDERS */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="notifications-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>POWIADOMIENIA I PRZYPOMNIENIA</Text>
            </View>
            <TouchableOpacity
              style={[styles.testPillBtn, { borderColor: theme.border }]}
              onPress={async () => {
                triggerSelectionHaptic();
                const res = await scheduleTestRestNotification();
                setNotifPerm(res);
                if (!res.granted) {
                  Alert.alert(
                    'Powiadomienia zablokowane w systemie',
                    'Włącz Alerty i Dźwięki dla Iron Routine w ustawieniach iOS, aby alarm wibrował na zablokowanym ekranie.',
                    [
                      { text: 'Anuluj', style: 'cancel' },
                      { text: 'Ustawienia', onPress: () => Linking.openSettings() },
                    ]
                  );
                  return;
                }
                Alert.alert(
                  'Alarm testowy ustawiony na za 5s',
                  'Wyjdź z aplikacji lub zablokuj ekran teraz, aby sprawdzić alarm i wibrację po 5 sekundach.'
                );
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="notifications" size={12} color={theme.text} />
              <Text style={[styles.testPillText, { color: theme.text }]}>Test w tle (5s)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Alarm końca przerwy poza aplikacją</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Wysyła lokalny alarm z dźwiękiem i systemową wibracją gdy wyjdziesz z apki
              </Text>
            </View>
            <Switch
              value={settings.restNotificationsEnabled}
              onValueChange={async (v) => {
                if (v) {
                  const perm = await ensureNotificationPermissions(true);
                  setNotifPerm(perm);
                }
                await handlePatchSettings({ restNotificationsEnabled: v });
              }}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          {notifPerm && (!notifPerm.granted || !notifPerm.allowsSound) && (
            <TouchableOpacity
              style={[styles.permWarnBox, { backgroundColor: theme.bg, borderColor: '#F59E0B' }]}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={[styles.permWarnText, { color: theme.text }]}>
                System blokuje dźwięk lub alerty powiadomień. Dotknij tutaj, aby włączyć uprawnienia w Ustawieniach systemu.
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Przypomnienia o suplementach</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Poranne oraz awaryjne wieczorne przypomnienie wg Twojego zestawu
              </Text>
            </View>
            <Switch
              value={settings.creatineRemindersEnabled}
              onValueChange={(v) => handlePatchSettings({ creatineRemindersEnabled: v }, true)}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          {settings.creatineRemindersEnabled && (
            <View style={styles.hoursGrid}>
              <View style={[styles.hourBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>RANO</Text>
                <View style={styles.hourControls}>
                  <TouchableOpacity
                    style={[styles.hourBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      const next = Math.max(6, settings.creatineMorningHour - 1);
                      handlePatchSettings({ creatineMorningHour: next }, true);
                    }}
                  >
                    <Ionicons name="remove" size={14} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.hourValue, { color: theme.text }]}>
                    {String(settings.creatineMorningHour).padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    style={[styles.hourBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      const next = Math.min(14, settings.creatineMorningHour + 1);
                      handlePatchSettings({ creatineMorningHour: next }, true);
                    }}
                  >
                    <Ionicons name="add" size={14} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.hourBox, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>WIECZÓR</Text>
                <View style={styles.hourControls}>
                  <TouchableOpacity
                    style={[styles.hourBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      const next = Math.max(17, settings.creatineEveningHour - 1);
                      handlePatchSettings({ creatineEveningHour: next }, true);
                    }}
                  >
                    <Ionicons name="remove" size={14} color={theme.text} />
                  </TouchableOpacity>
                  <Text style={[styles.hourValue, { color: theme.text }]}>
                    {String(settings.creatineEveningHour).padStart(2, '0')}:00
                  </Text>
                  <TouchableOpacity
                    style={[styles.hourBtn, { borderColor: theme.border }]}
                    onPress={() => {
                      const next = Math.min(23, settings.creatineEveningHour + 1);
                      handlePatchSettings({ creatineEveningHour: next }, true);
                    }}
                  >
                    <Ionicons name="add" size={14} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Codzienne ważenie</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Przypomnienie o porannym wpisaniu masy ciała
              </Text>
            </View>
            <Switch
              value={settings.weightReminderEnabled}
              onValueChange={(v) => handlePatchSettings({ weightReminderEnabled: v }, true)}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          {settings.weightReminderEnabled && (
            <View style={[styles.hourSingleRow, { backgroundColor: theme.bg, borderColor: theme.border }]}>
              <Text style={[styles.hourLabel, { color: theme.textMuted }]}>GODZINA WAŻENIA</Text>
              <View style={styles.hourControls}>
                <TouchableOpacity
                  style={[styles.hourBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    const next = Math.max(5, settings.weightReminderHour - 1);
                    handlePatchSettings({ weightReminderHour: next }, true);
                  }}
                >
                  <Ionicons name="remove" size={14} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.hourValue, { color: theme.text }]}>
                  {String(settings.weightReminderHour).padStart(2, '0')}:00
                </Text>
                <TouchableOpacity
                  style={[styles.hourBtn, { borderColor: theme.border }]}
                  onPress={() => {
                    const next = Math.min(12, settings.weightReminderHour + 1);
                    handlePatchSettings({ weightReminderHour: next }, true);
                  }}
                >
                  <Ionicons name="add" size={14} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* SECTION 3B: SUPPLEMENTS & DOSING */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="flask-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>SUPLEMENTACJA I DAWKI</Text>
            </View>
            <TouchableOpacity
              style={[styles.testPillBtn, { borderColor: theme.border }]}
              onPress={() => {
                triggerSelectionHaptic();
                setShowSuppEditor((p) => !p);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.testPillText, { color: theme.text }]}>
                {showSuppEditor ? 'Zwiń' : 'Edytuj'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.rowSub, { color: theme.textSecondary, marginTop: 0 }]}>
            {buildActiveSupplementsSummary(settings.supplements, activeProfile.weight)}
          </Text>

          {showSuppEditor && (
            <View style={{ marginTop: 12 }}>
              <SupplementConfigurator
                supplements={settings.supplements}
                weightKg={activeProfile.weight}
                onChange={handleSupplementsChange}
              />
            </View>
          )}
        </View>

        {/* SECTION 3C: HEALTH INTEGRATION (APPLE HEALTH / HEALTH CONNECT) */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <AnimatedIcon
                name="heart"
                preset="heart"
                size={16}
                color={settings.healthSyncEnabled ? '#EF4444' : theme.text}
                active={settings.healthSyncEnabled}
              />
              <Text style={[styles.cardTitle, { color: theme.text }]}>
                {Platform.OS === 'ios' ? 'APPLE HEALTH' : 'HEALTH CONNECT'}
              </Text>
            </View>
            {settings.healthSyncEnabled && (
              <TouchableOpacity
                style={[styles.testPillBtn, { borderColor: theme.border }]}
                onPress={handleRefreshHealth}
                disabled={isSyncingHealth}
              >
                <Ionicons name="refresh-outline" size={12} color={theme.text} />
                <Text style={[styles.testPillText, { color: theme.text }]}>Odśwież</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Synchronizuj kroki i sen
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Pobiera kroki, czas snu i spaloną energię do inteligentnych wskazówek dnia
              </Text>
            </View>
            <Switch
              value={settings.healthSyncEnabled}
              disabled={isSyncingHealth}
              onValueChange={handleToggleHealthSync}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          {settings.healthSyncEnabled && healthSummary?.authorized && (
            <View style={[styles.healthPillRow, { borderTopColor: theme.hairline }]}>
              <View style={[styles.healthChip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="footsteps-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>
                  {healthSummary.steps !== null
                    ? `${healthSummary.steps.toLocaleString('pl-PL')} kroków`
                    : '- kroków'}
                </Text>
              </View>
              <View style={[styles.healthChip, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                <Ionicons name="moon-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>
                  {healthSummary.sleepHours !== null ? `${healthSummary.sleepHours} h snu` : '- h snu'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* SECTION 4: APPEARANCE & EXERCISE DATABASE */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="barbell-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>WYGLĄD I BAZA ĆWICZEŃ</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Tryb ciemny</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Monochromatyczny interfejs z wysokim kontrastem
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={() => {
                triggerSelectionHaptic();
                toggleTheme();
              }}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              triggerSelectionHaptic();
              setShowExerciseLibrary(true);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Baza i własne ćwiczenia</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {EXERCISE_LIBRARY.length} bazowych + {customCount} własnych ćwiczeń
              </Text>
            </View>
            <View style={[styles.actionPill, { backgroundColor: theme.primary }]}>
              <Text style={[styles.actionPillText, { color: theme.primaryText }]}>Otwórz</Text>
              <Ionicons name="chevron-forward" size={14} color={theme.primaryText} />
            </View>
          </TouchableOpacity>
        </View>

        {/* SECTION 5: BACKUP / SEED & RESET */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="folder-open-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>KOPIA ZAPASOWA I SEED</Text>
            </View>
          </View>

          <View style={styles.ioButtonsRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
              onPress={handleExportJson}
              disabled={isBusyIO}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={16} color={theme.text} />
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Eksportuj JSON</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: theme.bg, borderColor: theme.border }]}
              onPress={() => setShowImportSheet(true)}
              disabled={isBusyIO}
              activeOpacity={0.75}
            >
              <Ionicons name="download-outline" size={16} color={theme.text} />
              <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Importuj JSON</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <TouchableOpacity
            style={[styles.dangerBtn, { borderColor: '#EF4444' }]}
            onPress={handleConfirmResetApp}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnText}>WYZERUJ APLIKACJĘ (NOWY PROFIL)</Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 6: MAIN CONTRIBUTOR & SUPPORT */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Ionicons name="code-slash-outline" size={16} color={theme.text} />
              <Text style={[styles.cardTitle, { color: theme.text }]}>TWÓRCA I WSPARCIE</Text>
            </View>
            <View style={[styles.badgeChip, { backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.border }]}>
              <Text style={[styles.badgeChipText, { color: theme.text }]}>MAIN CONTRIBUTOR</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              triggerSelectionHaptic();
              Linking.openURL('https://github.com/matiqueue').catch(() => {});
            }}
            activeOpacity={0.75}
          >
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>Matique (@matiqueue)</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Kod źródłowy, nowe wydania i feedback na GitHub
              </Text>
            </View>
            <View style={[styles.actionPill, { backgroundColor: theme.bgSecondary, borderWidth: 1, borderColor: theme.border }]}>
              <Ionicons name="logo-github" size={14} color={theme.text} />
              <Text style={[styles.actionPillText, { color: theme.text }]}>GitHub</Text>
            </View>
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: theme.hairline }]} />

          <TouchableOpacity
            style={[styles.coffeeBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => {
              triggerImpactHaptic('medium');
              Linking.openURL('https://matiqueue-portfolio.vercel.app').catch(() => {});
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="cafe-outline" size={18} color="#09090B" />
            <Text style={styles.coffeeBtnText}>Buy Me a Coffee · Wesprzyj autora</Text>
            <Ionicons name="open-outline" size={15} color="#09090B" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Custom Exercise Library Modal */}
      <ExerciseLibraryModal
        visible={showExerciseLibrary}
        onClose={() => setShowExerciseLibrary(false)}
        mode="manage"
        onLibraryChanged={async () => {
          await loadMeta();
          await onLibraryChanged?.();
        }}
      />

      {/* JSON Import Sheet */}
      <InteractiveBottomSheet
        visible={showImportSheet}
        onClose={() => setShowImportSheet(false)}
        title="Import planu lub backupu"
        subtitle="Wklej JSON ze swojego seeda lub eksportu Iron Routine"
        initialHeightPercent={0.78}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={[
              styles.jsonInput,
              { backgroundColor: theme.bg, borderColor: theme.border, color: theme.text },
            ]}
            multiline
            textAlignVertical="top"
            value={importJsonText}
            onChangeText={setImportJsonText}
            placeholder='{ "plans": [ ... ] }'
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 14 }]}
            onPress={handleImportPlansOnly}
            disabled={isBusyIO}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
              DODAJ PLANY DO OBECNEGO PROFILU
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: theme.card, borderColor: theme.border, marginTop: 10, width: '100%' },
            ]}
            onPress={handleImportFullBackup}
            disabled={isBusyIO}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.text} />
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>
              Przywróć pełny backup (z rekordami)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </InteractiveBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 120,
    gap: 14,
  },
  header: {
    marginBottom: 4,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    flexShrink: 1,
  },
  badgeChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeChipText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  testPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  testPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentBtn: {
    flex: 1,
    minWidth: 68,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '800',
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  hourBox: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  hourSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 10,
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  hourControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hourBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourValue: {
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 46,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  ioButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 135,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  dangerBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  jsonInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 220,
    fontSize: 12,
    fontFamily: 'Courier',
  },
  healthPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  healthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  permWarnText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  coffeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  coffeeBtnText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
