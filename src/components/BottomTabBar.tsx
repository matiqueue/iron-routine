import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import { triggerSelectionHaptic } from '../services/haptics';

export type AppTabKey = 'today' | 'plan' | 'progress' | 'settings';

interface BottomTabBarProps {
  activeTab: AppTabKey;
  onSelectTab: (tab: AppTabKey) => void;
}

const TABS: {
  key: AppTabKey;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'today', label: 'Trening', iconActive: 'barbell', iconInactive: 'barbell-outline' },
  { key: 'plan', label: 'Plan', iconActive: 'calendar', iconInactive: 'calendar-outline' },
  { key: 'progress', label: 'Osiągi', iconActive: 'analytics', iconInactive: 'analytics-outline' },
  { key: 'settings', label: 'Ustawienia', iconActive: 'settings', iconInactive: 'settings-outline' },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onSelectTab }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 8);

  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingBottom: bottomPad,
          height: 54 + bottomPad,
        },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.navItem}
            activeOpacity={0.7}
            onPress={() => {
              triggerSelectionHaptic();
              onSelectTab(tab.key);
            }}
          >
            <Ionicons
              name={isActive ? tab.iconActive : tab.iconInactive}
              size={22}
              color={isActive ? theme.text : theme.textMuted}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isActive ? theme.text : theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
