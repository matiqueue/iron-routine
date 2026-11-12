import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';

import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { WORKOUT_PLAN } from './src/data/planData';
import { DayPlan, Exercise, UserProfile, SetEntry } from './src/types/workout';
import {
  getProfiles,
  getActiveProfile,
  setActiveProfileId,
  createProfile,
  loadDayProgress,
  saveSetEntry,
  markWorkoutCompleted,
  getTodayDayId,
  getWorkoutStreak,
} from './src/services/storage';

import { SplashScreen } from './src/components/SplashScreen';
import { ProfileSelectorModal } from './src/components/ProfileSelectorModal';
import { HoldToStartButton } from './src/components/HoldToStartButton';
import { ActiveWorkoutView } from './src/components/ActiveWorkoutView';
import { PlanTab } from './src/components/PlanTab';
import { ProgressTab } from './src/components/ProgressTab';
import { RestDayView } from './src/components/RestDayView';
import { WorkoutSummaryModal } from './src/components/WorkoutSummaryModal';
import { ExerciseDetailModal } from './src/components/ExerciseDetailModal';

type TabType = 'today' | 'plan' | 'progress';

function MainApp() {
  const { theme, isDark, toggleTheme } = useAppTheme();

  // Startup splash
  const [showSplash, setShowSplash] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('today');

  // Tab Transition Animations
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  // Bottom tab icon bounce animations
  const todayScale = useRef(new Animated.Value(1)).current;
  const planScale = useRef(new Animated.Value(1)).current;
  const progressScale = useRef(new Animated.Value(1)).current;

  // Profiles
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Active workout mode
  const [isActiveWorkout, setIsActiveWorkout] = useState(false);
  const [activeWorkoutDayId, setActiveWorkoutDayId] = useState<string>(getTodayDayId());

  // Today Progress Data
  const [todayDayId, setTodayDayId] = useState<string>(getTodayDayId());
  const [dayProgress, setDayProgress] = useState<{
    sets: { [exerciseId: string]: { [setIndex: number]: SetEntry } };
  }>({ sets: {} });
  const [streak, setStreak] = useState<number>(0);

  // Exercise Detail Modal from Today Tab
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Summary Modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryDayName, setSummaryDayName] = useState('');
  const [summaryCompletedSets, setSummaryCompletedSets] = useState(0);
  const [summaryTotalSets, setSummaryTotalSets] = useState(0);

  useEffect(() => {
    activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  const initApp = useCallback(async () => {
    try {
      const allProfiles = await getProfiles();
      const current = await getActiveProfile();
      setProfiles(allProfiles);
      setActiveProfile(current);

      const curStreak = await getWorkoutStreak(current.id);
      setStreak(curStreak);

      const prog = await loadDayProgress(todayDayId, undefined, current.id);
      setDayProgress(prog);
    } catch (e) {
      console.warn('Initialization error', e);
    }
  }, [todayDayId]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Tab Switching with smooth fade & slide animation
  const handleSwitchTab = (targetTab: TabType) => {
    if (targetTab === activeTab) return;
    Haptics.selectionAsync();

    // Trigger icon bounce
    const scaleRef =
      targetTab === 'today'
        ? todayScale
        : targetTab === 'plan'
        ? planScale
        : progressScale;

    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(scaleRef, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();

    // Fade out and in
    tabFadeAnim.setValue(0);
    tabSlideAnim.setValue(12);
    setActiveTab(targetTab);

    Animated.parallel([
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(tabSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelectProfile = async (profile: UserProfile) => {
    await setActiveProfileId(profile.id);
    setActiveProfile(profile);
    const curStreak = await getWorkoutStreak(profile.id);
    setStreak(curStreak);
    const prog = await loadDayProgress(activeWorkoutDayId, undefined, profile.id);
    setDayProgress(prog);
  };

  const handleCreateProfile = async (name: string) => {
    const newProfile = await createProfile(name);
    const updatedProfiles = await getProfiles();
    setProfiles(updatedProfiles);
    setActiveProfile(newProfile);
    const prog = await loadDayProgress(activeWorkoutDayId, undefined, newProfile.id);
    setDayProgress(prog);
  };

  const refreshDayProgress = useCallback(
    async (dayId: string) => {
      if (!activeProfile) return;
      const prog = await loadDayProgress(dayId, undefined, activeProfile.id);
      setDayProgress(prog);
    },
    [activeProfile]
  );

  const handleUpdateSet = async (
    exerciseId: string,
    setIndex: number,
    data: Partial<SetEntry>,
    restSeconds: number
  ) => {
    if (!activeProfile) return;
    try {
      const updated = await saveSetEntry(
        activeWorkoutDayId,
        exerciseId,
        setIndex,
        data,
        undefined,
        activeProfile.id
      );
      setDayProgress(updated);
    } catch (e) {
      console.error('Error saving set', e);
    }
  };

  const handleStartWorkout = (dayId?: string) => {
    const targetDay = dayId || todayDayId;
    setActiveWorkoutDayId(targetDay);
    refreshDayProgress(targetDay);
    setIsActiveWorkout(true);
  };

  const handleFinishWorkout = async () => {
    const currentPlan = WORKOUT_PLAN.find((p) => p.id === activeWorkoutDayId);
    if (!currentPlan) return;

    const exercises = currentPlan.exercises || [];
    const total = exercises.reduce((sum, e) => sum + e.sets, 0);
    let done = 0;
    for (const e of exercises) {
      const exSets = dayProgress.sets[e.id] || {};
      done += Object.values(exSets).filter((s) => s?.completed).length;
    }

    if (activeProfile) {
      await markWorkoutCompleted(
        activeWorkoutDayId,
        currentPlan.name,
        done,
        total,
        undefined,
        activeProfile.id
      );
      const curStreak = await getWorkoutStreak(activeProfile.id);
      setStreak(curStreak);
    }

    setSummaryDayName(currentPlan.name);
    setSummaryCompletedSets(done);
    setSummaryTotalSets(total);
    setIsActiveWorkout(false);
    setShowSummaryModal(true);

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const currentPlan = WORKOUT_PLAN.find((p) => p.id === todayDayId) || WORKOUT_PLAN[0];
  const activeWorkoutPlan =
    WORKOUT_PLAN.find((p) => p.id === activeWorkoutDayId) || WORKOUT_PLAN[0];

  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </View>
    );
  }

  if (isActiveWorkout) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <ActiveWorkoutView
            dayPlan={activeWorkoutPlan}
            dayProgress={dayProgress}
            onUpdateSet={handleUpdateSet}
            onFinishWorkout={handleFinishWorkout}
            onExitWorkout={() => setIsActiveWorkout(false)}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'left', 'right']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />

        {/* Top Header Bar */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dateLabel, { color: theme.textMuted }]}>
              {new Date().toLocaleDateString('pl-PL', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).toUpperCase()}
            </Text>
            <Text style={[styles.greeting, { color: theme.text }]}>
              Cześć, {activeProfile?.name?.split(' ')[0] || 'Szymon'}
            </Text>
          </View>

          {/* Header Action Buttons */}
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.actionIconBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={toggleTheme}
              activeOpacity={0.7}
              accessibilityLabel="Przełącz motyw"
            >
              <Ionicons
                name={isDark ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.profilePill, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={() => setShowProfileModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={17} color={theme.text} />
              <Text style={[styles.profilePillText, { color: theme.text }]} numberOfLines={1}>
                {activeProfile?.name?.split(' ')[0] || 'Profil'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Animated Tab View Container */}
        <Animated.View
          style={[
            styles.animatedTabContainer,
            {
              opacity: tabFadeAnim,
              transform: [{ translateY: tabSlideAnim }],
            },
          ]}
        >
          {/* TAB 1: TODAY / TRENING */}
          {activeTab === 'today' && (
            <ScrollView
              style={styles.tabScroll}
              contentContainerStyle={styles.tabContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Streak Ribbon */}
              <View style={[styles.streakRibbon, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                <View style={styles.streakLeft}>
                  <View style={[styles.streakIconWrap, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Ionicons name="flame" size={20} color={theme.text} />
                  </View>
                  <View>
                    <Text style={[styles.streakTitle, { color: theme.text }]}>
                      {streak} dni serii treningowej
                    </Text>
                    <Text style={[styles.streakSub, { color: theme.textMuted }]}>
                      Czysta dyscyplina, utrzymaj rytm
                    </Text>
                  </View>
                </View>
              </View>

              {/* Rest Day View or Workout Day */}
              {currentPlan.type === 'rest' ? (
                <RestDayView dayPlan={currentPlan} />
              ) : (
                <>
                  {/* Hero Workout Banner */}
                  <View style={styles.heroBanner}>
                    {currentPlan.bannerUrl ? (
                      <Image
                        source={{ uri: currentPlan.bannerUrl }}
                        style={styles.heroBannerImage}
                        resizeMode="cover"
                      />
                    ) : null}

                    <View
                      style={[
                        styles.heroBannerOverlay,
                        { backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.52)' },
                      ]}
                    >
                      <View style={styles.heroTagRow}>
                        <View style={styles.heroTag}>
                          <Text style={styles.heroTagText}>DZISIEJSZY TRENING</Text>
                        </View>
                        <View style={styles.heroTimeWrap}>
                          <Ionicons name="time-outline" size={13} color="#FFFFFF" />
                          <Text style={styles.heroTimeText}>{currentPlan.time}</Text>
                        </View>
                      </View>

                      <Text style={styles.heroTitle}>{currentPlan.name}</Text>
                      <Text style={styles.heroSubtitle}>{currentPlan.subtitle}</Text>

                      {currentPlan.exercises && (
                        <View style={styles.heroMetaLine}>
                          <Text style={styles.heroMetaItem}>
                            {currentPlan.exercises.length} ćwiczeń
                          </Text>
                          <Text style={styles.heroMetaDot}>•</Text>
                          <Text style={styles.heroMetaItem}>
                            {currentPlan.exercises.reduce((acc, e) => acc + e.sets, 0)} serii
                          </Text>
                          <Text style={styles.heroMetaDot}>•</Text>
                          <Text style={styles.heroMetaItem}>~75 min</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Warmup tip if available */}
                  {currentPlan.warmup ? (
                    <View style={[styles.warmupCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                      <Ionicons name="information-circle-outline" size={20} color={theme.text} style={{ marginTop: 1 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.warmupHeader, { color: theme.text }]}>
                          Rozgrzewka i mobilizacja
                        </Text>
                        <Text style={[styles.warmupBody, { color: theme.textSecondary }]}>
                          {currentPlan.warmup}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* HOLD TO START BUTTON */}
                  <HoldToStartButton
                    onComplete={() => handleStartWorkout(todayDayId)}
                    title="PRZYTRZYMAJ, ABY ZACZĄĆ"
                    subtitle="Dotknij i przytrzymaj, aby uruchomić tryb treningu"
                  />

                  {/* Clean Visual Flat List of Today's Exercises (NO THUMBNAILS - spacious and airy) */}
                  {currentPlan.exercises && (
                    <View style={styles.todayExercises}>
                      <View style={[styles.sectionDivider, { borderTopColor: theme.hairline }]}>
                        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
                          ĆWICZENIA W DZISIEJSZYM BLOKU ({currentPlan.exercises.length})
                        </Text>
                        <TouchableOpacity onPress={() => handleSwitchTab('plan')}>
                          <Text style={[styles.sectionAction, { color: theme.text }]}>
                            Tydzień →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {currentPlan.exercises.map((ex) => (
                        <TouchableOpacity
                          key={ex.id}
                          style={[styles.flatExRow, { borderBottomColor: theme.hairline }]}
                          onPress={() => setPreviewExercise(ex)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.flatExMain}>
                            <Text style={[styles.flatExTitle, { color: theme.text }]}>
                              {ex.name}
                            </Text>
                            <View style={styles.exSubRow}>
                              <View style={[styles.catBadge, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
                                <Text style={[styles.catBadgeText, { color: theme.textSecondary }]}>
                                  {ex.category.toUpperCase()}
                                </Text>
                              </View>
                              <Text style={[styles.flatExSub, { color: theme.textSecondary }]}>
                                {ex.sets} serie × {ex.reps}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.exRowRight}>
                            <View style={styles.restTagWrap}>
                              <Ionicons name="time-outline" size={13} color={theme.textMuted} />
                              <Text style={[styles.restTag, { color: theme.textMuted }]}>
                                {ex.rest}s
                              </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={17} color={theme.textMuted} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}

          {/* TAB 2: PLAN TYGODNIOWY */}
          {activeTab === 'plan' && (
            <PlanTab
              onSelectExerciseForPR={() => handleSwitchTab('progress')}
              onStartWorkoutForDay={(dayId) => handleStartWorkout(dayId)}
            />
          )}

          {/* TAB 3: OSIĄGI (MERITUM) */}
          {activeTab === 'progress' && (
            <ProgressTab
              activeProfile={activeProfile || { id: 'szymon_goral', name: 'Szymon Góral (ja)', createdAt: '' }}
              onOpenProfileModal={() => setShowProfileModal(true)}
            />
          )}
        </Animated.View>

        {/* BOTTOM NAVIGATION BAR WITH ANIMATED ICONS */}
        <View style={[styles.bottomBar, { backgroundColor: theme.bg, borderTopColor: theme.hairline }]}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleSwitchTab('today')}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ scale: todayScale }] }}>
              <Ionicons
                name={activeTab === 'today' ? 'barbell' : 'barbell-outline'}
                size={23}
                color={activeTab === 'today' ? theme.text : theme.textMuted}
              />
            </Animated.View>
            <Text
              style={[
                styles.navLabel,
                { color: activeTab === 'today' ? theme.text : theme.textMuted },
                activeTab === 'today' && { fontWeight: '900' },
              ]}
            >
              Trening
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleSwitchTab('plan')}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ scale: planScale }] }}>
              <Ionicons
                name={activeTab === 'plan' ? 'calendar' : 'calendar-outline'}
                size={23}
                color={activeTab === 'plan' ? theme.text : theme.textMuted}
              />
            </Animated.View>
            <Text
              style={[
                styles.navLabel,
                { color: activeTab === 'plan' ? theme.text : theme.textMuted },
                activeTab === 'plan' && { fontWeight: '900' },
              ]}
            >
              Plan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => handleSwitchTab('progress')}
            activeOpacity={0.7}
          >
            <Animated.View style={{ transform: [{ scale: progressScale }] }}>
              <Ionicons
                name={activeTab === 'progress' ? 'trophy' : 'trophy-outline'}
                size={23}
                color={activeTab === 'progress' ? theme.text : theme.textMuted}
              />
            </Animated.View>
            <Text
              style={[
                styles.navLabel,
                { color: activeTab === 'progress' ? theme.text : theme.textMuted },
                activeTab === 'progress' && { fontWeight: '900' },
              ]}
            >
              Osiągi
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Modal */}
        {activeProfile && (
          <ProfileSelectorModal
            visible={showProfileModal}
            profiles={profiles}
            activeProfile={activeProfile}
            onSelectProfile={handleSelectProfile}
            onCreateProfile={handleCreateProfile}
            onClose={() => setShowProfileModal(false)}
          />
        )}

        {/* Exercise Preview Modal from Today */}
        <ExerciseDetailModal
          visible={previewExercise !== null}
          exercise={previewExercise}
          onClose={() => setPreviewExercise(null)}
          onOpenPR={() => {
            setPreviewExercise(null);
            handleSwitchTab('progress');
          }}
        />

        {/* Workout Complete Modal */}
        <WorkoutSummaryModal
          visible={showSummaryModal}
          dayName={summaryDayName}
          completedSets={summaryCompletedSets}
          totalSets={summaryTotalSets}
          onClose={() => setShowSummaryModal(false)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  animatedTabContainer: {
    flex: 1,
  },
  tabScroll: {
    flex: 1,
  },
  tabContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 95,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    maxWidth: 140,
  },
  profilePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  streakRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  streakSub: {
    fontSize: 12,
    marginTop: 2,
  },
  heroBanner: {
    width: '100%',
    height: 195,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  heroBannerImage: {
    width: '100%',
    height: '100%',
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFill,
    padding: 20,
    justifyContent: 'flex-end',
  },
  heroTagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heroTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  heroTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 3,
  },
  heroMetaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  heroMetaItem: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  heroMetaDot: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  warmupCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  warmupHeader: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  warmupBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  todayExercises: {
    marginTop: 22,
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
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  flatExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
    minHeight: 74,
  },
  flatExMain: {
    flex: 1,
  },
  flatExTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
    marginBottom: 5,
  },
  exSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  flatExSub: {
    fontSize: 13,
    fontWeight: '600',
  },
  exRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 82 : 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 22 : 6,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
