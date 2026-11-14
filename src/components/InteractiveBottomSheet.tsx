import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { triggerSelectionHaptic } from '../services/haptics';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetContextValue {
  /** Updates vertical scroll position of the inner scroll container */
  setScrollOffsetY: (y: number) => void;
  /** Temporarily disables swipe-to-dismiss while dragging reorderable rows inside the sheet */
  setDragLock: (locked: boolean) => void;
  /** Mirrors native iOS ScrollView top overscroll pull onto sheet translateY */
  onOverscrollPull: (offsetY: number) => void;
  /** Closes or snaps back the sheet when releasing a pull-down on inner ScrollView */
  onOverscrollRelease: (offsetY: number, velocityY?: number) => void;
}

export const BottomSheetContext = createContext<BottomSheetContextValue>({
  setScrollOffsetY: () => {},
  setDragLock: () => {},
  onOverscrollPull: () => {},
  onOverscrollRelease: () => {},
});

export function useBottomSheetContext(): BottomSheetContextValue {
  return useContext(BottomSheetContext);
}

/**
 * ScrollView bound to BottomSheetContext so pulling down at the top edge
 * smoothly drags and dismisses the sheet natively on iOS and Android.
 */
export const BottomSheetScrollView: React.FC<ScrollViewProps> = ({
  onScroll,
  onScrollBeginDrag,
  onScrollEndDrag,
  scrollEventThrottle = 16,
  bounces,
  alwaysBounceVertical,
  ...rest
}) => {
  const { setScrollOffsetY, onOverscrollPull, onOverscrollRelease } = useBottomSheetContext();
  const isDraggingRef = useRef(false);

  return (
    <ScrollView
      {...rest}
      bounces={Platform.OS === 'ios' ? true : bounces}
      alwaysBounceVertical={Platform.OS === 'ios' ? true : alwaysBounceVertical}
      scrollEventThrottle={scrollEventThrottle}
      onScrollBeginDrag={(e) => {
        isDraggingRef.current = true;
        onScrollBeginDrag?.(e);
      }}
      onScrollEndDrag={(e) => {
        const wasDragging = isDraggingRef.current;
        isDraggingRef.current = false;
        if (Platform.OS === 'ios' && wasDragging) {
          onOverscrollRelease(e.nativeEvent.contentOffset.y, e.nativeEvent.velocity?.y);
        }
        onScrollEndDrag?.(e);
      }}
      onScroll={(e) => {
        const y = e.nativeEvent.contentOffset.y;
        setScrollOffsetY(y);
        if (Platform.OS === 'ios' && isDraggingRef.current) {
          onOverscrollPull(y);
        }
        onScroll?.(e);
      }}
    />
  );
};

interface InteractiveBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  initialHeightPercent?: number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const InteractiveBottomSheet: React.FC<InteractiveBottomSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  initialHeightPercent = 0.84,
  headerRight,
  children,
}) => {
  const { theme } = useAppTheme();
  const baseHeight = Math.round(SCREEN_HEIGHT * initialHeightPercent);

  const [renderModal, setRenderModal] = useState(visible);
  const renderModalRef = useRef(visible);

  const translateY = useRef(new Animated.Value(visible ? 0 : SCREEN_HEIGHT)).current;
  const scrollOffsetYRef = useRef(0);
  const dragLockRef = useRef(false);
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [0, Math.max(200, baseHeight)],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [translateY, baseHeight]
  );

  const snapBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      damping: 26,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const animateClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 210,
      useNativeDriver: true,
    }).start(() => {
      renderModalRef.current = false;
      setRenderModal(false);
      isClosingRef.current = false;
      onCloseRef.current();
    });
  }, [translateY]);

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      scrollOffsetYRef.current = 0;
      dragLockRef.current = false;
      if (!renderModalRef.current) {
        renderModalRef.current = true;
        setRenderModal(true);
      }
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        damping: 26,
        stiffness: 290,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    } else if (renderModalRef.current && !isClosingRef.current) {
      isClosingRef.current = true;
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 190,
        useNativeDriver: true,
      }).start(() => {
        renderModalRef.current = false;
        isClosingRef.current = false;
        setRenderModal(false);
      });
    }
  }, [visible, translateY]);

  // Dedicated PanResponder for the top grabber & header: starts immediately on touch down (buttons still win taps via bubbling)
  const headerPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !dragLockRef.current && !isClosingRef.current,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !dragLockRef.current &&
        !isClosingRef.current &&
        gesture.dy > 3 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        !dragLockRef.current &&
        !isClosingRef.current &&
        gesture.dy > 5 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.1,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 65 || gesture.vy > 0.35) {
          triggerSelectionHaptic();
          animateClose();
          return;
        }
        snapBack();
      },
      onPanResponderTerminate: snapBack,
    })
  ).current;

  // Fallback PanResponder for non-scrollable sheet body zones (e.g. footers / tabs)
  const bodyPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        !dragLockRef.current &&
        !isClosingRef.current &&
        scrollOffsetYRef.current <= 1 &&
        gesture.dy > 6 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 65 || gesture.vy > 0.35) {
          triggerSelectionHaptic();
          animateClose();
          return;
        }
        snapBack();
      },
      onPanResponderTerminate: snapBack,
    })
  ).current;

  const sheetCtxValue = useMemo<BottomSheetContextValue>(
    () => ({
      setScrollOffsetY: (y: number) => {
        scrollOffsetYRef.current = y;
      },
      setDragLock: (locked: boolean) => {
        dragLockRef.current = locked;
      },
      onOverscrollPull: (offsetY: number) => {
        if (dragLockRef.current || isClosingRef.current) return;
        if (offsetY < 0) {
          translateY.setValue(Math.min(baseHeight * 0.85, Math.abs(offsetY) * 1.55));
        } else {
          translateY.setValue(0);
        }
      },
      onOverscrollRelease: (offsetY: number, velocityY?: number) => {
        if (dragLockRef.current || isClosingRef.current) return;
        const isFlickDown = offsetY <= -8 && (velocityY ?? 0) <= -0.35;
        if (offsetY <= -38 || isFlickDown) {
          triggerSelectionHaptic();
          animateClose();
          return;
        }
        if (offsetY < 0) {
          snapBack();
        }
      },
    }),
    [animateClose, snapBack, translateY, baseHeight]
  );

  if (!renderModal) return null;

  return (
    <Modal
      visible={renderModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={animateClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(0, 0, 0, 0.48)',
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={animateClose} />
        </Animated.View>

        <Animated.View
          {...bodyPanResponder.panHandlers}
          style={[
            styles.sheet,
            {
              height: baseHeight,
              backgroundColor: theme.card,
              borderColor: theme.border,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* Dedicated Grabber + Header Drag Zone */}
          <View {...headerPanResponder.panHandlers}>
            <View style={styles.grabArea}>
              <View style={[styles.grabHandle, { backgroundColor: theme.borderDark }]} />
            </View>

            {(title || subtitle || headerRight) && (
              <View style={[styles.header, { borderBottomColor: theme.hairline }]}>
                <View style={styles.headerTextCol}>
                  {title ? (
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={2}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.headerActions}>
                  {headerRight}
                  <TouchableOpacity
                    style={[
                      styles.headerIconBtn,
                      { backgroundColor: theme.bgSecondary, borderColor: theme.border },
                    ]}
                    onPress={() => {
                      triggerSelectionHaptic();
                      animateClose();
                    }}
                    activeOpacity={0.75}
                    accessibilityLabel="Zamknij okno"
                  >
                    <Ionicons name="close" size={17} color={theme.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <BottomSheetContext.Provider value={sheetCtxValue}>
            <View style={styles.body}>{children}</View>
          </BottomSheetContext.Provider>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 22,
  },
  grabArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 10,
  },
  grabHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
