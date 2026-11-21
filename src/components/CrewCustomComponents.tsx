import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useIsScreenActive } from '../context/TabActivityContext';
import { FriendProfileSummary, RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { RankCrestIcon } from './RankCrestIcon';
import { getAvatarInitials } from './UserAvatarBadge';

/**
 * 1. Bespoke Rotating Orbital Radar Stage for Crew Discovery & Hero Banner
 */
const EMPTY_FRIEND_RANKS: RankTier[] = [];

export const CrewRadarOrb: React.FC<{
  myRank?: RankTier;
  friendRanks?: RankTier[];
  size?: number;
}> = React.memo(({ myRank = 'F', friendRanks = EMPTY_FRIEND_RANKS, size = 148 }) => {
  const { isDark } = useAppTheme();
  const isScreenActive = useIsScreenActive();
  const uid = useId().replace(/:/g, '_');
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spinAnim.stopAnimation();
    pulseAnim.stopAnimation();
    if (!isScreenActive) return;

    const spin = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    spin.start();
    pulse.start();
    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [isScreenActive, spinAnim, pulseAnim]);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const counterRotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });
  const coreScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06],
  });

  const cx = size / 2;
  const rOuter = size * 0.44;
  const rMid = size * 0.31;
  const orbitDots = (friendRanks.length > 0 ? friendRanks : (['D', 'C', 'S'] as RankTier[])).slice(0, 4);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`radar_glow_${uid}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.22 : 0.14} />
            <Stop offset="65%" stopColor="#38BDF8" stopOpacity={isDark ? 0.08 : 0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={rOuter + 6} fill={`url(#radar_glow_${uid})`} />
        <Circle
          cx={cx}
          cy={cx}
          r={rOuter}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(24,24,27,0.10)'}
          strokeWidth={1}
          strokeDasharray="4 6"
        />
        <Circle
          cx={cx}
          cy={cx}
          r={rMid}
          fill="none"
          stroke={isDark ? 'rgba(56,189,248,0.22)' : 'rgba(16,185,129,0.20)'}
          strokeWidth={1}
        />
        <Line
          x1={cx}
          y1={cx - rOuter - 4}
          x2={cx}
          y2={cx + rOuter + 4}
          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.06)'}
          strokeWidth={1}
        />
        <Line
          x1={cx - rOuter - 4}
          y1={cx}
          x2={cx + rOuter + 4}
          y2={cx}
          stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.06)'}
          strokeWidth={1}
        />
      </Svg>

      {/* Orbiting Satellite Nodes */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', transform: [{ rotate }] },
        ]}
      >
        <Svg width={size} height={size}>
          <Path
            d={`M ${cx} ${cx - rOuter} A ${rOuter} ${rOuter} 0 0 1 ${cx + rOuter} ${cx}`}
            fill="none"
            stroke="#10B981"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeOpacity={0.75}
          />
          {orbitDots.map((tier, idx) => {
            const angle = (idx / orbitDots.length) * Math.PI * 2 + 0.4;
            const orbitRadius = idx % 2 === 0 ? rOuter : rMid;
            const x = cx + Math.cos(angle) * orbitRadius;
            const y = cx + Math.sin(angle) * orbitRadius;
            const col = (RANK_TIER_MAP[tier] || RANK_TIER_MAP.C).color;
            return (
              <G key={`${tier}-${idx}`}>
                <Circle cx={x} cy={y} r={7} fill={col} fillOpacity={0.22} />
                <Circle cx={x} cy={y} r={3.6} fill={col} />
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      {/* Center Athlete Emblem */}
      <Animated.View style={{ transform: [{ scale: coreScale }, { rotate: counterRotate }] }}>
        <RankCrestIcon tier={myRank} size={50} isSelected animated />
      </Animated.View>
    </View>
  );
});

/**
 * 2. Circular Animated Gradient Avatar Ring for Crew Spotlight Carousel
 */
export const SquadAvatarRing: React.FC<{
  friend: FriendProfileSummary;
  unreadCount?: number;
  onPress: () => void;
}> = React.memo(({ friend, unreadCount = 0, onPress }) => {
  const { theme, isDark } = useAppTheme();
  const uid = useId().replace(/:/g, '_');
  const rankMeta = RANK_TIER_MAP[friend.overallRank] || RANK_TIER_MAP.F;
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setImgFailed(false);
  }, [friend.avatarUrl]);

  const initials = getAvatarInitials(friend.displayName || friend.nickname || 'A');

  return (
    <TouchableOpacity style={styles.ringWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.ringCircleBox}>
        <Svg width={64} height={64} style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 1 }]}>
          <Defs>
            <LinearGradient id={`ring_g_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={rankMeta.color} />
              <Stop offset="55%" stopColor="#10B981" />
              <Stop offset="100%" stopColor="#38BDF8" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={32}
            cy={32}
            r={29}
            fill="none"
            stroke={`url(#ring_g_${uid})`}
            strokeWidth={2.5}
          />
          <Circle
            cx={32}
            cy={32}
            r={24.5}
            fill={isDark ? '#18181D' : '#F4F4F7'}
          />
        </Svg>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? '#18181D' : '#F4F4F7',
            zIndex: 2,
          }}
        >
          {friend.avatarUrl && !imgFailed ? (
            <Image
              source={{ uri: friend.avatarUrl }}
              style={{ width: 48, height: 48, borderRadius: 24 }}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Text style={[styles.ringInitials, { color: theme.text }]}>{initials}</Text>
          )}
        </View>

        {/* Bottom-right floating rank crest directly on avatar (no enclosing circle) */}
        <View style={styles.ringRankPill}>
          <RankCrestIcon tier={friend.overallRank || 'F'} size={22} isSelected />
        </View>

        {unreadCount > 0 && (
          <View style={styles.ringUnreadDot}>
            <Text style={styles.ringUnreadText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.ringName, { color: theme.text }]} numberOfLines={1}>
        {friend.displayName.split(' ')[0]}
      </Text>
      <Text style={[styles.ringNick, { color: theme.textMuted }]} numberOfLines={1}>
        @{friend.nickname}
      </Text>
    </TouchableOpacity>
  );
});

/**
 * 3. Custom SVG Semicircular 1v1 Battle Gauge (You vs Friend)
 */
export const VsComparisonArc: React.FC<{
  myLabel: string;
  friendLabel: string;
  myScore: number;
  friendScore: number;
  friendColor?: string;
}> = React.memo(({ myLabel, friendLabel, myScore, friendScore, friendColor = '#10B981' }) => {
  const { theme, isDark } = useAppTheme();
  const isScreenActive = useIsScreenActive();
  const safeMy = Math.max(1, myScore);
  const safeFr = Math.max(1, friendScore);
  const total = safeMy + safeFr;
  const myPct = Math.min(88, Math.max(12, Math.round((safeMy / total) * 100)));
  const frPct = 100 - myPct;

  const clashAnim = useRef(new Animated.Value(0)).current;
  const sparkPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    clashAnim.setValue(0);
    Animated.timing(clashAnim, {
      toValue: 1,
      duration: 680,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    if (!isScreenActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkPulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkPulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [myScore, friendScore, isScreenActive, clashAnim, sparkPulse]);

  const leftBarWidth = clashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${myPct}%`],
  });
  const rightBarWidth = clashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${frPct}%`],
  });
  const clashScale = sparkPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.18],
  });

  return (
    <View style={styles.clashWrap}>
      {/* Share Percentage Headline */}
      <View style={styles.clashPctRow}>
        <View style={styles.clashSideStat}>
          <Text style={[styles.clashPctNum, { color: '#38BDF8' }]}>{myPct}%</Text>
          <Text style={[styles.clashSideSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {myLabel}
          </Text>
        </View>
        <View style={styles.clashMidChip}>
          <Ionicons name="flash" size={11} color="#F59E0B" />
          <Text style={[styles.clashMidText, { color: theme.textMuted }]}>POWER SHARE</Text>
        </View>
        <View style={[styles.clashSideStat, { alignItems: 'flex-end' }]}>
          <Text style={[styles.clashPctNum, { color: friendColor }]}>{frPct}%</Text>
          <Text style={[styles.clashSideSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {friendLabel}
          </Text>
        </View>
      </View>

      {/* Dual Opposing Energy Clash Meter */}
      <View
        style={[
          styles.clashTrackOuter,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.07)',
            borderColor: theme.border,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.clashFillLeft,
            {
              width: leftBarWidth,
              backgroundColor: '#38BDF8',
            },
          ]}
        />
        <Animated.View
          style={[
            styles.clashSparkOrb,
            {
              borderColor: theme.bg,
              transform: [{ scale: clashScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.clashFillRight,
            {
              width: rightBarWidth,
              backgroundColor: friendColor,
            },
          ]}
        />

        {/* Precision Telemetry Ticks */}
        <View style={[styles.clashTicksRow, { pointerEvents: 'none' }]}>
          {[0, 1, 2, 3, 4, 5, 6].map((tick) => (
            <View
              key={tick}
              style={[
                styles.clashTickMark,
                { backgroundColor: isDark ? 'rgba(0,0,0,0.34)' : 'rgba(255,255,255,0.45)' },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
});

/**
 * 4. Custom 3-Column Crew Podium Stage (#2 Silver, #1 Gold Crown, #3 Bronze)
 */
export const CrewPodiumStage: React.FC<{
  entries: Array<{ profile: FriendProfileSummary; isMe: boolean; metricLabel: string }>;
  onSelectProfile: (profile: FriendProfileSummary, isMe: boolean) => void;
}> = React.memo(({ entries, onSelectProfile }) => {
  const { theme, isDark } = useAppTheme();
  if (entries.length === 0) return null;

  const first = entries[0];
  const second = entries[1] || null;
  const third = entries[2] || null;

  const renderStep = (
    entry: { profile: FriendProfileSummary; isMe: boolean; metricLabel: string } | null,
    rankPos: 1 | 2 | 3,
    barHeight: number,
    accent: string
  ) => {
    if (!entry) return <View style={styles.podiumCol} />;
    return (
      <TouchableOpacity
        style={styles.podiumCol}
        activeOpacity={0.8}
        onPress={() => onSelectProfile(entry.profile, entry.isMe)}
      >
        {rankPos === 1 && (
          <View style={styles.crownChip}>
            <Ionicons name="trophy" size={14} color="#FACC15" />
          </View>
        )}
        <RankCrestIcon
          tier={entry.profile.overallRank || 'F'}
          size={rankPos === 1 ? 52 : 42}
          isSelected
          animated={rankPos === 1}
        />
        <Text style={[styles.podiumName, { color: theme.text }]} numberOfLines={1}>
          {entry.profile.displayName.split(' ')[0]}
        </Text>
        <Text style={[styles.podiumMetric, { color: accent }]} numberOfLines={1}>
          {entry.metricLabel}
        </Text>
        <View
          style={[
            styles.podiumBlock,
            {
              height: barHeight,
              backgroundColor: isDark ? `${accent}1A` : `${accent}16`,
              borderColor: `${accent}66`,
            },
          ]}
        >
          <Text style={[styles.podiumNum, { color: accent }]}>#{rankPos}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.podiumStage,
        {
          backgroundColor: isDark ? 'rgba(24,24,28,0.72)' : 'rgba(255,255,255,0.88)',
          borderColor: theme.border,
        },
      ]}
    >
      {renderStep(second, 2, 46, '#CBD5E1')}
      {renderStep(first, 1, 66, '#FACC15')}
      {renderStep(third, 3, 36, '#F59E0B')}
    </View>
  );
});

const styles = StyleSheet.create({
  ringWrap: {
    width: 72,
    alignItems: 'center',
    gap: 4,
  },
  ringCircleBox: {
    position: 'relative',
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInitials: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  ringRankPill: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
  },
  ringRankText: {
    color: '#09090B',
    fontSize: 9.5,
    fontWeight: '900',
  },
  ringUnreadDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 35,
    elevation: 9,
  },
  ringUnreadText: {
    color: '#04120B',
    fontSize: 9.5,
    fontWeight: '900',
  },
  ringName: {
    fontSize: 12,
    fontWeight: '800',
  },
  ringNick: {
    fontSize: 10,
    fontWeight: '600',
  },
  arcWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  arcLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 6,
    marginTop: 4,
  },
  arcSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  arcSideLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  arcVsBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    paddingHorizontal: 8,
  },
  clashWrap: {
    paddingTop: 4,
    paddingBottom: 4,
    gap: 10,
  },
  clashPctRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clashSideStat: {
    flex: 1,
    gap: 1,
  },
  clashPctNum: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  clashSideSub: {
    fontSize: 11,
    fontWeight: '700',
  },
  clashMidChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  clashMidText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  clashTrackOuter: {
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  clashFillLeft: {
    height: '100%',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  clashFillRight: {
    height: '100%',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  clashSparkOrb: {
    width: 12,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    marginHorizontal: -4,
    zIndex: 5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  clashTicksRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  clashTickMark: {
    width: 1.5,
    height: 8,
    borderRadius: 1,
  },
  podiumStage: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  crownChip: {
    marginBottom: 1,
  },
  podiumName: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  podiumMetric: {
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  podiumBlock: {
    width: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  podiumNum: {
    fontSize: 16,
    fontWeight: '900',
  },
});
