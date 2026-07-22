-- ============================================================================
-- audit_action: add email.sent
-- Written when Speevy successfully sends an LP-facing Loops transactional email.
-- Powers the admin Messages feed.
-- ============================================================================
alter type audit_action add value if not exists 'email.sent';
