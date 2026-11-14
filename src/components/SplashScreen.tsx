import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
              fill={theme.text}
              d="M8.6 41.4 L8.6 21.5 L11.2 17.0 L29.4 6.5 L34.6 6.5 L46.9 13.6 L37.8 20.2 L33.4 17.7 L30.6 17.7 L20.3 23.6 L18.9 26.1 L18.9 34.0 Z M55.4 22.6 L55.4 42.5 L52.8 47.0 L34.6 57.5 L29.4 57.5 L17.1 50.4 L26.2 43.8 L30.6 46.3 L33.4 46.3 L43.7 40.4 L45.1 37.9 L45.1 30.0 Z"
            />
            <Path
              fill="#F59E0B"
              d="M9.7 49.7 C29.0 40.0 40.1 29.6 54.3 14.3 C35.0 24.0 23.9 34.4 9.7 49.7 Z"
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
