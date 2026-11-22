import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

let secureStoreAvailablePromise: Promise<boolean> | null = null;

function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  if (!secureStoreAvailablePromise) {
    secureStoreAvailablePromise = SecureStore.isAvailableAsync().catch(() => false);
  }
  return secureStoreAvailablePromise;
}

/**
 * Expo SecureStore keys only allow `[A-Za-z0-9._-]`.
 * Maps legacy AsyncStorage keys (containing `@` or `:`) deterministically.
 */
export function toSecureStoreKey(rawKey: string): string {
  const sanitized = String(rawKey || '')
    .replace(/^@+/, '')
    .replace(/[^A-Za-z0-9._-]/g, '.');
  return sanitized || 'iron_routine.secret';
}

const NATIVE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/**
 * Reads a secret from OS Keychain / Android Keystore (`expo-secure-store`).
 * Automatically migrates any legacy plaintext value found in `AsyncStorage`
 * into SecureStore and removes the plaintext copy from `AsyncStorage`.
 */
export async function getSecureItem(legacyKey: string): Promise<string | null> {
  const canUseSecure = await isSecureStoreAvailable();
  const safeKey = toSecureStoreKey(legacyKey);

  if (canUseSecure) {
    try {
      const existing = await SecureStore.getItemAsync(safeKey, NATIVE_OPTIONS);
      if (existing !== null) {
        return existing;
      }
    } catch {}

    // One-time transparent migration from legacy AsyncStorage -> SecureStore
    try {
      const legacyVal = await AsyncStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        try {
          await SecureStore.setItemAsync(safeKey, legacyVal, NATIVE_OPTIONS);
          await AsyncStorage.removeItem(legacyKey).catch(() => {});
        } catch {}
        return legacyVal;
      }
    } catch {}
    return null;
  }

  try {
    return await AsyncStorage.getItem(legacyKey);
  } catch {
    return null;
  }
}

export async function setSecureItem(legacyKey: string, value: string): Promise<void> {
  const canUseSecure = await isSecureStoreAvailable();
  const safeKey = toSecureStoreKey(legacyKey);

  if (canUseSecure) {
    try {
      await SecureStore.setItemAsync(safeKey, value, NATIVE_OPTIONS);
      await AsyncStorage.removeItem(legacyKey).catch(() => {});
      return;
    } catch {}
  }

  try {
    await AsyncStorage.setItem(legacyKey, value);
  } catch {}
}

export async function deleteSecureItem(legacyKey: string): Promise<void> {
  const canUseSecure = await isSecureStoreAvailable();
  const safeKey = toSecureStoreKey(legacyKey);

  if (canUseSecure) {
    await SecureStore.deleteItemAsync(safeKey, NATIVE_OPTIONS).catch(() => {});
  }
  await AsyncStorage.removeItem(legacyKey).catch(() => {});
}
