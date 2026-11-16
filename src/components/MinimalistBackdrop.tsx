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
  variant?: 'dots' | 'grid';
  accentColor?: string;
}

/**
 * Crisp minimalist architectural backdrop with clear visual depth in both
 * Light and Dark modes without competing with foreground typography or cards.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'dots', accentColor }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const secondaryGlow = isDark ? '#10B981' : '#10B981';

    return (
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {variant === 'grid' ? (
            <Pattern id={`bg_pat_${uid}`} width={44} height={44} patternUnits="userSpaceOnUse">
              <Path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.088)' : 'rgba(15,23,42,0.085)'}
                strokeWidth={0.95}
              />
              <Circle
                cx={0}
                cy={0}
                r={1.35}
                fill={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.16)'}
              />
            </Pattern>
          ) : (
            <Pattern id={`bg_pat_${uid}`} width={26} height={26} patternUnits="userSpaceOnUse">
              <Circle
                cx={2}
                cy={2}
                r={1.3}
                fill={isDark ? 'rgba(255,255,255,0.13)' : 'rgba(15,23,42,0.135)'}
              />
            </Pattern>
          )}

          <RadialGradient id={`bg_glow_top_${uid}`} cx="85%" cy="6%" r="62%">
            <Stop
              offset="0%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.17 : 0.125}
            />
            <Stop
              offset="58%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.055 : 0.04}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id={`bg_glow_btm_${uid}`} cx="12%" cy="88%" r="56%">
            <Stop
              offset="0%"
              stopColor={secondaryGlow}
              stopOpacity={isDark ? 0.11 : 0.085}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_pat_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />

        {/* Subtle Top-to-Bottom Architectural Rule */}
        <Line
          x1="8%"
          y1="0"
          x2="8%"
          y2="100%"
          stroke={isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.045)'}
          strokeWidth={1}
        />
      </Svg>
    );
  }
);
