import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { RankTier } from '../types/workout';
import { RANK_TIER_MAP } from '../data/muscleMap';

interface RankCrestIconProps {
  tier: RankTier;
  size?: number;
  progressPct?: number;
  isSelected?: boolean;
  dimmed?: boolean;
}

const TIER_GRADIENTS: Record<RankTier, [string, string, string]> = {
  F: ['#52525B', '#27272A', '#71717A'],
  E: ['#A1A1AA', '#52525B', '#D4D4D8'],
  D: ['#38BDF8', '#0369A1', '#7DD3FC'],
  C: ['#10B981', '#047857', '#6EE7B7'],
  B: ['#84CC16', '#3F6212', '#BEF264'],
  A: ['#F59E0B', '#B45309', '#FDE68A'],
  S: ['#F97316', '#C2410C', '#FDBA74'],
  'S+': ['#F43F5E', '#9F1239', '#FDA4AF'],
};

export const RankCrestIcon: React.FC<RankCrestIconProps> = React.memo(({
  tier,
  size = 38,
  progressPct,
  isSelected = false,
  dimmed = false,
}) => {
  const meta = RANK_TIER_MAP[tier] || RANK_TIER_MAP.F;
  const [cTop, cBot, cStroke] = TIER_GRADIENTS[tier] || TIER_GRADIENTS.F;
  const gradId = `crest-grad-${tier.replace('+', 'plus')}`;
  const glowId = `crest-glow-${tier.replace('+', 'plus')}`;

  const showRing = typeof progressPct === 'number';
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, progressPct || 0));
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          opacity: dimmed ? 0.42 : 1,
          transform: [{ scale: isSelected ? 1.1 : 1 }],
        },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={cTop} stopOpacity={0.95} />
            <Stop offset="100%" stopColor={cBot} stopOpacity={0.98} />
          </LinearGradient>
          <LinearGradient id={glowId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={cStroke} stopOpacity={0.38} />
            <Stop offset="100%" stopColor={cTop} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        {/* Optional outer XP progress ring */}
        {showRing && (
          <G rotation="-90" origin="50, 50">
            <Circle
              cx="50"
              cy="50"
              r={radius}
              stroke={cTop}
              strokeOpacity={0.16}
              strokeWidth="4"
              fill="none"
            />
            {clampedPct > 0 && (
              <Circle
                cx="50"
                cy="50"
                r={radius}
                stroke={cStroke}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                fill="none"
              />
            )}
          </G>
        )}

        {/* Ambient halo for high tiers or selected */}
        {(tier === 'A' || tier === 'S' || tier === 'S+' || isSelected) && (
          <Circle cx="50" cy="50" r="40" fill={`url(#${glowId})`} />
        )}

        {/* Tier-specific geometric crest */}
        {tier === 'F' && (
          <G>
            <Polygon
              points="50,14 81,32 81,68 50,86 19,68 19,32"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="2.5"
              strokeOpacity="0.65"
            />
            <Polygon
              points="50,22 73,36 73,64 50,78 27,64 27,36"
              fill="none"
              stroke="#18181B"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
          </G>
        )}

        {tier === 'E' && (
          <G>
            <Path
              d="M50 12 L82 26 L82 54 C82 72 68 83 50 90 C32 83 18 72 18 54 L18 26 Z"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="2.6"
            />
            <Path
              d="M36 30 L50 22 L64 30"
              fill="none"
              stroke={cStroke}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeOpacity="0.7"
            />
          </G>
        )}

        {tier === 'D' && (
          <G>
            <Polygon
              points="50,10 86,50 50,90 14,50"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="2.8"
            />
            <Polygon
              points="50,19 77,50 50,81 23,50"
              fill="none"
              stroke="#E0F2FE"
              strokeWidth="1.4"
              strokeOpacity="0.45"
            />
          </G>
        )}

        {tier === 'C' && (
          <G>
            <Path
              d="M12 36 L26 24 L26 62 L12 52 Z M88 36 L74 24 L74 62 L88 52 Z"
              fill={cTop}
              fillOpacity="0.45"
            />
            <Polygon
              points="50,11 80,28 80,66 50,89 20,66 20,28"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="2.8"
            />
            <Path
              d="M34 29 L50 20 L66 29"
              fill="none"
              stroke="#D1FAE5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
          </G>
        )}

        {tier === 'B' && (
          <G>
            <Polygon
              points="50,9 75,19 88,44 79,72 50,90 21,72 12,44 25,19"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="3"
            />
            <Polygon
              points="50,17 69,25 79,45 72,67 50,81 28,67 21,45 31,25"
              fill="none"
              stroke="#ECFCCB"
              strokeWidth="1.5"
              strokeOpacity="0.5"
            />
            <Polygon points="50,12 54,20 46,20" fill={cStroke} />
          </G>
        )}

        {tier === 'A' && (
          <G>
            <Path
              d="M32 16 L41 8 L50 15 L59 8 L68 16"
              fill="none"
              stroke={cStroke}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M50 15 L83 28 L80 60 C77 76 65 85 50 92 C35 85 23 76 20 60 L17 28 Z"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="3"
            />
            <Path
              d="M50 23 L75 33 L72 58 C70 70 60 78 50 83 C40 78 30 70 28 58 L25 33 Z"
              fill="none"
              stroke="#FEF3C7"
              strokeWidth="1.5"
              strokeOpacity="0.55"
            />
          </G>
        )}

        {tier === 'S' && (
          <G>
            <Path
              d="M6 32 L24 22 L20 64 L8 50 Z M94 32 L76 22 L80 64 L92 50 Z"
              fill={cStroke}
              fillOpacity="0.7"
            />
            <Polygon
              points="50,8 82,26 85,60 50,92 15,60 18,26"
              fill={`url(#${gradId})`}
              stroke={cStroke}
              strokeWidth="3.2"
            />
            <Polygon
              points="50,16 74,30 76,57 50,83 24,57 26,30"
              fill="none"
              stroke="#FFEDD5"
              strokeWidth="1.6"
              strokeOpacity="0.65"
            />
            <Polygon points="50,7 55,17 45,17" fill="#FFF7ED" />
          </G>
        )}

        {tier === 'S+' && (
          <G>
            <Path
              d="M4 28 L24 18 L20 68 L4 50 Z M96 28 L76 18 L80 68 L96 50 Z"
              fill={cStroke}
              fillOpacity="0.85"
            />
            <Path
              d="M30 14 L40 4 L50 12 L60 4 L70 14"
              fill="none"
              stroke="#FFE4E6"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Polygon
              points="50,11 84,28 86,62 50,93 14,62 16,28"
              fill={`url(#${gradId})`}
              stroke="#FFE4E6"
              strokeWidth="3.2"
            />
            <Polygon
              points="50,19 76,33 77,59 50,84 23,59 24,33"
              fill="none"
              stroke="#FFE4E6"
              strokeWidth="1.8"
              strokeOpacity="0.75"
            />
          </G>
        )}

        {/* Crisp Centered Tier Typography */}
        <SvgText
          x="50"
          y={tier === 'S+' ? '58' : '60'}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize={tier === 'S+' ? '28' : '33'}
          fontWeight="900"
          letterSpacing={tier === 'S+' ? -1 : 0}
        >
          {meta.tier}
        </SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
