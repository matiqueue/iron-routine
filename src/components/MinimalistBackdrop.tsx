import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
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
 * Aesthetic minimalist backdrop composed of staggered short 45-degree diagonal
 * dashes in spaced intervals with soft radial corner color ambient glows.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'diagonal', accentColor, secondaryColor }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    const strokePrimary = isDark
      ? 'rgba(255, 255, 255, 0.088)'
      : 'rgba(15, 23, 42, 0.085)';
    const strokeSecondary = isDark
      ? 'rgba(255, 255, 255, 0.048)'
      : 'rgba(15, 23, 42, 0.048)';

    const tile = variant === 'grid' ? 54 : 46;

    return (
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <Pattern
            id={`bg_slashes_${uid}`}
            width={tile}
            height={tile}
            patternUnits="userSpaceOnUse"
          >
            {/* Staggered short 45-degree diagonal kinetic dashes */}
            <Path
              d={`M ${tile * 0.16} ${tile * 0.38} L ${tile * 0.38} ${tile * 0.16}`}
              fill="none"
              stroke={strokePrimary}
              strokeWidth={1.35}
              strokeLinecap="round"
            />
            <Path
              d={`M ${tile * 0.62} ${tile * 0.84} L ${tile * 0.84} ${tile * 0.62}`}
              fill="none"
              stroke={strokeSecondary}
              strokeWidth={1.2}
              strokeLinecap="round"
            />
          </Pattern>

          <RadialGradient id={`bg_glow_top_${uid}`} cx="86%" cy="4%" r="62%">
            <Stop
              offset="0%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.18 : 0.135}
            />
            <Stop
              offset="54%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.055 : 0.042}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id={`bg_glow_btm_${uid}`} cx="12%" cy="94%" r="58%">
            <Stop
              offset="0%"
              stopColor={bottomGlow}
              stopOpacity={isDark ? 0.13 : 0.095}
            />
            <Stop
              offset="55%"
              stopColor={bottomGlow}
              stopOpacity={isDark ? 0.04 : 0.03}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_slashes_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />
      </Svg>
    );
  }
);
