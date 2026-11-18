import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Linking,
  Platform,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { MinimalistBackdrop } from '../components/MinimalistBackdrop';
import { SegmentedGlassTabItem, SegmentedGlassTabs } from '../components/SegmentedGlassTabs';
import { SmartScrollView } from '../components/SmartScrollView';
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
  syncRemindersWithSettings,
} from '../services/notifications';
import { fetchTodayHealthSummary, requestHealthPermissions } from '../services/health';
import { buildActiveSupplementsSummary } from '../data/supplements';
import {
  clearAllSyncedCalendarItems,
  getCalendarSyncCapabilities,
  requestCalendarAccess,
  syncWorkoutScheduleWithDevice,
} from '../services/calendarSync';
import {
  ALEXA_ENDPOINT_URL,
  buildAlexaInteractionModelJson,
} from '../services/voiceCommands';
import { getActiveWorkoutPlan } from '../services/storage';
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
import {
  buildAndPublishSocialProfile,
  claimNicknameInCloud,
  ensureE2eeKeyRegistered,
} from '../services/social';
import {
  formatPublicKeyFingerprint,
  getOrCreateE2eeKeyPair,
} from '../utils/e2ee';
import {
  generateRandomNickname,
  getNicknameCooldownInfo,
  isValidNickname,
  normalizeNickname,
  sanitizeNicknameInput,
} from '../utils/nickname';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { ExerciseLibraryModal } from '../components/ExerciseLibraryModal';
import { BottomSheetScrollView, InteractiveBottomSheet } from '../components/InteractiveBottomSheet';
import { SupplementConfigurator } from '../components/SupplementConfigurator';
import { AnimatedIcon } from '../components/AnimatedIcon';
import { UserAvatarBadge } from '../components/UserAvatarBadge';
import { AvatarPickerSheet } from '../components/AvatarPickerSheet';

interface SettingsScreenProps {
  activeProfile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onSettingsUpdated?: (next: AppSettings) => void;
  onDataImported: () => Promise<void> | void;
  onLibraryChanged?: () => Promise<void> | void;
  onHealthSynced?: (summary: HealthDailySummary | null) => void;
  onAppReset: () => void;
}

const INTENSITY_OPTIONS: Array<{ value: AppSettings['hapticsIntensity']; labelKey: TranslationKey }> = [
  { value: 'subtle', labelKey: 'hapticsSubtle' },
  { value: 'medium', labelKey: 'hapticsMedium' },
  { value: 'strong', labelKey: 'hapticsStrong' },
];

const REST_PRESETS = [60, 90, 120, 180];

type SettingsSubTab = 'profile' | 'training' | 'system' | 'data';

const SETTINGS_TABS: Array<{
  key: SettingsSubTab;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: 'settingsTabProfile' | 'settingsTabTraining' | 'settingsTabSystem' | 'settingsTabData';
  accent: string;
}> = [
  { key: 'profile', icon: 'person-outline', labelKey: 'settingsTabProfile', accent: '#10B981' },
  { key: 'training', icon: 'barbell-outline', labelKey: 'settingsTabTraining', accent: '#38BDF8' },
  { key: 'system', icon: 'options-outline', labelKey: 'settingsTabSystem', accent: '#F59E0B' },
  { key: 'data', icon: 'shield-checkmark-outline', labelKey: 'settingsTabData', accent: '#A855F7' },
];

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
  const { t, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [nameInput, setNameInput] = useState(activeProfile.name || '');
  const [nicknameInput, setNicknameInput] = useState(activeProfile.nickname || '');
  const [genderInput, setGenderInput] = useState<UserGender>(activeProfile.gender || 'male');
  const [heightInput, setHeightInput] = useState(
    activeProfile.height ? String(activeProfile.height) : ''
  );
  const [weightInput, setWeightInput] = useState(
    activeProfile.weight ? String(activeProfile.weight) : ''
  );
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Cloud Sync state (Clerk + Neon PostgreSQL)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [busyCloudProvider, setBusyCloudProvider] = useState<'apple' | 'google' | null>(null);

  const [customCount, setCustomCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [showExerciseLibrary, setShowExerciseLibrary] = useState(false);
  const [showSuppEditor, setShowSuppEditor] = useState(false);

  const [healthSummary, setHealthSummary] = useState<HealthDailySummary | null>(null);
  const [isSyncingHealth, setIsSyncingHealth] = useState(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [calendarLabel, setCalendarLabel] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermissionSummary | null>(null);

  const [showImportSheet, setShowImportSheet] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [isBusyIO, setIsBusyIO] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarPickerAllowSkip, setAvatarPickerAllowSkip] = useState(false);
  const [pendingCloudAvatarUrl, setPendingCloudAvatarUrl] = useState<string | null>(null);

  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('profile');
  const settingsTabRef = useRef<SettingsSubTab>('profile');
  const tabContentFade = useRef(new Animated.Value(1)).current;
  const tabContentSlide = useRef(new Animated.Value(0)).current;
  const [e2eeFingerprint, setE2eeFingerprint] = useState('---- · ---- · ---- · ----');

  const switchSettingsTab = useCallback(
    (next: SettingsSubTab) => {
      if (next === settingsTabRef.current) return;
      const curIdx = SETTINGS_TABS.findIndex((s) => s.key === settingsTabRef.current);
      const nextIdx = SETTINGS_TABS.findIndex((s) => s.key === next);
      const dir = nextIdx >= curIdx ? 1 : -1;
      settingsTabRef.current = next;
      setSettingsTab(next);
      tabContentFade.setValue(0.3);
      tabContentSlide.setValue(dir * 14);
      Animated.parallel([
        Animated.timing(tabContentFade, {
          toValue: 1,
          duration: 210,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(tabContentSlide, {
          toValue: 0,
          friction: 9,
          tension: 95,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [tabContentFade, tabContentSlide]
  );

  useEffect(() => {
    settingsTabRef.current = settingsTab;
  }, [settingsTab]);

  useEffect(() => {
    const uid = cloudSession?.userId || activeProfile.cloudUserId || 'device';
    getOrCreateE2eeKeyPair(uid)
      .then((kp) => setE2eeFingerprint(formatPublicKeyFingerprint(kp.publicKey)))
      .catch(() => {});
    if (cloudSession?.token) {
      void ensureE2eeKeyRegistered();
    }
  }, [cloudSession?.userId, cloudSession?.token, activeProfile.cloudUserId]);

  useEffect(() => {
    setNameInput(activeProfile.name || '');
    setNicknameInput(activeProfile.nickname || '');
    setGenderInput(activeProfile.gender || 'male');
    setHeightInput(activeProfile.height ? String(activeProfile.height) : '');
    setWeightInput(activeProfile.weight ? String(activeProfile.weight) : '');
  }, [
    activeProfile.id,
    activeProfile.name,
    activeProfile.nickname,
    activeProfile.gender,
    activeProfile.height,
    activeProfile.weight,
  ]);

  const loadMeta = async () => {
    const [loadedSettings, custom, favorites, permSummary, session, calCap] = await Promise.all([
      getAppSettings(),
      getCustomExercises(),
      getFavoriteExerciseIds(),
      getNotificationPermissionSummary(),
      getStoredCloudSession(),
      getCalendarSyncCapabilities(),
    ]);
    setSettings(loadedSettings);
    setCustomCount(custom.length);
    setFavoriteCount(favorites.length);
    setNotifPerm(permSummary);
    setCloudSession(session);
    setCalendarLabel(calCap.targetCalendarTitle || calCap.providerLabel);
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

  const runCalendarSync = async (nextSettings: AppSettings, notifyUser = true) => {
    setIsSyncingCalendar(true);
    try {
      const { activePlan } = await getActiveWorkoutPlan(activeProfile.id);
      if (!activePlan) return;
      const res = await syncWorkoutScheduleWithDevice(activePlan, nextSettings);
      const refreshed = await getAppSettings();
      setSettings(refreshed);
      if (res.targetCalendarName) setCalendarLabel(res.targetCalendarName);
      if (!res.ok && res.error) {
        Alert.alert(t('errorTitle'), res.error);
      } else if (notifyUser) {
        triggerNotificationHaptic('success');
        Alert.alert(
          t('calendarSyncedSuccessTitle'),
          t('calendarSyncedSuccessBody', {
            events: res.eventsCreated,
            reminders: res.remindersCreated,
          })
        );
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleToggleCalendarSync = async (enabled: boolean) => {
    triggerSelectionHaptic();
    if (!enabled) {
      const next = await updateAppSettings({ calendarSyncEnabled: false });
      setSettings(next);
      onSettingsUpdated?.(next);
      if (!next.remindersSyncEnabled) {
        await clearAllSyncedCalendarItems();
      } else {
        await runCalendarSync(next, false);
      }
      return;
    }

    const perms = await requestCalendarAccess(settings.remindersSyncEnabled);
    if (!perms.calendarGranted) {
      Alert.alert(t('errorTitle'), t('calendarPermDeniedError'));
      return;
    }
    const next = await updateAppSettings({ calendarSyncEnabled: true });
    setSettings(next);
    onSettingsUpdated?.(next);
    await runCalendarSync(next, true);
  };

  const handleToggleRemindersSync = async (enabled: boolean) => {
    triggerSelectionHaptic();
    if (!enabled) {
      const next = await updateAppSettings({ remindersSyncEnabled: false });
      setSettings(next);
      onSettingsUpdated?.(next);
      if (!next.calendarSyncEnabled) {
        await clearAllSyncedCalendarItems();
      } else {
        await runCalendarSync(next, false);
      }
      return;
    }

    const perms = await requestCalendarAccess(true);
    if (Platform.OS === 'ios' && !perms.remindersGranted) {
      Alert.alert(t('errorTitle'), t('calendarPermDeniedError'));
      return;
    }
    const next = await updateAppSettings({ remindersSyncEnabled: true });
    setSettings(next);
    onSettingsUpdated?.(next);
    await runCalendarSync(next, true);
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
        Alert.alert(t('cloudAuthTitle'), res.error || t('cloudConnectFailed'));
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
        if (!activeProfile.avatarUrl && session.avatarUrl) {
          setPendingCloudAvatarUrl(session.avatarUrl);
          setAvatarPickerAllowSkip(true);
          setShowAvatarPicker(true);
        } else {
          Alert.alert(
            t('accountConnectedTitle'),
            t('accountConnectedBody', {
              provider: session.provider === 'apple' ? 'iCloud' : 'Google',
              email: session.email ? ` (${session.email})` : '',
            })
          );
        }
      };

      if (!res.isNewAccount && session.backupSummary) {
        Alert.alert(
          t('cloudAccountFoundTitle'),
          t('accountBackupSettingsBody', {
            name: session.backupSummary.profileName,
            plans: session.backupSummary.plansCount,
          }),
          [
            {
              text: t('keepCurrentBtn'),
              onPress: () => {
                uploadCurrent();
              },
            },
            {
              text: t('restoreFromCloudBtn'),
              onPress: async () => {
                const pullRes = await pullProfileFromCloud();
                if (pullRes.ok && pullRes.profile) {
                  await onDataImported();
                  await loadMeta();
                  triggerNotificationHaptic('success');
                  Alert.alert(
                    t('restoredTitle'),
                    t('restoredProfileBody', { name: pullRes.profile.name })
                  );
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
      Alert.alert(t('cloudAuthTitle'), e?.message || t('cloudConnectNetworkError'));
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
          t('noAccessTitle'),
          Platform.OS === 'ios'
            ? t('settingsHealthIosPerm')
            : t('settingsHealthAndroidPerm')
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
      Alert.alert(t('missingNameSettingsTitle'), t('enterNameSettingsBody'));
      return;
    }

    const currentSavedNick = activeProfile.nickname || '';
    const nextCleanNick = normalizeNickname(nicknameInput);
    const isNicknameChanging = Boolean(nextCleanNick && nextCleanNick !== currentSavedNick);

    if (nicknameInput.trim() && !isValidNickname(nextCleanNick)) {
      Alert.alert(t('errorTitle'), t('nicknameInvalidError'));
      return;
    }

    const cooldownInfo = getNicknameCooldownInfo(
      activeProfile.nicknameUpdatedAt,
      Boolean(currentSavedNick)
    );
    if (isNicknameChanging && !cooldownInfo.canEdit) {
      Alert.alert(
        t('errorTitle'),
        t('nicknameLockedDays', { days: cooldownInfo.daysRemaining })
      );
      return;
    }

    const parsedHeight = parseFloat(heightInput.replace(',', '.'));
    const parsedWeight = parseFloat(weightInput.replace(',', '.'));
    setIsSavingProfile(true);
    try {
      let claimedNick = currentSavedNick || undefined;
      let claimedAt = activeProfile.nicknameUpdatedAt;

      if (isNicknameChanging && nextCleanNick) {
        const claimRes = await claimNicknameInCloud({
          nickname: nextCleanNick,
          displayName: cleanName,
          enforceCooldown: Boolean(currentSavedNick),
        });
        if (!claimRes.ok) {
          Alert.alert(
            t('errorTitle'),
            claimRes.daysRemaining
              ? t('nicknameLockedDays', { days: claimRes.daysRemaining })
              : claimRes.error || t('nicknameTakenError')
          );
          setIsSavingProfile(false);
          return;
        }
        claimedNick = claimRes.nickname || nextCleanNick;
        claimedAt = claimRes.nicknameUpdatedAt || new Date().toISOString();
      }

      const updated = await updateProfile(activeProfile.id, {
        name: cleanName,
        ...(isNicknameChanging && claimedNick
          ? { nickname: claimedNick, nicknameUpdatedAt: claimedAt }
          : {}),
        gender: genderInput,
        height: !isNaN(parsedHeight) && parsedHeight > 50 ? parsedHeight : undefined,
        weight: !isNaN(parsedWeight) && parsedWeight > 20 ? parsedWeight : undefined,
      });
      await buildAndPublishSocialProfile(updated.id).catch(() => {});
      triggerNotificationHaptic('success');
      onProfileUpdated(updated);
      Alert.alert(t('savedTitle'), t('profileUpdatedBody'));
    } catch (e: any) {
      Alert.alert(t('errorTitle'), e?.message || t('saveProfileError'));
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
      Alert.alert(t('exportErrorTitle'), e?.message || t('exportErrorBody'));
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleImportPlansOnly = async () => {
    if (!importJsonText.trim()) {
      Alert.alert(t('emptyFieldTitle'), t('pasteJsonFirstBody'));
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
        t('plansAddedTitle'),
        t('importedPlansBody', {
          count: res.importedCount,
          unit: res.importedCount === 1 ? t('planWordOne') : t('planWordMany'),
        })
      );
    } catch (e: any) {
      Alert.alert(t('importErrorTitle'), e?.message || t('invalidJsonError'));
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleImportFullBackup = async () => {
    if (!importJsonText.trim()) {
      Alert.alert(t('emptyFieldTitle'), t('pasteBackupJsonFirstBody'));
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
        t('profileRestoredTitle'),
        t('profileRestoredBody', { plans: res.plansCount, prs: res.prsCount })
      );
    } catch (e: any) {
      Alert.alert(t('importErrorTitle'), e?.message || t('invalidJsonError'));
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleManualPullCloud = async () => {
    setIsBusyIO(true);
    try {
      const pullRes = await pullProfileFromCloud();
      if (pullRes.ok && pullRes.profile) {
        await onDataImported();
        await loadMeta();
        triggerNotificationHaptic('success');
        Alert.alert(
          t('restoredTitle'),
          t('restoredProfileBody', { name: pullRes.profile.name })
        );
      } else {
        Alert.alert(t('cloudAuthTitle'), pullRes.error || t('cloudConnectNetworkError'));
      }
    } catch (e: any) {
      Alert.alert(t('cloudAuthTitle'), e?.message || t('cloudConnectNetworkError'));
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleManualPushCloud = async () => {
    setIsBusyIO(true);
    try {
      const pushRes = await pushProfileToCloud(activeProfile.id);
      if (pushRes.ok) {
        await loadMeta();
        triggerNotificationHaptic('success');
        Alert.alert(
          t('cloudSyncManualTitle'),
          t('cloudPushSuccessBody', { name: activeProfile.name })
        );
      } else {
        Alert.alert(t('cloudAuthTitle'), pushRes.error || t('cloudConnectNetworkError'));
      }
    } catch (e: any) {
      Alert.alert(t('cloudAuthTitle'), e?.message || t('cloudConnectNetworkError'));
    } finally {
      setIsBusyIO(false);
    }
  };

  const handleConfirmResetApp = () => {
    Alert.alert(
      t('resetAppTitle'),
      t('resetAppBody'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('resetAllBtn'),
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
  const savedNick = (activeProfile.nickname || '').trim();
  const savedHeight = activeProfile.height ? String(activeProfile.height) : '';
  const savedWeight = activeProfile.weight ? String(activeProfile.weight) : '';
  const nickCooldown = getNicknameCooldownInfo(
    activeProfile.nicknameUpdatedAt,
    Boolean(savedNick)
  );
  const hasProfileChanges =
    nameInput.trim() !== savedName ||
    (nickCooldown.canEdit && normalizeNickname(nicknameInput) !== savedNick) ||
    heightInput.trim() !== savedHeight ||
    weightInput.trim() !== savedWeight ||
    genderInput !== (activeProfile.gender || 'male');

  const settingsSegItems: SegmentedGlassTabItem<SettingsSubTab>[] = SETTINGS_TABS.map((tab) => ({
    key: tab.key,
    label: t(tab.labelKey),
    icon: tab.icon,
    accent: tab.accent,
  }));

  const settingsBackdropColors =
    settingsTab === 'profile'
      ? { top: '#10B981', bottom: '#0EA5E9' }
      : settingsTab === 'training'
      ? { top: '#38BDF8', bottom: '#10B981' }
      : settingsTab === 'system'
      ? { top: '#F59E0B', bottom: '#F43F5E' }
      : { top: '#A855F7', bottom: '#6366F1' };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MinimalistBackdrop
        variant="diagonal"
        showCornerGlows={false}
      />
      {/* Open Editorial Header + Tabbed Glass Switcher */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.hairline,
            paddingTop: Math.max(insets.top + 8, 16),
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{t('settingsTitle')}</Text>
            <Text style={[styles.headerSub, { color: theme.textMuted }]} numberOfLines={1}>
              {savedNick ? `@${savedNick} · ` : ''}
              {t(SETTINGS_TABS.find((tab) => tab.key === settingsTab)?.labelKey || 'settingsTabProfile')}
            </Text>
          </View>
          <LanguageSwitcher variant="pill" />
        </View>

        <SegmentedGlassTabs
          items={settingsSegItems}
          activeKey={settingsTab}
          onChange={(key) => {
            triggerSelectionHaptic();
            switchSettingsTab(key);
          }}
        />
      </View>

      <SmartScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: tabContentFade,
            transform: [{ translateX: tabContentSlide }],
          }}
        >
        {settingsTab === 'profile' && (
          <>
        {/* =========================================================
            CLOUD LINK PROMPT (ONLY VISIBLE WHEN NOT LOGGED IN)
           ========================================================= */}
        {!isCloudLoggedIn && (
          <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                  {t('cloudClerkEyebrow')}
                </Text>
                <Text style={[styles.sectionHeading, { color: theme.text }]}>
                  {t('connectCloudQuestion')}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
              {t('connectCloudSub')}
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
                {t('identityAnatomyUpper')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('athleteProfileHeading')}
              </Text>
            </View>
          </View>

          <View style={[styles.avatarSettingsCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
            <UserAvatarBadge
              avatarUrl={activeProfile.avatarUrl}
              displayName={nameInput.trim() || activeProfile.name}
              avatarColor="#10B981"
              size={54}
              ringColor="#10B981"
            />
            <View style={styles.avatarSettingsInfo}>
              <Text style={[styles.avatarSettingsTitle, { color: theme.textMuted }]}>
                {t('avatarSectionTitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.avatarChangePill, { backgroundColor: `${theme.primary}18`, borderColor: `${theme.primary}45` }]}
              onPress={() => {
                triggerSelectionHaptic();
                setAvatarPickerAllowSkip(false);
                setPendingCloudAvatarUrl(null);
                setShowAvatarPicker(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={14} color={theme.primary} />
              <Text style={[styles.avatarChangeText, { color: theme.primary }]}>
                {t('avatarChangeBtn')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
            {t('silhouetteModelUpper')}
          </Text>
          <View style={styles.providerPillsRow}>
            {(
              [
                { id: 'male', label: t('maleLabel'), icon: 'male-outline' as const },
                { id: 'female', label: t('femaleLabel'), icon: 'female-outline' as const },
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
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('fullNameUpper')}</Text>
            <TextInput
              style={[styles.underlineInput, { color: theme.text }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('fullNamePlaceholder')}
              placeholderTextColor={theme.textMuted}
            />
          </View>

          <View style={[styles.underlineField, { borderBottomColor: theme.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, marginBottom: 0 }]}>
                {t('nicknameUpper')}
              </Text>
              {nickCooldown.canEdit ? (
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    setNicknameInput(generateRandomNickname(nameInput));
                  }}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                  }}
                >
                  <Ionicons name="sparkles" size={11} color="#10B981" />
                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#10B981' }}>
                    {t('autoGenerateBtn')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    triggerSelectionHaptic();
                    if (savedNick) {
                      Share.share({ message: `@${savedNick}` }).catch(() => {});
                    }
                  }}
                  activeOpacity={0.75}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 9,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: theme.bgSecondary,
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={11} color={theme.textMuted} />
                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.textMuted }}>
                    {nickCooldown.daysRemaining} {t('friendsDaysShort')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#10B981' }}>@</Text>
              <TextInput
                style={[
                  styles.underlineInput,
                  {
                    color: nickCooldown.canEdit ? theme.text : theme.textSecondary,
                    flex: 1,
                  },
                ]}
                value={nicknameInput}
                editable={nickCooldown.canEdit}
                onChangeText={(txt) => setNicknameInput(sanitizeNicknameInput(txt))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('nicknamePlaceholder')}
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <Text style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
              {nickCooldown.canEdit
                ? t('nicknameUnlockedInfo')
                : t('nicknameLockedDays', { days: nickCooldown.daysRemaining })}
            </Text>
          </View>

          <View style={styles.twoColRow}>
            <View style={[styles.underlineField, { flex: 1, borderBottomWidth: 0, marginBottom: 0, paddingBottom: 2 }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('heightUpper')}</Text>
              <TextInput
                style={[styles.underlineInput, { color: theme.text }]}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType="number-pad"
                placeholder="180"
                placeholderTextColor={theme.textMuted}
              />
            </View>
            <View style={[styles.underlineField, { flex: 1, borderBottomWidth: 0, marginBottom: 0, paddingBottom: 2 }]}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{t('weightUpper')}</Text>
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
          </>
        )}

        {settingsTab === 'system' && (
          <>
        {/* =========================================================
            APPEARANCE & LANGUAGE QUICK PANEL
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

          <View style={styles.openSwitchLine}>
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
        </View>

        {/* =========================================================
            SECTION 3: HAPTICS & REST TIMER
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                {t('timeAndFeelEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('hapticsAndRestHeading')}
              </Text>
            </View>
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{t('hapticVibrationsTitle')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('hapticsFeedbackRowSub')}
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
            {t('vibrationStrengthUpper')}
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
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline, marginTop: 8 }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{t('tripleBgSignalTitle')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('tripleBgSignalSub')}
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
            {t('defaultRestNewExUpper')}
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
                {t('systemAlertsEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('notificationsRemindersHeading')}
              </Text>
            </View>
            <AnimatedIcon
              name="notifications-outline"
              preset="bell"
              size={18}
              color={settings.restNotificationsEnabled ? '#10B981' : theme.textMuted}
              active={settings.restNotificationsEnabled}
            />
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {t('restAlarmTitle')}
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('restAlarmSub')}
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
                {t('systemAlertsBlocked')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>
                {t('suppRemindersTitle')}
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('suppNotifSub')}
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
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>{t('morningUpper')}</Text>
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
                <Text style={[styles.hourLabel, { color: theme.textMuted }]}>{t('eveningUpper')}</Text>
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
              <Text style={[styles.rowTitle, { color: theme.text }]}>{t('dailyWeightTitle')}</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {t('dailyWeightSub')}
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
              <Text style={[styles.hourLabel, { color: theme.textMuted }]}>{t('weighHourUpper')}</Text>
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
            VOICE ASSISTANTS: APPLE SIRI (APP INTENTS) & AMAZON ALEXA
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                {t('voiceEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('voiceTitle')}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(56, 189, 248, 0.14)' }]}>
              <Ionicons name="mic-outline" size={13} color="#38BDF8" />
              <Text style={[styles.statusBadgeText, { color: '#38BDF8' }]}>Siri · Alexa</Text>
            </View>
          </View>

          <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
            {t('voiceDesc')}
          </Text>

          <View
            style={[
              styles.cloudAccountBar,
              {
                backgroundColor: theme.bgSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
                marginBottom: 12,
                alignItems: 'flex-start',
              },
            ]}
          >
            <Ionicons name="sparkles" size={18} color="#38BDF8" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={[styles.cloudEmailTitle, { color: theme.text }]}>
                {t('voiceSiriTitle')}
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary, marginTop: 0 }]}>
                {t('voiceSiriHint')}
              </Text>
              <Text style={[styles.rowSub, { color: '#10B981', marginTop: 2, fontWeight: '700' }]}>
                {t('voiceSiriPhrases')}
              </Text>
              {Platform.OS === 'ios' && (
                <View style={[styles.cloudActionsRow, { marginTop: 8 }]}>
                  <TouchableOpacity
                    style={[styles.cloudActionSecondary, { backgroundColor: theme.bg, paddingVertical: 10 }]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      Linking.openURL('shortcuts://').catch(() => Linking.openSettings());
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="apps-outline" size={14} color={theme.text} />
                    <Text style={[styles.cloudActionSecondaryText, { color: theme.text, fontSize: 12 }]}>
                      {t('voiceOpenShortcutsBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View
            style={[
              styles.cloudAccountBar,
              {
                backgroundColor: theme.bgSecondary,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.border,
                alignItems: 'flex-start',
              },
            ]}
          >
            <Ionicons name="radio-outline" size={18} color="#F59E0B" style={{ marginTop: 2 }} />
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text style={[styles.cloudEmailTitle, { color: theme.text }]}>
                {t('voiceAlexaTitle')}
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary, marginTop: 0 }]}>
                {t('voiceAlexaHint')}
              </Text>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 6, marginBottom: 2 }]}>
                {t('voiceAlexaEndpointLabel')}
              </Text>
              <Text
                selectable
                style={{ fontSize: 11.5, fontWeight: '800', color: '#F59E0B' }}
              >
                {ALEXA_ENDPOINT_URL}
              </Text>
              <View style={[styles.cloudActionsRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.cloudActionSecondary, { backgroundColor: theme.bg, paddingVertical: 10 }]}
                  onPress={async () => {
                    triggerSelectionHaptic();
                    await Share.share({
                      title: 'Iron Routine Alexa Endpoint',
                      message: ALEXA_ENDPOINT_URL,
                    }).catch(() => {});
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="share-outline" size={14} color={theme.text} />
                  <Text style={[styles.cloudActionSecondaryText, { color: theme.text, fontSize: 12 }]}>
                    {t('voiceCopyEndpointBtn')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cloudActionSecondary, { backgroundColor: theme.bg, paddingVertical: 10 }]}
                  onPress={async () => {
                    triggerSelectionHaptic();
                    const modelJson = JSON.stringify(
                      buildAlexaInteractionModelJson(savedNick || undefined),
                      null,
                      2
                    );
                    await Share.share({
                      title: 'Iron Routine Alexa Skill Model JSON',
                      message: modelJson,
                    }).catch(() => {});
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="code-slash-outline" size={14} color={theme.text} />
                  <Text style={[styles.cloudActionSecondaryText, { color: theme.text, fontSize: 12 }]}>
                    {t('voiceShareSkillBtn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
          </>
        )}

        {settingsTab === 'training' && (
          <>
        {/* =========================================================
            EXERCISE DATABASE & FAVORITES
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                {t('tabPlan').toUpperCase()}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('settingsExerciseDb')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.openActionLine}
            onPress={() => {
              triggerSelectionHaptic();
              setShowExerciseLibrary(true);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.switchLabelWrap}>
              <Text style={[styles.rowSub, { color: theme.textSecondary, marginTop: 0 }]}>
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
        </View>

        {/* =========================================================
            SECTION 5: SUPPLEMENTS & HEALTH INTEGRATION
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#F59E0B' }]}>
                {t('recoveryAndHealthEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('suppsAndHealthHeading', {
                  platform: Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect',
                })}
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
                {showSuppEditor ? t('collapseLabel') : t('dosesLabel')}
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
              <Ionicons
                name="heart"
                size={18}
                color={settings.healthSyncEnabled ? '#EF4444' : theme.text}
              />
              <View style={styles.switchLabelWrap}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {t('syncStepsSleepTitle', {
                    platform: Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect',
                  })}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {t('healthNotifSub')}
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
                    ? t('stepsValue', { steps: healthSummary.steps.toLocaleString(localeCode) })
                    : t('noStepsDash')}
                </Text>
              </View>
              <View style={[styles.healthChip, { backgroundColor: theme.bgSecondary }]}>
                <Ionicons name="moon-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>
                  {healthSummary.sleepHours !== null
                    ? t('sleepHoursValue', { hours: healthSummary.sleepHours })
                    : t('noSleepDash')}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.healthChip, { backgroundColor: theme.bgSecondary }]}
                onPress={handleRefreshHealth}
                disabled={isSyncingHealth}
              >
                <Ionicons name="refresh-outline" size={13} color={theme.text} />
                <Text style={[styles.healthChipText, { color: theme.text }]}>{t('refreshBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* =========================================================
            CALENDAR & REMINDERS (APPLE CALENDAR / GOOGLE CALENDAR)
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                {t('calendarSyncEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {Platform.OS === 'ios' ? 'Apple Calendar & Reminders' : 'Google Calendar & Reminders'}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    settings.calendarSyncEnabled || settings.remindersSyncEnabled
                      ? 'rgba(16, 185, 129, 0.14)'
                      : theme.bgSecondary,
                },
              ]}
            >
              <Ionicons
                name="calendar"
                size={12}
                color={
                  settings.calendarSyncEnabled || settings.remindersSyncEnabled
                    ? '#10B981'
                    : theme.textMuted
                }
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color:
                      settings.calendarSyncEnabled || settings.remindersSyncEnabled
                        ? '#10B981'
                        : theme.textMuted,
                  },
                ]}
              >
                {calendarLabel || (Platform.OS === 'ios' ? 'iCloud' : 'Google')}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
            {Platform.OS === 'ios' ? t('calendarSyncDescIos') : t('calendarSyncDescAndroid')}
          </Text>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={settings.calendarSyncEnabled ? '#10B981' : theme.text}
              />
              <View style={styles.switchLabelWrap}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {t('calendarEnableSwitch')}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {Platform.OS === 'ios' ? 'Apple Calendar' : 'Google / Android Calendar'}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.calendarSyncEnabled}
              disabled={isSyncingCalendar}
              onValueChange={handleToggleCalendarSync}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          <View style={[styles.openSwitchLine, { borderBottomColor: theme.hairline }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons
                name="checkmark-done-circle-outline"
                size={18}
                color={settings.remindersSyncEnabled ? '#38BDF8' : theme.text}
              />
              <View style={styles.switchLabelWrap}>
                <Text style={[styles.rowTitle, { color: theme.text }]}>
                  {t('remindersEnableSwitch')}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {Platform.OS === 'ios' ? 'Apple Reminders' : 'Google / System Reminders'}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.remindersSyncEnabled}
              disabled={isSyncingCalendar}
              onValueChange={handleToggleRemindersSync}
              trackColor={switchTrack}
              thumbColor={switchThumb}
            />
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>
            {t('calendarWorkoutHourLabel')}
          </Text>
          <View style={styles.segmentRow}>
            {[7, 9, 12, 17, 18, 20].map((hr) => {
              const active = settings.preferredWorkoutHour === hr;
              return (
                <TouchableOpacity
                  key={hr}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: active ? theme.text : theme.bgSecondary },
                  ]}
                  onPress={async () => {
                    triggerSelectionHaptic();
                    const next = await updateAppSettings({
                      preferredWorkoutHour: hr,
                      preferredWorkoutMinute: 0,
                    });
                    setSettings(next);
                    if (next.calendarSyncEnabled || next.remindersSyncEnabled) {
                      await runCalendarSync(next, false);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.segmentText, { color: active ? theme.bg : theme.text }]}>
                    {String(hr).padStart(2, '0')}:00
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textMuted, marginTop: 14 }]}>
            {t('calendarDurationLabel')}
          </Text>
          <View style={styles.segmentRow}>
            {[45, 60, 75, 90].map((mins) => {
              const active = settings.workoutDurationMinutes === mins;
              return (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.segmentBtn,
                    { backgroundColor: active ? theme.text : theme.bgSecondary },
                  ]}
                  onPress={async () => {
                    triggerSelectionHaptic();
                    const next = await updateAppSettings({ workoutDurationMinutes: mins });
                    setSettings(next);
                    if (next.calendarSyncEnabled || next.remindersSyncEnabled) {
                      await runCalendarSync(next, false);
                    }
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.segmentText, { color: active ? theme.bg : theme.text }]}>
                    {mins}m
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              styles.cloudActionPrimary,
              { backgroundColor: theme.primary, marginTop: 16, width: '100%' },
            ]}
            disabled={isSyncingCalendar}
            onPress={async () => {
              const target =
                !settings.calendarSyncEnabled && !settings.remindersSyncEnabled
                  ? await (async () => {
                      const perms = await requestCalendarAccess(true);
                      if (!perms.calendarGranted) {
                        Alert.alert(t('errorTitle'), t('calendarPermDeniedError'));
                        return null;
                      }
                      const next = await updateAppSettings({
                        calendarSyncEnabled: true,
                        remindersSyncEnabled: Platform.OS !== 'ios' || perms.remindersGranted,
                      });
                      setSettings(next);
                      return next;
                    })()
                  : settings;
              if (target) {
                await runCalendarSync(target, true);
              }
            }}
            activeOpacity={0.85}
          >
            {isSyncingCalendar ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <>
                <Ionicons name="sync-outline" size={16} color={theme.primaryText} />
                <Text style={[styles.cloudActionPrimaryText, { color: theme.primaryText }]}>
                  {t('calendarSyncNowBtn')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {settings.lastCalendarSyncAt && (
            <Text style={[styles.rowSub, { color: theme.textMuted, textAlign: 'center', marginTop: 8 }]}>
              {t('calendarLastSyncedLabel')}: {new Date(settings.lastCalendarSyncAt).toLocaleString(localeCode)}
            </Text>
          )}
        </View>
          </>
        )}

        {settingsTab === 'data' && (
          <>
        {/* =========================================================
            E2EE CHAT SECURITY FINGERPRINT & BACKUPS
           ========================================================= */}
        <View style={[styles.openSection, { borderBottomColor: theme.hairline }]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: '#10B981' }]}>
                {t('e2eeBadgeLabel').toUpperCase()}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                Curve25519 · E2EE
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
              <Ionicons name="lock-closed" size={12} color="#10B981" />
              <Text style={[styles.statusBadgeText, { color: '#10B981' }]}>AES / NaCl</Text>
            </View>
          </View>

          <Text style={[styles.sectionLead, { color: theme.textSecondary }]}>
            {t('e2eeSecurityHint')}
          </Text>

          <View
            style={{
              backgroundColor: theme.bgSecondary,
              borderRadius: 14,
              padding: 13,
              marginBottom: 16,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
            }}
          >
            <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
              {t('e2eeFingerprintLabel')}
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                fontWeight: '900',
                color: '#10B981',
                letterSpacing: 1,
                fontVariant: ['tabular-nums'],
              }}
            >
              {e2eeFingerprint}
            </Text>
          </View>

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

          {isCloudLoggedIn && (
            <View style={{ marginTop: 18 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                {t('cloudSyncManualTitle')}
              </Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary, marginBottom: 10 }]}>
                {t('cloudSyncManualHint')}
              </Text>
              <View style={styles.ioButtonsRow}>
                <TouchableOpacity
                  style={[styles.cloudActionSecondary, { backgroundColor: theme.bgSecondary }]}
                  onPress={handleManualPullCloud}
                  disabled={isBusyIO}
                  activeOpacity={0.75}
                >
                  <Ionicons name="cloud-download-outline" size={16} color="#38BDF8" />
                  <Text style={[styles.cloudActionSecondaryText, { color: theme.text }]}>
                    {t('restoreFromCloudBtn')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cloudActionSecondary, { backgroundColor: theme.bgSecondary }]}
                  onPress={handleManualPushCloud}
                  disabled={isBusyIO}
                  activeOpacity={0.75}
                >
                  <Ionicons name="cloud-upload-outline" size={16} color="#10B981" />
                  <Text style={[styles.cloudActionSecondaryText, { color: theme.text }]}>
                    {t('cloudPushNowBtn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* =========================================================
            SECTION 7: MAIN CONTRIBUTOR & RESET
           ========================================================= */}
        <View style={styles.openSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                {t('settingsContributorEyebrow')}
              </Text>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>
                {t('settingsContributorHeading')}
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
                {t('githubNote')}
              </Text>
            </View>
            <View style={[styles.smallActionPill, { backgroundColor: theme.bgSecondary }]}>
              <Ionicons name="logo-github" size={14} color={theme.text} />
              <Text style={[styles.smallActionPillText, { color: theme.text }]}>GitHub</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.coffeeBtn,
              {
                backgroundColor: isDark ? '#2B1B14' : '#292524',
                borderWidth: 1,
                borderColor: 'rgba(251, 146, 60, 0.45)',
              },
            ]}
            onPress={() => {
              triggerImpactHaptic('medium');
              Linking.openURL('https://matiqueue-portfolio.vercel.app').catch(() => {});
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="cafe-outline" size={18} color="#FDBA74" />
            <Text style={[styles.coffeeBtnText, { color: '#FFF7ED' }]}>{t('coffeeNote')}</Text>
            <Ionicons name="open-outline" size={15} color="#FDBA74" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetDangerWrap}
            onPress={handleConfirmResetApp}
            activeOpacity={0.75}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
            <Text style={styles.resetDangerText}>{t('resetLocalDanger')}</Text>
          </TouchableOpacity>
        </View>
          </>
        )}
        </Animated.View>
      </SmartScrollView>

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
        title={t('importModalTitle')}
        subtitle={t('importModalSub')}
        initialHeightPercent={0.78}
      >
        <BottomSheetScrollView
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
              {t('addPlansToCurrentBtn')}
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
              {t('restoreFullBackup')}
            </Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </InteractiveBottomSheet>

      <AvatarPickerSheet
        visible={showAvatarPicker}
        displayName={nameInput.trim() || activeProfile.name}
        currentAvatarUrl={activeProfile.avatarUrl ?? null}
        cloudAvatarUrl={cloudSession?.avatarUrl || pendingCloudAvatarUrl || null}
        allowSkip={avatarPickerAllowSkip}
        onSelectAvatar={async (nextUrl) => {
          const updated = await updateProfile(activeProfile.id, { avatarUrl: nextUrl });
          onProfileUpdated(updated);
          void buildAndPublishSocialProfile(updated.id);
          setPendingCloudAvatarUrl(null);
        }}
        onClose={() => {
          setShowAvatarPicker(false);
          setAvatarPickerAllowSkip(false);
          setPendingCloudAvatarUrl(null);
        }}
      />
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
    paddingBottom: 92,
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
  avatarSettingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  avatarSettingsInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  avatarSettingsTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  avatarSettingsHint: {
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
  },
  avatarChangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  avatarChangeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
