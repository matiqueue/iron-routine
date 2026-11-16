import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

interface MinimalistBackdropProps {
  variant?: 'dots' | 'grid';
  accentColor?: string;
}

/**
 * Ultra-subtle architectural backdrop rendered cleanly behind designated app tabs.
 * Never intercepts touches and stays soft enough to keep all editorial typography legible.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'dots', accentColor }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const glowColor = accentColor || (isDark ? '#38BDF8' : '#10B981');

    return (
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {variant === 'grid' ? (
            <Pattern id={`bg_pat_${uid}`} width={48} height={48} patternUnits="userSpaceOnUse">
              <Path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke={isDark ? 'rgba(255,255,255,0.036)' : 'rgba(24,24,27,0.032)'}
                strokeWidth={0.85}
              />
            </Pattern>
          ) : (
            <Pattern id={`bg_pat_${uid}`} width={26} height={26} patternUnits="userSpaceOnUse">
              <Circle
                cx={1.5}
                cy={1.5}
                r={1}
                fill={isDark ? 'rgba(255,255,255,0.065)' : 'rgba(24,24,27,0.055)'}
              />
            </Pattern>
          )}
          <RadialGradient id={`bg_glow_top_${uid}`} cx="82%" cy="8%" r="58%">
            <Stop offset="0%" stopColor={glowColor} stopOpacity={isDark ? 0.095 : 0.05} />
            <Stop offset="60%" stopColor={glowColor} stopOpacity={isDark ? 0.025 : 0.015} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`bg_glow_btm_${uid}`} cx="14%" cy="86%" r="52%">
            <Stop offset="0%" stopColor="#10B981" stopOpacity={isDark ? 0.05 : 0.028} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_pat_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />
      </Svg>
    );
  }
);
