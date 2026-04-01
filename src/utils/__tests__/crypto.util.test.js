'use strict';

// US-027, US-028, US-031
// Pure unit tests — no mocks needed; tests the real crypto module.

jest.mock('../../core/config', () => ({
  encryption: { key: 'test-encryption-key-32-bytes-pad' },
}));

const { GenerateApiKey, EncryptApiKey, DecryptApiKey } = require('../crypto.util');

describe('GenerateApiKey (US-027)', () => {
  it('returns a string matching /^zbk_[a-f0-9]{64}$/', () => {
    const key = GenerateApiKey();
    expect(key).toMatch(/^zbk_[a-f0-9]{64}$/);
  });

  it('returns 68 total characters (4 prefix + 64 hex)', () => {
    const key = GenerateApiKey();
    expect(key.length).toBe(68);
  });

  it('starts with "zbk_"', () => {
    expect(GenerateApiKey()).toMatch(/^zbk_/);
  });

  it('two consecutive calls never return the same value', () => {
    const k1 = GenerateApiKey();
    const k2 = GenerateApiKey();
    expect(k1).not.toBe(k2);
  });
});

describe('EncryptApiKey (US-028)', () => {
  it('returns a colon-delimited 3-part hex string (iv:authTag:ciphertext)', () => {
    const encrypted = EncryptApiKey('zbk_testapikey');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    parts.forEach((part) => expect(part).toMatch(/^[a-f0-9]+$/));
  });

  it('IV part is 24 hex chars (12 bytes)', () => {
    const [ivHex] = EncryptApiKey('value').split(':');
    expect(ivHex).toHaveLength(24);
  });

  it('authTag part is 32 hex chars (16 bytes)', () => {
    const [, authTagHex] = EncryptApiKey('value').split(':');
    expect(authTagHex).toHaveLength(32);
  });

  it('two encryptions of the same value produce different ciphertexts (random IV)', () => {
    const plain = 'zbk_samevalue';
    const enc1 = EncryptApiKey(plain);
    const enc2 = EncryptApiKey(plain);
    expect(enc1).not.toBe(enc2);
  });
});

describe('DecryptApiKey (US-028)', () => {
  it('round-trip returns the original plain text', () => {
    const plain = 'zbk_roundtriptest';
    expect(DecryptApiKey(EncryptApiKey(plain))).toBe(plain);
  });

  it('round-trip works for generated API key', () => {
    const key = GenerateApiKey();
    expect(DecryptApiKey(EncryptApiKey(key))).toBe(key);
  });

  it('tampered authTag causes GCM decryption to throw', () => {
    const encrypted = EncryptApiKey('zbk_secret');
    const [iv, , ciphertext] = encrypted.split(':');
    const tamperedAuthTag = 'ff'.repeat(16); // 32 hex chars, all wrong
    const tampered = `${iv}:${tamperedAuthTag}:${ciphertext}`;
    expect(() => DecryptApiKey(tampered)).toThrow();
  });

  it('tampered ciphertext causes decryption to throw', () => {
    const encrypted = EncryptApiKey('zbk_secret');
    const [iv, authTag] = encrypted.split(':');
    const tamperedCiphertext = '00'.repeat(10);
    const tampered = `${iv}:${authTag}:${tamperedCiphertext}`;
    expect(() => DecryptApiKey(tampered)).toThrow();
  });
});
