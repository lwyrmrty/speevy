-- supabase/migrations/0002_function_grants.sql
--
-- Security hardening for the helper + trigger functions created in 0001.
-- Supabase grants EXECUTE on new public functions to anon/authenticated by
-- default, which exposes SECURITY DEFINER functions via /rest/v1/rpc.
--
--   - handle_new_auth_user is a trigger function only; it must not be callable
--     by any API role. Revoke from everyone (the trigger still runs as owner).
--   - The RLS helpers must stay callable by `authenticated` (RLS policy
--     evaluation needs EXECUTE), but `anon` never needs them.

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

revoke execute on function public.current_profile_role() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.current_lp_id() from anon;
