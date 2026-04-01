'use strict';

// US-026, US-028, US-033

const { ValidateCreateApiKey } = require('../api_key.validator');

describe('ValidateCreateApiKey (US-026, US-033)', () => {
  it('accepts valid minimal input', () => {
    const { error } = ValidateCreateApiKey({ name: 'Prod Key' });
    expect(error).toBeUndefined();
  });

  it('accepts name with future expires_at', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // +1 day
    const { error } = ValidateCreateApiKey({ name: 'Temp Key', expires_at: futureDate });
    expect(error).toBeUndefined();
  });

  it('accepts null expires_at', () => {
    const { error } = ValidateCreateApiKey({ name: 'Perm Key', expires_at: null });
    expect(error).toBeUndefined();
  });

  it('requires name', () => {
    const { error } = ValidateCreateApiKey({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/name/i);
  });

  it('rejects past expires_at (US-033)', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // -1 day
    const { error } = ValidateCreateApiKey({ name: 'Old Key', expires_at: pastDate });
    expect(error).toBeDefined();
  });

  it('rejects invalid ISO date string for expires_at', () => {
    const { error } = ValidateCreateApiKey({ name: 'Key', expires_at: 'not-a-date' });
    expect(error).toBeDefined();
  });

  it('returns no error when expires_at is omitted', () => {
    const { error } = ValidateCreateApiKey({ name: 'Key Without Expiry' });
    expect(error).toBeUndefined();
  });
});
