'use strict';

// US-161, US-162, US-163

const { ValidateUploadAuthorization, ValidateCompleteUpload } = require('../upload.validator');

describe('ValidateUploadAuthorization (US-161, US-163)', () => {
  it('accepts valid minimal input', () => {
    const { error } = ValidateUploadAuthorization({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      filename: 'photo.png',
      content_type: 'image/png',
    });
    expect(error).toBeUndefined();
  });

  it('requires upload scope fields', () => {
    const { error } = ValidateUploadAuthorization({
      filename: 'icon.png',
      content_type: 'image/png',
    });
    expect(error).toBeDefined();
  });

  it('requires filename (US-163)', () => {
    const { error } = ValidateUploadAuthorization({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      content_type: 'image/png',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/filename/i);
  });

  it('requires content_type (US-163)', () => {
    const { error } = ValidateUploadAuthorization({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      filename: 'file.png',
    });
    expect(error).toBeDefined();
    expect(error.message).toMatch(/content_type/i);
  });

  it('rejects unknown fields', () => {
    const { error } = ValidateUploadAuthorization({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      filename: 'f.png',
      content_type: 'image/png',
      extra: 'field',
    });
    expect(error).toBeDefined();
  });
});

describe('ValidateCompleteUpload (US-162, US-163)', () => {
  it('accepts valid scoped s3_key', () => {
    const { error } = ValidateCompleteUpload({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      s3_key: 'uploads/test-app/EvolutionRequestAttachment/abc123.png',
    });
    expect(error).toBeUndefined();
  });

  it('requires s3_key (US-163)', () => {
    const { error } = ValidateCompleteUpload({});
    expect(error).toBeDefined();
    expect(error.message).toMatch(/s3_key/i);
  });

  it('rejects empty s3_key', () => {
    const { error } = ValidateCompleteUpload({
      application_reference: 'test-app',
      purpose: 'EvolutionRequestAttachment',
      s3_key: '',
    });
    expect(error).toBeDefined();
  });
});
