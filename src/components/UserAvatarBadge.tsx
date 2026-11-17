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
    const badgeSize = Math.max(18, Math.round(size * 0.46));

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
          <View style={styles.rankCornerWrap}>
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
  rankCornerWrap: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    zIndex: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
  },
});
