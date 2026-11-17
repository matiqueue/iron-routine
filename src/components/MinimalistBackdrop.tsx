import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, RadialGradient, Rect, Stop, Defs } from 'react-native-svg';
import { useAppTheme } from '../context/ThemeContext';

interface MinimalistBackdropProps {
  variant?: 'dots' | 'grid' | 'contours' | 'diagonal';
  accentColor?: string;
  secondaryColor?: string;
  showCornerGlows?: boolean;
}

/**
 * Single-pass lightweight topographic elevation backdrop.
 * Uses direct vector paths on a fixed viewBox (no expensive <Pattern> tiling)
 * so switching tabs stays instantaneous on iOS CoreGraphics.
 */
export const MinimalistBackdrop: React.FC<MinimalistBackdropProps> = React.memo(
  ({ accentColor, secondaryColor, showCornerGlows = true }) => {
    const { isDark } = useAppTheme();
    const uid = useId().replace(/:/g, '_');
    const primaryGlow = accentColor || (isDark ? '#38BDF8' : '#0EA5E9');
    const bottomGlow = secondaryColor || '#EC4899';

    const ridgeMain = isDark ? 'rgba(255, 255, 255, 0.095)' : 'rgba(15, 23, 42, 0.085)';
    const ridgeMid = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.055)';
    const ridgeFine = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.035)';

    return (
      <View
        renderToHardwareTextureAndroid
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 860"
          preserveAspectRatio="xMidYMid slice"
          style={StyleSheet.absoluteFill}
        >
          {showCornerGlows && (
            <Defs>
              <RadialGradient id={`bg_glow_top_${uid}`} cx="86%" cy="5%" r="58%">
                <Stop
                  offset="0%"
                  stopColor={primaryGlow}
                  stopOpacity={isDark ? 0.2 : 0.16}
                />
                <Stop
                  offset="54%"
                  stopColor={primaryGlow}
                  stopOpacity={isDark ? 0.055 : 0.04}
                />
                <Stop offset="100%" stopColor={primaryGlow} stopOpacity={0} />
              </RadialGradient>

              <RadialGradient id={`bg_glow_btm_${uid}`} cx="12%" cy="94%" r="54%">
                <Stop
                  offset="0%"
                  stopColor={bottomGlow}
                  stopOpacity={isDark ? 0.14 : 0.1}
                />
                <Stop
                  offset="55%"
                  stopColor={bottomGlow}
                  stopOpacity={isDark ? 0.04 : 0.03}
                />
                <Stop offset="100%" stopColor={bottomGlow} stopOpacity={0} />
              </RadialGradient>
            </Defs>
          )}

          {showCornerGlows && (
            <>
              <Rect x={0} y={0} width={400} height={860} fill={`url(#bg_glow_top_${uid})`} />
              <Rect x={0} y={0} width={400} height={860} fill={`url(#bg_glow_btm_${uid})`} />
            </>
          )}

          {/* Crisp non-tiled elevation curves */}
          <Path
            d="M -40 120 C 80 55, 195 175, 315 110 C 370 80, 415 95, 445 120"
            fill="none"
            stroke={ridgeMain}
            strokeWidth={1.2}
          />
          <Path
            d="M -40 168 C 72 104, 204 218, 322 156 C 376 128, 416 142, 445 168"
            fill="none"
            stroke={ridgeMid}
            strokeWidth={1}
          />
          <Path
            d="M -40 330 C 90 270, 210 380, 335 320 C 385 296, 420 308, 445 330"
            fill="none"
            stroke={ridgeFine}
            strokeWidth={0.9}
          />
          <Path
            d="M -40 495 C 78 545, 190 440, 320 498 C 378 524, 418 510, 445 495"
            fill="none"
            stroke={ridgeMain}
            strokeWidth={1.15}
          />
          <Path
            d="M -40 655 C 94 705, 206 608, 332 660 C 382 680, 418 672, 445 655"
            fill="none"
            stroke={ridgeMid}
            strokeWidth={1}
          />
          <Path
            d="M 55 245 C 88 205, 165 210, 180 255 C 195 300, 128 332, 84 312 C 48 296, 32 274, 55 245 Z"
            fill="none"
            stroke={ridgeMid}
            strokeWidth={1}
          />
          <Path
            d="M 248 560 C 276 528, 342 532, 354 570 C 366 608, 310 634, 272 616 C 242 602, 230 584, 248 560 Z"
            fill="none"
            stroke={ridgeFine}
            strokeWidth={0.95}
          />
        </Svg>
      </View>
    );
  }
);
