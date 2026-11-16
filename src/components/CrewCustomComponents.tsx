import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { FriendProfileSummary, RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { RankCrestIcon } from './RankCrestIcon';

/**
 * 1. Bespoke Rotating Orbital Radar Stage for Crew Discovery & Hero Banner
 */
export const CrewRadarOrb: React.FC<{
  myRank?: RankTier;
  friendRanks?: RankTier[];
  size?: number;
}> = React.memo(({ myRank = 'F', friendRanks = [], size = 148 }) => {
  const { isDark } = useAppTheme();
  const uid = useId().replace(/:/g, '_');
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [spinAnim, pulseAnim]);

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
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center', transform: [{ rotate }] },
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
        <RankCrestIcon tier={myRank} size={50} isSelected />
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
  const initials = (friend.displayName || friend.nickname || 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  return (
    <TouchableOpacity style={styles.ringWrap} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.ringCircleBox}>
        <Svg width={64} height={64} style={StyleSheet.absoluteFill}>
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
        <Text style={[styles.ringInitials, { color: theme.text }]}>{initials}</Text>

        {/* Bottom-right mini rank badge */}
        <View
          style={[
            styles.ringRankPill,
            { backgroundColor: rankMeta.color, borderColor: theme.bg },
          ]}
        >
          <Text style={styles.ringRankText}>{friend.overallRank}</Text>
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
  const safeMy = Math.max(1, myScore);
  const safeFr = Math.max(1, friendScore);
  const total = safeMy + safeFr;
  const myShare = Math.min(0.88, Math.max(0.12, safeMy / total));

  const w = 240;
  const h = 112;
  const cx = w / 2;
  const cy = 96;
  const r = 74;

  const angleForShare = Math.PI * (1 - myShare); // PI (left) -> 0 (right)
  const splitX = cx + Math.cos(angleForShare) * r;
  const splitY = cy - Math.sin(angleForShare) * r;

  return (
    <View style={styles.arcWrap}>
      <Svg width={w} height={h}>
        {/* Track */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.08)'}
          strokeWidth={11}
          strokeLinecap="round"
        />
        {/* Left Arc = You */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${splitX} ${splitY}`}
          fill="none"
          stroke="#38BDF8"
          strokeWidth={11}
          strokeLinecap="round"
        />
        {/* Right Arc = Friend */}
        <Path
          d={`M ${splitX} ${splitY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={friendColor}
          strokeWidth={11}
          strokeLinecap="round"
        />
        {/* Center Equilibrium Marker */}
        <Circle cx={splitX} cy={splitY} r={6} fill={theme.bg} stroke={theme.text} strokeWidth={2.5} />
      </Svg>

      <View style={styles.arcLegendRow}>
        <View style={styles.arcSide}>
          <View style={[styles.arcDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={[styles.arcSideLabel, { color: theme.text }]} numberOfLines={1}>
            {myLabel}
          </Text>
        </View>
        <Text style={[styles.arcVsBadge, { color: theme.textMuted }]}>VS</Text>
        <View style={[styles.arcSide, { justifyContent: 'flex-end' }]}>
          <Text style={[styles.arcSideLabel, { color: friendColor }]} numberOfLines={1}>
            {friendLabel}
          </Text>
          <View style={[styles.arcDot, { backgroundColor: friendColor }]} />
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
        <RankCrestIcon tier={entry.profile.overallRank || 'F'} size={rankPos === 1 ? 50 : 40} isSelected />
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
    bottom: 0,
    right: 0,
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
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
