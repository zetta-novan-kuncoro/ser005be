// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { Post } = require('../../../utils/http.util');
const { ApolloError } = require('apollo-server-errors');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Creates a YouTrack issue for an evolution request. Best-effort — returns
 * { ok: false, error } on failure rather than throwing.
 *
 * @param {Object} evolutionRequest - The evolution request data
 * @param {string} jiraKey - The JIRA issue key already created for this request
 * @param {Object} cfg - The youtrack config slice (config.youtrack)
 * @returns {Promise<{ issue_id?: string, issue_url?: string, ok?: boolean, error?: string }>}
 */
async function CreateYouTrackIssue(evolutionRequest, jiraKey, cfg) {
  if (!cfg || !cfg.baseUrl || !cfg.apiToken || !cfg.projectId) {
    throw new ApolloError(
      'YouTrack integration is not configured. Set YOUTRACK_BASE_URL, YOUTRACK_API_TOKEN, and YOUTRACK_PROJECT_ID.',
      'INTEGRATION_NOT_CONFIGURED'
    );
  }

  try {
    const {
      request_id,
      type,
      priority,
      submitted_by,
      jira_issue_url,
      title,
      expected_date,
    } = evolutionRequest;

    const summary = `[${jiraKey}] ${title}`;

    const descriptionLines = [
      `JIRA: ${jira_issue_url || ''}`,
      `Request ID: ${request_id || ''}`,
      `Type: ${type || ''}`,
      `Priority: ${priority || ''}`,
      `Submitted by: ${submitted_by || ''}`,
    ];

    const dueDate = expected_date ? new Date(expected_date).getTime() : null;

    const customFields = [];

    if (dueDate) {
      customFields.push({
        name: 'Due Date',
        $type: 'DateIssueCustomField',
        value: dueDate,
      });
    }

    const payload = {
      summary,
      description: descriptionLines.join('\n'),
      project: { id: cfg.projectId },
      customFields,
    };

    const headers = {
      Authorization: `Bearer ${cfg.apiToken}`,
      Accept: 'application/json',
    };

    const baseUrl = cfg.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/api/issues?fields=id,idReadable,url`;
    const result = await Post(url, headers, payload);

    if (!result.ok) {
      const detail = result.data && typeof result.data === 'object'
        ? JSON.stringify(result.data)
        : String(result.data);
      return { ok: false, error: `YouTrack issue creation failed (HTTP ${result.status}): ${detail}` };
    }

    const issueId = result.data.idReadable || result.data.id;
    const issueUrl = result.data.url || `${cfg.baseUrl}/issue/${issueId}`;

    return { issue_id: issueId, issue_url: issueUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// *************** EXPORT MODULE ***************
module.exports = { CreateYouTrackIssue };
