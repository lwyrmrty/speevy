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
  'upcoming',
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

  status: opportunityStatus('status').notNull().default('potential'),

  minimumInvestmentCents: bigint('minimum_investment_cents', { mode: 'bigint' }),
  targetAllocationCents: bigint('target_allocation_cents', { mode: 'bigint' }),

  ndaRequired: boolean('nda_required').notNull().default(false),
  ndaTemplateId: text('nda_template_id'),

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
// opportunity_ndas — NDA signatures tied to a specific opportunity.
// Required gate for viewing opportunity_sections when nda_required = true.
// ---------------------------------------------------------------------------
export const opportunityNdas = pgTable('opportunity_ndas', {
  id: uuid('id').primaryKey().defaultRandom(),
  opportunityId: uuid('opportunity_id').notNull().references(() => opportunities.id, { onDelete: 'cascade' }),
  lpId: uuid('lp_id').notNull().references(() => lps.id, { onDelete: 'cascade' }),
  signatureProvider: text('signature_provider').notNull().default('dropbox_sign'),
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
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  createdBy: one(profiles, { fields: [opportunities.createdByProfileId], references: [profiles.id] }),
  sections: many(opportunitySections),
  access: many(opportunityAccess),
  ndas: many(opportunityNdas),
  interests: many(interests),
}));

export const opportunitySectionsRelations = relations(opportunitySections, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [opportunitySections.opportunityId],
    references: [opportunities.id],
  }),
}));
