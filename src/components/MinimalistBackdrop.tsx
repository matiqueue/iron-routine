import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

interface MinimalistBackdropProps {
  variant?: 'dots' | 'grid' | 'contours' | 'diagonal';
  accentColor?: string;
  secondaryColor?: string;
}

/**
 * Precision 45-degree diagonal architectural backdrop with dynamic corner
 * ambient glows, balanced for both Light and Dark modes and extending full-bleed
 * behind the Dynamic Island.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'diagonal', accentColor, secondaryColor }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    const diagPrimaryStroke = isDark
      ? 'rgba(255, 255, 255, 0.068)'
      : 'rgba(15, 23, 42, 0.068)';
    const diagFineStroke = isDark
      ? 'rgba(255, 255, 255, 0.032)'
      : 'rgba(15, 23, 42, 0.034)';
    const arcStroke = isDark
      ? 'rgba(255, 255, 255, 0.07)'
      : 'rgba(15, 23, 42, 0.072)';

    const patternSize = variant === 'grid' ? 40 : 32;

    return (
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id={`bg_diag_${uid}`}
            width={patternSize}
            height={patternSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Seamless infinite 45-degree diagonal architectural lines */}
            <Path
              d={`M -${patternSize / 2} ${patternSize / 2} L ${patternSize / 2} -${patternSize / 2} M 0 ${patternSize} L ${patternSize} 0 M ${patternSize / 2} ${patternSize * 1.5} L ${patternSize * 1.5} ${patternSize / 2}`}
              fill="none"
              stroke={diagPrimaryStroke}
              strokeWidth={0.95}
            />
            {variant === 'grid' && (
              <Path
                d={`M -${patternSize / 2} ${patternSize / 2} L ${patternSize / 2} ${patternSize * 1.5} M 0 0 L ${patternSize} ${patternSize} M ${patternSize / 2} -${patternSize / 2} L ${patternSize * 1.5} ${patternSize / 2}`}
                fill="none"
                stroke={diagFineStroke}
                strokeWidth={0.75}
              />
            )}
          </Pattern>

          <RadialGradient id={`bg_glow_top_${uid}`} cx="84%" cy="5%" r="65%">
            <Stop
              offset="0%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.21 : 0.16}
            />
            <Stop
              offset="52%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.07 : 0.055}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id={`bg_glow_btm_${uid}`} cx="14%" cy="92%" r="60%">
            <Stop
              offset="0%"
              stopColor={bottomGlow}
              stopOpacity={isDark ? 0.145 : 0.11}
            />
            <Stop
              offset="54%"
              stopColor={bottomGlow}
              stopOpacity={isDark ? 0.045 : 0.035}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_diag_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />

        {/* Subtle Concentric Corner Arcs */}
        <Circle
          cx="86%"
          cy="6%"
          r={138}
          fill="none"
          stroke={arcStroke}
          strokeWidth={0.9}
        />
        <Circle
          cx="12%"
          cy="92%"
          r={180}
          fill="none"
          stroke={arcStroke}
          strokeWidth={0.85}
          strokeDasharray="6 6"
        />

        {/* Editorial Spine Rule */}
        <Line
          x1="7%"
          y1="0"
          x2="7%"
          y2="100%"
          stroke={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.048)'}
          strokeWidth={1}
        />
      </Svg>
    );
  }
);
