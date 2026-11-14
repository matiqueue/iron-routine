import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAppTheme } from '../context/ThemeContext';
import { AnimatedIcon } from './AnimatedIcon';
import {
  triggerImpactHaptic,
  triggerNotificationHaptic,
  triggerSelectionHaptic,
} from '../services/haptics';

interface RestTimerBarProps {
  initialSeconds: number;
  targetEndTimeMs?: number;
  isPaused?: boolean;
  exerciseName?: string;
  nextSetInfo?: string;
  onSecondsChanged?: (seconds: number, paused: boolean) => void;
  onPauseToggle?: (paused: boolean, remainingSeconds: number) => void;
  onStopImmediate?: () => void;
  onFinishRest: () => void;
  onClose: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  initialSeconds,
  targetEndTimeMs,
  isPaused = false,
  exerciseName,
  nextSetInfo,
  onSecondsChanged,
  onPauseToggle,
  onStopImmediate,
  onFinishRest,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(!isPaused && initialSeconds > 0);
  const [isFinished, setIsFinished] = useState(!isPaused && initialSeconds <= 0);

  const slideAnim = useRef(new Animated.Value(360)).current;
  const isDismissingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const backdropOpacity = useMemo(
    () =>
      slideAnim.interpolate({
        inputRange: [0, 320],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [slideAnim]
  );

  const animateHide = useCallback(() => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    Animated.timing(slideAnim, {
      toValue: 420,
      duration: 185,
      useNativeDriver: true,
    }).start(() => {
      onCloseRef.current();
    });
  }, [slideAnim]);

  const snapBack = useCallback(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 26,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  // Claims non-button touches immediately on touch-down; captures downward drags even over buttons
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isDismissingRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !isDismissingRef.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.05,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        !isDismissingRef.current && g.dy > 5 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
      onPanResponderMove: (_, g) => {
        slideAnim.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 55 || g.vy > 0.35) {
          triggerSelectionHaptic();
          animateHide();
          return;
        }
        snapBack();
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: snapBack,
    })
  ).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 24,
      stiffness: 280,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const handleExplicitFinish = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    setIsRunning(false);
    setIsFinished(false);
    onStopImmediate?.();
    triggerNotificationHaptic('success');
    Animated.timing(slideAnim, {
      toValue: 420,
      duration: 165,
      useNativeDriver: true,
    }).start(() => {
      onFinishRest();
    });
  };

  const endTimeRef = useRef<number>(targetEndTimeMs ?? Date.now() + initialSeconds * 1000);
  const pausedRemainingRef = useRef<number | null>(isPaused ? initialSeconds : null);

  useEffect(() => {
    if (isPaused) {
      pausedRemainingRef.current = initialSeconds;
      endTimeRef.current = 0;
      setSecondsLeft(initialSeconds);
      setIsRunning(false);
      setIsFinished(false);
      return;
    }

    const resolvedEnd = targetEndTimeMs ?? Date.now() + initialSeconds * 1000;
    endTimeRef.current = resolvedEnd;
    pausedRemainingRef.current = null;
    const rem = Math.max(0, Math.ceil((resolvedEnd - Date.now()) / 1000));
    setSecondsLeft(rem);
    setIsRunning(rem > 0);
    setIsFinished(rem <= 0);
  }, [initialSeconds, targetEndTimeMs, isPaused]);

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const diff = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) {
        setIsFinished(true);
        setIsRunning(false);
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isRunning && endTimeRef.current > 0) {
        const diff = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
        setSecondsLeft(diff);
        if (diff <= 0) {
          setIsFinished(true);
          setIsRunning(false);
        }
      }
    });

    return () => subscription.remove();
  }, [isRunning]);

  const handleTogglePause = () => {
    triggerSelectionHaptic();

    if (isRunning) {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      pausedRemainingRef.current = remaining;
      endTimeRef.current = 0;
      setSecondsLeft(remaining);
      setIsRunning(false);
      onPauseToggle?.(true, remaining);
    } else {
      const remaining = pausedRemainingRef.current ?? secondsLeft;
      if (remaining <= 0) return;
      endTimeRef.current = Date.now() + remaining * 1000;
      pausedRemainingRef.current = null;
      setIsRunning(true);
      setIsFinished(false);
      onPauseToggle?.(false, remaining);
    }
  };

  const adjustTime = (delta: number) => {
    triggerImpactHaptic('light');

    if (isRunning) {
      const currentRemaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      const next = Math.max(0, currentRemaining + delta);
      endTimeRef.current = Date.now() + next * 1000;
      setSecondsLeft(next);
      setIsFinished(next <= 0);
      if (next <= 0) setIsRunning(false);
      onSecondsChanged?.(next, false);
    } else {
      const prev = pausedRemainingRef.current ?? secondsLeft;
      const next = Math.max(0, prev + delta);
      pausedRemainingRef.current = next;
      setSecondsLeft(next);
      setIsFinished(false);
      onSecondsChanged?.(next, true);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={animateHide}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={animateHide}
          />
        </Animated.View>

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
          <View style={styles.handleWrap}>
            <View style={[styles.handleBar, { backgroundColor: isDark ? '#444444' : '#D1D5DB' }]} />
          </View>

          <View style={styles.content}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                  <AnimatedIcon
                    name={isFinished ? 'notifications' : isRunning ? 'timer-outline' : 'pause-circle-outline'}
                    preset="bell"
                    size={13}
                    color={isFinished ? '#F59E0B' : !isRunning ? '#F59E0B' : theme.textMuted}
                    active={isFinished}
                  />
                  <Text
                    style={[
                      styles.kicker,
                      { color: isFinished || !isRunning ? theme.text : theme.textMuted },
                    ]}
                  >
                    {isFinished
                      ? 'KONIEC PRZERWY! CZAS NA SERIĘ!'
                      : isRunning
                      ? 'ODLICZANIE PRZERWY'
                      : 'PRZERWA WSTRZYMANA'}
                  </Text>
                </View>
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
                onPress={animateHide}
                style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.digitsWrapper}>
              <Text
                style={[
                  styles.digits,
                  {
                    color: !isRunning && !isFinished ? '#F59E0B' : theme.text,
                  },
                ]}
              >
                {isFinished ? 'KONIEC PRZERWY' : formatTime(secondsLeft)}
              </Text>
              <Text style={[styles.digitsSub, { color: isFinished ? theme.text : theme.textMuted }]}>
                {isFinished
                  ? 'Wracaj pod ciężar! Kolejna seria czeka!'
                  : isRunning
                  ? 'Złap oddech, napij się wody'
                  : 'Stoper zatrzymany (powiadomienie i Dynamic Island wstrzymane)'}
              </Text>
            </View>

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
                style={[
                  styles.playBtn,
                  {
                    backgroundColor: !isRunning && !isFinished ? theme.primary : theme.bgSecondary,
                    borderColor: !isRunning && !isFinished ? theme.primary : theme.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={20}
                  color={!isRunning && !isFinished ? theme.primaryText : theme.text}
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

            <TouchableOpacity
              onPress={handleExplicitFinish}
              style={[
                styles.primaryActionBtn,
                {
                  backgroundColor: isFinished ? theme.primary : isDark ? '#27272A' : '#E5E5EA',
                  borderColor: isFinished ? theme.primary : isDark ? '#3F3F46' : '#D1D1D6',
                  borderWidth: 1,
                },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFinished ? 'play' : 'checkmark-done'}
                size={18}
                color={isFinished ? theme.primaryText : theme.text}
              />
              <Text
                style={[
                  styles.primaryActionBtnText,
                  { color: isFinished ? theme.primaryText : theme.text },
                ]}
              >
                {isFinished ? 'ROZPOCZNIJ KOLEJNĄ SERIĘ' : 'ZAKOŃCZ PRZERWĘ (ZACZNIJ SERIĘ)'}
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
    paddingTop: 14,
    paddingBottom: 10,
  },
  handleBar: {
    width: 46,
    height: 5,
    borderRadius: 2.5,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 4,
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
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
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
