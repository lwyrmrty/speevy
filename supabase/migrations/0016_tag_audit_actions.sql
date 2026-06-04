-- ============================================================================
-- audit_action: add tag.* and lp.tag_* values
-- Admin writes to the new tags catalog (create / update / delete) and tag
-- assignments to/from an LP write an audit_log row, mirroring the audit posture
-- for other admin writes. A separate ALTER (no other statements) so the new
-- values are committed before any code references them — same pattern as
-- 0008_lp_outsider_status.sql and 0013_nda_template_audit_actions.sql.
-- ============================================================================
alter type audit_action add value if not exists 'tag.created';
alter type audit_action add value if not exists 'tag.updated';
alter type audit_action add value if not exists 'tag.deleted';
alter type audit_action add value if not exists 'lp.tag_added';
alter type audit_action add value if not exists 'lp.tag_removed';
