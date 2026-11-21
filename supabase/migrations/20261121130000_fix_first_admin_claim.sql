-- ============================================================================
-- JobHub — first-admin claim: actually bypass the self-promotion guard
--
-- Bug: `jh_claim_first_admin()` hid the caller by blanking only
-- `request.jwt.claim.sub`. Supabase's `auth.uid()` is:
--
--   coalesce(
--     nullif(current_setting('request.jwt.claim.sub', true), ''),
--     (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
--   )
--
-- PostgREST publishes the token twice — the flat claim *and* the full claims
-- JSON — so the fallback still returned the user's id. The guard trigger
-- therefore saw a user changing their own role and raised 42501
-- "You cannot change your own role". The button in /dashboard surfaced that as
-- the generic "অ্যাডমিন অ্যাক্সেস চালু করা যায়নি" error, forever.
--
-- Fix: blank *both* copies for the duration of the write, then restore them.
-- Everything else about the seat stays the same: open only while the platform
-- has no staff, serialised by an advisory lock.
-- ============================================================================

create or replace function public.jh_claim_first_admin()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_claimed boolean := false;
  v_claims text := current_setting('request.jwt.claims', true);
  v_rows integer := 0;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select role_id into v_role from public.profiles where id = v_user;
  if v_role is null then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- Serialise concurrent claims so exactly one caller can observe an empty seat.
  perform pg_advisory_xact_lock(hashtext('jobhub.first_admin_seat'));

  if v_role in ('content_editor', 'admin', 'super_admin') then
    return jsonb_build_object('claimed', false, 'already_staff', true, 'role', v_role);
  end if;

  if not public.jh_admin_seat_available() then
    raise exception 'An administrator already exists' using errcode = 'P0001';
  end if;

  -- Become a privileged, identity-less server connection for this one write.
  -- `jh_guard_profile_role()` treats a null auth.uid() as a service-role call,
  -- which is exactly what bootstrapping the first admin needs.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  update public.profiles
     set role_id = 'super_admin',
         onboarded_at = coalesce(onboarded_at, now()),
         updated_at = now()
   where id = v_user;
  get diagnostics v_rows = row_count;

  -- Put the caller's identity back; the rest of the transaction (audit log,
  -- and anything the caller does next) must run as the real user again.
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  if v_rows = 0 then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  v_claimed := true;
  v_role := 'super_admin';

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (
    v_user,
    'student.role_update',
    'profile',
    v_user,
    jsonb_build_object('role_id', 'super_admin', 'source', 'jh_claim_first_admin')
  );

  return jsonb_build_object('claimed', v_claimed, 'already_staff', false, 'role', v_role);
end;
$$;

comment on function public.jh_claim_first_admin() is
  'Promotes the calling user to super_admin, but only while no staff member exists. Blanks both JWT claim copies so the self-promotion guard treats the write as a service-role call.';

revoke all on function public.jh_claim_first_admin() from public;
revoke all on function public.jh_claim_first_admin() from anon;
grant execute on function public.jh_claim_first_admin() to authenticated;
