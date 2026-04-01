'use strict';

// US-011, US-012, US-013, US-014

const { ValidateCreateApplication, ValidateUpdateApplication } = require('../application.validator');

const VALID_CREATE = {
  name: 'My App',
  type: 'SAT',
  reference: 'my-app-ref',
  environment: 'dev',
};

describe('ValidateCreateApplication (US-011)', () => {
  it('accepts valid minimal input', () => {
    const { error } = ValidateCreateApplication(VALID_CREATE);
    expect(error).toBeUndefined();
  });

  it('accepts all optional fields', () => {
    const { error } = ValidateCreateApplication({
      ...VALID_CREATE,
      description: 'desc',
      active: true,
      icon: 'https://s3/icon.png',
      tenant_scope: 'global',
      owners: [{ name: 'Alice', email: 'alice@example.com', role: 'lead' }],
    });
    expect(error).toBeUndefined();
  });

  it('requires name', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, name: undefined });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/name/i);
  });

  it('requires type', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, type: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid type', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, type: 'INVALID' });
    expect(error).toBeDefined();
  });

  it('accepts all valid types', () => {
    const types = ['COR-A', 'COR-B', 'SAT', 'INT-ADMIN', 'INT-TECH', 'SER'];
    types.forEach((type) => {
      const { error } = ValidateCreateApplication({ ...VALID_CREATE, type });
      expect(error).toBeUndefined();
    });
  });

  it('requires reference', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, reference: undefined });
    expect(error).toBeDefined();
  });

  it('rejects reference with invalid characters (US-011)', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, reference: 'invalid ref!' });
    expect(error).toBeDefined();
  });

  it('rejects reference shorter than 2 chars', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, reference: 'a' });
    expect(error).toBeDefined();
  });

  it('rejects reference longer than 60 chars', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, reference: 'a'.repeat(61) });
    expect(error).toBeDefined();
  });

  it('requires environment', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, environment: undefined });
    expect(error).toBeDefined();
  });

  it('rejects invalid environment', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, environment: 'production' });
    expect(error).toBeDefined();
  });

  it('accepts valid environments', () => {
    ['dev', 'staging', 'prod'].forEach((env) => {
      const { error } = ValidateCreateApplication({ ...VALID_CREATE, environment: env });
      expect(error).toBeUndefined();
    });
  });

  it('validates owner email format (US-019)', () => {
    const { error } = ValidateCreateApplication({
      ...VALID_CREATE,
      owners: [{ name: 'Alice', email: 'not-an-email', role: 'lead' }],
    });
    expect(error).toBeDefined();
  });

  it('accepts valid tenant_scope values (US-018)', () => {
    ['global', 'tenant-specific'].forEach((scope) => {
      const { error } = ValidateCreateApplication({ ...VALID_CREATE, tenant_scope: scope });
      expect(error).toBeUndefined();
    });
  });

  it('rejects invalid tenant_scope (US-018)', () => {
    const { error } = ValidateCreateApplication({ ...VALID_CREATE, tenant_scope: 'other' });
    expect(error).toBeDefined();
  });
});

describe('ValidateUpdateApplication (US-013)', () => {
  it('accepts empty object (all optional)', () => {
    const { error } = ValidateUpdateApplication({});
    expect(error).toBeUndefined();
  });

  it('accepts partial update with only name', () => {
    const { error } = ValidateUpdateApplication({ name: 'New Name' });
    expect(error).toBeUndefined();
  });

  it('accepts partial update with owners', () => {
    const { error } = ValidateUpdateApplication({
      owners: [{ name: 'Bob', email: 'bob@example.com', role: 'dev' }],
    });
    expect(error).toBeUndefined();
  });

  it('does not accept reference field (US-012)', () => {
    const { error } = ValidateUpdateApplication({ reference: 'new-ref' });
    // Joi unknown keys — should error or be stripped depending on config
    // The schema does not include reference, so abortEarly=false validation will error
    expect(error).toBeDefined();
  });

  it('rejects invalid type in update', () => {
    const { error } = ValidateUpdateApplication({ type: 'WRONG' });
    expect(error).toBeDefined();
  });
});
