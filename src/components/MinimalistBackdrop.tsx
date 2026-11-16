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
  variant?: 'dots' | 'grid' | 'contours';
  accentColor?: string;
}

/**
 * Precision architectural & kinetic contour backdrop.
 * Zero dots: pairs crisp micro-crosshair instrumentation marks with subtle
 * concentric orbital arcs that extend smoothly behind the Dynamic Island.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'contours', accentColor }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const secondaryGlow = '#10B981';

    const hairlineStroke = isDark
      ? 'rgba(255, 255, 255, 0.068)'
      : 'rgba(15, 23, 42, 0.065)';
    const crossStroke = isDark
      ? 'rgba(255, 255, 255, 0.145)'
      : 'rgba(15, 23, 42, 0.145)';
    const arcStroke = isDark
      ? 'rgba(255, 255, 255, 0.075)'
      : 'rgba(15, 23, 42, 0.075)';

    return (
      <Svg
        width="100%"
        height="100%"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          {variant === 'grid' ? (
            <Pattern id={`bg_pat_${uid}`} width={52} height={52} patternUnits="userSpaceOnUse">
              <Path
                d="M 52 0 L 0 0 0 52"
                fill="none"
                stroke={hairlineStroke}
                strokeWidth={0.85}
              />
              {/* Precision "+" crosshair mark at intersections (no dots) */}
              <Path
                d="M 0 5 L 0 -5 M -5 0 L 5 0"
                fill="none"
                stroke={crossStroke}
                strokeWidth={1.1}
              />
            </Pattern>
          ) : (
            <Pattern id={`bg_pat_${uid}`} width={56} height={56} patternUnits="userSpaceOnUse">
              {/* Subtle diagonal architectural micro-mesh + "+" ticks */}
              <Line
                x1={0}
                y1={56}
                x2={56}
                y2={0}
                stroke={isDark ? 'rgba(255,255,255,0.032)' : 'rgba(15,23,42,0.035)'}
                strokeWidth={0.8}
              />
              <Path
                d="M 28 24.5 L 28 31.5 M 24.5 28 L 31.5 28"
                fill="none"
                stroke={crossStroke}
                strokeWidth={1}
                strokeLinecap="round"
              />
            </Pattern>
          )}

          <RadialGradient id={`bg_glow_top_${uid}`} cx="82%" cy="5%" r="64%">
            <Stop
              offset="0%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.19 : 0.14}
            />
            <Stop
              offset="55%"
              stopColor={primaryGlow}
              stopOpacity={isDark ? 0.065 : 0.048}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id={`bg_glow_btm_${uid}`} cx="14%" cy="90%" r="58%">
            <Stop
              offset="0%"
              stopColor={secondaryGlow}
              stopOpacity={isDark ? 0.12 : 0.095}
            />
            <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_pat_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />

        {/* Concentric Telemetry Arcs sweeping behind Dynamic Island & lower corner */}
        <Circle
          cx="86%"
          cy="6%"
          r={130}
          fill="none"
          stroke={arcStroke}
          strokeWidth={1}
        />
        <Circle
          cx="86%"
          cy="6%"
          r={225}
          fill="none"
          stroke={arcStroke}
          strokeWidth={0.85}
          strokeDasharray="6 6"
        />
        <Circle
          cx="10%"
          cy="92%"
          r={175}
          fill="none"
          stroke={arcStroke}
          strokeWidth={0.85}
        />

        {/* Vertical Editorial Guide Line */}
        <Line
          x1="7%"
          y1="0"
          x2="7%"
          y2="100%"
          stroke={isDark ? 'rgba(255,255,255,0.042)' : 'rgba(15,23,42,0.05)'}
          strokeWidth={1}
        />
      </Svg>
    );
  }
);
