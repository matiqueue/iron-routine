import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../context/ThemeContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface InteractiveBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  initialHeightPercent?: number; // 0.65 to 0.95 (default: 0.82)
  children: React.ReactNode;
  showHandle?: boolean;
  customHeader?: React.ReactNode;
}

export const InteractiveBottomSheet: React.FC<InteractiveBottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  initialHeightPercent = 0.85,
  children,
  showHandle = true,
  customHeader,
}) => {
  const { theme, isDark } = useAppTheme();

  // Mode: 0 = collapsed (default height percent), 1 = expanded (full 94% height)
  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const collapsedHeight = SCREEN_HEIGHT * Math.min(0.92, Math.max(0.5, initialHeightPercent));
  const expandedHeight = SCREEN_HEIGHT * 0.94;
  const currentHeight = isExpanded ? expandedHeight : collapsedHeight;

  // Animated values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeightAnim = useRef(new Animated.Value(collapsedHeight)).current;

  // Reset & open animation
  useEffect(() => {
    if (visible) {
      setIsExpanded(false);
      isExpandedRef.current = false;
      sheetHeightAnim.setValue(collapsedHeight);
      translateY.setValue(SCREEN_HEIGHT);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, collapsedHeight, sheetHeightAnim, translateY, backdropOpacity]);

  const handleDismiss = () => {
    try {
      Haptics.selectionAsync();
    } catch {}

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const toggleExpand = (expand: boolean) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setIsExpanded(expand);
    isExpandedRef.current = expand;
    Animated.spring(sheetHeightAnim, {
      toValue: expand ? expandedHeight : collapsedHeight,
      friction: 8,
      tension: 65,
      useNativeDriver: false,
    }).start();
  };

  // Pan responder attached to entire sheet container for fluid swipe-down dismissal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        // Intercept downward drag from anywhere in the sheet
        return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.1;
      },
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gestureState) => {
        // Dragging down: move sheet down
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
          const ratio = Math.max(0, 1 - gestureState.dy / (SCREEN_HEIGHT * 0.45));
          backdropOpacity.setValue(ratio);
        } else if (gestureState.dy < 0 && !isExpandedRef.current) {
          // Dragging up when not expanded: expand height smoothly
          const target = Math.min(expandedHeight, collapsedHeight + Math.abs(gestureState.dy) * 1.2);
          sheetHeightAnim.setValue(target);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If swiped down with enough distance or velocity -> DISMISS
        if (gestureState.dy > 50 || gestureState.vy > 0.35) {
          handleDismiss();
        } else if (gestureState.dy < -40 || gestureState.vy < -0.4) {
          // Swiped up -> EXPAND FULL
          toggleExpand(true);
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            useNativeDriver: true,
          }).start();
        } else {
          // Snap back to resting state
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              friction: 7,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.spring(sheetHeightAnim, {
              toValue: isExpandedRef.current ? expandedHeight : collapsedHeight,
              friction: 7,
              tension: 60,
              useNativeDriver: false,
            }),
          ]).start();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: 0,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        {/* Dim Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableWithoutFeedback onPress={handleDismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Sliding Sheet with gesture panHandlers on entire surface */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              height: sheetHeightAnim,
              transform: [{ translateY }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Grab Area: Handle bar + Header */}
          <View style={styles.grabArea}>
            {showHandle && (
              <View style={styles.handleWrapper}>
                <View style={[styles.handleBar, { backgroundColor: theme.borderDark }]} />
              </View>
            )}

            {customHeader ? (
              customHeader
            ) : title ? (
              <View style={[styles.defaultHeader, { borderBottomColor: theme.hairline }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.headerActions}>
                  {headerRight}

                  {/* Expand / Collapse Toggle Button */}
                  <TouchableOpacity
                    onPress={() => toggleExpand(!isExpanded)}
                    style={[styles.headerIconBtn, { backgroundColor: theme.bgSecondary }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isExpanded ? 'contract-outline' : 'expand-outline'}
                      size={16}
                      color={theme.text}
                    />
                  </TouchableOpacity>

                  {/* Close 'X' Button */}
                  <TouchableOpacity
                    onPress={handleDismiss}
                    style={[styles.headerIconBtn, { backgroundColor: theme.bgSecondary }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={17} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}
          </View>

          {/* Sheet Inner Content */}
          <View style={styles.contentContainer}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 24,
  },
  grabArea: {
    backgroundColor: 'transparent',
  },
  handleWrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
  },
  defaultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
});
