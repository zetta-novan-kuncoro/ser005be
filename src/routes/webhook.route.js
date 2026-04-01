// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const express = require('express');
const crypto = require('crypto');

// *************** IMPORT MODULE ***************
const config = require('../core/config');
const EvolutionRequestModel = require('../features/evolution_request/evolution_requests/evolution_request.model');
const { UpdateEvolutionRequestStatus } = require('../features/evolution_request/evolution_requests/evolution_request.helper');
const { AppendErrorLog } = require('../features/error_log/error_logs/error_log.helper');
const { AppendWebhookLog } = require('../features/webhook_log/webhook_logs/webhook_log.helper');

// *************** VARIABLES ***************
const router = express.Router();

const JIRA_TO_SERVICE_STATUS = {
  'PRET A DEVELOPER':           'Ready for Development',
  'EN COURS DE DEVELOPPEMENT':  'In Development',
  'TEST ET RECETTES':           'Testing & UAT',
  'LANCEMENT':                  'Release',
  'TERMINE':                    'Release',
};

// *************** FUNCTIONS ***************
/**
 * Verifies the X-Hub-Signature header using HMAC-SHA256.
 *
 * @param {string} secret - The webhook secret
 * @param {Buffer} rawBody - Raw request body buffer
 * @param {string} signatureHeader - Value of X-Hub-Signature header
 * @returns {boolean}
 */
function VerifyHmacSignature(secret, rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const [algo, signature] = signatureHeader.split('=');
  if (algo !== 'sha256' || !signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch (_) {
    return false;
  }
}

// *************** ROUTES ***************
/**
 * POST /webhooks/jira
 * Receives JIRA issue update webhooks.
 * Verifies X-Hub-Signature HMAC-SHA256, then mirrors JIRA status onto the matching
 * evolution request and optionally auto-advances it to 'Ready for Development'.
 * Every request — success or failure — is recorded in webhook_logs via the finally block.
 */
router.post(
  '/jira',
  // Capture raw body for HMAC verification before any JSON parsing
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const receivedAt = new Date().toISOString();
    const startMs = Date.now();
    const rawBody = req.body;

    // Mutable log state — mutated before each return path, read in finally
    let httpResponseStatus = 200;
    let processingStatus = 'PROCESSED';
    let processingNote = null;
    let issueKey = null;
    let entityId = null;
    let resolvedStatus = null;
    let autoAdvanceAttempted = false;
    let autoAdvanceSucceeded = null;
    let payloadSummary = null;
    let errorCode = null;
    let errorMessage = null;

    const signaturePresent = Boolean(req.headers['x-hub-signature']);
    let signatureValid = false;

    try {
      // Phase 1 — signature verification
      if (config.jira.webhookSecret) {
        signatureValid = VerifyHmacSignature(config.jira.webhookSecret, rawBody, req.headers['x-hub-signature'] || '');
        if (!signatureValid) {
          processingStatus = 'SIGNATURE_REJECTED';
          processingNote = 'HMAC-SHA256 signature verification failed.';
          httpResponseStatus = 401;
          return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature.' });
        }
      } else {
        signatureValid = true;
      }

      // Phase 2 — JSON parse
      let payload;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (_parseErr) {
        processingStatus = 'PARSE_FAILED';
        processingNote = 'Body is not valid JSON.';
        httpResponseStatus = 400;
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid JSON payload.' });
      }

      // Phase 3 — extract business data
      issueKey = payload?.issue?.key || null;
      const changelogItems = payload?.changelog?.items || [];
      payloadSummary = {
        event_type: payload?.webhookEvent || null,
        issue_key: issueKey,
        project_key: payload?.issue?.fields?.project?.key || null,
        status_from: null,
        status_to: null,
      };

      if (!issueKey) {
        processingStatus = 'IGNORED';
        processingNote = 'No issue key in payload.';
        return res.status(200).json({ ok: true, message: 'No issue key — ignored.' });
      }

      // Filter for status field changes only
      const statusItem = changelogItems.find((item) => item.field === 'status');
      if (!statusItem) {
        processingStatus = 'IGNORED';
        processingNote = 'No status field in changelog items.';
        return res.status(200).json({ ok: true, message: 'No status change — ignored.' });
      }

      const newStatusName = statusItem.toString || statusItem.toValue || null;
      payloadSummary.status_from = statusItem.fromString || statusItem.fromValue || null;
      payloadSummary.status_to = newStatusName;

      if (!newStatusName) {
        processingStatus = 'IGNORED';
        processingNote = 'Status change item has no target value.';
        return res.status(200).json({ ok: true, message: 'Status change has no target value — ignored.' });
      }

      // Phase 4 — entity lookup + mirror update + auto-advance
      const record = await EvolutionRequestModel.findOne({ jira_issue_key: issueKey }).lean();
      if (!record) {
        processingStatus = 'IGNORED';
        processingNote = `No evolution request found for JIRA key '${issueKey}'.`;
        return res.status(200).json({ ok: true, message: `No evolution request found for JIRA key '${issueKey}' — ignored.` });
      }

      entityId = record.request_id;
      const now = new Date().toISOString();

      // Update jira_status_mirror only — never canonical status
      await EvolutionRequestModel.findOneAndUpdate(
        { jira_issue_key: issueKey },
        {
          $set: {
            jira_status_mirror: newStatusName,
            jira_status_mirrored_at: now,
          },
        }
      );

      resolvedStatus = newStatusName;

      // Auto-advance: map JIRA status to a service status and attempt a forward transition
      const normalizedJiraStatus = newStatusName.toUpperCase().trim();
      const targetServiceStatus = JIRA_TO_SERVICE_STATUS[normalizedJiraStatus];

      if (targetServiceStatus) {
        const WEBHOOK_DELIVERY_TRANSITIONS = {
          Approved: ['Ready for Development'],
          'Ready for Development': ['In Development'],
          'In Development': ['Testing & UAT'],
          'Testing & UAT': ['Ready for Development', 'Release'],
        };
        const allowedTargets = WEBHOOK_DELIVERY_TRANSITIONS[record.status];
        const isValidForward = allowedTargets && allowedTargets.includes(targetServiceStatus);

        if (isValidForward) {
          autoAdvanceAttempted = true;
          try {
            await UpdateEvolutionRequestStatus(
              record.request_id,
              targetServiceStatus,
              null, // actor_id — system-driven
              { skipJiraGate: true }
            );
            autoAdvanceSucceeded = true;
          } catch (advanceErr) {
            autoAdvanceSucceeded = false;
            // Auto-advance failure should not break the webhook response
            console.error('[Webhook/JIRA] Auto-advance failed:', advanceErr.message);
            try {
              await AppendErrorLog({
                error_code: advanceErr.extensions?.code || 'AUTO_ADVANCE_FAILED',
                error_message: advanceErr.message || 'Failed to auto-advance evolution request status',
                source: 'System',
                entity_type: 'EvolutionRequest',
                entity_id: record.request_id,
                actor_type: 'System',
                actor_id: null,
                metadata: { request_id: record.request_id, jira_issue_key: issueKey, jira_status: newStatusName, target_status: targetServiceStatus },
              });
            } catch (_logErr) {
              // ignore secondary logging failure
            }
          }
        }
      }

      return res.status(200).json({ ok: true });

    } catch (err) {
      processingStatus = 'FAILED';
      errorCode = 'WEBHOOK_ERROR';
      errorMessage = err.message || 'Unknown webhook error';
      // Keep httpResponseStatus = 200 to prevent Jira retry storms
      console.error('[Webhook/JIRA] Unhandled error:', err);

      try {
        await AppendErrorLog({
          error_code: 'WEBHOOK_ERROR',
          error_message: err.message || 'Unknown webhook error',
          source: 'JIRA',
          entity_type: null,
          entity_id: null,
          actor_type: 'System',
          actor_id: null,
          metadata: { path: req.path },
        });
      } catch (_logErr) {
        // ignore
      }

      return res.status(200).json({ ok: true });

    } finally {
      // Always write webhook log — wrapped so DB failure never affects the sent response
      try {
        await AppendWebhookLog({
          source: 'JIRA',
          received_at: receivedAt,
          route: req.path,
          remote_ip: req.ip || req.socket?.remoteAddress || null,
          content_type: req.headers['content-type'] || null,
          payload_size_bytes: Buffer.isBuffer(rawBody) ? rawBody.length : null,
          signature_present: signaturePresent,
          signature_valid: signatureValid,
          processing_status: processingStatus,
          processing_note: processingNote,
          issue_key: issueKey,
          entity_type: entityId ? 'EvolutionRequest' : null,
          entity_id: entityId,
          resolved_status: resolvedStatus,
          auto_advance_attempted: autoAdvanceAttempted,
          auto_advance_succeeded: autoAdvanceSucceeded,
          payload_summary: payloadSummary,
          error_code: errorCode,
          error_message: errorMessage,
          duration_ms: Date.now() - startMs,
          http_response_status: httpResponseStatus,
        });
      } catch (_logErr) {
        console.error('[Webhook/JIRA] Failed to write webhook_log:', _logErr.message);
      }
    }
  }
);

// *************** EXPORT MODULE ***************
module.exports = router;
