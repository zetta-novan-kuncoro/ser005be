'use strict';

// US-039 — SHA-256 hash utility tests

const { GenerateSha256 } = require('../hash.util');

describe('GenerateSha256 (US-039)', () => {
  it('returns a 64-char hex string', () => {
    const hash = GenerateSha256('hello');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('known value: SHA-256("hello") matches reference', () => {
    // SHA-256 of the string "hello"
    expect(GenerateSha256('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('JSON-stringifies objects before hashing', () => {
    const obj = { a: 1, b: 'test' };
    const hash = GenerateSha256(obj);
    const hashFromString = GenerateSha256(JSON.stringify(obj));
    expect(hash).toBe(hashFromString);
  });

  it('same input always produces same hash (deterministic)', () => {
    const data = { version: '1.0.0', title: 'Release' };
    expect(GenerateSha256(data)).toBe(GenerateSha256(data));
  });

  it('different inputs produce different hashes', () => {
    expect(GenerateSha256('foo')).not.toBe(GenerateSha256('bar'));
  });

  it('handles empty string', () => {
    const hash = GenerateSha256('');
    expect(hash).toHaveLength(64);
  });

  it('handles arrays', () => {
    const hash = GenerateSha256([1, 2, 3]);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
