'use strict';

// US-146, US-147, US-148

const { ValidateCreateTranslation, ValidateUpdateTranslation } = require('../translation.validator');

describe('ValidateCreateTranslation (US-146)', () => {
  it('accepts minimal input (key + namespace only)', () => {
    const { error } = ValidateCreateTranslation({ key: 'button.submit', namespace: 'common' });
    expect(error).toBeUndefined();
  });

  it('accepts all language fields', () => {
    const { error } = ValidateCreateTranslation({
      key: 'button.submit',
      namespace: 'common',
      en: 'Submit',
      fr: 'Soumettre',
      es: 'Enviar',
      id: 'Kirim',
    });
    expect(error).toBeUndefined();
  });

  it('accepts empty string language values', () => {
    const { error } = ValidateCreateTranslation({ key: 'btn', namespace: 'app', en: '', fr: '' });
    expect(error).toBeUndefined();
  });

  it('requires key', () => {
    const { error } = ValidateCreateTranslation({ namespace: 'common' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/key/i);
  });

  it('requires namespace', () => {
    const { error } = ValidateCreateTranslation({ key: 'btn' });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/namespace/i);
  });

  it('rejects unknown fields', () => {
    const { error } = ValidateCreateTranslation({ key: 'btn', namespace: 'app', de: 'Senden' });
    expect(error).toBeDefined();
  });
});

describe('ValidateUpdateTranslation (US-147)', () => {
  it('accepts empty object', () => {
    const { error } = ValidateUpdateTranslation({});
    expect(error).toBeUndefined();
  });

  it('accepts partial update with only en', () => {
    const { error } = ValidateUpdateTranslation({ en: 'Updated' });
    expect(error).toBeUndefined();
  });

  it('accepts all language fields', () => {
    const { error } = ValidateUpdateTranslation({ en: 'A', fr: 'B', es: 'C', id: 'D' });
    expect(error).toBeUndefined();
  });

  it('rejects unknown fields (US-147)', () => {
    const { error } = ValidateUpdateTranslation({ de: 'Hallo' });
    expect(error).toBeDefined();
  });

  it('rejects key or namespace in update (immutable)', () => {
    const { error } = ValidateUpdateTranslation({ key: 'new.key' });
    expect(error).toBeDefined();
  });
});
