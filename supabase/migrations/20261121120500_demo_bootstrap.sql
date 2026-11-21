-- ============================================================================
-- JobHub — demo staff bootstrap (OPT-IN, safe to run on an empty project)
--
-- This migration does NOT create users or passwords. It only promotes an
-- existing account to `super_admin` when you explicitly ask for it, so the
-- admin centre can be opened on a demo project:
--
--   select public.jh_bootstrap_super_admin('you@example.com');
--
-- Nothing runs automatically: the DO block below is disabled unless the
-- `app.bootstrap_admin_email` setting has been set with
--   alter database postgres set app.bootstrap_admin_email = 'you@example.com';
--
-- The first registered account is NEVER auto-promoted — that would be a
-- privilege-escalation hole.
-- ============================================================================

create or replace function public.jh_bootstrap_super_admin(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_role text;
begin
  if p_email is null or length(btrim(p_email)) < 3 then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;

  select id, role_id into v_id, v_role
  from public.profiles
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if v_id is null then
    raise exception 'No account found for %', p_email using errcode = 'P0002';
  end if;

  if v_role = 'super_admin' then
    return jsonb_build_object('changed', false, 'user_id', v_id, 'role', v_role);
  end if;

  update public.profiles set role_id = 'super_admin', updated_at = now() where id = v_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, details)
  values (null, 'student.role_update', 'profile', v_id,
          jsonb_build_object('role_id', 'super_admin', 'source', 'jh_bootstrap_super_admin'));

  return jsonb_build_object('changed', true, 'user_id', v_id, 'role', 'super_admin');
end;
$$;

revoke all on function public.jh_bootstrap_super_admin(text) from public;
-- Deliberately not granted to `authenticated`: this is an operator-only helper
-- intended to be called from the SQL editor.
revoke all on function public.jh_bootstrap_super_admin(text) from anon;
revoke all on function public.jh_bootstrap_super_admin(text) from authenticated;

comment on function public.jh_bootstrap_super_admin(text) is
  'Operator helper: promotes an existing account to super_admin. Call manually from the SQL editor after registering.';
