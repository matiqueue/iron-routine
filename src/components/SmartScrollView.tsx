import React, { forwardRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';

interface SmartScrollViewProps extends ScrollViewProps {
  /** Extra px allowance above viewport height before enabling scroll (default 3) */
  overflowTolerance?: number;
  /** Automatically pad bottom when software keyboard opens so lower TextInputs stay reachable */
  liftForKeyboard?: boolean;
  /** Lock vertical scrolling when content already fits inside the screen (default true) */
  lockWhenFits?: boolean;
}

/**
 * Application-grade ScrollView that stays non-scrollable & non-bouncing whenever
 * content fits cleanly inside the viewport, and lifts smoothly above the keyboard.
 */
export const SmartScrollView = forwardRef<
  React.ComponentRef<typeof ScrollView>,
  SmartScrollViewProps
>(
  (
    {
      children,
      contentContainerStyle,
      overflowTolerance = 3,
      liftForKeyboard = true,
      lockWhenFits = true,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'interactive',
      showsVerticalScrollIndicator = false,
      onLayout,
      onContentSizeChange,
      scrollEnabled,
      bounces,
      alwaysBounceVertical,
      ...rest
    },
    ref
  ) => {
    const [viewportH, setViewportH] = useState(0);
    const [contentH, setContentH] = useState(0);
    const keyboardHeight = useKeyboardHeight(liftForKeyboard, false);

    const hasMeasured = viewportH > 0 && contentH > 0;
    const contentOverflows = !hasMeasured || contentH > viewportH + overflowTolerance;
    const effectiveScrollEnabled =
      scrollEnabled !== undefined
        ? scrollEnabled
        : !lockWhenFits || contentOverflows || keyboardHeight > 0;

    const flatStyle = StyleSheet.flatten(contentContainerStyle) || {};
    const basePaddingBottom =
      typeof flatStyle.paddingBottom === 'number' ? flatStyle.paddingBottom : 0;

    return (
      <ScrollView
        ref={ref}
        {...rest}
        scrollEnabled={effectiveScrollEnabled}
        bounces={bounces !== undefined ? bounces : effectiveScrollEnabled}
        alwaysBounceVertical={
          alwaysBounceVertical !== undefined ? alwaysBounceVertical : false
        }
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios' && liftForKeyboard}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        onLayout={(e) => {
          setViewportH(Math.round(e.nativeEvent.layout.height));
          onLayout?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setContentH(Math.round(h));
          onContentSizeChange?.(w, h);
        }}
        contentContainerStyle={[
          contentContainerStyle,
          liftForKeyboard && keyboardHeight > 0
            ? { paddingBottom: basePaddingBottom + Math.max(20, keyboardHeight - 36) }
            : null,
        ]}
      >
        {children}
        {liftForKeyboard && keyboardHeight > 0 && Platform.OS === 'android' ? (
          <View style={{ height: 24 }} />
        ) : null}
      </ScrollView>
    );
  }
);
