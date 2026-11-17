import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

export type AnimatedIconPreset =
  | 'flame'
  | 'barbell'
  | 'bell'
  | 'trophy'
  | 'heart'
  | 'footsteps'
  | 'moon'
  | 'pulse';

interface AnimatedIconProps {
  name: keyof typeof Ionicons.glyphMap;
  preset: AnimatedIconPreset;
  size?: number;
  color: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Multi-layered bespoke animated streak flame with inner glowing core and rising embers.
 */
const AnimatedFlameEmblem: React.FC<{
  size: number;
  active: boolean;
  color: string;
  anim: Animated.Value;
  sparkAnim: Animated.Value;
}> = ({ size, active, color, anim, sparkAnim }) => {
  const uid = useId().replace(/:/g, '_');
  const outerId = `fl_o_${uid}`;
  const innerId = `fl_i_${uid}`;
  const haloId = `fl_h_${uid}`;

  const swayTransform = active
    ? [
        {
          scale: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.97, 1.11, 0.99],
          }),
        },
        {
          rotate: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: ['-3.5deg', '4.2deg', '-2deg'],
          }),
        },
        {
          translateY: anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.6, -1.6, 0.4],
          }),
        },
      ]
    : [];

  const innerCoreScale = active
    ? sparkAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.92, 1.1, 0.95],
      })
    : 1;

  const emberY = sparkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, -6],
  });
  const emberOpacity = sparkAnim.interpolate({
    inputRange: [0, 0.3, 0.85, 1],
    outputRange: [0, 0.95, 0.65, 0],
  });

  const outerTop = active ? '#FDE047' : color;
  const outerMid = active ? '#F97316' : color;
  const outerBot = active ? '#DC2626' : color;

  return (
    <View style={[styles.flameBox, { width: size + 6, height: size + 6 }]}>
      {active && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              pointerEvents: 'none',
              opacity: anim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0.45, 0.92, 0.5],
              }),
            },
          ]}
        >
          <Svg width={size + 6} height={size + 6} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={haloId} cx="50%" cy="58%" r="48%">
                <Stop offset="0%" stopColor="#F59E0B" stopOpacity={0.62} />
                <Stop offset="65%" stopColor="#EF4444" stopOpacity={0.2} />
                <Stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="56" r="46" fill={`url(#${haloId})`} />
          </Svg>
        </Animated.View>
      )}

      {/* Primary flame tongues */}
      <Animated.View style={{ transform: swayTransform }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={outerId} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0%" stopColor={outerTop} stopOpacity={active ? 1 : 0.7} />
              <Stop offset="52%" stopColor={outerMid} stopOpacity={active ? 0.98 : 0.65} />
              <Stop offset="100%" stopColor={outerBot} stopOpacity={active ? 1 : 0.6} />
            </LinearGradient>
            <LinearGradient id={innerId} x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={active ? 0.96 : 0.3} />
              <Stop offset="55%" stopColor="#FEF08A" stopOpacity={active ? 0.92 : 0.2} />
              <Stop offset="100%" stopColor="#F59E0B" stopOpacity={active ? 0.85 : 0.15} />
            </LinearGradient>
          </Defs>

          <Path
            d="M52 8 C54 24 72 32 76 50 C80 42 82 35 80 28 C90 40 90 61 81 74 C73 86 62 92 50 92 C35 92 22 83 18 68 C13 51 22 36 33 27 C31 36 34 44 40 48 C37 33 43 18 52 8 Z"
            fill={`url(#${outerId})`}
          />
          <Path
            d="M51 36 C56 46 66 53 66 66 C66 77 58 85 50 85 C41 85 34 78 34 67 C34 55 44 47 51 36 Z"
            fill={`url(#${innerId})`}
          />
        </Svg>
      </Animated.View>

      {/* Rising spark embers */}
      {active && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              pointerEvents: 'none',
              opacity: emberOpacity,
              transform: [{ translateY: emberY }, { scale: innerCoreScale }],
            },
          ]}
        >
          <Svg width={size + 6} height={size + 6} viewBox="0 0 100 100">
            <Circle cx="30" cy="24" r="3.4" fill="#FDE047" />
            <Circle cx="72" cy="20" r="2.6" fill="#FB923C" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
};

/**
 * Reusable micro-animated icon using native driver transforms, with bespoke
 * animated flame artwork for the 'flame' preset.
 */
export const AnimatedIcon: React.FC<AnimatedIconProps> = ({
  name,
  preset,
  size = 19,
  color,
  active = true,
  style,
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  const sparkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.stopAnimation();
    sparkAnim.stopAnimation();
    anim.setValue(0);
    sparkAnim.setValue(0);
    if (!active) return;

    let duration = 1800;
    if (preset === 'bell') duration = 900;
    else if (preset === 'flame') duration = 1150;
    else if (preset === 'heart') duration = 1250;
    else if (preset === 'barbell') duration = 2200;
    else if (preset === 'footsteps') duration = 1700;
    else if (preset === 'moon') duration = 2600;
    else if (preset === 'trophy') duration = 2100;
    else if (preset === 'pulse') duration = 1850;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: Math.round(duration * 0.45),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: Math.round(duration * 0.55),
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    let sparkLoop: Animated.CompositeAnimation | null = null;
    if (preset === 'flame') {
      sparkLoop = Animated.loop(
        Animated.timing(sparkAnim, {
          toValue: 1,
          duration: 1650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      );
      sparkLoop.start();
    }

    return () => {
      loop.stop();
      sparkLoop?.stop();
    };
  }, [active, preset, anim, sparkAnim]);

  if (preset === 'flame') {
    return (
      <View style={style}>
        <AnimatedFlameEmblem
          size={size}
          active={active}
          color={color}
          anim={anim}
          sparkAnim={sparkAnim}
        />
      </View>
    );
  }

  const transform: any[] = [];

  if (preset === 'barbell') {
    transform.push(
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.1],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -1.5],
        }),
      }
    );
  } else if (preset === 'bell') {
    transform.push(
      {
        rotate: anim.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: ['0deg', '-14deg', '14deg', '-8deg', '0deg'],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.14, 1],
        }),
      }
    );
  } else if (preset === 'trophy') {
    transform.push(
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.15, 1],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -2, 0],
        }),
      }
    );
  } else if (preset === 'heart') {
    transform.push({
      scale: anim.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [1, 1.18, 1.02, 1.14, 1],
      }),
    });
  } else if (preset === 'footsteps') {
    transform.push(
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -1.8, 0],
        }),
      },
      {
        rotate: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['-6deg', '6deg', '-6deg'],
        }),
      }
    );
  } else if (preset === 'moon') {
    transform.push(
      {
        rotate: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['-5deg', '5deg', '-5deg'],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.07, 1],
        }),
      }
    );
  } else if (preset === 'pulse') {
    transform.push({
      scale: anim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [1, 1.13, 1],
      }),
    });
  }

  return (
    <Animated.View style={[style, active ? { transform } : undefined]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flameBox: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
});
