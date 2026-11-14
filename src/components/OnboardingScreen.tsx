import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAppTheme } from '../context/ThemeContext';
import {
  PlanTemplateKey,
  SupplementItem,
  UserProfile,
} from '../types/workout';
import { PLAN_TEMPLATE_OPTIONS } from '../data/exerciseLibrary';
import { DEFAULT_SUPPLEMENTS } from '../data/supplements';
import { createProfile, importProfileBackup } from '../services/storage';
import { updateAppSettings } from '../services/settings';
import { requestHealthPermissions } from '../services/health';
import { setCreatineReminderEnabled } from '../services/notifications';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { AnimatedIcon } from './AnimatedIcon';
import { SupplementConfigurator } from './SupplementConfigurator';

interface OnboardingScreenProps {
  onCompleted: (profile: UserProfile) => Promise<void> | void;
}

const TOTAL_STEPS = 4;
const ONBOARDING_REST_PRESETS = [90, 120, 180];

const STEP_META = [
  {
    kicker: 'KROK 1 Z 4 · PROFIL',
    title: 'Poznajmy Twoje parametry',
    subtitle: 'Jedno konto zbiera wspólne rekordy PR i postępy niezależnie od tego, ile planów stworzysz.',
    icon: 'barbell-outline' as const,
    preset: 'barbell' as const,
    accent: undefined,
  },
  {
    kicker: 'KROK 2 Z 4 · SUPLEMENTACJA',
    title: 'Dobierz suplementy i dawki',
    subtitle: 'Wybierz z listy lub dodaj własne — dawkę możemy wyliczać automatycznie wg masy ciała.',
    icon: 'flame' as const,
    preset: 'flame' as const,
    accent: '#F59E0B',
  },
  {
    kicker: 'KROK 3 Z 4 · ZDROWIE I ALERTY',
    title: 'Regeneracja, sen i przerwy',
    subtitle: 'Połącz systemowe Zdrowie oraz ustaw alarm końca przerwy działający również przy wygaszonym ekranie.',
    icon: 'heart' as const,
    preset: 'heart' as const,
    accent: '#EF4444',
  },
  {
    kicker: 'KROK 4 Z 4 · PLAN STARTOWY',
    title: 'Wybierz bazę treningową',
    subtitle: 'Zacznij od gotowego schematu lub pustego szkieletu — w każdej chwili dodasz kolejne plany.',
    icon: 'trophy' as const,
    preset: 'trophy' as const,
    accent: '#F59E0B',
  },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onCompleted }) => {
  const { theme, isDark, toggleTheme } = useAppTheme();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollRef = useRef<any>(null);
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const heroScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step + 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

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
      duration: 130,
      useNativeDriver: true,
    }).start(() => {
      setStep(nextStep);
      stepSlide.setValue(dir * 32);
      heroScale.setValue(0.92);
      scrollRef.current?.scrollTo({ y: 0, animated: false });

      Animated.parallel([
        Animated.timing(stepFade, {
          toValue: 1,
          duration: 220,
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
      Alert.alert('Podaj imię', 'Wpisz swoje imię lub pseudonim, abyśmy mogli utworzyć Twój profil.');
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
            ? 'Możesz włączyć uprawnienia Apple Health później w Ustawieniach lub bezpośrednio w aplikacji Zdrowie.'
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
      try {
        await Notifications.requestPermissionsAsync();
      } catch {}
    }
  };

  const handleFinishSetup = async () => {
    if (isSubmitting) return;
    const trimmed = name.trim() || 'Sportowiec';

    setIsSubmitting(true);
    try {
      if (hapticsEnabled) {
        try {
          await Notifications.requestPermissionsAsync();
        } catch {}
      }

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

      triggerNotificationHaptic('success');
      const profile = await createProfile(trimmed, {
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

  const handleSkipBlank = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await updateAppSettings({
        defaultRestSeconds,
        hapticsEnabled,
        restEndMultiBuzz: hapticsEnabled,
        restNotificationsEnabled: hapticsEnabled,
        healthSyncEnabled,
        supplements,
      });
      const profile = await createProfile(name.trim() || 'Sportowiec', { templateKey: 'blank' });
      await onCompleted(profile);
    } catch (e: any) {
      Alert.alert('Błąd', e?.message || 'Nie udało się uruchomić czystego profilu.');
    } finally {
      setIsSubmitting(false);
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
    outputRange: ['25%', '100%'],
  });

  const enabledSuppCount = supplements.filter((s) => s.enabled).length;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Fixed Animated Wizard Header */}
      <View style={[styles.headerShell, { borderBottomColor: theme.hairline }]}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            {step > 0 ? (
              <TouchableOpacity
                style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                onPress={handlePrevStep}
                activeOpacity={0.75}
                accessibilityLabel="Wstecz"
              >
                <Ionicons name="arrow-back" size={18} color={theme.text} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <AnimatedIcon name="barbell-outline" preset="barbell" size={18} color={theme.text} active />
              </View>
            )}

            <View style={{ flexShrink: 1, minWidth: 0 }}>
              <Text style={[styles.brandTitle, { color: theme.text }]} numberOfLines={1}>
                IRON ROUTINE
              </Text>
              <Text style={[styles.brandSub, { color: theme.textMuted }]} numberOfLines={1}>
                {meta.kicker}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
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
                { backgroundColor: theme.text, width: progressWidth },
              ]}
            />
          </View>
          <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
              const passedOrCurrent = idx <= step;
              return (
                <View
                  key={idx}
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: passedOrCurrent ? theme.text : theme.bgTertiary,
                      borderColor: passedOrCurrent ? theme.text : theme.border,
                    },
                  ]}
                />
              );
            })}
          </View>
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
          {/* Step Hero Banner */}
          <Animated.View style={[styles.heroBlock, { transform: [{ scale: heroScale }] }]}>
            <View
              style={[
                styles.heroBadge,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
            >
              <AnimatedIcon
                name={meta.icon}
                preset={meta.preset}
                size={22}
                color={meta.accent || theme.text}
                active
              />
            </View>

            <Text style={[styles.heroHeadline, { color: theme.text }]}>{meta.title}</Text>
            <Text style={[styles.heroCopy, { color: theme.textSecondary }]}>{meta.subtitle}</Text>
          </Animated.View>

          {/* STEP 1: Profile & Body Parameters */}
          {step === 0 && (
            <>
              <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>DANE OSOBOWE (1 PROFIL)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                  ]}
                  placeholder="Twoje imię lub ksywka..."
                  placeholderTextColor={theme.textMuted}
                  value={name}
                  onChangeText={setName}
                  returnKeyType="done"
                />

                <View style={styles.twoCols}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Waga (kg)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                      ]}
                      placeholder="np. 78"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="decimal-pad"
                      value={weightText}
                      onChangeText={setWeightText}
                    />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>Wzrost (cm)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
                      ]}
                      placeholder="np. 180"
                      placeholderTextColor={theme.textMuted}
                      keyboardType="number-pad"
                      value={heightText}
                      onChangeText={setHeightText}
                    />
                  </View>
                </View>

                <Text style={[styles.helperHint, { color: theme.textMuted }]}>
                  Wagę wykorzystamy m.in. do automatycznego przeliczania dawek suplementów (g/kg) i statystyk.
                </Text>
              </View>

              {/* JSON Import Option */}
              <TouchableOpacity
                style={[styles.importToggle, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                onPress={() => {
                  triggerSelectionHaptic();
                  setShowImport((v) => !v);
                }}
                activeOpacity={0.75}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <Ionicons name="download-outline" size={18} color={theme.text} />
                  <Text style={[styles.importToggleText, { color: theme.text, flexShrink: 1 }]} numberOfLines={1}>
                    Importuj JSON
                  </Text>
                </View>
                <Ionicons
                  name={showImport ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.textMuted}
                />
              </TouchableOpacity>

              {showImport && (
                <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border, marginTop: 10 }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>
                    Wklej zawartość wyeksportowanego pliku JSON:
                  </Text>
                  <TextInput
                    style={[
                      styles.importTextArea,
                      { backgroundColor: theme.card, borderColor: theme.border, color: theme.text },
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
                    <Ionicons name="cloud-download-outline" size={18} color={theme.primaryText} />
                    <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                      Zaimportuj profil i plany
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* STEP 2: Supplementation & Dosing */}
          {step === 1 && (
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <View style={styles.stepHeaderInline}>
                <Text style={[styles.kicker, { color: theme.textMuted, marginBottom: 0 }]}>
                  TWOJE SUPLEMENTY ({enabledSuppCount} WYBRANE)
                </Text>
                {parsedWeight ? (
                  <View style={[styles.weightTag, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={[styles.weightTagText, { color: theme.text }]}>
                      {parsedWeight} kg m.c.
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.suppNote, { color: theme.textSecondary }]}>
                Zamiast sztywnej dawki wybierz tryb zalecany, przelicznik na kg masy ciała lub własną gramaturę.
              </Text>

              <SupplementConfigurator
                supplements={supplements}
                weightKg={parsedWeight}
                onChange={setSupplements}
                compact
              />
            </View>
          )}

          {/* STEP 3: Health Integration & Alarm/Haptics */}
          {step === 2 && (
            <>
              <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <Text style={[styles.kicker, { color: theme.textMuted }]}>
                  INTEGRACJA ZE ZDROWIEM
                </Text>
                <TouchableOpacity
                  style={[
                    styles.healthConnectCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: healthSyncEnabled ? '#10B981' : theme.border,
                    },
                  ]}
                  onPress={handleConnectHealth}
                  disabled={isConnectingHealth}
                  activeOpacity={0.8}
                >
                  <View style={styles.healthIconWrap}>
                    <AnimatedIcon name="heart" preset="heart" size={20} color="#EF4444" active />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      {Platform.OS === 'ios' ? 'Apple Health (Zdrowie)' : 'Health Connect'}
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Pobieraj automatycznie kroki, czas snu i aktywne kalorie do wskazówek treningowych.
                    </Text>
                  </View>

                  {isConnectingHealth ? (
                    <ActivityIndicator size="small" color={theme.text} />
                  ) : (
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: healthSyncEnabled ? '#10B981' : theme.primary,
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: healthSyncEnabled ? '#FFFFFF' : theme.primaryText }]}>
                        {healthSyncEnabled ? 'Połączono' : 'Połącz'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={[styles.kicker, { color: theme.textMuted, marginTop: 18 }]}>
                  PRZERWY I POWIADOMIENIA
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
                            backgroundColor: active ? theme.primary : theme.card,
                            borderColor: active ? theme.primary : theme.border,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          setDefaultRestSeconds(secs);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.prefPillText, { color: active ? theme.primaryText : theme.text }]}>
                          Przerwa {secs}s
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={handleToggleAlarmAndHaptics}
                  activeOpacity={0.78}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Alarm i wibracje końca przerwy
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Wielokrotny sygnał dźwiękowy i alert na ekranie blokady przy wyłączonej aplikacji
                    </Text>
                  </View>
                  <Ionicons
                    name={hapticsEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={hapticsEnabled ? theme.text : theme.textMuted}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: theme.card, borderColor: theme.border }]}
                  onPress={() => {
                    triggerSelectionHaptic();
                    setSuppReminderEnabled((v) => !v);
                  }}
                  activeOpacity={0.78}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.optionTitle, { color: theme.text }]}>
                      Przypomnienie o suplementacji
                    </Text>
                    <Text style={[styles.optionSub, { color: theme.textMuted }]}>
                      Codzienne przypomnienie wieczorne z Twoją wybraną listą dawek
                    </Text>
                  </View>
                  <Ionicons
                    name={suppReminderEnabled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={suppReminderEnabled ? theme.text : theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* STEP 4: Starter Plan Selection */}
          {step === 3 && (
            <View style={[styles.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
              <Text style={[styles.kicker, { color: theme.textMuted }]}>PIERWSZY PLAN TRENINGOWY</Text>
              <View style={styles.templatesWrap}>
                {PLAN_TEMPLATE_OPTIONS.map((tpl) => {
                  const selected = templateKey === tpl.id;
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
                        setTemplateKey(tpl.id as Exclude<PlanTemplateKey, 'clone_current'>);
                      }}
                      activeOpacity={0.78}
                    >
                      <View style={styles.templateTop}>
                        <Text
                          style={[
                            styles.templateTitle,
                            { color: selected ? theme.primaryText : theme.text },
                          ]}
                        >
                          {tpl.label}
                        </Text>
                        <Ionicons
                          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={selected ? theme.primaryText : theme.textMuted}
                        />
                      </View>
                      <Text
                        style={[
                          styles.templateSub,
                          { color: selected ? theme.primaryText : theme.textSecondary, opacity: selected ? 0.9 : 1 },
                        ]}
                      >
                        {tpl.subtitle}
                      </Text>
                      <Text
                        style={[
                          styles.templateDesc,
                          { color: selected ? theme.primaryText : theme.textMuted, opacity: selected ? 0.8 : 1 },
                        ]}
                      >
                        {tpl.summary}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Fixed Bottom Action Footer */}
      <View style={[styles.footer, { backgroundColor: theme.bg, borderTopColor: theme.hairline }]}>
        {step < TOTAL_STEPS - 1 ? (
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={handleNextStep}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                Dalej ({step + 1}/{TOTAL_STEPS})
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.primaryText} />
            </TouchableOpacity>

            {step === 0 && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={handleSkipBlank}
                disabled={isSubmitting}
                activeOpacity={0.7}
              >
                <Text style={[styles.skipBtnText, { color: theme.textMuted }]}>
                  Pomiń konfigurację (pusty plan)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              { backgroundColor: theme.primary, opacity: isSubmitting ? 0.65 : 1 },
            ]}
            onPress={handleFinishSetup}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={theme.primaryText} />
            ) : (
              <>
                <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                  Rozpocznij z Iron Routine
                </Text>
                <Ionicons name="checkmark" size={19} color={theme.primaryText} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
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
    gap: 11,
    flex: 1,
    minWidth: 0,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  brandSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  heroBlock: {
    marginBottom: 18,
  },
  heroBadge: {
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 6,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  twoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  helperHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: -2,
  },
  stepHeaderInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  weightTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  weightTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  suppNote: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  healthConnectCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  restPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  prefPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toggleRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  optionSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  templatesWrap: {
    gap: 10,
  },
  templateCard: {
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 13,
  },
  templateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  templateTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  templateSub: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  templateDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  importToggle: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  importToggleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  importTextArea: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    minHeight: 100,
    fontSize: 12,
    marginBottom: 12,
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
    borderRadius: 15,
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
