// db/schema.ts
//
// Speevy database schema.
// Source of truth for all DB types — infer from these tables, do not duplicate.
//
// Conventions:
//   - All currency in *_cents columns, bigint.
//   - All timestamps `with timezone`, default `now()`.
//   - Soft "delete" via archived_at / revoked_at / withdrawn_at, never is_deleted.
//   - Enums for status fields; new values via migration only.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  pgSchema,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Reference to Supabase's auth.users table.
// We don't manage this table — Supabase does. We just reference its UUIDs.
// ---------------------------------------------------------------------------
const authSchema = pgSchema('auth');
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
});

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRole = pgEnum('user_role', ['admin', 'lp']);

export const lpStatus = pgEnum('lp_status', [
  'invited',
  'onboarding',
  'pending_review',
  'approved',
  'rejected',
  'removed',
  // People who unlocked a password-protected opportunity via a shared direct
  // link (email + password). Not invited LPs; no auth user. See 0008 migration.
  'outsider',
]);

export const kycStatus = pgEnum('kyc_status', [
  'not_started',
  'in_progress',
  'passed',
  'failed',
  'expired',
]);

export const accreditationStatus = pgEnum('accreditation_status', [
  'not_started',
  'self_attested',
  'third_party_verified',
  'failed',
  'expired',
]);

export const opportunityStatus = pgEnum('opportunity_status', [
  'potential',
  'draft',
  'active',
  'past',
]);

export const interestStatus = pgEnum('interest_status', [
  'indicated',
  'committed',
  'withdrawn',
]);

export const documentType = pgEnum('document_type', [
  'nda',
  'subscription_agreement',
  'accreditation_letter',
  'w9',
  'other',
]);

export const signatureStatus = pgEnum('signature_status', [
  'sent',
  'viewed',
  'signed',
  'declined',
  'expired',
]);

export const auditAction = pgEnum('audit_action', [
  'lp.invited',
  'lp.approved',
  'lp.rejected',
  'lp.removed',
  'lp.document_uploaded',
  'opportunity.created',
  'opportunity.updated',
  'opportunity.status_changed',
  'opportunity.deleted',
  'opportunity.viewed',
  'opportunity.access_granted',
  'opportunity.access_revoked',
  'interest.indicated',
  'interest.committed',
  'interest.withdrawn',
  'nda.sent',
  'nda.signed',
  'nda_template.created',
  'nda_template.updated',
  'nda_template.archived',
  'auth.login',
  'auth.logout',
]);

// ---------------------------------------------------------------------------
// profiles — one row per auth.users row, holds role + display info.
// Created via a trigger when auth.users gets a new row.
// ---------------------------------------------------------------------------
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  role: userRole('role').notNull(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('profiles_email_idx').on(t.email),
}));

// ---------------------------------------------------------------------------
// lps — LP-specific data. One row per LP.
// profile_id is nullable: an LP row can exist after invitation but before
// the LP has accepted and created an auth user.
// ---------------------------------------------------------------------------
export const lps = pgTable('lps', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'restrict' }),

  email: text('email').notNull(),
  fullName: text('full_name'),
  entityName: text('entity_name'),
  phone: text('phone'),

  status: lpStatus('status').notNull().default('invited'),

  kycStatusCol: kycStatus('kyc_status').notNull().default('not_started'),
  kycProvider: text('kyc_provider'),
  kycReference: text('kyc_reference'),
  kycCompletedAt: timestamp('kyc_completed_at', { withTimezone: true }),

  accreditationStatusCol: accreditationStatus('accreditation_status').notNull().default('not_started'),
  accreditationMethod: text('accreditation_method'),
  accreditationVerifiedAt: timestamp('accreditation_verified_at', { withTimezone: true }),
  accreditationExpiresAt: timestamp('accreditation_expires_at', { withTimezone: true }),

  invitedByProfileId: uuid('invited_by_profile_id').references(() => profiles.id),
  invitedAt: timestamp('invited_at', { withTimezone: true }).notNull().defaultNow(),
  invitationAcceptedAt: timestamp('invitation_accepted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedByProfileId: uuid('approved_by_profile_id').references(() => profiles.id),

  sectorsInterested: jsonb('sectors_interested').$type<string[]>().notNull().default([]),
  investmentRangeMinCents: bigint('investment_range_min_cents', { mode: 'number' }),
  investmentRangeMaxCents: bigint('investment_range_max_cents', { mode: 'number' }),
  internalNotes: text('internal_notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('lps_email_idx').on(t.email),
  profileIdx: uniqueIndex('lps_profile_idx').on(t.profileId),
  statusIdx: index('lps_status_idx').on(t.status),
}));

// ---------------------------------------------------------------------------
// lp_documents — documents attached to an LP (general; not per-opportunity).
// ---------------------------------------------------------------------------
export const lpDocuments = pgTable('lp_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  type: documentType('type').notNull(),
  label: text('label').notNull(),
  storageKey: text('storage_key').notNull(),
  uploadedByProfileId: uuid('uploaded_by_profile_id').references(() => profiles.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lpIdx: index('lp_documents_lp_idx').on(t.lpId),
}));

// ---------------------------------------------------------------------------
// opportunities — the deal pages.
// Composition lives in opportunity_sections.
// ---------------------------------------------------------------------------
export const opportunities = pgTable('opportunities', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  companyName: text('company_name').notNull(),
  teaser: text('teaser'),
  opportunitySectors: jsonb('opportunity_sectors').$type<string[]>().notNull().default([]),

  status: opportunityStatus('status').notNull().default('draft'),

  minimumInvestmentCents: bigint('minimum_investment_cents', { mode: 'bigint' }),
  targetAllocationCents: bigint('target_allocation_cents', { mode: 'bigint' }),
  originationFeeCents: bigint('origination_fee_cents', { mode: 'bigint' }),

  stage: text('stage'),
  carryPercentageBasisPoints: integer('carry_percentage_basis_points'),
  managementFeeBasisPoints: integer('management_fee_basis_points'),
  websiteUrl: text('website_url'),
  linkedinUrl: text('linkedin_url'),
  twitterUrl: text('twitter_url'),
  thumbnailStorageKey: text('thumbnail_storage_key'),
  logoStorageKey: text('logo_storage_key'),
  ndaRequired: boolean('nda_required').notNull().default(false),
  // Points at an nda_templates.id (the Speevy-owned NDA catalog). SignatureAPI
  // has no listable hosted-template resource, so the catalog row carries the
  // provider-specific source reference. See docs/nda-gate-design.md §5.2.
  ndaTemplateId: uuid('nda_template_id').references(() => ndaTemplates.id, { onDelete: 'set null' }),
  watermarkEnabled: boolean('watermark_enabled').notNull().default(false),
  passwordProtected: boolean('password_protected').notNull().default(false),

  visibleToAllApprovedLps: boolean('visible_to_all_approved_lps').notNull().default(false),

  createdByProfileId: uuid('created_by_profile_id').notNull().references(() => profiles.id),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: uniqueIndex('opportunities_slug_idx').on(t.slug),
  statusIdx: index('opportunities_status_idx').on(t.status),
}));

// ---------------------------------------------------------------------------
// opportunity_access_passwords — the plaintext shared "gate" password for a
// password-protected opportunity, kept in its own table so it can be isolated
// from LPs at the RLS layer. LPs can SELECT the opportunities row (title,
// teaser) but have NO policy on this table, so the password is never reachable
// by an LP/anon session even via direct PostgREST access. Reads happen only via
// the service-role client (admin editor load + the public gate verification)
// and admin-only Server Actions. This is a shared opportunity-gating secret,
// not a user credential, so it is intentionally stored as retrievable plaintext.
// ---------------------------------------------------------------------------
export const opportunityAccessPasswords = pgTable('opportunity_access_passwords', {
  opportunityId: uuid('opportunity_id')
    .primaryKey()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// opportunity_access_verifications — short-lived email verification codes for
// the password-protected opportunity gate. After a visitor passes the password
// check we email them a 6-digit code and require it before granting access.
//
// Same isolation model as opportunity_access_passwords: RLS enabled + forced
// with an admin-only policy and NO LP/anon policy, so codes are only reachable
// via the service-role client inside the public gate Server Actions. Codes are
// stored HASHED (HMAC), short TTL, single-use, attempt-limited. Only the email
// (the identity we already collect at the gate) is stored here — the visitor's
// name is never persisted in this table.
// ---------------------------------------------------------------------------
export const opportunityAccessVerifications = pgTable('opportunity_access_verifications', {
  opportunityId: uuid('opportunity_id')
    .notNull()
    .references(() => opportunities.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.opportunityId, t.email] }),
}));

// ---------------------------------------------------------------------------
// gate_rate_limits — generic windowed counters used to throttle abuse of the
// public, unauthenticated opportunity password gate. One row per bucket
// (e.g. password attempts per IP+slug, code issuances per email or per IP).
//
// Same isolation model as the other gate tables: RLS enabled + forced with an
// admin-only policy and NO LP/anon policy, so counters are only reachable via
// the service-role client (inside the gate Server Actions). Increments go
// through the atomic `public.increment_gate_rate_limit` SQL function so
// concurrent serverless invocations count safely; `expires_at` defines the
// rolling window so stale rows are naturally ignored without a cleanup job.
// No PII is stored here — bucket keys are coarse identifiers (IP, slug, email).
// ---------------------------------------------------------------------------
export const gateRateLimits = pgTable('gate_rate_limits', {
  bucketKey: text('bucket_key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  count: integer('count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// opportunity_sections — composable section components for each opportunity.
// `type` matches the section registry. `data` is Zod-validated JSON whose
// shape depends on `type`. `position` is integer; reorder-on-write at our
// volume (switch to fractional indexing only if it ever matters).
// ---------------------------------------------------------------------------
export const opportunitySections = pgTable('opportunity_sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  position: integer('position').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  opportunityPositionIdx: index('opportunity_sections_opportunity_position_idx')
    .on(t.opportunityId, t.position),
}));

// ---------------------------------------------------------------------------
// opportunity_access — per-LP visibility grants when not visible-to-all.
// Soft revoke: revoked_at IS NULL means active.
// ---------------------------------------------------------------------------
export const opportunityAccess = pgTable('opportunity_access', {
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  grantedByProfileId: uuid('granted_by_profile_id').notNull().references(() => profiles.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.opportunityId, t.lpId] }),
  lpIdx: index('opportunity_access_lp_idx').on(t.lpId),
}));

// ---------------------------------------------------------------------------
// nda_templates — Speevy-owned catalog of reusable NDA documents.
//
// SignatureAPI exposes no listable hosted-template resource: an NDA is reused
// via a DOCX/PDF source file the admin uploads to the SignatureAPI Library
// (referenced by a stable URL) with {{merge}} / [[place]] markers. Speevy owns
// this catalog so the opportunity editor dropdown has something to list, and so
// historical opportunity_ndas stay attributable to the exact NDA that was
// signed. Admin-managed only; LPs never read it. Soft-disable via archived_at
// (never hard delete — preserve attribution). See docs/nda-gate-design.md §5.3.
// ---------------------------------------------------------------------------
export const ndaTemplates = pgTable('nda_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  signatureProvider: text('signature_provider').notNull().default('signatureapi'),
  // SignatureAPI Library file URL (or stored-upload reference).
  sourceFileUrl: text('source_file_url').notNull(),
  // {{merge}} fields + [[place]] positions / recipient roles config.
  fieldsConfig: jsonb('fields_config').notNull().default({}),
  version: integer('version').notNull().default(1),
  // Designates THE standard account-level NDA template (one row per investor
  // signs it once). A partial unique index (see migration) keeps at most one
  // active (archived_at IS NULL) row with is_account_default = true.
  // See docs/nda-gate-design.md §4B.3.
  isAccountDefault: boolean('is_account_default').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdByProfileId: uuid('created_by_profile_id').notNull().references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  activeIdx: index('nda_templates_active_idx').on(t.archivedAt),
}));

// ---------------------------------------------------------------------------
// opportunity_ndas — NDA signatures tied to a specific opportunity.
// Required gate for viewing opportunity_sections when nda_required = true.
// ---------------------------------------------------------------------------
export const opportunityNdas = pgTable('opportunity_ndas', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  signatureProvider: text('signature_provider').notNull().default('signatureapi'),
  envelopeId: text('envelope_id').notNull(),
  status: signatureStatus('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  signedDocumentStorageKey: text('signed_document_storage_key'),
}, (t) => ({
  uniqOpportunityLp: uniqueIndex('opportunity_ndas_opp_lp_idx').on(t.opportunityId, t.lpId),
  envelopeIdx: uniqueIndex('opportunity_ndas_envelope_idx').on(t.envelopeId),
}));

// ---------------------------------------------------------------------------
// account_ndas — the single account-level NDA signed ONCE per investor
// (insiders and outsiders). Parallel to opportunity_ndas, but unique per LP.
//
// IMPORTANT: this is an INFORMATIONAL status/badge only. It is NOT part of any
// RLS gate — do not add it to the opportunity_sections policy. The only
// automatic NDA gate remains the per-opportunity NDA (opportunity_ndas). A
// future hard-gate option is preserved in docs/nda-gate-design.md §4B.9.
//
// Writes are service-role only (the SignatureAPI webhook + the onboarding
// server action), exactly like opportunity_ndas; RLS allows admin read + LP
// read-own. See docs/nda-gate-design.md §4B.3.
// ---------------------------------------------------------------------------
export const accountNdas = pgTable('account_ndas', {
  id: uuid('id').primaryKey().defaultRandom(),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  // Which standard NDA template was signed; kept so historical signatures stay
  // attributable across template versions.
  ndaTemplateId: uuid('nda_template_id').notNull().references(() => ndaTemplates.id),
  signatureProvider: text('signature_provider').notNull().default('signatureapi'),
  envelopeId: text('envelope_id').notNull(),
  status: signatureStatus('status').notNull().default('sent'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  declinedAt: timestamp('declined_at', { withTimezone: true }),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  signedDocumentStorageKey: text('signed_document_storage_key'),
  // Idempotency: last processed provider event id (the nda_webhook_events table
  // is the primary anchor; this is a convenience denormalization).
  lastWebhookEventId: text('last_webhook_event_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  lpIdx: uniqueIndex('account_ndas_lp_idx').on(t.lpId),
  envelopeIdx: uniqueIndex('account_ndas_envelope_idx').on(t.envelopeId),
}));

// ---------------------------------------------------------------------------
// nda_webhook_events — idempotency anchor for NDA signature webhooks.
//
// Primary v1 job: dedupe provider webhook deliveries on
// (provider, provider_event_id) so replays/out-of-order deliveries are safe.
// raw_payload stores the minimum needed for support/reconciliation and is
// admin-read only (never surfaced to analytics; scrub PII before any log).
// See docs/nda-gate-design.md §5.3.
// ---------------------------------------------------------------------------
export const ndaWebhookEvents = pgTable('nda_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  providerEventId: text('provider_event_id'),
  eventType: text('event_type'),
  // Whichever tier the event resolved to (one will be null).
  accountNdaId: uuid('account_nda_id').references(() => accountNdas.id, { onDelete: 'set null' }),
  opportunityNdaId: uuid('opportunity_nda_id').references(() => opportunityNdas.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('received'),
  rawPayload: jsonb('raw_payload'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  providerEventIdx: uniqueIndex('nda_webhook_events_provider_event_idx').on(t.provider, t.providerEventId),
}));

// ---------------------------------------------------------------------------
// interests — LP interest in an opportunity.
// One row per LP per opportunity, transitioning through statuses.
// ---------------------------------------------------------------------------
export const interests = pgTable('interests', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  status: interestStatus('status').notNull().default('indicated'),
  amountCents: bigint('amount_cents', { mode: 'bigint' }),
  notes: text('notes'),
  indicatedAt: timestamp('indicated_at', { withTimezone: true }).notNull().defaultNow(),
  committedAt: timestamp('committed_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
}, (t) => ({
  uniqOpportunityLp: uniqueIndex('interests_opp_lp_idx').on(t.opportunityId, t.lpId),
  opportunityIdx: index('interests_opportunity_idx').on(t.opportunityId),
}));

// ---------------------------------------------------------------------------
// audit_log — append-only.
// All writes via service role. No update/delete ever.
// ---------------------------------------------------------------------------
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorProfileId: uuid('actor_profile_id').references(() => profiles.id),
  actorRole: userRole('actor_role'),
  action: auditAction('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  diff: jsonb('diff'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  actorIdx: index('audit_log_actor_idx').on(t.actorProfileId),
  entityIdx: index('audit_log_entity_idx').on(t.entityType, t.entityId),
  createdAtIdx: index('audit_log_created_at_idx').on(t.createdAt),
}));

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const profilesRelations = relations(profiles, ({ one }) => ({
  lp: one(lps, { fields: [profiles.id], references: [lps.profileId] }),
}));

export const lpsRelations = relations(lps, ({ one, many }) => ({
  profile: one(profiles, { fields: [lps.profileId], references: [profiles.id] }),
  documents: many(lpDocuments),
  access: many(opportunityAccess),
  interests: many(interests),
  ndas: many(opportunityNdas),
  accountNda: one(accountNdas, { fields: [lps.id], references: [accountNdas.lpId] }),
}));

export const accountNdasRelations = relations(accountNdas, ({ one }) => ({
  lp: one(lps, { fields: [accountNdas.lpId], references: [lps.id] }),
  ndaTemplate: one(ndaTemplates, { fields: [accountNdas.ndaTemplateId], references: [ndaTemplates.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  createdBy: one(profiles, { fields: [opportunities.createdByProfileId], references: [profiles.id] }),
  ndaTemplate: one(ndaTemplates, { fields: [opportunities.ndaTemplateId], references: [ndaTemplates.id] }),
  sections: many(opportunitySections),
  access: many(opportunityAccess),
  ndas: many(opportunityNdas),
  interests: many(interests),
}));

export const ndaTemplatesRelations = relations(ndaTemplates, ({ one, many }) => ({
  createdBy: one(profiles, { fields: [ndaTemplates.createdByProfileId], references: [profiles.id] }),
  opportunities: many(opportunities),
  accountNdas: many(accountNdas),
}));

export const opportunitySectionsRelations = relations(opportunitySections, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunitySections.opportunityId],
    references: [opportunities.id],
  }),
}));
