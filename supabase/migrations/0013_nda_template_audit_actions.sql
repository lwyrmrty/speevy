-- ============================================================================
-- audit_action: add nda_template.* values
-- Admin writes to the new nda_templates catalog (create / update / archive)
-- write an audit_log row, mirroring the audit posture for other admin writes.
-- A separate ALTER (no other statements) so the new values are committed before
-- any code references them — same pattern as 0008_lp_outsider_status.sql.
-- ============================================================================
alter type audit_action add value if not exists 'nda_template.created';
alter type audit_action add value if not exists 'nda_template.updated';
alter type audit_action add value if not exists 'nda_template.archived';
