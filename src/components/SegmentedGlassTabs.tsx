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
        tension: 92,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(thumbScale, {
          toValue: 0.95,
          duration: 70,
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
          const slotW = totalW > 10 ? (totalW - 8) / curItems.length : 72;
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
              tension: 92,
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
  const slotWidth = dockWidth > 10 ? (dockWidth - 8) / count : 0;
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
        styles.dock,
        {
          backgroundColor: isDark
            ? 'rgba(20, 20, 25, 0.88)'
            : 'rgba(241, 243, 246, 0.94)',
          borderColor: isDark
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(15, 23, 42, 0.09)',
        },
      ]}
    >
      {/* Floating Glass Active Capsule */}
      {slotWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeCapsule,
            {
              width: slotWidth,
              backgroundColor: isDark ? 'rgba(38, 39, 46, 0.96)' : '#FFFFFF',
              borderColor: isDark ? `${activeAccent}55` : `${activeAccent}45`,
              shadowColor: isDark ? activeAccent : '#0F172A',
              shadowOpacity: isDark ? 0.24 : 0.09,
              transform: [{ translateX }, { scale: thumbScale }],
            },
          ]}
        >
          <View
            style={[
              styles.capsuleTopHighlight,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(255,255,255,0.9)',
              },
            ]}
          />
          <View style={[styles.capsuleAccentBar, { backgroundColor: activeAccent }]} />
        </Animated.View>
      )}

      {items.map((item, idx) => {
        const active = activeKey === item.key;
        const accent = item.accent || '#10B981';
        const iconScale =
          items.length > 1
            ? thumbAnim.interpolate({
                inputRange: [idx - 1, idx, idx + 1],
                outputRange: [1, 1.14, 1],
                extrapolate: 'clamp',
              })
            : 1;

        return (
          <TouchableOpacity
            key={item.key}
            style={styles.tabBtn}
            onPress={() => {
              if (activeKey !== item.key) {
                triggerSelectionHaptic();
                onChange(item.key);
              }
            }}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.iconPill,
                {
                  backgroundColor: active
                    ? `${accent}20`
                    : 'transparent',
                  transform: [{ scale: iconScale }],
                },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={active ? accent : theme.textMuted}
              />
              {Boolean(item.badge && item.badge > 0) && (
                <View style={styles.badgeDot}>
                  <Text style={styles.badgeText}>
                    {item.badge! > 9 ? '9+' : item.badge}
                  </Text>
                </View>
              )}
            </Animated.View>

            <Text
              style={[
                styles.tabLabel,
                {
                  color: active ? theme.text : theme.textSecondary,
                  fontWeight: active ? '800' : '600',
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  activeCapsule: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  capsuleTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: StyleSheet.hairlineWidth,
  },
  capsuleAccentBar: {
    position: 'absolute',
    bottom: 0,
    left: '26%',
    right: '26%',
    height: 2.5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tabBtn: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 2,
  },
  iconPill: {
    position: 'relative',
    width: 26,
    height: 22,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    letterSpacing: -0.15,
    paddingHorizontal: 2,
  },
  badgeDot: {
    position: 'absolute',
    top: -3,
    right: -7,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    paddingHorizontal: 3.5,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#04120B',
    fontSize: 8.5,
    fontWeight: '900',
  },
});
