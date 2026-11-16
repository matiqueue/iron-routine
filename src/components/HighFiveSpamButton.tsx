import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';
import { sendSocialCheer } from '../services/social';

interface HighFiveSpamButtonProps {
  targetUserId: string;
  activityId?: string;
  initialCount: number;
  cheeredByMe?: boolean;
  label?: string;
  compact?: boolean;
  onServerSynced?: (newCount: number) => void;
}

interface BurstParticle {
  anim: Animated.Value;
  dx: number;
  dy: number;
  rot: number;
  emoji: string;
}

const PARTICLE_EMOJIS = ['🙌', '🔥', '⚡', '👏', '💪', '✨', '🙌', '🔥'];
const POOL_SIZE = 8;

export const HighFiveSpamButton: React.FC<HighFiveSpamButtonProps> = ({
  targetUserId,
  activityId,
  initialCount,
  cheeredByMe = false,
  label,
  compact = false,
  onServerSynced,
}) => {
  const { theme } = useAppTheme();
  const [localAdded, setLocalAdded] = useState(0);
  const [comboBurst, setComboBurst] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  const pendingBatchRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHapticRef = useRef(0);
  const comboHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const particleIdxRef = useRef(0);
  const particlesRef = useRef<BurstParticle[]>(
    Array.from({ length: POOL_SIZE }, (_, idx) => ({
      anim: new Animated.Value(0),
      dx: ((idx % 2 === 0 ? -1 : 1) * (10 + (idx % 4) * 7)),
      dy: -(32 + (idx % 3) * 14),
      rot: (idx % 2 === 0 ? -1 : 1) * (12 + (idx % 3) * 8),
      emoji: PARTICLE_EMOJIS[idx % PARTICLE_EMOJIS.length],
    }))
  );

  // Sync when upstream server count increases cleanly
  useEffect(() => {
    setLocalAdded(0);
  }, [initialCount]);

  const flushBatch = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const batch = pendingBatchRef.current;
    if (batch <= 0) return;
    pendingBatchRef.current = 0;

    const res = await sendSocialCheer(targetUserId, activityId, batch);
    if (res.ok && typeof res.cheersCount === 'number') {
      onServerSynced?.(res.cheersCount);
    }
  }, [targetUserId, activityId, onServerSynced]);

  useEffect(() => {
    return () => {
      if (holdDelayTimerRef.current) clearTimeout(holdDelayTimerRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
      if (comboHideTimerRef.current) clearTimeout(comboHideTimerRef.current);
      if (pendingBatchRef.current > 0) {
        void sendSocialCheer(targetUserId, activityId, pendingBatchRef.current);
        pendingBatchRef.current = 0;
      }
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [targetUserId, activityId]);

  const fireOneHighFive = useCallback(
    (step = 1) => {
      setLocalAdded((prev) => prev + step);
      setComboBurst((prev) => prev + step);
      pendingBatchRef.current += step;

      if (comboHideTimerRef.current) clearTimeout(comboHideTimerRef.current);
      comboHideTimerRef.current = setTimeout(() => {
        setComboBurst(0);
      }, 950);

      // Throttled light tactile feedback so rapid hold never stutters CoreHaptics
      const now = Date.now();
      if (now - lastHapticRef.current >= 80) {
        lastHapticRef.current = now;
        Haptics.impactAsync(
          step > 1 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
      }

      // Snappy button pop without allocating new Animated loops
      scaleAnim.setValue(0.9);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 210,
        useNativeDriver: true,
      }).start();

      // Fire one pooled particle using pure native driver transforms
      const slot = particleIdxRef.current % POOL_SIZE;
      particleIdxRef.current += 1;
      const p = particlesRef.current[slot];
      p.anim.stopAnimation();
      p.anim.setValue(0.01);
      Animated.timing(p.anim, {
        toValue: 1,
        duration: 540,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        p.anim.setValue(0);
      });

      // Debounced batch flush every ~450ms (max 25 pending per instant flush)
      if (pendingBatchRef.current >= 25) {
        void flushBatch();
      } else if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          void flushBatch();
        }, 450);
      }
    },
    [flushBatch, scaleAnim]
  );

  const stopHoldSpam = useCallback(() => {
    setIsHolding(false);
    if (holdDelayTimerRef.current) {
      clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    if (pendingBatchRef.current > 0) {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        void flushBatch();
      }, 220);
    }
  }, [flushBatch]);

  const handlePressIn = () => {
    fireOneHighFive(1);
    if (holdDelayTimerRef.current) clearTimeout(holdDelayTimerRef.current);
    holdDelayTimerRef.current = setTimeout(() => {
      setIsHolding(true);
      let ticks = 0;
      holdIntervalRef.current = setInterval(() => {
        ticks += 1;
        // Ramps up during hold for exhilarating mega-spam
        const burstStep = ticks > 12 ? 3 : ticks > 5 ? 2 : 1;
        fireOneHighFive(burstStep);
      }, 85);
    }, 210);
  };

  const displayCount = (initialCount || 0) + localAdded;
  const active = cheeredByMe || localAdded > 0;

  return (
    <View style={styles.rootWrap}>
      {/* Pooled zero-alloc native-driver particle layer */}
      <View style={[styles.particlesOverlay, { pointerEvents: 'none' }]}>
        {particlesRef.current.map((p, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.particleEmoji,
              {
                opacity: p.anim.interpolate({
                  inputRange: [0, 0.08, 0.72, 1],
                  outputRange: [0, 1, 0.9, 0],
                }),
                transform: [
                  {
                    translateX: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, p.dx],
                    }),
                  },
                  {
                    translateY: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, p.dy],
                    }),
                  },
                  {
                    scale: p.anim.interpolate({
                      inputRange: [0, 0.25, 1],
                      outputRange: [0.45, 1.15, 0.78],
                    }),
                  },
                  {
                    rotate: p.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${p.rot}deg`],
                    }),
                  },
                ],
              },
            ]}
          >
            {p.emoji}
          </Animated.Text>
        ))}

        {comboBurst > 1 && (
          <View style={styles.comboPill}>
            <Text style={styles.comboText}>×{comboBurst}</Text>
          </View>
        )}
      </View>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            compact ? styles.btnCompact : styles.btnFull,
            {
              backgroundColor: isHolding
                ? 'rgba(245, 158, 11, 0.24)'
                : active
                ? 'rgba(16, 185, 129, 0.16)'
                : theme.bgSecondary,
              borderColor: isHolding
                ? '#F59E0B'
                : active
                ? '#10B981'
                : theme.border,
            },
          ]}
          onPressIn={handlePressIn}
          onPressOut={stopHoldSpam}
          delayPressIn={0}
          activeOpacity={0.86}
        >
          <Ionicons
            name="flame"
            size={compact ? 14 : 16}
            color={isHolding ? '#F59E0B' : active ? '#10B981' : '#F59E0B'}
          />
          <Text
            style={[
              compact ? styles.textCompact : styles.textFull,
              { color: theme.text },
            ]}
          >
            {label ? `${label} (${displayCount})` : displayCount}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  rootWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particlesOverlay: {
    position: 'absolute',
    top: -12,
    left: -18,
    right: -18,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    overflow: 'visible',
  },
  particleEmoji: {
    position: 'absolute',
    fontSize: 16,
  },
  comboPill: {
    position: 'absolute',
    top: -24,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  comboText: {
    color: '#09090B',
    fontSize: 10.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  btnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  textCompact: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  textFull: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
