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
  /** Updates vertical scroll position of the inner scroll container so downward swipe only triggers at top */
  setScrollOffsetY: (y: number) => void;
  /** Temporarily disables swipe-to-dismiss while dragging reorderable rows inside the sheet */
  setDragLock: (locked: boolean) => void;
}

export const BottomSheetContext = createContext<BottomSheetContextValue>({
  setScrollOffsetY: () => {},
  setDragLock: () => {},
});

export function useBottomSheetContext(): BottomSheetContextValue {
  return useContext(BottomSheetContext);
}

/** ScrollView bound to BottomSheetContext so downward pull-to-dismiss only engages when scrolled to top. */
export const BottomSheetScrollView: React.FC<ScrollViewProps> = ({
  onScroll,
  scrollEventThrottle = 16,
  ...rest
}) => {
  const { setScrollOffsetY } = useBottomSheetContext();

  return (
    <ScrollView
      {...rest}
      scrollEventThrottle={scrollEventThrottle}
      onScroll={(e) => {
        setScrollOffsetY(e.nativeEvent.contentOffset.y);
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

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollOffsetYRef = useRef(0);
  const dragLockRef = useRef(false);
  const headerTouchRef = useRef(false);
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

  const animateClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 210,
      useNativeDriver: true,
    }).start(() => {
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
      headerTouchRef.current = false;
      setRenderModal(true);
      translateY.setValue(SCREEN_HEIGHT);

      Animated.spring(translateY, {
        toValue: 0,
        damping: 26,
        stiffness: 290,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    } else if (renderModal && !isClosingRef.current) {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 190,
        useNativeDriver: true,
      }).start(() => {
        setRenderModal(false);
      });
    }
  }, [visible, renderModal, translateY]);

  // Unified swipe-down responder across the whole popup (handle, header, and scrolled-to-top content)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        if (dragLockRef.current || isClosingRef.current) return false;
        const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15;
        if (!isVertical) return false;
        if (headerTouchRef.current && gesture.dy > 4) return true;
        return scrollOffsetYRef.current <= 2 && gesture.dy > 9;
      },
      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (dragLockRef.current || isClosingRef.current) return false;
        const isVertical = Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.15;
        if (!isVertical) return false;
        if (headerTouchRef.current && gesture.dy > 4) return true;
        return scrollOffsetYRef.current <= 2 && gesture.dy > 10;
      },
      onPanResponderMove: (_, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gesture) => {
        headerTouchRef.current = false;
        if (gesture.dy > 95 || gesture.vy > 0.65) {
          triggerSelectionHaptic();
          animateClose();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        headerTouchRef.current = false;
        Animated.spring(translateY, {
          toValue: 0,
          damping: 24,
          stiffness: 280,
          useNativeDriver: true,
        }).start();
      },
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
    }),
    []
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
          {...panResponder.panHandlers}
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
          {/* Generous Grabber + Header Zone: swipe down anywhere here closes the sheet */}
          <View
            onTouchStart={() => {
              headerTouchRef.current = true;
            }}
            onTouchEnd={() => {
              headerTouchRef.current = false;
            }}
            onTouchCancel={() => {
              headerTouchRef.current = false;
            }}
          >
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
    paddingTop: 12,
    paddingBottom: 8,
  },
  grabHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 4,
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
