import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

interface HoldToStartButtonProps {
  onComplete: () => void;
  title?: string;
  subtitle?: string;
}

export const HoldToStartButton: React.FC<HoldToStartButtonProps> = ({
  onComplete,
  title,
  subtitle,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguage();
  const resolvedTitle = title || t('holdToStartDefault');
  const resolvedSubtitle = subtitle || t('todayEditSession');
  const [isHolding, setIsHolding] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const idlePulseAnim = useRef(new Animated.Value(0)).current;
  const hapticTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isHolding) {
      idlePulseAnim.stopAnimation();
      idlePulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idlePulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(idlePulseAnim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [isHolding, idlePulseAnim]);

  const iconPulseScale = idlePulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.09],
  });
  const fingerprintOpacity = idlePulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.95],
  });

  const startHold = () => {
    setIsHolding(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();

    hapticTimerRef.current = setInterval(() => {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }, 220);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        if (hapticTimerRef.current) clearInterval(hapticTimerRef.current);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]).start(() => {
          progressAnim.setValue(0);
          setIsHolding(false);
          onComplete();
        });
      }
    });
  };

  const cancelHold = () => {
    if (hapticTimerRef.current) {
      clearInterval(hapticTimerRef.current);
      hapticTimerRef.current = null;
    }
    setIsHolding(false);

    try {
      Haptics.selectionAsync();
    } catch {}

    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={startHold}
        onPressOut={cancelHold}
        style={[
          styles.pressable,
          {
            backgroundColor: theme.primary,
          },
        ]}
      >
        {/* Animated fill track */}
        <Animated.View
          style={[
            styles.fillProgress,
            {
              width: fillWidth,
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.35)',
            },
          ]}
        />

        {/* Content */}
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: theme.primaryText,
                transform: [{ scale: iconPulseScale }],
              },
            ]}
          >
            <Ionicons
              name={isHolding ? 'radio-button-on' : 'play'}
              size={18}
              color={theme.primary}
            />
          </Animated.View>

          <View style={styles.textCol}>
            <Text style={[styles.title, { color: theme.primaryText }]}>
              {isHolding ? t('holdKeepPressing') : resolvedTitle}
            </Text>
            <Text style={[styles.subtitle, { color: isDark ? '#71717A' : '#D1D5DB' }]}>
              {resolvedSubtitle}
            </Text>
          </View>

          <Animated.View style={{ opacity: fingerprintOpacity, transform: [{ scale: iconPulseScale }] }}>
            <Ionicons
              name="finger-print-outline"
              size={22}
              color={theme.primaryText}
            />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  pressable: {
    minHeight: 64,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  fillProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    zIndex: 2,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
