import { useEffect, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';

/**
 * Tracks the active software keyboard height on iOS & Android so inputs
 * (including inside iOS pageSheet modals) always lift cleanly above the keyboard.
 */
export function useKeyboardHeight(enabled = true, animateLayout = true): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const h = Math.max(0, Math.round(e?.endCoordinates?.height || 0));
      if (animateLayout) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            Math.min(260, e?.duration || 220),
            LayoutAnimation.Types.keyboard,
            LayoutAnimation.Properties.scaleY
          )
        );
      }
      setKeyboardHeight(h);
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      if (animateLayout) {
        LayoutAnimation.configureNext(
          LayoutAnimation.create(
            Math.min(240, e?.duration || 200),
            LayoutAnimation.Types.keyboard,
            LayoutAnimation.Properties.scaleY
          )
        );
      }
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled, animateLayout]);

  return keyboardHeight;
}
