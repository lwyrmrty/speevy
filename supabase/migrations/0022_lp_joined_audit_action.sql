-- ============================================================================
-- audit_action: add lp.joined
-- Written when an LP submits the public Join / access-request form.
-- Separate migration so the enum value is committed before app code uses it.
-- ============================================================================
alter type audit_action add value if not exists 'lp.joined';
