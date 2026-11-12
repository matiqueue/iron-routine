import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';

interface RestTimerBarProps {
  initialSeconds: number;
  exerciseName?: string;
  nextSetInfo?: string;
  onClose: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  initialSeconds,
  exerciseName,
  nextSetInfo,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

  // Animations for slide & fade
  const slideAnim = useRef(new Animated.Value(320)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

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
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    setSecondsLeft(initialSeconds);
    setIsRunning(true);
    setIsFinished(false);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            triggerCompletionFeedback();
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsLeft]);

  const triggerCompletionFeedback = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const adjustTime = (delta: number) => {
    setSecondsLeft((prev) => Math.max(0, prev + delta));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = initialSeconds > 0 ? (secondsLeft / initialSeconds) * 100 : 0;

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        {/* Dim Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.45)',
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

        {/* Animated Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Grab handle indicator */}
          <View style={styles.handleWrap}>
            <View style={[styles.handleBar, { backgroundColor: theme.borderDark }]} />
          </View>

          {/* Progress track */}
          <View style={[styles.progressTrack, { backgroundColor: theme.bgTertiary }]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${Math.min(100, Math.max(0, progressPercent))}%`,
                  backgroundColor: isFinished ? theme.textSecondary : theme.text,
                },
              ]}
            />
          </View>

          <View style={styles.content}>
            {/* Header info */}
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

            {/* Time Adjusters Row */}
            <View style={styles.adjustRow}>
              <TouchableOpacity
                onPress={() => adjustTime(-15)}
                style={[styles.adjustBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: theme.text }]}>-15s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => adjustTime(15)}
                style={[styles.adjustBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: theme.text }]}>+15s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => adjustTime(30)}
                style={[styles.adjustBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.adjustBtnText, { color: theme.text }]}>+30s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setIsRunning(!isRunning)}
                style={[styles.playBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={19}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>

            {/* Main Action Button */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isFinished ? 'play' : 'checkmark-done'}
                size={18}
                color={theme.primaryText}
              />
              <Text style={[styles.primaryActionBtnText, { color: theme.primaryText }]}>
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
    borderLeftWidth: 1,
    borderRightWidth: 1,
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
    paddingVertical: 10,
  },
  handleBar: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
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
    paddingVertical: 20,
  },
  digits: {
    fontSize: 62,
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
    gap: 8,
    marginBottom: 16,
  },
  adjustBtn: {
    flex: 1,
    height: 44,
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
    width: 44,
    height: 44,
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
