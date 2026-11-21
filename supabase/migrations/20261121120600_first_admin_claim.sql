-- ============================================================================
-- JobHub — first administrator claim (self-service, single use)
--
-- The admin centre is guarded by role, and roles can only be granted by an
-- existing super admin. That leaves a fresh deployment with nobody able to
-- open /admin. This migration closes that bootstrap gap without weakening the
-- guard:
--
--   * `jh_admin_seat_available()` tells the sign-in screen whether the platform
--     still has no staff at all.
--   * `jh_claim_first_admin()` promotes the *calling* authenticated user, and
--     only while there is no staff member anywhere. The seat is checked under a
--     row lock, so two people racing for it cannot both win.
--
-- Once a single content editor / admin / super admin exists, both functions
-- become inert: the seat is taken forever and the only way to add staff is the
-- existing `admin.role.manage` flow. There is no "make me admin" endpoint that
-- works on a live platform.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Is the first-admin seat still open?
-- ---------------------------------------------------------------------------
create or replace function public.jh_admin_seat_available()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1
    from public.profiles p
    where p.role_id in ('content_editor', 'admin', 'super_admin')
  );
$$;

comment on function public.jh_admin_seat_available() is
  'True while the platform has no staff member. Drives the first-admin claim UI.';

-- ---------------------------------------------------------------------------
-- Claim it (idempotent, race-proof)
-- ---------------------------------------------------------------------------
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

  -- Write through the guard trigger as a privileged server-side connection
  -- (no JWT subject), because promoting yourself is normally forbidden.
  perform set_config('request.jwt.claim.sub', '', true);

  update public.profiles
     set role_id = 'super_admin',
         onboarded_at = coalesce(onboarded_at, now()),
         updated_at = now()
   where id = v_user;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
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
  'Promotes the calling user to super_admin, but only while no staff member exists. Safe to expose to authenticated users.';

-- Both helpers are for signed-in users only; anonymous visitors get nothing.
revoke all on function public.jh_admin_seat_available() from public;
revoke all on function public.jh_claim_first_admin() from public;
revoke all on function public.jh_admin_seat_available() from anon;
revoke all on function public.jh_claim_first_admin() from anon;
grant execute on function public.jh_admin_seat_available() to authenticated;
grant execute on function public.jh_claim_first_admin() to authenticated;
