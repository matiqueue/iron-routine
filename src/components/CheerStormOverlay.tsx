import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PendingCheerBurst } from '../types/workout';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { UserAvatarBadge } from './UserAvatarBadge';

interface CheerStormOverlayProps {
  bursts: PendingCheerBurst[];
  onFinished: () => void;
  onPressBanner?: () => void;
}

interface StormDrop {
  anim: Animated.Value;
  startX: number;
  driftX: number;
  fromTop: boolean;
  rotDeg: number;
  emoji: string;
  size: number;
  delayMs: number;
}

const STORM_EMOJIS = ['✋', '🙌', '🔥', '💥', '⚡', '👏', '🤚', '💪'];

export const CheerStormOverlay: React.FC<CheerStormOverlayProps> = ({
  bursts,
  onFinished,
  onPressBanner,
}) => {
  const { isDark } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [drops, setDrops] = useState<StormDrop[]>([]);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  const totalCount = bursts.reduce((acc, b) => acc + (b.count || 0), 0);
  const topSender = bursts[0];

  useEffect(() => {
    if (!bursts.length || totalCount <= 0) {
      setDrops([]);
      return;
    }

    const { width } = Dimensions.get('window');
    // Unmistakably chaotic: scale drops aggressively (min 18 drops even for x1, up to 84 for mega spam)
    const dropTotal = Math.min(84, Math.max(16, totalCount * 3));
    const created: StormDrop[] = Array.from({ length: dropTotal }, (_, idx) => {
      const spreadX = 10 + ((idx * 53) % Math.max(120, width - 54));
      return {
        anim: new Animated.Value(0),
        startX: spreadX,
        driftX: (idx % 2 === 0 ? 1 : -1) * (24 + (idx % 6) * 14),
        fromTop: idx % 3 === 0,
        rotDeg: (idx % 2 === 0 ? 1 : -1) * (22 + (idx % 4) * 18),
        emoji: STORM_EMOJIS[idx % STORM_EMOJIS.length],
        size: 28 + (idx % 4) * 7,
        delayMs: Math.min(1900, idx * (dropTotal > 35 ? 20 : 38)),
      };
    });
    setDrops(created);

    // Intense haptic barrage so the receiver immediately feels the high-five spam
    const hapticTotal = Math.min(10, Math.max(3, Math.ceil(totalCount / 2)));
    let hapticFired = 0;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    const hapticTimer = setInterval(() => {
      hapticFired += 1;
      if (hapticFired >= hapticTotal) {
        clearInterval(hapticTimer);
        return;
      }
      Haptics.impactAsync(
        hapticFired % 2 === 0
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Medium
      ).catch(() => {});
    }, 150);

    // Aggressive screen shake + strobe rim flash
    shakeAnim.setValue(0);
    const shakeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0.7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -0.7, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      { iterations: Math.min(9, Math.max(3, Math.ceil(totalCount / 2))) }
    );
    shakeLoop.start();

    flashAnim.setValue(0);
    const flashLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(flashAnim, { toValue: 0.15, duration: 180, useNativeDriver: true }),
      ]),
      { iterations: Math.min(8, Math.max(3, Math.ceil(totalCount / 3))) }
    );
    flashLoop.start();

    bannerAnim.setValue(0);
    Animated.spring(bannerAnim, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();

    const dropAnims = created.map((d) =>
      Animated.sequence([
        Animated.delay(d.delayMs),
        Animated.timing(d.anim, {
          toValue: 1,
          duration: 1550,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const parallel = Animated.parallel(dropAnims);
    parallel.start();

    const endTimer = setTimeout(() => {
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(() => {
        onFinished();
      });
    }, Math.min(4500, 2400 + dropTotal * 22));

    return () => {
      clearInterval(hapticTimer);
      clearTimeout(endTimer);
      shakeLoop.stop();
      flashLoop.stop();
      parallel.stop();
    };
  }, [bursts, totalCount, bannerAnim, shakeAnim, flashAnim, onFinished]);

  if (!bursts.length || totalCount <= 0 || !topSender) return null;

  const { height } = Dimensions.get('window');

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          zIndex: 999,
          pointerEvents: 'box-none',
          transform: [
            {
              translateX: shakeAnim.interpolate({
                inputRange: [-1, 1],
                outputRange: [-8, 8],
              }),
            },
            {
              translateY: shakeAnim.interpolate({
                inputRange: [-1, 1],
                outputRange: [-3, 3],
              }),
            },
          ],
        },
      ]}
    >
      {/* Chaotic Amber Edge Strobe Frame */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            pointerEvents: 'none',
            borderWidth: 4,
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.14)',
            opacity: flashAnim,
          },
        ]}
      />

      {drops.map((d, idx) => (
        <Animated.Text
          key={idx}
          style={{
            position: 'absolute',
            ...(d.fromTop ? { top: -48 } : { bottom: -48 }),
            left: d.startX,
            fontSize: d.size,
            pointerEvents: 'none',
            opacity: d.anim.interpolate({
              inputRange: [0, 0.08, 0.84, 1],
              outputRange: [0, 1, 0.96, 0],
            }),
            transform: [
              {
                translateY: d.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, d.fromTop ? height * 0.96 : -(height * 0.96)],
                }),
              },
              {
                translateX: d.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, d.driftX, -d.driftX * 0.65],
                }),
              },
              {
                scale: d.anim.interpolate({
                  inputRange: [0, 0.25, 0.7, 1],
                  outputRange: [0.6, 1.45, 1.15, 0.95],
                }),
              },
              {
                rotate: d.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${d.rotDeg}deg`],
                }),
              },
            ],
          }}
        >
          {d.emoji}
        </Animated.Text>
      ))}

      <Animated.View
        style={[
          styles.bannerWrap,
          {
            top: Math.max(insets.top + 10, 24),
            opacity: bannerAnim,
            transform: [
              {
                translateY: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-32, 0],
                }),
              },
              {
                scale: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1.03],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            onPressBanner?.();
            onFinished();
          }}
          style={[
            styles.bannerCard,
            {
              backgroundColor: isDark
                ? 'rgba(20, 22, 29, 0.97)'
                : 'rgba(255, 255, 255, 0.98)',
              borderColor: '#F59E0B',
            },
          ]}
        >
          <UserAvatarBadge
            avatarUrl={topSender.fromAvatarUrl}
            displayName={topSender.fromDisplayName}
            avatarColor="#F59E0B"
            size={40}
            ringColor="#F59E0B"
          />
          <View style={styles.bannerTextCol}>
            <Text style={[styles.bannerTitle, { color: isDark ? '#FAFAFA' : '#09090B' }]} numberOfLines={1}>
              ✋ @{topSender.fromNickname}
              {bursts.length > 1 ? ` +${bursts.length - 1}` : ''}
            </Text>
            <Text style={styles.bannerSub} numberOfLines={1}>
              {t('friendsKudosBtn')} ×{totalCount}!!
            </Text>
          </View>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>×{totalCount}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 20,
    borderWidth: 2,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 18,
    elevation: 12,
  },
  bannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  bannerSub: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#F59E0B',
    marginTop: 1,
  },
  countChip: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  countChipText: {
    color: '#09090B',
    fontSize: 13.5,
    fontWeight: '900',
  },
});
