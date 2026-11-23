-- ============================================================================
-- JobHub — anon EXECUTE lockdown on RPC functions
--
-- Audit finding (2026-11-21): Postgres grants EXECUTE to PUBLIC on new
-- functions by default, so every jh_* security-definer function was callable
-- by the `anon` role. Most guard themselves with auth.uid() checks, but the
-- ownership guard pattern
--     if v_attempt.user_id <> v_user and not jh_has_permission(...) then raise
-- is NULL-bypassable when auth.uid() IS NULL (anon): `uuid <> NULL` evaluates
-- to NULL, the AND collapses, the guard never fires — e.g.
-- jh_get_attempt_review would hand an anonymous caller the full answer key
-- for any leaked attempt UUID.
--
-- Fix at the gate: anon keeps EXECUTE on exactly the two functions public
-- pages genuinely call without a session —
--   - jh_public_question_count  (marketing homepage stats)
--   - jh_admin_seat_available   (login page first-admin panel)
-- and loses it on every other public jh_* function. Logged-in traffic runs as
-- `authenticated` and is unaffected. Trigger functions never check the
-- caller's EXECUTE privilege, so revoking them is free hardening too.
-- ============================================================================

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'jh\_%' escape '\'
      and p.proname not in ('jh_public_question_count', 'jh_admin_seat_available')
  loop
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon', fn.sig);
    -- Only 12 of the 33 functions carried an explicit `authenticated` grant;
    -- the rest worked through PUBLIC. Re-grant explicitly so logged-in flows
    -- are byte-for-byte unaffected (every function still enforces its own
    -- auth.uid()/permission checks internally).
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end;
$$;

-- The two intentionally-public helpers stay callable without a session.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('jh_public_question_count', 'jh_admin_seat_available')
  loop
    execute format('grant execute on function %s to anon, authenticated', fn.sig);
  end loop;
end;
$$;

-- Default privileges for FUTURE functions in public: no automatic EXECUTE for
-- anon (or PUBLIC). New student/admin RPCs must be granted to `authenticated`
-- explicitly in their own migration, which keeps the surface deliberate.
alter default privileges in schema public revoke execute on functions from public;

-- ---------------------------------------------------------------------------
-- Audit fix 2: the homepage stat was permanently ০.
-- jh_public_question_count delegated to jh_question_availability, whose
-- course filter is `q.course_id = p_course_id` with no NULL branch — so the
-- platform-wide call (p_course_id => null) always returned 0. Count directly,
-- NULL-tolerant on every level.
-- ---------------------------------------------------------------------------
create or replace function public.jh_public_question_count(
  p_course_id uuid default null,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_subtopic_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from public.questions q
  where (p_course_id is null or q.course_id = p_course_id)
    and q.status = 'approved'
    and q.is_verified
    and (p_subject_id is null or q.subject_id = p_subject_id)
    and (p_topic_id is null or q.topic_id = p_topic_id)
    and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id);
$$;

revoke all on function public.jh_public_question_count(uuid,uuid,uuid,uuid) from public;
grant execute on function public.jh_public_question_count(uuid,uuid,uuid,uuid) to anon, authenticated;
