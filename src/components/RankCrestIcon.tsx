import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
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
  animated?: boolean;
}

const TIER_GRADIENTS: Record<RankTier, [string, string, string, string]> = {
  F: ['#52525B', '#1F1F24', '#A1A1AA', '#27272A'],
  E: ['#CBD5E1', '#475569', '#F1F5F9', '#64748B'],
  D: ['#38BDF8', '#0369A1', '#BAE6FD', '#0284C7'],
  C: ['#34D399', '#065F46', '#A7F3D0', '#059669'],
  B: ['#A3E635', '#365314', '#ECFCCB', '#65A30D'],
  A: ['#FBBF24', '#92400E', '#FEF3C7', '#D97706'],
  S: ['#FB923C', '#9A3412', '#FFEDD5', '#EA580C'],
  'S+': ['#FB7185', '#881337', '#FFE4E6', '#E11D48'],
};

const TIER_ORDER: Record<RankTier, number> = {
  F: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
  S: 6,
  'S+': 7,
};

export const RankCrestIcon: React.FC<RankCrestIconProps> = React.memo(
  ({
    tier,
    size = 38,
    progressPct,
    isSelected = false,
    dimmed = false,
    animated = true,
  }) => {
    const meta = RANK_TIER_MAP[tier] || RANK_TIER_MAP.F;
    const [cTop, cBot, cStroke, cMid] = TIER_GRADIENTS[tier] || TIER_GRADIENTS.F;
    const uid = useId().replace(/:/g, '_');
    const tierKey = `${tier.replace('+', 'plus')}_${uid}`;
    const gradId = `cg_${tierKey}`;
    const glossId = `cgl_${tierKey}`;
    const glowId = `cgw_${tierKey}`;

    const tierRankIdx = TIER_ORDER[tier] ?? 0;
    const shouldAnimate = animated && !dimmed && (isSelected || tierRankIdx >= 3 || size >= 24);
    const showOrbitRing = shouldAnimate && (tierRankIdx >= 5 || (isSelected && tierRankIdx >= 3));

    const pulseAnim = useRef(new Animated.Value(0)).current;
    const orbitAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      pulseAnim.stopAnimation();
      orbitAnim.stopAnimation();
      if (!shouldAnimate) {
        pulseAnim.setValue(0);
        orbitAnim.setValue(0);
        return;
      }

      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: tierRankIdx >= 6 ? 1350 : 1850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: tierRankIdx >= 6 ? 1350 : 1850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      let orbitLoop: Animated.CompositeAnimation | null = null;
      if (showOrbitRing) {
        orbitLoop = Animated.loop(
          Animated.timing(orbitAnim, {
            toValue: 1,
            duration: tier === 'S+' ? 5200 : tier === 'S' ? 6800 : 8800,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        );
        orbitLoop.start();
      }

      return () => {
        pulseLoop.stop();
        orbitLoop?.stop();
      };
    }, [shouldAnimate, showOrbitRing, tierRankIdx, tier, pulseAnim, orbitAnim]);

    const showRing = typeof progressPct === 'number';
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const clampedPct = Math.max(0, Math.min(100, progressPct || 0));
    const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

    const crestScale = shouldAnimate
      ? pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: isSelected ? [1.04, 1.12] : [0.985, 1.035],
        })
      : isSelected
      ? 1.08
      : 1;

    const haloOpacity = shouldAnimate
      ? pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.32, 0.78],
        })
      : 0.35;

    const orbitRotate = orbitAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View
        style={[
          styles.wrap,
          {
            width: size,
            height: size,
            opacity: dimmed ? 0.42 : 1,
          },
        ]}
      >
        {/* Orbital celestial energy ring + spark motes for elite tiers */}
        {showOrbitRing && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                pointerEvents: 'none',
                transform: [{ rotate: orbitRotate }],
              },
            ]}
          >
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Path
                d="M 50 4 A 46 46 0 0 1 96 50"
                fill="none"
                stroke={cStroke}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeOpacity={0.72}
              />
              <Path
                d="M 50 96 A 46 46 0 0 1 4 50"
                fill="none"
                stroke={cTop}
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeOpacity={0.5}
              />
              <Circle cx="50" cy="4" r="3" fill={cStroke} />
              <Circle cx="50" cy="96" r="2.2" fill={cTop} />
            </Svg>
          </Animated.View>
        )}

        {/* Pulsing radial ambient glow behind crest */}
        {(tierRankIdx >= 4 || isSelected) && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                pointerEvents: 'none',
                opacity: haloOpacity,
              },
            ]}
          >
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Defs>
                <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={cStroke} stopOpacity={0.55} />
                  <Stop offset="62%" stopColor={cTop} stopOpacity={0.18} />
                  <Stop offset="100%" stopColor={cTop} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="50" cy="50" r="46" fill={`url(#${glowId})`} />
            </Svg>
          </Animated.View>
        )}

        <Animated.View style={{ transform: [{ scale: crestScale }] }}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0.2" y2="1">
                <Stop offset="0%" stopColor={cTop} stopOpacity={0.98} />
                <Stop offset="52%" stopColor={cMid} stopOpacity={0.98} />
                <Stop offset="100%" stopColor={cBot} stopOpacity={1} />
              </LinearGradient>
              <LinearGradient id={glossId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.34} />
                <Stop offset="45%" stopColor="#FFFFFF" stopOpacity={0.05} />
                <Stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
              </LinearGradient>
            </Defs>

            {/* Optional XP progress ring */}
            {showRing && (
              <G rotation="-90" origin="50, 50">
                <Circle
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={cTop}
                  strokeOpacity={0.18}
                  strokeWidth="4"
                  fill="none"
                />
                {clampedPct > 0 && (
                  <Circle
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={cStroke}
                    strokeWidth="4.6"
                    strokeLinecap="round"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    fill="none"
                  />
                )}
              </G>
            )}

            {/* F - Iron Graphite Faceted Hexagon */}
            {tier === 'F' && (
              <G>
                <Polygon
                  points="50,13 82,31 82,69 50,87 18,69 18,31"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="2.5"
                  strokeOpacity="0.72"
                />
                <Polygon
                  points="50,13 82,31 50,50 18,31"
                  fill={`url(#${glossId})`}
                />
                <Polygon
                  points="50,22 73,35 73,65 50,78 27,65 27,35"
                  fill="none"
                  stroke="#E4E4E7"
                  strokeWidth="1.2"
                  strokeOpacity="0.28"
                />
              </G>
            )}

            {/* E - Brushed Steel Shield + Top Chevrons */}
            {tier === 'E' && (
              <G>
                <Path
                  d="M50 11 L83 25 L82 55 C81 73 67 84 50 91 C33 84 19 73 18 55 L17 25 Z"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="2.6"
                />
                <Path
                  d="M50 11 L83 25 L50 54 L17 25 Z"
                  fill={`url(#${glossId})`}
                />
                <Path
                  d="M35 28 L50 19 L65 28"
                  fill="none"
                  stroke={cStroke}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeOpacity="0.82"
                />
              </G>
            )}

            {/* D - Cobalt Crystal Diamond */}
            {tier === 'D' && (
              <G>
                <Polygon
                  points="50,9 87,50 50,91 13,50"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="2.8"
                />
                <Polygon points="50,9 87,50 50,50 13,50" fill={`url(#${glossId})`} />
                <Polygon
                  points="50,19 76,50 50,81 24,50"
                  fill="none"
                  stroke="#E0F2FE"
                  strokeWidth="1.5"
                  strokeOpacity="0.55"
                />
                <Circle cx="50" cy="18" r="2.2" fill="#E0F2FE" />
              </G>
            )}

            {/* C - Emerald Winged Crest */}
            {tier === 'C' && (
              <G>
                <Path
                  d="M9 36 L25 22 L25 65 L10 53 Z M91 36 L75 22 L75 65 L90 53 Z"
                  fill={cTop}
                  fillOpacity="0.6"
                  stroke={cStroke}
                  strokeWidth="1.4"
                  strokeOpacity="0.45"
                />
                <Polygon
                  points="50,11 80,27 80,67 50,89 20,67 20,27"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="2.8"
                />
                <Polygon points="50,11 80,27 50,52 20,27" fill={`url(#${glossId})`} />
                <Path
                  d="M34 29 L50 19 L66 29"
                  fill="none"
                  stroke="#ECFDF5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeOpacity="0.65"
                />
              </G>
            )}

            {/* B - Kinetic Volt Star-Octagon */}
            {tier === 'B' && (
              <G>
                <Polygon
                  points="50,8 75,18 89,44 79,73 50,91 21,73 11,44 25,18"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="2.9"
                />
                <Polygon
                  points="50,8 75,18 89,44 50,48 11,44 25,18"
                  fill={`url(#${glossId})`}
                />
                <Polygon
                  points="50,17 69,25 79,45 72,67 50,81 28,67 21,45 31,25"
                  fill="none"
                  stroke="#ECFCCB"
                  strokeWidth="1.5"
                  strokeOpacity="0.58"
                />
                <Polygon points="50,11 55,21 45,21" fill="#F7FEE7" />
              </G>
            )}

            {/* A - Sovereign Gold Diadem Shield */}
            {tier === 'A' && (
              <G>
                <Path
                  d="M30 16 L40 6 L50 14 L60 6 L70 16"
                  fill="none"
                  stroke={cStroke}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="50" cy="11" r="2.6" fill="#FFFBEB" />
                <Path
                  d="M50 15 L84 28 L80 60 C77 77 65 86 50 93 C35 86 23 77 20 60 L16 28 Z"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="3"
                />
                <Path d="M50 15 L84 28 L50 52 L16 28 Z" fill={`url(#${glossId})`} />
                <Path
                  d="M50 23 L75 33 L72 58 C70 70 60 78 50 83 C40 78 30 70 28 58 L25 33 Z"
                  fill="none"
                  stroke="#FEF3C7"
                  strokeWidth="1.5"
                  strokeOpacity="0.65"
                />
              </G>
            )}

            {/* S - Forged Apex Prism + Flame Wings */}
            {tier === 'S' && (
              <G>
                <Path
                  d="M5 32 L24 20 L21 67 L7 52 Z M95 32 L76 20 L79 67 L93 52 Z"
                  fill={cStroke}
                  fillOpacity="0.82"
                  stroke="#FFF7ED"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                />
                <Polygon
                  points="50,8 83,26 85,61 50,92 15,61 17,26"
                  fill={`url(#${gradId})`}
                  stroke={cStroke}
                  strokeWidth="3.1"
                />
                <Polygon points="50,8 83,26 50,51 17,26" fill={`url(#${glossId})`} />
                <Polygon
                  points="50,16 74,30 76,57 50,83 24,57 26,30"
                  fill="none"
                  stroke="#FFEDD5"
                  strokeWidth="1.6"
                  strokeOpacity="0.72"
                />
                <Polygon points="50,6 56,17 50,21 44,17" fill="#FFF7ED" />
              </G>
            )}

            {/* S+ - Mythic Crimson Seraphic Crown Crest */}
            {tier === 'S+' && (
              <G>
                <Path
                  d="M3 28 L24 16 L20 70 L3 51 Z M97 28 L76 16 L80 70 L97 51 Z"
                  fill={cStroke}
                  fillOpacity="0.88"
                />
                <Path
                  d="M7 40 L21 31 L20 56 Z M93 40 L79 31 L80 56 Z"
                  fill="#FFFFFF"
                  fillOpacity="0.32"
                />
                <Path
                  d="M28 15 L39 4 L50 12 L61 4 L72 15"
                  fill="none"
                  stroke="#FFE4E6"
                  strokeWidth="3.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polygon points="50,6 54,13 50,17 46,13" fill="#FFFFFF" />
                <Polygon
                  points="50,12 84,28 86,62 50,93 14,62 16,28"
                  fill={`url(#${gradId})`}
                  stroke="#FFE4E6"
                  strokeWidth="3.2"
                />
                <Polygon points="50,12 84,28 50,52 16,28" fill={`url(#${glossId})`} />
                <Polygon
                  points="50,20 76,33 77,59 50,84 23,59 24,33"
                  fill="none"
                  stroke="#FFE4E6"
                  strokeWidth="1.7"
                  strokeOpacity="0.8"
                />
              </G>
            )}

            {/* Subtle dark drop shadow behind tier letter for contrast */}
            <SvgText
              x="50"
              y={tier === 'S+' ? '59.5' : '61.5'}
              textAnchor="middle"
              fill="#000000"
              fillOpacity={0.38}
              fontSize={tier === 'S+' ? '28' : '33'}
              fontWeight="900"
              letterSpacing={tier === 'S+' ? -1 : 0}
            >
              {meta.tier}
            </SvgText>
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
        </Animated.View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
