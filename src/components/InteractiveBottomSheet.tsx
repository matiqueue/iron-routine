import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { triggerImpactHaptic, triggerSelectionHaptic } from '../services/haptics';

interface InteractiveBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  initialHeightPercent?: number; // 0.5 to 0.92 (default: 0.85)
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
  const { height: windowHeight } = useWindowDimensions();

  const [isExpanded, setIsExpanded] = useState(false);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  const collapsedHeight = Math.round(
    windowHeight * Math.min(0.92, Math.max(0.5, initialHeightPercent))
  );
  const expandedHeight = Math.round(windowHeight * 0.94);

  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const collapsedHeightRef = useRef(collapsedHeight);
  collapsedHeightRef.current = collapsedHeight;
  const expandedHeightRef = useRef(expandedHeight);
  expandedHeightRef.current = expandedHeight;

  // Native driver ONLY owns translateY & backdropOpacity; JS driver ONLY owns height on separate View.
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeightAnim = useRef(new Animated.Value(collapsedHeight)).current;

  useEffect(() => {
    if (visible) {
      setIsExpanded(false);
      isExpandedRef.current = false;
      sheetHeightAnim.stopAnimation();
      sheetHeightAnim.setValue(collapsedHeight);
      translateY.setValue(windowHeight);
      backdropOpacity.setValue(0);

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
  }, [visible]);

  const handleDismiss = () => {
    triggerSelectionHaptic();

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: windowHeightRef.current,
        duration: 210,
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
    triggerImpactHaptic('light');
    setIsExpanded(expand);
    isExpandedRef.current = expand;
    sheetHeightAnim.stopAnimation();
    Animated.spring(sheetHeightAnim, {
      toValue: expand ? expandedHeightRef.current : collapsedHeightRef.current,
      friction: 9,
      tension: 70,
      useNativeDriver: false,
    }).start();
  };

  const dismissRef = useRef(handleDismiss);
  dismissRef.current = handleDismiss;
  const toggleExpandRef = useRef(toggleExpand);
  toggleExpandRef.current = toggleExpand;

  // PanResponder attached ONLY to grabArea so child ScrollViews & drag handles work freely
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dy) > 6 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
          );
        },
        onPanResponderGrant: () => {
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
            const ratio = Math.max(0, 1 - gestureState.dy / (windowHeightRef.current * 0.45));
            backdropOpacity.setValue(ratio);
          } else if (gestureState.dy < 0 && !isExpandedRef.current) {
            const target = Math.min(
              expandedHeightRef.current,
              collapsedHeightRef.current + Math.abs(gestureState.dy) * 1.15
            );
            sheetHeightAnim.setValue(target);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 55 || gestureState.vy > 0.4) {
            dismissRef.current();
          } else if (gestureState.dy < -40 || gestureState.vy < -0.4) {
            toggleExpandRef.current(true);
            Animated.spring(translateY, {
              toValue: 0,
              friction: 8,
              useNativeDriver: true,
            }).start();
          } else {
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                tension: 65,
                useNativeDriver: true,
              }),
              Animated.timing(backdropOpacity, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.spring(sheetHeightAnim, {
                toValue: isExpandedRef.current
                  ? expandedHeightRef.current
                  : collapsedHeightRef.current,
                friction: 8,
                tension: 65,
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
              friction: 8,
              tension: 65,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [translateY, backdropOpacity, sheetHeightAnim]
  );

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

        {/* Outer Native-Driven Sliding Wrapper */}
        <Animated.View
          style={[
            styles.sheetOuter,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Inner JS-Driven Height Sheet */}
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                height: sheetHeightAnim,
              },
            ]}
          >
            {/* Grab Area ONLY handles swipe-to-dismiss / swipe-to-expand */}
            <View style={styles.grabArea} {...panResponder.panHandlers}>
              {showHandle && (
                <View style={styles.handleWrapper}>
                  <View style={[styles.handleBar, { backgroundColor: theme.borderDark }]} />
                </View>
              )}

              {customHeader ? (
                customHeader
              ) : title ? (
                <View style={[styles.defaultHeader, { borderBottomColor: theme.hairline }]}>
                  <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
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
                      accessibilityLabel={isExpanded ? 'Zwiń okno' : 'Powiększ okno'}
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
                      accessibilityLabel="Zamknij"
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
  sheetOuter: {
    width: '100%',
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
