-- ---------------------------------------------------------------------------
-- Lock down anon EXECUTE on the two RPCs the 2026-12 dashboard batch exposed
-- ---------------------------------------------------------------------------
-- 20261127000000_function_privilege_lockdown assumes that revoking EXECUTE from
-- PUBLIC is enough to keep `anon` off new functions. It is not, and two RPCs
-- shipped anon-callable as a result.
--
-- Why the lockdown leaks (verified against the live project):
--
--   1. Postgres grants EXECUTE to PUBLIC on every new function by default.
--      `alter default privileges ... revoke execute on functions from public`
--      does NOT remove that built-in default — PUBLIC is implicit, not an ACL
--      entry, so there is nothing for the ALTER to take away. A function created
--      after the lockdown was observed to carry `proacl =
--      {=X/postgres,postgres=X/postgres,...}`: the leading `=X` is PUBLIC.
--
--   2. Supabase additionally maintains an explicit default ACL for functions
--      owned by postgres ({postgres=X, anon=X, authenticated=X, service_role=X})
--      and anon holds EXECUTE there in its own right, so revoking from PUBLIC
--      removes nothing there either.
--
--   3. `postgres` is not a superuser on Supabase, so this project cannot install
--      the one mechanism that *would* close it (a ddl_command_end event trigger
--      that revokes anon on create) — the existing triggers are all owned by
--      supabase_admin.
--
-- Consequence: anon access on new functions cannot be prevented at the database
-- level from a migration. It must be re-asserted per function, and the
-- regression is caught by tests/db/schema.test.ts (which fails CI when the anon
-- surface widens past the two intended helpers) plus tests/unit/anon-lockdown.
--
-- Live state this migration corrects:
--     jh_admin_seat_available   anon OK  (intended)
--     jh_public_question_count  anon OK  (intended)
--     jh_course_taxonomy        anon OK  (NOT intended)  -> revoke
--     jh_my_rank                anon OK  (NOT intended)  -> revoke
--
-- Impact today is zero: both are invoker-rights functions that read only data
-- RLS already exposes, and both filter on auth.uid(), so an anonymous caller
-- gets an empty result. This closes the hole before a future `security definer`
-- function inherits it — the NULL-bypass risk 20261127000000 documents.
--
-- Only the two named functions are touched (no catalog-wide loop), so this is
-- safe on a database that also carries functions from 20261125010000 and
-- 20261207000000.
-- ---------------------------------------------------------------------------

revoke execute on function public.jh_course_taxonomy() from public, anon;
grant execute on function public.jh_course_taxonomy() to authenticated, service_role;

-- Signature as created in 20261212000000.
revoke execute on function public.jh_my_rank(text, uuid, uuid) from public, anon;
grant execute on function public.jh_my_rank(text, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Rule for every NEW jh_* function (enforced by review + tests, not by the DB)
-- ---------------------------------------------------------------------------
--   1. End the migration with:
--        revoke execute on function public.<fn>(<args>) from public, anon;
--        grant execute on function public.<fn>(<args>) to authenticated;
--      (add service_role only if a background job or the service client calls it)
--   2. Add a case to tests/db/schema.test.ts if the function is meant to be
--      callable without a session — the anon allowlist must stay at two.
--
-- The `alter default privileges` below is kept only so the explicit anon entry
-- in Supabase's default ACL stops applying to future functions. It is a
-- belt-and-braces measure, NOT a guarantee: the built-in PUBLIC default still
-- applies (see point 1 above), so a new function remains anon-executable until
-- its own migration revokes it.
-- ---------------------------------------------------------------------------

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- Verification (expected: exactly two rows)
-- ---------------------------------------------------------------------------
--   select p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname like 'jh\_%'
--     and has_function_privilege('anon', p.oid, 'execute')
--   order by 1;
--     -> jh_admin_seat_available, jh_public_question_count
