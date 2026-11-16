import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { TranslationKey } from '../i18n/translations';
import { triggerSelectionHaptic } from '../services/haptics';

export type AppTabKey = 'today' | 'plan' | 'progress' | 'friends' | 'settings';

interface BottomTabBarProps {
  activeTab: AppTabKey;
  onSelectTab: (tab: AppTabKey) => void;
  friendsBadgeCount?: number;
}

const TABS: {
  key: AppTabKey;
  labelKey: TranslationKey;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'today', labelKey: 'tabToday', iconActive: 'barbell', iconInactive: 'barbell-outline' },
  { key: 'plan', labelKey: 'tabPlan', iconActive: 'calendar', iconInactive: 'calendar-outline' },
  { key: 'progress', labelKey: 'tabProgress', iconActive: 'analytics', iconInactive: 'analytics-outline' },
  { key: 'friends', labelKey: 'tabFriends', iconActive: 'people', iconInactive: 'people-outline' },
  { key: 'settings', labelKey: 'tabSettings', iconActive: 'settings', iconInactive: 'settings-outline' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onSelectTab,
  friendsBadgeCount = 0,
}) => {
  const { theme, isDark } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom - 4 : 10, Platform.OS === 'ios' ? 14 : 10);

  const [barWidth, setBarWidth] = useState(0);
  const barWidthRef = useRef(0);
  const activeTabRef = useRef<AppTabKey>(activeTab);
  const dragStartIdxRef = useRef(0);
  const isDraggingRef = useRef(false);
  const onSelectTabRef = useRef(onSelectTab);
  onSelectTabRef.current = onSelectTab;

  const activeIdx = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
  const thumbAnim = useRef(new Animated.Value(activeIdx)).current;
  const thumbScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (isDraggingRef.current) return;
    const idx = Math.max(0, TABS.findIndex((t) => t.key === activeTab));
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
          duration: 60,
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
  }, [activeTab, thumbAnim, thumbScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15,
        onMoveShouldSetPanResponderCapture: (_, gestureState) =>
          Math.abs(gestureState.dx) > 7 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.15,
        onPanResponderGrant: () => {
          isDraggingRef.current = true;
          dragStartIdxRef.current = Math.max(
            0,
            TABS.findIndex((t) => t.key === activeTabRef.current)
          );
          Animated.spring(thumbScale, {
            toValue: 0.96,
            friction: 7,
            tension: 120,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (_, gestureState) => {
          const totalW = barWidthRef.current;
          const slotW = totalW > 10 ? (totalW - 10) / TABS.length : 72;
          const rawIdx = dragStartIdxRef.current + gestureState.dx / slotW;
          const clampedIdx = Math.max(0, Math.min(TABS.length - 1, rawIdx));
          thumbAnim.setValue(clampedIdx);

          const nearestIdx = Math.round(clampedIdx);
          const nextTab = TABS[nearestIdx]?.key;
          if (nextTab && nextTab !== activeTabRef.current) {
            activeTabRef.current = nextTab;
            triggerSelectionHaptic();
            React.startTransition(() => {
              onSelectTabRef.current(nextTab);
            });
          }
        },
        onPanResponderRelease: () => {
          isDraggingRef.current = false;
          const finalIdx = Math.max(
            0,
            TABS.findIndex((t) => t.key === activeTabRef.current)
          );
          Animated.parallel([
            Animated.spring(thumbAnim, {
              toValue: finalIdx,
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
        onPanResponderTerminate: () => {
          isDraggingRef.current = false;
          const finalIdx = Math.max(
            0,
            TABS.findIndex((t) => t.key === activeTabRef.current)
          );
          Animated.parallel([
            Animated.spring(thumbAnim, {
              toValue: finalIdx,
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

  const slotWidth = barWidth > 10 ? (barWidth - 10) / TABS.length : 0;
  const thumbTranslateX = thumbAnim.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, slotWidth, slotWidth * 2, slotWidth * 3, slotWidth * 4],
  });

  return (
    <View
      style={[
        styles.outerPositioner,
        {
          bottom: bottomOffset,
          pointerEvents: 'box-none',
        },
      ]}
    >
      <View
        {...panResponder.panHandlers}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          barWidthRef.current = w;
          setBarWidth(w);
        }}
        style={[
          styles.glassDock,
          {
            backgroundColor: isDark
              ? 'rgba(16, 16, 20, 0.94)'
              : 'rgba(252, 252, 254, 0.94)',
            borderColor: isDark
              ? 'rgba(255, 255, 255, 0.14)'
              : 'rgba(15, 23, 42, 0.09)',
            shadowOpacity: isDark ? 0.52 : 0.14,
          },
        ]}
      >
        {/* Top Specular Glass Reflection Line */}
        <View
          style={[
            styles.specularTopLine,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.18)'
                : 'rgba(255, 255, 255, 0.95)',
              pointerEvents: 'none',
            },
          ]}
        />

        {/* Animated Liquid Glass Active Pill */}
        {slotWidth > 0 && (
          <Animated.View
            style={[
              styles.activeGlassPill,
              {
                width: slotWidth,
                pointerEvents: 'none',
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.11)'
                  : 'rgba(24, 24, 27, 0.08)',
                borderColor: isDark
                  ? 'rgba(255, 255, 255, 0.16)'
                  : 'rgba(24, 24, 27, 0.08)',
                transform: [
                  { translateX: thumbTranslateX },
                  { scale: thumbScale },
                ],
              },
            ]}
          />
        )}

        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.key;
          const iconScale = thumbAnim.interpolate({
            inputRange: [idx - 1, idx, idx + 1],
            outputRange: [1, 1.14, 1],
            extrapolate: 'clamp',
          });
          const iconLift = thumbAnim.interpolate({
            inputRange: [idx - 1, idx, idx + 1],
            outputRange: [0, -1.5, 0],
            extrapolate: 'clamp',
          });
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.navItem}
              activeOpacity={0.78}
              onPress={() => {
                if (activeTab !== tab.key) {
                  triggerSelectionHaptic();
                  onSelectTab(tab.key);
                }
              }}
            >
              <Animated.View
                style={{
                  position: 'relative',
                  transform: [{ scale: iconScale }, { translateY: iconLift }],
                }}
              >
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={19}
                  color={isActive ? theme.text : theme.textMuted}
                />
                {tab.key === 'friends' && friendsBadgeCount > 0 && (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                      {friendsBadgeCount > 9 ? '9+' : friendsBadgeCount}
                    </Text>
                  </View>
                )}
              </Animated.View>
              <Text
                style={[
                  styles.navLabel,
                  {
                    color: isActive ? theme.text : theme.textMuted,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
              >
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerPositioner: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
  },
  glassDock: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    borderRadius: 31,
    paddingHorizontal: 5,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  specularTopLine: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: StyleSheet.hairlineWidth,
  },
  activeGlassPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 2,
  },
  navLabel: {
    fontSize: 10,
    letterSpacing: -0.15,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -8,
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
