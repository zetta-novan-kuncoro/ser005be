'use strict';

jest.mock('../webhook_log.model');

const WebhookLogModel = require('../webhook_log.model');
const { AppendWebhookLog, GetAdminWebhookLogs } = require('../webhook_log.helper');

function mockLog(overrides = {}) {
  return {
    _id: 'mongo-id-1',
    log_id: 'uuid-log-1',
    source: 'JIRA',
    received_at: '2026-03-19T10:00:00.000Z',
    route: '/jira',
    remote_ip: null,
    http_method: 'POST',
    content_type: 'application/json',
    payload_size_bytes: 512,
    signature_present: true,
    signature_valid: true,
    processing_status: 'PROCESSED',
    processing_note: null,
    issue_key: 'SAT-42',
    entity_type: 'EvolutionRequest',
    entity_id: 'req-uuid-1',
    resolved_status: 'In Development',
    auto_advance_attempted: true,
    auto_advance_succeeded: true,
    payload_summary: { event_type: 'jira:issue_updated', issue_key: 'SAT-42', project_key: 'SAT', status_from: 'Approved', status_to: 'In Development' },
    error_code: null,
    error_message: null,
    duration_ms: 45,
    http_response_status: 200,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AppendWebhookLog', () => {
  it('generates a UUID log_id and persists the entry', async () => {
    const log = mockLog();
    WebhookLogModel.create = jest.fn().mockResolvedValue({ ...log, toObject: () => log });

    const result = await AppendWebhookLog({
      source: 'JIRA',
      received_at: '2026-03-19T10:00:00.000Z',
      route: '/jira',
      signature_present: true,
      signature_valid: true,
      processing_status: 'PROCESSED',
      http_response_status: 200,
    });

    expect(WebhookLogModel.create).toHaveBeenCalledTimes(1);
    const callArg = WebhookLogModel.create.mock.calls[0][0];
    expect(typeof callArg.log_id).toBe('string');
    expect(callArg.log_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(result).toHaveProperty('log_id');
  });

  it('defaults optional fields to null', async () => {
    const log = mockLog({ remote_ip: null, processing_note: null, issue_key: null, entity_type: null, entity_id: null });
    WebhookLogModel.create = jest.fn().mockResolvedValue({ ...log, toObject: () => log });

    await AppendWebhookLog({
      source: 'JIRA',
      received_at: '2026-03-19T10:00:00.000Z',
      route: '/jira',
      signature_present: false,
      signature_valid: false,
      processing_status: 'SIGNATURE_REJECTED',
      http_response_status: 401,
    });

    const callArg = WebhookLogModel.create.mock.calls[0][0];
    expect(callArg.remote_ip).toBeNull();
    expect(callArg.processing_note).toBeNull();
    expect(callArg.issue_key).toBeNull();
    expect(callArg.entity_type).toBeNull();
    expect(callArg.entity_id).toBeNull();
    expect(callArg.error_code).toBeNull();
    expect(callArg.error_message).toBeNull();
  });

  it('returns a plain object via toObject()', async () => {
    const log = mockLog();
    const toObjectMock = jest.fn().mockReturnValue(log);
    WebhookLogModel.create = jest.fn().mockResolvedValue({ ...log, toObject: toObjectMock });

    const result = await AppendWebhookLog({
      source: 'JIRA',
      received_at: '2026-03-19T10:00:00.000Z',
      route: '/jira',
      signature_present: true,
      signature_valid: true,
      processing_status: 'PROCESSED',
      http_response_status: 200,
    });

    expect(toObjectMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(log);
  });
});

describe('GetAdminWebhookLogs', () => {
  function setupFind(logs = [], total = 0) {
    WebhookLogModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(logs),
    });
    WebhookLogModel.countDocuments = jest.fn().mockResolvedValue(total);
  }

  it('returns a paginated response shape with empty data', async () => {
    setupFind([], 0);

    const result = await GetAdminWebhookLogs();

    expect(result).toMatchObject({
      data: [],
      total: 0,
      page: 1,
      limit: expect.any(Number),
      total_pages: 1,
    });
  });

  it('applies source filter', async () => {
    setupFind([], 0);

    await GetAdminWebhookLogs({ source: 'JIRA' });

    const queryArg = WebhookLogModel.find.mock.calls[0][0];
    expect(queryArg.source).toBe('JIRA');
  });

  it('applies processing_status filter', async () => {
    setupFind([], 0);

    await GetAdminWebhookLogs({ processing_status: 'FAILED' });

    const queryArg = WebhookLogModel.find.mock.calls[0][0];
    expect(queryArg.processing_status).toBe('FAILED');
  });

  it('applies issue_key filter', async () => {
    setupFind([], 0);

    await GetAdminWebhookLogs({ issue_key: 'SAT-99' });

    const queryArg = WebhookLogModel.find.mock.calls[0][0];
    expect(queryArg.issue_key).toBe('SAT-99');
  });

  it('applies from_date and to_date as received_at range', async () => {
    setupFind([], 0);

    await GetAdminWebhookLogs({ from_date: '2026-01-01', to_date: '2026-03-31' });

    const queryArg = WebhookLogModel.find.mock.calls[0][0];
    expect(queryArg.received_at).toEqual({ $gte: '2026-01-01', $lte: '2026-03-31' });
  });

  it('defaults sort to received_at desc for unknown sort field', async () => {
    setupFind([], 0);

    await GetAdminWebhookLogs({}, {}, { field: 'not_a_real_field', order: 'asc' });

    const findChain = WebhookLogModel.find.mock.results[0].value;
    expect(findChain.sort).toHaveBeenCalledWith({ received_at: 1 });
  });

  it('throws VALIDATION_ERROR for invalid filter enum values', async () => {
    await expect(GetAdminWebhookLogs({ source: 'GitHub' })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('throws VALIDATION_ERROR for unknown filter keys', async () => {
    await expect(GetAdminWebhookLogs({ injected_field: 'value' })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });
});
