import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useIsScreenActive } from '../context/TabActivityContext';
import {
  FriendProfileSummary,
  PendingCheerBurst,
  RankTier,
  SocialHubData,
  UserProfile,
} from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import {
  buildAndPublishSocialProfile,
  claimNicknameInCloud,
  fetchSocialHub,
  getCachedSocialHub,
  prefetchRecentChats,
  removeFriend,
  respondToFriendRequest,
  searchUsersByNickname,
  sendFriendRequest,
  sendSocialCheer,
  SocialSearchResult,
} from '../services/social';
import {
  CloudSession,
  getStoredCloudSession,
  pullProfileFromCloud,
  pushProfileToCloud,
  signInWithAppleCloud,
  signInWithGoogleCloud,
} from '../services/cloudSync';
import { updateProfile } from '../services/storage';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import {
  dismissChatNotificationsForFriend,
  ensureNotificationPermissions,
} from '../services/notifications';
import { sanitizeNicknameInput } from '../utils/nickname';
import { MinimalistBackdrop } from './MinimalistBackdrop';
import { RankCrestIcon } from './RankCrestIcon';
import { UserAvatarBadge } from './UserAvatarBadge';
import {
  CrewPodiumStage,
  CrewRadarOrb,
  SquadAvatarRing,
} from './CrewCustomComponents';
import { SegmentedGlassTabItem, SegmentedGlassTabs } from './SegmentedGlassTabs';
import { SmartScrollView } from './SmartScrollView';
import { StatusPickerModal } from './StatusPickerModal';
import { FriendProfileModal } from './FriendProfileModal';
import { FriendChatModal } from './FriendChatModal';
import { HighFiveSpamButton } from './HighFiveSpamButton';

type FriendsSubTab = 'chats' | 'feed' | 'rank' | 'add';
type LeaderboardMetric = 'rank' | 'streak' | 'workouts';

interface FriendsTabProps {
  activeProfile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onUnreadCountChanged?: (count: number) => void;
  onDataImported?: () => Promise<void> | void;
  pendingInviteNick?: { nick: string; seq: number } | null;
  pendingChatFriend?: { friendId: string; seq: number } | null;
  onActiveChatFriendChanged?: (friendId: string | null) => void;
  onCheerBursts?: (bursts: PendingCheerBurst[]) => void;
  isTabActive?: boolean;
}

const RANK_ORDER: RankTier[] = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+'];

function rankScore(rank?: RankTier, pct = 0): number {
  const idx = Math.max(0, RANK_ORDER.indexOf(rank || 'F'));
  return idx * 100 + (pct || 0);
}

const SUB_TABS: Array<{
  key: FriendsSubTab;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: 'friendsSegChats' | 'friendsSegFeed' | 'friendsSegRank' | 'friendsSegAdd';
  accent: string;
}> = [
  { key: 'chats', icon: 'chatbubbles-outline', labelKey: 'friendsSegChats', accent: '#10B981' },
  { key: 'feed', icon: 'flame-outline', labelKey: 'friendsSegFeed', accent: '#F59E0B' },
  { key: 'rank', icon: 'trophy-outline', labelKey: 'friendsSegRank', accent: '#38BDF8' },
  { key: 'add', icon: 'person-add-outline', labelKey: 'friendsSegAdd', accent: '#A855F7' },
];

export const FriendsTab: React.FC<FriendsTabProps> = ({
  activeProfile,
  onProfileUpdated,
  onUnreadCountChanged,
  onDataImported,
  pendingInviteNick,
  pendingChatFriend,
  onActiveChatFriendChanged,
  onCheerBursts,
  isTabActive = true,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();

  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [busyProvider, setBusyProvider] = useState<'apple' | 'google' | null>(null);

  const [subTab, setSubTab] = useState<FriendsSubTab>('chats');
  const subTabRef = useRef<FriendsSubTab>('chats');

  const [hub, setHub] = useState<SocialHubData>({
    myProfile: null,
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    activities: [],
    totalUnread: 0,
  });
  const [loadingHub, setLoadingHub] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [leaderboardMetric, setLeaderboardMetric] = useState<LeaderboardMetric>('rank');

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SocialSearchResult[] | null>(null);

  const [selectedProfileFriend, setSelectedProfileFriend] =
    useState<FriendProfileSummary | null>(null);
  const [activeChatFriend, setActiveChatFriend] = useState<FriendProfileSummary | null>(null);
  const returnChatAfterProfileRef = useRef<FriendProfileSummary | null>(null);
  const pendingChatFriendIdRef = useRef<string | null>(null);

  const onActiveChatFriendChangedRef = useRef(onActiveChatFriendChanged);
  onActiveChatFriendChangedRef.current = onActiveChatFriendChanged;

  useEffect(() => {
    const activeId = activeChatFriend?.userId || null;
    onActiveChatFriendChangedRef.current?.(activeId);
    if (activeId) {
      void dismissChatNotificationsForFriend(activeId);
    }
  }, [activeChatFriend?.userId]);

  useEffect(() => {
    return () => {
      onActiveChatFriendChangedRef.current?.(null);
    };
  }, []);

  // Ambient & entrance animations (auto-paused when tab hidden or backgrounded)
  const isScreenActive = useIsScreenActive();
  const heroFloat = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(1)).current;
  const liveDotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTabActive || !isScreenActive) {
      heroFloat.stopAnimation();
      liveDotPulse.stopAnimation();
      return;
    }
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroFloat, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroFloat, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotPulse, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(liveDotPulse, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();
    pulseLoop.start();
    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [heroFloat, isTabActive, isScreenActive, liveDotPulse]);

  const switchSubTab = useCallback(
    (next: FriendsSubTab) => {
      if (next === subTabRef.current) return;
      subTabRef.current = next;
      setSubTab(next);
      contentFade.setValue(0.35);
      Animated.timing(contentFade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [contentFade]
  );

  const hasLoadedHubRef = useRef(false);
  const onUnreadRef = useRef(onUnreadCountChanged);
  onUnreadRef.current = onUnreadCountChanged;
  const onCheerBurstsRef = useRef(onCheerBursts);
  onCheerBurstsRef.current = onCheerBursts;

  useEffect(() => {
    subTabRef.current = subTab;
  }, [subTab]);

  useEffect(() => {
    hasLoadedHubRef.current = false;
  }, [activeProfile.id]);

  const loadSocialState = useCallback(
    async (withPublish = false) => {
      const session = await getStoredCloudSession();
      setCloudSession(session);
      if (!session?.token) return;

      const cached = await getCachedSocialHub(session.userId);
      if (cached && !hasLoadedHubRef.current) {
        hasLoadedHubRef.current = true;
        setHub(cached);
        onUnreadRef.current?.(cached.totalUnread || 0);
        if (cached.friends && cached.friends.length > 0) {
          void prefetchRecentChats(
            session.userId,
            cached.friends.map((f) => ({ userId: f.friend.userId, unreadCount: f.unreadCount }))
          );
        }
      }

      if (withPublish) {
        await buildAndPublishSocialProfile(activeProfile.id).catch(() => {});
      }

      const res = await fetchSocialHub();
      if (res.ok && res.hub) {
        hasLoadedHubRef.current = true;
        setHub(res.hub);
        onUnreadRef.current?.(res.hub.totalUnread || 0);
        if (res.hub.pendingCheerBursts && res.hub.pendingCheerBursts.length > 0) {
          onCheerBurstsRef.current?.(res.hub.pendingCheerBursts);
        }
        if (res.hub.friends && res.hub.friends.length > 0) {
          void prefetchRecentChats(
            session.userId,
            res.hub.friends.map((f) => ({ userId: f.friend.userId, unreadCount: f.unreadCount }))
          );
        }
      }
    },
    [activeProfile.id]
  );

  const handleChatMessagesChanged = useCallback(() => {
    void loadSocialState(false);
  }, [loadSocialState]);

  useEffect(() => {
    setLoadingHub(true);
    loadSocialState(true).finally(() => setLoadingHub(false));
  }, [activeProfile.id]);

  // Silent background refresh every 30s while viewing Friends tab in foreground
  useEffect(() => {
    if (!cloudSession?.token || !isTabActive) return;
    void loadSocialState(false);
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void loadSocialState(false);
    }, 30000);
    return () => clearInterval(timer);
  }, [cloudSession?.token, isTabActive, loadSocialState]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSocialState(true);
    setRefreshing(false);
  };

  const handleConnectCloud = async (provider: 'apple' | 'google') => {
    if (busyProvider) return;
    triggerSelectionHaptic();
    setBusyProvider(provider);
    try {
      const res =
        provider === 'apple'
          ? await signInWithAppleCloud(activeProfile.name)
          : await signInWithGoogleCloud(activeProfile.name);
      if (!res.ok || !res.session) {
        Alert.alert(t('cloudAuthTitle'), res.error || t('cloudConnectFailed'));
        return;
      }
      const session = res.session;
      setCloudSession(session);

      if (activeProfile.nickname) {
        await claimNicknameInCloud({
          nickname: activeProfile.nickname,
          displayName: activeProfile.name,
          enforceCooldown: false,
        }).catch(() => {});
      }

      const updated = await updateProfile(
        activeProfile.id,
        {
          cloudUserId: session.userId,
          cloudProvider: session.provider,
          cloudEmail: session.email,
        },
        { skipCloudSync: true }
      );
      onProfileUpdated(updated);
      await pushProfileToCloud(updated.id).catch(() => {});
      await loadSocialState(true);
      triggerNotificationHaptic('success');

      if (!res.isNewAccount && session.backupSummary) {
        Alert.alert(
          t('accountConnectedTitle'),
          t('cloudExistingBackupBody', {
            name: session.backupSummary.profileName,
            plans: session.backupSummary.plansCount,
            prs: session.backupSummary.prsCount,
          }),
          [
            { text: t('keepCurrentBtn'), style: 'cancel' },
            {
              text: t('restoreFromCloudBtn'),
              onPress: async () => {
                const pulled = await pullProfileFromCloud();
                if (pulled.ok && pulled.profile) {
                  onProfileUpdated(pulled.profile);
                  await onDataImported?.();
                }
              },
            },
          ]
        );
      }
    } catch (e: any) {
      Alert.alert(t('cloudAuthTitle'), e?.message || t('cloudConnectNetworkError'));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleSetStatusPreset = async (statusText: string) => {
    triggerSelectionHaptic();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowStatusPicker(false);
    const updated = await updateProfile(activeProfile.id, { statusNote: statusText });
    onProfileUpdated(updated);
    await buildAndPublishSocialProfile(updated.id);
    await loadSocialState(false);
  };

  const handleTogglePrivacy = async (nextVal: boolean) => {
    triggerSelectionHaptic();
    const updated = await updateProfile(activeProfile.id, { showActivityToFriends: nextVal });
    onProfileUpdated(updated);
    await buildAndPublishSocialProfile(updated.id);
    await loadSocialState(false);
  };

  const handleSearchNick = async () => {
    const clean = sanitizeNicknameInput(searchQuery);
    if (!clean) {
      setSearchResults(null);
      return;
    }
    triggerSelectionHaptic();
    setIsSearching(true);
    try {
      const res = await searchUsersByNickname(clean);
      setSearchResults(res.results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendInvite = async (targetNick?: string, targetUserId?: string) => {
    triggerSelectionHaptic();
    const res = await sendFriendRequest({
      targetNickname: targetNick,
      targetUserId,
    });
    if (!res.ok) {
      Alert.alert(t('errorTitle'), res.error || t('socialRequestFailedError'));
      return;
    }
    triggerNotificationHaptic('success');
    if (res.matched) {
      Alert.alert(t('friendsMatchedTitle'), t('friendsMatchedBody'));
    } else if (targetNick) {
      Alert.alert(
        t('friendsRequestSentTitle'),
        t('friendsRequestSentBody', { nick: targetNick })
      );
    }
    if (searchQuery.trim()) {
      const refetched = await searchUsersByNickname(searchQuery);
      setSearchResults(refetched.results);
    }
    await loadSocialState(false);
  };

  const handleRespondRequest = async (
    targetUserId: string,
    decision: 'accept' | 'decline' | 'cancel'
  ) => {
    triggerSelectionHaptic();
    const res = await respondToFriendRequest(targetUserId, decision);
    if (res.ok) {
      triggerNotificationHaptic('success');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      await loadSocialState(false);
    } else {
      Alert.alert(t('errorTitle'), res.error || t('socialRequestFailedError'));
    }
  };

  const handleSendKudos = async (friend: FriendProfileSummary) => {
    const res = await sendSocialCheer(friend.userId);
    if (res.ok) {
      await loadSocialState(false);
      if (selectedProfileFriend?.userId === friend.userId) {
        setSelectedProfileFriend((prev) =>
          prev
            ? {
                ...prev,
                cheersCount: res.cheersCount ?? (prev.cheersCount || 0) + 1,
                cheeredByMe: true,
              }
            : null
        );
      }
    }
  };

  const handleShareMyNick = () => {
    const nick = hub.myProfile?.nickname || activeProfile.nickname;
    if (!nick) return;
    triggerSelectionHaptic();
    const inviteUrl = `https://iron-routine-app.vercel.app/invite?nick=${encodeURIComponent(nick)}`;
    Share.share({
      message: t('friendsInviteShareMsg', { nick, url: inviteUrl }),
      url: inviteUrl,
    }).catch(() => {});
  };

  useEffect(() => {
    if (!pendingInviteNick?.seq) return;
    switchSubTab('add');
    const clean = sanitizeNicknameInput(pendingInviteNick.nick || '');
    if (!clean) return;
    setSearchQuery(clean);
    setIsSearching(true);
    searchUsersByNickname(clean)
      .then((res) => {
        setSearchResults(res.results);
      })
      .finally(() => {
        setIsSearching(false);
      });
  }, [pendingInviteNick?.seq, pendingInviteNick?.nick, switchSubTab]);

  useEffect(() => {
    if (!pendingChatFriend?.seq || !pendingChatFriend.friendId) return;
    switchSubTab('chats');
    const targetId = pendingChatFriend.friendId;
    const match = hub.friends.find((f) => f.friend.userId === targetId);
    if (match) {
      pendingChatFriendIdRef.current = null;
      setActiveChatFriend(match.friend);
    } else {
      pendingChatFriendIdRef.current = targetId;
      void loadSocialState(false);
    }
  }, [pendingChatFriend?.seq, pendingChatFriend?.friendId, switchSubTab]);

  useEffect(() => {
    const targetId = pendingChatFriendIdRef.current;
    if (!targetId || hub.friends.length === 0) return;
    const match = hub.friends.find((f) => f.friend.userId === targetId);
    if (match) {
      pendingChatFriendIdRef.current = null;
      setActiveChatFriend(match.friend);
    }
  }, [hub.friends]);

  useEffect(() => {
    if (cloudSession?.token) {
      void ensureNotificationPermissions(true);
    }
  }, [cloudSession?.token]);

  const formatRelativeTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return '<1m';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return d.toLocaleDateString(localeCode, { day: 'numeric', month: 'short' });
  };

  const myNick = hub.myProfile?.nickname || activeProfile.nickname || 'athlete';
  const myUserId = cloudSession?.userId || activeProfile.cloudUserId || activeProfile.id;
  const isCloudLoggedIn = Boolean(cloudSession?.token);

  const leaderboardEntries = useMemo(() => {
    const pool: Array<{ profile: FriendProfileSummary; isMe: boolean }> = [];
    if (hub.myProfile) {
      pool.push({
        profile: {
          ...hub.myProfile,
          avatarUrl: hub.myProfile.avatarUrl ?? activeProfile.avatarUrl ?? null,
          avatarColor: hub.myProfile.avatarColor || activeProfile.avatarColor,
        },
        isMe: true,
      });
    }
    for (const f of hub.friends) pool.push({ profile: f.friend, isMe: false });

    return pool.sort((a, b) => {
      if (leaderboardMetric === 'streak') {
        return (b.profile.streak || 0) - (a.profile.streak || 0);
      }
      if (leaderboardMetric === 'workouts') {
        return (b.profile.weeklyWorkouts || 0) - (a.profile.weeklyWorkouts || 0);
      }
      return (
        rankScore(b.profile.overallRank, b.profile.overallProgressPct) -
        rankScore(a.profile.overallRank, a.profile.overallProgressPct)
      );
    });
  }, [activeProfile.avatarColor, activeProfile.avatarUrl, hub.myProfile, hub.friends, leaderboardMetric]);

  const friendActivities = useMemo(
    () => (hub.activities || []).filter((act) => act.userId !== myUserId),
    [hub.activities, myUserId]
  );

  const cardFloatY = heroFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const liveScale = liveDotPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });

  const friendSegItems: SegmentedGlassTabItem<FriendsSubTab>[] = SUB_TABS.map((item) => ({
    key: item.key,
    label: t(item.labelKey),
    icon: item.icon,
    accent: item.accent,
    badge:
      item.key === 'chats'
        ? hub.friends.reduce((acc, f) => acc + (f.unreadCount || 0), 0)
        : item.key === 'add'
        ? hub.incomingRequests.length
        : 0,
  }));

  const friendsBackdropColors =
    subTab === 'chats'
      ? { top: '#10B981', bottom: '#14B8A6' }
      : subTab === 'feed'
      ? { top: '#F59E0B', bottom: '#F97316' }
      : subTab === 'rank'
      ? { top: '#38BDF8', bottom: '#6366F1' }
      : { top: '#A855F7', bottom: '#EC4899' };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <MinimalistBackdrop
        variant="diagonal"
        accentColor={friendsBackdropColors.top}
        secondaryColor={friendsBackdropColors.bottom}
      />

      {/* Open Editorial Header */}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: theme.hairline,
            paddingTop: Math.max(insets.top + 8, 16),
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: '#38BDF8' }]}>{t('friendsEyebrow')}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t('friendsTitle')}</Text>
          </View>

          <View style={styles.headerRightPills}>
            <TouchableOpacity
              onPress={handleShareMyNick}
              activeOpacity={0.8}
              style={[
                styles.nickPill,
                {
                  backgroundColor: `${friendsBackdropColors.top}1F`,
                  borderColor: `${friendsBackdropColors.top}66`,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.liveGreenDot,
                  {
                    backgroundColor: friendsBackdropColors.top,
                    transform: [{ scale: liveScale }],
                  },
                ]}
              />
              <Text
                style={[styles.nickPillText, { color: friendsBackdropColors.top }]}
                numberOfLines={1}
              >
                @{myNick}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isCloudLoggedIn && (
          <>
            {/* Live Status Pill Trigger -> opens dedicated StatusPickerModal */}
            <TouchableOpacity
              onPress={() => {
                triggerSelectionHaptic();
                setShowStatusPicker(true);
              }}
              activeOpacity={0.78}
              style={[
                styles.statusModalTrigger,
                {
                  backgroundColor: isDark
                    ? 'rgba(56, 189, 248, 0.10)'
                    : 'rgba(56, 189, 248, 0.08)',
                  borderColor: isDark
                    ? 'rgba(56, 189, 248, 0.28)'
                    : 'rgba(56, 189, 248, 0.25)',
                },
              ]}
            >
              <View style={styles.statusLiveDot} />
              <Text
                style={[
                  styles.statusInlineText,
                  { color: activeProfile.statusNote ? theme.text : theme.textSecondary, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {activeProfile.statusNote || t('friendsStatusChipHint')}
              </Text>
              <Ionicons name="sparkles-outline" size={13} color="#38BDF8" />
            </TouchableOpacity>

            <SegmentedGlassTabs
              items={friendSegItems}
              activeKey={subTab}
              onChange={(key) => {
                triggerSelectionHaptic();
                switchSubTab(key);
              }}
            />
          </>
        )}
      </View>

      <SmartScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          isCloudLoggedIn ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.text} />
          ) : undefined
        }
      >
        {!isCloudLoggedIn ? (
          /* Local-Only User -> Animated Connect Card + Athlete Handle Preview */
          <View style={styles.connectGateWrap}>
            <Animated.View
              style={[
                styles.athletePreviewCard,
                {
                  backgroundColor: isDark ? 'rgba(24,24,28,0.88)' : 'rgba(255,255,255,0.9)',
                  borderColor: theme.border,
                  transform: [{ translateY: cardFloatY }],
                },
              ]}
            >
              <Text style={[styles.previewEyebrow, { color: '#10B981' }]}>
                {t('friendsMyCardEyebrow')}
              </Text>
              <View style={styles.previewRow}>
                <RankCrestIcon tier="D" size={56} isSelected />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.previewName, { color: theme.text }]} numberOfLines={1}>
                    {activeProfile.name}
                  </Text>
                  <Text style={[styles.previewNick, { color: '#10B981' }]}>@{myNick}</Text>
                </View>
              </View>
            </Animated.View>

            <View style={styles.connectCopyBlock}>
              <Text style={[styles.connectTitle, { color: theme.text }]}>
                {t('friendsConnectHeroTitle')}
              </Text>
              <Text style={[styles.connectBody, { color: theme.textSecondary }]}>
                {t('friendsConnectHeroBody')}
              </Text>
            </View>

            <View style={styles.cloudBtnsRow}>
              <TouchableOpacity
                style={[styles.cloudBtnPrimary, { backgroundColor: theme.text }]}
                onPress={() => handleConnectCloud('apple')}
                disabled={Boolean(busyProvider)}
                activeOpacity={0.85}
              >
                {busyProvider === 'apple' ? (
                  <ActivityIndicator size="small" color={theme.bg} />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={18} color={theme.bg} />
                    <Text style={[styles.cloudBtnPrimaryText, { color: theme.bg }]}>iCloud</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cloudBtnSecondary,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
                onPress={() => handleConnectCloud('google')}
                disabled={Boolean(busyProvider)}
                activeOpacity={0.85}
              >
                {busyProvider === 'google' ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={16} color={theme.text} />
                    <Text style={[styles.cloudBtnSecondaryText, { color: theme.text }]}>
                      Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.connectHint, { color: theme.textMuted }]}>
              {t('friendsConnectHint')}
            </Text>
          </View>
        ) : (
          <Animated.View style={{ opacity: contentFade }}>
            {loadingHub && hub.friends.length === 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.text} />
              </View>
            )}

            {/* =====================================================
                SUB-TAB 1: CHATS & CREW
               ===================================================== */}
            {subTab === 'chats' && (
              <View style={styles.subSection}>
                {hub.incomingRequests.length > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.pendingBanner,
                      {
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        borderColor: 'rgba(16, 185, 129, 0.35)',
                      },
                    ]}
                    onPress={() => switchSubTab('add')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="person-add" size={16} color="#10B981" />
                    <Text style={[styles.pendingBannerText, { color: theme.text }]}>
                      {t('friendsIncomingTitle')}: {hub.incomingRequests.length}
                    </Text>
                    <Ionicons name="arrow-forward" size={15} color="#10B981" />
                  </TouchableOpacity>
                )}

                {hub.friends.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      {
                        backgroundColor: isDark ? 'rgba(24,24,28,0.72)' : 'rgba(255,255,255,0.85)',
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <CrewRadarOrb
                      myRank={hub.myProfile?.overallRank || 'F'}
                      friendRanks={[]}
                      size={146}
                    />
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#10B981', letterSpacing: 0.6 }}>
                      {t('friendsRadarSubtitle')}
                    </Text>
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      {t('friendsEmptyTitle')}
                    </Text>
                    <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                      {t('friendsEmptyBody')}
                    </Text>
                    <TouchableOpacity
                      style={[styles.emptyCtaBtn, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        triggerSelectionHaptic();
                        switchSubTab('add');
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="search" size={15} color={theme.primaryText} />
                      <Text style={[styles.emptyCtaText, { color: theme.primaryText }]}>
                        {t('friendsEmptyAddBtn')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Horizontal Animated Crew Spotlight Carousel */}
                    <View style={{ marginBottom: 6 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.textMuted }}>
                          {t('friendsCrewSpotlightTitle')}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="lock-closed" size={10} color="#10B981" />
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#10B981' }}>
                            {t('e2eeBadgeLabel')}
                          </Text>
                        </View>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 12, paddingRight: 8 }}
                      >
                        {hub.friends.map((item) => (
                          <SquadAvatarRing
                            key={`ring-${item.friend.userId}`}
                            friend={item.friend}
                            unreadCount={item.unreadCount}
                            onPress={() => {
                              triggerSelectionHaptic();
                              setActiveChatFriend(item.friend);
                            }}
                          />
                        ))}
                      </ScrollView>
                    </View>

                    {hub.friends.map((item) => {
                      const fr = item.friend;
                      const last = item.lastMessage;
                      const rankColor = (RANK_TIER_MAP[fr.overallRank] || RANK_TIER_MAP.F).color;
                      const previewLine = last
                        ? last.type === 'system'
                          ? last.text
                          : `${last.senderId === myUserId ? t('friendsYouSayPrefix') : ''}${
                              last.type === 'voice' ? t('voiceMsgLabel') : last.text
                            }`
                        : fr.statusNote ||
                          `${fr.overallRank} · ${fr.streak} ${t('friendsDaysShort')}`;

                      return (
                        <TouchableOpacity
                          key={fr.userId}
                          style={[
                            styles.friendRowCard,
                            {
                              backgroundColor: isDark
                                ? 'rgba(24,24,28,0.78)'
                                : 'rgba(255,255,255,0.9)',
                              borderColor: item.unreadCount > 0 ? '#10B981' : theme.border,
                            },
                          ]}
                          onPress={() => {
                            triggerSelectionHaptic();
                            setActiveChatFriend(fr);
                          }}
                          activeOpacity={0.82}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              triggerSelectionHaptic();
                              setSelectedProfileFriend(fr);
                            }}
                            activeOpacity={0.75}
                          >
                            <RankCrestIcon
                              tier={fr.overallRank || 'F'}
                              size={46}
                              isSelected
                            />
                          </TouchableOpacity>

                          <View style={styles.friendMidCol}>
                            <View style={styles.friendTitleRow}>
                              <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                                {fr.displayName}
                              </Text>
                              <Text style={[styles.friendNickTag, { color: rankColor }]}>
                                @{fr.nickname}
                              </Text>
                              {(fr.cheerStreakDays || 0) > 0 ? (
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 2,
                                    paddingHorizontal: 6,
                                    paddingVertical: 1.5,
                                    borderRadius: 999,
                                    backgroundColor: 'rgba(245, 158, 11, 0.14)',
                                  }}
                                >
                                  <Ionicons name="flame" size={10} color="#F59E0B" />
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#F59E0B' }}>
                                    {fr.cheerStreakDays}d
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <Text
                              style={[
                                styles.friendLastMsg,
                                {
                                  color: item.unreadCount > 0 ? theme.text : theme.textSecondary,
                                  fontWeight: item.unreadCount > 0 ? '700' : '500',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {previewLine}
                            </Text>
                          </View>

                          <View style={styles.friendRightCol}>
                            <Text style={[styles.timeText, { color: theme.textMuted }]}>
                              {formatRelativeTime(last?.createdAt || fr.lastActiveAt)}
                            </Text>
                            {item.unreadCount > 0 ? (
                              <View style={styles.unreadCountPill}>
                                <Text style={styles.unreadCountText}>{item.unreadCount}</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                onPress={() => {
                                  triggerSelectionHaptic();
                                  setSelectedProfileFriend(fr);
                                }}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              >
                                <Ionicons
                                  name="stats-chart-outline"
                                  size={15}
                                  color={theme.textMuted}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* =====================================================
                SUB-TAB 2: ACTIVITY FEED & KUDOS
               ===================================================== */}
            {subTab === 'feed' && (
              <View style={styles.subSection}>
                {friendActivities.length === 0 ? (
                  <View
                    style={[
                      styles.emptyCard,
                      {
                        backgroundColor: isDark ? 'rgba(24,24,28,0.72)' : 'rgba(255,255,255,0.85)',
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <Ionicons name="flame-outline" size={30} color="#F59E0B" />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>
                      {t('friendsFeedEmptyTitle')}
                    </Text>
                    <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
                      {t('friendsFeedEmptyBody')}
                    </Text>
                  </View>
                ) : (
                  friendActivities.map((act) => {
                    const handleOpenActorProfile = () => {
                      const matched = hub.friends.find((f) => f.friend.userId === act.userId)?.friend;
                      const fallbackProfile: FriendProfileSummary = matched || {
                        userId: act.userId,
                        nickname: act.nickname,
                        displayName: act.displayName,
                        avatarColor: act.avatarColor,
                        avatarUrl: act.avatarUrl,
                        overallRank: act.rankTier || 'F',
                        overallProgressPct: 0,
                        balanceScorePct: 100,
                        streak: 0,
                        totalWorkouts: 0,
                        totalSets: 0,
                        weeklyWorkouts: 0,
                        topMuscles: [],
                        recentPrs: [],
                        cheersCount: act.cheersCount || 0,
                        cheeredByMe: act.cheeredByMe,
                        lastActiveAt: act.createdAt,
                      };
                      triggerSelectionHaptic();
                      setSelectedProfileFriend(fallbackProfile);
                    };

                    return (
                      <View
                        key={act.id}
                        style={[
                          styles.feedCard,
                          {
                            backgroundColor: isDark ? 'rgba(24,24,28,0.8)' : 'rgba(255,255,255,0.9)',
                            borderColor: theme.border,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.feedAuthorTapZone}
                          onPress={handleOpenActorProfile}
                          activeOpacity={0.78}
                        >
                          <UserAvatarBadge
                            avatarUrl={act.avatarUrl}
                            displayName={act.displayName}
                            avatarColor={act.avatarColor}
                            rank={act.rankTier || 'F'}
                            size={38}
                            showRankDot
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.feedTopRow}>
                              <Text style={[styles.feedAuthor, { color: theme.text }]} numberOfLines={1}>
                                {act.displayName}
                              </Text>
                              <Text style={[styles.feedHandle, { color: '#10B981' }]}>
                                @{act.nickname}
                              </Text>
                              <Text style={[styles.timeText, { color: theme.textMuted }]}>
                                {formatRelativeTime(act.createdAt)}
                              </Text>
                            </View>
                            <Text style={[styles.feedTitle, { color: theme.text }]}>{act.title}</Text>
                            {act.subtitle ? (
                              <Text style={[styles.feedSub, { color: theme.textSecondary }]}>
                                {act.subtitle}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                        <HighFiveSpamButton
                          targetUserId={act.userId}
                          activityId={act.id}
                          initialCount={act.cheersCount || 0}
                          cheeredByMe={act.cheeredByMe}
                          compact
                        />
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* =====================================================
                SUB-TAB 3: CREW LEADERBOARD & PODIUM
               ===================================================== */}
            {subTab === 'rank' && (
              <View style={styles.subSection}>
                {leaderboardEntries.length > 0 && (
                  <>
                    <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1.2, color: theme.textMuted }}>
                      {t('friendsPodiumTitle')}
                    </Text>
                    <CrewPodiumStage
                      entries={leaderboardEntries.slice(0, 3).map((e) => ({
                        profile: e.profile,
                        isMe: e.isMe,
                        metricLabel:
                          leaderboardMetric === 'streak'
                            ? `${e.profile.streak} ${t('friendsDaysShort')}`
                            : leaderboardMetric === 'workouts'
                            ? `${e.profile.weeklyWorkouts}`
                            : `${e.profile.overallRank} (${e.profile.overallProgressPct}%)`,
                      }))}
                      onSelectProfile={(prof, isMe) => {
                        if (!isMe) {
                          triggerSelectionHaptic();
                          setSelectedProfileFriend(prof);
                        }
                      }}
                    />
                  </>
                )}

                <View style={styles.metricChipsRow}>
                  {(
                    [
                      { key: 'rank', label: t('friendsRankByTier') },
                      { key: 'streak', label: t('friendsRankByStreak') },
                      { key: 'workouts', label: t('friendsRankByWorkouts') },
                    ] as const
                  ).map((chip) => {
                    const active = leaderboardMetric === chip.key;
                    return (
                      <TouchableOpacity
                        key={chip.key}
                        style={[
                          styles.metricChip,
                          {
                            backgroundColor: active ? theme.text : theme.bgSecondary,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => {
                          triggerSelectionHaptic();
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setLeaderboardMetric(chip.key);
                        }}
                      >
                        <Text
                          style={[
                            styles.metricChipText,
                            { color: active ? theme.bg : theme.textSecondary },
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {leaderboardEntries.map((entry, idx) => {
                  const p = entry.profile;
                  const medalColor =
                    idx === 0
                      ? '#FACC15'
                      : idx === 1
                      ? '#CBD5E1'
                      : idx === 2
                      ? '#F59E0B'
                      : theme.textMuted;
                  const metricDisplay =
                    leaderboardMetric === 'streak'
                      ? `${p.streak} ${t('friendsDaysShort')}`
                      : leaderboardMetric === 'workouts'
                      ? `${p.weeklyWorkouts}`
                      : `${p.overallRank} (${p.overallProgressPct}%)`;

                  return (
                    <TouchableOpacity
                      key={p.userId}
                      style={[
                        styles.leaderRow,
                        {
                          backgroundColor: entry.isMe
                            ? isDark
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(16, 185, 129, 0.08)'
                            : isDark
                            ? 'rgba(24,24,28,0.78)'
                            : 'rgba(255,255,255,0.9)',
                          borderColor: entry.isMe ? '#10B981' : theme.border,
                        },
                      ]}
                      disabled={entry.isMe}
                      onPress={() => {
                        if (!entry.isMe) {
                          triggerSelectionHaptic();
                          setSelectedProfileFriend(p);
                        }
                      }}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.leaderPos, { color: medalColor }]}>#{idx + 1}</Text>
                      <UserAvatarBadge
                        avatarUrl={p.avatarUrl}
                        displayName={p.displayName}
                        avatarColor={p.avatarColor}
                        rank={p.overallRank || 'F'}
                        size={38}
                        showRankDot
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                          {p.displayName} {entry.isMe ? `(${t('friendsYouLabel')})` : ''}
                        </Text>
                        <Text style={[styles.leaderSub, { color: theme.textMuted }]}>
                          @{p.nickname}
                        </Text>
                      </View>
                      <Text style={[styles.leaderMetricVal, { color: theme.text }]}>
                        {metricDisplay}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* =====================================================
                SUB-TAB 4: ADD BY @NICK, REQUESTS & PRIVACY
               ===================================================== */}
            {subTab === 'add' && (
              <View style={styles.subSection}>
                {/* Search Bar by @nick */}
                <View
                  style={[
                    styles.searchBoxRow,
                    { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  ]}
                >
                  <Text style={styles.searchAtPrefix}>@</Text>
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder={t('friendsSearchPlaceholder')}
                    placeholderTextColor={theme.textMuted}
                    value={searchQuery}
                    onChangeText={(txt) => setSearchQuery(sanitizeNicknameInput(txt))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={handleSearchNick}
                  />
                  <TouchableOpacity
                    style={[styles.searchBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSearchNick}
                    disabled={isSearching}
                    activeOpacity={0.85}
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color={theme.primaryText} />
                    ) : (
                      <Text style={[styles.searchBtnText, { color: theme.primaryText }]}>
                        {t('friendsSearchBtn')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>

                {searchResults && (
                  <View style={styles.blockWrap}>
                    {searchResults.length === 0 ? (
                      <Text style={[styles.emptySearchText, { color: theme.textMuted }]}>
                        {t('friendsNoSearchResults')}
                      </Text>
                    ) : (
                      searchResults.map((res) => (
                        <View
                          key={res.profile.userId}
                          style={[
                            styles.searchResultRow,
                            { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                          ]}
                        >
                          <UserAvatarBadge
  avatarUrl={res.profile.avatarUrl}
  displayName={res.profile.displayName}
  avatarColor={res.profile.avatarColor}
  rank={res.profile.overallRank || 'F'}
  size={38}
  showRankDot
/>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                              {res.profile.displayName}
                            </Text>
                            <Text style={[styles.leaderSub, { color: '#10B981' }]}>
                              @{res.profile.nickname} · {res.profile.overallRank}
                            </Text>
                          </View>

                          {res.relationStatus === 'friend' ? (
                            <View style={styles.statusChip}>
                              <Text style={styles.statusChipGreen}>{t('friendsFriendBadge')}</Text>
                            </View>
                          ) : res.relationStatus === 'outgoing' ? (
                            <View style={[styles.statusChip, { backgroundColor: theme.border }]}>
                              <Text style={[styles.statusChipNeutral, { color: theme.textSecondary }]}>
                                {t('friendsPendingBadge')}
                              </Text>
                            </View>
                          ) : res.relationStatus === 'incoming' ? (
                            <TouchableOpacity
                              style={[styles.addBtn, { backgroundColor: '#10B981' }]}
                              onPress={() => handleRespondRequest(res.profile.userId, 'accept')}
                            >
                              <Text style={styles.addBtnDarkText}>{t('friendsAcceptBtn')}</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[styles.addBtn, { backgroundColor: theme.primary }]}
                              onPress={() =>
                                handleSendFriendInvite(res.profile.nickname, res.profile.userId)
                              }
                            >
                              <Text style={[styles.addBtnText, { color: theme.primaryText }]}>
                                {t('friendsAddBtn')}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Incoming Requests */}
                {hub.incomingRequests.length > 0 && (
                  <View style={styles.blockWrap}>
                    <Text style={[styles.blockEyebrow, { color: theme.textMuted }]}>
                      {t('friendsIncomingTitle')}
                    </Text>
                    {hub.incomingRequests.map((req) => (
                      <View
                        key={req.id}
                        style={[
                          styles.searchResultRow,
                          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                        ]}
                      >
                        <UserAvatarBadge
  avatarUrl={req.fromAvatarUrl}
  displayName={req.fromDisplayName}
  avatarColor={req.fromAvatarColor}
  rank={req.fromRank || 'F'}
  size={38}
  showRankDot
/>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                            {req.fromDisplayName}
                          </Text>
                          <Text style={[styles.leaderSub, { color: '#10B981' }]}>
                            @{req.fromNickname}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.addBtn, { backgroundColor: '#10B981' }]}
                          onPress={() => handleRespondRequest(req.fromUserId, 'accept')}
                        >
                          <Text style={styles.addBtnDarkText}>{t('friendsAcceptBtn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.declineBtn, { borderColor: theme.border }]}
                          onPress={() => handleRespondRequest(req.fromUserId, 'decline')}
                        >
                          <Ionicons name="close" size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Outgoing Requests */}
                {hub.outgoingRequests.length > 0 && (
                  <View style={styles.blockWrap}>
                    <Text style={[styles.blockEyebrow, { color: theme.textMuted }]}>
                      {t('friendsOutgoingTitle')}
                    </Text>
                    {hub.outgoingRequests.map((req) => (
                      <View
                        key={req.id}
                        style={[
                          styles.searchResultRow,
                          { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                        ]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.friendName, { color: theme.text }]} numberOfLines={1}>
                            {req.toDisplayName || `@${req.toNickname}`}
                          </Text>
                          <Text style={[styles.leaderSub, { color: theme.textMuted }]}>
                            @{req.toNickname}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.declineBtn, { borderColor: theme.border, paddingHorizontal: 10 }]}
                          onPress={() => handleRespondRequest(req.toUserId, 'cancel')}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: theme.textSecondary }}>
                            {t('friendsCancelReqBtn')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Privacy Toggle */}
                <View
                  style={[
                    styles.privacyCard,
                    { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.privacyTitle, { color: theme.text }]}>
                      {t('friendsPrivacyTitle')}
                    </Text>
                    <Text style={[styles.privacySub, { color: theme.textSecondary }]}>
                      {t('friendsPrivacySub')}
                    </Text>
                  </View>
                  <Switch
                    value={activeProfile.showActivityToFriends !== false}
                    onValueChange={handleTogglePrivacy}
                    trackColor={{ false: theme.border, true: '#10B981' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            )}
          </Animated.View>
        )}
      </SmartScrollView>

      {selectedProfileFriend && (
        <FriendProfileModal
          visible={true}
          friend={selectedProfileFriend}
          myProfile={hub.myProfile}
          onClose={() => {
            setSelectedProfileFriend(null);
            const backTo = returnChatAfterProfileRef.current;
            returnChatAfterProfileRef.current = null;
            if (backTo) {
              setTimeout(() => setActiveChatFriend(backTo), 220);
            }
          }}
          onOpenChat={(f) => {
            returnChatAfterProfileRef.current = null;
            setSelectedProfileFriend(null);
            setTimeout(() => setActiveChatFriend(f), 220);
          }}
          onSendKudos={handleSendKudos}
          onCheerStreakUpdated={(friendUserId, nextStreak) => {
            setSelectedProfileFriend((prev) =>
              prev && prev.userId === friendUserId
                ? { ...prev, cheerStreakDays: nextStreak, cheeredTodayWithMe: true }
                : prev
            );
            setHub((prev) => ({
              ...prev,
              friends: prev.friends.map((th) =>
                th.friend.userId === friendUserId
                  ? {
                      ...th,
                      friend: {
                        ...th.friend,
                        cheerStreakDays: nextStreak,
                        cheeredTodayWithMe: true,
                      },
                    }
                  : th
              ),
            }));
          }}
          onRemoveFriend={async (f) => {
            returnChatAfterProfileRef.current = null;
            await removeFriend(f.userId);
            await loadSocialState(false);
          }}
        />
      )}

      {activeChatFriend && (
        <FriendChatModal
          visible={true}
          friend={activeChatFriend}
          myProfile={hub.myProfile}
          myUserId={myUserId}
          onClose={() => {
            returnChatAfterProfileRef.current = null;
            setActiveChatFriend(null);
          }}
          onSendKudos={handleSendKudos}
          onRemoveFriend={async (f) => {
            returnChatAfterProfileRef.current = null;
            await removeFriend(f.userId);
            await loadSocialState(false);
          }}
          onMessagesChanged={handleChatMessagesChanged}
        />
      )}

      {showStatusPicker && (
        <StatusPickerModal
          visible={true}
          nickname={myNick}
          currentStatus={activeProfile.statusNote}
          onClose={() => setShowStatusPicker(false)}
          onSaveStatus={handleSetStatusPreset}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  headerRightPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 170,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  nickPillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    flexShrink: 1,
  },
  statusModalTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#38BDF8',
  },
  statusInlineText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 92,
  },
  connectGateWrap: {
    gap: 18,
    paddingTop: 10,
  },
  athletePreviewCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 10,
  },
  previewEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewName: {
    fontSize: 19,
    fontWeight: '900',
  },
  previewNick: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },
  connectCopyBlock: {
    gap: 6,
  },
  connectTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  connectBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  cloudBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cloudBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: 14,
  },
  cloudBtnPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cloudBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  cloudBtnSecondaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  connectHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  subSection: {
    gap: 10,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  emptyIconStage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  emptyBody: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 13,
    marginTop: 4,
  },
  emptyCtaText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  friendRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  friendMidCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  friendTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendName: {
    fontSize: 14.5,
    fontWeight: '800',
    flexShrink: 1,
  },
  friendNickTag: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  friendLastMsg: {
    fontSize: 12.5,
  },
  friendRightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  timeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  unreadCountPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    color: '#04120B',
    fontSize: 11,
    fontWeight: '900',
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedAuthorTapZone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },
  feedTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedAuthor: {
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  feedHandle: {
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  feedTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
  },
  feedSub: {
    fontSize: 12,
    marginTop: 1,
  },
  feedCheerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  feedCheerText: {
    fontSize: 12,
    fontWeight: '800',
  },
  metricChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  metricChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
  },
  leaderPos: {
    width: 28,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  leaderSub: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  leaderMetricVal: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  searchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 13,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
  },
  searchAtPrefix: {
    fontSize: 16,
    fontWeight: '900',
    color: '#10B981',
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
    paddingVertical: 6,
  },
  searchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
  },
  searchBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  blockWrap: {
    gap: 8,
    marginTop: 6,
  },
  blockEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  emptySearchText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  addBtnDarkText: {
    color: '#04120B',
    fontSize: 12,
    fontWeight: '900',
  },
  declineBtn: {
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  statusChipGreen: {
    color: '#10B981',
    fontSize: 11.5,
    fontWeight: '800',
  },
  statusChipNeutral: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  privacyTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  privacySub: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
});
