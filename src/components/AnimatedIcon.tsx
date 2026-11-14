import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type AnimatedIconPreset =
  | 'flame'
  | 'barbell'
  | 'bell'
  | 'trophy'
  | 'heart'
  | 'footsteps'
  | 'moon';

interface AnimatedIconProps {
  name: keyof typeof Ionicons.glyphMap;
  preset: AnimatedIconPreset;
  size?: number;
  color: string;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable lightweight micro-animated icon using native driver transforms.
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

  useEffect(() => {
    anim.stopAnimation();
    anim.setValue(0);
    if (!active) return;

    let duration = 1800;
    if (preset === 'bell') duration = 900;
    else if (preset === 'flame') duration = 1400;
    else if (preset === 'heart') duration = 1250;
    else if (preset === 'barbell') duration = 2200;
    else if (preset === 'footsteps') duration = 1700;
    else if (preset === 'moon') duration = 2600;
    else if (preset === 'trophy') duration = 2100;

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
    return () => {
      loop.stop();
    };
  }, [active, preset, anim]);

  const transform: any[] = [];

  if (preset === 'flame') {
    transform.push(
      {
        scale: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 1.18, 1.04],
        }),
      },
      {
        rotate: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: ['-4deg', '5deg', '-2deg'],
        }),
      },
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -1.6, 0],
        }),
      }
    );
  } else if (preset === 'barbell') {
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
        inputRange: [0, 0.3, 0.55, 1],
        outputRange: [1, 1.2, 1.06, 1],
      }),
    });
  } else if (preset === 'footsteps') {
    transform.push(
      {
        translateY: anim.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, -2, 0],
        }),
      },
      {
        rotate: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-3deg', '3deg'],
        }),
      }
    );
  } else if (preset === 'moon') {
    transform.push(
      {
        rotate: anim.interpolate({
          inputRange: [0, 1],
          outputRange: ['-6deg', '6deg'],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.97, 1.07],
        }),
      }
    );
  }

  return (
    <Animated.View style={[{ transform }, style]}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};
