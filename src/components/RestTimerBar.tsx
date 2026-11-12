import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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
      {/* Top progress track */}
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

      <View style={styles.cardInner}>
        {/* Header row: Label & Close */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: isFinished ? theme.text : theme.textMuted }]}>
              {isFinished ? 'CZAS NA KOLEJNĄ SERIĘ!' : 'ODLICZANIE PRZERWY'}
            </Text>
            <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
              {exerciseName || 'Odpoczynek'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={18} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Big Large Timer Digits */}
        <View style={styles.timerDisplay}>
          <Text style={[styles.digits, { color: theme.text }]}>
            {formatTime(secondsLeft)}
          </Text>
        </View>

        {/* Large Action Controls */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => adjustTime(-15)}
            style={[styles.smallBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>-15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => adjustTime(15)}
            style={[styles.smallBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.btnText, { color: theme.text }]}>+15s</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsRunning(!isRunning)}
            style={[styles.iconBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isRunning ? 'pause' : 'play'}
              size={18}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.skipBtn, { backgroundColor: theme.primary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.skipBtnText, { color: theme.primaryText }]}>
              {isFinished ? 'ZACZNIJ SERIĘ' : 'ZAKOŃCZ PRZERWĘ'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 16,
    right: 16,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  progressTrack: {
    height: 4,
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  cardInner: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  digits: {
    fontSize: 48,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallBtn: {
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  skipBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
