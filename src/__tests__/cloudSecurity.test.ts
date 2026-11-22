import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.CLOUD_AUTH_SECRET = 'unit_test_secret_key_for_iron_routine_32chars';
});

import {
  decryptJsonPayload,
  deriveUserId,
  encryptJsonPayload,
  signCloudToken,
  verifyCloudToken,
} from '../../website/api/_lib/cloudStore';

describe('Cloud Auth Token & Backup AES-256-GCM Encryption', () => {
  it('derives deterministic user IDs', () => {
    expect(deriveUserId('User@Example.COM')).toBe(deriveUserId('user@example.com'));
    expect(deriveUserId('a@b.com')).toMatch(/^usr_[0-9a-f]{28}$/);
  });

  it('signs and verifies cloud HMAC-SHA256 session tokens and rejects tampering', () => {
    const token = signCloudToken({
      userId: 'usr_abc123',
      email: 'szymon@example.com',
      provider: 'apple',
    });
    expect(token.startsWith('ir_tok_')).toBe(true);

    const verified = verifyCloudToken(token);
    expect(verified?.userId).toBe('usr_abc123');
    expect(verified?.provider).toBe('apple');

    const tampered = token.slice(0, -4) + 'XXXX';
    expect(verifyCloudToken(tampered)).toBeNull();
  });

  it('encrypts and decrypts cloud backups using AES-256-GCM', () => {
    const sample = JSON.stringify({
      app: 'iron-routine',
      profile: { name: 'Szymon', weight: 82.4 },
      plans: [{ id: 'p1', name: 'PPL' }],
    });
    const encrypted = encryptJsonPayload(sample);
    expect(encrypted.alg).toBe('aes-256-gcm');
    expect(String(encrypted.data)).not.toContain('Szymon');

    const decrypted = decryptJsonPayload(encrypted);
    expect(decrypted).toBe(sample);
  });
});
