import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';
import { useLanguage } from '../context/LanguageContext';

interface RankBadgeProps {
  tier: RankTier;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showLabel?: boolean;
  progressPct?: number;
}

export const RankBadge: React.FC<RankBadgeProps> = ({
  tier,
  size = 'md',
  showLabel = false,
  progressPct,
}) => {
  const { rankTitle } = useLanguage();
  const meta = RANK_TIER_MAP[tier] || RANK_TIER_MAP.F;
  const isTopTier = tier === 'S' || tier === 'S+' || tier === 'A';

  const dimensions =
    size === 'hero'
      ? { width: 54, height: 54, radius: 16, fontSize: 22 }
      : size === 'lg'
      ? { width: 42, height: 42, radius: 13, fontSize: 17 }
      : size === 'sm'
      ? { width: 26, height: 26, radius: 8, fontSize: 11 }
      : { width: 34, height: 34, radius: 10, fontSize: 14 };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          {
            width: dimensions.width,
            height: dimensions.height,
            borderRadius: dimensions.radius,
            backgroundColor: meta.badgeBg,
            borderColor: meta.badgeBorder,
            shadowColor: meta.color,
            shadowOpacity: isTopTier ? 0.45 : 0.15,
            shadowRadius: isTopTier ? 8 : 3,
          },
        ]}
      >
        <Text
          style={[
            styles.tierText,
            {
              fontSize: dimensions.fontSize,
              color: meta.color,
            },
          ]}
        >
          {tier}
        </Text>
      </View>

      {showLabel && (
        <Text style={[styles.label, { color: meta.color }]} numberOfLines={1}>
          {rankTitle(tier)}
        </Text>
      )}

      {typeof progressPct === 'number' && (
        <View style={[styles.progressTrack, { width: dimensions.width }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                backgroundColor: meta.color,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },
  tierText: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
