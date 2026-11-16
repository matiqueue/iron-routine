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
  emoji: string;
  size: number;
  delayMs: number;
}

const STORM_EMOJIS = ['🙌', '🔥', '⚡', '💪', '👏'];

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

  const totalCount = bursts.reduce((acc, b) => acc + (b.count || 0), 0);
  const topSender = bursts[0];

  useEffect(() => {
    if (!bursts.length || totalCount <= 0) {
      setDrops([]);
      return;
    }

    const { width } = Dimensions.get('window');
    // Match exact high-five count sent, capped gracefully at 72 animated drops
    const dropTotal = Math.min(Math.max(1, totalCount), 72);
    const created: StormDrop[] = Array.from({ length: dropTotal }, (_, idx) => {
      const spreadX = 24 + ((idx * 67) % Math.max(120, width - 64));
      return {
        anim: new Animated.Value(0),
        startX: spreadX,
        driftX: ((idx % 2 === 0 ? 1 : -1) * (14 + (idx % 5) * 9)),
        emoji: STORM_EMOJIS[idx % STORM_EMOJIS.length],
        size: 22 + (idx % 4) * 5,
        delayMs: Math.min(2000, idx * (dropTotal > 25 ? 28 : 55)),
      };
    });
    setDrops(created);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    bannerAnim.setValue(0);
    Animated.spring(bannerAnim, {
      toValue: 1,
      friction: 7,
      tension: 95,
      useNativeDriver: true,
    }).start();

    const dropAnims = created.map((d) =>
      Animated.sequence([
        Animated.delay(d.delayMs),
        Animated.timing(d.anim, {
          toValue: 1,
          duration: 1800,
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
        duration: 280,
        useNativeDriver: true,
      }).start(() => {
        onFinished();
      });
    }, Math.min(4400, 2200 + dropTotal * 25));

    return () => {
      clearTimeout(endTimer);
      parallel.stop();
    };
  }, [bursts, totalCount, bannerAnim, onFinished]);

  if (!bursts.length || totalCount <= 0 || !topSender) return null;

  const { height } = Dimensions.get('window');

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999, pointerEvents: 'box-none' }]}>
      {drops.map((d, idx) => (
        <Animated.Text
          key={idx}
          style={{
            position: 'absolute',
            bottom: -40,
            left: d.startX,
            fontSize: d.size,
            pointerEvents: 'none',
            opacity: d.anim.interpolate({
              inputRange: [0, 0.1, 0.82, 1],
              outputRange: [0, 1, 0.95, 0],
            }),
            transform: [
              {
                translateY: d.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -(height * 0.88)],
                }),
              },
              {
                translateX: d.anim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, d.driftX, -d.driftX * 0.5],
                }),
              },
              {
                scale: d.anim.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0.5, 1.25, 0.9],
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
                  outputRange: [-28, 0],
                }),
              },
              {
                scale: bannerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
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
                ? 'rgba(20, 22, 29, 0.95)'
                : 'rgba(255, 255, 255, 0.96)',
              borderColor: '#F59E0B',
            },
          ]}
        >
          <UserAvatarBadge
            avatarUrl={topSender.fromAvatarUrl}
            displayName={topSender.fromDisplayName}
            avatarColor="#F59E0B"
            size={38}
            ringColor="#F59E0B"
          />
          <View style={styles.bannerTextCol}>
            <Text style={[styles.bannerTitle, { color: isDark ? '#FAFAFA' : '#09090B' }]} numberOfLines={1}>
              🙌 @{topSender.fromNickname}
              {bursts.length > 1 ? ` +${bursts.length - 1}` : ''}
            </Text>
            <Text style={styles.bannerSub} numberOfLines={1}>
              {t('friendsKudosBtn')} ×{totalCount}!
            </Text>
          </View>
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>×{totalCount}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
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
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  bannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  bannerTitle: {
    fontSize: 13.5,
    fontWeight: '900',
  },
  bannerSub: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    marginTop: 1,
  },
  countChip: {
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countChipText: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
