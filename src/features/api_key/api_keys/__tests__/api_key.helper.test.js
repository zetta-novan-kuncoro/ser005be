'use strict';

// US-026, US-027, US-028, US-029, US-030, US-031, US-032

jest.mock('../api_key.model');
jest.mock('../../../../utils/crypto.util');
jest.mock('../../../../core/config', () => ({
  encryption: { key: 'test-encryption-key-32-bytes-pad' },
  isProduction: false,
}));

const ApiKeyModel = require('../api_key.model');
const { GenerateApiKey, EncryptApiKey, DecryptApiKey } = require('../../../../utils/crypto.util');
const { CreateApiKey, DeleteApiKey, DeactivateApiKey, GetApiKeys, CreateDevTestApiKey } = require('../api_key.helper');

// Helper to build a mock Mongoose doc
function mockDoc(overrides = {}) {
  const base = {
    _id: 'mock-id-123',
    application_reference: 'test-app',
    name: 'Test Key',
    key_purpose: 'default',
    key_prefix: 'zbk_test',
    api_key_encrypted: 'iv:tag:cipher',
    expires_at: null,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
  return { ...base, toObject: () => base };
}

beforeEach(() => {
  jest.clearAllMocks();
  GenerateApiKey.mockReturnValue('zbk_' + 'a'.repeat(64));
  EncryptApiKey.mockReturnValue('mockiv:mocktag:mockcipher');
  DecryptApiKey.mockReturnValue('zbk_' + 'a'.repeat(64));
});

describe('CreateApiKey (US-026, US-027, US-028)', () => {
  it('returns plain_text_key and api_key record', async () => {
    const doc = mockDoc();
    ApiKeyModel.create = jest.fn().mockResolvedValue(doc);

    const result = await CreateApiKey('test-app', { name: 'Prod Key' });

    expect(result).toHaveProperty('plain_text_key');
    expect(result).toHaveProperty('api_key');
    expect(result.plain_text_key).toMatch(/^zbk_/);
  });

  it('calls GenerateApiKey and EncryptApiKey (US-027, US-028)', async () => {
    ApiKeyModel.create = jest.fn().mockResolvedValue(mockDoc());
    await CreateApiKey('test-app', { name: 'Key' });
    expect(GenerateApiKey).toHaveBeenCalledTimes(1);
    expect(EncryptApiKey).toHaveBeenCalledTimes(1);
  });

  it('never stores plain key — stores encrypted form (US-028)', async () => {
    ApiKeyModel.create = jest.fn().mockResolvedValue(mockDoc());
    await CreateApiKey('test-app', { name: 'Key' });
    const createArgs = ApiKeyModel.create.mock.calls[0][0];
    expect(createArgs).not.toHaveProperty('plain_text_key');
    expect(createArgs).toHaveProperty('api_key_encrypted', 'mockiv:mocktag:mockcipher');
  });

  it('stores key_prefix (first 8 chars)', async () => {
    ApiKeyModel.create = jest.fn().mockResolvedValue(mockDoc());
    await CreateApiKey('test-app', { name: 'Key' });
    const createArgs = ApiKeyModel.create.mock.calls[0][0];
    expect(createArgs.key_prefix).toBeDefined();
    expect(createArgs.key_prefix.length).toBe(8);
  });

  it('throws VALIDATION_ERROR for missing name', async () => {
    await expect(CreateApiKey('test-app', {})).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

describe('GetApiKeys (US-029)', () => {
  it('queries with key_purpose $ne dev_test', async () => {
    ApiKeyModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });
    await GetApiKeys('test-app');
    expect(ApiKeyModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ key_purpose: { $ne: 'dev_test' } })
    );
  });

  it('returns array of records', async () => {
    ApiKeyModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([mockDoc()]) }),
    });
    const result = await GetApiKeys('test-app');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

describe('DeactivateApiKey (US-030)', () => {
  it('sets is_active=false', async () => {
    const doc = mockDoc({ is_active: false });
    ApiKeyModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(doc),
    });
    const result = await DeactivateApiKey('507f1f77bcf86cd799439011');
    expect(ApiKeyModel.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { $set: { is_active: false } },
      { new: true }
    );
    expect(result.is_active).toBe(false);
  });

  it('throws NOT_FOUND when record is null', async () => {
    ApiKeyModel.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    await expect(DeactivateApiKey('507f1f77bcf86cd799439011')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('throws BAD_USER_INPUT for invalid ObjectId', async () => {
    await expect(DeactivateApiKey('not-an-id')).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });
});

describe('DeleteApiKey (US-031)', () => {
  it('deletes the record and returns true', async () => {
    ApiKeyModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const result = await DeleteApiKey('507f1f77bcf86cd799439011');
    expect(result).toBe(true);
  });

  it('throws NOT_FOUND when deletedCount is 0', async () => {
    ApiKeyModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });
    await expect(DeleteApiKey('507f1f77bcf86cd799439011')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('throws BAD_USER_INPUT for invalid ObjectId', async () => {
    await expect(DeleteApiKey('bad-id')).rejects.toMatchObject({
      extensions: { code: 'BAD_USER_INPUT' },
    });
  });
});

describe('CreateDevTestApiKey (US-032)', () => {
  it('creates a new DEV key when none exists', async () => {
    ApiKeyModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    ApiKeyModel.updateMany = jest.fn().mockResolvedValue({});
    const doc = mockDoc({ key_purpose: 'dev_test', expires_at: new Date(Date.now() + 600000).toISOString() });
    ApiKeyModel.create = jest.fn().mockResolvedValue(doc);

    const result = await CreateDevTestApiKey('test-app');
    expect(result).toHaveProperty('plain_text_key');
    expect(result).toHaveProperty('api_key');
    expect(ApiKeyModel.create).toHaveBeenCalledTimes(1);
  });

  it('reuses unexpired DEV key and returns decrypted plain key', async () => {
    const futureExpiry = new Date(Date.now() + 600000).toISOString();
    const existingKey = mockDoc({ key_purpose: 'dev_test', expires_at: futureExpiry, is_active: true });
    ApiKeyModel.findOne = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(existingKey) }),
    });
    DecryptApiKey.mockReturnValue('zbk_decryptedkey');

    const result = await CreateDevTestApiKey('test-app');
    expect(ApiKeyModel.create).not.toHaveBeenCalled();
    expect(result.plain_text_key).toBe('zbk_decryptedkey');
  });

  it('returns FORBIDDEN in production (US-032)', async () => {
    jest.resetModules();
    jest.mock('../../../../core/config', () => ({
      encryption: { key: 'key' },
      isProduction: true,
    }));
    const { CreateDevTestApiKey: CreateDevTestApiKeyProd } = require('../api_key.helper');
    await expect(CreateDevTestApiKeyProd('test-app')).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN' },
    });
  });
});
