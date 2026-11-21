import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useIsScreenActive } from '../context/TabActivityContext';
import { FriendProfileSummary, RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { RankCrestIcon } from './RankCrestIcon';
import { UserAvatarBadge } from './UserAvatarBadge';
import { HighFiveSpamButton } from './HighFiveSpamButton';
import { VsComparisonArc } from './CrewCustomComponents';
import { InteractiveBottomSheet, BottomSheetScrollView } from './InteractiveBottomSheet';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';

interface FriendProfileModalProps {
  visible: boolean;
  friend: FriendProfileSummary | null;
  myProfile: FriendProfileSummary | null;
  embeddedOverlay?: boolean;
  onClose: () => void;
  onOpenChat: (friend: FriendProfileSummary) => void;
  onSendKudos: (friend: FriendProfileSummary) => Promise<void> | void;
  onCheerStreakUpdated?: (friendUserId: string, streakDays: number) => void;
  onRemoveFriend: (friend: FriendProfileSummary) => Promise<void> | void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const RANK_SCORE_ORDER: RankTier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+'];

function rankToScore(tier?: RankTier, pct = 0): number {
  const idx = Math.max(0, RANK_SCORE_ORDER.indexOf(tier || 'F'));
  return idx * 100 + Math.min(99, Math.max(0, pct));
}

/**
 * Sleek high-precision dual-arc orbital ring around the profile avatar.
 */
const AvatarPrecisionRing: React.FC<{ color: string; size?: number; active?: boolean }> = React.memo(
  ({ color, size = 104, active = true }) => {
    const uid = useId().replace(/:/g, '_');
    const isScreenActive = useIsScreenActive();
    const shouldSpin = active && isScreenActive;
    const rot = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      rot.stopAnimation();
      if (!shouldSpin) return;
      rot.setValue(0);
      const loop = Animated.loop(
        Animated.timing(rot, {
          toValue: 1,
          duration: 6400,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }, [rot, shouldSpin]);

    const rotateDeg = rot.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          pointerEvents: 'none',
          transform: [{ rotate: rotateDeg }],
        }}
      >
        <Svg width={size} height={size} viewBox="0 0 240 240">
          <Defs>
            <LinearGradient id={`ring_arc_a_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity={1} />
              <Stop offset="55%" stopColor="#38BDF8" stopOpacity={0.9} />
              <Stop offset="100%" stopColor={color} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id={`ring_arc_b_${uid}`} x1="1" y1="1" x2="0" y2="0">
              <Stop offset="0%" stopColor="#38BDF8" stopOpacity={0.85} />
              <Stop offset="65%" stopColor={color} stopOpacity={0.45} />
              <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Circle
            cx="120"
            cy="120"
            r="110"
            fill="none"
            stroke={color}
            strokeOpacity={0.14}
            strokeWidth="2"
          />
          <Path
            d="M 120 10 A 110 110 0 0 1 226 150"
            fill="none"
            stroke={`url(#ring_arc_a_${uid})`}
            strokeWidth="4.2"
            strokeLinecap="round"
          />
          <Path
            d="M 120 230 A 110 110 0 0 1 16 88"
            fill="none"
            stroke={`url(#ring_arc_b_${uid})`}
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        </Svg>
      </Animated.View>
    );
  }
);

interface RadarAxis {
  label: string;
  myVal: number;
  friendVal: number;
  myDisplay: string;
  friendDisplay: string;
  max: number;
}

/**
 * Elevated 5-Axis Animated Head-to-Head SVG Radar Chart with gradient polygons,
 * layered depth rings, glowing vertices, and per-axis numeric breakdown strip.
 */
const AnimatedRadarComparison: React.FC<{
  axes: RadarAxis[];
  myLabel: string;
  friendLabel: string;
  friendColor: string;
  triggerKey: string;
}> = React.memo(({ axes, myLabel, friendLabel, friendColor, triggerKey }) => {
  const { theme, isDark } = useAppTheme();
  const uid = useId().replace(/:/g, '_');
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const duration = 620;
    const tick = () => {
      const elapsed = Date.now() - start;
      const raw = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      setReveal(eased);
      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    setReveal(0.06);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [triggerKey]);

  const w = 296;
  const h = 232;
  const cx = w / 2;
  const cy = 116;
  const maxR = 74;

  const getPoint = (idx: number, ratio: number) => {
    const angle = -Math.PI / 2 + (idx / axes.length) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
      lx: cx + Math.cos(angle) * (maxR + 24),
      ly: cy + Math.sin(angle) * (maxR + 19),
    };
  };

  const myPoints: Array<{ x: number; y: number }> = [];
  const frPoints: Array<{ x: number; y: number }> = [];

  axes.forEach((ax, i) => {
    const denom = Math.max(1, ax.max);
    const rMy = Math.max(0.16, Math.min(1, ax.myVal / denom)) * reveal;
    const rFr = Math.max(0.16, Math.min(1, ax.friendVal / denom)) * reveal;
    const pMy = getPoint(i, rMy);
    const pFr = getPoint(i, rFr);
    myPoints.push({ x: pMy.x, y: pMy.y });
    frPoints.push({ x: pFr.x, y: pFr.y });
  });

  const toPolyStr = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const gridLineColor = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(15,23,42,0.11)';
  const ringDepthFill = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(15,23,42,0.025)';

  return (
    <View style={styles.radarWrap}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id={`rad_my_${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#7DD3FC" stopOpacity={0.34} />
            <Stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.14} />
          </LinearGradient>
          <LinearGradient id={`rad_fr_${uid}`} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={friendColor} stopOpacity={0.36} />
            <Stop offset="100%" stopColor={friendColor} stopOpacity={0.12} />
          </LinearGradient>
        </Defs>

        {/* Layered depth web rings */}
        {[1, 0.67, 0.34].map((scale, idx) => {
          const ringPts = axes.map((_, i) => getPoint(i, scale));
          return (
            <Polygon
              key={scale}
              points={toPolyStr(ringPts)}
              fill={idx % 2 === 0 ? ringDepthFill : 'none'}
              stroke={gridLineColor}
              strokeWidth={scale === 1 ? 1.3 : 0.9}
              strokeDasharray={scale === 1 ? undefined : '4 4'}
            />
          );
        })}

        {/* Axis spokes & crisp labels */}
        {axes.map((ax, i) => {
          const edge = getPoint(i, 1);
          const myLeads = ax.myVal > ax.friendVal;
          const frLeads = ax.friendVal > ax.myVal;
          return (
            <G key={ax.label}>
              <Line
                x1={cx}
                y1={cy}
                x2={edge.x}
                y2={edge.y}
                stroke={gridLineColor}
                strokeWidth={0.9}
              />
              <SvgText
                x={edge.lx}
                y={edge.ly + 4}
                textAnchor="middle"
                fill={myLeads ? '#38BDF8' : frLeads ? friendColor : theme.textSecondary}
                fontSize="10.5"
                fontWeight="800"
              >
                {ax.label}
              </SvgText>
            </G>
          );
        })}

        {/* Friend polygon */}
        <Polygon
          points={toPolyStr(frPoints)}
          fill={`url(#rad_fr_${uid})`}
          stroke={friendColor}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* My polygon */}
        <Polygon
          points={toPolyStr(myPoints)}
          fill={`url(#rad_my_${uid})`}
          stroke="#38BDF8"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* Glowing vertex markers */}
        {frPoints.map((pt, i) => (
          <G key={`f_${i}`}>
            <Circle cx={pt.x} cy={pt.y} r="6.8" fill={friendColor} fillOpacity={0.22} />
            <Circle cx={pt.x} cy={pt.y} r="3.4" fill={friendColor} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.9} />
          </G>
        ))}
        {myPoints.map((pt, i) => (
          <G key={`m_${i}`}>
            <Circle cx={pt.x} cy={pt.y} r="6.8" fill="#38BDF8" fillOpacity={0.22} />
            <Circle cx={pt.x} cy={pt.y} r="3.4" fill="#38BDF8" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={0.9} />
          </G>
        ))}
      </Svg>

      {/* Legend pills */}
      <View style={styles.radarLegendRow}>
        <View
          style={[
            styles.radarLegendPill,
            {
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderColor: 'rgba(56, 189, 248, 0.35)',
            },
          ]}
        >
          <View style={[styles.radarLegendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={[styles.radarLegendText, { color: theme.text }]}>{myLabel}</Text>
        </View>
        <View
          style={[
            styles.radarLegendPill,
            {
              backgroundColor: `${friendColor}1C`,
              borderColor: `${friendColor}52`,
            },
          ]}
        >
          <View style={[styles.radarLegendDot, { backgroundColor: friendColor }]} />
          <Text style={[styles.radarLegendText, { color: theme.text }]}>{friendLabel}</Text>
        </View>
      </View>

      {/* Compact 5-axis numeric comparison row */}
      <View style={[styles.radarBreakdownRow, { borderTopColor: theme.hairline }]}>
        {axes.map((ax) => {
          const myLeads = ax.myVal > ax.friendVal;
          const frLeads = ax.friendVal > ax.myVal;
          return (
            <View key={`bk_${ax.label}`} style={styles.radarBreakdownCell}>
              <Text style={[styles.radarBreakdownLabel, { color: theme.textMuted }]} numberOfLines={1}>
                {ax.label}
              </Text>
              <Text
                style={[
                  styles.radarBreakdownVal,
                  { color: myLeads ? '#38BDF8' : theme.textSecondary, fontWeight: myLeads ? '900' : '700' },
                ]}
              >
                {ax.myDisplay}
              </Text>
              <Text
                style={[
                  styles.radarBreakdownVal,
                  { color: frLeads ? friendColor : theme.textMuted, fontWeight: frLeads ? '900' : '700' },
                ]}
              >
                {ax.friendDisplay}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  visible,
  friend,
  myProfile,
  embeddedOverlay = false,
  onClose,
  onOpenChat,
  onCheerStreakUpdated,
  onRemoveFriend,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, rankTitle } = useLanguage();
  const isScreenActive = useIsScreenActive();
  const insets = useSafeAreaInsets();
  const uid = useId().replace(/:/g, '_');

  const [liveCheerStreak, setLiveCheerStreak] = useState<number>(friend?.cheerStreakDays || 0);
  const [liveCheeredToday, setLiveCheeredToday] = useState<boolean>(
    Boolean(friend?.cheeredTodayWithMe)
  );

  useEffect(() => {
    setLiveCheerStreak(friend?.cheerStreakDays || 0);
    setLiveCheeredToday(Boolean(friend?.cheeredTodayWithMe));
  }, [friend?.userId, friend?.cheerStreakDays, friend?.cheeredTodayWithMe]);

  const vsPulse = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // Embedded overlay swipe-down-to-dismiss state (matches InteractiveBottomSheet physics)
  const embeddedScrollYRef = useRef(0);
  const embeddedDraggingRef = useRef(false);
  const embeddedClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const snapEmbeddedBack = useCallback(() => {
    Animated.spring(overlaySlide, {
      toValue: 0,
      damping: 26,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [overlaySlide]);

  const closeEmbeddedAnimated = useCallback(() => {
    if (embeddedClosingRef.current) return;
    embeddedClosingRef.current = true;
    Animated.parallel([
      Animated.timing(overlaySlide, {
        toValue: SCREEN_HEIGHT,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.timing(overlayFade, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start(() => {
      embeddedClosingRef.current = false;
      onCloseRef.current();
    });
  }, [overlaySlide, overlayFade]);

  const embeddedTopPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !embeddedClosingRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !embeddedClosingRef.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) =>
        !embeddedClosingRef.current && g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
      onPanResponderMove: (_, g) => {
        overlaySlide.setValue(Math.max(0, g.dy));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 65 || g.vy > 0.35) {
          triggerSelectionHaptic();
          closeEmbeddedAnimated();
          return;
        }
        snapEmbeddedBack();
      },
      onPanResponderTerminate: snapEmbeddedBack,
    })
  ).current;

  const embeddedBodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        !embeddedClosingRef.current &&
        embeddedScrollYRef.current <= 1 &&
        g.dy > 6 &&
        Math.abs(g.dy) > Math.abs(g.dx) * 1.15,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, g) => {
        overlaySlide.setValue(Math.max(0, g.dy));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 65 || g.vy > 0.35) {
          triggerSelectionHaptic();
          closeEmbeddedAnimated();
          return;
        }
        snapEmbeddedBack();
      },
      onPanResponderTerminate: snapEmbeddedBack,
    })
  ).current;

  useEffect(() => {
    if (!visible) return;

    let vsLoop: Animated.CompositeAnimation | null = null;
    if (isScreenActive) {
      vsLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(vsPulse, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(vsPulse, {
            toValue: 0,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      vsLoop.start();
    }

    entranceAnim.setValue(0);
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (embeddedOverlay) {
      overlaySlide.setValue(SCREEN_HEIGHT * 0.55);
      overlayFade.setValue(0);
      Animated.parallel([
        Animated.timing(overlayFade, {
          toValue: 1,
          duration: 210,
          useNativeDriver: true,
        }),
        Animated.spring(overlaySlide, {
          toValue: 0,
          friction: 9,
          tension: 78,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => {
      vsLoop?.stop();
    };
  }, [
    visible,
    friend?.userId,
    embeddedOverlay,
    isScreenActive,
    vsPulse,
    entranceAnim,
    overlayFade,
    overlaySlide,
  ]);

  const radarAxes = useMemo<RadarAxis[]>(() => {
    if (!friend) return [];
    const myRankScore = rankToScore(myProfile?.overallRank, myProfile?.overallProgressPct || 0);
    const frRankScore = rankToScore(friend.overallRank, friend.overallProgressPct || 0);
    return [
      {
        label: t('friendsRankByTier'),
        myVal: myRankScore,
        friendVal: frRankScore,
        myDisplay: myProfile?.overallRank || 'F',
        friendDisplay: friend.overallRank || 'F',
        max: Math.max(200, myRankScore, frRankScore),
      },
      {
        label: t('friendsStreakLabel'),
        myVal: myProfile?.streak || 0,
        friendVal: friend.streak || 0,
        myDisplay: `${myProfile?.streak || 0}d`,
        friendDisplay: `${friend.streak || 0}d`,
        max: Math.max(7, myProfile?.streak || 0, friend.streak || 0),
      },
      {
        label: t('compareTotalWorkouts'),
        myVal: myProfile?.totalWorkouts || 0,
        friendVal: friend.totalWorkouts || 0,
        myDisplay: String(myProfile?.totalWorkouts || 0),
        friendDisplay: String(friend.totalWorkouts || 0),
        max: Math.max(10, myProfile?.totalWorkouts || 0, friend.totalWorkouts || 0),
      },
      {
        label: t('friendsWorkoutsWeekLabel'),
        myVal: myProfile?.weeklyWorkouts || 0,
        friendVal: friend.weeklyWorkouts || 0,
        myDisplay: `${myProfile?.weeklyWorkouts || 0}/t`,
        friendDisplay: `${friend.weeklyWorkouts || 0}/t`,
        max: Math.max(4, myProfile?.weeklyWorkouts || 0, friend.weeklyWorkouts || 0),
      },
      {
        label: t('friendsBalanceLabel'),
        myVal: myProfile?.balanceScorePct || 100,
        friendVal: friend.balanceScorePct || 100,
        myDisplay: `${myProfile?.balanceScorePct || 100}%`,
        friendDisplay: `${friend.balanceScorePct || 100}%`,
        max: 100,
      },
    ];
  }, [friend, myProfile, t]);

  if (!friend || (embeddedOverlay && !visible)) return null;

  const rankMeta = RANK_TIER_MAP[friend.overallRank] || RANK_TIER_MAP.F;
  const myScore = rankToScore(myProfile?.overallRank, myProfile?.overallProgressPct || 0);
  const friendScore = rankToScore(friend.overallRank, friend.overallProgressPct || 0);

  let myWins = 0;
  let friendWins = 0;
  for (const ax of radarAxes) {
    if (ax.myVal > ax.friendVal) myWins++;
    else if (ax.friendVal > ax.myVal) friendWins++;
  }

  const headToHeadHeadline =
    myWins > friendWins
      ? `${t('compareYouLead')} · ${myWins}:${friendWins}`
      : friendWins > myWins
      ? `${t('compareFriendLeads', { nick: friend.nickname })} · ${friendWins}:${myWins}`
      : `${t('compareTie')} · ${myWins}:${friendWins}`;

  const headlineColor =
    myWins > friendWins ? '#38BDF8' : friendWins > myWins ? rankMeta.color : theme.textSecondary;

  const surfaceTileBg = isDark ? '#0D131F' : '#F3F7FC';
  const surfaceTileBorder = isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(15, 23, 42, 0.08)';
  const arenaCardBg = isDark ? '#0B111C' : '#F2F6FC';
  const heroTopFill = isDark ? '#0B1220' : '#EBF4FF';

  const handleConfirmRemove = () => {
    triggerNotificationHaptic('warning');
    Alert.alert(
      t('friendsRemoveTitle'),
      t('friendsRemoveBody', { nick: friend.nickname }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('friendsRemoveBtn'),
          style: 'destructive',
          onPress: async () => {
            await onRemoveFriend(friend);
            onClose();
          },
        },
      ]
    );
  };

  const vsScale = vsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] });
  const heroTranslateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  const telemetryCards = [
    {
      key: 'streak',
      icon: 'flame-outline' as const,
      color: '#F59E0B',
      value: `${friend.streak || 0}`,
      label: t('friendsStreakLabel'),
    },
    {
      key: 'weekly',
      icon: 'calendar-outline' as const,
      color: '#38BDF8',
      value: `${friend.weeklyWorkouts || 0}`,
      label: t('friendsWorkoutsWeekLabel'),
    },
    {
      key: 'balance',
      icon: 'pulse-outline' as const,
      color: '#10B981',
      value: `${friend.balanceScorePct || 100}%`,
      label: t('friendsBalanceLabel'),
    },
    {
      key: 'total',
      icon: 'barbell-outline' as const,
      color: rankMeta.color,
      value: `${friend.totalWorkouts || 0}`,
      label: t('friendsRankByWorkouts'),
    },
  ];

  const profileBody = (
    <>
      {/* Seamless Full-Bleed Architectural Athlete Profile Header */}
      <Animated.View
        style={[
          styles.heroShell,
          {
            opacity: entranceAnim,
            transform: [{ translateY: heroTranslateY }],
          },
        ]}
      >
        {/* Full-bleed precision atmospheric cover with upward overscroll bleed so dragging down NEVER exposes a black gap */}
        <View style={styles.coverAtmosphere} pointerEvents="none">
          <View style={[styles.coverTopOverscrollCap, { backgroundColor: heroTopFill }]} />
          <Svg width="100%" height={245} viewBox="0 0 400 245" preserveAspectRatio="xMidYMid slice">
            <Defs>
              <LinearGradient id={`cover_base_${uid}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={heroTopFill} stopOpacity={1} />
                <Stop
                  offset="52%"
                  stopColor={isDark ? '#111827' : '#F3F7FC'}
                  stopOpacity={1}
                />
                <Stop offset="100%" stopColor={theme.bg} stopOpacity={1} />
              </LinearGradient>
              <RadialGradient id={`top_bloom_${uid}`} cx="50%" cy="28%" r="64%">
                <Stop offset="0%" stopColor={rankMeta.color} stopOpacity={isDark ? 0.34 : 0.22} />
                <Stop offset="52%" stopColor="#38BDF8" stopOpacity={isDark ? 0.14 : 0.1} />
                <Stop offset="100%" stopColor={theme.bg} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id={`side_bloom_${uid}`} cx="85%" cy="14%" r="48%">
                <Stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark ? 0.22 : 0.16} />
                <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id={`top_fade_${uid}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={theme.bg} stopOpacity={0} />
                <Stop offset="66%" stopColor={theme.bg} stopOpacity={0.55} />
                <Stop offset="100%" stopColor={theme.bg} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="245" fill={`url(#cover_base_${uid})`} />
            <Rect x="0" y="0" width="400" height="245" fill={`url(#top_bloom_${uid})`} />
            <Rect x="0" y="0" width="400" height="245" fill={`url(#side_bloom_${uid})`} />
            {/* Precision architectural orbital arcs & subtle diagonal sheen */}
            <Circle
              cx="200"
              cy="92"
              r="76"
              fill="none"
              stroke={isDark ? '#FFFFFF' : '#0F172A'}
              strokeOpacity={isDark ? 0.06 : 0.05}
              strokeWidth="1"
            />
            <Circle
              cx="200"
              cy="92"
              r="116"
              fill="none"
              stroke={rankMeta.color}
              strokeOpacity={isDark ? 0.14 : 0.12}
              strokeWidth="1"
              strokeDasharray="4 6"
            />
            <Circle
              cx="200"
              cy="92"
              r="158"
              fill="none"
              stroke="#38BDF8"
              strokeOpacity={isDark ? 0.08 : 0.07}
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="205"
              x2="400"
              y2="55"
              stroke={isDark ? '#FFFFFF' : '#0F172A'}
              strokeOpacity={isDark ? 0.045 : 0.04}
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="145"
              x2="400"
              y2="145"
              stroke={isDark ? '#FFFFFF' : '#0F172A'}
              strokeOpacity={isDark ? 0.03 : 0.03}
              strokeWidth="1"
            />
            <Rect x="0" y="0" width="400" height="245" fill={`url(#top_fade_${uid})`} />
          </Svg>
        </View>

        {/* Centered Avatar Stage */}
        <View style={styles.emblemStage}>
          <AvatarPrecisionRing color={rankMeta.color} size={112} active={visible} />
          <UserAvatarBadge
            avatarUrl={friend.avatarUrl}
            displayName={friend.displayName}
            avatarColor={friend.avatarColor}
            rank={friend.overallRank || 'F'}
            size={86}
            ringColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)'}
            showRankDot
          />
        </View>

        {/* Name & Compact Metadata Pills */}
        <Text style={[styles.displayName, { color: theme.text }]} numberOfLines={1}>
          {friend.displayName}
        </Text>

        <View style={styles.identityPillRow}>
          <View
            style={[
              styles.identityChip,
              {
                backgroundColor: surfaceTileBg,
                borderColor: surfaceTileBorder,
              },
            ]}
          >
            <Text style={[styles.identityHandleText, { color: theme.textSecondary }]}>
              @{friend.nickname}
            </Text>
          </View>

          <View
            style={[
              styles.identityChip,
              {
                backgroundColor: `${rankMeta.color}18`,
                borderColor: `${rankMeta.color}48`,
              },
            ]}
          >
            <RankCrestIcon tier={friend.overallRank || 'F'} size={15} />
            <Text style={[styles.identityRankText, { color: rankMeta.color }]}>
              {friend.overallRank} · {rankTitle(friend.overallRank || 'F')}
            </Text>
          </View>
        </View>

        {/* Daily High-Five Streak Pill between you and this friend */}
        <View
          style={[
            styles.cheerStreakPill,
            {
              backgroundColor:
                liveCheerStreak > 0
                  ? isDark
                    ? 'rgba(245, 158, 11, 0.14)'
                    : 'rgba(245, 158, 11, 0.12)'
                  : surfaceTileBg,
              borderColor:
                liveCheerStreak > 0
                  ? 'rgba(245, 158, 11, 0.4)'
                  : surfaceTileBorder,
            },
          ]}
        >
          <Ionicons
            name={liveCheerStreak > 0 ? 'flame' : 'hand-left-outline'}
            size={13}
            color={liveCheerStreak > 0 ? '#F59E0B' : theme.textMuted}
          />
          <Text
            style={[
              styles.cheerStreakText,
              { color: liveCheerStreak > 0 ? '#F59E0B' : theme.textMuted },
            ]}
          >
            {liveCheerStreak === 1
              ? t('highFiveStreakOne')
              : liveCheerStreak > 1
              ? t('highFiveStreakMany', { count: liveCheerStreak })
              : t('highFiveStreakStart')}
          </Text>
          {liveCheerStreak > 0 && liveCheeredToday ? (
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
          ) : null}
        </View>

        {friend.statusNote ? (
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.09)',
                borderColor: 'rgba(16, 185, 129, 0.28)',
              },
            ]}
          >
            <View style={styles.liveDot} />
            <Text style={[styles.statusPillText, { color: theme.text }]} numberOfLines={2}>
              {friend.statusNote}
            </Text>
          </View>
        ) : null}

        {/* Clean Matched Action Dock */}
        <View style={styles.actionDock}>
          <TouchableOpacity
            style={[styles.messagePrimaryBtn, { backgroundColor: theme.text }]}
            onPress={() => {
              triggerSelectionHaptic();
              onClose();
              if (!embeddedOverlay) {
                onOpenChat(friend);
              }
            }}
            activeOpacity={0.86}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color={theme.bg} />
            <Text style={[styles.messagePrimaryBtnText, { color: theme.bg }]}>
              {t('friendsWriteMsgBtn')}
            </Text>
          </TouchableOpacity>

          <HighFiveSpamButton
            targetUserId={friend.userId}
            initialCount={friend.cheersCount || 0}
            cheeredByMe={friend.cheeredByMe}
            label={t('friendsKudosBtn')}
            hideCount
            fullWidth
            onServerSynced={(_count, streakDays) => {
              if (typeof streakDays === 'number') {
                setLiveCheerStreak(streakDays);
                setLiveCheeredToday(true);
                onCheerStreakUpdated?.(friend.userId, streakDays);
              } else if (liveCheerStreak === 0) {
                setLiveCheerStreak(1);
                setLiveCheeredToday(true);
                onCheerStreakUpdated?.(friend.userId, 1);
              }
            }}
          />
        </View>
      </Animated.View>

      {/* Compact Single-Row 4-Column Unified Telemetry Bar */}
      <View
        style={[
          styles.telemetryRibbon,
          {
            backgroundColor: surfaceTileBg,
            borderColor: surfaceTileBorder,
          },
        ]}
      >
        {telemetryCards.map((cell, idx) => (
          <React.Fragment key={cell.key}>
            <View style={styles.telemetryRibbonCol}>
              <View style={styles.telemetryRibbonValRow}>
                <Ionicons name={cell.icon} size={13} color={cell.color} />
                <Text style={[styles.telemetryRibbonValue, { color: theme.text }]} numberOfLines={1}>
                  {cell.value}
                </Text>
              </View>
              <Text style={[styles.telemetryRibbonLabel, { color: theme.textMuted }]} numberOfLines={1}>
                {cell.label}
              </Text>
            </View>
            {idx < telemetryCards.length - 1 && (
              <View style={[styles.telemetryRibbonDivider, { backgroundColor: theme.hairline }]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Elevated 2-Card Comparison Suite */}
      <View style={styles.sectionBlock}>
        <View style={styles.compareHeaderRow}>
          <Text style={[styles.sectionEyebrow, { color: theme.textMuted, marginBottom: 0 }]}>
            {t('friendsCompareHeading')}
          </Text>
          <View
            style={[
              styles.tallyPill,
              {
                backgroundColor: `${headlineColor}1A`,
                borderColor: `${headlineColor}55`,
              },
            ]}
          >
            <Text style={[styles.tallyPillText, { color: headlineColor }]}>
              {headToHeadHeadline}
            </Text>
          </View>
        </View>

        {/* Stat Card #1: Head-to-Head Duel Arena (edge-to-edge unclipped architectural backdrop) */}
        <View
          style={[
            styles.vsArenaCard,
            {
              backgroundColor: arenaCardBg,
              borderColor: surfaceTileBorder,
            },
          ]}
        >
          <View style={styles.arenaBgLayer} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 360 220" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`duel_base_${uid}`} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={isDark ? '#0B1322' : '#EAF3FE'} stopOpacity={1} />
                  <Stop offset="50%" stopColor={isDark ? '#0D131F' : '#F5F9FE'} stopOpacity={1} />
                  <Stop offset="100%" stopColor={isDark ? '#11131D' : '#F3F1FB'} stopOpacity={1} />
                </LinearGradient>
                <RadialGradient id={`duel_l_${uid}`} cx="16%" cy="22%" r="58%">
                  <Stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark ? 0.28 : 0.2} />
                  <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id={`duel_r_${uid}`} cx="84%" cy="22%" r="58%">
                  <Stop offset="0%" stopColor={rankMeta.color} stopOpacity={isDark ? 0.28 : 0.18} />
                  <Stop offset="100%" stopColor={rankMeta.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="360" height="220" fill={`url(#duel_base_${uid})`} />
              <Rect x="0" y="0" width="360" height="220" fill={`url(#duel_l_${uid})`} />
              <Rect x="0" y="0" width="360" height="220" fill={`url(#duel_r_${uid})`} />
              {/* Architectural precision lines & center duel split */}
              <Line
                x1="180"
                y1="14"
                x2="180"
                y2="132"
                stroke={isDark ? '#FFFFFF' : '#0F172A'}
                strokeOpacity={isDark ? 0.06 : 0.05}
                strokeWidth="1"
                strokeDasharray="3 5"
              />
              <Circle
                cx="180"
                cy="74"
                r="52"
                fill="none"
                stroke={isDark ? '#FFFFFF' : '#0F172A'}
                strokeOpacity={isDark ? 0.05 : 0.045}
                strokeWidth="1"
              />
              <Line
                x1="0"
                y1="1"
                x2="360"
                y2="1"
                stroke={isDark ? '#FFFFFF' : '#FFFFFF'}
                strokeOpacity={isDark ? 0.12 : 0.85}
                strokeWidth="1.5"
              />
            </Svg>
          </View>

          <View style={styles.vsCrestsRow}>
            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={myProfile?.overallRank || 'F'} size={50} isSelected animated />
              <Text style={[styles.vsFighterName, { color: '#38BDF8' }]} numberOfLines={1}>
                {t('friendsYouLabel')}
              </Text>
              <View style={[styles.vsRankTag, { backgroundColor: 'rgba(56,189,248,0.12)' }]}>
                <Text style={[styles.vsFighterSub, { color: '#38BDF8' }]}>
                  {myProfile?.overallRank || 'F'} · {myProfile?.overallProgressPct || 0}%
                </Text>
              </View>
            </View>

            <Animated.View
              style={[
                styles.vsCenterBadge,
                {
                  borderColor: surfaceTileBorder,
                  backgroundColor: isDark ? '#121927' : '#FFFFFF',
                  transform: [{ scale: vsScale }],
                },
              ]}
            >
              <Text style={[styles.vsCenterText, { color: theme.text }]}>VS</Text>
            </Animated.View>

            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={friend.overallRank || 'F'} size={50} isSelected animated />
              <Text style={[styles.vsFighterName, { color: rankMeta.color }]} numberOfLines={1}>
                @{friend.nickname}
              </Text>
              <View style={[styles.vsRankTag, { backgroundColor: `${rankMeta.color}18` }]}>
                <Text style={[styles.vsFighterSub, { color: rankMeta.color }]}>
                  {friend.overallRank} · {friend.overallProgressPct || 0}%
                </Text>
              </View>
            </View>
          </View>

          <VsComparisonArc
            myLabel={`${t('friendsYouLabel')} (${myProfile?.overallRank || 'F'})`}
            friendLabel={`@${friend.nickname} (${friend.overallRank})`}
            myScore={Math.max(10, myScore)}
            friendScore={Math.max(10, friendScore)}
            friendColor={rankMeta.color}
          />
        </View>

        {/* Stat Card #2: 5-Axis Animated Radar Spider Chart + Rich Matching Architectural Backdrop */}
        <View
          style={[
            styles.vsArenaCard,
            {
              backgroundColor: arenaCardBg,
              borderColor: surfaceTileBorder,
              marginBottom: 0,
            },
          ]}
        >
          <View style={styles.arenaBgLayer} pointerEvents="none">
            <Svg width="100%" height="100%" viewBox="0 0 360 320" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id={`rad_bg_base_${uid}`} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={isDark ? '#0D1320' : '#F1F6FE'} stopOpacity={1} />
                  <Stop offset="55%" stopColor={isDark ? '#0B101A' : '#F7FAFE'} stopOpacity={1} />
                  <Stop offset="100%" stopColor={isDark ? '#101522' : '#EEF4FC'} stopOpacity={1} />
                </LinearGradient>
                <RadialGradient id={`rad_glow_c_${uid}`} cx="50%" cy="38%" r="54%">
                  <Stop offset="0%" stopColor="#38BDF8" stopOpacity={isDark ? 0.16 : 0.12} />
                  <Stop offset="65%" stopColor={rankMeta.color} stopOpacity={isDark ? 0.08 : 0.06} />
                  <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
                </RadialGradient>
                <RadialGradient id={`rad_glow_br_${uid}`} cx="90%" cy="88%" r="48%">
                  <Stop offset="0%" stopColor={rankMeta.color} stopOpacity={isDark ? 0.18 : 0.1} />
                  <Stop offset="100%" stopColor={rankMeta.color} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="360" height="320" fill={`url(#rad_bg_base_${uid})`} />
              <Rect x="0" y="0" width="360" height="320" fill={`url(#rad_glow_c_${uid})`} />
              <Rect x="0" y="0" width="360" height="320" fill={`url(#rad_glow_br_${uid})`} />
              <Line
                x1="0"
                y1="262"
                x2="360"
                y2="48"
                stroke={isDark ? '#FFFFFF' : '#0F172A'}
                strokeOpacity={isDark ? 0.035 : 0.035}
                strokeWidth="1"
              />
              <Line
                x1="0"
                y1="1"
                x2="360"
                y2="1"
                stroke="#FFFFFF"
                strokeOpacity={isDark ? 0.11 : 0.85}
                strokeWidth="1.5"
              />
            </Svg>
          </View>

          <AnimatedRadarComparison
            axes={radarAxes}
            myLabel={t('friendsYouLabel')}
            friendLabel={`@${friend.nickname}`}
            friendColor={rankMeta.color}
            triggerKey={`${friend.userId}_${visible}`}
          />
        </View>
      </View>

      {/* Top Muscle Groups (Compact 3-Column Row) */}
      {friend.topMuscles && friend.topMuscles.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
            {t('friendsTopMusclesHeading')}
          </Text>
          <View style={styles.topMusclesRow}>
            {friend.topMuscles.slice(0, 3).map((m) => (
              <View
                key={m.muscleId}
                style={[
                  styles.muscleCompactTile,
                  {
                    backgroundColor: surfaceTileBg,
                    borderColor: surfaceTileBorder,
                  },
                ]}
              >
                <RankCrestIcon tier={m.rank} size={32} isSelected />
                <Text
                  style={[styles.muscleCompactName, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {muscleLabel(m.muscleId)}
                </Text>
                <Text style={[styles.muscleCompactSets, { color: theme.textMuted }]}>
                  {m.effectiveSetsTotal} {t('friendsSetsCountShort')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent PRs Grouped Card */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
          {t('friendsRecentPrsHeading')}
        </Text>
        <View
          style={[
            styles.prGroupCard,
            {
              backgroundColor: surfaceTileBg,
              borderColor: surfaceTileBorder,
            },
          ]}
        >
          {friend.recentPrs && friend.recentPrs.length > 0 ? (
            friend.recentPrs.map((pr, idx) => (
              <View
                key={`${pr.exerciseId}-${idx}`}
                style={[
                  styles.prRow,
                  idx < (friend.recentPrs?.length || 0) - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.hairline,
                  },
                ]}
              >
                <View style={styles.prIconDot}>
                  <Ionicons name="trophy" size={13} color="#F59E0B" />
                </View>
                <Text style={[styles.prName, { color: theme.text }]} numberOfLines={1}>
                  {pr.exerciseName}
                </Text>
                <View
                  style={[
                    styles.prValPill,
                    { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)' },
                  ]}
                >
                  <Text style={[styles.prVal, { color: theme.text }]}>
                    {pr.weight} kg × {pr.reps}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={[styles.emptyPrText, { color: theme.textMuted }]}>
              {t('friendsNoPrsYet')}
            </Text>
          )}
        </View>
      </View>

      {/* Subtle Destructive Footer Action */}
      <TouchableOpacity
        style={styles.removeFooterBtn}
        onPress={handleConfirmRemove}
        activeOpacity={0.75}
      >
        <Ionicons name="person-remove-outline" size={15} color={theme.danger} />
        <Text style={[styles.removeFooterText, { color: theme.danger }]}>
          {t('friendsRemoveBtn')}
        </Text>
      </TouchableOpacity>
    </>
  );

  if (embeddedOverlay) {
    return (
      <Animated.View style={[styles.overlayRoot, { opacity: overlayFade }]}>
        <Pressable style={styles.overlayBackdrop} onPress={closeEmbeddedAnimated} />
        <Animated.View
          {...embeddedBodyPanResponder.panHandlers}
          style={[
            styles.overlaySheet,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              maxHeight: SCREEN_HEIGHT * 0.89,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: overlaySlide }],
            },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            contentInsetAdjustmentBehavior="never"
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS === 'ios'}
            alwaysBounceVertical={Platform.OS === 'ios'}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              embeddedDraggingRef.current = true;
            }}
            onScroll={(e) => {
              const y = e.nativeEvent.contentOffset.y;
              embeddedScrollYRef.current = y;
              if (Platform.OS === 'ios' && embeddedDraggingRef.current && !embeddedClosingRef.current) {
                if (y < 0) {
                  overlaySlide.setValue(Math.min(SCREEN_HEIGHT * 0.72, Math.abs(y) * 1.15));
                } else {
                  overlaySlide.setValue(0);
                }
              }
            }}
            onScrollEndDrag={(e) => {
              const wasDragging = embeddedDraggingRef.current;
              embeddedDraggingRef.current = false;
              if (Platform.OS === 'ios' && wasDragging && !embeddedClosingRef.current) {
                const y = e.nativeEvent.contentOffset.y;
                const vy = e.nativeEvent.velocity?.y ?? 0;
                if (y <= -38 || (y <= -8 && vy <= -0.35)) {
                  triggerSelectionHaptic();
                  closeEmbeddedAnimated();
                  return;
                }
                if (y < 0) {
                  snapEmbeddedBack();
                }
              }
            }}
          >
            {profileBody}
          </ScrollView>

          {/* Transparent floating drag handle + close button directly inside hero cover */}
          <View
            {...embeddedTopPanResponder.panHandlers}
            style={styles.overlayFloatingTopBar}
            pointerEvents="box-none"
          >
            <View style={styles.overlayHandleTapZone}>
              <View
                style={[
                  styles.overlayHandle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.28)'
                      : 'rgba(15,23,42,0.22)',
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              onPress={() => {
                triggerSelectionHaptic();
                closeEmbeddedAnimated();
              }}
              style={[
                styles.overlayFloatingClose,
                {
                  backgroundColor: isDark
                    ? 'rgba(15, 23, 42, 0.56)'
                    : 'rgba(255, 255, 255, 0.78)',
                  borderColor: isDark
                    ? 'rgba(255, 255, 255, 0.16)'
                    : 'rgba(15, 23, 42, 0.12)',
                },
              ]}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      fullBleed
      initialHeightPercent={0.89}
    >
      <BottomSheetScrollView
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
      >
        {profileBody}
      </BottomSheetScrollView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 80,
    elevation: 25,
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  overlaySheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  overlayFloatingTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 155,
    zIndex: 25,
    alignItems: 'center',
  },
  overlayHandleTapZone: {
    paddingTop: 11,
    paddingBottom: 12,
    paddingHorizontal: 36,
    alignItems: 'center',
  },
  overlayHandle: {
    width: 44,
    height: 4.5,
    borderRadius: 3,
  },
  overlayFloatingClose: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 38,
  },
  heroShell: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 42,
    paddingBottom: 6,
    marginBottom: 14,
  },
  coverAtmosphere: {
    position: 'absolute',
    top: -360,
    left: -18,
    right: -18,
    height: 605,
    overflow: 'hidden',
  },
  coverTopOverscrollCap: {
    width: '100%',
    height: 360,
  },
  cheerStreakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cheerStreakText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  emblemStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 112,
    height: 112,
    marginBottom: 10,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  identityPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  identityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identityHandleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  identityRankText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '92%',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  messagePrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 14,
  },
  messagePrimaryBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  telemetryRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginBottom: 20,
  },
  telemetryRibbonCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 3,
  },
  telemetryRibbonValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  telemetryRibbonValue: {
    fontSize: 16.5,
    fontWeight: '900',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
  telemetryRibbonLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  telemetryRibbonDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  arenaBgLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  compareHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  tallyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tallyPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  vsArenaCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  vsCrestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  vsFighterCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  vsFighterName: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
  },
  vsRankTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  vsFighterSub: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  vsCenterBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsCenterText: {
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  radarWrap: {
    alignItems: 'center',
  },
  radarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 12,
  },
  radarLegendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  radarLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  radarLegendText: {
    fontSize: 11,
    fontWeight: '800',
  },
  radarBreakdownRow: {
    width: '100%',
    flexDirection: 'row',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  radarBreakdownCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  radarBreakdownLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  radarBreakdownVal: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  topMusclesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  muscleCompactTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  muscleCompactName: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  muscleCompactSets: {
    fontSize: 10.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  prGroupCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
  },
  prIconDot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  prName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
  },
  prValPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  prVal: {
    fontSize: 12.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  emptyPrText: {
    fontSize: 12.5,
    fontWeight: '600',
    paddingVertical: 12,
  },
  removeFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 2,
    opacity: 0.85,
  },
  removeFooterText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
