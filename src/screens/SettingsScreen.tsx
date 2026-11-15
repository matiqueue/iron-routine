import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
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
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  AppSettings,
  HealthDailySummary,
  SupplementItem,
  UserGender,
  UserProfile,
} from '../types/workout';
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
  getFavoriteExerciseIds,
  importPlansFromSeedOrBackupJson,
  importProfileBackup,
  resetAllAppData,
  updateProfile,
} from '../services/storage';
import {
  CloudSession,
  getStoredCloudSession,
  pullProfileFromCloud,
  pushProfileToCloud,
  signInWithAppleCloud,
  signInWithGoogleCloud,
} from '../services/cloudSync';
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
  const { t } = useLanguage();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [nameInput, setNameInput] = useState(activeProfile.name || '');
  const [genderInput, setGenderInput] = useState<UserGender>(activeProfile.gender || 'male');
  const [heightInput, setHeightInput] = useState(
    activeProfile.height ? String(activeProfile.height) : ''
  );
  const [weightInput, setWeightInput] = useState(
    activeProfile.weight ? String(activeProfile.weight) : ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Cloud Sync state (Clerk + Vercel NoSQL)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [busyCloudProvider, setBusyCloudProvider] = useState<'apple' | 'google' | null>(null);

  const [customCount, setCustomCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
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
    setGenderInput(activeProfile.gender || 'male');
    setHeightInput(activeProfile.height ? String(activeProfile.height) : '');
    setWeightInput(activeProfile.weight ? String(activeProfile.weight) : '');
  }, [
    activeProfile.id,
    activeProfile.name,
    activeProfile.gender,
    activeProfile.height,
    activeProfile.weight,
  ]);

  const loadMeta = async () => {
    const [loadedSettings, custom, favorites, permSummary, session] = await Promise.all([
      getAppSettings(),
      getCustomExercises(),
      getFavoriteExerciseIds(),
      getNotificationPermissionSummary(),
      getStoredCloudSession(),
    ]);
    setSettings(loadedSettings);
    setCustomCount(custom.length);
    setFavoriteCount(favorites.length);
    setNotifPerm(permSummary);
    setCloudSession(session);
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

  const handleToggleGender = async (nextGender: UserGender) => {
    if (nextGender === genderInput) return;
    triggerSelectionHaptic();
    setGenderInput(nextGender);
    try {
      const updated = await updateProfile(activeProfile.id, { gender: nextGender });
      onProfileUpdated(updated);
    } catch {}
  };

  const handleCloudProviderSignIn = async (provider: 'apple' | 'google') => {
    if (busyCloudProvider) return;
    triggerSelectionHaptic();
    setBusyCloudProvider(provider);
    try {
      const res =
        provider === 'apple'
          ? await signInWithAppleCloud(nameInput.trim() || activeProfile.name)
          : await signInWithGoogleCloud(nameInput.trim() || activeProfile.name);

      if (!res.ok || !res.session) {
        Alert.alert('Logowanie w chmurze', res.error || 'Nie udało się połączyć konta.');
        return;
      }

      const session = res.session;
      setCloudSession(session);
      triggerNotificationHaptic('success');

      const uploadCurrent = async () => {
        const pushRes = await pushProfileToCloud(activeProfile.id);
        const updatedProfile = await updateProfile(
          activeProfile.id,
          {
            cloudUserId: session.userId,
            cloudProvider: session.provider,
            cloudEmail: session.email,
            lastCloudSyncAt: pushRes.syncedAt || new Date().toISOString(),
          },
          { skipCloudSync: true }
        ).catch(() => null);
        if (updatedProfile) {
          onProfileUpdated(updatedProfile);
        }
        Alert.alert(
          'Połączono konto',
          `Połączono z ${
            session.provider === 'apple' ? 'iCloud' : 'Google'
          }. Od teraz Twoje dane będą się automatycznie zapisywać w chmurze.`
        );
      };

      if (!res.isNewAccount && session.backupSummary) {
        Alert.alert(
          'Znaleziono konto w chmurze',
          `Na tym koncie zapisany jest profil "${session.backupSummary.profileName}" (${session.backupSummary.plansCount} planów). Przywrócić go czy zapisać obecne dane lokalne?`,
          [
            {
              text: 'Zapisz obecne',
              onPress: () => {
                uploadCurrent();
              },
            },
            {
              text: 'Przywróć z chmury',
              onPress: async () => {
                const pullRes = await pullProfileFromCloud();
                if (pullRes.ok && pullRes.profile) {
                  await onDataImported();
                  await loadMeta();
                  triggerNotificationHaptic('success');
                  Alert.alert('Przywrócono', `Załadowano profil "${pullRes.profile.name}".`);
                } else {
                  await uploadCurrent();
                }
              },
            },
          ]
        );
      } else {
        await uploadCurrent();
      }
    } catch (e: any) {
      Alert.alert('Logowanie w chmurze', e?.message || 'Nie udało się połączyć z chmurą.');
    } finally {
      setBusyCloudProvider(null);
    }
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
        gender: genderInput,
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

  const isCloudLoggedIn = Boolean(
    cloudSession || activeProfile.cloudUserId || activeProfile.cloudEmail
  );

  const savedName = (activeProfile.name || '').trim();
  const savedHeight = activeProfile.height ? String(activeProfile.height) : '';
  const savedWeight = activeProfile.weight ? String(activeProfile.weight) : '';
  const hasProfileChanges =
    nameInput.trim() !== savedName ||
    heightInput.trim() !== savedHeight ||
    weightInput.trim() !== savedWeight ||
    genderInput !== (activeProfile.gender || 'male');

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Open Editorial Header */}
      <View style={[styles.header, { borderBottomColor: theme.hairline, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settingsTitle')}</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>
            {t('settingsSectionProfile')} · {t('settingsSectionSupps')}
          </Text>
        </View>
        <LanguageSwitcher variant="pill" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* =========================================================
            CLOUD LINK PROMPT (ONLY VISIBLE WHEN NOT LOGGED IN)
           ========================================================= */}
        {!isCloudLoggedIn && (
          <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                  CHMURA KONTA (CLERK)
                </Text>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  Chcesz połączyć konto z chmurą?
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
              Połącz iCloud lub Google, aby automatycznie synchronizować swoje plany i rekordy w bazie NoSQL.
            </Text>

            <View style={styles.cloudTwoBtnRow}>
              <TouchableOpacity
                style={[
                  styles.cloudTwoBtnPrimary,
                  {
                    backgroundColor: theme.text,
                    opacity: busyCloudProvider && busyCloudProvider !== 'apple' ? 0.55 : 1,
                  },
                ]}
                onPress={() => handleCloudProviderSignIn('apple')}
                disabled={Boolean(busyCloudProvider)}
                activeOpacity={0.85}
              >
                {busyCloudProvider === 'apple' ? (
                  <ActivityIndicator size="small" color={theme.bg} />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={18} color={theme.bg} />
                    <Text style={[styles.cloudTwoBtnText, { color: theme.bg }]}>iCloud</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cloudTwoBtnSecondary,
                  {
                    backgroundColor: theme.bgSecondary,
                    borderColor: theme.border,
                    opacity: busyCloudProvider && busyCloudProvider !== 'google' ? 0.55 : 1,
                  },
                ]}
                onPress={() => handleCloudProviderSignIn('google')}
                disabled={Boolean(busyCloudProvider)}
                activeOpacity={0.85}
              >
                {busyCloudProvider === 'google' ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={16} color={theme.text} />
                    <Text style={[styles.cloudTwoBtnText, { color: theme.text }]}>Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =========================================================
            SECTION 2: ATHLETE PROFILE & GENDER MODEL
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                TOŻSAMOŚĆ I ANATOMIA
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Profil sportowca
              </Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
            MODEL SYLWETKI W OSIĄGACH
          </Text>
          <View style={styles.providerPillsRow}>
            {(
              [
                { id: 'male', label: 'Mężczyzna', icon: 'male-outline' as const },
                { id: 'female', label: 'Kobieta', icon: 'female-outline' as const },
              ] as const
            ).map((g) => {
              const active = genderInput === g.id;
              return (
                <TouchableOpacity
                  key={g.id}
                  style={[
                    styles.providerPill,
                    {
                      backgroundColor: active ? theme.text : theme.bgSecondary,
                    },
                  ]}
                  onPress={() => handleToggleGender(g.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={g.icon}
                    size={16}
                    color={active ? theme.bg : theme.text}
                  />
                  <Text
                    style={[
                      styles.providerPillText,
                      { color: active ? theme.bg : theme.text },
                    ]}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.underlineField, { borderBottomColor: theme.hairline }]}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>IMIĘ / PSEUDONIM</Text>
            <TextInput
              style={[styles.underlineInput, { color: theme.text }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="Twoje imię"
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.underlineField, { flex: 1, borderBottomColor: theme.hairline }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>WZROST (CM)</Text>
              <TextInput
                style={[styles.underlineInput, { color: theme.text }]}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType="number-pad"
                placeholder="180"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={[styles.underlineField, { flex: 1, borderBottomColor: theme.hairline }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>MASA CIAŁA (KG)</Text>
              <TextInput
                style={[styles.underlineInput, { color: theme.text }]}
                value={weightInput}
                onChangeText={setWeightInput}
                keyboardType="decimal-pad"
                placeholder="80.0"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </View>

          {hasProfileChanges && (
            <TouchableOpacity
              style={[styles.openPrimaryAction, { backgroundColor: theme.primary, marginTop: 8 }]}
              onPress={handleSaveProfile}
              disabled={isSavingProfile}
              activeOpacity={0.85}
            >
              {isSavingProfile ? (
                <ActivityIndicator size="small" color={theme.primaryText} />
              ) : (
                <Text style={[styles.openPrimaryActionText, { color: theme.primaryText }]}>
                  {t('settingsProfileSave')}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* =========================================================
            SECTION 3: HAPTICS & REST TIMER
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                CZAS I CZUCIE
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Haptyka i przerwy
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallActionPill, { backgroundColor: theme.bgSecondary }]}
              onPress={() => triggerImpactHaptic('heavy')}
              activeOpacity={0.75}
            >
              <Ionicons name="radio-outline" size={13} color={theme.text} />
              <Text style={[styles.smallActionPillText, { color: theme.text }]}>Testuj</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
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

          <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>
            SIŁA WIBRACJI
          </Text>
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
                      backgroundColor: active ? theme.text : theme.bgSecondary,
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
                      { color: active ? theme.bg : theme.text },
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline, marginTop: 8 }]}>
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

          <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>
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
                      backgroundColor: active ? theme.text : theme.bgSecondary,
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
                      { color: active ? theme.bg : theme.text },
                    ]}
                  >
                    {secs}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* =========================================================
            SECTION 4: NOTIFICATIONS & REMINDERS
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                ALERTY SYSTEMOWE
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Powiadomienia i przypomnienia
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallActionPill, { backgroundColor: theme.bgSecondary }]}
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
              <Ionicons name="notifications-outline" size={13} color={theme.text} />
              <Text style={[styles.smallActionPillText, { color: theme.text }]}>Test (5s)</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Alarm końca przerwy poza aplikacją
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Lokalny alarm z dźwiękiem i wibracją gdy wyjdziesz z aplikacji
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
              style={[styles.permWarnBox, { backgroundColor: theme.bgSecondary }]}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.8}
            >
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={[styles.permWarnText, { color: theme.text }]}>
                System blokuje dźwięk lub alerty powiadomień. Dotknij, aby otworzyć Ustawienia.
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                Przypomnienia o suplementach
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Poranne oraz wieczorne przypomnienie o Twojej liście dawek
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
              <View style={[styles.hourBox, { backgroundColor: theme.bgSecondary }]}>
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>RANO</Text>
                <View style={styles.hourControls}>
                  <TouchableOpacity
                    style={[styles.hourBtn, { backgroundColor: theme.bg }]}
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
                    style={[styles.hourBtn, { backgroundColor: theme.bg }]}
                    onPress={() => {
                      const next = Math.min(14, settings.creatineMorningHour + 1);
                      handlePatchSettings({ creatineMorningHour: next }, true);
                    }}
                  >
                    <Ionicons name="add" size={14} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.hourBox, { backgroundColor: theme.bgSecondary }]}>
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>WIECZÓR</Text>
                <View style={styles.hourControls}>
                  <TouchableOpacity
                    style={[styles.hourBtn, { backgroundColor: theme.bg }]}
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
                    style={[styles.hourBtn, { backgroundColor: theme.bg }]}
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

          <View style={styles.openSwitchLine}>
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
            <View style={[styles.hourSingleRow, { backgroundColor: theme.bgSecondary }]}>
              <Text style={[styles.hourLabel, { color: theme.textMuted }]}>GODZINA WAŻENIA</Text>
              <View style={styles.hourControls}>
                <TouchableOpacity
                  style={[styles.hourBtn, { backgroundColor: theme.bg }]}
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
                  style={[styles.hourBtn, { backgroundColor: theme.bg }]}
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

        {/* =========================================================
            SECTION 5: SUPPLEMENTS & HEALTH INTEGRATION
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#F59E0B' }]}>
                REGENERACJA I ZDROWIE
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Suplementacja i {Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.smallActionPill, { backgroundColor: theme.bgSecondary }]}
              onPress={() => {
                triggerSelectionHaptic();
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setShowSuppEditor((p) => !p);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.smallActionPillText, { color: theme.text }]}>
                {showSuppEditor ? 'Zwiń' : 'Dawki'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
            {buildActiveSupplementsSummary(settings.supplements, activeProfile.weight)}
          </Text>

          {showSuppEditor && (
            <View style={{ marginTop: 12, marginBottom: 8 }}>
              <SupplementConfigurator
                supplements={settings.supplements}
                weightKg={activeProfile.weight}
                onChange={handleSupplementsChange}
              />
            </View>
          )}

          <View style={[styles.openSwitchLine, { borderTopColor: theme.hairline, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <AnimatedIcon
                name="heart"
                preset="heart"
                size={18}
                color={settings.healthSyncEnabled ? '#EF4444' : theme.text}
                active={settings.healthSyncEnabled}
              />
              <View style={styles.switchLabelWrap}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  Synchronizuj kroki i sen ({Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'})
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  Pobiera kroki, czas snu i aktywne kalorie do wskazówek dnia
                </Text>
              </View>
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
            <View style={styles.healthPillRow}>
              <View style={[styles.healthChip, { backgroundColor: theme.bgSecondary }]}>
                <Ionicons name="footsteps-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>
                  {healthSummary.steps !== null
                    ? `${healthSummary.steps.toLocaleString('pl-PL')} kroków`
                    : '- kroków'}
                </Text>
              </View>
              <View style={[styles.healthChip, { backgroundColor: theme.bgSecondary }]}>
                <Ionicons name="moon-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>
                  {healthSummary.sleepHours !== null ? `${healthSummary.sleepHours} h snu` : '- h snu'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.healthChip, { backgroundColor: theme.bgSecondary }]}
                onPress={handleRefreshHealth}
                disabled={isSyncingHealth}
              >
                <Ionicons name="refresh-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>Odśwież</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* =========================================================
            SECTION 6: APPEARANCE, EXERCISE LIBRARY & LOCAL JSON
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                {t('settingsSectionAppearance')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('settingsAppearanceHeading')}
              </Text>
            </View>
          </View>

          <LanguageSwitcher variant="row" />

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{t('settingsDarkMode')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('settingsDarkModeSub')}
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

          <TouchableOpacity
            style={[styles.openActionLine, { borderBottomColor: theme.hairline }]}
            onPress={() => {
              triggerSelectionHaptic();
              setShowExerciseLibrary(true);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{t('settingsExerciseDb')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('settingsExerciseDbSub', {
                  base: EXERCISE_LIBRARY.length,
                  custom: customCount,
                  fav: favoriteCount,
                })}
              </Text>
            </View>
            <View style={[styles.smallActionPill, { backgroundColor: theme.text }]}>
              <Text style={[styles.smallActionPillText, { color: theme.bg }]}>{t('open')}</Text>
              <Ionicons name="chevron-forward" size={13} color={theme.bg} />
            </View>
          </TouchableOpacity>

          <View style={styles.ioButtonsRow}>
            <TouchableOpacity
              style={[styles.cloudActionSecondary, { backgroundColor: theme.bgSecondary }]}
              onPress={handleExportJson}
              disabled={isBusyIO}
              activeOpacity={0.75}
            >
              <Ionicons name="share-outline" size={16} color={theme.text} />
              <Text style={[styles.cloudActionSecondaryText, { color: theme.text }]}>
                {t('settingsExportJson')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cloudActionSecondary, { backgroundColor: theme.bgSecondary }]}
              onPress={() => setShowImportSheet(true)}
              disabled={isBusyIO}
              activeOpacity={0.75}
            >
              <Ionicons name="download-outline" size={16} color={theme.text} />
              <Text style={[styles.cloudActionSecondaryText, { color: theme.text }]}>
                {t('settingsImportJson')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* =========================================================
            SECTION 7: MAIN CONTRIBUTOR & RESET
           ========================================================= */}
        <View style={styles.openSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                MAIN CONTRIBUTOR
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Twórca i wsparcie projektu
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.openActionLine, { borderBottomColor: theme.hairline }]}
            onPress={() => {
              triggerSelectionHaptic();
              Linking.openURL('https://github.com/matiqueue').catch(() => {});
            }}
            activeOpacity={0.75}
          >
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>matique (@matiqueue)</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Kod źródłowy, nowe wydania i zgłoszenia na GitHub
              </Text>
            </View>
            <View style={[styles.smallActionPill, { backgroundColor: theme.bgSecondary }]}>
              <Ionicons name="logo-github" size={14} color={theme.text} />
              <Text style={[styles.smallActionPillText, { color: theme.text }]}>GitHub</Text>
            </View>
          </TouchableOpacity>

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

          <TouchableOpacity
            style={styles.resetDangerWrap}
            onPress={handleConfirmResetApp}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
            <Text style={styles.resetDangerText}>Wyzeruj dane lokalne na tym urządzeniu</Text>
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
              { backgroundColor: theme.bgSecondary, color: theme.text },
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
            style={[styles.openPrimaryAction, { backgroundColor: theme.primary, marginTop: 14 }]}
            onPress={handleImportPlansOnly}
            disabled={isBusyIO}
            activeOpacity={0.85}
          >
            <Text style={[styles.openPrimaryActionText, { color: theme.primaryText }]}>
              Dodaj plany do obecnego profilu
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.cloudActionSecondary,
              { backgroundColor: theme.bgSecondary, marginTop: 10, width: '100%' },
            ]}
            onPress={handleImportFullBackup}
            disabled={isBusyIO}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color={theme.text} />
            <Text style={[styles.cloudActionSecondaryText, { color: theme.text }]}>
              Przywróć pełny backup (z rekordami)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </InteractiveBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  openSection: {
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sectionLead: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cloudConnectedWrap: {
    gap: 12,
  },
  cloudAccountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  cloudEmailTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  cloudSyncSub: {
    fontSize: 11,
    marginTop: 2,
  },
  signOutLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  cloudActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudActionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 999,
  },
  cloudActionPrimaryText: {
    fontSize: 13,
    fontWeight: '900',
  },
  cloudActionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 999,
  },
  cloudActionSecondaryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  deleteCloudLinkWrap: {
    alignItems: 'center',
    paddingTop: 2,
  },
  deleteCloudLinkText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  cloudAuthWrap: {
    gap: 10,
  },
  cloudTwoBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudTwoBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  cloudTwoBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  cloudTwoBtnText: {
    fontSize: 14,
    fontWeight: '900',
  },
  providerPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  providerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 999,
  },
  providerPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  openInputBox: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  openPrimaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
  },
  openPrimaryActionText: {
    fontSize: 14,
    fontWeight: '900',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  underlineField: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  underlineInput: {
    fontSize: 18,
    fontWeight: '800',
    paddingVertical: 2,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 16,
  },
  smallActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  smallActionPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  openSwitchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  openActionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  segmentBtn: {
    flex: 1,
    minWidth: 68,
    borderRadius: 999,
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
    marginVertical: 10,
  },
  hourBox: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  hourSingleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
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
    borderRadius: 999,
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
  ioButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  healthPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  healthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  healthChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permWarnBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
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
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  coffeeBtnText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  resetDangerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    marginTop: 8,
  },
  resetDangerText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '800',
  },
  jsonInput: {
    borderRadius: 14,
    padding: 14,
    minHeight: 220,
    fontSize: 12,
    fontFamily: 'Courier',
  },
});
