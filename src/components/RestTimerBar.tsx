import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
  PanResponder,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';

interface RestTimerBarProps {
  initialSeconds: number;
  exerciseName?: string;
  nextSetInfo?: string;
  onSecondsChanged?: (seconds: number) => void;
  onFinishRest: () => void;
  onClose: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  initialSeconds,
  exerciseName,
  nextSetInfo,
  onSecondsChanged,
  onFinishRest,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  // Animations for slide & fade
  const slideAnim = useRef(new Animated.Value(350)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Real gesture-driven PanResponder for interactive swipe-down to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) =>
        gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down enough or with high downward velocity, dismiss
        if (gestureState.dy > 60 || gestureState.vy > 0.4) {
          try {
            Haptics.selectionAsync();
          } catch {}
          Animated.parallel([
            Animated.timing(slideAnim, {
              toValue: 400,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onClose();
          });
        } else {
          // Snap back up smoothly
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const handleExplicitFinish = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinishRest();
    });
  };

  const endTimeRef = useRef<number>(Date.now() + initialSeconds * 1000);
  const pausedRemainingRef = useRef<number | null>(null);

  useEffect(() => {
    endTimeRef.current = Date.now() + initialSeconds * 1000;
    pausedRemainingRef.current = null;
    setSecondsLeft(initialSeconds);
    setIsRunning(true);
    setIsFinished(false);
  }, [initialSeconds]);

  // Synchronize timer with real wall-clock time
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (!isRunning) return;
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) {
        setIsFinished(true);
        setIsRunning(false);
        triggerCompletionFeedback();
      }
    };

    if (isRunning) {
      tick();
      interval = setInterval(tick, 500); // 500ms check for razor-sharp accuracy
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Re-sync immediately when returning from background / unlocking device!
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isRunning) {
        const now = Date.now();
        const diff = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
        setSecondsLeft(diff);
        if (diff <= 0) {
          setIsFinished(true);
          setIsRunning(false);
          triggerCompletionFeedback();
        }
      }
    });

    return () => subscription.remove();
  }, [isRunning]);

  const triggerCompletionFeedback = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const handleTogglePause = () => {
    try {
      Haptics.selectionAsync();
    } catch {}

    if (isRunning) {
      // Pause
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      pausedRemainingRef.current = remaining;
      setSecondsLeft(remaining);
      setIsRunning(false);
    } else {
      // Resume
      const remaining = pausedRemainingRef.current ?? secondsLeft;
      if (remaining <= 0) return;
      endTimeRef.current = Date.now() + remaining * 1000;
      pausedRemainingRef.current = null;
      setIsRunning(true);
      setIsFinished(false);
      onSecondsChanged?.(remaining);
    }
  };

  const adjustTime = (delta: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (isRunning) {
      const now = Date.now();
      const currentRemaining = Math.max(0, Math.ceil((endTimeRef.current - now) / 1000));
      const next = Math.max(0, currentRemaining + delta);
      endTimeRef.current = Date.now() + next * 1000;
      setSecondsLeft(next);
      if (next > 0) setIsFinished(false);
      onSecondsChanged?.(next);
    } else {
      const prev = pausedRemainingRef.current ?? secondsLeft;
      const next = Math.max(0, prev + delta);
      pausedRemainingRef.current = next;
      setSecondsLeft(next);
      if (next > 0) setIsFinished(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        {/* Dim Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Animated Bottom Sheet with PanResponder swipe-down gesture */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Grab handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#444444' : '#D1D5DB' }]} />
            <Text style={[styles.dragHint, { color: theme.textMuted }]}>Przesuń w dół, aby schować (przerwa trwa w tle)</Text>
          </View>

          <View style={styles.content}>
            {/* Header row */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.kicker, { color: isFinished ? theme.text : theme.textMuted }]}>
                  {isFinished ? 'CZAS NA KOLEJNĄ SERIĘ!' : 'ODLICZANIE PRZERWY'}
                </Text>
                <Text numberOfLines={1} style={[styles.exerciseTitle, { color: theme.text }]}>
                  {exerciseName || 'Odpoczynek'}
                </Text>
                {nextSetInfo ? (
                  <Text style={[styles.subInfo, { color: theme.textSecondary }]}>
                    {nextSetInfo}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={handleDismiss}
                style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Giant Digits */}
            <View style={styles.digitsWrapper}>
              <Text
                style={[
                  styles.digits,
                  {
                    color: isFinished ? theme.textMuted : theme.text,
                  },
                ]}
              >
                {formatTime(secondsLeft)}
              </Text>
              <Text style={[styles.digitsSub, { color: theme.textMuted }]}>
                {isFinished ? 'Gotowy do działania?' : 'Złap oddech, napij się wody'}
              </Text>
            </View>

            {/* Time Adjusters Row: -15s | Pauza | +15s */}
            <View style={styles.adjustRow}>
              <TouchableOpacity
                onPress={() => adjustTime(-15)}
                style={[styles.adjustBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: theme.text }]}>-15s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleTogglePause}
                style={[styles.playBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={20}
                  color={theme.text}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => adjustTime(15)}
                style={[styles.adjustBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: theme.text }]}>+15s</Text>
              </TouchableOpacity>
            </View>

            {/* Main Action Button - Sleek neutral gray instead of black */}
            <TouchableOpacity
              onPress={handleExplicitFinish}
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: isDark ? '#27272A' : '#E5E5EA',
                  borderColor: isDark ? '#3F3F46' : '#D1D1D6',
                  borderWidth: 1,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFinished ? 'play' : 'checkmark-done'}
                size={18}
                color={theme.text}
              />
              <Text style={[styles.primaryActionBtnText, { color: theme.text }]}>
                {isFinished ? 'ROZPOCZNIJ SERIĘ' : 'ZAKOŃCZ PRZERWĘ (ZACZNIJ SERIĘ)'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
    paddingBottom: Platform.OS === 'ios' ? 38 : 24,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
  },
  dragHint: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 6,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  exerciseTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: -0.3,
  },
  subInfo: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  digitsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  digits: {
    fontSize: 64,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
  },
  digitsSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  adjustBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  playBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
