import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
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
  showCornerGlows?: boolean;
}

/**
 * Architectural precision dark-gym backdrop: sparse geometric crosshairs,
 * faint concentric depth arcs and optional soft corner ambient glows.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'diagonal', accentColor, secondaryColor, showCornerGlows = true }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    const strokePrimary = isDark
      ? 'rgba(255, 255, 255, 0.055)'
      : 'rgba(15, 23, 42, 0.055)';
    const strokeSecondary = isDark
      ? 'rgba(255, 255, 255, 0.03)'
      : 'rgba(15, 23, 42, 0.032)';
    const dotFill = isDark
      ? 'rgba(255, 255, 255, 0.085)'
      : 'rgba(15, 23, 42, 0.075)';

    const tile = variant === 'grid' ? 128 : 136;
    const half = tile / 2;

    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={`bg_arch_${uid}`}
              width={tile}
              height={tile}
              patternUnits="userSpaceOnUse"
            >
              {/* Subtle vertical & horizontal telemetry hairlines */}
              <Path
                d={`M ${half} 0 L ${half} ${tile} M 0 ${half} L ${tile} ${half}`}
                fill="none"
                stroke={strokeSecondary}
                strokeWidth={0.75}
                strokeDasharray="3 11"
              />
              {/* Precision crosshair intersection at center */}
              <Path
                d={`M ${half - 5} ${half} L ${half + 5} ${half} M ${half} ${half - 5} L ${half} ${half + 5}`}
                fill="none"
                stroke={strokePrimary}
                strokeWidth={1.15}
                strokeLinecap="round"
              />
              {/* Minimalist chamfer corner node */}
              <Circle cx={0} cy={0} r={1.35} fill={dotFill} />
              <Circle cx={tile} cy={0} r={1.35} fill={dotFill} />
              <Circle cx={0} cy={tile} r={1.35} fill={dotFill} />
              <Circle cx={half} cy={half} r={14} fill="none" stroke={strokeSecondary} strokeWidth={0.8} />
            </Pattern>

            {showCornerGlows && (
              <>
                <RadialGradient id={`bg_glow_top_${uid}`} cx="86%" cy="4%" r="62%">
                  <Stop
                    offset="0%"
                    stopColor={primaryGlow}
                    stopOpacity={isDark ? 0.19 : 0.14}
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
                    stopOpacity={isDark ? 0.14 : 0.095}
                  />
                  <Stop
                    offset="55%"
                    stopColor={bottomGlow}
                    stopOpacity={isDark ? 0.042 : 0.028}
                  />
                  <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>
              </>
            )}
          </Defs>

          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_arch_${uid})`} />
          {showCornerGlows && (
            <>
              <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_top_${uid})`} />
              <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_glow_btm_${uid})`} />
            </>
          )}
        </Svg>
      </View>
    );
  }
);
