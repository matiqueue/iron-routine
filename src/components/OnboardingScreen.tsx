import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { PLAN_MODE_LOCALE } from '../i18n/translations';
import {
  DayPlan,
  Exercise,
  PlanTemplateKey,
  SupplementItem,
  UserGender,
  UserProfile,
} from '../types/workout';
import {
  buildPlanDaysFromTemplate,
  cloneExercise,
  EXERCISE_LIBRARY,
  getAlternativeExercisesFor,
  PLAN_TEMPLATE_OPTIONS,
  resolveCanonicalExerciseId,
} from '../data/exerciseLibrary';
import { resolveExerciseMuscles } from '../data/muscleMap';
import {
  BODY_OUTLINE_FEMALE_FRONT,
  BODY_OUTLINE_FRONT,
} from '../data/bodySilhouettePaths';
import { DEFAULT_SUPPLEMENTS } from '../data/supplements';
import {
  createProfile,
  getFavoriteExerciseIds,
  importProfileBackup,
  toggleFavoriteExercise,
} from '../services/storage';
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
import { LanguageSwitcher } from './LanguageSwitcher';

interface OnboardingScreenProps {
  onCompleted: (profile: UserProfile) => Promise<void> | void;
}

const TOTAL_STEPS = 6;
const ONBOARDING_REST_PRESETS = [90, 120, 180];
const WEEK_DAY_IDS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const PLAN_VISUAL_META: Record<
  Exclude<PlanTemplateKey, 'clone_current'>,
  {
    accent: string;
    duration: string;
    dayCodes: string[];
  }
> = {
  fbw3: {
    accent: '#10B981',
    duration: '~55 min',
    dayCodes: ['T', '·', 'T', '·', 'T', '·', '·'],
  },
  upper_lower: {
    accent: '#38BDF8',
    duration: '~60 min',
    dayCodes: ['G', 'D', '·', 'G', 'D', '·', '·'],
  },
  ppl: {
    accent: '#A855F7',
    duration: '~65 min',
    dayCodes: ['P', 'P', 'L', 'P', 'P', 'L', '·'],
  },
  split4: {
    accent: '#EC4899',
    duration: '~60 min',
    dayCodes: ['K', 'P', '·', 'N', 'B', '·', '·'],
  },
  blank: {
    accent: '#F59E0B',
    duration: 'Own',
    dayCodes: ['+', '+', '+', '+', '+', '+', '+'],
  },
};

const STEP_ACCENTS = ['#10B981', '#F59E0B', '#EF4444', '#38BDF8', '#A855F7', '#10B981'];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCompleted }) => {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const { language, t, muscleLabel, equipmentLabel, dayLabel } = useLanguage();

  const [showWelcomeIntro, setShowWelcomeIntro] = useState(true);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<UserGender>('male');
  const [weightText, setWeightText] = useState('');
  const [heightText, setHeightText] = useState('');
  const [focusedField, setFocusedField] = useState<'name' | 'weight' | 'height' | null>(null);
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
  const [customDays, setCustomDays] = useState<DayPlan[]>(() =>
    buildPlanDaysFromTemplate('fbw3')
  );
  const [selectedPreviewDayId, setSelectedPreviewDayId] = useState<string>('mon');
  const [swapTarget, setSwapTarget] = useState<{
    dayId: string;
    exIndex: number | null; // null = add new exercise to day
    currentExercise: Exercise | null;
  } | null>(null);
  const [swapSearch, setSwapSearch] = useState('');
  const [showAllInSwap, setShowAllInSwap] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  // Cloud Sign-in state on Final Step (Step 6)
  const [busyProvider, setBusyProvider] = useState<'apple' | 'google' | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getFavoriteExerciseIds().then(setFavoriteIds).catch(() => {});
  }, []);

  const handleSelectTrainingMode = (nextKey: Exclude<PlanTemplateKey, 'clone_current'>) => {
    triggerSelectionHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTemplateKey(nextKey);
    const nextDays = buildPlanDaysFromTemplate(nextKey);
    setCustomDays(nextDays);
    const firstWorkout = nextDays.find((d) => d.type === 'workout') || nextDays[0];
    if (firstWorkout) setSelectedPreviewDayId(firstWorkout.id);
  };

  const handleToggleSwapFavorite = async (ex: Exercise) => {
    const next = await toggleFavoriteExercise(ex);
    setFavoriteIds(next);
  };

  const handleConfirmSwapOrAdd = (picked: Exercise) => {
    if (!swapTarget) return;
    triggerSelectionHaptic();
    const cloned = cloneExercise(picked);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCustomDays((prev) =>
      prev.map((d) => {
        if (d.id !== swapTarget.dayId) return d;
        const list = [...(d.exercises || [])];
        if (swapTarget.exIndex !== null && swapTarget.exIndex >= 0 && swapTarget.exIndex < list.length) {
          list[swapTarget.exIndex] = cloned;
        } else {
          list.push(cloned);
        }
        return {
          ...d,
          type: 'workout',
          exercises: list,
        };
      })
    );
    setSwapTarget(null);
    setSwapSearch('');
    setShowAllInSwap(false);
  };

  const handleRemoveProposedExercise = (dayId: string, exIndex: number) => {
    triggerSelectionHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCustomDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const nextList = (d.exercises || []).filter((_, i) => i !== exIndex);
        return { ...d, exercises: nextList };
      })
    );
  };

  const scrollRef = useRef<any>(null);
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(1)).current;
  const genderFlip = useRef(new Animated.Value(1)).current;

  // Welcome Intro Stagger & Ring Animations
  const welcomeBgOpacity = useRef(new Animated.Value(0)).current;
  const welcomeCrestScale = useRef(new Animated.Value(0.72)).current;
  const welcomeRingSpin = useRef(new Animated.Value(0)).current;
  const welcomeTitleSlide = useRef(new Animated.Value(22)).current;
  const welcomeTitleOpacity = useRef(new Animated.Value(0)).current;
  const welcomeCardsSlide = useRef(new Animated.Value(28)).current;
  const welcomeCardsOpacity = useRef(new Animated.Value(0)).current;
  const welcomeCtaOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showWelcomeIntro) return;
    const loopSpin = Animated.loop(
      Animated.timing(welcomeRingSpin, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopSpin.start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(welcomeBgOpacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.spring(welcomeCrestScale, {
          toValue: 1,
          friction: 7,
          tension: 65,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(welcomeTitleOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(welcomeTitleSlide, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(welcomeCardsOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(welcomeCardsSlide, {
          toValue: 0,
          friction: 9,
          tension: 68,
          useNativeDriver: true,
        }),
        Animated.timing(welcomeCtaOpacity, {
          toValue: 1,
          duration: 340,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => loopSpin.stop();
  }, [
    showWelcomeIntro,
    welcomeBgOpacity,
    welcomeCrestScale,
    welcomeRingSpin,
    welcomeTitleSlide,
    welcomeTitleOpacity,
    welcomeCardsSlide,
    welcomeCardsOpacity,
    welcomeCtaOpacity,
  ]);

  const handleStartConfigurator = () => {
    triggerSelectionHaptic();
    Animated.timing(welcomeBgOpacity, {
      toValue: 0,
      duration: 210,
      useNativeDriver: true,
    }).start(() => {
      setShowWelcomeIntro(false);
      stepFade.setValue(0);
      stepSlide.setValue(24);
      Animated.parallel([
        Animated.timing(stepFade, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(stepSlide, {
          toValue: 0,
          friction: 10,
          tension: 75,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

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
              customDays,
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
        customDays,
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

  const localizedSteps = [
    {
      kicker: t('step1Kicker'),
      title: t('step1Title'),
      subtitle: t('step1Subtitle'),
      accent: STEP_ACCENTS[0],
    },
    {
      kicker: t('step2Kicker'),
      title: t('step2Title'),
      subtitle: t('step2Subtitle'),
      accent: STEP_ACCENTS[1],
    },
    {
      kicker: t('step3Kicker'),
      title: t('step3Title'),
      subtitle: t('step3Subtitle'),
      accent: STEP_ACCENTS[2],
    },
    {
      kicker: t('step4Kicker'),
      title: t('step4Title'),
      subtitle: t('step4Subtitle'),
      accent: STEP_ACCENTS[3],
    },
    {
      kicker: t('step5Kicker'),
      title: t('step5Title'),
      subtitle: t('step5Subtitle'),
      accent: STEP_ACCENTS[4],
    },
    {
      kicker: t('step6Kicker'),
      title: t('step6Title'),
      subtitle: t('step6Subtitle'),
      accent: STEP_ACCENTS[5],
    },
  ];
  const meta = localizedSteps[step] || localizedSteps[0];
  const enabledSuppCount = supplements.filter((s) => s.enabled).length;
  const selectedPlanMeta = PLAN_VISUAL_META[templateKey] || PLAN_VISUAL_META.fbw3;
  const modeStrings = PLAN_MODE_LOCALE[language] || PLAN_MODE_LOCALE.pl;
  const selectedModeCopy = modeStrings[templateKey] || modeStrings.fbw3;
  const welcomeSpinDeg = welcomeRingSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (showWelcomeIntro) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Subtle technical grid backdrop */}
        <Svg
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <Pattern id="welcomeGrid" width={42} height={48} patternUnits="userSpaceOnUse">
              <Path
                d="M 42 0 L 0 0 0 48"
                fill="none"
                stroke={isDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(24, 24, 27, 0.055)'}
                strokeWidth={1}
              />
            </Pattern>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#welcomeGrid)" />
        </Svg>

        <Animated.View style={[styles.welcomeWrap, { opacity: welcomeBgOpacity }]}>
          <View style={styles.welcomeTopBar}>
            <View
              style={[
                styles.welcomePillTag,
                {
                  backgroundColor: isDark
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(16, 185, 129, 0.10)',
                  borderColor: 'rgba(16, 185, 129, 0.35)',
                },
              ]}
            >
              <View style={styles.welcomeLiveDot} />
              <Text style={styles.welcomePillText}>IRON ROUTINE</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LanguageSwitcher variant="pill" />

              <TouchableOpacity
                style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
                onPress={() => {
                  triggerSelectionHaptic();
                  toggleTheme();
                }}
                activeOpacity={0.75}
                accessibilityLabel="Toggle theme"
              >
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.welcomeCenter}>
            <Animated.View
              style={[
                styles.welcomeCrestStage,
                { transform: [{ scale: welcomeCrestScale }] },
              ]}
            >
              <Animated.View
                style={[
                  styles.welcomeOrbitRing,
                  {
                    borderColor: isDark
                      ? 'rgba(16, 185, 129, 0.32)'
                      : 'rgba(16, 185, 129, 0.38)',
                    transform: [{ rotate: welcomeSpinDeg }],
                  },
                ]}
              >
                <View style={styles.welcomeOrbitDotTop} />
                <View style={styles.welcomeOrbitDotBottom} />
              </Animated.View>

              <View
                style={[
                  styles.welcomeCoreOrb,
                  {
                    backgroundColor: isDark
                      ? 'rgba(24, 24, 27, 0.92)'
                      : 'rgba(255, 255, 255, 0.94)',
                    borderColor: isDark
                      ? 'rgba(255, 255, 255, 0.14)'
                      : 'rgba(24, 24, 27, 0.12)',
                  },
                ]}
              >
                <Svg width={44} height={44} viewBox="0 0 44 44">
                  <Circle
                    cx={22}
                    cy={22}
                    r={17}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={2.2}
                    strokeDasharray="6 4"
                  />
                  <Circle
                    cx={22}
                    cy={22}
                    r={9}
                    fill="none"
                    stroke={theme.text}
                    strokeWidth={2.4}
                  />
                  <Circle cx={22} cy={22} r={2.5} fill="#38BDF8" />
                </Svg>
              </View>
            </Animated.View>

            <Animated.View
              style={{
                opacity: welcomeTitleOpacity,
                transform: [{ translateY: welcomeTitleSlide }],
                alignItems: 'center',
              }}
            >
              <Text style={[styles.welcomeHeadline, { color: theme.text }]}>
                {t('welcomeHeadline')}
              </Text>
              <Text style={[styles.welcomeSub, { color: theme.textSecondary }]}>
                {t('welcomeSub')}
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.welcomeHighlights,
                {
                  opacity: welcomeCardsOpacity,
                  transform: [{ translateY: welcomeCardsSlide }],
                  borderTopColor: theme.hairline,
                  borderBottomColor: theme.hairline,
                },
              ]}
            >
              <View style={styles.welcomeHighlightCell}>
                <Ionicons name="body-outline" size={18} color="#10B981" />
                <Text style={[styles.welcomeHighlightTitle, { color: theme.text }]}>
                  {t('welcomeFeatAnatomy')}
                </Text>
                <Text style={[styles.welcomeHighlightSub, { color: theme.textMuted }]}>
                  {t('welcomeFeatAnatomySub')}
                </Text>
              </View>
              <View style={[styles.welcomeCellDivider, { backgroundColor: theme.hairline }]} />
              <View style={styles.welcomeHighlightCell}>
                <Ionicons name="timer-outline" size={18} color="#38BDF8" />
                <Text style={[styles.welcomeHighlightTitle, { color: theme.text }]}>
                  {t('welcomeFeatRest')}
                </Text>
                <Text style={[styles.welcomeHighlightSub, { color: theme.textMuted }]}>
                  {t('welcomeFeatRestSub')}
                </Text>
              </View>
              <View style={[styles.welcomeCellDivider, { backgroundColor: theme.hairline }]} />
              <View style={styles.welcomeHighlightCell}>
                <Ionicons name="cloud-done-outline" size={18} color="#A855F7" />
                <Text style={[styles.welcomeHighlightTitle, { color: theme.text }]}>
                  {t('welcomeFeatCloud')}
                </Text>
                <Text style={[styles.welcomeHighlightSub, { color: theme.textMuted }]}>
                  {t('welcomeFeatCloudSub')}
                </Text>
              </View>
            </Animated.View>
          </View>

          <Animated.View style={{ opacity: welcomeCtaOpacity }}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleStartConfigurator}
              activeOpacity={0.86}
            >
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                {t('welcomeStart')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Open Editorial Header */}
      <View style={[styles.headerShell, { borderBottomColor: theme.hairline }]}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <TouchableOpacity
              style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
              onPress={() => {
                if (step > 0) {
                  handlePrevStep();
                } else {
                  triggerSelectionHaptic();
                  welcomeBgOpacity.setValue(1);
                  setShowWelcomeIntro(true);
                }
              }}
              activeOpacity={0.75}
              accessibilityLabel="Wstecz"
            >
              <Ionicons name="arrow-back" size={18} color={theme.text} />
            </TouchableOpacity>

            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <Text style={[styles.brandTitle, { color: theme.text }]} numberOfLines={1}>
                IRON ROUTINE
              </Text>
              <Text style={[styles.brandSub, { color: meta.accent }]} numberOfLines={1}>
                {meta.kicker}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <LanguageSwitcher variant="pill" />

            <TouchableOpacity
              style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
              onPress={() => {
                triggerSelectionHaptic();
                toggleTheme();
              }}
              activeOpacity={0.75}
              accessibilityLabel="Toggle theme"
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Segmented Open Step Progress Track */}
        <View style={styles.progressRow}>
          <View style={styles.segmentsTrack}>
            {localizedSteps.map((sMeta, idx) => {
              const isDoneOrCurrent = idx <= step;
              const isCurrent = idx === step;
              return (
                <View
                  key={sMeta.kicker}
                  style={[
                    styles.segmentPill,
                    {
                      backgroundColor: isDoneOrCurrent ? meta.accent : theme.bgSecondary,
                      opacity: isCurrent ? 1 : isDoneOrCurrent ? 0.55 : 1,
                    },
                  ]}
                />
              );
            })}
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

                <View
                  style={[
                    styles.underlineInputGroup,
                    {
                      borderBottomColor: focusedField === 'name' ? meta.accent : theme.hairline,
                      borderBottomWidth: focusedField === 'name' ? 1.5 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.fieldLabel,
                      { color: focusedField === 'name' ? meta.accent : theme.textMuted },
                    ]}
                  >
                    Imię lub pseudonim
                  </Text>
                  <TextInput
                    style={[styles.openBigInput, { color: theme.text }]}
                    placeholder="np. Szymon, Kasia..."
                    placeholderTextColor={theme.textMuted}
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField((f) => (f === 'name' ? null : f))}
                    returnKeyType="done"
                  />
                </View>

                <View style={styles.twoColsOpen}>
                  <View
                    style={[
                      styles.underlineInputGroup,
                      {
                        flex: 1,
                        borderBottomColor: focusedField === 'weight' ? meta.accent : theme.hairline,
                        borderBottomWidth: focusedField === 'weight' ? 1.5 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: focusedField === 'weight' ? meta.accent : theme.textMuted },
                      ]}
                    >
                      Masa ciała (kg)
                    </Text>
                    <TextInput
                      style={[styles.openBigInput, { color: theme.text }]}
                      placeholder="np. 76.5"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="decimal-pad"
                      value={weightText}
                      onChangeText={setWeightText}
                      onFocus={() => setFocusedField('weight')}
                      onBlur={() => setFocusedField((f) => (f === 'weight' ? null : f))}
                    />
                  </View>

                  <View
                    style={[
                      styles.underlineInputGroup,
                      {
                        flex: 1,
                        borderBottomColor: focusedField === 'height' ? meta.accent : theme.hairline,
                        borderBottomWidth: focusedField === 'height' ? 1.5 : StyleSheet.hairlineWidth,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: focusedField === 'height' ? meta.accent : theme.textMuted },
                      ]}
                    >
                      Wzrost (cm)
                    </Text>
                    <TextInput
                      style={[styles.openBigInput, { color: theme.text }]}
                      placeholder="np. 178"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      value={heightText}
                      onChangeText={setHeightText}
                      onFocus={() => setFocusedField('height')}
                      onBlur={() => setFocusedField((f) => (f === 'height' ? null : f))}
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
              STEP 4: TRAINING MODES SELECTION (FBW / UL / PPL / SPLIT4 / BLANK)
             ========================================================= */}
          {step === 3 && (
            <View style={styles.openStepFlow}>
              {/* Live 3-Column Summary Telemetry for Currently Chosen Mode */}
              <View
                style={[
                  styles.planTelemetryBar,
                  {
                    borderTopColor: theme.hairline,
                    borderBottomColor: theme.hairline,
                  },
                ]}
              >
                <View style={styles.planTelemetryCell}>
                  <Text style={[styles.planTelemetryLabel, { color: theme.textMuted }]}>
                    {t('onboardingModeWeekRhythm')}
                  </Text>
                  <Text style={[styles.planTelemetryVal, { color: selectedPlanMeta.accent }]}>
                    {selectedModeCopy.freq}
                  </Text>
                </View>
                <View style={[styles.planTelemetryDivider, { backgroundColor: theme.hairline }]} />
                <View style={styles.planTelemetryCell}>
                  <Text style={[styles.planTelemetryLabel, { color: theme.textMuted }]}>
                    {t('onboardingModeDuration')}
                  </Text>
                  <Text style={[styles.planTelemetryVal, { color: theme.text }]}>
                    {selectedPlanMeta.duration}
                  </Text>
                </View>
                <View style={[styles.planTelemetryDivider, { backgroundColor: theme.hairline }]} />
                <View style={styles.planTelemetryCell}>
                  <Text style={[styles.planTelemetryLabel, { color: theme.textMuted }]}>
                    {t('onboardingModeFocus')}
                  </Text>
                  <Text style={[styles.planTelemetryVal, { color: theme.text }]}>
                    {selectedModeCopy.focus}
                  </Text>
                </View>
              </View>

              <View style={styles.planListWrap}>
                {PLAN_TEMPLATE_OPTIONS.map((tpl) => {
                  const key = tpl.id as Exclude<PlanTemplateKey, 'clone_current'>;
                  const pMeta = PLAN_VISUAL_META[key] || PLAN_VISUAL_META.fbw3;
                  const pCopy = modeStrings[key] || modeStrings.fbw3;
                  const selected = templateKey === tpl.id;
                  return (
                    <TouchableOpacity
                      key={tpl.id}
                      style={[
                        styles.planOptionBlock,
                        {
                          borderBottomColor: selected ? pMeta.accent : theme.hairline,
                          borderColor: selected ? pMeta.accent : theme.hairline,
                          backgroundColor: selected
                            ? isDark
                              ? `${pMeta.accent}14`
                              : `${pMeta.accent}10`
                            : 'transparent',
                        },
                      ]}
                      onPress={() => handleSelectTrainingMode(key)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.planOptionTopRow}>
                        <View style={styles.planBadgeGroup}>
                          <View
                            style={[
                              styles.planBadgePill,
                              {
                                backgroundColor: selected
                                  ? pMeta.accent
                                  : isDark
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(24,24,27,0.06)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.planBadgeText,
                                { color: selected ? '#09090B' : theme.textSecondary },
                              ]}
                            >
                              {pCopy.badge}
                            </Text>
                          </View>

                          <Text style={[styles.planFreqInline, { color: pMeta.accent }]}>
                            {pCopy.freq}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.planCheckCircle,
                            {
                              backgroundColor: selected ? pMeta.accent : 'transparent',
                              borderColor: selected ? pMeta.accent : theme.border,
                            },
                          ]}
                        >
                          {selected && <Ionicons name="checkmark" size={14} color="#09090B" />}
                        </View>
                      </View>

                      <Text style={[styles.templateTitle, { color: theme.text }]}>
                        {pCopy.label}
                      </Text>
                      <Text style={[styles.templateDesc, { color: theme.textSecondary }]}>
                        {pCopy.summary}
                      </Text>

                      {/* Visual 7-Day Week Split Mini-Timeline */}
                      <View style={styles.weekMatrixRow}>
                        {WEEK_DAY_IDS.map((dayId, dayIdx) => {
                          const code = pMeta.dayCodes[dayIdx] || '·';
                          const isWorkout = code !== '·';
                          return (
                            <View key={dayId} style={styles.weekMatrixCol}>
                              <Text style={[styles.weekDayLbl, { color: theme.textMuted }]}>
                                {dayLabel(dayId, true)}
                              </Text>
                              <View
                                style={[
                                  styles.weekDayPill,
                                  {
                                    backgroundColor: isWorkout
                                      ? selected
                                        ? pMeta.accent
                                        : isDark
                                        ? 'rgba(255,255,255,0.08)'
                                        : 'rgba(24,24,27,0.07)'
                                      : 'transparent',
                                    borderColor: isWorkout
                                      ? selected
                                        ? pMeta.accent
                                        : theme.border
                                      : theme.hairline,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.weekDayCode,
                                    {
                                      color: isWorkout
                                        ? selected
                                          ? '#09090B'
                                          : theme.text
                                        : theme.textMuted,
                                    },
                                  ]}
                                >
                                  {code}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* =========================================================
              STEP 5: PROPOSED EXERCISES PER DAY WITH "ZMIEŃ" ALTERNATIVE PICKER
             ========================================================= */}
          {step === 4 && (
            <View style={styles.openStepFlow}>
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: '#A855F7' }]}>
                  {t('onboardingDaySelectLabel')} · {selectedModeCopy.label.toUpperCase()}
                </Text>

                {templateKey === 'blank' ? (
                  <View
                    style={[
                      styles.blankModeBanner,
                      { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                    ]}
                  >
                    <Ionicons name="sparkles-outline" size={20} color="#F59E0B" />
                    <Text style={[styles.blankModeBannerText, { color: theme.textSecondary }]}>
                      {t('onboardingBlankInfo')}
                    </Text>
                  </View>
                ) : null}

                {/* Horizontal Day Switcher across days of the chosen mode */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.proposedDayScroll}
                >
                  {customDays
                    .filter((d) => (templateKey === 'blank' ? true : d.type === 'workout'))
                    .map((d) => {
                      const active = d.id === selectedPreviewDayId;
                      return (
                        <TouchableOpacity
                          key={d.id}
                          style={[
                            styles.proposedDayPill,
                            {
                              backgroundColor: active ? theme.text : theme.bgSecondary,
                              borderColor: active ? theme.text : theme.border,
                            },
                          ]}
                          onPress={() => {
                            triggerSelectionHaptic();
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setSelectedPreviewDayId(d.id);
                          }}
                          activeOpacity={0.78}
                        >
                          <Text
                            style={[
                              styles.proposedDayShort,
                              { color: active ? theme.bg : theme.text },
                            ]}
                          >
                            {dayLabel(d.id, true)}
                          </Text>
                          <Text
                            style={[
                              styles.proposedDayName,
                              { color: active ? theme.bg : theme.textSecondary },
                            ]}
                            numberOfLines={1}
                          >
                            {d.name.split('·')[0].trim()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>

                {(() => {
                  const activeDay =
                    customDays.find((d) => d.id === selectedPreviewDayId) ||
                    customDays.find((d) => d.type === 'workout') ||
                    customDays[0];
                  if (!activeDay) return null;
                  const dayExercises = activeDay.exercises || [];

                  return (
                    <View style={styles.proposedListWrap}>
                      <View style={styles.proposedDayHeader}>
                        <Text style={[styles.proposedDayHeading, { color: theme.text }]}>
                          {activeDay.name}
                        </Text>
                        <Text style={[styles.proposedDaySub, { color: theme.textMuted }]}>
                          {dayExercises.length} · {activeDay.subtitle}
                        </Text>
                      </View>

                      {dayExercises.map((exItem, exIdx) => {
                        const anatomy = resolveExerciseMuscles(exItem);
                        const primaryLbl = muscleLabel(anatomy.primary, true);
                        const secondaryLbls = anatomy.secondary
                          .filter((s) => s.weight >= 0.25)
                          .slice(0, 3)
                          .map((s) => muscleLabel(s.muscle, true));

                        return (
                          <View
                            key={`${exItem.id}_${exIdx}`}
                            style={[
                              styles.proposedExRow,
                              { borderBottomColor: theme.hairline },
                            ]}
                          >
                            <View style={styles.proposedIndexBadge}>
                              <Text style={[styles.proposedIndexText, { color: theme.textMuted }]}>
                                {String(exIdx + 1).padStart(2, '0')}
                              </Text>
                            </View>

                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                style={[styles.proposedExName, { color: theme.text }]}
                                numberOfLines={2}
                              >
                                {exItem.name}
                              </Text>
                              <Text
                                style={[styles.proposedExMeta, { color: theme.textSecondary }]}
                                numberOfLines={2}
                              >
                                {primaryLbl}
                                {secondaryLbls.length > 0 ? ` + ${secondaryLbls.join(', ')}` : ''}
                              </Text>
                              <Text style={[styles.proposedExStats, { color: theme.textMuted }]}>
                                {exItem.sets} × {exItem.reps}
                                {exItem.equipment ? ` · ${equipmentLabel(exItem.equipment)}` : ''}
                              </Text>
                            </View>

                            <View style={styles.proposedActionsCol}>
                              <TouchableOpacity
                                style={[
                                  styles.swapExBtn,
                                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                                ]}
                                onPress={() => {
                                  triggerSelectionHaptic();
                                  setSwapSearch('');
                                  setShowAllInSwap(false);
                                  setSwapTarget({
                                    dayId: activeDay.id,
                                    exIndex: exIdx,
                                    currentExercise: exItem,
                                  });
                                }}
                                activeOpacity={0.78}
                              >
                                <Ionicons name="swap-horizontal" size={14} color={theme.text} />
                                <Text style={[styles.swapExBtnText, { color: theme.text }]}>
                                  {t('change')}
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.removeExIconBtn}
                                onPress={() => handleRemoveProposedExercise(activeDay.id, exIdx)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              >
                                <Ionicons name="close-circle-outline" size={18} color={theme.textMuted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}

                      <TouchableOpacity
                        style={[
                          styles.addProposedExBtn,
                          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          setSwapSearch('');
                          setShowAllInSwap(false);
                          setSwapTarget({
                            dayId: activeDay.id,
                            exIndex: null,
                            currentExercise: dayExercises[0] || null,
                          });
                        }}
                        activeOpacity={0.78}
                      >
                        <Ionicons name="add-circle-outline" size={17} color={theme.text} />
                        <Text style={[styles.addProposedExText, { color: theme.text }]}>
                          {t('onboardingAddExercise')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })()}
              </View>
            </View>
          )}

          {/* =========================================================
              STEP 6: ACCOUNT & CLOUD LOGIN (FINAL CONFIGURATOR PAGE)
             ========================================================= */}
          {step === 5 && (
            <View style={styles.openStepFlow}>
              <View style={[styles.openSection, { borderTopColor: theme.hairline }]}>
                <Text style={[styles.sectionEyebrow, { color: '#10B981' }]}>
                  CLERK · NOSQL
                </Text>

                <Text style={[styles.cloudFinalLead, { color: theme.textSecondary }]}>
                  {t('step6Subtitle')}
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
                          {t('onboardingContinueCloud')}
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
                          {t('onboardingContinueGoogle')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={[styles.orDividerRow]}>
                    <View style={[styles.orDividerLine, { backgroundColor: theme.hairline }]} />
                    <Text style={[styles.orDividerText, { color: theme.textMuted }]}>/</Text>
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
                          {t('onboardingUseLocal')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={[styles.cloudDisclaimerText, { color: theme.textMuted }]}>
                  {t('onboardingPrivacyNote')}
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
                {step === 3
                  ? t('onboardingGoToExercises')
                  : step === 4
                  ? t('onboardingGoToCloud')
                  : `${t('next')} (${step + 1}/${TOTAL_STEPS})`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Alternative Exercise Picker Modal for Step 5 ("Zmień") */}
      <Modal
        visible={swapTarget !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSwapTarget(null)}
      >
        <View style={[styles.swapModalContainer, { backgroundColor: theme.bg }]}>
          <View style={[styles.swapModalHeader, { borderBottomColor: theme.hairline }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.swapModalTitle, { color: theme.text }]}>
                {swapTarget?.exIndex !== null
                  ? t('onboardingSwapTitle')
                  : t('onboardingAddExercise')}
              </Text>
              <Text style={[styles.swapModalSub, { color: theme.textMuted }]} numberOfLines={2}>
                {swapTarget?.currentExercise
                  ? `${swapTarget.currentExercise.name} · ${t('onboardingSwapSubtitle')}`
                  : t('onboardingSwapSubtitle')}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary }]}
              onPress={() => setSwapTarget(null)}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.swapSearchRow}>
            <View
              style={[
                styles.swapSearchBox,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
            >
              <Ionicons name="search" size={16} color={theme.textMuted} />
              <TextInput
                style={[styles.swapSearchInput, { color: theme.text }]}
                placeholder={t('searchPlaceholder')}
                placeholderTextColor={theme.textMuted}
                value={swapSearch}
                onChangeText={setSwapSearch}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.showAllTogglePill,
                {
                  backgroundColor: showAllInSwap ? theme.text : theme.bgSecondary,
                  borderColor: showAllInSwap ? theme.text : theme.border,
                },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setShowAllInSwap((v) => !v);
              }}
              activeOpacity={0.78}
            >
              <Text
                style={[
                  styles.showAllToggleText,
                  { color: showAllInSwap ? theme.bg : theme.text },
                ]}
              >
                {t('all')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.swapListContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {(() => {
              if (!swapTarget) return null;
              const targetDay = customDays.find((d) => d.id === swapTarget.dayId);
              const existingDayIds = (targetDay?.exercises || []).map((e) => e.id);
              const candidates =
                swapTarget.currentExercise && !showAllInSwap
                  ? getAlternativeExercisesFor(swapTarget.currentExercise, existingDayIds)
                  : EXERCISE_LIBRARY.filter((e) => !existingDayIds.includes(e.id));

              const q = swapSearch.trim().toLowerCase();
              const favSet = new Set(favoriteIds);
              const filtered = candidates
                .filter((cand) => {
                  if (!q) return true;
                  const anatomy = resolveExerciseMuscles(cand);
                  return (
                    cand.name.toLowerCase().includes(q) ||
                    muscleLabel(anatomy.primary).toLowerCase().includes(q) ||
                    (cand.equipment || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  const aFav =
                    favSet.has(a.id) || favSet.has(resolveCanonicalExerciseId(a.id, a.name)) ? 1 : 0;
                  const bFav =
                    favSet.has(b.id) || favSet.has(resolveCanonicalExerciseId(b.id, b.name)) ? 1 : 0;
                  return bFav - aFav;
                });

              if (filtered.length === 0) {
                return (
                  <Text style={[styles.inlineEmptySwap, { color: theme.textMuted }]}>
                    {t('noResults')}
                  </Text>
                );
              }

              return filtered.map((cand) => {
                const anatomy = resolveExerciseMuscles(cand);
                const cid = resolveCanonicalExerciseId(cand.id, cand.name);
                const isFav = favSet.has(cand.id) || favSet.has(cid);
                const secLbls = anatomy.secondary
                  .filter((s) => s.weight >= 0.25)
                  .slice(0, 3)
                  .map((s) => muscleLabel(s.muscle, true));

                return (
                  <TouchableOpacity
                    key={cand.id}
                    style={[
                      styles.swapOptionRow,
                      { borderBottomColor: theme.hairline },
                    ]}
                    onPress={() => handleConfirmSwapOrAdd(cand)}
                    activeOpacity={0.78}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.swapOptionTitle, { color: theme.text }]}>
                        {cand.name}
                      </Text>
                      <Text style={[styles.swapOptionMuscles, { color: theme.textSecondary }]}>
                        {muscleLabel(anatomy.primary, true)}
                        {secLbls.length > 0 ? ` + ${secLbls.join(', ')}` : ''}
                      </Text>
                      <Text style={[styles.swapOptionMeta, { color: theme.textMuted }]}>
                        {cand.sets} × {cand.reps}
                        {cand.equipment ? ` · ${equipmentLabel(cand.equipment)}` : ''}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleToggleSwapFavorite(cand)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={{ padding: 6 }}
                    >
                      <Ionicons
                        name={isFav ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isFav ? '#EF4444' : theme.textMuted}
                      />
                    </TouchableOpacity>

                    <View style={[styles.swapSelectPill, { backgroundColor: theme.primary }]}>
                      <Ionicons name="checkmark" size={14} color={theme.primaryText} />
                    </View>
                  </TouchableOpacity>
                );
              });
            })()}
          </ScrollView>
        </View>
      </Modal>
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
  segmentsTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segmentPill: {
    flex: 1,
    height: 4,
    borderRadius: 99,
  },
  welcomeWrap: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  welcomeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomePillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  welcomeLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  welcomePillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    color: '#10B981',
  },
  welcomeCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  welcomeCrestStage: {
    width: 126,
    height: 126,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeOrbitRing: {
    position: 'absolute',
    width: 126,
    height: 126,
    borderRadius: 63,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  welcomeOrbitDotTop: {
    position: 'absolute',
    top: -4,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  welcomeOrbitDotBottom: {
    position: 'absolute',
    bottom: -3.5,
    left: '50%',
    marginLeft: -3.5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#38BDF8',
  },
  welcomeCoreOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeHeadline: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 39,
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  welcomeHighlights: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  welcomeHighlightCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  welcomeCellDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
  },
  welcomeHighlightTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  welcomeHighlightSub: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  planTelemetryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  planTelemetryCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  planTelemetryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  planTelemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  planTelemetryVal: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  planListWrap: {
    gap: 10,
  },
  planOptionBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  planOptionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  planBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  planBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  planFreqInline: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  planCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekMatrixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
  },
  weekMatrixCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekDayLbl: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  weekDayPill: {
    width: '100%',
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayCode: {
    fontSize: 11,
    fontWeight: '900',
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
  blankModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  blankModeBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  proposedDayScroll: {
    gap: 8,
    paddingVertical: 6,
  },
  proposedDayPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 104,
  },
  proposedDayShort: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  proposedDayName: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    maxWidth: 140,
  },
  proposedListWrap: {
    marginTop: 12,
  },
  proposedDayHeader: {
    marginBottom: 8,
  },
  proposedDayHeading: {
    fontSize: 17,
    fontWeight: '900',
  },
  proposedDaySub: {
    fontSize: 12,
    marginTop: 2,
  },
  proposedExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  proposedIndexBadge: {
    width: 24,
    alignItems: 'center',
  },
  proposedIndexText: {
    fontSize: 11,
    fontWeight: '800',
  },
  proposedExName: {
    fontSize: 14,
    fontWeight: '800',
  },
  proposedExMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  proposedExStats: {
    fontSize: 11,
    marginTop: 3,
  },
  proposedActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swapExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  swapExBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  removeExIconBtn: {
    padding: 4,
  },
  addProposedExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  addProposedExText: {
    fontSize: 13,
    fontWeight: '800',
  },
  swapModalContainer: {
    flex: 1,
    paddingTop: 14,
  },
  swapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swapModalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  swapModalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  swapSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  swapSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  swapSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  showAllTogglePill: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showAllToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  swapListContent: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  swapOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swapOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  swapOptionMuscles: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  swapOptionMeta: {
    fontSize: 11,
    marginTop: 3,
  },
  swapSelectPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineEmptySwap: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
