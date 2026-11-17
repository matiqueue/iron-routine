import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
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
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
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
  onRemoveFriend: (friend: FriendProfileSummary) => Promise<void> | void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const RANK_SCORE_ORDER: RankTier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+'];

function rankToScore(tier?: RankTier, pct = 0): number {
  const idx = Math.max(0, RANK_SCORE_ORDER.indexOf(tier || 'F'));
  return idx * 100 + Math.min(99, Math.max(0, pct));
}

/**
 * Crisp 60fps SVG rotating multi-stop energy halo around profile avatar.
 */
const AvatarHaloRing: React.FC<{ color: string; size?: number }> = React.memo(
  ({ color, size = 108 }) => {
    const uid = useId().replace(/:/g, '_');
    const rot = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      rot.setValue(0);
      const loop = Animated.loop(
        Animated.timing(rot, {
          toValue: 1,
          duration: 4600,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    }, [rot]);

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
            <LinearGradient id={`halo_grad_${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity={1} />
              <Stop offset="45%" stopColor="#38BDF8" stopOpacity={0.95} />
              <Stop offset="100%" stopColor="#10B981" stopOpacity={0.35} />
            </LinearGradient>
          </Defs>
          <Circle
            cx="120"
            cy="120"
            r="108"
            fill="none"
            stroke={`url(#halo_grad_${uid})`}
            strokeWidth="5"
            strokeDasharray="110 38 60 32"
            strokeLinecap="round"
          />
          <Circle
            cx="120"
            cy="120"
            r="96"
            fill="none"
            stroke={color}
            strokeOpacity={0.28}
            strokeWidth="2.5"
          />
          <Circle cx="120" cy="12" r="5.5" fill={color} />
          <Circle cx="120" cy="228" r="4" fill="#38BDF8" />
        </Svg>
      </Animated.View>
    );
  }
);

interface RadarAxis {
  label: string;
  myVal: number;
  friendVal: number;
  max: number;
}

/**
 * Animated 5-Axis Head-to-Head SVG Radar Chart (compares 5 metrics in one unified graphic).
 */
const AnimatedRadarComparison: React.FC<{
  axes: RadarAxis[];
  myLabel: string;
  friendLabel: string;
  friendColor: string;
  triggerKey: string;
}> = React.memo(({ axes, myLabel, friendLabel, friendColor, triggerKey }) => {
  const { theme, isDark } = useAppTheme();
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now();
    const duration = 640;
    const tick = () => {
      const elapsed = Date.now() - start;
      const raw = Math.min(1, elapsed / duration);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - raw, 3);
      setReveal(eased);
      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    setReveal(0.05);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [triggerKey]);

  const w = 290;
  const h = 228;
  const cx = w / 2;
  const cy = 114;
  const maxR = 72;

  const getPoint = (idx: number, ratio: number) => {
    const angle = -Math.PI / 2 + (idx / axes.length) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
      lx: cx + Math.cos(angle) * (maxR + 22),
      ly: cy + Math.sin(angle) * (maxR + 18),
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

  const gridLineColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';

  return (
    <View style={styles.radarWrap}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* Web rings */}
        {[0.34, 0.67, 1].map((scale) => {
          const ringPts = axes.map((_, i) => getPoint(i, scale));
          return (
            <Polygon
              key={scale}
              points={toPolyStr(ringPts)}
              fill="none"
              stroke={gridLineColor}
              strokeWidth={scale === 1 ? 1.4 : 1}
              strokeDasharray={scale === 1 ? undefined : '4 4'}
            />
          );
        })}

        {/* Axis spokes & labels */}
        {axes.map((ax, i) => {
          const edge = getPoint(i, 1);
          return (
            <G key={ax.label}>
              <Line
                x1={cx}
                y1={cy}
                x2={edge.x}
                y2={edge.y}
                stroke={gridLineColor}
                strokeWidth={1}
              />
              <SvgText
                x={edge.lx}
                y={edge.ly + 4}
                textAnchor="middle"
                fill={theme.textSecondary}
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
          fill={friendColor}
          fillOpacity={0.25}
          stroke={friendColor}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* My polygon */}
        <Polygon
          points={toPolyStr(myPoints)}
          fill="#38BDF8"
          fillOpacity={0.24}
          stroke="#38BDF8"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />

        {/* Vertex dots */}
        {frPoints.map((pt, i) => (
          <Circle key={`f_${i}`} cx={pt.x} cy={pt.y} r="3.8" fill={friendColor} />
        ))}
        {myPoints.map((pt, i) => (
          <Circle key={`m_${i}`} cx={pt.x} cy={pt.y} r="3.8" fill="#38BDF8" />
        ))}
      </Svg>

      <View style={styles.radarLegendRow}>
        <View style={styles.radarLegendPill}>
          <View style={[styles.radarLegendDot, { backgroundColor: '#38BDF8' }]} />
          <Text style={[styles.radarLegendText, { color: theme.text }]}>{myLabel}</Text>
        </View>
        <View style={styles.radarLegendPill}>
          <View style={[styles.radarLegendDot, { backgroundColor: friendColor }]} />
          <Text style={[styles.radarLegendText, { color: theme.text }]}>{friendLabel}</Text>
        </View>
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
  onRemoveFriend,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, rankTitle } = useLanguage();
  const insets = useSafeAreaInsets();
  const uid = useId().replace(/:/g, '_');

  const vsPulse = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const vsLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(vsPulse, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(vsPulse, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    vsLoop.start();

    entranceAnim.setValue(0);
    Animated.timing(entranceAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (embeddedOverlay) {
      overlaySlide.setValue(SCREEN_HEIGHT * 0.6);
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
      vsLoop.stop();
    };
  }, [visible, friend?.userId, embeddedOverlay, vsPulse, entranceAnim, overlayFade, overlaySlide]);

  const radarAxes = useMemo<RadarAxis[]>(() => {
    if (!friend) return [];
    const myRankScore = rankToScore(myProfile?.overallRank, myProfile?.overallProgressPct || 0);
    const frRankScore = rankToScore(friend.overallRank, friend.overallProgressPct || 0);
    return [
      {
        label: t('friendsRankByTier'),
        myVal: myRankScore,
        friendVal: frRankScore,
        max: Math.max(200, myRankScore, frRankScore),
      },
      {
        label: t('friendsStreakLabel'),
        myVal: myProfile?.streak || 0,
        friendVal: friend.streak || 0,
        max: Math.max(7, myProfile?.streak || 0, friend.streak || 0),
      },
      {
        label: t('compareTotalWorkouts'),
        myVal: myProfile?.totalWorkouts || 0,
        friendVal: friend.totalWorkouts || 0,
        max: Math.max(10, myProfile?.totalWorkouts || 0, friend.totalWorkouts || 0),
      },
      {
        label: t('friendsWorkoutsWeekLabel'),
        myVal: myProfile?.weeklyWorkouts || 0,
        friendVal: friend.weeklyWorkouts || 0,
        max: Math.max(4, myProfile?.weeklyWorkouts || 0, friend.weeklyWorkouts || 0),
      },
      {
        label: t('friendsBalanceLabel'),
        myVal: myProfile?.balanceScorePct || 100,
        friendVal: friend.balanceScorePct || 100,
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

  const vsScale = vsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.09] });
  const heroTranslateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  const profileBody = (
    <>
      {/* Colorful Gradient Hero Card */}
      <Animated.View
        style={[
          styles.heroCard,
          {
            backgroundColor: isDark ? 'rgba(20, 22, 30, 0.85)' : 'rgba(248, 250, 252, 0.96)',
            borderColor: `${rankMeta.color}55`,
            opacity: entranceAnim,
            transform: [{ translateY: heroTranslateY }],
          },
        ]}
      >
        <Svg width="100%" height="100%" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          <Defs>
            <RadialGradient id={`hero_amb_${uid}`} cx="50%" cy="18%" r="72%">
              <Stop offset="0%" stopColor={rankMeta.color} stopOpacity={isDark ? 0.34 : 0.24} />
              <Stop offset="60%" stopColor="#38BDF8" stopOpacity={isDark ? 0.12 : 0.08} />
              <Stop offset="100%" stopColor={rankMeta.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="22%" r="65%" fill={`url(#hero_amb_${uid})`} />
        </Svg>

        <View style={styles.emblemStage}>
          <AvatarHaloRing color={rankMeta.color} size={108} />
          <UserAvatarBadge
            avatarUrl={friend.avatarUrl}
            displayName={friend.displayName}
            avatarColor={friend.avatarColor}
            rank={friend.overallRank || 'F'}
            size={80}
            ringColor={rankMeta.color}
            showRankDot
          />
        </View>

        <Text style={[styles.displayName, { color: theme.text }]}>{friend.displayName}</Text>
        <View style={styles.handleMetaRow}>
          <Text style={[styles.handleText, { color: '#10B981' }]}>@{friend.nickname}</Text>
          <View style={[styles.dotSep, { backgroundColor: theme.textMuted }]} />
          <Text style={[styles.rankNameText, { color: rankMeta.color }]}>
            {friend.overallRank} · {rankTitle(friend.overallRank || 'F')}
          </Text>
        </View>

        {friend.statusNote ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(15,23,42,0.06)',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.liveDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.statusBadgeText, { color: theme.textSecondary }]}>
              {friend.statusNote}
            </Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: rankMeta.color }]}
            onPress={() => {
              triggerSelectionHaptic();
              onClose();
              if (!embeddedOverlay) {
                onOpenChat(friend);
              }
            }}
            activeOpacity={0.86}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#09090B" />
            <Text style={[styles.primaryBtnText, { color: '#09090B' }]}>
              {t('friendsWriteMsgBtn')}
            </Text>
          </TouchableOpacity>

          <HighFiveSpamButton
            targetUserId={friend.userId}
            initialCount={friend.cheersCount || 0}
            cheeredByMe={friend.cheeredByMe}
            label={t('friendsKudosBtn')}
          />
        </View>
      </Animated.View>

      {/* Telemetry Strip */}
      <View
        style={[
          styles.telemetryStrip,
          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
        ]}
      >
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: '#F59E0B' }]}>{friend.streak || 0}</Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsStreakLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: '#38BDF8' }]}>
            {friend.weeklyWorkouts || 0}
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsWorkoutsWeekLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: '#10B981' }]}>
            {friend.balanceScorePct || 100}%
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsBalanceLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: rankMeta.color }]}>
            {friend.totalWorkouts || 0}
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsRankByWorkouts')}
          </Text>
        </View>
      </View>

      {/* Simplified 2-Graphic Animated Comparison Suite */}
      <View style={styles.sectionBlock}>
        <View style={styles.compareHeaderRow}>
          <Text style={[styles.sectionEyebrow, { color: theme.textMuted, marginBottom: 0 }]}>
            {t('friendsCompareHeading')}
          </Text>
          <View
            style={[
              styles.tallyPill,
              {
                backgroundColor: `${headlineColor}1F`,
                borderColor: `${headlineColor}66`,
              },
            ]}
          >
            <Text style={[styles.tallyPillText, { color: headlineColor }]}>
              {headToHeadHeadline}
            </Text>
          </View>
        </View>

        {/* Graphic #1: Unified Duel Gauge + Animated Crests */}
        <View
          style={[
            styles.vsArenaCard,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.vsCrestsRow}>
            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={myProfile?.overallRank || 'F'} size={48} isSelected animated />
              <Text style={[styles.vsFighterName, { color: '#38BDF8' }]} numberOfLines={1}>
                {t('friendsYouLabel')}
              </Text>
              <Text style={[styles.vsFighterSub, { color: theme.textMuted }]}>
                {myProfile?.overallRank || 'F'} · {myProfile?.overallProgressPct || 0}%
              </Text>
            </View>

            <Animated.View
              style={[
                styles.vsCenterBadge,
                {
                  borderColor: `${rankMeta.color}66`,
                  backgroundColor: isDark ? '#18181F' : '#FFFFFF',
                  transform: [{ scale: vsScale }],
                },
              ]}
            >
              <Text style={[styles.vsCenterText, { color: theme.text }]}>VS</Text>
            </Animated.View>

            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={friend.overallRank || 'F'} size={48} isSelected animated />
              <Text style={[styles.vsFighterName, { color: rankMeta.color }]} numberOfLines={1}>
                @{friend.nickname}
              </Text>
              <Text style={[styles.vsFighterSub, { color: theme.textMuted }]}>
                {friend.overallRank} · {friend.overallProgressPct || 0}%
              </Text>
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

        {/* Graphic #2: Multi-Axis Animated Radar Spider Chart */}
        <View
          style={[
            styles.vsArenaCard,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border, marginBottom: 0 },
          ]}
        >
          <AnimatedRadarComparison
            axes={radarAxes}
            myLabel={t('friendsYouLabel')}
            friendLabel={`@${friend.nickname}`}
            friendColor={rankMeta.color}
            triggerKey={`${friend.userId}_${visible}`}
          />
        </View>
      </View>

      {/* Top Muscle Groups */}
      {friend.topMuscles && friend.topMuscles.length > 0 && (
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
            {t('friendsTopMusclesHeading')}
          </Text>
          <View style={styles.topMusclesGrid}>
            {friend.topMuscles.map((m) => (
              <View
                key={m.muscleId}
                style={[
                  styles.musclePillCard,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
              >
                <RankCrestIcon tier={m.rank} size={30} isSelected />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[styles.musclePillName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {muscleLabel(m.muscleId)}
                  </Text>
                  <Text style={[styles.musclePillSets, { color: theme.textMuted }]}>
                    {m.effectiveSetsTotal} {t('friendsSetsCountShort')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Recent PRs */}
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
          {t('friendsRecentPrsHeading')}
        </Text>
        {friend.recentPrs && friend.recentPrs.length > 0 ? (
          friend.recentPrs.map((pr, idx) => (
            <View
              key={`${pr.exerciseId}-${idx}`}
              style={[styles.prRow, { borderBottomColor: theme.hairline }]}
            >
              <View style={styles.prIconDot}>
                <Ionicons name="trophy-outline" size={14} color="#F59E0B" />
              </View>
              <Text style={[styles.prName, { color: theme.text }]} numberOfLines={1}>
                {pr.exerciseName}
              </Text>
              <Text style={[styles.prVal, { color: theme.text }]}>
                {pr.weight} kg × {pr.reps}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyPrText, { color: theme.textMuted }]}>
            {t('friendsNoPrsYet')}
          </Text>
        )}
      </View>

      {/* Destructive Remove Friend */}
      <TouchableOpacity
        style={[styles.removeBtn, { borderColor: 'rgba(239, 68, 68, 0.35)' }]}
        onPress={handleConfirmRemove}
        activeOpacity={0.8}
      >
        <Ionicons name="person-remove-outline" size={16} color={theme.danger} />
        <Text style={[styles.removeBtnText, { color: theme.danger }]}>
          {t('friendsRemoveBtn')}
        </Text>
      </TouchableOpacity>
    </>
  );

  if (embeddedOverlay) {
    return (
      <Animated.View style={[styles.overlayRoot, { opacity: overlayFade }]}>
        <Pressable style={styles.overlayBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.overlaySheet,
            {
              backgroundColor: theme.bg,
              borderColor: theme.border,
              maxHeight: SCREEN_HEIGHT * 0.88,
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: overlaySlide }],
            },
          ]}
        >
          <View style={styles.overlayHandleRow}>
            <View style={[styles.overlayHandle, { backgroundColor: theme.border }]} />
          </View>
          <View style={[styles.overlayHeaderRow, { borderBottomColor: theme.hairline }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.overlayTitle, { color: theme.text }]}>@{friend.nickname}</Text>
              <Text style={[styles.overlaySub, { color: theme.textMuted }]}>{friend.displayName}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.overlayCloseBtn, { backgroundColor: theme.bgSecondary }]}
              activeOpacity={0.75}
            >
              <Ionicons name="close" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {profileBody}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    );
  }

  return (
    <InteractiveBottomSheet
      visible={visible}
      onClose={onClose}
      title={`@${friend.nickname}`}
      subtitle={friend.displayName}
    >
      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
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
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  overlaySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  overlayHandleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  overlayHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  overlayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  overlayTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  overlaySub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  overlayCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
  },
  heroCard: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  emblemStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 112,
    height: 112,
    marginBottom: 8,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  handleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  handleText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dotSep: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  rankNameText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    marginBottom: 20,
  },
  teleCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  teleValue: {
    fontSize: 17.5,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  teleLabel: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  teleDiv: {
    width: StyleSheet.hairlineWidth,
    height: 26,
  },
  sectionBlock: {
    marginBottom: 22,
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
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  vsCrestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  vsFighterSub: {
    fontSize: 10.5,
    fontWeight: '700',
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
    fontSize: 12,
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
    gap: 18,
    marginTop: 4,
  },
  radarLegendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radarLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  radarLegendText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  topMusclesGrid: {
    gap: 8,
  },
  musclePillCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  musclePillName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  musclePillSets: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
  prVal: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emptyPrText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  removeBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
});
