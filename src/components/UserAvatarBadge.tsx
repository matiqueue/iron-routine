import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { useAppTheme } from '../context/ThemeContext';
import { RankCrestIcon } from './RankCrestIcon';

interface UserAvatarBadgeProps {
  avatarUrl?: string | null;
  displayName?: string;
  avatarColor?: string;
  rank?: RankTier;
  size?: number;
  ringColor?: string;
  showRankDot?: boolean;
}

export function getAvatarInitials(displayName?: string): string {
  const parts = (displayName || 'A')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase() || 'A';
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

/**
 * Renders an athlete's profile photo when set, or a crisp consistent
 * monogram badge (e.g. "TK" for "Test Konto") with optional rank crest badge.
 */
export const UserAvatarBadge: React.FC<UserAvatarBadgeProps> = React.memo(
  ({
    avatarUrl,
    displayName = 'A',
    avatarColor = '#10B981',
    rank,
    size = 42,
    ringColor,
    showRankDot = false,
  }) => {
    const { isDark } = useAppTheme();
    const [imgFailed, setImgFailed] = React.useState(false);

    React.useEffect(() => {
      setImgFailed(false);
    }, [avatarUrl]);

    const initials = getAvatarInitials(displayName);
    const rankColor = rank ? (RANK_TIER_MAP[rank] || RANK_TIER_MAP.F).color : '#10B981';
    const borderCol = ringColor || (rank ? `${rankColor}88` : `${avatarColor}66`);
    const badgeSize = Math.max(16, Math.round(size * 0.42));

    return (
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderCol,
            backgroundColor: isDark ? '#18181D' : '#F4F4F7',
          },
        ]}
      >
        <View
          style={{
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {avatarUrl && !imgFailed ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: size - 4,
                height: size - 4,
                borderRadius: (size - 4) / 2,
              }}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <Text
              style={[
                styles.initialText,
                {
                  fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.42)),
                  color: isDark ? '#F8FAFC' : '#0F172A',
                },
              ]}
            >
              {initials}
            </Text>
          )}
        </View>

        {showRankDot && rank && (
          <View
            style={[
              styles.rankCrestPill,
              {
                width: badgeSize + 4,
                height: badgeSize + 4,
                borderRadius: (badgeSize + 4) / 2,
                backgroundColor: isDark ? '#0B0B0F' : '#FFFFFF',
                borderColor: rankColor,
              },
            ]}
          >
            <RankCrestIcon tier={rank} size={badgeSize} isSelected />
          </View>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  initialText: {
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  rankCrestPill: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    borderWidth: 1.25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
    elevation: 6,
  },
});
