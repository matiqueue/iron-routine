import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { useAppTheme } from '../context/ThemeContext';

interface UserAvatarBadgeProps {
  avatarUrl?: string | null;
  displayName?: string;
  avatarColor?: string;
  rank?: RankTier;
  size?: number;
  ringColor?: string;
  showRankDot?: boolean;
}

/**
 * Renders an athlete's profile photo when set, or a crisp monochrome/accent
 * initial monogram badge by default.
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

    const initial = (displayName || 'A').trim().charAt(0).toUpperCase() || 'A';
    const rankColor = rank ? (RANK_TIER_MAP[rank] || RANK_TIER_MAP.F).color : '#10B981';
    const borderCol = ringColor || (rank ? `${rankColor}88` : `${avatarColor}66`);

    return (
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderCol,
            backgroundColor: isDark ? `${avatarColor}22` : `${avatarColor}18`,
          },
        ]}
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
                fontSize: Math.round(size * 0.42),
                color: isDark ? '#F8FAFC' : '#0F172A',
              },
            ]}
          >
            {initial}
          </Text>
        )}

        {showRankDot && rank && (
          <View
            style={[
              styles.rankPill,
              {
                backgroundColor: rankColor,
                borderColor: isDark ? '#0B0B0F' : '#FFFFFF',
              },
            ]}
          >
            <Text style={styles.rankPillText}>{rank}</Text>
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
    letterSpacing: -0.3,
  },
  rankPill: {
    position: 'absolute',
    bottom: -3,
    right: -4,
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankPillText: {
    color: '#071014',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
