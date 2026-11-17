import React, { useEffect, useRef, useState } from 'react';
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

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  visible,
  friend,
  myProfile,
  embeddedOverlay = false,
  onClose,
  onOpenChat,
  onSendKudos,
  onRemoveFriend,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, rankTitle } = useLanguage();
  const insets = useSafeAreaInsets();
  const [sendingKudos, setSendingKudos] = useState(false);

  const auraPulse = useRef(new Animated.Value(0)).current;
  const vsPulse = useRef(new Animated.Value(0)).current;
  const overlaySlide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const barProgressAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    if (!visible) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulse, {
          toValue: 1,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraPulse, {
          toValue: 0,
          duration: 1850,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const vsLoop = Animated.loop(
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

    barProgressAnims.forEach((a) => a.setValue(0));
    const barsAnim = Animated.stagger(
      85,
      barProgressAnims.map((a) =>
        Animated.timing(a, {
          toValue: 1,
          duration: 540,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      )
    );

    loop.start();
    vsLoop.start();
    barsAnim.start();

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
      loop.stop();
      vsLoop.stop();
      barsAnim.stop();
    };
  }, [visible, friend?.userId, embeddedOverlay, auraPulse, vsPulse, barProgressAnims, overlayFade, overlaySlide]);

  if (!friend || (embeddedOverlay && !visible)) return null;

  const rankMeta = RANK_TIER_MAP[friend.overallRank] || RANK_TIER_MAP.F;
  const myRankMeta = RANK_TIER_MAP[myProfile?.overallRank || 'F'] || RANK_TIER_MAP.F;
  const myScore = rankToScore(myProfile?.overallRank, myProfile?.overallProgressPct || 0);
  const friendScore = rankToScore(friend.overallRank, friend.overallProgressPct || 0);

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

  const auraScale = auraPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const auraOpacity = auraPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.72] });
  const vsScale = vsPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.09] });

  const compareMetrics = [
    {
      label: t('friendsRankByTier'),
      icon: 'ribbon-outline' as const,
      myText: `${myProfile?.overallRank || 'F'} (${myProfile?.overallProgressPct || 0}%)`,
      friendText: `${friend.overallRank} (${friend.overallProgressPct || 0}%)`,
      myVal: Math.max(10, myScore),
      friendVal: Math.max(10, friendScore),
    },
    {
      label: t('friendsStreakLabel'),
      icon: 'flame-outline' as const,
      myText: `${myProfile?.streak || 0} ${t('friendsDaysShort')}`,
      friendText: `${friend.streak || 0} ${t('friendsDaysShort')}`,
      myVal: myProfile?.streak || 0,
      friendVal: friend.streak || 0,
    },
    {
      label: t('compareTotalWorkouts'),
      icon: 'barbell-outline' as const,
      myText: String(myProfile?.totalWorkouts || 0),
      friendText: String(friend.totalWorkouts || 0),
      myVal: myProfile?.totalWorkouts || 0,
      friendVal: friend.totalWorkouts || 0,
    },
    {
      label: t('friendsWorkoutsWeekLabel'),
      icon: 'calendar-outline' as const,
      myText: String(myProfile?.weeklyWorkouts || 0),
      friendText: String(friend.weeklyWorkouts || 0),
      myVal: myProfile?.weeklyWorkouts || 0,
      friendVal: friend.weeklyWorkouts || 0,
    },
    {
      label: t('friendsBalanceLabel'),
      icon: 'pulse-outline' as const,
      myText: `${myProfile?.balanceScorePct || 100}%`,
      friendText: `${friend.balanceScorePct || 100}%`,
      myVal: myProfile?.balanceScorePct || 0,
      friendVal: friend.balanceScorePct || 0,
    },
  ];

  let myWins = 0;
  let friendWins = 0;
  for (const row of compareMetrics) {
    if (row.myVal > row.friendVal) myWins++;
    else if (row.friendVal > row.myVal) friendWins++;
  }

  const headToHeadHeadline =
    myWins > friendWins
      ? `${t('compareYouLead')} · ${myWins} : ${friendWins}`
      : friendWins > myWins
      ? `${t('compareFriendLeads', { nick: friend.nickname })} · ${friendWins} : ${myWins}`
      : `${t('compareTie')} · ${myWins} : ${friendWins}`;

  const headlineColor =
    myWins > friendWins ? '#38BDF8' : friendWins > myWins ? rankMeta.color : theme.textSecondary;

  const profileBody = (
    <>
      {/* Hero Athlete Emblem + Ambient Rank Aura */}
      <View style={styles.heroWrap}>
        <View style={styles.emblemStage}>
          <Animated.View
            style={[
              styles.auraRing,
              {
                borderColor: rankMeta.color,
                backgroundColor: `${rankMeta.color}16`,
                opacity: auraOpacity,
                transform: [{ scale: auraScale }],
              },
            ]}
          />
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
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(24,24,27,0.05)',
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

        {/* Primary Actions: Message + Kudos */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => {
              triggerSelectionHaptic();
              onClose();
              if (!embeddedOverlay) {
                onOpenChat(friend);
              }
            }}
            activeOpacity={0.86}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color={theme.primaryText} />
            <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
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
      </View>

      {/* Telemetry Strip */}
      <View
        style={[
          styles.telemetryStrip,
          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
        ]}
      >
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: theme.text }]}>{friend.streak || 0}</Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsStreakLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: theme.text }]}>
            {friend.weeklyWorkouts || 0}
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsWorkoutsWeekLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: theme.text }]}>
            {friend.balanceScorePct || 100}%
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsBalanceLabel')}
          </Text>
        </View>
        <View style={[styles.teleDiv, { backgroundColor: theme.hairline }]} />
        <View style={styles.teleCell}>
          <Text style={[styles.teleValue, { color: theme.text }]}>
            {friend.totalWorkouts || 0}
          </Text>
          <Text style={[styles.teleLabel, { color: theme.textMuted }]}>
            {t('friendsRankByWorkouts')}
          </Text>
        </View>
      </View>

      {/* 1v1 Head-to-Head Animated Showcase */}
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

        <View
          style={[
            styles.vsArenaCard,
            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.vsCrestsRow}>
            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={myProfile?.overallRank || 'F'} size={44} isSelected />
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
                  borderColor: theme.border,
                  backgroundColor: isDark ? '#18181F' : '#FFFFFF',
                  transform: [{ scale: vsScale }],
                },
              ]}
            >
              <Text style={[styles.vsCenterText, { color: theme.text }]}>VS</Text>
            </Animated.View>

            <View style={styles.vsFighterCol}>
              <RankCrestIcon tier={friend.overallRank || 'F'} size={44} isSelected />
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

        {compareMetrics.map((row, idx) => {
          const maxVal = Math.max(1, row.myVal, row.friendVal);
          const myPct = Math.max(8, Math.round((row.myVal / maxVal) * 100));
          const frPct = Math.max(8, Math.round((row.friendVal / maxVal) * 100));
          const friendLeads = row.friendVal > row.myVal;
          const myLeads = row.myVal > row.friendVal;
          const anim = barProgressAnims[idx] || barProgressAnims[0];

          const myWidth = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', `${myPct}%`],
          });
          const frWidth = anim.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', `${frPct}%`],
          });

          return (
            <View
              key={row.label}
              style={[styles.compareCard, { borderBottomColor: theme.hairline }]}
            >
              <View style={styles.compareLabelRow}>
                <View style={styles.compareSideWrap}>
                  {myLeads && <View style={[styles.winDot, { backgroundColor: '#38BDF8' }]} />}
                  <Text
                    style={[
                      styles.compareSideVal,
                      { color: myLeads ? '#38BDF8' : theme.text },
                    ]}
                  >
                    {row.myText}
                  </Text>
                </View>

                <View style={styles.compareMetricMid}>
                  <Ionicons name={row.icon} size={11.5} color={theme.textMuted} />
                  <Text style={[styles.compareMetricName, { color: theme.textMuted }]}>
                    {row.label}
                  </Text>
                </View>

                <View style={[styles.compareSideWrap, { justifyContent: 'flex-end' }]}>
                  <Text
                    style={[
                      styles.compareSideVal,
                      { color: friendLeads ? rankMeta.color : theme.textSecondary },
                    ]}
                  >
                    {row.friendText}
                  </Text>
                  {friendLeads && (
                    <View style={[styles.winDot, { backgroundColor: rankMeta.color }]} />
                  )}
                </View>
              </View>
              <View style={styles.dualBarRow}>
                <View style={[styles.dualTrackLeft, { backgroundColor: theme.bgSecondary }]}>
                  <Animated.View
                    style={[
                      styles.dualFillLeft,
                      { width: myWidth, backgroundColor: myRankMeta.color === '#38BDF8' ? '#38BDF8' : '#38BDF8' },
                    ]}
                  />
                </View>
                <View style={[styles.dualTrackRight, { backgroundColor: theme.bgSecondary }]}>
                  <Animated.View
                    style={[
                      styles.dualFillRight,
                      { width: frWidth, backgroundColor: rankMeta.color },
                    ]}
                  />
                </View>
              </View>
            </View>
          );
        })}
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
    paddingBottom: 34,
  },
  heroWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  emblemStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 102,
    height: 102,
    marginBottom: 8,
  },
  auraRing: {
    position: 'absolute',
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 1.5,
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
    fontSize: 17,
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
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  compareCard: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    gap: 6,
  },
  compareSideWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  winDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  compareSideVal: {
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  compareMetricMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compareMetricName: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dualBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dualTrackLeft: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dualFillLeft: {
    height: '100%',
    borderRadius: 3.5,
  },
  dualTrackRight: {
    flex: 1,
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
  },
  dualFillRight: {
    height: '100%',
    borderRadius: 3.5,
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
