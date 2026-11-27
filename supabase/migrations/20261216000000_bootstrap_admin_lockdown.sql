-- ============================================================================
-- JobHub — Close the self-service super-admin escalation
--
-- 20261121120500_demo_bootstrap.sql revokes EXECUTE on
-- public.jh_bootstrap_super_admin(text) from public/anon/authenticated, but
-- 20261127000000_function_privilege_lockdown.sql then re-granted EXECUTE on
-- EVERY `jh_*` function to `authenticated` in a loop. Live check (2026-11-27):
--
--   has_function_privilege('authenticated', 'public.jh_bootstrap_super_admin(text)', 'execute') = true
--
-- Effect: any signed-in student could call
--   POST /rest/v1/rpc/jh_bootstrap_super_admin {"p_email": "<their own email>"}
-- and become `super_admin`. The function is SECURITY DEFINER and performs no
-- caller check of its own — it exists to be run by an operator from the SQL
-- editor. That is a full privilege-escalation hole.
--
-- Fix: operator-only helper. No application role may execute it; the table
-- owner (the SQL editor / `db:migrate` connection) still can.
-- Rolling back is not desirable — this is a security fix — but the SQL is
-- reversible by re-granting to `authenticated` if an operator ever needs it.
-- ============================================================================

revoke all on function public.jh_bootstrap_super_admin(text) from public;
revoke all on function public.jh_bootstrap_super_admin(text) from anon;
revoke all on function public.jh_bootstrap_super_admin(text) from authenticated;

comment on function public.jh_bootstrap_super_admin(text) is
  'Operator-only: promote an EXISTING account to super_admin. Deliberately NOT executable by anon/authenticated (20261216000000) — run it from the SQL editor.';

-- Prove it stays closed: fail the migration if any client role still can call it.
do $$
declare
  v_leak text;
begin
  select string_agg(r, ', ') into v_leak
  from unnest(array['anon', 'authenticated']) as r
  where has_function_privilege(r, 'public.jh_bootstrap_super_admin(text)', 'execute');

  if v_leak is not null then
    raise exception 'jh_bootstrap_super_admin is still executable by %', v_leak;
  end if;
end $$;
