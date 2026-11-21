import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';
import nacl from 'tweetnacl';
import { ChatMessagePayload, ChatMessageType } from '../types/workout';

// Hook native OS hardware CSPRNG into TweetNaCl
nacl.setPRNG((dest, count) => {
  const bytes = ExpoCrypto.getRandomBytes(count);
  for (let i = 0; i < count; i++) {
    dest[i] = bytes[i];
  }
});

const E2EE_KEY_PREFIX = '@iron_routine:e2ee_keypair_v1_';

// In-memory caches avoid repeated AsyncStorage reads and X25519 scalar mults on polling ticks
const keyPairMemCache = new Map<string, StoredE2eeKeyPair>();
const secretBytesMemCache = new Map<string, Uint8Array>();
const sharedKeyMemCache = new Map<string, Uint8Array>();
const decryptedEnvelopeMemCache = new Map<string, PlainChatEnvelope>();
const MAX_DECRYPT_CACHE_ENTRIES = 600;

export function clearE2eeMemoryCaches(): void {
  keyPairMemCache.clear();
  secretBytesMemCache.clear();
  sharedKeyMemCache.clear();
  decryptedEnvelopeMemCache.clear();
}

function getCachedSharedKey(mySecretB64: string, peerPubB64: string): Uint8Array {
  const cacheKey = `${mySecretB64.slice(0, 12)}|${peerPubB64}`;
  const existing = sharedKeyMemCache.get(cacheKey);
  if (existing) return existing;

  let mySecret = secretBytesMemCache.get(mySecretB64);
  if (!mySecret) {
    mySecret = base64ToBytes(mySecretB64);
    secretBytesMemCache.set(mySecretB64, mySecret);
  }
  const peerPub = base64ToBytes(peerPubB64);
  const sharedKey = nacl.box.before(peerPub, mySecret);
  sharedKeyMemCache.set(cacheKey, sharedKey);
  return sharedKey;
}

export interface StoredE2eeKeyPair {
  publicKey: string; // Base64 (32 bytes Curve25519)
  secretKey: string; // Base64 (32 bytes Curve25519)
}

export interface PlainChatEnvelope {
  type: ChatMessageType;
  text: string;
  payload?: ChatMessagePayload;
}

export interface EncryptedChatWirePayload {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
  recipientPublicKey: string;
  alg: 'x25519-xsalsa20-poly1305';
}

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += B64_CHARS[(triplet >> 18) & 63];
    out += B64_CHARS[(triplet >> 12) & 63];
    out += i + 1 < bytes.length ? B64_CHARS[(triplet >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[triplet & 63] : '=';
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = String(b64 || '').replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLen = Math.max(0, (clean.length * 3) / 4 - padding);
  const out = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_CHARS.indexOf(clean[i]);
    const c1 = B64_CHARS.indexOf(clean[i + 1]);
    const c2 = clean[i + 2] === '=' ? 0 : B64_CHARS.indexOf(clean[i + 2]);
    const c3 = clean[i + 3] === '=' ? 0 : B64_CHARS.indexOf(clean[i + 3]);
    const triplet = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < byteLen) out[p++] = (triplet >> 16) & 255;
    if (p < byteLen) out[p++] = (triplet >> 8) & 255;
    if (p < byteLen) out[p++] = triplet & 255;
  }
  return out;
}

function utf8Encode(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder().decode(bytes);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(binary));
}

export async function getOrCreateE2eeKeyPair(userId = 'device'): Promise<StoredE2eeKeyPair> {
  const mem = keyPairMemCache.get(userId);
  if (mem) return mem;

  const storageKey = `${E2EE_KEY_PREFIX}${userId}`;
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredE2eeKeyPair;
      if (parsed?.publicKey && parsed?.secretKey) {
        keyPairMemCache.set(userId, parsed);
        return parsed;
      }
    }
  } catch {}

  const pair = nacl.box.keyPair();
  const created: StoredE2eeKeyPair = {
    publicKey: bytesToBase64(pair.publicKey),
    secretKey: bytesToBase64(pair.secretKey),
  };
  keyPairMemCache.set(userId, created);
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(created));
  } catch {}
  return created;
}

export function encryptChatEnvelope(
  envelope: PlainChatEnvelope,
  recipientPublicKeyB64: string,
  myKeyPair: StoredE2eeKeyPair
): EncryptedChatWirePayload {
  const nonce = ExpoCrypto.getRandomBytes(nacl.box.nonceLength);
  const sharedKey = getCachedSharedKey(myKeyPair.secretKey, recipientPublicKeyB64);
  const plaintextBytes = utf8Encode(JSON.stringify(envelope));
  const sealed = nacl.box.after(plaintextBytes, nonce, sharedKey);

  return {
    ciphertext: bytesToBase64(sealed),
    nonce: bytesToBase64(nonce),
    senderPublicKey: myKeyPair.publicKey,
    recipientPublicKey: recipientPublicKeyB64,
    alg: 'x25519-xsalsa20-poly1305',
  };
}

export function decryptChatEnvelope(
  raw: {
    senderId: string;
    isEncrypted?: boolean;
    ciphertext?: string;
    nonce?: string;
    senderPublicKey?: string;
    recipientPublicKey?: string;
    type?: ChatMessageType;
    text?: string;
    payload?: ChatMessagePayload;
  },
  myUserId: string,
  myKeyPair: StoredE2eeKeyPair | null
): PlainChatEnvelope | null {
  if (!raw.ciphertext || !raw.nonce || !raw.senderPublicKey || !raw.recipientPublicKey) {
    // Prevent plaintext downgrade attack: only accept unencrypted legacy messages if explicitly marked unencrypted
    if (raw.isEncrypted === false && raw.text) {
      return { type: raw.type || 'text', text: raw.text, payload: raw.payload };
    }
    return null;
  }
  if (!myKeyPair) return null;

  const isMine = raw.senderId === myUserId;
  const peerPubB64 = isMine ? raw.recipientPublicKey : raw.senderPublicKey;
  const msgCacheKey = `${myKeyPair.publicKey.slice(0, 10)}|${peerPubB64.slice(0, 10)}|${raw.nonce}|${raw.ciphertext.length}|${raw.ciphertext.slice(0, 20)}`;
  const cachedEnvelope = decryptedEnvelopeMemCache.get(msgCacheKey);
  if (cachedEnvelope) return cachedEnvelope;

  try {
    const sharedKey = getCachedSharedKey(myKeyPair.secretKey, peerPubB64);
    const cipherBytes = base64ToBytes(raw.ciphertext);
    const nonceBytes = base64ToBytes(raw.nonce);

    const opened = nacl.box.open.after(cipherBytes, nonceBytes, sharedKey);
    if (!opened) return null;

    const jsonStr = utf8Decode(opened);
    const parsed = JSON.parse(jsonStr) as PlainChatEnvelope;
    const result: PlainChatEnvelope = {
      type: parsed.type || 'text',
      text: parsed.text || '',
      payload: parsed.payload,
    };
    if (decryptedEnvelopeMemCache.size >= MAX_DECRYPT_CACHE_ENTRIES) {
      const firstKey = decryptedEnvelopeMemCache.keys().next().value;
      if (firstKey) decryptedEnvelopeMemCache.delete(firstKey);
    }
    decryptedEnvelopeMemCache.set(msgCacheKey, result);
    return result;
  } catch {
    return null;
  }
}

export function formatPublicKeyFingerprint(publicKeyB64?: string | null): string {
  if (!publicKeyB64) return '---- · ---- · ---- · ----';
  try {
    const bytes = base64ToBytes(publicKeyB64);
    const hex: string[] = [];
    for (let i = 0; i < Math.min(8, bytes.length); i++) {
      hex.push(bytes[i].toString(16).padStart(2, '0').toUpperCase());
    }
    const joined = hex.join('');
    return `${joined.slice(0, 4)} · ${joined.slice(4, 8)} · ${joined.slice(8, 12)} · ${joined.slice(12, 16)}`;
  } catch {
    return '---- · ---- · ---- · ----';
  }
}
