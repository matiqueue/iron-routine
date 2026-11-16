import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { FriendProfileSummary, RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { RankCrestIcon } from './RankCrestIcon';
import { UserAvatarBadge } from './UserAvatarBadge';
import { VsComparisonArc } from './CrewCustomComponents';
import { InteractiveBottomSheet, BottomSheetScrollView } from './InteractiveBottomSheet';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';

interface FriendProfileModalProps {
  visible: boolean;
  friend: FriendProfileSummary | null;
  myProfile: FriendProfileSummary | null;
  onClose: () => void;
  onOpenChat: (friend: FriendProfileSummary) => void;
  onSendKudos: (friend: FriendProfileSummary) => Promise<void> | void;
  onRemoveFriend: (friend: FriendProfileSummary) => Promise<void> | void;
}

const RANK_SCORE_ORDER: RankTier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+'];

function rankToScore(tier?: RankTier, pct = 0): number {
  const idx = Math.max(0, RANK_SCORE_ORDER.indexOf(tier || 'F'));
  return idx * 100 + Math.min(99, Math.max(0, pct));
}

export const FriendProfileModal: React.FC<FriendProfileModalProps> = ({
  visible,
  friend,
  myProfile,
  onClose,
  onOpenChat,
  onSendKudos,
  onRemoveFriend,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, muscleLabel, rankTitle } = useLanguage();
  const [sendingKudos, setSendingKudos] = useState(false);

  const auraPulse = useRef(new Animated.Value(0)).current;
  const kudosBounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraPulse, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(auraPulse, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, auraPulse]);

  if (!friend) return null;

  const rankMeta = RANK_TIER_MAP[friend.overallRank] || RANK_TIER_MAP.F;
  const myScore = rankToScore(myProfile?.overallRank, myProfile?.overallProgressPct || 0);
  const friendScore = rankToScore(friend.overallRank, friend.overallProgressPct || 0);

  const handlePressKudos = async () => {
    if (sendingKudos) return;
    setSendingKudos(true);
    triggerNotificationHaptic('success');
    kudosBounce.setValue(0.84);
    Animated.spring(kudosBounce, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: true,
    }).start();
    try {
      await onSendKudos(friend);
    } finally {
      setSendingKudos(false);
    }
  };

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

  const compareMetrics = [
    {
      label: t('friendsRankByTier'),
      myText: `${myProfile?.overallRank || 'F'} (${myProfile?.overallProgressPct || 0}%)`,
      friendText: `${friend.overallRank} (${friend.overallProgressPct || 0}%)`,
      myVal: Math.max(10, myScore),
      friendVal: Math.max(10, friendScore),
    },
    {
      label: t('friendsStreakLabel'),
      myText: `${myProfile?.streak || 0} ${t('friendsDaysShort')}`,
      friendText: `${friend.streak || 0} ${t('friendsDaysShort')}`,
      myVal: myProfile?.streak || 0,
      friendVal: friend.streak || 0,
    },
    {
      label: t('friendsWorkoutsWeekLabel'),
      myText: String(myProfile?.weeklyWorkouts || 0),
      friendText: String(friend.weeklyWorkouts || 0),
      myVal: myProfile?.weeklyWorkouts || 0,
      friendVal: friend.weeklyWorkouts || 0,
    },
    {
      label: t('friendsBalanceLabel'),
      myText: `${myProfile?.balanceScorePct || 100}%`,
      friendText: `${friend.balanceScorePct || 100}%`,
      myVal: myProfile?.balanceScorePct || 0,
      friendVal: friend.balanceScorePct || 0,
    },
  ];

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
              size={78}
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
                onOpenChat(friend);
              }}
              activeOpacity={0.86}
            >
              <Ionicons name="chatbubble-ellipses" size={16} color={theme.primaryText} />
              <Text style={[styles.primaryBtnText, { color: theme.primaryText }]}>
                {t('friendsWriteMsgBtn')}
              </Text>
            </TouchableOpacity>

            <Animated.View style={{ transform: [{ scale: kudosBounce }] }}>
              <TouchableOpacity
                style={[
                  styles.kudosBtn,
                  {
                    backgroundColor: friend.cheeredByMe
                      ? 'rgba(16, 185, 129, 0.16)'
                      : theme.bgSecondary,
                    borderColor: friend.cheeredByMe ? '#10B981' : theme.border,
                  },
                ]}
                onPress={handlePressKudos}
                disabled={sendingKudos}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="flame"
                  size={16}
                  color={friend.cheeredByMe ? '#10B981' : '#F59E0B'}
                />
                <Text style={[styles.kudosBtnText, { color: theme.text }]}>
                  {t('friendsKudosBtn')} ({friend.cheersCount || 0})
                </Text>
              </TouchableOpacity>
            </Animated.View>
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

        {/* 1v1 Head-to-Head Comparison */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionEyebrow, { color: theme.textMuted }]}>
            {t('friendsCompareHeading')}
          </Text>
          <VsComparisonArc
            myLabel={`${t('friendsYouLabel')} (${myProfile?.overallRank || 'F'})`}
            friendLabel={`@${friend.nickname} (${friend.overallRank})`}
            myScore={Math.max(10, myScore)}
            friendScore={Math.max(10, friendScore)}
            friendColor={rankMeta.color}
          />
          {compareMetrics.map((row) => {
            const maxVal = Math.max(1, row.myVal, row.friendVal);
            const myPct = Math.max(8, Math.round((row.myVal / maxVal) * 100));
            const frPct = Math.max(8, Math.round((row.friendVal / maxVal) * 100));
            const friendLeads = row.friendVal > row.myVal;

            return (
              <View
                key={row.label}
                style={[styles.compareCard, { borderBottomColor: theme.hairline }]}
              >
                <View style={styles.compareLabelRow}>
                  <Text style={[styles.compareSideVal, { color: theme.text }]}>
                    {t('friendsYouLabel')}: {row.myText}
                  </Text>
                  <Text style={[styles.compareMetricName, { color: theme.textMuted }]}>
                    {row.label}
                  </Text>
                  <Text
                    style={[
                      styles.compareSideVal,
                      { color: friendLeads ? '#10B981' : theme.textSecondary },
                    ]}
                  >
                    {row.friendText}
                  </Text>
                </View>
                <View style={styles.dualBarRow}>
                  <View style={[styles.dualTrackLeft, { backgroundColor: theme.bgSecondary }]}>
                    <View
                      style={[
                        styles.dualFillLeft,
                        { width: `${myPct}%`, backgroundColor: '#38BDF8' },
                      ]}
                    />
                  </View>
                  <View style={[styles.dualTrackRight, { backgroundColor: theme.bgSecondary }]}>
                    <View
                      style={[
                        styles.dualFillRight,
                        { width: `${frPct}%`, backgroundColor: rankMeta.color },
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
      </BottomSheetScrollView>
    </InteractiveBottomSheet>
  );
};

const styles = StyleSheet.create({
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
  kudosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  kudosBtnText: {
    fontSize: 13,
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
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  compareCard: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compareLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compareSideVal: {
    fontSize: 11.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  compareMetricName: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dualBarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dualTrackLeft: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  dualFillLeft: {
    height: '100%',
    borderRadius: 3,
  },
  dualTrackRight: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  dualFillRight: {
    height: '100%',
    borderRadius: 3,
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
