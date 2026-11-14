import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';

import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { WORKOUT_PLAN } from './src/data/planData';
import {
  DayPlan,
  DayProgress,
  Exercise,
  NewPRHighlight,
  PRRecord,
  SessionExerciseConfig,
  SetEntry,
  UserProfile,
  WorkoutPlan,
} from './src/types/workout';
import {
  getActiveProfile,
  getActiveWorkoutPlan,
  getAllBestPRs,
  getTodayDayId,
  getWorkoutStreak,
  loadDayProgress,
  markWorkoutCompleted,
  saveSessionExerciseConfig,
  saveSetEntry,
} from './src/services/storage';
import { getAppSettings } from './src/services/settings';
import { triggerNotificationHaptic, triggerSelectionHaptic } from './src/services/haptics';
import {
  handleNotificationResponse,
  setupCreatineNotificationCategories,
  syncRemindersWithSettings,
} from './src/services/notifications';
import {
  startWorkoutLiveActivity,
  stopWorkoutLiveActivity,
} from './src/services/liveActivity';

import { SplashScreen } from './src/components/SplashScreen';
import { OnboardingScreen } from './src/components/OnboardingScreen';
import {
  ActiveWorkoutFinishSummary,
  ActiveWorkoutView,
} from './src/components/ActiveWorkoutView';
import { AppTabKey, BottomTabBar } from './src/components/BottomTabBar';
import { TodayScreen } from './src/screens/TodayScreen';
import { PlanTab } from './src/components/PlanTab';
import { ProgressTab } from './src/components/ProgressTab';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WorkoutSummaryModal } from './src/components/WorkoutSummaryModal';
import { ExerciseDetailModal } from './src/components/ExerciseDetailModal';
import { BodyStatsModal } from './src/components/BodyStatsModal';
import { PlanManagerModal } from './src/components/PlanManagerModal';

function MainApp() {
  const { theme, isDark } = useAppTheme();

  // Startup splash
  const [showSplash, setShowSplash] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<AppTabKey>('today');

  // Tab Transition Animations
  const tabFadeAnim = useRef(new Animated.Value(1)).current;
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  // Single Device Profile, Plans & Shared Canonical Best PRs
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [profilePlans, setProfilePlans] = useState<WorkoutPlan[]>([]);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [bestPRs, setBestPRs] = useState<{ [exerciseId: string]: PRRecord }>({});
  const [showBodyStatsModal, setShowBodyStatsModal] = useState(false);
  const [showPlanManagerModal, setShowPlanManagerModal] = useState(false);
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);

  // Active workout mode
  const [isActiveWorkout, setIsActiveWorkout] = useState(false);
  const [activeWorkoutDayId, setActiveWorkoutDayId] = useState<string>(getTodayDayId());
  const [autoOpenSessionPicker, setAutoOpenSessionPicker] = useState(false);

  // Today / Active Workout Progress Data
  const [todayDayId] = useState<string>(getTodayDayId());
  const [dayProgress, setDayProgress] = useState<DayProgress>({ sets: {} });
  const [streak, setStreak] = useState<number>(0);

  // Monotonic write sequence guard prevents out-of-order AsyncStorage state reverts on typing
  const setWriteSeqRef = useRef(0);

  // Exercise Detail Modal
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Summary Modal
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryDayName, setSummaryDayName] = useState('');
  const [summaryCompletedSets, setSummaryCompletedSets] = useState(0);
  const [summaryTotalSets, setSummaryTotalSets] = useState(0);
  const [summaryDurationMinutes, setSummaryDurationMinutes] = useState<number | undefined>(undefined);
  const [summaryVolumeKg, setSummaryVolumeKg] = useState<number | undefined>(undefined);
  const [summaryNewPRs, setSummaryNewPRs] = useState<NewPRHighlight[]>([]);

  useEffect(() => {
    activateKeepAwakeAsync();
    setupCreatineNotificationCategories();

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });

    return () => {
      deactivateKeepAwake();
      responseSubscription.remove();
    };
  }, []);

  const loadUserWorkspace = useCallback(
    async (profile: UserProfile | null) => {
      if (!profile) {
        setProfilePlans([]);
        setActivePlan(null);
        setBestPRs({});
        setStreak(0);
        setDayProgress({ sets: {} });
        return;
      }

      const [{ plans, activePlan: ap }, curStreak, prog, prs] = await Promise.all([
        getActiveWorkoutPlan(profile.id),
        getWorkoutStreak(profile.id),
        loadDayProgress(todayDayId, undefined, profile.id),
        getAllBestPRs(profile.id),
      ]);

      setProfilePlans(plans);
      setActivePlan(ap);
      setStreak(curStreak);
      setDayProgress(prog);
      setBestPRs(prs);
    },
    [todayDayId]
  );

  const initApp = useCallback(async () => {
    try {
      const [settings, current] = await Promise.all([
        getAppSettings(),
        getActiveProfile(),
      ]);
      syncRemindersWithSettings(settings);
      setActiveProfile(current);
      await loadUserWorkspace(current);
    } catch (e) {
      console.warn('Initialization error', e);
    }
  }, [loadUserWorkspace]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const handleSwitchTab = (targetTab: AppTabKey) => {
    if (targetTab === activeTab) return;
    triggerSelectionHaptic();

    tabFadeAnim.setValue(0);
    tabSlideAnim.setValue(10);
    setActiveTab(targetTab);

    Animated.parallel([
      Animated.timing(tabFadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(tabSlideAnim, {
        toValue: 0,
        friction: 8,
        tension: 55,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleOnboardingComplete = async (profile: UserProfile) => {
    setActiveProfile(profile);
    await loadUserWorkspace(profile);
    const settings = await getAppSettings();
    syncRemindersWithSettings(settings);
    setProgressRefreshKey((k) => k + 1);
  };

  const handlePlansUpdated = async () => {
    if (!activeProfile) return;
    const { plans, activePlan: ap } = await getActiveWorkoutPlan(activeProfile.id);
    setProfilePlans(plans);
    setActivePlan(ap);
    setProgressRefreshKey((k) => k + 1);
  };

  const handleFullDataRefresh = async () => {
    const current = await getActiveProfile();
    setActiveProfile(current);
    await loadUserWorkspace(current);
    setProgressRefreshKey((k) => k + 1);
  };

  const handleAppReset = () => {
    setIsActiveWorkout(false);
    setShowBodyStatsModal(false);
    setShowPlanManagerModal(false);
    setShowSummaryModal(false);
    setPreviewExercise(null);
    setActiveTab('today');
    setActiveProfile(null);
    setProfilePlans([]);
    setActivePlan(null);
    setBestPRs({});
    setStreak(0);
    setDayProgress({ sets: {} });
  };

  const handleUpdateSet = async (
    exerciseId: string,
    setIndex: number,
    data: Partial<SetEntry>,
    _restSeconds: number
  ) => {
    if (!activeProfile) return;

    const seq = ++setWriteSeqRef.current;

    // Immediate synchronous UI state update prevents text input bounce/reset while typing
    setDayProgress((prev) => {
      const nextSets = { ...prev.sets };
      const exSets = { ...(nextSets[exerciseId] || {}) };
      const existing = exSets[setIndex] || { completed: false };
      exSets[setIndex] = { ...existing, ...data };
      nextSets[exerciseId] = exSets;
      return { ...prev, sets: nextSets };
    });

    try {
      const updated = await saveSetEntry(
        activeWorkoutDayId,
        exerciseId,
        setIndex,
        data,
        undefined,
        activeProfile.id
      );
      if (seq === setWriteSeqRef.current) {
        setDayProgress(updated);
      }
    } catch (e) {
      console.error('Error saving set', e);
    }
  };

  const handleSaveSessionConfig = async (config: SessionExerciseConfig) => {
    if (!activeProfile) return;
    setDayProgress((prev) => ({ ...prev, sessionConfig: config }));
    try {
      await saveSessionExerciseConfig(activeWorkoutDayId, config, undefined, activeProfile.id);
    } catch (e) {
      console.error('Error saving session config', e);
    }
  };

  const planDays: DayPlan[] = activePlan?.days?.length ? activePlan.days : WORKOUT_PLAN;

  const handleStartWorkout = async (dayId?: string) => {
    const targetDay = dayId || todayDayId;
    const plan = planDays.find((p) => p.id === targetDay);
    if (!plan || !plan.exercises || plan.exercises.length === 0) return;

    let prog: DayProgress = dayProgress;
    if (activeProfile) {
      prog = await loadDayProgress(targetDay, undefined, activeProfile.id);
      setDayProgress(prog);
    }

    let completedInSession = 0;
    for (const setsMap of Object.values(prog.sets || {})) {
      for (const entry of Object.values(setsMap)) {
        if (entry?.completed) completedInSession++;
      }
    }

    setActiveWorkoutDayId(targetDay);
    setAutoOpenSessionPicker(!prog.sessionConfig && completedInSession === 0);
    setIsActiveWorkout(true);

    const firstEx = plan.exercises[0];
    const total = plan.exercises.reduce((sum, e) => sum + e.sets, 0);
    startWorkoutLiveActivity({
      workoutName: plan.name,
      exerciseName: firstEx.name,
      currentSet: 1,
      totalSets: firstEx.sets,
      completedSets: completedInSession,
      totalWorkoutSets: total,
    });
  };

  const handleExitWorkout = async () => {
    await stopWorkoutLiveActivity({
      summaryTitle: 'Trening przerwany',
      summarySubtitle: 'Sesja została zakończona',
    });
    setIsActiveWorkout(false);
    if (activeProfile && activeWorkoutDayId !== todayDayId) {
      const todayProg = await loadDayProgress(todayDayId, undefined, activeProfile.id);
      setDayProgress(todayProg);
    }
  };

  const handleFinishWorkout = async (summary?: ActiveWorkoutFinishSummary) => {
    const workoutDayPlan = planDays.find((p) => p.id === activeWorkoutDayId);
    if (!workoutDayPlan) return;

    const exercises = summary?.exercises || workoutDayPlan.exercises || [];
    const total = summary?.totalSets ?? exercises.reduce((sum, e) => sum + e.sets, 0);
    let done = summary?.completedSets ?? 0;
    if (summary?.completedSets === undefined) {
      for (const e of exercises) {
        const exSets = dayProgress.sets[e.id] || {};
        done += Object.values(exSets).filter((s) => s?.completed).length;
      }
    }

    let totalVolumeKg = summary?.totalVolumeKg || 0;
    let newPRs: NewPRHighlight[] = [];

    if (activeProfile) {
      const completedMeta = await markWorkoutCompleted(
        activeWorkoutDayId,
        workoutDayPlan.name,
        done,
        total,
        undefined,
        activeProfile.id,
        {
          planId: activePlan?.id,
          planName: activePlan?.name,
          durationMinutes: summary?.durationMinutes,
          exercises,
          setsMap: dayProgress.sets,
        }
      );
      totalVolumeKg = completedMeta.totalVolumeKg || totalVolumeKg;
      newPRs = completedMeta.newPRs || [];

      const [curStreak, updatedPRs] = await Promise.all([
        getWorkoutStreak(activeProfile.id),
        getAllBestPRs(activeProfile.id),
      ]);
      setStreak(curStreak);
      setBestPRs(updatedPRs);
      setProgressRefreshKey((k) => k + 1);

      if (activeWorkoutDayId !== todayDayId) {
        const todayProg = await loadDayProgress(todayDayId, undefined, activeProfile.id);
        setDayProgress(todayProg);
      }
    }

    await stopWorkoutLiveActivity({
      summaryTitle: 'Trening ukończony!',
      summarySubtitle: `${done} z ${total} serii zaliczonych`,
    });

    setSummaryDayName(workoutDayPlan.name);
    setSummaryCompletedSets(done);
    setSummaryTotalSets(total);
    setSummaryDurationMinutes(summary?.durationMinutes);
    setSummaryVolumeKg(totalVolumeKg);
    setSummaryNewPRs(newPRs);
    setIsActiveWorkout(false);
    setShowSummaryModal(true);

    triggerNotificationHaptic('success');
  };

  const currentPlan = planDays.find((p) => p.id === todayDayId) || planDays[0];
  const activeWorkoutPlan = planDays.find((p) => p.id === activeWorkoutDayId) || planDays[0];
  const extraLibraryExercises = profilePlans.flatMap((p) =>
    p.days.flatMap((d) => d.exercises || [])
  );

  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </View>
    );
  }

  if (!activeProfile) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.bg }]}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <OnboardingScreen onCompleted={handleOnboardingComplete} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (isActiveWorkout) {
    return (
      <SafeAreaProvider>
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor: theme.bg }]}
          edges={['top', 'left', 'right']}
        >
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <ActiveWorkoutView
            dayPlan={activeWorkoutPlan}
            profileId={activeProfile.id}
            extraLibraryExercises={extraLibraryExercises}
            dayProgress={dayProgress}
            autoOpenSessionPicker={autoOpenSessionPicker}
            onUpdateSet={handleUpdateSet}
            onSaveSessionConfig={handleSaveSessionConfig}
            onFinishWorkout={handleFinishWorkout}
            onExitWorkout={handleExitWorkout}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.bg }]}
        edges={['top', 'left', 'right']}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />

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
          {activeTab === 'today' && (
            <TodayScreen
              activeProfile={activeProfile}
              activePlan={activePlan}
              currentPlan={currentPlan}
              dayProgress={dayProgress}
              streak={streak}
              bestPRs={bestPRs}
              onOpenPlanManager={() => setShowPlanManagerModal(true)}
              onOpenBodyStats={() => setShowBodyStatsModal(true)}
              onStartWorkout={(dayId) => handleStartWorkout(dayId)}
              onOpenExerciseDetail={(ex) => setPreviewExercise(ex)}
              onSwitchToPlanTab={() => handleSwitchTab('plan')}
            />
          )}

          {activeTab === 'plan' && (
            <PlanTab
              profileId={activeProfile.id}
              activePlan={activePlan}
              allPlansCount={profilePlans.length}
              extraLibraryExercises={extraLibraryExercises}
              bestPRs={bestPRs}
              onOpenPlanManager={() => setShowPlanManagerModal(true)}
              onPlanUpdated={handlePlansUpdated}
              onLibraryChanged={() => setProgressRefreshKey((k) => k + 1)}
              onSelectExerciseForPR={() => handleSwitchTab('progress')}
              onStartWorkoutForDay={(dayId) => handleStartWorkout(dayId)}
            />
          )}

          {activeTab === 'progress' && (
            <ProgressTab
              activeProfile={activeProfile}
              activePlan={activePlan}
              profilePlans={profilePlans}
              refreshKey={progressRefreshKey}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsScreen
              activeProfile={activeProfile}
              onProfileUpdated={(updated) => {
                setActiveProfile(updated);
                setProgressRefreshKey((k) => k + 1);
              }}
              onDataImported={handleFullDataRefresh}
              onLibraryChanged={() => setProgressRefreshKey((k) => k + 1)}
              onAppReset={handleAppReset}
            />
          )}
        </Animated.View>

        {/* Extracted 4-Tab Bottom Navigation Bar */}
        <BottomTabBar activeTab={activeTab} onSelectTab={handleSwitchTab} />

        {/* Plan Manager Modal (replaces old Profile Switcher) */}
        {activePlan && (
          <PlanManagerModal
            visible={showPlanManagerModal}
            onClose={() => setShowPlanManagerModal(false)}
            activeProfile={activeProfile}
            plans={profilePlans}
            activePlan={activePlan}
            onPlansUpdated={handlePlansUpdated}
          />
        )}

        {/* Body Stats & Weigh-in Reminder Modal */}
        <BodyStatsModal
          visible={showBodyStatsModal}
          profile={activeProfile}
          onClose={() => setShowBodyStatsModal(false)}
          onProfileUpdated={(updated: UserProfile) => {
            setActiveProfile(updated);
            setProgressRefreshKey((k) => k + 1);
          }}
        />

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
          durationMinutes={summaryDurationMinutes}
          totalVolumeKg={summaryVolumeKg}
          newPRs={summaryNewPRs}
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
});
