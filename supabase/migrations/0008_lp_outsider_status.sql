-- ============================================================================
-- lp_status: add 'outsider'
-- "Outsiders" are people who unlocked a password-protected opportunity via a
-- shared direct link by entering a password + email. They are not invited LPs
-- ("insiders") and have no auth user, but we track their interest the same way.
-- A separate ALTER (no other statements) so the new value is committed before
-- any code references it.
-- ============================================================================
alter type lp_status add value if not exists 'outsider';
