'use strict';

jest.mock('../../../../shared/s3.service', () => ({
  GeneratePresignedPutUrl: jest.fn(),
  GeneratePresignedGetUrl: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-123'),
}));

const { GeneratePresignedPutUrl, GeneratePresignedGetUrl } = require('../../../../shared/s3.service');
const { CreateUploadAuthorization, CompleteUpload } = require('../upload.helper');

beforeEach(() => {
  jest.clearAllMocks();
  GeneratePresignedPutUrl.mockResolvedValue('https://upload.example.com/presigned-put');
  GeneratePresignedGetUrl.mockResolvedValue('https://download.example.com/presigned-get');
});

describe('CreateUploadAuthorization', () => {
  it('creates a scoped upload url for public evolution attachments', async () => {
    const result = await CreateUploadAuthorization(
      {
        application_reference: 'test-app',
        purpose: 'EvolutionRequestAttachment',
        filename: 'release-note.png',
        content_type: 'image/png',
      },
      {
        apiKey: { application_reference: 'test-app' },
      }
    );

    expect(GeneratePresignedPutUrl).toHaveBeenCalledWith(
      'uploads/test-app/EvolutionRequestAttachment/uuid-123.png',
      'image/png',
      900
    );
    expect(result).toEqual({
      upload_url: 'https://upload.example.com/presigned-put',
      s3_key: 'uploads/test-app/EvolutionRequestAttachment/uuid-123.png',
      expires_in: 900,
    });
  });

  it('allows admin-only application assets', async () => {
    await CreateUploadAuthorization(
      {
        application_reference: 'test-app',
        purpose: 'ApplicationAsset',
        filename: 'icon.png',
        content_type: 'image/png',
      },
      {
        user: { role: 'admin' },
      }
    );

    expect(GeneratePresignedPutUrl).toHaveBeenCalledWith(
      'uploads/test-app/ApplicationAsset/uuid-123.png',
      'image/png',
      1800
    );
  });

  it('rejects forbidden public upload purposes', async () => {
    await expect(
      CreateUploadAuthorization(
        {
          application_reference: 'test-app',
          purpose: 'DocumentationArtifact',
          filename: 'brief.pdf',
          content_type: 'application/pdf',
        },
        {
          apiKey: { application_reference: 'test-app' },
        }
      )
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN_ACTION' },
    });
  });

  it('throws VALIDATION_ERROR for invalid content types', async () => {
    await expect(
      CreateUploadAuthorization(
        {
          application_reference: 'test-app',
          purpose: 'EvolutionRequestAttachment',
          filename: 'brief.docx',
          content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
        {
          apiKey: { application_reference: 'test-app' },
        }
      )
    ).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});

describe('CompleteUpload', () => {
  it('returns a download url for a scoped file', async () => {
    const result = await CompleteUpload(
      {
        application_reference: 'test-app',
        purpose: 'EvolutionRequestAttachment',
        s3_key: 'uploads/test-app/EvolutionRequestAttachment/uuid-123.png',
      },
      {
        apiKey: { application_reference: 'test-app' },
      }
    );

    expect(GeneratePresignedGetUrl).toHaveBeenCalledWith(
      'uploads/test-app/EvolutionRequestAttachment/uuid-123.png',
      900
    );
    expect(result).toEqual({
      s3_key: 'uploads/test-app/EvolutionRequestAttachment/uuid-123.png',
      download_url: 'https://download.example.com/presigned-get',
    });
  });

  it('rejects completion outside the allowed prefix', async () => {
    await expect(
      CompleteUpload(
        {
          application_reference: 'test-app',
          purpose: 'EvolutionRequestAttachment',
          s3_key: 'uploads/other-app/EvolutionRequestAttachment/uuid-123.png',
        },
        {
          apiKey: { application_reference: 'test-app' },
        }
      )
    ).rejects.toMatchObject({
      extensions: { code: 'FORBIDDEN_ACTION' },
    });
  });

  it('throws VALIDATION_ERROR for a missing s3 key', async () => {
    await expect(
      CompleteUpload(
        {
          application_reference: 'test-app',
          purpose: 'EvolutionRequestAttachment',
        },
        {
          apiKey: { application_reference: 'test-app' },
        }
      )
    ).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});
