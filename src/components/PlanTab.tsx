import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { getLocalDateKey } from '../utils/localDate';
import { DAYS_OF_WEEK, WORKOUT_PLAN } from '../data/planData';
import { getDayBannerTagMeta, resolveDayBannerTag } from '../data/dayTags';
import { Exercise, DayPlan, PRRecord, WorkoutPlan } from '../types/workout';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import { PlanDayEditorModal } from './PlanDayEditorModal';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { DayBannerArtwork } from './DayBannerArtwork';
import { DayExercisePreviewList } from './DayExercisePreviewList';
import { AnimatedIcon } from './AnimatedIcon';
import { MinimalistBackdrop } from './MinimalistBackdrop';
import { SmartScrollView } from './SmartScrollView';
import { getAppSettings, updateAppSettings } from '../services/settings';
import { syncWorkoutScheduleWithDevice } from '../services/calendarSync';
import { updateDayInPlan } from '../services/storage';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';

interface PlanTabProps {
  profileId?: string;
  activePlan?: WorkoutPlan | null;
  allPlansCount?: number;
  extraLibraryExercises?: Exercise[];
  bestPRs?: { [exerciseId: string]: PRRecord };
  onOpenPlanManager?: () => void;
  onPlanUpdated?: () => Promise<void> | void;
  onLibraryChanged?: () => void;
  onSelectExerciseForPR?: (exercise: Exercise) => void;
  onStartWorkoutForDay?: (dayId: string) => void;
}

const EMPTY_EXERCISES: Exercise[] = [];
const EMPTY_PRS: { [exerciseId: string]: PRRecord } = {};

const DAILY_PLAN_HINTS: Record<string, Array<{ title: string; body: string }>> = {
  pl: [
    {
      title: 'Rozgrzewka z głową',
      body: 'Zrób 2–3 serie wstępne z narastającym ciężarem (50% → 75%) zanim wejdziesz na pierwszą serię roboczą.',
    },
    {
      title: 'Kontrola fazy ekscentrycznej',
      body: 'Opuszczaj ciężar przez 2–3 sekundy zamiast go zrzucać — zyskasz większy bodziec mięśniowy przy bezpieczniejszych stawach.',
    },
    {
      title: 'Progresja nie tylko ciężarem',
      body: 'Nie musisz dziś dokładać kilogramów — 1 dodatkowe powtórzenie w tej samej technice to pełnoprawny progres.',
    },
    {
      title: 'Przerwy między seriami',
      body: 'W ciężkich bojach złożonych odpoczywaj 2–3 minuty, a w ćwiczeniach izolowanych 60–90 sekund dla pełnej mocy.',
    },
    {
      title: 'Zapas powtórzeń (RIR 1–2)',
      body: 'Większość serii roboczych kończ 1–2 powtórzenia przed załamaniem — budujesz tyle samo mięśni przy znacznie mniejszym zmęczeniu układu nerwowego.',
    },
    {
      title: 'Nawodnienie i elektrolity',
      body: 'Spadek nawodnienia o 2% potrafi obniżyć siłę o kilka procent. Wypij szklankę wody ze szczyptą soli przed treningiem.',
    },
    {
      title: 'Stabilny tułów (bracing)',
      body: 'Przed każdym ciężkim powtórzeniem weź głęboki wdech do brzucha i zepnij core — kręgosłup podziękuje, a ciężar pójdzie płynniej.',
    },
    {
      title: 'Pełny zakres ruchu',
      body: 'Mocne rozciągnięcie mięśnia w dolnej fazie ruchu (np. skos hantli, RDL, ściąganie drążka) daje największy sygnał do hipertrofii.',
    },
    {
      title: 'Kolejność ma znaczenie',
      body: 'Najpierw wykonuj ćwiczenia wymagające najwięcej energii i stabilizacji, a izolacje zostaw na końcówkę sesji.',
    },
    {
      title: 'Sen to darmowy steryd',
      body: '7–9 godzin snu przyspiesza regenerację mięśni i stabilizuje kortyzol bardziej niż jakikolwiek suplement.',
    },
    {
      title: 'Białko po treningu',
      body: 'Zadbaj o 25–40 g pełnowartościowego białka w posiłku po sesji, aby zmaksymalizować syntezę białek mięśniowych.',
    },
    {
      title: 'Zapisuj każdy detal',
      body: 'Notowanie ciężaru i powtórzeń w każdej serii eliminuje zgadywanie i daje jasny cel do pobicia na kolejnej sesji.',
    },
  ],
  en: [
    {
      title: 'Smart Warm-Up Ramp',
      body: 'Hit 2–3 ascending warm-up sets (50% → 75%) before your first working set to prime joints and CNS.',
    },
    {
      title: 'Own the Eccentric',
      body: 'Lower weights with a controlled 2–3 second tempo for superior muscle tension and safer joints.',
    },
    {
      title: 'Progress Beyond Weight',
      body: 'Adding even 1 clean rep at the same load is real progressive overload — chase quality first.',
    },
    {
      title: 'Rest for Output',
      body: 'Take 2–3 min rest on heavy compounds and 60–90 sec on isolations so every working set counts.',
    },
    {
      title: 'Train Near Failure (1–2 RIR)',
      body: 'Leaving 1–2 reps in reserve on most sets maximizes hypertrophy while keeping systemic fatigue in check.',
    },
    {
      title: 'Hydration & Electrolytes',
      body: 'Even mild dehydration drops strength output. Drink water with a pinch of electrolytes before training.',
    },
    {
      title: 'Brace Your Core',
      body: 'Take a deep diaphragmatic breath and brace 360° before every heavy rep for rock-solid force transfer.',
    },
    {
      title: 'Embrace the Stretch',
      body: 'Control the fully lengthened position of every movement — deep stretch drives major muscle growth.',
    },
    {
      title: 'Prioritize Heavy First',
      body: 'Tackle your most demanding compound lifts while fresh, then finish with focused isolation work.',
    },
    {
      title: 'Sleep Fuels Gains',
      body: '7–9 hours of quality sleep accelerates recovery and strength adaptation more than any supplement.',
    },
    {
      title: 'Post-Session Protein',
      body: 'Aim for 25–40g of high-quality protein after training to kick-start muscle protein synthesis.',
    },
    {
      title: 'Track Every Working Set',
      body: 'Logging exact reps and loads removes guesswork and gives you a clear target to beat next session.',
    },
  ],
  de: [
    {
      title: 'Gezieltes Aufwärmen',
      body: 'Starte mit 2–3 Aufwärmsätzen mit steigendem Gewicht (50% → 75%), bevor der erste Arbeitssatz beginnt.',
    },
    {
      title: 'Kontrollierte Exzentrik',
      body: 'Senke das Gewicht kontrolliert über 2–3 Sekunden ab — mehr Muskelreiz bei geschonten Gelenken.',
    },
    {
      title: 'Progression ist vielfältig',
      body: 'Schon 1 saubere Wiederholung mehr bei gleichem Gewicht ist echter Fortschritt.',
    },
    {
      title: 'Pausen bewusst nutzen',
      body: '2–3 Minuten Pause bei Grundübungen und 60–90 Sekunden bei Isolationen sichern maximale Leistung.',
    },
    {
      title: '1–2 Wiederholungen im Tank',
      body: 'Die meisten Arbeitssätze mit 1–2 RIR liefern Top-Hypertrophie bei deutlich geringerer Ermüdung.',
    },
    {
      title: 'Flüssigkeit & Elektrolyte',
      body: 'Trinke vor dem Training ausreichend Wasser mit Elektrolyten — Dehydrierung kostet sofort Kraft.',
    },
  ],
  fr: [
    {
      title: 'Échauffement progressif',
      body: 'Fais 2 à 3 séries de montée en charge (50% → 75%) avant d’attaquer ta première série effective.',
    },
    {
      title: 'Maîtrise la phase excentrique',
      body: 'Retiens la descente pendant 2 à 3 secondes pour plus de tension musculaire et des articulations protégées.',
    },
    {
      title: 'Progresser autrement',
      body: 'Une seule répétition propre en plus à charge égale est déjà une vraie surcharge progressive.',
    },
    {
      title: 'Repos optimal',
      body: 'Prends 2 à 3 min sur les mouvements polyarticulaires et 60 à 90 s sur les isolations.',
    },
    {
      title: 'Proche de l’échec (1–2 RIR)',
      body: 'Garder 1 à 2 répétitions en réserve maximise l’hypertrophie tout en limitant la fatigue nerveuse.',
    },
    {
      title: 'Hydratation & électrolytes',
      body: 'Une légère déshydratation réduit la force : bois de l’eau avec des électrolytes avant ta séance.',
    },
  ],
  es: [
    {
      title: 'Calentamiento progresivo',
      body: 'Haz 2–3 series de aproximación (50% → 75%) antes de entrar a tu primera serie efectiva.',
    },
    {
      title: 'Controla la fase excéntrica',
      body: 'Baja el peso en 2–3 segundos con control para mayor estímulo muscular y articulaciones sanas.',
    },
    {
      title: 'Progresa más allá del peso',
      body: 'Sumar 1 repetición limpia con la misma carga ya es sobrecarga progresiva real.',
    },
    {
      title: 'Descansa para rendir',
      body: 'Descansa 2–3 min en básicos pesados y 60–90 s en ejercicios de aislamiento.',
    },
    {
      title: 'Cerca del fallo (1–2 RIR)',
      body: 'Dejar 1–2 repeticiones en recámara maximiza la hipertrofia sin agotar el sistema nervioso.',
    },
    {
      title: 'Hidratación y electrolitos',
      body: 'Incluso una ligera deshidratación reduce tu fuerza; hidrátate bien antes de entrenar.',
    },
  ],
};

function getDailyPlanHint(dateKey: string, localeCode: string): { title: string; body: string } {
  const lang = localeCode.slice(0, 2).toLowerCase();
  const pool = DAILY_PLAN_HINTS[lang] || DAILY_PLAN_HINTS.en;
  // Deterministic hash from YYYY-MM-DD so every new calendar day rotates cleanly to a fresh hint
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10) || 0);
  const dayOrdinal = y * 366 + m * 31 + d;
  return pool[Math.abs(dayOrdinal) % pool.length];
}

export const PlanTab: React.FC<PlanTabProps> = ({
  profileId,
  activePlan,
  allPlansCount = 1,
  extraLibraryExercises = EMPTY_EXERCISES,
  bestPRs = EMPTY_PRS,
  onOpenPlanManager,
  onPlanUpdated,
  onLibraryChanged,
  onSelectExerciseForPR,
  onStartWorkoutForDay,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, dayLabel, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();
  const [selectedDayId, setSelectedDayId] = useState<string>('mon');
  const [modalExercise, setModalExercise] = useState<Exercise | null>(null);
  const [editingDay, setEditingDay] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [hintDismissedDate, setHintDismissedDate] = useState<string | null>(null);
  const [hintReady, setHintReady] = useState(false);
  const hintFadeAnim = useRef(new Animated.Value(1)).current;

  const todayKey = getLocalDateKey();
  const hintStorageKey = `@iron_routine:plan_hint_dismissed_${profileId || 'default'}`;
  const dailyHint = useMemo(() => getDailyPlanHint(todayKey, localeCode), [todayKey, localeCode]);
  const isHintVisible = hintReady && hintDismissedDate !== todayKey;

  useEffect(() => {
    let active = true;
    hintFadeAnim.setValue(1);
    AsyncStorage.getItem(hintStorageKey)
      .then((val) => {
        if (!active) return;
        setHintDismissedDate(val || null);
        setHintReady(true);
      })
      .catch(() => {
        if (!active) return;
        setHintReady(true);
      });
    return () => {
      active = false;
    };
  }, [hintStorageKey, hintFadeAnim]);

  const handleDismissDailyHint = () => {
    triggerSelectionHaptic();
    Animated.timing(hintFadeAnim, {
      toValue: 0,
      duration: 165,
      useNativeDriver: true,
    }).start(() => {
      setHintDismissedDate(todayKey);
      AsyncStorage.setItem(hintStorageKey, todayKey).catch(() => {});
    });
  };

  const planDays: DayPlan[] = activePlan?.days?.length ? activePlan.days : WORKOUT_PLAN;

  // Smooth animated transition when switching days
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentSlideAnim = useRef(new Animated.Value(0)).current;

  const handleSelectDay = (dayId: string) => {
    if (dayId === selectedDayId) return;
    triggerSelectionHaptic();

    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(10);
    setSelectedDayId(dayId);

    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(contentSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const currentPlan: DayPlan =
    planDays.find((d) => d.id === selectedDayId) || planDays[0];
  const currentDayMeta =
    DAYS_OF_WEEK.find((d) => d.id === currentPlan.id) || DAYS_OF_WEEK[0];
  const resolvedBannerTag = resolveDayBannerTag(currentPlan);
  const tagMeta = getDayBannerTagMeta(resolvedBannerTag);

  const handleSaveEditedDay = async (updatedDay: DayPlan) => {
    if (!activePlan) return;
    await updateDayInPlan(activePlan.id, updatedDay, profileId);
    await onPlanUpdated?.();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MinimalistBackdrop
        variant="diagonal"
        accentColor="#A855F7"
        secondaryColor="#7C3AED"
        showCornerGlows
      />
      {/* Editorial Title + Plan Switcher */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.title, { color: theme.text }]}>{t('planTitle')}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.libraryBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={async () => {
                if (!activePlan) return;
                triggerSelectionHaptic();
                const currentSettings = await getAppSettings();
                const nextSettings = await updateAppSettings({
                  calendarSyncEnabled: true,
                  remindersSyncEnabled: true,
                });
                const res = await syncWorkoutScheduleWithDevice(activePlan, nextSettings || currentSettings);
                if (res.ok) {
                  triggerNotificationHaptic('success');
                  Alert.alert(
                    t('calendarSyncedSuccessTitle'),
                    t('calendarSyncedSuccessBody', {
                      events: res.eventsCreated,
                      reminders: res.remindersCreated,
                    })
                  );
                } else if (res.error) {
                  Alert.alert(t('errorTitle'), res.error);
                }
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="calendar-outline" size={15} color="#A855F7" />
              <Text style={[styles.libraryBtnText, { color: theme.text }]}>{t('calendarQuickSyncPill')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.libraryBtn,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() => {
                triggerSelectionHaptic();
                setShowLibrary(true);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="barbell-outline" size={16} color={theme.text} />
              <Text style={[styles.libraryBtnText, { color: theme.text }]}>{t('planLibraryBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Day Selector Pills */}
      <View style={[styles.daySelectorWrapper, { borderBottomColor: theme.hairline }]}>
        <ScrollView
          horizontal
          directionalLockEnabled
          alwaysBounceVertical={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          style={styles.daySelectorScrollView}
          contentContainerStyle={styles.daySelectorScroll}
        >
          {DAYS_OF_WEEK.map((day) => {
            const isSelected = day.id === selectedDayId;
            const plan = planDays.find((p) => p.id === day.id);
            const isRest = plan?.type === 'rest';

            return (
              <TouchableOpacity
                key={day.id}
                style={[
                  styles.dayPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.bgSecondary,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => handleSelectDay(day.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayShort,
                    { color: isSelected ? theme.primaryText : theme.text },
                  ]}
                >
                  {dayLabel(day.id, true)}
                </Text>
                <Text
                  style={[
                    styles.daySub,
                    { color: isSelected ? theme.primaryText : theme.textMuted },
                  ]}
                >
                  {isRest ? t('restTagShort') : t('workoutTagShort')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Day Content */}
      <SmartScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.planControlsRow}>
          <TouchableOpacity
            style={[
              styles.planSelectorPill,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              onOpenPlanManager?.();
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="layers-outline" size={15} color={theme.text} />
            <Text style={[styles.planSelectorText, { color: theme.text }]} numberOfLines={1}>
              {activePlan?.name || t('defaultPlanName')}
            </Text>
            <Text style={[styles.planCountBadge, { color: theme.textMuted }]}>
              ({allPlansCount})
            </Text>
            <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.editDayHeaderBtn,
              { backgroundColor: theme.bgSecondary, borderColor: theme.border },
            ]}
            onPress={() => {
              triggerSelectionHaptic();
              setEditingDay(true);
            }}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={15} color={theme.text} />
            <Text style={[styles.editDayHeaderBtnText, { color: theme.text }]}>{t('planEditDayBtn')}</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          }}
        >
        {/* Universal Tagged Monochrome Graphic Banner */}
        <View
          style={[
            styles.monoBannerCard,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}
        >
          <DayBannerArtwork tag={resolvedBannerTag} />

          <View style={styles.monoBannerTop}>
            <View style={[styles.monoBannerBadge, { backgroundColor: theme.primary }]}>
              <Text style={[styles.monoBannerBadgeText, { color: theme.primaryText }]}>
                {tagMeta.badge}
              </Text>
            </View>
            <AnimatedIcon
              name={(tagMeta.icon as any) || (currentPlan.iconName as any) || 'barbell-outline'}
              preset={
                currentPlan.type === 'rest'
                  ? 'moon'
                  : currentPlan.type === 'walk'
                  ? 'footsteps'
                  : 'barbell'
              }
              size={22}
              color={theme.text}
              active
            />
          </View>

          <Text style={[styles.monoBannerTitle, { color: theme.text }]}>
            {currentPlan.name}
          </Text>
          {currentPlan.subtitle ? (
            <Text style={[styles.monoBannerSubtitle, { color: theme.textSecondary }]}>
              {currentPlan.subtitle}
            </Text>
          ) : null}

          <View style={styles.bannerMetaRow}>
            <View style={styles.metaTimeWrap}>
              <Ionicons name="time-outline" size={13} color={theme.textMuted} />
              <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                {currentPlan.time}
              </Text>
            </View>
            {currentPlan.type === 'workout' && (
              <>
                <Text style={[styles.monoMetaDot, { color: theme.textMuted }]}>•</Text>
                <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                  {t('exercisesCountText', { count: currentPlan.exercises?.length || 0 })}
                </Text>
                <Text style={[styles.monoMetaDot, { color: theme.textMuted }]}>•</Text>
                <Text style={[styles.monoMetaText, { color: theme.textSecondary }]}>
                  {(currentPlan.exercises || []).reduce((acc, e) => acc + e.sets, 0)} {t('setsWord')}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Start workout button */}
        {currentPlan.type === 'workout' &&
          currentPlan.exercises &&
          currentPlan.exercises.length > 0 &&
          onStartWorkoutForDay && (
            <TouchableOpacity
              style={[styles.startWorkoutBtn, { backgroundColor: theme.primary }]}
              onPress={() => onStartWorkoutForDay(currentPlan.id)}
              activeOpacity={0.8}
            >
              <AnimatedIcon name="play" preset="pulse" size={16} color={theme.primaryText} active />
              <Text style={[styles.startWorkoutBtnText, { color: theme.primaryText }]}>
                {t('todayStartWorkout').toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}

        {/* Daily Rotating Training Hint Card (dismissible for today via top-right X, returns tomorrow with a new tip) */}
        {isHintVisible ? (
          <Animated.View
            style={[
              styles.warmupNotice,
              {
                backgroundColor: theme.bgSecondary,
                borderColor: theme.border,
                opacity: hintFadeAnim,
                transform: [
                  {
                    scale: hintFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.hintIconBadge}>
              <Ionicons name="bulb-outline" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1, paddingRight: 28 }}>
              <Text style={[styles.warmupTitle, { color: theme.text }]}>{dailyHint.title}</Text>
              <Text style={[styles.warmupDesc, { color: theme.textSecondary }]}>
                {dailyHint.body}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissDailyHint}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.72}
              style={[
                styles.hintCloseBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : 'rgba(15, 23, 42, 0.08)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'rgba(15, 23, 42, 0.12)',
                },
              ]}
            >
              <Ionicons name="close" size={15} color={theme.text} />
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {/* Empty workout day prompt */}
        {currentPlan.type === 'workout' &&
          (!currentPlan.exercises || currentPlan.exercises.length === 0) && (
            <TouchableOpacity
              style={[
                styles.emptyDayCard,
                { backgroundColor: theme.bgSecondary, borderColor: theme.border },
              ]}
              onPress={() => setEditingDay(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="add-circle-outline" size={28} color={theme.text} />
              <Text style={[styles.emptyDayTitle, { color: theme.text }]}>
                {t('emptyDayTitle')}
              </Text>
              <Text style={[styles.emptyDaySub, { color: theme.textMuted }]}>
                {t('emptyDaySub')}
              </Text>
            </TouchableOpacity>
          )}

        {/* Upgraded Athletic Exercise List */}
        {currentPlan.exercises && currentPlan.exercises.length > 0 && (
          <View style={styles.exerciseSection}>
            <View style={[styles.sectionDivider, { borderTopColor: theme.hairline }]}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                {t('exercisesInDayUpper', { count: currentPlan.exercises.length })}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textMuted }]}>
                {t('tapForTechAndPr')}
              </Text>
            </View>

            <DayExercisePreviewList
              exercises={currentPlan.exercises}
              bestPRs={bestPRs}
              onPressExercise={(exercise) => setModalExercise(exercise)}
            />
          </View>
        )}
        </Animated.View>
      </SmartScrollView>

      <ExerciseDetailModal
        visible={modalExercise !== null}
        exercise={modalExercise}
        onClose={() => setModalExercise(null)}
        onOpenPR={onSelectExerciseForPR}
      />

      <PlanDayEditorModal
        visible={editingDay}
        onClose={() => setEditingDay(false)}
        dayPlan={currentPlan}
        dayLabel={currentDayMeta.label}
        extraExercises={extraLibraryExercises}
        onSaveDay={handleSaveEditedDay}
        onLibraryChanged={onLibraryChanged}
      />

      <ExerciseLibraryModal
        visible={showLibrary}
        onClose={() => setShowLibrary(false)}
        mode="manage"
        extraExercises={extraLibraryExercises}
        onLibraryChanged={onLibraryChanged}
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
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  daySelectorWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 16,
    marginTop: 10,
  },
  daySelectorScrollView: {
    flexGrow: 0,
  },
  daySelectorScroll: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  dayPill: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 68,
    gap: 4,
  },
  dayShort: {
    fontSize: 17,
    fontWeight: '900',
  },
  daySub: {
    fontSize: 12,
    fontWeight: '700',
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 92,
  },
  bannerWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 20,
    justifyContent: 'flex-end',
  },
  bannerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  bannerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  bannerSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  bannerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  metaTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bannerMetaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bannerMetaDot: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  warmupNotice: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  hintIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  hintCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  warmupDesc: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  startWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    marginBottom: 22,
  },
  startWorkoutBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  exerciseSection: {
    marginTop: 6,
  },
  sectionDivider: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHint: {
    fontSize: 13,
  },
  exerciseItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 56,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  repsInfo: {
    fontSize: 14,
    fontWeight: '600',
  },
  restTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restPill: {
    fontSize: 13,
    fontWeight: '600',
  },
  expandedContent: {
    paddingTop: 16,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  largeImgWrap: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 14,
  },
  largeImg: {
    width: '100%',
    height: '100%',
  },
  fullImgBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fullImgBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expandedDesc: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 14,
  },
  expandedTip: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    marginBottom: 16,
  },
  expandedTipText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 21,
  },
  prActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  prActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  libraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  libraryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  planControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  planSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  planSelectorText: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  planCountBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  editDayHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  editDayHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  monoBannerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  monoBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monoBannerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  monoBannerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  monoBannerTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 31,
  },
  monoBannerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  monoMetaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  monoMetaDot: {
    fontSize: 11,
  },
  emptyDayCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  emptyDayTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyDaySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
