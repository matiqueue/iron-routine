import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { triggerSelectionHaptic } from '../services/haptics';

export interface SegmentedGlassTabItem<T extends string> {
  key: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  badge?: number;
}

interface SegmentedGlassTabsProps<T extends string> {
  items: ReadonlyArray<SegmentedGlassTabItem<T>>;
  activeKey: T;
  onChange: (key: T) => void;
}

/**
 * Unified, seamless pill track with a single continuous colored sliding capsule.
 * Zero nested card-inside-card boxes: clean borderless segments + active accent pill.
 */
export function SegmentedGlassTabs<T extends string>({
  items,
  activeKey,
  onChange,
}: SegmentedGlassTabsProps<T>) {
  const { theme, isDark } = useAppTheme();
  const [dockWidth, setDockWidth] = useState(0);
  const dockWidthRef = useRef(0);
  const activeKeyRef = useRef<T>(activeKey);
  const dragStartIdxRef = useRef(0);

  const activeIdx = Math.max(0, items.findIndex((i) => i.key === activeKey));
  const thumbAnim = useRef(new Animated.Value(activeIdx)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    activeKeyRef.current = activeKey;
    const idx = Math.max(0, items.findIndex((i) => i.key === activeKey));
    Animated.parallel([
      Animated.spring(thumbAnim, {
        toValue: idx,
        friction: 7,
        tension: 96,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(thumbScale, {
          toValue: 0.96,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.spring(thumbScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeKey, items, thumbAnim, thumbScale]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy),
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => {
          dragStartIdxRef.current = Math.max(
            0,
            itemsRef.current.findIndex((i) => i.key === activeKeyRef.current)
          );
          Animated.spring(thumbScale, {
            toValue: 0.96,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, g) => {
          const curItems = itemsRef.current;
          const totalW = dockWidthRef.current;
          const slotW = totalW > 10 ? (totalW - 6) / curItems.length : 72;
          const rawIdx = dragStartIdxRef.current + g.dx / slotW;
          const clamped = Math.max(0, Math.min(curItems.length - 1, rawIdx));
          thumbAnim.setValue(clamped);
          const target = curItems[Math.round(clamped)]?.key;
          if (target && target !== activeKeyRef.current) {
            activeKeyRef.current = target;
            triggerSelectionHaptic();
            onChangeRef.current(target);
          }
        },
        onPanResponderRelease: () => {
          const idx = Math.max(
            0,
            itemsRef.current.findIndex((i) => i.key === activeKeyRef.current)
          );
          Animated.parallel([
            Animated.spring(thumbAnim, {
              toValue: idx,
              friction: 7,
              tension: 96,
              useNativeDriver: true,
            }),
            Animated.spring(thumbScale, {
              toValue: 1,
              friction: 6,
              tension: 120,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [thumbAnim, thumbScale]
  );

  const count = Math.max(1, items.length);
  const slotWidth = dockWidth > 8 ? (dockWidth - 6) / count : 0;
  const inputRange = items.map((_, i) => i);
  const outputRange = items.map((_, i) => i * slotWidth);
  const translateX =
    inputRange.length > 1
      ? thumbAnim.interpolate({ inputRange, outputRange })
      : 0;

  const activeItem = items[activeIdx] || items[0];
  const activeAccent = activeItem?.accent || '#10B981';

  return (
    <View
      {...panResponder.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        dockWidthRef.current = w;
        setDockWidth(w);
      }}
      style={[
        styles.track,
        {
          backgroundColor: isDark
            ? 'rgba(255, 255, 255, 0.065)'
            : 'rgba(15, 23, 42, 0.06)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.11)'
            : 'rgba(15, 23, 42, 0.08)',
        },
      ]}
    >
      {/* Single Seamless Colored Gliding Pill */}
      {slotWidth > 0 && (
        <Animated.View
          style={[
            styles.activePill,
            {
              width: slotWidth,
              backgroundColor: activeAccent,
              shadowColor: activeAccent,
              pointerEvents: 'none',
              transform: [{ translateX }, { scale: thumbScale }],
            },
          ]}
        />
      )}

      {items.map((item) => {
        const active = activeKey === item.key;
        const activeTextColor = '#071014';

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.segmentBtn}
            onPress={() => {
              if (activeKey !== item.key) {
                triggerSelectionHaptic();
                onChange(item.key);
              }
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name={item.icon}
              size={13.5}
              color={active ? activeTextColor : theme.textSecondary}
            />
            <Text
              style={[
                styles.segmentLabel,
                {
                  color: active ? activeTextColor : theme.textSecondary,
                  fontWeight: active ? '900' : '700',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {item.label}
            </Text>
            {Boolean(item.badge && item.badge > 0) && (
              <View
                style={[
                  styles.badgeDot,
                  {
                    backgroundColor: active ? '#071014' : item.accent || '#10B981',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: active ? '#FFFFFF' : '#071014' },
                  ]}
                >
                  {item.badge! > 9 ? '9+' : item.badge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    overflow: 'hidden',
  },
  activePill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 19,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  segmentBtn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    zIndex: 2,
  },
  segmentLabel: {
    fontSize: 11.5,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  badgeDot: {
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
});
