// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// *************** IMPORT MODULE ***************
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../core/config');
const { GenerateApiKey, EncryptApiKey } = require('../utils/crypto.util');

const UserModel = require('../features/auth/users/user.model');
const ApplicationModel = require('../features/application/applications/application.model');
const ApiKeyModel = require('../features/api_key/api_keys/api_key.model');
const ChangelogModel = require('../features/changelog/changelogs/changelog.model');
const EvolutionRequestModel = require('../features/evolution_request/evolution_requests/evolution_request.model');
const RoadmapPhaseModel = require('../features/roadmap/roadmap_phases/roadmap_phase.model');
const DocumentationVersionModel = require('../features/documentation/documentation_versions/documentation_version.model');

// *************** VARIABLES ***************
const BCRYPT_ROUNDS = 12;
const KEY_PREFIX_LENGTH = 8;
const DEFAULT_REFERENCE_DATE = '2026-03-13T09:00:00.000Z';
const STATUS_WITH_SNAPSHOTS = new Set(['Published', 'Deprecated', 'RolledBack']);

// *************** FUNCTIONS ***************
/**
 * Generates a deterministic-looking but fake SHA-256 hex string (64 hex chars).
 *
 * @param {string} seed
 * @returns {string}
 */
function FakeSha256(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

/**
 * Returns an ISO string for a provided date input.
 *
 * @param {string|Date} input
 * @returns {string}
 */
function ToIso(input) {
  return new Date(input).toISOString();
}

/**
 * Returns an ISO string offset by a number of days from a base timestamp.
 *
 * @param {string|Date} base
 * @param {number} offsetDays
 * @returns {string}
 */
function OffsetIso(base, offsetDays) {
  return new Date(new Date(base).getTime() + (offsetDays * 24 * 60 * 60 * 1000)).toISOString();
}

/**
 * Builds immutable snapshot metadata for changelog entries that represent published history.
 *
 * @param {string} entryId
 * @returns {{ immutable_sha256: string, immutable_s3_key: string }}
 */
function BuildImmutableMetadata(entryId) {
  return {
    immutable_sha256: FakeSha256(entryId),
    immutable_s3_key: `changelogs/snapshots/${entryId}.json`,
  };
}

/**
 * Creates changelog records with consistent immutable metadata for non-draft states.
 *
 * @param {Array<Object>} definitions
 * @returns {Array<Object>}
 */
function BuildChangelogRecords(definitions) {
  return definitions.map((definition) => {
    const record = {
      ...definition,
      release_date: ToIso(definition.release_date),
      tickets: definition.tickets || [],
      attachments: definition.attachments || [],
      tags: definition.tags || [],
    };

    if (STATUS_WITH_SNAPSHOTS.has(definition.status)) {
      return {
        ...record,
        tickets: record.tickets.map((ticket) => (
          typeof ticket === 'string'
            ? { ticket_id: ticket, ticket_ref: ticket, ticket_name: '', ticket_url: '' }
            : ticket
        )),
        ...BuildImmutableMetadata(definition.entry_id),
      };
    }

    return {
      ...record,
      tickets: record.tickets.map((ticket) => (
        typeof ticket === 'string'
          ? { ticket_id: ticket, ticket_ref: ticket, ticket_name: '', ticket_url: '' }
          : ticket
      )),
    };
  });
}

/**
 * Returns the static user seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetUserDefinitions() {
  return [
    {
      email: 'admin@changelog.internal',
      password: 'Admin1234!',
      full_name: 'System Administrator',
      role: 'admin',
      assigned_applications: ['admin-hub', 'sat-changelog', 'sat-docs'],
      is_active: true,
    },
    {
      email: 'alice@zettabyte.internal',
      password: 'Alice1234!',
      full_name: 'Alice Dupont',
      role: 'user',
      assigned_applications: ['zetta-hr', 'zetta-recruit'],
      is_active: true,
    },
    {
      email: 'bob@zettabyte.internal',
      password: 'Bob1234!',
      full_name: 'Bob Martin',
      role: 'user',
      assigned_applications: ['zetta-pay', 'zetta-analytics'],
      is_active: true,
    },
    {
      email: 'claire@zettabyte.internal',
      password: 'Claire1234!',
      full_name: 'Claire Nguyen',
      role: 'user',
      assigned_applications: ['zetta-ops', 'zetta-analytics'],
      is_active: true,
    },
    {
      email: 'diego@zettabyte.internal',
      password: 'Diego1234!',
      full_name: 'Diego Alvarez',
      role: 'user',
      assigned_applications: ['admin-hub', 'sat-docs'],
      is_active: true,
    },
    {
      email: 'emma@zettabyte.internal',
      password: 'Emma1234!',
      full_name: 'Emma Li',
      role: 'user',
      assigned_applications: ['zetta-hr', 'zetta-recruit'],
      is_active: true,
    },
    {
      email: 'farid@zettabyte.internal',
      password: 'Farid1234!',
      full_name: 'Farid Rahman',
      role: 'user',
      assigned_applications: ['zetta-pay', 'zetta-ops'],
      is_active: true,
    },
    {
      email: 'grace@zettabyte.internal',
      password: 'Grace1234!',
      full_name: 'Grace Miller',
      role: 'user',
      assigned_applications: ['legacy-portal'],
      is_active: false,
    },
  ];
}

/**
 * Returns the static application seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetApplicationDefinitions() {
  return [
    {
      name: 'ZettaHR',
      reference: 'zetta-hr',
      type: 'COR-A',
      environment: 'prod',
      description: 'Internal HR management system for leave, payroll visibility, and employee lifecycle workflows.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'Alice Dupont', email: 'alice@zettabyte.internal', role: 'Product Owner' },
        { name: 'Emma Li', email: 'emma@zettabyte.internal', role: 'Operations Lead' },
      ],
    },
    {
      name: 'ZettaPay',
      reference: 'zetta-pay',
      type: 'COR-B',
      environment: 'prod',
      description: 'Payroll and compensation platform used by finance and HR teams across regions.',
      active: true,
      tenant_scope: 'tenant-specific',
      owners: [
        { name: 'Bob Martin', email: 'bob@zettabyte.internal', role: 'Tech Lead' },
        { name: 'Farid Rahman', email: 'farid@zettabyte.internal', role: 'Finance Systems Manager' },
      ],
    },
    {
      name: 'Changelog Service',
      reference: 'sat-changelog',
      type: 'SER',
      environment: 'dev',
      description: 'The changelog platform itself, used for admin workflows and embed testing.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'System Administrator', email: 'admin@changelog.internal', role: 'Admin' },
      ],
    },
    {
      name: 'ZettaOps',
      reference: 'zetta-ops',
      type: 'INT-TECH',
      environment: 'staging',
      description: 'Operational tooling for release coordination, observability, and incident workflows.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'Claire Nguyen', email: 'claire@zettabyte.internal', role: 'Engineering Manager' },
        { name: 'Farid Rahman', email: 'farid@zettabyte.internal', role: 'Program Manager' },
      ],
    },
    {
      name: 'ZettaRecruit',
      reference: 'zetta-recruit',
      type: 'COR-A',
      environment: 'prod',
      description: 'Hiring and talent pipeline product for recruiters, interviewers, and candidates.',
      active: true,
      tenant_scope: 'tenant-specific',
      owners: [
        { name: 'Alice Dupont', email: 'alice@zettabyte.internal', role: 'Staffing Product Owner' },
        { name: 'Emma Li', email: 'emma@zettabyte.internal', role: 'Recruiting Operations' },
      ],
    },
    {
      name: 'Admin Hub',
      reference: 'admin-hub',
      type: 'INT-ADMIN',
      environment: 'staging',
      description: 'Back-office administration console for internal operations and tenant support.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'System Administrator', email: 'admin@changelog.internal', role: 'Platform Admin' },
        { name: 'Diego Alvarez', email: 'diego@zettabyte.internal', role: 'Support Lead' },
      ],
    },
    {
      name: 'SAT Docs',
      reference: 'sat-docs',
      type: 'SER',
      environment: 'dev',
      description: 'Documentation build and preview service used for generated customer guides.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'Diego Alvarez', email: 'diego@zettabyte.internal', role: 'Documentation Lead' },
      ],
    },
    {
      name: 'ZettaAnalytics',
      reference: 'zetta-analytics',
      type: 'SAT',
      environment: 'prod',
      description: 'Analytics and reporting workspace for customer adoption, usage trends, and benchmark dashboards.',
      active: true,
      tenant_scope: 'global',
      owners: [
        { name: 'Bob Martin', email: 'bob@zettabyte.internal', role: 'Data Product Lead' },
        { name: 'Claire Nguyen', email: 'claire@zettabyte.internal', role: 'Analytics Engineering' },
      ],
    },
    {
      name: 'Legacy Portal',
      reference: 'legacy-portal',
      type: 'COR-B',
      environment: 'staging',
      description: 'A legacy customer portal retained for archive access and migration support.',
      active: false,
      tenant_scope: 'tenant-specific',
      owners: [
        { name: 'Grace Miller', email: 'grace@zettabyte.internal', role: 'Legacy System Owner' },
      ],
    },
  ];
}

/**
 * Returns the static API key seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetApiKeyDefinitions() {
  return [
    { name: 'ZettaHR Production Widget', application_reference: 'zetta-hr', expires_offset_days: 365, last_used_offset_days: -1, last_used_ip: '10.42.1.18', is_active: true },
    { name: 'ZettaHR Partner Sync', application_reference: 'zetta-hr', expires_offset_days: 120, last_used_offset_days: -17, last_used_ip: '10.42.1.45', is_active: true },
    { name: 'ZettaHR Legacy Migration', application_reference: 'zetta-hr', expires_offset_days: -2, last_used_offset_days: -45, last_used_ip: '10.42.1.99', is_active: false },
    { name: 'ZettaPay Payroll Portal', application_reference: 'zetta-pay', expires_offset_days: 365, last_used_offset_days: -0.25, last_used_ip: '10.55.0.14', is_active: true },
    { name: 'ZettaPay Finance Export', application_reference: 'zetta-pay', expires_offset_days: null, last_used_offset_days: -8, last_used_ip: '10.55.0.42', is_active: true },
    { name: 'ZettaPay Audit Mirror', application_reference: 'zetta-pay', expires_offset_days: -30, last_used_offset_days: -60, last_used_ip: '10.55.0.88', is_active: false },
    { name: 'ZettaOps QA Automation', application_reference: 'zetta-ops', expires_offset_days: 90, last_used_offset_days: -2, last_used_ip: '10.18.4.12', is_active: true },
    { name: 'ZettaOps Release Checklist', application_reference: 'zetta-ops', expires_offset_days: 30, last_used_offset_days: -0.5, last_used_ip: '10.18.4.19', is_active: true },
    { name: 'ZettaRecruit Careers Widget', application_reference: 'zetta-recruit', expires_offset_days: 180, last_used_offset_days: -3, last_used_ip: '10.66.7.11', is_active: true },
    { name: 'ZettaRecruit Partner Sandbox', application_reference: 'zetta-recruit', expires_offset_days: 14, last_used_offset_days: null, last_used_ip: null, is_active: false },
    { name: 'Admin Hub Backoffice', application_reference: 'admin-hub', expires_offset_days: 365, last_used_offset_days: -0.1, last_used_ip: '10.70.1.5', is_active: true },
    { name: 'SAT Docs Preview', application_reference: 'sat-docs', expires_offset_days: null, last_used_offset_days: -4, last_used_ip: '10.11.0.3', is_active: true },
    { name: 'SAT Changelog Local Playground', application_reference: 'sat-changelog', expires_offset_days: 21, last_used_offset_days: -1, last_used_ip: '127.0.0.1', is_active: true },
    { name: 'SAT Changelog CI Smoke Test', application_reference: 'sat-changelog', expires_offset_days: 2, last_used_offset_days: -0.05, last_used_ip: '10.11.0.99', is_active: true },
    { name: 'ZettaAnalytics Customer Feed', application_reference: 'zetta-analytics', expires_offset_days: 180, last_used_offset_days: -6, last_used_ip: '10.81.3.22', is_active: true },
    { name: 'ZettaAnalytics Beta Lab', application_reference: 'zetta-analytics', expires_offset_days: 7, last_used_offset_days: null, last_used_ip: null, is_active: true },
    { name: 'Legacy Portal Archive Readonly', application_reference: 'legacy-portal', expires_offset_days: -180, last_used_offset_days: -200, last_used_ip: '10.90.0.7', is_active: false },
  ];
}

/**
 * Returns the static roadmap phase seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetRoadmapPhaseDefinitions() {
  return [
    { phase_id: 'phase-zetta-hr-stabilization', application_reference: 'zetta-hr', phase_name: 'Stabilization', order: 1, description: 'Regression fixes and release hardening for HR flows.' },
    { phase_id: 'phase-zetta-hr-q2-2026', application_reference: 'zetta-hr', phase_name: 'Q2 2026', order: 2, description: 'Operational workflow improvements scheduled for Q2.' },
    { phase_id: 'phase-zetta-hr-q3-2026', application_reference: 'zetta-hr', phase_name: 'Q3 2026', order: 3, description: 'Larger employee self-service initiatives targeted for Q3.' },
    { phase_id: 'phase-zetta-hr-backlog', application_reference: 'zetta-hr', phase_name: 'Backlog', order: 4, description: 'Items not yet committed to a quarter.' },
    { phase_id: 'phase-zetta-pay-compliance', application_reference: 'zetta-pay', phase_name: 'Compliance', order: 1, description: 'Regional compliance updates and audit readiness.' },
    { phase_id: 'phase-zetta-pay-automation', application_reference: 'zetta-pay', phase_name: 'Automation', order: 2, description: 'High-value automation for payroll approvals and exports.' },
    { phase_id: 'phase-zetta-pay-backlog', application_reference: 'zetta-pay', phase_name: 'Backlog', order: 3, description: 'Future payroll platform ideas and low-priority defects.' },
    { phase_id: 'phase-zetta-recruit-q2-launch', application_reference: 'zetta-recruit', phase_name: 'Q2 Launch', order: 1, description: 'Launch commitments for candidate and recruiter experience.' },
    { phase_id: 'phase-zetta-recruit-q3-ux', application_reference: 'zetta-recruit', phase_name: 'Q3 UX', order: 2, description: 'Usability and throughput improvements for recruiter workflows.' },
    { phase_id: 'phase-zetta-recruit-backlog', application_reference: 'zetta-recruit', phase_name: 'Backlog', order: 3, description: 'Deferred recruiting platform enhancements.' },
    { phase_id: 'phase-zetta-ops-hotfixes', application_reference: 'zetta-ops', phase_name: 'Hotfixes', order: 1, description: 'Immediate operational fixes needed for release readiness.' },
    { phase_id: 'phase-zetta-ops-observability', application_reference: 'zetta-ops', phase_name: 'Observability', order: 2, description: 'Monitoring, retention, and release confidence projects.' },
    { phase_id: 'phase-zetta-ops-backlog', application_reference: 'zetta-ops', phase_name: 'Backlog', order: 3, description: 'Longer-tail operations requests.' },
    { phase_id: 'phase-zetta-analytics-stabilization', application_reference: 'zetta-analytics', phase_name: 'Stabilization', order: 1, description: 'Performance and reliability improvements for analytics dashboards.' },
    { phase_id: 'phase-zetta-analytics-summer-2026', application_reference: 'zetta-analytics', phase_name: 'Summer 2026', order: 2, description: 'Customer-facing analytics feature work scheduled for summer.' },
    { phase_id: 'phase-zetta-analytics-backlog', application_reference: 'zetta-analytics', phase_name: 'Backlog', order: 3, description: 'Exploratory analytics enhancements and backlog items.' },
  ];
}

/**
 * Returns the static changelog seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetChangelogDefinitions() {
  return BuildChangelogRecords([
    {
      entry_id: 'cl-zetta-hr-v2-4-0',
      application_reference: 'zetta-hr',
      version: '2.4.0',
      title: 'Leave Request Automation',
      summary: 'Employees can now submit and track leave requests entirely online.',
      details_md: '## What changed\n\nThe leave request module was rebuilt to support self-service submission, approval routing, and status tracking.',
      change_type: 'Feature',
      impact_scope: 'UI',
      release_date: '2026-02-15T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['leave', 'automation', 'hr'],
      tickets: ['HR-142', 'HR-155'],
      attachments: ['https://assets.example.internal/zetta-hr/release-notes/2.4.0-leave-request.pdf'],
      created_by: 'alice@zettabyte.internal',
      updated_by: 'alice@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-hr-v2-3-1',
      application_reference: 'zetta-hr',
      version: '2.3.1',
      title: 'Payslip Download Fix',
      summary: 'Fixed a bug where payslips failed to download in Firefox.',
      details_md: 'Browser-specific handling for blob responses was corrected and download telemetry was added.',
      change_type: 'Fix',
      impact_scope: 'UI',
      release_date: '2026-01-20T09:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['payslip', 'firefox', 'bugfix'],
      tickets: ['HR-118'],
      created_by: 'emma@zettabyte.internal',
      updated_by: 'emma@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-hr-v2-5-0',
      application_reference: 'zetta-hr',
      version: '2.5.0',
      title: 'Delegated Approval Chains',
      summary: 'Managers will be able to delegate approval responsibility during leave periods.',
      details_md: 'Draft copy for delegated approval flows, backup approvers, and audit-friendly approvals.',
      change_type: 'Feature',
      impact_scope: 'Mixed',
      release_date: '2026-04-18T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['delegation', 'workflow'],
      tickets: ['HR-177', 'HR-181'],
      created_by: 'alice@zettabyte.internal',
      updated_by: 'alice@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-hr-v2-2-4',
      application_reference: 'zetta-hr',
      version: '2.2.4',
      title: 'Legacy Org Chart Export',
      summary: 'Deprecated the old org-chart CSV export in favor of the new reporting pipeline.',
      details_md: 'The legacy export path remains accessible for a transition period but is no longer recommended.',
      change_type: 'Ops',
      impact_scope: 'Data',
      release_date: '2025-12-18T10:00:00Z',
      status: 'Deprecated',
      visibility: 'PublicToCustomers',
      tags: ['deprecation', 'reporting'],
      tickets: ['HR-101'],
      created_by: 'emma@zettabyte.internal',
      updated_by: 'emma@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-pay-v1-2-0',
      application_reference: 'zetta-pay',
      version: '1.2.0',
      title: 'Multi-Currency Support',
      summary: 'ZettaPay now supports EUR, USD, and IDR payroll processing.',
      details_md: 'New currency conversion workflows were added for payroll preparation and reporting.',
      change_type: 'Feature',
      impact_scope: 'API',
      release_date: '2026-03-01T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['currency', 'international'],
      tickets: ['PAY-223', 'PAY-224'],
      created_by: 'bob@zettabyte.internal',
      updated_by: 'bob@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-pay-v1-3-0',
      application_reference: 'zetta-pay',
      version: '1.3.0',
      title: 'Tax Calculation Engine Upgrade',
      summary: 'Upgraded tax engine to support 2026 fiscal rules.',
      details_md: 'Draft rollout notes for regional withholding tables, payroll previews, and validation changes.',
      change_type: 'Compliance',
      impact_scope: 'Data',
      release_date: '2026-03-28T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['tax', 'compliance', '2026'],
      tickets: ['PAY-248'],
      created_by: 'bob@zettabyte.internal',
      updated_by: 'farid@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-pay-v1-1-5',
      application_reference: 'zetta-pay',
      version: '1.1.5',
      title: 'Bulk Approval Import',
      summary: 'Rolled back the bulk approval import due to malformed tenant mappings.',
      details_md: 'The import workflow was reverted after identifying issues with cross-tenant approval routing.',
      change_type: 'Breaking',
      impact_scope: 'Data',
      release_date: '2026-01-12T08:00:00Z',
      status: 'RolledBack',
      visibility: 'InternalOnly',
      tags: ['rollback', 'imports'],
      tickets: ['PAY-198'],
      created_by: 'farid@zettabyte.internal',
      updated_by: 'farid@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-pay-v1-4-0',
      application_reference: 'zetta-pay',
      version: '1.4.0',
      title: 'Approval Queue Performance Pass',
      summary: 'Approval queues now load faster for customers with large payroll batches.',
      details_md: 'Pagination and summary caching were introduced for approval queue dashboards.',
      change_type: 'Performance',
      impact_scope: 'UI',
      release_date: '2026-02-22T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['performance', 'queue'],
      tickets: ['PAY-231'],
      created_by: 'bob@zettabyte.internal',
      updated_by: 'bob@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-recruit-v3-0-0',
      application_reference: 'zetta-recruit',
      version: '3.0.0',
      title: 'Candidate Portal Refresh',
      summary: 'Refreshed candidate portal with new application tracking and interview guidance.',
      details_md: 'Candidate-facing navigation and interview scheduling touchpoints were redesigned.',
      change_type: 'Feature',
      impact_scope: 'UI',
      release_date: '2026-02-05T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['candidate', 'portal'],
      tickets: ['REC-101', 'REC-112'],
      created_by: 'alice@zettabyte.internal',
      updated_by: 'emma@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-recruit-v3-1-0',
      application_reference: 'zetta-recruit',
      version: '3.1.0',
      title: 'Interview Slot Templates',
      summary: 'Draft support for reusable interview slot templates and recruiter handoffs.',
      details_md: 'This release is still in planning while teams validate recruiter configuration needs.',
      change_type: 'Feature',
      impact_scope: 'UI',
      release_date: '2026-04-09T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['scheduling', 'interviews'],
      tickets: ['REC-127'],
      created_by: 'emma@zettabyte.internal',
      updated_by: 'emma@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-recruit-v2-9-2',
      application_reference: 'zetta-recruit',
      version: '2.9.2',
      title: 'Resume Parsing Fix',
      summary: 'Improved parsing accuracy for resumes containing multi-column layouts.',
      details_md: 'Parser fallbacks were added for low-confidence extraction cases and recruiter review.',
      change_type: 'Fix',
      impact_scope: 'Data',
      release_date: '2026-01-08T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['parsing', 'resume'],
      tickets: ['REC-095'],
      created_by: 'alice@zettabyte.internal',
      updated_by: 'alice@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-ops-v0-9-0',
      application_reference: 'zetta-ops',
      version: '0.9.0',
      title: 'Release Calendar Launch',
      summary: 'Introduced the release calendar dashboard for operational planning.',
      details_md: 'Internal release owners can now plan freeze windows and launch readiness in one place.',
      change_type: 'Ops',
      impact_scope: 'UI',
      release_date: '2026-02-10T08:00:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['release', 'calendar'],
      tickets: ['OPS-77'],
      created_by: 'claire@zettabyte.internal',
      updated_by: 'claire@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-ops-v0-9-1',
      application_reference: 'zetta-ops',
      version: '0.9.1',
      title: 'Webhook Signature Hardening',
      summary: 'Strengthened webhook signature validation for downstream automation.',
      details_md: 'Verification now enforces stronger signing and clearer failure logging.',
      change_type: 'Security',
      impact_scope: 'API',
      release_date: '2026-02-27T08:00:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['security', 'webhooks'],
      tickets: ['OPS-83'],
      created_by: 'claire@zettabyte.internal',
      updated_by: 'claire@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-ops-v1-0-0',
      application_reference: 'zetta-ops',
      version: '1.0.0',
      title: 'Observability Workspace',
      summary: 'Draft workspace for cross-service release health and alert routing.',
      details_md: 'Still in planning while teams align on alert ownership and retention.',
      change_type: 'Feature',
      impact_scope: 'Mixed',
      release_date: '2026-04-25T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['observability', 'alerts'],
      tickets: ['OPS-96'],
      created_by: 'claire@zettabyte.internal',
      updated_by: 'farid@zettabyte.internal',
    },
    {
      entry_id: 'cl-admin-hub-v1-8-0',
      application_reference: 'admin-hub',
      version: '1.8.0',
      title: 'Tenant Support Queue',
      summary: 'Added a support queue for back-office tenant requests and escalations.',
      details_md: 'Support teams can now track tenant-specific admin tasks and ownership.',
      change_type: 'Feature',
      impact_scope: 'UI',
      release_date: '2026-01-29T08:00:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['support', 'tenant'],
      tickets: ['ADM-51'],
      created_by: 'admin@changelog.internal',
      updated_by: 'diego@zettabyte.internal',
    },
    {
      entry_id: 'cl-admin-hub-v1-9-0',
      application_reference: 'admin-hub',
      version: '1.9.0',
      title: 'Bulk Access Review',
      summary: 'Draft feature for periodic admin access review and approval workflows.',
      details_md: 'The access review workflow is currently internal-only while legal review continues.',
      change_type: 'Compliance',
      impact_scope: 'Data',
      release_date: '2026-04-03T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['access', 'review'],
      tickets: ['ADM-63'],
      created_by: 'admin@changelog.internal',
      updated_by: 'admin@changelog.internal',
    },
    {
      entry_id: 'cl-zetta-analytics-v4-2-0',
      application_reference: 'zetta-analytics',
      version: '4.2.0',
      title: 'Executive Benchmarks',
      summary: 'Added customer benchmark dashboards for executive reporting.',
      details_md: 'Benchmarks can now be filtered by segment, geography, and adoption maturity.',
      change_type: 'Feature',
      impact_scope: 'Data',
      release_date: '2026-02-14T08:00:00Z',
      status: 'Published',
      visibility: 'PublicToCustomers',
      tags: ['analytics', 'benchmarks'],
      tickets: ['AN-140'],
      created_by: 'bob@zettabyte.internal',
      updated_by: 'claire@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-analytics-v4-3-1',
      application_reference: 'zetta-analytics',
      version: '4.3.1',
      title: 'Warehouse Query Guardrails',
      summary: 'Protected high-cost analytics queries with tighter execution limits.',
      details_md: 'Internal cost-control rules now cap overly expensive ad hoc analytics requests.',
      change_type: 'Performance',
      impact_scope: 'Infra',
      release_date: '2026-03-06T08:00:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['warehouse', 'guardrails'],
      tickets: ['AN-151'],
      created_by: 'claire@zettabyte.internal',
      updated_by: 'claire@zettabyte.internal',
    },
    {
      entry_id: 'cl-zetta-analytics-v4-4-0',
      application_reference: 'zetta-analytics',
      version: '4.4.0',
      title: 'Scheduled Insight Digest',
      summary: 'Draft support for scheduled customer insight emails and stakeholder digests.',
      details_md: 'The team is still validating cadence controls and tenant-level opt-in behavior.',
      change_type: 'Feature',
      impact_scope: 'Mixed',
      release_date: '2026-05-01T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['digest', 'email'],
      tickets: ['AN-164'],
      created_by: 'bob@zettabyte.internal',
      updated_by: 'bob@zettabyte.internal',
    },
    {
      entry_id: 'cl-sat-changelog-v0-8-0',
      application_reference: 'sat-changelog',
      version: '0.8.0',
      title: 'Applications Workspace',
      summary: 'Added the application management workspace for admins.',
      details_md: 'Admins can now browse applications, manage assignments, and inspect API key counts.',
      change_type: 'Feature',
      impact_scope: 'UI',
      release_date: '2026-01-18T08:00:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['admin', 'applications'],
      tickets: ['SAT-88'],
      created_by: 'admin@changelog.internal',
      updated_by: 'admin@changelog.internal',
    },
    {
      entry_id: 'cl-sat-changelog-v0-8-1',
      application_reference: 'sat-changelog',
      version: '0.8.1',
      title: 'Date Serialization Repair',
      summary: 'Normalized backend date output for admin and embed views.',
      details_md: 'Date values are now serialized consistently to parseable ISO strings.',
      change_type: 'Fix',
      impact_scope: 'API',
      release_date: '2026-03-13T08:30:00Z',
      status: 'Published',
      visibility: 'InternalOnly',
      tags: ['graphql', 'dates'],
      tickets: ['SAT-114'],
      created_by: 'admin@changelog.internal',
      updated_by: 'admin@changelog.internal',
    },
    {
      entry_id: 'cl-sat-changelog-v0-9-0',
      application_reference: 'sat-changelog',
      version: '0.9.0',
      title: 'DEV Sandbox Quality Pass',
      summary: 'Draft work on DEV test scenarios, translations, and temporary API-key flows.',
      details_md: 'This release is still being validated and should remain internal until the DEV workflow stabilizes.',
      change_type: 'Ops',
      impact_scope: 'Mixed',
      release_date: '2026-03-25T08:00:00Z',
      status: 'Draft',
      visibility: 'InternalOnly',
      tags: ['dev', 'sandbox'],
      tickets: ['SAT-121'],
      created_by: 'admin@changelog.internal',
      updated_by: 'admin@changelog.internal',
    },
    {
      entry_id: 'cl-legacy-portal-v5-7-9',
      application_reference: 'legacy-portal',
      version: '5.7.9',
      title: 'Readonly Archive Mode',
      summary: 'Legacy Portal is now in readonly archive mode ahead of retirement.',
      details_md: 'The portal remains accessible for historical references but no new workflows are supported.',
      change_type: 'Ops',
      impact_scope: 'UI',
      release_date: '2025-11-21T08:00:00Z',
      status: 'Deprecated',
      visibility: 'PublicToCustomers',
      tags: ['archive', 'legacy'],
      tickets: ['LEG-42'],
      created_by: 'grace@zettabyte.internal',
      updated_by: 'grace@zettabyte.internal',
    },
  ]);
}

/**
 * Returns the static evolution request seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetEvolutionRequestDefinitions() {
  return [
    {
      request_id: 'er-zetta-hr-mobile-offline-approvals',
      application_reference: 'zetta-hr',
      type: 'Evolution',
      title: 'Offline approval inbox for managers',
      description: 'Managers need to review leave approvals from mobile devices with intermittent connectivity.',
      submitted_by: 'Emma Li',
      priority: 1,
      expected_date: ToIso('2026-07-15T00:00:00Z'),
      attachments: ['https://assets.example.internal/requests/hr/offline-approvals-wireframe.pdf'],
      status: 'Approved',
      phase_id: 'phase-zetta-hr-q3-2026',
      submitted_at: new Date('2026-02-11T09:20:00Z'),
    },
    {
      request_id: 'er-zetta-hr-safari-calendar',
      application_reference: 'zetta-hr',
      type: 'Fix',
      title: 'Calendar sync broken on Safari',
      description: 'The HR calendar does not sync correctly on Safari 17+ after daylight-saving changes.',
      submitted_by: 'Alice Dupont',
      priority: 2,
      expected_date: ToIso('2026-03-29T00:00:00Z'),
      attachments: [],
      status: 'Pending',
      phase_id: 'phase-zetta-hr-stabilization',
      submitted_at: new Date('2026-03-01T14:00:00Z'),
    },
    {
      request_id: 'er-zetta-hr-delegated-approvals',
      application_reference: 'zetta-hr',
      type: 'Evolution',
      title: 'Delegated approvals during leave',
      description: 'Approvers need a backup routing option when they are unavailable.',
      submitted_by: 'Alice Dupont',
      priority: 2,
      expected_date: ToIso('2026-05-20T00:00:00Z'),
      attachments: [],
      status: 'Reviewed',
      phase_id: 'phase-zetta-hr-q2-2026',
      submitted_at: new Date('2026-02-18T11:35:00Z'),
    },
    {
      request_id: 'er-zetta-hr-payslip-watermark',
      application_reference: 'zetta-hr',
      type: 'Fix',
      title: 'Payslip watermark overlaps footer',
      description: 'Exported PDF payslips occasionally show the confidentiality watermark over the footer totals.',
      submitted_by: 'Anonymous',
      priority: 3,
      expected_date: null,
      attachments: [],
      status: 'Rejected',
      phase_id: null,
      submitted_at: new Date('2026-01-27T08:10:00Z'),
    },
    {
      request_id: 'er-zetta-pay-bulk-csv',
      application_reference: 'zetta-pay',
      type: 'Evolution',
      title: 'Bulk payroll export to CSV',
      description: 'Finance teams need consistent CSV exports for accounting software imports.',
      submitted_by: 'Bob Martin',
      priority: 2,
      expected_date: ToIso('2026-06-10T00:00:00Z'),
      attachments: ['https://assets.example.internal/requests/payroll/csv-export-template.xlsx'],
      status: 'Reviewed',
      phase_id: 'phase-zetta-pay-automation',
      submitted_at: new Date('2026-02-21T09:45:00Z'),
    },
    {
      request_id: 'er-zetta-pay-idr-symbol',
      application_reference: 'zetta-pay',
      type: 'Fix',
      title: 'IDR currency symbol missing in reports',
      description: 'The Indonesian Rupiah symbol is not rendered in PDF reports for some tenants.',
      submitted_by: 'Farid Rahman',
      priority: 3,
      expected_date: null,
      attachments: [],
      status: 'Pending',
      phase_id: 'phase-zetta-pay-backlog',
      submitted_at: new Date('2026-03-02T07:30:00Z'),
    },
    {
      request_id: 'er-zetta-pay-approval-matrix',
      application_reference: 'zetta-pay',
      type: 'Evolution',
      title: 'Configurable approval matrix',
      description: 'Payroll approvals need matrix-based routing by tenant, region, and amount.',
      submitted_by: 'Farid Rahman',
      priority: 1,
      expected_date: ToIso('2026-07-01T00:00:00Z'),
      attachments: ['https://assets.example.internal/requests/payroll/approval-matrix-notes.docx'],
      status: 'Approved',
      phase_id: 'phase-zetta-pay-automation',
      submitted_at: new Date('2026-02-05T13:12:00Z'),
    },
    {
      request_id: 'er-zetta-pay-audit-encryption',
      application_reference: 'zetta-pay',
      type: 'Fix',
      title: 'Audit exports need stronger encryption labels',
      description: 'Audit packages are missing encryption metadata required by regional partners.',
      submitted_by: 'Anonymous',
      priority: 2,
      expected_date: ToIso('2026-04-11T00:00:00Z'),
      attachments: [],
      status: 'Rejected',
      phase_id: null,
      submitted_at: new Date('2026-01-19T16:55:00Z'),
    },
    {
      request_id: 'er-zetta-recruit-referral-dashboard',
      application_reference: 'zetta-recruit',
      type: 'Evolution',
      title: 'Referral performance dashboard',
      description: 'Recruiters want a dashboard showing referral pipeline performance by team.',
      submitted_by: 'Emma Li',
      priority: 2,
      expected_date: ToIso('2026-06-18T00:00:00Z'),
      attachments: [],
      status: 'Approved',
      phase_id: 'phase-zetta-recruit-q2-launch',
      submitted_at: new Date('2026-02-14T10:00:00Z'),
    },
    {
      request_id: 'er-zetta-recruit-duplicate-merge',
      application_reference: 'zetta-recruit',
      type: 'Fix',
      title: 'Duplicate candidate merge leaves stale interview links',
      description: 'Merged candidate records sometimes keep interview links from the removed profile.',
      submitted_by: 'Alice Dupont',
      priority: 2,
      expected_date: ToIso('2026-04-06T00:00:00Z'),
      attachments: [],
      status: 'Pending',
      phase_id: 'phase-zetta-recruit-backlog',
      submitted_at: new Date('2026-03-04T12:22:00Z'),
    },
    {
      request_id: 'er-zetta-recruit-candidate-sso',
      application_reference: 'zetta-recruit',
      type: 'Evolution',
      title: 'Candidate portal SSO for employee referrals',
      description: 'Employees submitting referrals want direct candidate access without creating a new password.',
      submitted_by: 'Emma Li',
      priority: 2,
      expected_date: ToIso('2026-08-03T00:00:00Z'),
      attachments: [],
      status: 'Reviewed',
      phase_id: 'phase-zetta-recruit-q3-ux',
      submitted_at: new Date('2026-02-25T09:05:00Z'),
    },
    {
      request_id: 'er-zetta-ops-freeze-calendar',
      application_reference: 'zetta-ops',
      type: 'Evolution',
      title: 'Deployment freeze calendar',
      description: 'Release managers need a shared deployment freeze calendar tied to change windows.',
      submitted_by: 'Claire Nguyen',
      priority: 1,
      expected_date: ToIso('2026-05-16T00:00:00Z'),
      attachments: [],
      status: 'Reviewed',
      phase_id: 'phase-zetta-ops-observability',
      submitted_at: new Date('2026-02-02T15:00:00Z'),
    },
    {
      request_id: 'er-zetta-ops-webhook-retries',
      application_reference: 'zetta-ops',
      type: 'Fix',
      title: 'Webhook retries stop after transient DNS failures',
      description: 'Retry logic stops permanently instead of backing off when DNS fails briefly.',
      submitted_by: 'Farid Rahman',
      priority: 1,
      expected_date: ToIso('2026-03-20T00:00:00Z'),
      attachments: [],
      status: 'Pending',
      phase_id: 'phase-zetta-ops-hotfixes',
      submitted_at: new Date('2026-03-08T08:48:00Z'),
    },
    {
      request_id: 'er-zetta-ops-log-retention',
      application_reference: 'zetta-ops',
      type: 'Evolution',
      title: 'Per-service log retention controls',
      description: 'Operations teams want retention controls by service and severity for troubleshooting.',
      submitted_by: 'Claire Nguyen',
      priority: 3,
      expected_date: null,
      attachments: [],
      status: 'Approved',
      phase_id: 'phase-zetta-ops-backlog',
      submitted_at: new Date('2026-01-30T10:40:00Z'),
    },
    {
      request_id: 'er-zetta-analytics-benchmarks',
      application_reference: 'zetta-analytics',
      type: 'Evolution',
      title: 'Tenant benchmark exports',
      description: 'Customer success teams need exportable benchmark views for quarterly business reviews.',
      submitted_by: 'Bob Martin',
      priority: 2,
      expected_date: ToIso('2026-07-10T00:00:00Z'),
      attachments: [],
      status: 'Approved',
      phase_id: 'phase-zetta-analytics-summer-2026',
      submitted_at: new Date('2026-02-12T09:00:00Z'),
    },
    {
      request_id: 'er-zetta-analytics-cohort-export',
      application_reference: 'zetta-analytics',
      type: 'Fix',
      title: 'Broken cohort export for weekly groupings',
      description: 'Weekly cohort exports fail when time zones cross ISO week boundaries.',
      submitted_by: 'Claire Nguyen',
      priority: 2,
      expected_date: ToIso('2026-03-26T00:00:00Z'),
      attachments: [],
      status: 'Pending',
      phase_id: 'phase-zetta-analytics-stabilization',
      submitted_at: new Date('2026-03-07T17:12:00Z'),
    },
    {
      request_id: 'er-zetta-analytics-email-digest',
      application_reference: 'zetta-analytics',
      type: 'Evolution',
      title: 'Scheduled insight digest emails',
      description: 'Executives want weekly insight digests with anomaly callouts and adoption highlights.',
      submitted_by: 'Bob Martin',
      priority: 3,
      expected_date: ToIso('2026-08-15T00:00:00Z'),
      attachments: [],
      status: 'Reviewed',
      phase_id: 'phase-zetta-analytics-backlog',
      submitted_at: new Date('2026-02-28T13:35:00Z'),
    },
    {
      request_id: 'er-sat-changelog-embed-language',
      application_reference: 'sat-changelog',
      type: 'Fix',
      title: 'Embed language switch resets current tab',
      description: 'Switching the embed language resets the current tab selection and loses form progress.',
      submitted_by: 'System Administrator',
      priority: 2,
      expected_date: ToIso('2026-03-21T00:00:00Z'),
      attachments: [],
      status: 'Pending',
      phase_id: null,
      submitted_at: new Date('2026-03-10T11:11:00Z'),
    },
    {
      request_id: 'er-sat-changelog-translation-audit',
      application_reference: 'sat-changelog',
      type: 'Evolution',
      title: 'Translation sync audit trail',
      description: 'Admins want a visible audit trail for translation updates and seed synchronization.',
      submitted_by: 'System Administrator',
      priority: 2,
      expected_date: ToIso('2026-05-30T00:00:00Z'),
      attachments: [],
      status: 'Reviewed',
      phase_id: null,
      submitted_at: new Date('2026-03-09T09:19:00Z'),
    },
  ];
}

/**
 * Returns the static documentation version seed definitions.
 *
 * @returns {Array<Object>}
 */
function GetDocumentationVersionDefinitions() {
  return [
    { document_id: 'doc-zetta-hr-v2-4', version: '2.4', generated_at: ToIso('2026-02-16T08:00:00Z'), s3_key: 'documentation/zetta-hr/zetta-hr-docs-v2.4.pdf', filename: 'zetta-hr-docs-v2.4.pdf', generated_by: 'alice@zettabyte.internal' },
    { document_id: 'doc-zetta-hr-v2-5-draft', version: '2.5-draft', generated_at: ToIso('2026-03-10T09:00:00Z'), s3_key: 'documentation/zetta-hr/zetta-hr-docs-v2.5-draft.pdf', filename: 'zetta-hr-docs-v2.5-draft.pdf', generated_by: 'emma@zettabyte.internal' },
    { document_id: 'doc-zetta-pay-v1-2', version: '1.2', generated_at: ToIso('2026-03-02T08:00:00Z'), s3_key: 'documentation/zetta-pay/zetta-pay-docs-v1.2.pdf', filename: 'zetta-pay-docs-v1.2.pdf', generated_by: 'bob@zettabyte.internal' },
    { document_id: 'doc-zetta-pay-v1-3-draft', version: '1.3-draft', generated_at: ToIso('2026-03-11T07:30:00Z'), s3_key: 'documentation/zetta-pay/zetta-pay-docs-v1.3-draft.pdf', filename: 'zetta-pay-docs-v1.3-draft.pdf', generated_by: 'farid@zettabyte.internal' },
    { document_id: 'doc-zetta-recruit-v3-0', version: '3.0', generated_at: ToIso('2026-02-06T08:00:00Z'), s3_key: 'documentation/zetta-recruit/zetta-recruit-docs-v3.0.pdf', filename: 'zetta-recruit-docs-v3.0.pdf', generated_by: 'emma@zettabyte.internal' },
    { document_id: 'doc-zetta-ops-v0-9', version: '0.9', generated_at: ToIso('2026-02-28T08:15:00Z'), s3_key: 'documentation/zetta-ops/zetta-ops-runbook-v0.9.pdf', filename: 'zetta-ops-runbook-v0.9.pdf', generated_by: 'claire@zettabyte.internal' },
    { document_id: 'doc-admin-hub-v1-8', version: '1.8', generated_at: ToIso('2026-01-30T08:10:00Z'), s3_key: 'documentation/admin-hub/admin-hub-guide-v1.8.pdf', filename: 'admin-hub-guide-v1.8.pdf', generated_by: 'diego@zettabyte.internal' },
    { document_id: 'doc-zetta-analytics-v4-2', version: '4.2', generated_at: ToIso('2026-02-15T08:40:00Z'), s3_key: 'documentation/zetta-analytics/zetta-analytics-playbook-v4.2.pdf', filename: 'zetta-analytics-playbook-v4.2.pdf', generated_by: 'bob@zettabyte.internal' },
    { document_id: 'doc-sat-changelog-v0-8', version: '0.8', generated_at: ToIso('2026-03-13T10:00:00Z'), s3_key: 'documentation/sat-changelog/sat-changelog-admin-guide-v0.8.pdf', filename: 'sat-changelog-admin-guide-v0.8.pdf', generated_by: 'admin@changelog.internal' },
  ];
}

/**
 * Drops all known collections for a clean slate.
 *
 * @returns {Promise<void>}
 */
async function DropCollections() {
  const collections = [
    'users',
    'applications',
    'api_keys',
    'changelogs',
    'evolution_requests',
    'roadmap_phases',
    'documentation_versions',
  ];

  for (const name of collections) {
    try {
      await mongoose.connection.db.dropCollection(name);
      console.log(`  [drop] ${name}`);
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound' && err.message && !err.message.includes('ns not found')) {
        throw err;
      }
      console.log(`  [skip] ${name} (does not exist)`);
    }
  }
}

/**
 * Seeds all users.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedUsers() {
  console.log('\n[seed] Users...');

  const definitions = GetUserDefinitions();

  for (const definition of definitions) {
    const password_hash = await bcrypt.hash(definition.password, BCRYPT_ROUNDS);
    await UserModel.create({
      email: definition.email,
      password_hash,
      full_name: definition.full_name,
      role: definition.role,
      assigned_applications: definition.assigned_applications,
      is_active: definition.is_active,
    });
  }

  console.log(`  Created ${definitions.length} users`);
  return definitions;
}

/**
 * Seeds all applications.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedApplications() {
  console.log('\n[seed] Applications...');

  const definitions = GetApplicationDefinitions();
  await ApplicationModel.insertMany(definitions);

  console.log(`  Created ${definitions.length} applications`);
  return definitions;
}

/**
 * Seeds API keys with varied states for testing list and filter behavior.
 *
 * @returns {Promise<Array<{ name: string, app: string, plainKey: string, is_active: boolean, expires_at: string|null }>>}
 */
async function SeedApiKeys() {
  console.log('\n[seed] API Keys...');

  const definitions = GetApiKeyDefinitions();
  const plaintextKeys = [];

  for (const definition of definitions) {
    const plainKey = GenerateApiKey();
    const encryptedKey = EncryptApiKey(plainKey);
    const keyPrefix = plainKey.slice(0, KEY_PREFIX_LENGTH);
    const expiresAt = definition.expires_offset_days === null
      ? null
      : OffsetIso(DEFAULT_REFERENCE_DATE, definition.expires_offset_days);
    const lastUsed = definition.last_used_offset_days === null
      ? null
      : OffsetIso(DEFAULT_REFERENCE_DATE, definition.last_used_offset_days);

    await ApiKeyModel.create({
      application_reference: definition.application_reference,
      name: definition.name,
      key_purpose: 'default',
      key_prefix: keyPrefix,
      api_key_encrypted: encryptedKey,
      expires_at: expiresAt,
      last_used: lastUsed,
      last_used_ip: definition.last_used_ip,
      is_active: definition.is_active,
    });

    plaintextKeys.push({
      name: definition.name,
      app: definition.application_reference,
      plainKey,
      is_active: definition.is_active,
      expires_at: expiresAt,
    });
  }

  console.log(`  Created ${definitions.length} API keys`);
  return plaintextKeys;
}

/**
 * Seeds roadmap phases across multiple applications.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedRoadmapPhases() {
  console.log('\n[seed] Roadmap Phases...');

  const definitions = GetRoadmapPhaseDefinitions();
  await RoadmapPhaseModel.insertMany(definitions);

  console.log(`  Created ${definitions.length} roadmap phases`);
  return definitions;
}

/**
 * Seeds changelog entries across multiple applications and states.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedChangelogs() {
  console.log('\n[seed] Changelogs...');

  const definitions = GetChangelogDefinitions();
  await ChangelogModel.insertMany(definitions);

  console.log(`  Created ${definitions.length} changelog entries`);
  return definitions;
}

/**
 * Seeds evolution and fix requests across multiple applications and statuses.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedEvolutionRequests() {
  console.log('\n[seed] Evolution Requests...');

  const definitions = GetEvolutionRequestDefinitions();
  await EvolutionRequestModel.insertMany(definitions);

  console.log(`  Created ${definitions.length} evolution requests`);
  return definitions;
}

/**
 * Seeds documentation version entries.
 *
 * @returns {Promise<Array<Object>>}
 */
async function SeedDocumentationVersions() {
  console.log('\n[seed] Documentation Versions...');

  const definitions = GetDocumentationVersionDefinitions();
  await DocumentationVersionModel.insertMany(definitions);

  console.log(`  Created ${definitions.length} documentation versions`);
  return definitions;
}

/**
 * Returns a grouped count object.
 *
 * @param {Array<Object>} records
 * @param {string} key
 * @returns {Object<string, number>}
 */
function CountBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] || '(none)';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Prints grouped counts in a single line.
 *
 * @param {string} title
 * @param {Object<string, number>} groups
 */
function PrintGroupLine(title, groups) {
  const formatted = Object.entries(groups)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => `${name}: ${count}`)
    .join(', ');
  console.log(`  ${title}: ${formatted}`);
}

/**
 * Prints the final seeding summary.
 *
 * @param {Object} summary
 * @returns {void}
 */
function PrintSummary(summary) {
  console.log('\n================================================================');
  console.log('SEED COMPLETE - SUMMARY');
  console.log('================================================================');

  console.log(`\nUsers: ${summary.users.length}`);
  summary.users.forEach((user) => {
    console.log(`  ${user.role.padEnd(5)} ${user.email.padEnd(30)} ${user.password.padEnd(12)} active=${user.is_active}`);
  });

  console.log(`\nApplications: ${summary.applications.length}`);
  summary.applications.forEach((application) => {
    console.log(`  ${application.reference.padEnd(16)} ${application.environment.padEnd(7)} ${application.type.padEnd(9)} active=${application.active}`);
  });

  console.log(`\nAPI Keys: ${summary.apiKeys.length}`);
  console.log('  IMPORTANT: These plain-text keys will NOT be retrievable later.');
  summary.apiKeys.forEach((apiKey) => {
    console.log(`  ${apiKey.app.padEnd(16)} ${apiKey.name}`);
    console.log(`    active=${apiKey.is_active} expires_at=${apiKey.expires_at || 'never'}`);
    console.log(`    ${apiKey.plainKey}`);
  });

  console.log(`\nChangelogs: ${summary.changelogs.length}`);
  PrintGroupLine('By application', CountBy(summary.changelogs, 'application_reference'));
  PrintGroupLine('By status', CountBy(summary.changelogs, 'status'));

  console.log(`\nEvolution Requests: ${summary.evolutionRequests.length}`);
  PrintGroupLine('By application', CountBy(summary.evolutionRequests, 'application_reference'));
  PrintGroupLine('By status', CountBy(summary.evolutionRequests, 'status'));

  console.log(`\nRoadmap Phases: ${summary.roadmapPhases.length}`);
  PrintGroupLine('By application', CountBy(summary.roadmapPhases, 'application_reference'));

  console.log('\nTranslations: seeded separately via seed:translations');

  console.log(`\nDocumentation Versions: ${summary.documentationVersions.length}`);
  summary.documentationVersions.forEach((document) => {
    console.log(`  ${document.version.padEnd(12)} ${document.filename}`);
  });

  console.log('\n================================================================\n');
}

/**
 * Main seed runner - connects, drops, seeds, disconnects.
 *
 * @returns {Promise<void>}
 */
async function SeedData() {
  console.log('[SeedData] Connecting to MongoDB at:', config.mongo.uri);
  await mongoose.connect(config.mongo.uri);
  console.log('[SeedData] Connected.\n');

  try {
    console.log('[SeedData] Dropping existing collections...');
    await DropCollections();

    const users = await SeedUsers();
    const applications = await SeedApplications();
    const apiKeys = await SeedApiKeys();
    const roadmapPhases = await SeedRoadmapPhases();
    const changelogs = await SeedChangelogs();
    const evolutionRequests = await SeedEvolutionRequests();
    const documentationVersions = await SeedDocumentationVersions();

    PrintSummary({
      users,
      applications,
      apiKeys,
      roadmapPhases,
      changelogs,
      evolutionRequests,
      documentationVersions,
    });
  } finally {
    await mongoose.disconnect();
    console.log('[SeedData] Disconnected.');
  }
}

// *************** EXPORT MODULE ***************
module.exports = {
  SeedData,
  GetUserDefinitions,
  GetApplicationDefinitions,
  GetApiKeyDefinitions,
  GetRoadmapPhaseDefinitions,
  GetChangelogDefinitions,
  GetEvolutionRequestDefinitions,
  GetDocumentationVersionDefinitions,
};

if (require.main === module) {
  SeedData().catch((err) => {
    console.error('[SeedData] Fatal error:', err);
    process.exit(1);
  });
}
