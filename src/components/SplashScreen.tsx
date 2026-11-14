import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useAppTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      }, 150);
    });

    const listener = progressAnim.addListener(({ value }) => {
      setPercent(Math.round(value * 100));
    });

    return () => progressAnim.removeListener(listener);
  }, [fadeAnim, progressAnim, onFinish]);

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { backgroundColor: theme.bg, opacity: fadeAnim }]}>
      <View style={styles.centerContent}>
        <View style={[styles.iconBox, { borderColor: theme.borderDark, backgroundColor: theme.bgSecondary }]}>
          <Svg width={42} height={42} viewBox="0 0 64 64">
            <Path
              fillRule="evenodd"
              fill={theme.text}
              d="M32 7 A25 25 0 1 0 31.99 7 Z M13.25 24.5 C12 24.5 11 25.5 11 26.75 V37.25 C11 38.5 12 39.5 13.25 39.5 C14.5 39.5 15.5 38.5 15.5 37.25 V26.75 C15.5 25.5 14.5 24.5 13.25 24.5 Z M50.75 24.5 C49.5 24.5 48.5 25.5 48.5 26.75 V37.25 C48.5 38.5 49.5 39.5 50.75 39.5 C52 39.5 53 38.5 53 37.25 V26.75 C53 25.5 52 24.5 50.75 24.5 Z M32 24.5 A7.5 7.5 0 1 0 31.99 24.5 Z"
            />
            <Circle
              cx="32"
              cy="32"
              r="21.5"
              stroke={theme.bgSecondary}
              strokeOpacity={0.35}
              strokeWidth="1.2"
              fill="none"
            />
            <Circle
              cx="32"
              cy="32"
              r="10.5"
              stroke="#F59E0B"
              strokeWidth="2.4"
              fill="none"
            />
          </Svg>
        </View>

        <Text style={[styles.title, { color: theme.text }]}>IRON ROUTINE</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          TWOJA RUTYNA • 100% OFFLINE
        </Text>

        <View style={styles.progressArea}>
          <View style={[styles.track, { backgroundColor: theme.bgTertiary }]}>
            <Animated.View style={[styles.bar, { width: barWidth, backgroundColor: theme.text }]} />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.statusText, { color: theme.textMuted }]}>Wczytywanie...</Text>
            <Text style={[styles.percentText, { color: theme.text }]}>{percent}%</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 280,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 32,
  },
  progressArea: {
    width: '100%',
  },
  track: {
    height: 3,
    width: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  percentText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
