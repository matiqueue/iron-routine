import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import {
  PlanTemplateKey,
  SupplementItem,
  UserGender,
  UserProfile,
} from '../types/workout';
import { PLAN_TEMPLATE_OPTIONS } from '../data/exerciseLibrary';
import {
  BODY_OUTLINE_FEMALE_FRONT,
  BODY_OUTLINE_FRONT,
} from '../data/bodySilhouettePaths';
import { DEFAULT_SUPPLEMENTS } from '../data/supplements';
import { createProfile, importProfileBackup } from '../services/storage';
import { updateAppSettings } from '../services/settings';
import { requestHealthPermissions } from '../services/health';
import {
  ensureNotificationPermissions,
  setCreatineReminderEnabled,
} from '../services/notifications';
import {
  pullProfileFromCloud,
  pushProfileToCloud,
  signInWithAppleCloud,
  signInWithGoogleCloud,
} from '../services/cloudSync';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { AnimatedIcon } from './AnimatedIcon';
import { SupplementConfigurator } from './SupplementConfigurator';

interface OnboardingScreenProps {
  onCompleted: (profile: UserProfile) => Promise<void> | void;
}

const TOTAL_STEPS = 5;
const ONBOARDING_REST_PRESETS = [90, 120, 180];

const STEP_META = [
  {
    kicker: '01 / 05 · TOŻSAMOŚĆ I SYLWETKA',
    title: 'Stwórz swój profil',
    subtitle: 'Wybierz model anatomiczny sylwetki oraz wpisz imię i parametry startowe.',
    icon: 'barbell-outline' as const,
    preset: 'barbell' as const,
    accent: '#10B981',
  },
  {
    kicker: '02 / 05 · SUPLEMENTACJA',
    title: 'Dobierz suplementy',
    subtitle: 'Wybierz stosowane suplementy. Dawki przeliczymy automatycznie według masy ciała.',
    icon: 'flame' as const,
    preset: 'flame' as const,
    accent: '#F59E0B',
  },
  {
    kicker: '03 / 05 · ZDROWIE I ALERTY',
    title: 'Regeneracja i budzik przerw',
    subtitle: 'Połącz systemowe Zdrowie oraz włącz alarm końca przerwy działający przy zablokowanym ekranie.',
    icon: 'heart' as const,
    preset: 'heart' as const,
    accent: '#EF4444',
  },
  {
    kicker: '04 / 05 · PLAN STARTOWY',
    title: 'Wybierz bazę treningową',
    subtitle: 'Zacznij od sprawdzonego schematu lub pustego tygodnia gotowego na własną konfigurację.',
    icon: 'trophy' as const,
    preset: 'trophy' as const,
    accent: '#38BDF8',
  },
  {
    kicker: '05 / 05 · KONTO I CHMURA',
    title: 'Zapisz konto w chmurze',
    subtitle: 'Wybierz logowanie iCloud lub Gmail (Clerk), aby automatycznie synchronizować dane w chmurze, albo korzystaj lokalnie.',
    icon: 'cloud-done-outline' as const,
    preset: 'trophy' as const,
    accent: '#10B981',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCompleted }) => {
  const { theme, isDark, toggleTheme } = useAppTheme();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [supplements, setSupplements] = useState<SupplementItem[]>(() =>
    DEFAULT_SUPPLEMENTS.map((s) => ({ ...s }))
  );

  const [healthSyncEnabled, setHealthSyncEnabled] = useState(false);
  const [isConnectingHealth, setIsConnectingHealth] = useState(false);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(120);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [suppReminderEnabled, setSuppReminderEnabled] = useState(false);

  const [templateKey, setTemplateKey] =
    useState<Exclude<PlanTemplateKey, 'clone_current'>>('fbw3');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Cloud Sign-in state on Final Step (Step 5)
  const [busyProvider, setBusyProvider] = useState<'apple' | 'google' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollRef = useRef<any>(null);
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(1)).current;
  const genderFlip = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step + 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  const handleSelectGender = (nextGender: UserGender) => {
    if (nextGender === gender) return;
    triggerSelectionHaptic();
    genderFlip.setValue(0.2);
    setGender(nextGender);
    Animated.spring(genderFlip, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  };

  const parsedWeight = (() => {
    const num = parseFloat(weightText.replace(',', '.'));
    return !isNaN(num) && num > 0 ? num : undefined;
  })();

  const parsedHeight = (() => {
    const num = parseFloat(heightText.replace(',', '.'));
    return !isNaN(num) && num > 0 ? num : undefined;
  })();

  const animateToStep = (nextStep: number) => {
    const dir = nextStep > step ? 1 : -1;
    triggerSelectionHaptic();

    Animated.timing(stepFade, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      stepSlide.setValue(dir * 28);
      heroScale.setValue(0.94);
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      Animated.parallel([
        Animated.timing(stepFade, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(stepSlide, {
          toValue: 0,
          tension: 75,
          friction: 11,
          useNativeDriver: true,
        }),
        Animated.spring(heroScale, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleNextStep = () => {
    if (step === 0 && !name.trim()) {
      triggerNotificationHaptic('warning');
      Alert.alert('Podaj imię', 'Wpisz swoje imię lub pseudonim, aby utworzyć profil.');
      return;
    }
    if (step < TOTAL_STEPS - 1) {
      animateToStep(step + 1);
    }
  };

  const handlePrevStep = () => {
    if (step > 0) {
      animateToStep(step - 1);
    }
  };

  const applyOnboardingSettings = async () => {
    await ensureNotificationPermissions(true);

    if (suppReminderEnabled) {
      await setCreatineReminderEnabled(true);
    }

    await updateAppSettings({
      defaultRestSeconds,
      hapticsEnabled,
      restEndMultiBuzz: hapticsEnabled,
      restNotificationsEnabled: hapticsEnabled,
      creatineRemindersEnabled: suppReminderEnabled,
      healthSyncEnabled,
      supplements,
    });
  };

  const handleFinishWithCloud = async (provider: 'apple' | 'google') => {
    if (busyProvider || isSubmitting) return;
    triggerSelectionHaptic();
    setBusyProvider(provider);
    try {
      const authRes =
        provider === 'apple'
          ? await signInWithAppleCloud(name.trim() || undefined)
          : await signInWithGoogleCloud(name.trim() || undefined);

      if (!authRes.ok || !authRes.session) {
        Alert.alert(
          'Logowanie w chmurze',
          authRes.error || 'Nie udało się połączyć z kontem w chmurze.'
        );
        return;
      }

      const session = authRes.session;

      const createAndUploadProfile = async () => {
        setIsSubmitting(true);
        try {
          await applyOnboardingSettings();
          const profile = await createProfile(
            name.trim() || session.displayName || 'Sportowiec',
            {
              gender,
              weight: parsedWeight,
              height: parsedHeight,
              templateKey,
              cloudUserId: session.userId,
              cloudProvider: session.provider,
              cloudEmail: session.email,
            }
          );
          await pushProfileToCloud(profile.id).catch(() => {});
          triggerNotificationHaptic('success');
          await onCompleted(profile);
        } finally {
          setIsSubmitting(false);
        }
      };

      if (!authRes.isNewAccount && session.backupSummary) {
        Alert.alert(
          'Znaleziono konto w chmurze',
          `Wykryto zapisany profil "${session.backupSummary.profileName}" (${session.backupSummary.plansCount} planów, ${session.backupSummary.prsCount} rekordów PR). Czy przywrócić zapisane dane na ten telefon?`,
          [
            {
              text: 'Użyj nowej konfiguracji',
              onPress: () => {
                createAndUploadProfile();
              },
            },
            {
              text: 'Przywróć konto',
              onPress: async () => {
                try {
                  setIsSubmitting(true);
                  const restored = await pullProfileFromCloud();
                  if (restored.ok && restored.profile) {
                    triggerNotificationHaptic('success');
                    await onCompleted(restored.profile);
                  } else {
                    Alert.alert(
                      'Błąd przywracania',
                      restored.error || 'Nie znaleziono pełnej kopii w chmurze.'
                    );
                  }
                } catch (err: any) {
                  Alert.alert(
                    'Błąd przywracania',
                    err?.message || 'Nie udało się pobrać kopii.'
                  );
                } finally {
                  setIsSubmitting(false);
                }
              },
            },
          ]
        );
      } else {
        await createAndUploadProfile();
      }
    } catch (e: any) {
      Alert.alert('Logowanie w chmurze', e?.message || 'Nie udało się połączyć z chmurą.');
    } finally {
      setBusyProvider(null);
    }
  };

  const handleFinishSetupLocal = async () => {
    if (isSubmitting || busyProvider) return;
    const trimmed = name.trim() || 'Sportowiec';

    setIsSubmitting(true);
    try {
      await applyOnboardingSettings();
      triggerNotificationHaptic('success');
      const profile = await createProfile(trimmed, {
        gender,
        weight: parsedWeight,
        height: parsedHeight,
        templateKey,
      });
      await onCompleted(profile);
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Nie udało się skonfigurować konta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnectHealth = async () => {
    if (isConnectingHealth) return;
    triggerSelectionHaptic();
    if (healthSyncEnabled) {
      setHealthSyncEnabled(false);
      return;
    }

    setIsConnectingHealth(true);
    try {
      const granted = await requestHealthPermissions();
      if (granted) {
        setHealthSyncEnabled(true);
        triggerNotificationHaptic('success');
      } else {
        Alert.alert(
          'Brak dostępu',
          Platform.OS === 'ios'
            ? 'Możesz włączyć uprawnienia Apple Health później w Ustawieniach lub w aplikacji Zdrowie.'
            : 'Możesz włączyć uprawnienia Health Connect później w Ustawieniach.'
        );
      }
    } finally {
      setIsConnectingHealth(false);
    }
  };

  const handleToggleAlarmAndHaptics = async () => {
    triggerSelectionHaptic();
    const next = !hapticsEnabled;
    setHapticsEnabled(next);
    if (next) {
      await ensureNotificationPermissions(true);
    }
  };

  const handleImportJson = async () => {
    if (isSubmitting) return;
    if (!importText.trim()) {
      Alert.alert('Brak danych', 'Wklej najpierw JSON kopii zapasowej lub planu.');
      return;
    }

    setIsSubmitting(true);
    try {
      await ensureNotificationPermissions(true);
      const result = await importProfileBackup(importText, 'create_new');
      triggerNotificationHaptic('success');
      await onCompleted(result.profile);
    } catch (e: any) {
      Alert.alert('Błąd importu', e?.message || 'Nieprawidłowy format JSON.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const meta = STEP_META[step];
  const progressWidth = progressAnim.interpolate({
    inputRange: [1, TOTAL_STEPS],
    outputRange: ['20%', '100%'],
  });

  const enabledSuppCount = supplements.filter((s) => s.enabled).length;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Open Editorial Header */}
      <View style={[styles.headerShell, { borderBottomColor: theme.hairline }]}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            {step > 0 ? (
              <TouchableOpacity
                style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={handlePrevStep}
                activeOpacity={0.75}
                accessibilityLabel="Wstecz"
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}>
                <AnimatedIcon name="barbell-outline" preset="barbell" size={18} color={theme.text} active />
              </View>
            )}

            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <Text style={[styles.brandTitle, { color: theme.text }]} numberOfLines={1}>
                IRON ROUTINE
              </Text>
              <Text style={[styles.brandSub, { color: meta.accent }]} numberOfLines={1}>
                {meta.kicker}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
            onPress={() => {
              triggerSelectionHaptic();
              toggleTheme();
            }}
            activeOpacity={0.75}
            accessibilityLabel="Przełącz motyw"
          >
            <Ionicons
              name={isDark ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={theme.text}
            />
          </TouchableOpacity>
        </View>

        {/* Smooth Step Progress Track */}
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: theme.bgSecondary }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: meta.accent, width: progressWidth },
              ]}
            />
          </View>
          <Text style={[styles.stepFractionText, { color: theme.textMuted }]}>
            0{step + 1} / 0{TOTAL_STEPS}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: stepFade,
            transform: [{ translateX: stepSlide }],
          }}
        >
          {/* Open Editorial Hero Block */}
          <Animated.View style={[styles.heroBlock, { transform: [{ scale: heroScale }] }]}>
            <Text style={[styles.heroHeadline, { color: theme.text }]}>{meta.title}</Text>
            <Text style={[styles.heroCopy, { color: theme.textSecondary }]}>{meta.subtitle}</Text>
          </Animated.View>

          {/* =========================================================
              STEP 1: IDENTITY, GENDER SILHOUETTE & CLOUD RESTORE
             ========================================================= */}
          {step === 0 && (
            <View style={styles.openStepFlow}>
              {/* Open Gender & Anatomical Model Picker */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                  MODEL ANATOMICZNY SYLWETKI
                </Text>

                <View style={styles.genderShowcaseRow}>
                  <View style={styles.genderPillsCol}>
                    {(
                      [
                        {
                          id: 'male',
                          label: 'Mężczyzna',
                          sub: 'Sylwetka męska w zakładce Osiągi',
                          icon: 'male-outline' as const,
                        },
                        {
                          id: 'female',
                          label: 'Kobieta',
                          sub: 'Sylwetka kobieca w zakładce Osiągi',
                          icon: 'female-outline' as const,
                        },
                      ] as const
                    ).map((g) => {
                      const active = gender === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[
                            styles.genderOptionRow,
                            {
                              backgroundColor: active ? theme.text : theme.bgSecondary,
                            },
                          ]}
                          onPress={() => handleSelectGender(g.id)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={g.icon}
                            size={18}
                            color={active ? theme.bg : theme.textSecondary}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.genderOptionTitle,
                                { color: active ? theme.bg : theme.text },
                              ]}
                            >
                              {g.label}
                            </Text>
                            <Text
                              style={[
                                styles.genderOptionSub,
                                {
                                  color: active ? theme.bg : theme.textMuted,
                                  opacity: active ? 0.8 : 1,
                                },
                              ]}
                            >
                              {g.sub}
                            </Text>
                          </View>
                          {active && (
                            <Ionicons name="checkmark-circle" size={18} color={theme.bg} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Live Animated Silhouette Preview */}
                  <Animated.View
                    style={[
                      styles.silhouetteMiniPreview,
                      {
                        transform: [{ scaleX: genderFlip }],
                      },
                    ]}
                  >
                    <Svg
                      width={78}
                      height={145}
                      viewBox={
                        gender === 'female'
                          ? '-50.5 15 740 1445'
                          : '-11.2 80 724 1320'
                      }
                    >
                      <Path
                        d={
                          gender === 'female'
                            ? BODY_OUTLINE_FEMALE_FRONT
                            : BODY_OUTLINE_FRONT
                        }
                        fill={isDark ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.08)'}
                        stroke="#10B981"
                        strokeWidth={14}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Animated.View>
                </View>
              </View>

              {/* Open Name & Body Metrics Fields */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                  TWOJE PARAMETRY
                </Text>

                <View style={[styles.underlineInputGroup, { borderBottomColor: theme.hairline }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                    Imię lub pseudonim
                  </Text>
                  <TextInput
                    style={[styles.openBigInput, { color: theme.text }]}
                    placeholder="np. Szymon, Kasia..."
                    placeholderTextColor={theme.textMuted}
                    value={name}
                    onChangeText={setName}
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.twoColsOpen}>
                  <View
                    style={[
                      styles.underlineInputGroup,
                      { flex: 1, borderBottomColor: theme.hairline },
                    ]}
                  >
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                      Masa ciała (kg)
                    </Text>
                    <TextInput
                      style={[styles.openBigInput, { color: theme.text }]}
                      placeholder="np. 76.5"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="decimal-pad"
                      value={weightText}
                      onChangeText={setWeightText}
                    />
                  </View>

                  <View
                    style={[
                      styles.underlineInputGroup,
                      { flex: 1, borderBottomColor: theme.hairline },
                    ]}
                  >
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                      Wzrost (cm)
                    </Text>
                    <TextInput
                      style={[styles.openBigInput, { color: theme.text }]}
                      placeholder="np. 178"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      value={heightText}
                      onChangeText={setHeightText}
                    />
                  </View>
                </View>
              </View>

              {/* JSON Manual Import Option */}
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <TouchableOpacity
                  style={styles.openExpandHeader}
                  onPress={() => {
                    triggerSelectionHaptic();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setShowImport((v) => !v);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="code-slash-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.expandTitle, { color: theme.textSecondary }]}>
                      Importuj ręcznie z pliku JSON
                    </Text>
                  </View>
                  <Ionicons
                    name={showImport ? 'chevron-up' : 'chevron-forward'}
                    size={16}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>

                {showImport && (
                  <View style={styles.cloudPanelBody}>
                    <TextInput
                      style={[
                        styles.importTextArea,
                        { backgroundColor: theme.bgSecondary, color: theme.text },
                      ]}
                      placeholder='{"app":"iron-routine",...}'
                      placeholderTextColor={theme.textMuted}
                      value={importText}
                      onChangeText={setImportText}
                      multiline
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                      onPress={handleImportJson}
                      disabled={isSubmitting}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="download-outline" size={18} color={theme.primaryText} />
                      <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                        Zaimportuj profil i plany
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* =========================================================
              STEP 2: SUPPLEMENTATION (OPEN FLOW)
             ========================================================= */}
          {step === 1 && (
            <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
              <View style={styles.stepHeaderInline}>
                <Text style={[styles.sectionEyebrow, { color: '#F59E0B', marginBottom: 0 }]}>
                  WYBRANE SUPLEMENTY ({enabledSuppCount})
                </Text>
                {parsedWeight ? (
                  <Text style={[styles.weightInlineText, { color: theme.textSecondary }]}>
                    Przelicznik wg {parsedWeight} kg m.c.
                  </Text>
                ) : null}
              </View>

              <SupplementConfigurator
                supplements={supplements}
                weightKg={parsedWeight}
                onChange={setSupplements}
                compact
              />
            </View>
          )}

          {/* =========================================================
              STEP 3: HEALTH INTEGRATION & REST TIMER ALERTS (OPEN FLOW)
             ========================================================= */}
          {step === 2 && (
            <View style={styles.openStepFlow}>
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: '#EF4444' }]}>
                  SYSTEMOWE ZDROWIE
                </Text>

                <TouchableOpacity
                  style={styles.openInteractiveRow}
                  onPress={handleConnectHealth}
                  disabled={isConnectingHealth}
                  activeOpacity={0.75}
                >
                  <View style={styles.healthIconWrap}>
                    <AnimatedIcon name="heart" preset="heart" size={20} color="#EF4444" active />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      {Platform.OS === 'ios' ? 'Apple Health (Zdrowie)' : 'Health Connect'}
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Automatyczny odczyt kroków, snu i aktywnych kalorii
                    </Text>
                  </View>

                  {isConnectingHealth ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: healthSyncEnabled ? '#10B981' : theme.bgSecondary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: healthSyncEnabled ? '#FFFFFF' : theme.text },
                        ]}
                      >
                        {healthSyncEnabled ? 'Aktywne' : 'Połącz'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
                  DOMYŚLNY CZAS PRZERWY MIĘDZY SERIAMI
                </Text>

                <View style={styles.restPresetsRow}>
                  {ONBOARDING_REST_PRESETS.map((secs) => {
                    const active = defaultRestSeconds === secs;
                    return (
                      <TouchableOpacity
                        key={secs}
                        style={[
                          styles.prefPill,
                          {
                            backgroundColor: active ? theme.text : theme.bgSecondary,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          setDefaultRestSeconds(secs);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.prefPillText,
                            { color: active ? theme.bg : theme.text },
                          ]}
                        >
                          {secs} sekund
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    styles.openToggleLine,
                    { borderTopColor: theme.hairline, borderBottomColor: theme.hairline },
                  ]}
                  onPress={handleToggleAlarmAndHaptics}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Budzik i wibracje końca przerwy
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Wielokrotny sygnał dźwiękowy na ekranie blokady przy wyłączonej aplikacji
                    </Text>
                  </View>
                  <Ionicons
                    name={hapticsEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={hapticsEnabled ? '#10B981' : theme.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.openToggleLine, { borderBottomColor: theme.hairline }]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setSuppReminderEnabled((v) => !v);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Codzienne przypomnienie o suplementach
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Wieczorne powiadomienie z listą Twoich dawek
                    </Text>
                  </View>
                  <Ionicons
                    name={suppReminderEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={suppReminderEnabled ? '#10B981' : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* =========================================================
              STEP 4: STARTER PLAN SELECTION (OPEN EDITORIAL LIST)
             ========================================================= */}
          {step === 3 && (
            <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionEyebrow, { color: '#38BDF8' }]}>
                SCHEMAT TRENINGOWY NA START
              </Text>

              {PLAN_TEMPLATE_OPTIONS.map((tpl) => {
                const selected = templateKey === tpl.id;
                return (
                  <TouchableOpacity
                    key={tpl.id}
                    style={[
                      styles.openTemplateRow,
                      {
                        borderBottomColor: theme.hairline,
                        borderLeftColor: selected ? '#38BDF8' : 'transparent',
                        borderLeftWidth: selected ? 3 : 0,
                        paddingLeft: selected ? 14 : 0,
                      },
                    ]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      setTemplateKey(tpl.id as Exclude<PlanTemplateKey, 'clone_current'>);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.templateTitle, { color: theme.text }]}>
                        {tpl.label}
                      </Text>
                      <Text style={[styles.templateSub, { color: '#38BDF8' }]}>
                        {tpl.subtitle}
                      </Text>
                      <Text style={[styles.templateDesc, { color: theme.textSecondary }]}>
                        {tpl.summary}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? '#38BDF8' : theme.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {/* =========================================================
              STEP 5: ACCOUNT & CLOUD LOGIN (FINAL CONFIGURATOR PAGE)
             ========================================================= */}
          {step === 4 && (
            <View style={styles.openStepFlow}>
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: '#10B981' }]}>
                  BEZPIECZNY ZAPIS W CHMURZE (CLERK + NOSQL)
                </Text>

                <Text style={[styles.cloudFinalLead, { color: theme.textSecondary }]}>
                  Połącz swoje konto Apple iCloud lub Gmail przez Clerk, aby automatycznie zapisywać plany, serię treningów oraz rekordy 1RM i łatwo przenieść profil na kolejny telefon.
                </Text>

                <View style={styles.cloudChoiceList}>
                  <TouchableOpacity
                    style={[
                      styles.cloudChoiceBtn,
                      {
                        backgroundColor: theme.text,
                        opacity: busyProvider && busyProvider !== 'apple' ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => handleFinishWithCloud('apple')}
                    disabled={Boolean(busyProvider) || isSubmitting}
                    activeOpacity={0.85}
                  >
                    {busyProvider === 'apple' ? (
                      <ActivityIndicator size="small" color={theme.bg} />
                    ) : (
                      <>
                        <Ionicons name="logo-apple" size={20} color={theme.bg} />
                        <Text style={[styles.cloudChoiceText, { color: theme.bg }]}>
                          Kontynuuj z iCloud
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.cloudChoiceBtn,
                      {
                        backgroundColor: theme.bgSecondary,
                        borderWidth: 1,
                        borderColor: theme.border,
                        opacity: busyProvider && busyProvider !== 'google' ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => handleFinishWithCloud('google')}
                    disabled={Boolean(busyProvider) || isSubmitting}
                    activeOpacity={0.85}
                  >
                    {busyProvider === 'google' ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <>
                        <Ionicons name="logo-google" size={18} color={theme.text} />
                        <Text style={[styles.cloudChoiceText, { color: theme.text }]}>
                          Kontynuuj z Gmail / Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={[styles.orDividerRow]}>
                    <View style={[styles.orDividerLine, { backgroundColor: theme.hairline }]} />
                    <Text style={[styles.orDividerText, { color: theme.textMuted }]}>LUB</Text>
                    <View style={[styles.orDividerLine, { backgroundColor: theme.hairline }]} />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.localOnlyBtn,
                      {
                        borderColor: theme.border,
                        opacity: isSubmitting ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleFinishSetupLocal}
                    disabled={Boolean(busyProvider) || isSubmitting}
                    activeOpacity={0.78}
                  >
                    {isSubmitting && !busyProvider ? (
                      <ActivityIndicator size="small" color={theme.text} />
                    ) : (
                      <>
                        <Ionicons name="phone-portrait-outline" size={17} color={theme.textSecondary} />
                        <Text style={[styles.localOnlyBtnText, { color: theme.textSecondary }]}>
                          Używaj lokalnie bez konta
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.cloudDisclaimerText, { color: theme.textMuted }]}>
                  Dane w chmurze służą wyłącznie do wygodnego przechowywania kopii zapasowej Twojego konta. Możesz połączyć konto także później w Ustawieniach.
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Open Minimalist Footer */}
      {step < TOTAL_STEPS - 1 && (
        <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.hairline }]}>
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleNextStep}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                Kontynuuj ({step + 1}/{TOTAL_STEPS})
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerShell: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  stepFractionText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  heroBlock: {
    marginBottom: 18,
  },
  heroHeadline: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 35,
    marginBottom: 6,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  openStepFlow: {
    gap: 4,
  },
  openSection: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  genderShowcaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  genderPillsCol: {
    flex: 1,
    gap: 8,
  },
  genderOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  genderOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  genderOptionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  silhouetteMiniPreview: {
    width: 86,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  underlineInputGroup: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  openBigInput: {
    fontSize: 20,
    fontWeight: '800',
    paddingVertical: 4,
  },
  twoColsOpen: {
    flexDirection: 'row',
    gap: 18,
  },
  openExpandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 4,
  },
  expandTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  expandSub: {
    fontSize: 12,
    marginTop: 2,
  },
  cloudPanelBody: {
    marginTop: 14,
    gap: 10,
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  providerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 999,
  },
  providerBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  cloudInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  cloudSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 999,
  },
  cloudSubmitText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '900',
  },
  cloudFinalLead: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  cloudChoiceList: {
    gap: 10,
  },
  cloudChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 999,
  },
  cloudChoiceText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  orDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orDividerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  localOnlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  localOnlyBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cloudDisclaimerText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 18,
  },
  stepHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weightInlineText: {
    fontSize: 12,
    fontWeight: '700',
  },
  openInteractiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  healthIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  restPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  prefPill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  openToggleLine: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  openTemplateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  templateSub: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  templateDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  importTextArea: {
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    fontSize: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerActions: {
    gap: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '900',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
