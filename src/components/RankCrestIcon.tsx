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
  F: ['#71717A', '#18181B', '#D4D4D8', '#3F3F46'],
  E: ['#E2E8F0', '#334155', '#F8FAFC', '#64748B'],
  D: ['#38BDF8', '#075985', '#E0F2FE', '#0284C7'],
  C: ['#34D399', '#064E3B', '#D1FAE5', '#059669'],
  B: ['#A3E635', '#365314', '#F7FEE7', '#65A30D'],
  A: ['#FCD34D', '#78350F', '#FEF9C3', '#D97706'],
  S: ['#FB923C', '#7C2D12', '#FFEDD5', '#EA580C'],
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
    animated = false,
  }) => {
    const meta = RANK_TIER_MAP[tier] || RANK_TIER_MAP.F;
    const [cTop, cBot, cStroke, cMid] = TIER_GRADIENTS[tier] || TIER_GRADIENTS.F;
    const uid = useId().replace(/:/g, '_');
    const tierKey = `${tier.replace('+', 'plus')}_${uid}`;
    const gradId = `cg_${tierKey}`;
    const glossId = `cgl_${tierKey}`;
    const rimId = `crm_${tierKey}`;
    const glowId = `cgw_${tierKey}`;

    const tierRankIdx = TIER_ORDER[tier] ?? 0;
    const shouldAnimate = animated && !dimmed;
    const showOrbitRing = shouldAnimate && tierRankIdx >= 4;

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
            duration: tierRankIdx >= 6 ? 1400 : 1900,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: tierRankIdx >= 6 ? 1400 : 1900,
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
            duration: tier === 'S+' ? 5600 : tier === 'S' ? 7200 : 9000,
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
    const radius = 91;
    const circumference = 2 * Math.PI * radius;
    const clampedPct = Math.max(0, Math.min(100, progressPct || 0));
    const strokeDashoffset = circumference - (clampedPct / 100) * circumference;

    const haloOpacity = shouldAnimate
      ? pulseAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.35, 0.88],
        })
      : 0.45;

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
        {/* Background orbital aura & spinning star-arc ONLY when explicitly animated (keeps foreground SVG 1:1 Retina crisp) */}
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
            <Svg width={size} height={size} viewBox="0 0 200 200">
              <Path
                d="M 100 8 A 92 92 0 0 1 192 100"
                fill="none"
                stroke={cStroke}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeOpacity={0.78}
              />
              <Path
                d="M 100 192 A 92 92 0 0 1 8 100"
                fill="none"
                stroke={cTop}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeOpacity={0.5}
              />
              <Circle cx="100" cy="8" r="5" fill={cStroke} />
              <Circle cx="100" cy="192" r="3.8" fill={cTop} />
            </Svg>
          </Animated.View>
        )}

        {(shouldAnimate || (isSelected && tierRankIdx >= 4)) && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                pointerEvents: 'none',
                opacity: haloOpacity,
              },
            ]}
          >
            <Svg width={size} height={size} viewBox="0 0 200 200">
              <Defs>
                <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={cStroke} stopOpacity={0.48} />
                  <Stop offset="62%" stopColor={cTop} stopOpacity={0.14} />
                  <Stop offset="100%" stopColor={cTop} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx="100" cy="100" r="92" fill={`url(#${glowId})`} />
            </Svg>
          </Animated.View>
        )}

        {/* Main 1:1 unscaled high-precision 200x200 vector crest (zero raster scaling blur) */}
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
              <Stop offset="0%" stopColor={cTop} stopOpacity={1} />
              <Stop offset="52%" stopColor={cMid} stopOpacity={1} />
              <Stop offset="100%" stopColor={cBot} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id={glossId} x1="0" y1="0" x2="0.6" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.36} />
              <Stop offset="48%" stopColor="#FFFFFF" stopOpacity={0.04} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={0.2} />
            </LinearGradient>
            <LinearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.85} />
              <Stop offset="55%" stopColor={cStroke} stopOpacity={0.85} />
              <Stop offset="100%" stopColor={cTop} stopOpacity={0.7} />
            </LinearGradient>
          </Defs>

          {showRing && (
            <G rotation="-90" origin="100, 100">
              <Circle
                cx="100"
                cy="100"
                r={radius}
                stroke={cTop}
                strokeOpacity={0.18}
                strokeWidth="7.5"
                fill="none"
              />
              {clampedPct > 0 && (
                <Circle
                  cx="100"
                  cy="100"
                  r={radius}
                  stroke={cStroke}
                  strokeWidth="8.5"
                  strokeLinecap="round"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  fill="none"
                />
              )}
            </G>
          )}

          {/* F - Forged Graphite Hexagon */}
          {tier === 'F' && (
            <G strokeLinejoin="round">
              <Polygon
                points="100,26 164,62 164,138 100,174 36,138 36,62"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7"
              />
              <Polygon
                points="100,26 164,62 164,138 100,174 36,138 36,62"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="3.5"
              />
              <Polygon points="100,26 164,62 100,100 36,62" fill={`url(#${glossId})`} />
              <Polygon
                points="100,44 146,70 146,130 100,156 54,130 54,70"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1.8"
                strokeOpacity="0.2"
              />
            </G>
          )}

          {/* E - Brushed Steel Shield */}
          {tier === 'E' && (
            <G strokeLinejoin="round">
              <Path
                d="M100 22 L166 50 L164 110 C162 146 134 168 100 182 C66 168 38 146 36 110 L34 50 Z"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7"
              />
              <Path
                d="M100 22 L166 50 L164 110 C162 146 134 168 100 182 C66 168 38 146 36 110 L34 50 Z"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="3.8"
              />
              <Path d="M100 22 L166 50 L100 108 L34 50 Z" fill={`url(#${glossId})`} />
              <Path
                d="M68 56 L100 38 L132 56"
                fill="none"
                stroke={cStroke}
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeOpacity="0.82"
              />
            </G>
          )}

          {/* D - Cobalt Faceted Diamond */}
          {tier === 'D' && (
            <G strokeLinejoin="round">
              <Polygon
                points="100,16 174,100 100,184 26,100"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Polygon
                points="100,16 174,100 100,184 26,100"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4"
              />
              <Polygon points="100,16 174,100 100,100 26,100" fill={`url(#${glossId})`} />
              <Polygon
                points="100,38 152,100 100,162 48,100"
                fill="none"
                stroke="#E0F2FE"
                strokeWidth="2.4"
                strokeOpacity="0.58"
              />
              <Circle cx="100" cy="36" r="4" fill="#E0F2FE" />
            </G>
          )}

          {/* C - Emerald Winged Crest */}
          {tier === 'C' && (
            <G strokeLinejoin="round">
              <Path
                d="M18 72 L52 44 L52 132 L20 106 Z M182 72 L148 44 L148 132 L180 106 Z"
                fill={cTop}
                fillOpacity={0.72}
                stroke="#09090B"
                strokeWidth="5"
              />
              <Polygon
                points="100,20 162,54 162,134 100,180 38,134 38,54"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Polygon
                points="100,20 162,54 162,134 100,180 38,134 38,54"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4"
              />
              <Polygon points="100,20 162,54 100,104 38,54" fill={`url(#${glossId})`} />
              <Path
                d="M66 58 L100 38 L134 58"
                fill="none"
                stroke="#ECFDF5"
                strokeWidth="3.6"
                strokeLinecap="round"
                strokeOpacity="0.7"
              />
            </G>
          )}

          {/* B - Volt Kinetic Star-Octagon */}
          {tier === 'B' && (
            <G strokeLinejoin="round">
              <Polygon
                points="100,16 150,36 178,88 158,146 100,182 42,146 22,88 50,36"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Polygon
                points="100,16 150,36 178,88 158,146 100,182 42,146 22,88 50,36"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4.2"
              />
              <Polygon
                points="100,16 150,36 178,88 100,98 22,88 50,36"
                fill={`url(#${glossId})`}
              />
              <Polygon
                points="100,34 138,50 158,90 144,134 100,162 56,134 42,90 62,50"
                fill="none"
                stroke="#ECFCCB"
                strokeWidth="2.4"
                strokeOpacity="0.6"
              />
              <Polygon points="100,22 110,42 90,42" fill="#F7FEE7" />
            </G>
          )}

          {/* A - Sovereign Gold Diadem Shield */}
          {tier === 'A' && (
            <G strokeLinejoin="round">
              <Path
                d="M60 32 L80 12 L100 28 L120 12 L140 32"
                fill="none"
                stroke="#09090B"
                strokeWidth="9"
                strokeLinecap="round"
              />
              <Path
                d="M60 32 L80 12 L100 28 L120 12 L140 32"
                fill="none"
                stroke={cStroke}
                strokeWidth="4.8"
                strokeLinecap="round"
              />
              <Circle cx="100" cy="22" r="5" fill="#FFFBEB" />
              <Path
                d="M100 30 L168 56 L160 120 C154 154 130 172 100 186 C70 172 46 154 40 120 L32 56 Z"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Path
                d="M100 30 L168 56 L160 120 C154 154 130 172 100 186 C70 172 46 154 40 120 L32 56 Z"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4.2"
              />
              <Path d="M100 30 L168 56 L100 104 L32 56 Z" fill={`url(#${glossId})`} />
              <Path
                d="M100 46 L150 66 L144 116 C140 140 120 156 100 166 C80 156 60 140 56 116 L50 66 Z"
                fill="none"
                stroke="#FEF3C7"
                strokeWidth="2.4"
                strokeOpacity="0.65"
              />
            </G>
          )}

          {/* S - Forged Apex Prism + Flame Wings */}
          {tier === 'S' && (
            <G strokeLinejoin="round">
              <Path
                d="M10 64 L48 40 L42 134 L14 104 Z M190 64 L152 40 L158 134 L186 104 Z"
                fill={cStroke}
                fillOpacity={0.86}
                stroke="#09090B"
                strokeWidth="5.5"
              />
              <Polygon
                points="100,16 166,52 170,122 100,184 30,122 34,52"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Polygon
                points="100,16 166,52 170,122 100,184 30,122 34,52"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4.4"
              />
              <Polygon points="100,16 166,52 100,102 34,52" fill={`url(#${glossId})`} />
              <Polygon
                points="100,32 148,60 152,114 100,166 48,114 52,60"
                fill="none"
                stroke="#FFEDD5"
                strokeWidth="2.6"
                strokeOpacity="0.72"
              />
              <Polygon points="100,10 112,34 100,42 88,34" fill="#FFF7ED" />
            </G>
          )}

          {/* S+ - Mythic Crimson Seraphic Crown Crest */}
          {tier === 'S+' && (
            <G strokeLinejoin="round">
              <Path
                d="M6 56 L48 32 L40 140 L6 102 Z M194 56 L152 32 L160 140 L194 102 Z"
                fill={cStroke}
                fillOpacity={0.9}
                stroke="#09090B"
                strokeWidth="5.5"
              />
              <Path
                d="M14 80 L42 62 L40 112 Z M186 80 L158 62 L160 112 Z"
                fill="#FFFFFF"
                fillOpacity={0.3}
              />
              <Path
                d="M56 30 L78 8 L100 24 L122 8 L144 30"
                fill="none"
                stroke="#09090B"
                strokeWidth="9.5"
                strokeLinecap="round"
              />
              <Path
                d="M56 30 L78 8 L100 24 L122 8 L144 30"
                fill="none"
                stroke="#FFE4E6"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <Polygon points="100,12 108,26 100,34 92,26" fill="#FFFFFF" />
              <Polygon
                points="100,24 168,56 172,124 100,186 28,124 32,56"
                fill={`url(#${gradId})`}
                stroke="#09090B"
                strokeWidth="7.5"
              />
              <Polygon
                points="100,24 168,56 172,124 100,186 28,124 32,56"
                fill="none"
                stroke={`url(#${rimId})`}
                strokeWidth="4.6"
              />
              <Polygon points="100,24 168,56 100,104 32,56" fill={`url(#${glossId})`} />
              <Polygon
                points="100,40 152,66 154,118 100,168 46,118 48,66"
                fill="none"
                stroke="#FFE4E6"
                strokeWidth="2.8"
                strokeOpacity="0.82"
              />
            </G>
          )}

          {/* Razor-sharp crisp Retina typography with subtle dark rim stroke */}
          <SvgText
            x="100"
            y={tier === 'S+' ? '117' : '121'}
            textAnchor="middle"
            fill="#FFFFFF"
            stroke="#09090B"
            strokeWidth="3.2"
            fontSize={tier === 'S+' ? '56' : '66'}
            fontWeight="900"
            letterSpacing={tier === 'S+' ? -2 : 0}
          >
            {meta.tier}
          </SvgText>
        </Svg>
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
