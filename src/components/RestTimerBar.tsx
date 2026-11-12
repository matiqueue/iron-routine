import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';

interface RestTimerBarProps {
  initialSeconds: number;
  exerciseName?: string;
  onClose: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  initialSeconds,
  exerciseName,
  onClose,
}) => {
  const { theme, isDark } = useAppTheme();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [isFinished, setIsFinished] = useState(false);

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
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = initialSeconds > 0 ? (secondsLeft / initialSeconds) * 100 : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor: theme.borderDark,
        },
      ]}
    >
      {/* Top progress line */}
      <View style={[styles.progressTrack, { backgroundColor: theme.bgTertiary }]}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
              backgroundColor: theme.text,
            },
          ]}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.infoCol}>
          <Text style={[styles.label, { color: theme.textMuted }]}>
            {isFinished ? 'CZAS NA SERIĘ' : 'ODLICZANIE PRZERWY'}
          </Text>
          <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
            {exerciseName || 'Odpoczynek'}
          </Text>
        </View>

        <View style={styles.timerDisplay}>
          <Text style={[styles.digits, { color: theme.text }]}>
            {formatTime(secondsLeft)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => adjustTime(30)}
            style={[styles.btn, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>+30s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsRunning(!isRunning)}
            style={[styles.btn, { borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
          >
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={14}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
          >
            <Ionicons name="close" size={16} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  timerDisplay: {
    marginRight: 12,
  },
  digits: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btn: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
