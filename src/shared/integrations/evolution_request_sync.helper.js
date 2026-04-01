// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************

// *************** IMPORT MODULE ***************
const { CreateJiraIssue } = require('./jira/jira.helper');
const { CreateYouTrackIssue } = require('./youtrack/youtrack.helper');
const { AppendUserLog } = require('../../features/user_log/user_logs/user_log.helper');
const { AppendErrorLog } = require('../../features/error_log/error_logs/error_log.helper');
const EvolutionRequestModel = require('../../features/evolution_request/evolution_requests/evolution_request.model');
const { SerializeDates } = require('../../utils/date.util');

// *************** VARIABLES ***************

// *************** FUNCTIONS ***************
/**
 * Orchestrates the approval integration flow for an evolution request:
 *  1. Persists status=Approved, jira_sync_state=PENDING on the record
 *  2. Attempts JIRA ticket creation — updates jira_sync_state fields (SUCCEEDED or FAILED); never throws
 *  3. Attempts YouTrack ticket creation — updates youtrack_sync_state fields (SUCCEEDED or FAILED); never throws
 *  4. Appends user_log entry
 *  5. Returns the updated serialized record
 *
 * @param {*} request_id - The _id (ObjectId) of the evolution request
 * @param {Object} config - Full application config object
 * @param {string|null} [actor_id=null] - ID of the admin performing the approval
 * @returns {Promise<Object>} Updated evolution request document (serialized)
 */
async function SyncEvolutionRequestOnApproval(request_id, config, actor_id = null) {
  const now = new Date().toISOString();

  // Step 1: Persist Approved + PENDING sync states
  let record = await EvolutionRequestModel.findByIdAndUpdate(
    request_id,
    {
      $set: {
        status: 'Approved',
        jira_sync_state: 'PENDING',
        youtrack_sync_state: 'PENDING',
      },
    },
    { new: true }
  ).lean();

  // Step 2: JIRA ticket creation (best-effort — never throws)
  let jiraUpdate = {};
  try {
    const jiraResult = await CreateJiraIssue(record, config.jira);
    jiraUpdate = {
      jira_sync_state: 'SUCCEEDED',
      jira_issue_key: jiraResult.issue_key,
      jira_issue_url: jiraResult.issue_url,
      jira_last_attempt_at: now,
    };
  } catch (err) {
    const errMsg = err.message || 'Unknown JIRA error';
    const errCode = err.code || 'JIRA_ERROR';
    jiraUpdate = {
      jira_sync_state: 'FAILED',
      jira_last_error_code: errCode,
      jira_last_error_message: errMsg,
      jira_last_attempt_at: now,
    };
    try {
      await AppendErrorLog({
        error_code: errCode,
        error_message: errMsg,
        source: 'JIRA',
        entity_type: 'EvolutionRequest',
        entity_id: record.request_id,
        actor_type: 'System',
        actor_id: null,
        metadata: { request_id: record.request_id },
      });
    } catch (_logErr) {
      // error_log failure must not block the flow
    }
  }

  record = await EvolutionRequestModel.findByIdAndUpdate(request_id, { $set: jiraUpdate }, { new: true }).lean();

  // Step 3: YouTrack ticket creation (best-effort — never throws)
  let ytUpdate = {};
  try {
    const ytResult = await CreateYouTrackIssue(
      {
        ...record,
        jira_issue_url: record.jira_issue_url,
      },
      record.jira_issue_key,
      config.youtrack
    );

    if (ytResult.issue_id) {
      ytUpdate = {
        youtrack_sync_state: 'SUCCEEDED',
        youtrack_issue_id: ytResult.issue_id,
        youtrack_issue_url: ytResult.issue_url,
        youtrack_last_attempt_at: now,
      };
    } else {
      const ytErrMsg = ytResult.error || 'Unknown YouTrack error';
      ytUpdate = {
        youtrack_sync_state: 'FAILED',
        youtrack_last_error_code: 'YOUTRACK_ERROR',
        youtrack_last_error_message: ytErrMsg,
        youtrack_last_attempt_at: now,
      };
      try {
        await AppendErrorLog({
          error_code: 'YOUTRACK_ERROR',
          error_message: ytErrMsg,
          source: 'YouTrack',
          entity_type: 'EvolutionRequest',
          entity_id: record.request_id,
          actor_type: 'System',
          actor_id: null,
          metadata: { request_id: record.request_id },
        });
      } catch (_logErr) {
        // error_log failure must not block the flow
      }
    }
  } catch (err) {
    const ytErrCode = err.code || 'YOUTRACK_ERROR';
    const ytErrMsg = err.message || 'Unknown YouTrack error';
    ytUpdate = {
      youtrack_sync_state: 'FAILED',
      youtrack_last_error_code: ytErrCode,
      youtrack_last_error_message: ytErrMsg,
      youtrack_last_attempt_at: now,
    };
    try {
      await AppendErrorLog({
        error_code: ytErrCode,
        error_message: ytErrMsg,
        source: 'YouTrack',
        entity_type: 'EvolutionRequest',
        entity_id: record.request_id,
        actor_type: 'System',
        actor_id: null,
        metadata: { request_id: record.request_id },
      });
    } catch (_logErr) {
      // error_log failure must not block the flow
    }
  }

  record = await EvolutionRequestModel.findByIdAndUpdate(request_id, { $set: ytUpdate }, { new: true }).lean();

  // Step 4: Append user_log
  try {
    await AppendUserLog({
      application_reference: record.application_reference,
      actor_type: 'Admin',
      actor_id: actor_id || null,
      actor_label: 'Admin',
      action: 'APPROVE_EVOLUTION_REQUEST',
      entity_type: 'EvolutionRequest',
      entity_id: record.request_id,
      before_state: { status: 'Reviewed' },
      after_state: {
        status: 'Approved',
        jira_sync_state: record.jira_sync_state,
        youtrack_sync_state: record.youtrack_sync_state,
      },
      metadata: {
        jira_issue_key: record.jira_issue_key || null,
        jira_issue_url: record.jira_issue_url || null,
        youtrack_issue_id: record.youtrack_issue_id || null,
      },
    });
  } catch (_logErr) {
    // user_log failure must not block the response
  }

  // Step 5: Return updated serialized record
  return SerializeDates(record);
}

// *************** EXPORT MODULE ***************
module.exports = { SyncEvolutionRequestOnApproval };
