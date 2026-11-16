import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
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
  showCornerGlows?: boolean;
}

/**
 * Aesthetic minimalist backdrop composed of longer, widely spaced 45-degree
 * diagonal dashes with optional soft corner ambient glows.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ variant = 'diagonal', accentColor, secondaryColor, showCornerGlows = true }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    const strokePrimary = isDark
      ? 'rgba(255, 255, 255, 0.082)'
      : 'rgba(15, 23, 42, 0.078)';
    const strokeSecondary = isDark
      ? 'rgba(255, 255, 255, 0.044)'
      : 'rgba(15, 23, 42, 0.044)';

    // Much larger repeating tile so dashes are longer and much sparser
    const tile = variant === 'grid' ? 124 : 112;

    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={`bg_slashes_${uid}`}
              width={tile}
              height={tile}
              patternUnits="userSpaceOnUse"
            >
              {/* Long, widely spaced 45-degree diagonal dashes */}
              <Path
                d={`M ${tile * 0.12} ${tile * 0.44} L ${tile * 0.44} ${tile * 0.12}`}
                fill="none"
                stroke={strokePrimary}
                strokeWidth={1.45}
                strokeLinecap="round"
              />
              <Path
                d={`M ${tile * 0.58} ${tile * 0.88} L ${tile * 0.88} ${tile * 0.58}`}
                fill="none"
                stroke={strokeSecondary}
                strokeWidth={1.25}
                strokeLinecap="round"
              />
            </Pattern>

            {showCornerGlows && (
              <>
                <RadialGradient id={`bg_glow_top_${uid}`} cx="86%" cy="4%" r="62%">
                  <Stop
                    offset="0%"
                    stopColor={primaryGlow}
                    stopOpacity={isDark ? 0.17 : 0.13}
                  />
                  <Stop
                    offset="54%"
                    stopColor={primaryGlow}
                    stopOpacity={isDark ? 0.05 : 0.04}
                  />
                  <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>

                <RadialGradient id={`bg_glow_btm_${uid}`} cx="12%" cy="94%" r="58%">
                  <Stop
                    offset="0%"
                    stopColor={bottomGlow}
                    stopOpacity={isDark ? 0.125 : 0.09}
                  />
                  <Stop
                    offset="55%"
                    stopColor={bottomGlow}
                    stopOpacity={isDark ? 0.038 : 0.028}
                  />
                  <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>
              </>
            )}
          </Defs>

          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_slashes_${uid})`} />
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
