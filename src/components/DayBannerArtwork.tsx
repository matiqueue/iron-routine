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
  Rect,
  Stop,
} from 'react-native-svg';
import { DayBannerTag } from '../types/workout';
import { useAppTheme } from '../context/ThemeContext';

interface DayBannerArtworkProps {
  tag: DayBannerTag;
  inverted?: boolean;
  compact?: boolean;
}

/**
 * Crisp offline geometric & athletic monochrome vector artwork keyed by DayBannerTag.
 * Renders safely on any device width with calibrated subtle ink contrast.
 */
export const DayBannerArtwork: React.FC<DayBannerArtworkProps> = ({
  tag,
  inverted = false,
  compact = false,
}) => {
  const { isDark } = useAppTheme();
  const inkColor = inverted ? (isDark ? '#09090B' : '#FFFFFF') : isDark ? '#FFFFFF' : '#09090B';

  const renderGlyph = () => {
    switch (tag) {
      case 'fbw':
      case 'chest':
      case 'push':
        return (
          <G opacity={0.18}>
            {/* Barbell & concentric kinetic plates */}
            <Line x1="40" y1="92" x2="290" y2="92" stroke={inkColor} strokeWidth="3.5" strokeLinecap="round" />
            <Circle cx="215" cy="92" r="56" stroke={inkColor} strokeWidth="2.5" fill="none" />
            <Circle cx="215" cy="92" r="40" stroke={inkColor} strokeWidth="2" fill="none" strokeDasharray="6 5" />
            <Circle cx="215" cy="92" r="22" stroke={inkColor} strokeWidth="3" fill="none" />
            <Circle cx="215" cy="92" r="7" fill={inkColor} />
            <Rect x="78" y="64" width="12" height="56" rx="4" stroke={inkColor} strokeWidth="2.5" fill="none" />
            <Rect x="96" y="72" width="10" height="40" rx="3" stroke={inkColor} strokeWidth="2" fill="none" />
            <Path d="M 122 44 L 258 140" stroke={inkColor} strokeWidth="1.2" opacity={0.5} />
          </G>
        );
      case 'pull':
      case 'back':
      case 'upper':
        return (
          <G opacity={0.18}>
            {/* Lat V-taper topographic ribs & pull vectors */}
            <Path d="M 140 24 L 215 154 L 290 24" stroke={inkColor} strokeWidth="3" fill="none" strokeLinejoin="round" />
            <Path d="M 162 28 L 215 124 L 268 28" stroke={inkColor} strokeWidth="2" fill="none" />
            <Path d="M 184 32 L 215 94 L 246 32" stroke={inkColor} strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            <Line x1="120" y1="30" x2="310" y2="30" stroke={inkColor} strokeWidth="2.5" strokeLinecap="round" />
            <Circle cx="215" cy="94" r="4" fill={inkColor} />
          </G>
        );
      case 'legs':
      case 'lower':
        return (
          <G opacity={0.18}>
            {/* Squat geometry & force arcs */}
            <Circle cx="235" cy="112" r="64" stroke={inkColor} strokeWidth="2" fill="none" strokeDasharray="8 6" />
            <Circle cx="235" cy="112" r="42" stroke={inkColor} strokeWidth="3" fill="none" />
            <Path d="M 145 142 L 200 58 L 255 112 L 304 42" stroke={inkColor} strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx="200" cy="58" r="6" fill={inkColor} />
            <Circle cx="255" cy="112" r="6" fill={inkColor} />
          </G>
        );
      case 'shoulders':
      case 'arms':
        return (
          <G opacity={0.18}>
            {/* Concentric angular arcs & peak tension apex */}
            <Circle cx="228" cy="88" r="58" stroke={inkColor} strokeWidth="2" fill="none" />
            <Circle cx="228" cy="88" r="38" stroke={inkColor} strokeWidth="2.5" fill="none" strokeDasharray="5 5" />
            <Path d="M 172 126 Q 228 24 284 126" stroke={inkColor} strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <Path d="M 190 138 Q 228 64 266 138" stroke={inkColor} strokeWidth="2" fill="none" />
            <Circle cx="228" cy="76" r="5" fill={inkColor} />
          </G>
        );
      case 'cardio':
        return (
          <G opacity={0.2}>
            {/* Conditioning track lanes + ECG kinetic pulse */}
            <Line x1="40" y1="42" x2="310" y2="42" stroke={inkColor} strokeWidth="1.2" opacity={0.5} />
            <Line x1="40" y1="138" x2="310" y2="138" stroke={inkColor} strokeWidth="1.2" opacity={0.5} />
            <Path
              d="M 48 96 L 120 96 L 142 54 L 164 130 L 190 36 L 216 124 L 238 82 L 258 96 L 312 96"
              stroke={inkColor}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx="190" cy="36" r="5" fill={inkColor} />
          </G>
        );
      case 'rest':
      default:
        return (
          <G opacity={0.16}>
            {/* Calm recovery horizon waves */}
            <Path d="M 40 96 Q 115 62 190 96 T 320 96" stroke={inkColor} strokeWidth="2.5" fill="none" />
            <Path d="M 40 118 Q 115 84 190 118 T 320 118" stroke={inkColor} strokeWidth="1.8" fill="none" strokeDasharray="6 6" />
            <Circle cx="256" cy="52" r="20" stroke={inkColor} strokeWidth="2.5" fill="none" />
            <Circle cx="263" cy="48" r="14" stroke={inkColor} strokeWidth="1.5" fill="none" opacity={0.5} />
          </G>
        );
    }
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 320 170" preserveAspectRatio="xMaxYMid slice">
        <Defs>
          <LinearGradient id="bannerFade" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={inkColor} stopOpacity="0" />
            <Stop offset="0.55" stopColor={inkColor} stopOpacity="0.04" />
            <Stop offset="1" stopColor={inkColor} stopOpacity="0.11" />
          </LinearGradient>
          <Pattern id="dotGrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <Circle cx="2" cy="2" r="1" fill={inkColor} opacity="0.11" />
          </Pattern>
        </Defs>

        <Rect x="0" y="0" width="320" height="170" fill="url(#dotGrid)" />
        <Rect x="0" y="0" width="320" height="170" fill="url(#bannerFade)" />
        {renderGlyph()}
      </Svg>
    </View>
  );
};

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
