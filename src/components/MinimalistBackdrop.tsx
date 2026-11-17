import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
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
 * Topographic elevation contour backdrop with visible dark-mode depth relief
 * and optional corner ambient glows.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ accentColor, secondaryColor, showCornerGlows = true }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    // Tuned so contours are clearly perceptible on OLED black AND crisp on light mode
    const ridgeMain = isDark ? 'rgba(255, 255, 255, 0.13)' : 'rgba(15, 23, 42, 0.11)';
    const ridgeMid = isDark ? 'rgba(255, 255, 255, 0.085)' : 'rgba(15, 23, 42, 0.075)';
    const ridgeFine = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.045)';

    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern
              id={`bg_topo_relief_${uid}`}
              width={240}
              height={240}
              patternUnits="userSpaceOnUse"
            >
              {/* Smooth continuous organic elevation contour lines */}
              <Path
                d="M -20 42 C 40 12, 95 72, 160 40 C 200 20, 228 28, 260 42"
                fill="none"
                stroke={ridgeMain}
                strokeWidth={1.3}
              />
              <Path
                d="M -20 76 C 35 46, 102 104, 165 72 C 205 52, 230 62, 260 76"
                fill="none"
                stroke={ridgeMid}
                strokeWidth={1.05}
              />
              <Path
                d="M -20 118 C 48 88, 108 144, 174 114 C 212 96, 234 106, 260 118"
                fill="none"
                stroke={ridgeFine}
                strokeWidth={0.9}
              />
              <Path
                d="M -20 162 C 36 190, 96 136, 162 164 C 202 182, 230 174, 260 162"
                fill="none"
                stroke={ridgeMain}
                strokeWidth={1.25}
              />
              <Path
                d="M -20 202 C 46 226, 106 178, 172 204 C 210 220, 234 212, 260 202"
                fill="none"
                stroke={ridgeMid}
                strokeWidth={1}
              />
              {/* Isolated peak contour rings */}
              <Path
                d="M 52 106 C 68 86, 106 88, 114 110 C 122 132, 88 148, 66 138 C 48 130, 40 120, 52 106 Z"
                fill="none"
                stroke={ridgeMid}
                strokeWidth={1}
              />
              <Path
                d="M 168 186 C 182 170, 214 172, 220 190 C 226 208, 198 220, 178 212 C 164 206, 158 198, 168 186 Z"
                fill="none"
                stroke={ridgeFine}
                strokeWidth={0.95}
              />
            </Pattern>

            <LinearGradient id={`bg_vignette_${uid}`} x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0%"
                stopColor={isDark ? '#18181F' : '#E2E8F0'}
                stopOpacity={isDark ? 0.24 : 0.18}
              />
              <Stop offset="48%" stopColor="#000000" stopOpacity={0} />
              <Stop
                offset="100%"
                stopColor={isDark ? '#09090D' : '#CBD5E1'}
                stopOpacity={isDark ? 0.22 : 0.14}
              />
            </LinearGradient>

            {showCornerGlows && (
              <>
                <RadialGradient id={`bg_glow_top_${uid}`} cx="86%" cy="5%" r="64%">
                  <Stop
                    offset="0%"
                    stopColor={primaryGlow}
                    stopOpacity={isDark ? 0.22 : 0.18}
                  />
                  <Stop
                    offset="54%"
                    stopColor={primaryGlow}
                    stopOpacity={isDark ? 0.065 : 0.05}
                  />
                  <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>

                <RadialGradient id={`bg_glow_btm_${uid}`} cx="12%" cy="94%" r="60%">
                  <Stop
                    offset="0%"
                    stopColor={bottomGlow}
                    stopOpacity={isDark ? 0.16 : 0.12}
                  />
                  <Stop
                    offset="55%"
                    stopColor={bottomGlow}
                    stopOpacity={isDark ? 0.05 : 0.035}
                  />
                  <Stop offset="100%" stopColor={isDark ? '#000000' : '#FFFFFF'} stopOpacity={0} />
                </RadialGradient>
              </>
            )}
          </Defs>

          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_vignette_${uid})`} />
          <Rect x={0} y={0} width="100%" height="100%" fill={`url(#bg_topo_relief_${uid})`} />
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
