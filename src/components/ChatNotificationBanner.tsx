import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { FriendProfileSummary } from '../types/workout';
import { UserAvatarBadge } from './UserAvatarBadge';

export interface IncomingChatToast {
  id: string;
  friend: FriendProfileSummary;
  body: string;
  createdAt: string;
}

interface ChatNotificationBannerProps {
  toast: IncomingChatToast | null;
  onPress: (friend: FriendProfileSummary) => void;
  onDismiss: () => void;
}

/**
 * Apple Messages / Messenger style floating notification banner that drops
 * down from the Dynamic Island with the sender's circular profile picture
 * as the primary left icon.
 */
const formatToastTime = (iso: string): string => {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
};

export const ChatNotificationBanner: React.FC<ChatNotificationBannerProps> = ({
  toast,
  onPress,
  onDismiss,
}) => {
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismissBanner = () => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: -140,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismissRef.current();
    });
  };

  useEffect(() => {
    if (!toast) {
      slideY.setValue(-140);
      opacity.setValue(0);
      return;
    }
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }

    slideY.setValue(-130);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        friction: 7.5,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();

    autoHideTimerRef.current = setTimeout(() => {
      dismissBanner();
    }, 4400);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, [toast?.id]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy < -6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
        onPanResponderMove: (_, g) => {
          if (g.dy < 0) {
            slideY.setValue(g.dy);
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy < -24 || g.vy < -0.35) {
            dismissBanner();
          } else {
            Animated.spring(slideY, {
              toValue: 0,
              friction: 7.5,
              tension: 110,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [slideY]
  );

  if (!toast) return null;

  const fr = toast.friend;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.outer,
        {
          top: Math.max(insets.top + 6, 14),
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          if (autoHideTimerRef.current) {
            clearTimeout(autoHideTimerRef.current);
            autoHideTimerRef.current = null;
          }
          onPress(fr);
        }}
        style={[
          styles.card,
          {
            backgroundColor: isDark
              ? 'rgba(22, 22, 28, 0.96)'
              : 'rgba(255, 255, 255, 0.97)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.16)'
              : 'rgba(15, 23, 42, 0.11)',
          },
        ]}
      >
        <UserAvatarBadge
          avatarUrl={fr.avatarUrl}
          displayName={fr.displayName}
          avatarColor={fr.avatarColor}
          rank={fr.overallRank || 'F'}
          size={44}
          showRankDot
        />

        <View style={styles.textCol}>
          <View style={styles.topRow}>
            <Text style={[styles.senderName, { color: theme.text }]} numberOfLines={1}>
              {fr.displayName}
            </Text>
            <Text style={[styles.handleText, { color: '#10B981' }]} numberOfLines={1}>
              @{fr.nickname}
            </Text>
            <Text style={[styles.nowText, { color: theme.textMuted }]}>
              {formatToastTime(toast.createdAt)}
            </Text>
          </View>
          <Text style={[styles.bodyText, { color: theme.textSecondary }]} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>

        <View
          style={[
            styles.replyChip,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(15, 23, 42, 0.06)',
            },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={15} color={theme.text} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 30,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 14,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  handleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  nowText: {
    fontSize: 10.5,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17.5,
  },
  replyChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
