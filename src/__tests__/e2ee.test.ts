import { describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

// Mock React Native / Expo native bridges for fast Node unit testing
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: async (k: string) => {
        store.delete(k);
      },
    },
  };
});
vi.mock('expo-secure-store', () => ({
  isAvailableAsync: async () => false,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 6,
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
vi.mock('expo-crypto', () => ({
  getRandomBytes: (count: number) => new Uint8Array(crypto.randomBytes(count)),
}));

import {
  clearE2eeMemoryCaches,
  decryptChatEnvelope,
  encryptChatEnvelope,
  formatPublicKeyFingerprint,
  getOrCreateE2eeKeyPair,
} from '../utils/e2ee';
import { toSecureStoreKey } from '../utils/secureStorage';

describe('E2EE Curve25519 / XSalsa20-Poly1305', () => {
  it('encrypts and decrypts chat envelopes between two users', async () => {
    clearE2eeMemoryCaches();
    const alice = await getOrCreateE2eeKeyPair('alice_1');
    const bob = await getOrCreateE2eeKeyPair('bob_1');

    const wire = encryptChatEnvelope(
      { type: 'text', text: 'Siema, dziś 105 kg na ławce!' },
      bob.publicKey,
      alice
    );

    expect(wire.alg).toBe('x25519-xsalsa20-poly1305');
    expect(wire.ciphertext).not.toContain('105');

    const openedByBob = decryptChatEnvelope(
      { senderId: 'alice_1', isEncrypted: true, ...wire },
      'bob_1',
      bob
    );
    expect(openedByBob?.text).toBe('Siema, dziś 105 kg na ławce!');

    const openedByAlice = decryptChatEnvelope(
      { senderId: 'alice_1', isEncrypted: true, ...wire },
      'alice_1',
      alice
    );
    expect(openedByAlice?.text).toBe('Siema, dziś 105 kg na ławce!');
  });

  it('rejects tampered ciphertext', async () => {
    const alice = await getOrCreateE2eeKeyPair('alice_2');
    const bob = await getOrCreateE2eeKeyPair('bob_2');

    const wire = encryptChatEnvelope(
      { type: 'text', text: 'Secret PR' },
      bob.publicKey,
      alice
    );
    const tampered = {
      ...wire,
      ciphertext: 'AAAA' + wire.ciphertext.slice(4),
    };

    const opened = decryptChatEnvelope(
      { senderId: 'alice_2', isEncrypted: true, ...tampered },
      'bob_2',
      bob
    );
    expect(opened).toBeNull();
  });

  it('blocks silent plaintext downgrade when isEncrypted is not explicitly false', async () => {
    const bob = await getOrCreateE2eeKeyPair('bob_3');
    const downgraded = decryptChatEnvelope(
      { senderId: 'attacker', text: 'Forged plaintext' },
      'bob_3',
      bob
    );
    expect(downgraded).toBeNull();
  });

  it('formats key fingerprints and sanitizes SecureStore keys', async () => {
    const alice = await getOrCreateE2eeKeyPair('alice_fp');
    expect(formatPublicKeyFingerprint(alice.publicKey)).toMatch(
      /^[0-9A-F]{4} · [0-9A-F]{4} · [0-9A-F]{4} · [0-9A-F]{4}$/
    );
    expect(toSecureStoreKey('@iron_routine:cloud_session_v2')).toBe(
      'iron_routine.cloud_session_v2'
    );
  });
});
