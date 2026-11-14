import * as Haptics from 'expo-haptics';
import { getCachedAppSettings } from './settings';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function triggerSelectionHaptic(): void {
  const settings = getCachedAppSettings();
  if (!settings.hapticsEnabled) return;
  try {
    void Haptics.selectionAsync();
  } catch {
    // Ignore on unsupported simulators/environments
  }
}

export function triggerImpactHaptic(preferred: 'light' | 'medium' | 'heavy' = 'medium'): void {
  const settings = getCachedAppSettings();
  if (!settings.hapticsEnabled) return;

  let style = Haptics.ImpactFeedbackStyle.Medium;
  if (settings.hapticsIntensity === 'subtle') {
    style = Haptics.ImpactFeedbackStyle.Light;
  } else if (settings.hapticsIntensity === 'strong') {
    style =
      preferred === 'light'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;
  } else {
    style =
      preferred === 'light'
        ? Haptics.ImpactFeedbackStyle.Light
        : preferred === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium;
  }

  try {
    void Haptics.impactAsync(style);
  } catch {
    // Ignore on unsupported environments
  }
}

export function triggerNotificationHaptic(
  type: 'success' | 'warning' | 'error' = 'success'
): void {
  const settings = getCachedAppSettings();
  if (!settings.hapticsEnabled) return;

  const feedbackType =
    type === 'error'
      ? Haptics.NotificationFeedbackType.Error
      : type === 'warning'
      ? Haptics.NotificationFeedbackType.Warning
      : Haptics.NotificationFeedbackType.Success;

  try {
    void Haptics.notificationAsync(feedbackType);
  } catch {
    // Ignore on unsupported environments
  }
}

/**
 * Fires a distinct 2-3 pulse haptic sequence when rest ends so the user feels it
 * even without looking directly at the phone screen.
 */
export async function triggerRestFinishedHapticSequence(): Promise<void> {
  const settings = getCachedAppSettings();
  if (!settings.hapticsEnabled) return;

  try {
    if (!settings.restEndMultiBuzz) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    const strongImpact =
      settings.hapticsIntensity === 'subtle'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Heavy;

    await Haptics.impactAsync(strongImpact);
    await sleep(210);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await sleep(230);
    await Haptics.impactAsync(strongImpact);
  } catch {
    // Ignore haptic failures
  }
}
