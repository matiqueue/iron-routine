import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  ChatMessage,
  ChatMessagePayload,
  ChatMessageType,
  FriendProfileSummary,
} from '../types/workout';
import {
  fetchChatMessages,
  reactToChatMessage,
  sendChatMessage,
} from '../services/social';
import { triggerNotificationHaptic, triggerSelectionHaptic } from '../services/haptics';
import { RankCrestIcon } from './RankCrestIcon';
import { MinimalistBackdrop } from './MinimalistBackdrop';

interface FriendChatModalProps {
  visible: boolean;
  friend: FriendProfileSummary | null;
  myProfile: FriendProfileSummary | null;
  myUserId: string;
  onClose: () => void;
  onOpenProfile: (friend: FriendProfileSummary) => void;
  onMessagesChanged?: () => void;
}

const REACTION_EMOJIS = ['🔥', '💪', '🏆', '👏'];

export const FriendChatModal: React.FC<FriendChatModalProps> = ({
  visible,
  friend,
  myProfile,
  myUserId,
  onClose,
  onOpenProfile,
  onMessagesChanged,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t, localeCode } = useLanguage();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showShareTray, setShowShareTray] = useState(false);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const trayAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useKeyboardHeight(visible, true);

  const onMessagesChangedRef = useRef(onMessagesChanged);
  onMessagesChangedRef.current = onMessagesChanged;
  const friendId = friend?.userId || null;

  useEffect(() => {
    if (!visible || !friendId) {
      setMessages([]);
      setLoading(false);
      setShowShareTray(false);
      setReactingMessageId(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchChatMessages(friendId)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setMessages(res.messages);
          onMessagesChangedRef.current?.();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = setInterval(() => {
      fetchChatMessages(friendId)
        .then((res) => {
          if (cancelled || !res.ok) return;
          setMessages((prev) => {
            if (prev.length !== res.messages.length) {
              onMessagesChangedRef.current?.();
              return res.messages;
            }
            const lastPrev = prev[prev.length - 1]?.id;
            const lastNext = res.messages[res.messages.length - 1]?.id;
            if (lastPrev !== lastNext) {
              onMessagesChangedRef.current?.();
              return res.messages;
            }
            return prev;
          });
        })
        .catch(() => {});
    }, 4500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [visible, friendId]);

  useEffect(() => {
    if (keyboardHeight > 0) {
      const tmr = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
      return () => clearTimeout(tmr);
    }
  }, [keyboardHeight]);

  useEffect(() => {
    Animated.timing(trayAnim, {
      toValue: showShareTray ? 1 : 0,
      duration: 210,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showShareTray, trayAnim]);

  if (!friend) return null;

  const handleSend = async (
    type: ChatMessageType = 'text',
    explicitText?: string,
    payload?: ChatMessagePayload
  ) => {
    const cleanText = (explicitText ?? inputText).trim();
    if ((!cleanText && type === 'text') || isSending) return;

    triggerSelectionHaptic();
    if (type === 'text') setInputText('');
    setShowShareTray(false);

    const optimistic: ChatMessage = {
      id: `temp_${Date.now()}`,
      senderId: myUserId,
      recipientId: friend.userId,
      type,
      text: cleanText,
      payload,
      createdAt: new Date().toISOString(),
      reactions: {},
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

    setIsSending(true);
    try {
      const res = await sendChatMessage({
        friendId: friend.userId,
        recipientPublicKey: friend.e2eePublicKey || '',
        type,
        text: cleanText,
        payload,
      });
      if (res.ok && res.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.message! : m)));
        onMessagesChanged?.();
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        if (res.error) Alert.alert(t('errorTitle'), res.error);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleShareWorkoutCard = () => {
    const sets = myProfile?.totalSets || 0;
    const streak = myProfile?.streak || 0;
    handleSend('workout_share', t('friendsChatSharedWorkout'), {
      title: myProfile?.statusNote || t('friendsChatSharedWorkout'),
      subtitle: `${myProfile?.weeklyWorkouts || 0} ${t('friendsWorkoutsWeekLabel')} · ${streak}${t('friendsDaysShort')}`,
      sets,
      streak,
    });
  };

  const handleShareRankCard = () => {
    handleSend('rank_card', t('friendsChatSharedRank'), {
      rank: myProfile?.overallRank || 'F',
      title: `${t('friendsChatSharedRank')}: ${myProfile?.overallRank || 'F'}`,
      subtitle: `${myProfile?.overallProgressPct || 0}% · ${myProfile?.balanceScorePct || 100}% ${t('friendsBalanceLabel')}`,
      streak: myProfile?.streak || 0,
    });
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    triggerNotificationHaptic('success');
    setReactingMessageId(null);
    const updated = await reactToChatMessage(friend.userId, messageId, emoji);
    if (updated) {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' });
  };

  const trayHeight = trayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 82] });

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderId === myUserId;
    const reactionsEntries = Object.entries(item.reactions || {}).filter(
      ([, arr]) => Array.isArray(arr) && arr.length > 0
    );
    const showReactionBar = reactingMessageId === item.id;

    return (
      <View
        style={[
          styles.msgRow,
          isMine ? styles.msgRowMine : styles.msgRowTheirs,
        ]}
      >
        {showReactionBar && (
          <View
            style={[
              styles.reactionBar,
              {
                backgroundColor: isDark ? '#1F2024' : '#FFFFFF',
                borderColor: theme.border,
              },
            ]}
          >
            {REACTION_EMOJIS.map((em) => (
              <TouchableOpacity
                key={em}
                onPress={() => handleReaction(item.id, em)}
                style={styles.reactionPickBtn}
              >
                <Text style={styles.reactionEmoji}>{em}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => {
            triggerSelectionHaptic();
            setReactingMessageId(showReactionBar ? null : item.id);
          }}
          onPress={() => {
            if (reactingMessageId) setReactingMessageId(null);
          }}
          style={[
            styles.bubble,
            isMine
              ? {
                  backgroundColor: isDark ? '#FAFAFA' : '#111114',
                  borderBottomRightRadius: 6,
                }
              : {
                  backgroundColor: isDark
                    ? 'rgba(32, 33, 38, 0.92)'
                    : 'rgba(244, 244, 246, 0.96)',
                  borderColor: theme.border,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderBottomLeftRadius: 6,
                },
          ]}
        >
          {item.type === 'rank_card' && item.payload ? (
            <View style={styles.richCardWrap}>
              <RankCrestIcon tier={item.payload.rank || 'F'} size={38} isSelected />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.richCardTitle,
                    { color: isMine ? (isDark ? '#09090B' : '#FFFFFF') : theme.text },
                  ]}
                >
                  {item.payload.title || item.text}
                </Text>
                {item.payload.subtitle ? (
                  <Text
                    style={[
                      styles.richCardSub,
                      {
                        color: isMine
                          ? isDark
                            ? 'rgba(9,9,11,0.7)'
                            : 'rgba(255,255,255,0.75)'
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {item.payload.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : item.type === 'workout_share' && item.payload ? (
            <View style={styles.richCardWrap}>
              <View
                style={[
                  styles.workoutCardBadge,
                  { backgroundColor: 'rgba(16, 185, 129, 0.16)' },
                ]}
              >
                <Ionicons name="barbell" size={18} color="#10B981" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    styles.richCardTitle,
                    { color: isMine ? (isDark ? '#09090B' : '#FFFFFF') : theme.text },
                  ]}
                >
                  {item.payload.title || item.text}
                </Text>
                <Text
                  style={[
                    styles.richCardSub,
                    {
                      color: isMine
                        ? isDark
                          ? 'rgba(9,9,11,0.7)'
                          : 'rgba(255,255,255,0.75)'
                        : theme.textSecondary,
                    },
                  ]}
                >
                  {item.payload.subtitle}
                </Text>
              </View>
            </View>
          ) : (
            <Text
              style={[
                styles.bubbleText,
                { color: isMine ? (isDark ? '#09090B' : '#FFFFFF') : theme.text },
              ]}
            >
              {item.text}
            </Text>
          )}

          <Text
            style={[
              styles.timeLabel,
              {
                color: isMine
                  ? isDark
                    ? 'rgba(9,9,11,0.52)'
                    : 'rgba(255,255,255,0.62)'
                  : theme.textMuted,
              },
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </TouchableOpacity>

        {reactionsEntries.length > 0 && (
          <View style={[styles.reactionsPillRow, isMine ? { justifyContent: 'flex-end' } : null]}>
            {reactionsEntries.map(([emoji, arr]) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionChip,
                  { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                ]}
                onPress={() => handleReaction(item.id, emoji)}
              >
                <Text style={{ fontSize: 11 }}>{emoji}</Text>
                <Text style={[styles.reactionCount, { color: theme.textSecondary }]}>
                  {arr.length}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.bg,
            paddingBottom: keyboardHeight,
          },
        ]}
      >
        <MinimalistBackdrop variant="dots" accentColor="#38BDF8" />

        {/* Chat Header - Clean Messenger Only (NO voice/video call buttons!) */}
        <View
          style={[
            styles.header,
            {
              paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 10,
              borderBottomColor: theme.hairline,
              backgroundColor: isDark ? 'rgba(18,18,22,0.88)' : 'rgba(255,255,255,0.9)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.headerBackBtn, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-down" size={20} color={theme.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerFriendPress}
            onPress={() => {
              onClose();
              onOpenProfile(friend);
            }}
            activeOpacity={0.75}
          >
            <RankCrestIcon tier={friend.overallRank || 'F'} size={34} isSelected />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                {friend.displayName}
              </Text>
              <Text style={[styles.headerSub, { color: '#10B981' }]} numberOfLines={1}>
                @{friend.nickname} · {friend.statusNote || t('friendsChatNoCallsNote')}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onClose();
              onOpenProfile(friend);
            }}
            style={[styles.headerBackBtn, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.75}
          >
            <Ionicons name="person-outline" size={17} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* E2EE Verification Strip */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            paddingVertical: 6,
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.06)',
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: 'rgba(16, 185, 129, 0.22)',
          }}
        >
          <Ionicons name="lock-closed" size={11} color="#10B981" />
          <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#10B981' }}>
            {t('e2eeBadgeLabel')} · Curve25519
          </Text>
        </View>

        {/* Thread Body */}
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="small" color={theme.text} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <View style={[styles.emptyIconCircle, { backgroundColor: theme.bgSecondary }]}>
                  <Ionicons name="chatbubbles-outline" size={26} color="#10B981" />
                </View>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  {t('friendsChatEmpty')}
                </Text>
              </View>
            }
          />
        )}

        {/* Expandable Quick Action / Card Share Tray */}
        <Animated.View style={[styles.shareTray, { height: trayHeight, overflow: 'hidden' }]}>
          <View style={styles.shareTrayInner}>
            <TouchableOpacity
              style={[styles.shareCardBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={handleShareWorkoutCard}
              activeOpacity={0.8}
            >
              <Ionicons name="barbell-outline" size={16} color="#10B981" />
              <Text style={[styles.shareCardBtnText, { color: theme.text }]}>
                {t('friendsChatShareWorkout')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareCardBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={handleShareRankCard}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#38BDF8" />
              <Text style={[styles.shareCardBtnText, { color: theme.text }]}>
                {t('friendsChatShareRank')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareCardBtn, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={() => handleSend('cheer', `💪 ${t('friendsChatQuickKudos')}`)}
              activeOpacity={0.8}
            >
              <Ionicons name="flame-outline" size={16} color="#F59E0B" />
              <Text style={[styles.shareCardBtnText, { color: theme.text }]}>
                {t('friendsChatQuickKudos')}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bottom Composer */}
        <View
          style={[
            styles.composerRow,
            {
              paddingBottom: keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 12),
              borderTopColor: theme.hairline,
              backgroundColor: isDark ? 'rgba(18,18,22,0.92)' : 'rgba(255,255,255,0.94)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              triggerSelectionHaptic();
              setShowShareTray((v) => !v);
            }}
            style={[
              styles.plusBtn,
              {
                backgroundColor: showShareTray ? theme.text : theme.bgSecondary,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showShareTray ? 'close' : 'add'}
              size={20}
              color={showShareTray ? theme.bg : theme.text}
            />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.bgSecondary,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder={t('friendsChatPlaceholder')}
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={() => handleSend('text')}
            disabled={!inputText.trim() || isSending}
            style={[
              styles.sendBtn,
              {
                backgroundColor: inputText.trim() ? '#10B981' : theme.bgSecondary,
              },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={inputText.trim() ? '#04120B' : theme.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFriendPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  headerName: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  headerSub: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 10,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },
  msgRow: {
    maxWidth: '82%',
    gap: 4,
  },
  msgRowMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  msgRowTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  timeLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  richCardWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 190,
  },
  workoutCardBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  richCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  richCardSub: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  reactionBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 2,
  },
  reactionPickBtn: {
    paddingHorizontal: 4,
  },
  reactionEmoji: {
    fontSize: 18,
  },
  reactionsPillRow: {
    flexDirection: 'row',
    gap: 5,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionCount: {
    fontSize: 10,
    fontWeight: '800',
  },
  shareTray: {
    paddingHorizontal: 14,
  },
  shareTrayInner: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  shareCardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shareCardBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14.5,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
