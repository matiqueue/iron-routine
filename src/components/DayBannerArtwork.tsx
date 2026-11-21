import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { DayBannerTag } from '../types/workout';
import { useAppTheme } from '../context/ThemeContext';

interface DayBannerArtworkProps {
  tag: DayBannerTag;
  inverted?: boolean;
  compact?: boolean;
  variantIndex?: number;
}

const VARIANT_ACCENTS_DARK = [
  '#38BDF8', // Sky
  '#10B981', // Emerald
  '#A855F7', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Rose
  '#14B8A6', // Teal
];

const VARIANT_ACCENTS_LIGHT = [
  '#0284C7',
  '#059669',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#0D9488',
];

const BLOOM_CENTERS: Array<{ cx: string; cy: string; rx: string; ry: string }> = [
  { cx: '82%', cy: '22%', rx: '58%', ry: '85%' },
  { cx: '78%', cy: '78%', rx: '62%', ry: '80%' },
  { cx: '26%', cy: '18%', rx: '58%', ry: '84%' },
  { cx: '86%', cy: '48%', rx: '55%', ry: '88%' },
  { cx: '22%', cy: '82%', rx: '60%', ry: '82%' },
  { cx: '65%', cy: '16%', rx: '60%', ry: '86%' },
];

/**
 * Crisp offline geometric & athletic vector artwork keyed by DayBannerTag and optional variantIndex.
 * Renders distinct subtle accent blooms and shifted geometry so sibling cards visually evolve when swiping.
 */
export const DayBannerArtwork: React.FC<DayBannerArtworkProps> = React.memo(({
  tag,
  inverted = false,
  compact = false,
  variantIndex,
}) => {
  const { isDark } = useAppTheme();
  const inkColor = inverted ? (isDark ? '#09090B' : '#FFFFFF') : isDark ? '#FFFFFF' : '#09090B';
  const hasVariant = typeof variantIndex === 'number' && variantIndex >= 0;
  const vIdx = hasVariant ? variantIndex % VARIANT_ACCENTS_DARK.length : 0;
  const accentColor = hasVariant
    ? (isDark ? VARIANT_ACCENTS_DARK[vIdx] : VARIANT_ACCENTS_LIGHT[vIdx])
    : inkColor;
  const bloom = BLOOM_CENTERS[vIdx % BLOOM_CENTERS.length];
  const uid = `${tag}_${hasVariant ? vIdx : 'base'}_${isDark ? 'd' : 'l'}_${inverted ? 'i' : 'n'}`;
  const glyphShiftX = hasVariant ? ((vIdx % 3) - 1) * 14 : 0;
  const glyphShiftY = hasVariant ? (vIdx % 2 === 0 ? -5 : 7) : 0;
  const strokeMain = hasVariant && !inverted ? accentColor : inkColor;

  const renderGlyph = () => {
    switch (tag) {
      case 'fbw':
      case 'chest':
      case 'push':
        return (
          <G opacity={hasVariant && !inverted ? 0.28 : 0.18} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Barbell & concentric kinetic plates */}
            <Line x1="40" y1="92" x2="290" y2="92" stroke={inkColor} strokeWidth="3.2" strokeLinecap="round" opacity={0.75} />
            <Circle cx="215" cy="92" r="56" stroke={strokeMain} strokeWidth="2.6" fill="none" />
            <Circle cx="215" cy="92" r="40" stroke={inkColor} strokeWidth="2" fill="none" strokeDasharray="6 5" opacity={0.75} />
            <Circle cx="215" cy="92" r="22" stroke={strokeMain} strokeWidth="3" fill="none" />
            <Circle cx="215" cy="92" r="7" fill={strokeMain} />
            <Rect x="78" y="64" width="12" height="56" rx="4" stroke={inkColor} strokeWidth="2.4" fill="none" opacity={0.75} />
            <Rect x="96" y="72" width="10" height="40" rx="3" stroke={strokeMain} strokeWidth="2" fill="none" />
            <Path d="M 122 44 L 258 140" stroke={strokeMain} strokeWidth="1.4" opacity={0.55} />
          </G>
        );
      case 'pull':
      case 'back':
      case 'upper':
        return (
          <G opacity={hasVariant && !inverted ? 0.28 : 0.18} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Lat V-taper topographic ribs & pull vectors */}
            <Path d="M 140 24 L 215 154 L 290 24" stroke={strokeMain} strokeWidth="3.2" fill="none" strokeLinejoin="round" />
            <Path d="M 162 28 L 215 124 L 268 28" stroke={inkColor} strokeWidth="2" fill="none" opacity={0.75} />
            <Path d="M 184 32 L 215 94 L 246 32" stroke={strokeMain} strokeWidth="1.7" fill="none" strokeDasharray="4 4" />
            <Line x1="120" y1="30" x2="310" y2="30" stroke={inkColor} strokeWidth="2.5" strokeLinecap="round" opacity={0.75} />
            <Circle cx="215" cy="94" r="4.5" fill={strokeMain} />
          </G>
        );
      case 'legs':
      case 'lower':
        return (
          <G opacity={hasVariant && !inverted ? 0.28 : 0.18} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Squat geometry & force arcs */}
            <Circle cx="235" cy="112" r="64" stroke={strokeMain} strokeWidth="2.2" fill="none" strokeDasharray="8 6" />
            <Circle cx="235" cy="112" r="42" stroke={inkColor} strokeWidth="3" fill="none" opacity={0.75} />
            <Path d="M 145 142 L 200 58 L 255 112 L 304 42" stroke={strokeMain} strokeWidth="3.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="200" cy="58" r="6" fill={strokeMain} />
            <Circle cx="255" cy="112" r="6" fill={inkColor} opacity={0.85} />
          </G>
        );
      case 'shoulders':
      case 'arms':
        return (
          <G opacity={hasVariant && !inverted ? 0.28 : 0.18} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Concentric angular arcs & peak tension apex */}
            <Circle cx="228" cy="88" r="58" stroke={strokeMain} strokeWidth="2.2" fill="none" />
            <Circle cx="228" cy="88" r="38" stroke={inkColor} strokeWidth="2.5" fill="none" strokeDasharray="5 5" opacity={0.75} />
            <Path d="M 172 126 Q 228 24 284 126" stroke={strokeMain} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <Path d="M 190 138 Q 228 64 266 138" stroke={inkColor} strokeWidth="2" fill="none" opacity={0.75} />
            <Circle cx="228" cy="76" r="5.5" fill={strokeMain} />
          </G>
        );
      case 'cardio':
        return (
          <G opacity={hasVariant && !inverted ? 0.3 : 0.2} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Conditioning track lanes + ECG kinetic pulse */}
            <Line x1="40" y1="42" x2="310" y2="42" stroke={inkColor} strokeWidth="1.2" opacity={0.5} />
            <Line x1="40" y1="138" x2="310" y2="138" stroke={inkColor} strokeWidth="1.2" opacity={0.5} />
            <Path
              d="M 48 96 L 120 96 L 142 54 L 164 130 L 190 36 L 216 124 L 238 82 L 258 96 L 312 96"
              stroke={strokeMain}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx="190" cy="36" r="5.5" fill={strokeMain} />
          </G>
        );
      case 'rest':
      default:
        return (
          <G opacity={hasVariant && !inverted ? 0.24 : 0.16} transform={`translate(${glyphShiftX}, ${glyphShiftY})`}>
            {/* Calm recovery horizon waves */}
            <Path d="M 40 96 Q 115 62 190 96 T 320 96" stroke={strokeMain} strokeWidth="2.5" fill="none" />
            <Path d="M 40 118 Q 115 84 190 118 T 320 118" stroke={inkColor} strokeWidth="1.8" fill="none" strokeDasharray="6 6" opacity={0.75} />
            <Circle cx="256" cy="52" r="20" stroke={strokeMain} strokeWidth="2.5" fill="none" />
            <Circle cx="263" cy="48" r="14" stroke={inkColor} strokeWidth="1.5" fill="none" opacity={0.5} />
          </G>
        );
    }
  };

  return (
    <View
      key={uid}
      shouldRasterizeIOS
      renderToHardwareTextureAndroid
      style={[styles.wrap, compact && styles.wrapCompact, { pointerEvents: 'none' }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 170" preserveAspectRatio="xMaxYMid slice">
        <Defs>
          <LinearGradient id={`bannerFade_${uid}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={inkColor} stopOpacity="0" />
            <Stop offset="0.55" stopColor={inkColor} stopOpacity="0.035" />
            <Stop offset="1" stopColor={inkColor} stopOpacity="0.1" />
          </LinearGradient>
          {hasVariant && !inverted && (
            <RadialGradient
              id={`bannerBloom_${uid}`}
              cx={bloom.cx}
              cy={bloom.cy}
              rx={bloom.rx}
              ry={bloom.ry}
            >
              <Stop offset="0" stopColor={accentColor} stopOpacity={isDark ? '0.26' : '0.18'} />
              <Stop offset="0.52" stopColor={accentColor} stopOpacity={isDark ? '0.09' : '0.06'} />
              <Stop offset="1" stopColor={accentColor} stopOpacity="0" />
            </RadialGradient>
          )}
          <Pattern id={`dotGrid_${uid}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill={inkColor} opacity="0.1" />
          </Pattern>
        </Defs>

        {hasVariant && !inverted && (
          <Rect x="0" y="0" width="320" height="170" fill={`url(#bannerBloom_${uid})`} />
        )}
        <Rect x="0" y="0" width="320" height="170" fill={`url(#dotGrid_${uid})`} />
        <Rect x="0" y="0" width="320" height="170" fill={`url(#bannerFade_${uid})`} />
        {renderGlyph()}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  wrapCompact: {
    opacity: 0.9,
  },
});
