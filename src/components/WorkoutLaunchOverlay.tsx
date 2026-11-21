import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { triggerImpactHaptic, triggerNotificationHaptic } from '../services/haptics';

interface WorkoutLaunchOverlayProps {
  visible: boolean;
  workoutName: string;
  firstExerciseName?: string;
  exercisesCount: number;
  totalSets: number;
  isResuming?: boolean;
  onFinished: () => void;
}

/**
 * Sleek ~1.05s kinetic transition choreography bridging "Start Workout"
 * and revealing Set #1 inside ActiveWorkoutView.
 */
export const WorkoutLaunchOverlay: React.FC<WorkoutLaunchOverlayProps> = ({
  visible,
  workoutName,
  firstExerciseName,
  exercisesCount,
  totalSets,
  isResuming = false,
  onFinished,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguage();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.88)).current;
  const ring1Scale = useRef(new Animated.Value(0.6)).current;
  const ring1Opacity = useRef(new Animated.Value(0.75)).current;
  const ring2Scale = useRef(new Animated.Value(0.55)).current;
  const ring2Opacity = useRef(new Animated.Value(0.6)).current;
  const emblemSpin = useRef(new Animated.Value(0)).current;
  const barProgress = useRef(new Animated.Value(0)).current;
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const completeNow = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentScale, {
        toValue: 1.08,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinishedRef.current();
    });
  };

  useEffect(() => {
    if (!visible) return;
    finishedRef.current = false;

    overlayOpacity.setValue(0);
    contentScale.setValue(0.86);
    ring1Scale.setValue(0.62);
    ring1Opacity.setValue(0.78);
    ring2Scale.setValue(0.52);
    ring2Opacity.setValue(0.65);
    emblemSpin.setValue(0);
    barProgress.setValue(0);

    triggerImpactHaptic('light');
    const midHaptic = setTimeout(() => triggerImpactHaptic('medium'), 420);
    const lockHaptic = setTimeout(() => triggerNotificationHaptic('success'), 840);
    const autoEnd = setTimeout(() => completeNow(), 940);

    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(contentScale, {
        toValue: 1,
        friction: 7,
        tension: 95,
        useNativeDriver: true,
      }),
      Animated.timing(emblemSpin, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.back(1.35)),
        useNativeDriver: true,
      }),
      Animated.timing(ring1Scale, {
        toValue: 2.15,
        duration: 860,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(ring1Opacity, {
        toValue: 0,
        duration: 860,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(190),
        Animated.parallel([
          Animated.timing(ring2Scale, {
            toValue: 2.35,
            duration: 780,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Opacity, {
            toValue: 0,
            duration: 780,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.timing(barProgress, {
        toValue: 1,
        duration: 840,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      clearTimeout(midHaptic);
      clearTimeout(lockHaptic);
      clearTimeout(autoEnd);
    };
  }, [
    visible,
    overlayOpacity,
    contentScale,
    ring1Scale,
    ring1Opacity,
    ring2Scale,
    ring2Opacity,
    emblemSpin,
    barProgress,
  ]);

  if (!visible) return null;

  const emblemRotate = emblemSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['-22deg', '0deg'],
  });

  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['6%', '100%'],
  });

  const bgColor = isDark ? 'rgba(7, 9, 14, 0.97)' : 'rgba(248, 250, 252, 0.97)';

  return (
    <Animated.View
      style={[
        styles.overlayRoot,
        {
          backgroundColor: bgColor,
          opacity: overlayOpacity,
        },
      ]}
    >
      {/* Subtle diagonal brand sky-blue ambient sheen */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="launch_sheen" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark ? 0.16 : 0.14} />
              <Stop offset="48%" stopColor="#0EA5E9" stopOpacity={0} />
              <Stop offset="100%" stopColor="#7DD3FC" stopOpacity={isDark ? 0.1 : 0.08} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#launch_sheen)" />
        </Svg>
      </View>

      <Pressable style={styles.centerStage} onPress={completeNow}>
        <Animated.View
          style={[
            styles.cardWrap,
            { transform: [{ scale: contentScale }] },
          ]}
        >
          {/* Pulse Rings + Emblem */}
          <View style={styles.emblemStage}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: '#38BDF8',
                  opacity: ring1Opacity,
                  transform: [{ scale: ring1Scale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: '#7DD3FC',
                  opacity: ring2Opacity,
                  transform: [{ scale: ring2Scale }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.emblemCore,
                {
                  backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                  borderColor: 'rgba(56, 189, 248, 0.55)',
                  transform: [{ rotate: emblemRotate }],
                },
              ]}
            >
              <Ionicons
                name={isResuming ? 'play' : 'barbell'}
                size={34}
                color="#38BDF8"
                style={isResuming ? { marginLeft: 3 } : undefined}
              />
            </Animated.View>
          </View>

          <Text style={styles.kicker}>
            {isResuming ? t('workoutLaunchResume') : t('workoutLaunchReady')}
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {workoutName}
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.metaPill,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                },
              ]}
            >
              <Text style={[styles.metaText, { color: theme.text }]}>
                {t('exercisesCountText', { count: exercisesCount })}
              </Text>
            </View>
            <View
              style={[
                styles.metaPill,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                },
              ]}
            >
              <Text style={[styles.metaText, { color: theme.text }]}>
                {totalSets} {t('setsWord')}
              </Text>
            </View>
          </View>

          {firstExerciseName ? (
            <Text style={[styles.firstExLine, { color: theme.textSecondary }]} numberOfLines={1}>
              #1 · {firstExerciseName}
            </Text>
          ) : null}

          <View
            style={[
              styles.progressTrack,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.09)',
              },
            ]}
          >
            <Animated.View
              style={[
                styles.progressFill,
                { width: barWidth },
              ]}
            />
          </View>
          <Text style={[styles.loadingCaption, { color: theme.textMuted }]}>
            {t('workoutLaunchStarting')}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    elevation: 40,
  },
  centerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 330,
    alignItems: 'center',
  },
  emblemStage: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  pulseRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
  },
  emblemCore: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: '#38BDF8',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  metaPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '800',
  },
  firstExLine: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 22,
    width: '78%',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#38BDF8',
  },
  loadingCaption: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
