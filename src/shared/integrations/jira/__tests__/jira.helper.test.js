'use strict';

// US-186, US-187, US-188, US-189

jest.mock('../../../../utils/http.util');

const { Post, Get } = require('../../../../utils/http.util');
const { CreateJiraIssue, AddJiraComment, GetJiraIssueStatus } = require('../jira.helper');

const JIRA_CFG = {
  baseUrl: 'https://jira.example.com',
  userEmail: 'user@example.com',
  apiToken: 'secret-token',
  projectKey: 'SAT',
};

const SAMPLE_REQUEST = {
  application_reference: 'test-app',
  title: 'Add dark mode',
  type: 'Evolution',
  priority: 2,
  submitted_by: 'alice@example.com',
  expected_date: null,
  description: 'Users want dark mode',
  attachments: [],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CreateJiraIssue (US-186)', () => {
  it('sends POST to /rest/api/3/issue with correct payload', async () => {
    Post.mockResolvedValue({ ok: true, status: 201, data: { key: 'SAT-1' } });

    const result = await CreateJiraIssue(SAMPLE_REQUEST, JIRA_CFG);

    expect(Post).toHaveBeenCalledWith(
      'https://jira.example.com/rest/api/3/issue',
      expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }),
      expect.objectContaining({
        fields: expect.objectContaining({
          project: { key: 'SAT' },
          issuetype: { name: 'Task' },
          summary: '[test-app] Add dark mode',
        }),
      })
    );
    expect(result).toEqual({
      issue_key: 'SAT-1',
      issue_url: 'https://jira.example.com/browse/SAT-1',
    });
  });

  it('uses Basic auth header with base64-encoded email:token (US-186)', async () => {
    Post.mockResolvedValue({ ok: true, status: 201, data: { key: 'SAT-2' } });
    await CreateJiraIssue(SAMPLE_REQUEST, JIRA_CFG);

    const headers = Post.mock.calls[0][1];
    const expected = `Basic ${Buffer.from('user@example.com:secret-token').toString('base64')}`;
    expect(headers.Authorization).toBe(expected);
  });

  it('throws when JIRA responds with non-2xx (US-186)', async () => {
    Post.mockResolvedValue({ ok: false, status: 400, data: { errorMessages: ['Bad request'] } });
    await expect(CreateJiraIssue(SAMPLE_REQUEST, JIRA_CFG)).rejects.toThrow(/JIRA issue creation failed/);
  });

  it('throws INTEGRATION_NOT_CONFIGURED when cfg is missing (US-187)', async () => {
    await expect(CreateJiraIssue(SAMPLE_REQUEST, {})).rejects.toMatchObject({
      extensions: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('throws INTEGRATION_NOT_CONFIGURED when baseUrl is missing (US-187)', async () => {
    const badCfg = { ...JIRA_CFG, baseUrl: undefined };
    await expect(CreateJiraIssue(SAMPLE_REQUEST, badCfg)).rejects.toMatchObject({
      extensions: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });

  it('includes attachments in description when present', async () => {
    Post.mockResolvedValue({ ok: true, status: 201, data: { key: 'SAT-3' } });
    const reqWithAttachments = { ...SAMPLE_REQUEST, attachments: ['s3://bucket/file.png'] };
    await CreateJiraIssue(reqWithAttachments, JIRA_CFG);

    const payload = Post.mock.calls[0][2];
    const descContent = payload.fields.description.content;
    const allText = descContent.map((c) => c.content?.[0]?.text || '').join(' ');
    expect(allText).toContain('s3://bucket/file.png');
  });
});

describe('AddJiraComment (US-188)', () => {
  it('sends POST to /rest/api/3/issue/{key}/comment', async () => {
    Post.mockResolvedValue({ ok: true, status: 201, data: {} });
    const result = await AddJiraComment('SAT-1', 'Status changed to In Development', JIRA_CFG);

    expect(Post).toHaveBeenCalledWith(
      'https://jira.example.com/rest/api/3/issue/SAT-1/comment',
      expect.any(Object),
      expect.objectContaining({ body: expect.any(Object) })
    );
    expect(result).toEqual({ ok: true });
  });

  it('returns { ok: false } on HTTP error — never throws (US-188)', async () => {
    Post.mockResolvedValue({ ok: false, status: 500, data: {} });
    const result = await AddJiraComment('SAT-1', 'comment', JIRA_CFG);
    expect(result).toEqual({ ok: false });
  });

  it('returns { ok: false } when Post throws — never throws (US-188)', async () => {
    Post.mockRejectedValue(new Error('network error'));
    const result = await AddJiraComment('SAT-1', 'comment', JIRA_CFG);
    expect(result).toEqual({ ok: false });
  });

  it('wraps multi-line comment in ADF paragraphs (US-188)', async () => {
    Post.mockResolvedValue({ ok: true, status: 201, data: {} });
    await AddJiraComment('SAT-1', 'Line one\nLine two\nLine three', JIRA_CFG);

    const payload = Post.mock.calls[0][2];
    expect(payload.body.content).toHaveLength(3);
    expect(payload.body.content[0].type).toBe('paragraph');
  });
});

describe('GetJiraIssueStatus (US-189)', () => {
  it('returns { ok, status_name } on success', async () => {
    Get.mockResolvedValue({
      ok: true,
      status: 200,
      data: { fields: { status: { name: 'In Progress' } } },
    });

    const result = await GetJiraIssueStatus('SAT-1', JIRA_CFG);
    expect(result).toEqual({ ok: true, status_name: 'In Progress' });
  });

  it('returns { ok: false, error } on HTTP error (US-189)', async () => {
    Get.mockResolvedValue({ ok: false, status: 404, data: {} });
    const result = await GetJiraIssueStatus('SAT-99', JIRA_CFG);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('404');
  });

  it('sends GET to correct URL with status fields (US-189)', async () => {
    Get.mockResolvedValue({ ok: true, status: 200, data: { fields: { status: { name: 'Done' } } } });
    await GetJiraIssueStatus('SAT-5', JIRA_CFG);
    expect(Get).toHaveBeenCalledWith(
      'https://jira.example.com/rest/api/3/issue/SAT-5?fields=status',
      expect.any(Object)
    );
  });

  it('throws INTEGRATION_NOT_CONFIGURED when cfg missing (US-187)', async () => {
    await expect(GetJiraIssueStatus('SAT-1', {})).rejects.toMatchObject({
      extensions: { code: 'INTEGRATION_NOT_CONFIGURED' },
    });
  });
});
