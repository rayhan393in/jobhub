-- ============================================================================
-- JobHub — 02 Row Level Security
-- Students only ever see their own private data. Answer keys are never readable
-- by a student session; exam questions reach the browser only through the
-- server after an attempt has been opened.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER avoids recursive RLS on profiles)
-- ---------------------------------------------------------------------------
create or replace function public.jh_current_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.role_id from public.profiles p where p.id = auth.uid()), 'anon');
$$;

create or replace function public.jh_has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.profiles p on p.role_id = rp.role_id
    where p.id = auth.uid() and rp.permission_key = p_key
  );
$$;

create or replace function public.jh_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jh_current_role() in ('content_editor','admin','super_admin');
$$;

create or replace function public.jh_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.jh_current_role() in ('admin','super_admin');
$$;

revoke all on function public.jh_current_role() from public;
revoke all on function public.jh_has_permission(text) from public;
revoke all on function public.jh_is_staff() from public;
revoke all on function public.jh_is_admin() from public;
grant execute on function public.jh_current_role() to authenticated, anon;
grant execute on function public.jh_has_permission(text) to authenticated;
grant execute on function public.jh_is_staff() to authenticated;
grant execute on function public.jh_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','profiles','courses','subjects','topics','subtopics',
    'questions','question_reviews','import_batches','routines','exam_schedules','exam_papers',
    'exam_questions','exam_attempts','student_answers','results','bookmarks','study_progress',
    'audit_logs','system_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helper to drop-then-create every policy (idempotent re-runs)
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- roles / permissions / role_permissions -------------------------------------
create policy "roles readable by signed-in users" on public.roles
  for select to authenticated using (true);

create policy "permissions readable by signed-in users" on public.permissions
  for select to authenticated using (true);

create policy "role permissions readable by signed-in users" on public.role_permissions
  for select to authenticated using (true);

create policy "admins manage roles" on public.roles
  for all to authenticated using (public.jh_has_permission('role.manage'))
  with check (public.jh_has_permission('role.manage'));

create policy "admins manage role permissions" on public.role_permissions
  for all to authenticated using (public.jh_has_permission('role.manage'))
  with check (public.jh_has_permission('role.manage'));

-- profiles -------------------------------------------------------------------
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "staff read profiles" on public.profiles
  for select to authenticated using (public.jh_is_staff());

create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid());

create policy "admins manage profiles" on public.profiles
  for update to authenticated using (public.jh_is_admin())
  with check (public.jh_is_admin());

-- courses --------------------------------------------------------------------
create policy "public reads published courses" on public.courses
  for select to anon, authenticated using (status = 'published');

create policy "staff read all courses" on public.courses
  for select to authenticated using (public.jh_is_staff());

create policy "staff write courses" on public.courses
  for all to authenticated using (public.jh_has_permission('taxonomy.manage'))
  with check (public.jh_has_permission('taxonomy.manage'));

-- subjects / topics / subtopics ---------------------------------------------
create policy "public reads subjects of published courses" on public.subjects
  for select to anon, authenticated
  using (exists (select 1 from public.courses c where c.id = subjects.course_id and c.status = 'published'));

create policy "staff read subjects" on public.subjects
  for select to authenticated using (public.jh_is_staff());

create policy "staff write subjects" on public.subjects
  for all to authenticated using (public.jh_has_permission('taxonomy.manage'))
  with check (public.jh_has_permission('taxonomy.manage'));

create policy "public reads topics of published courses" on public.topics
  for select to anon, authenticated
  using (exists (
    select 1 from public.subjects s join public.courses c on c.id = s.course_id
    where s.id = topics.subject_id and c.status = 'published'
  ));

create policy "staff read topics" on public.topics
  for select to authenticated using (public.jh_is_staff());

create policy "staff write topics" on public.topics
  for all to authenticated using (public.jh_has_permission('taxonomy.manage'))
  with check (public.jh_has_permission('taxonomy.manage'));

create policy "public reads subtopics of published courses" on public.subtopics
  for select to anon, authenticated
  using (exists (
    select 1 from public.topics t
    join public.subjects s on s.id = t.subject_id
    join public.courses c on c.id = s.course_id
    where t.id = subtopics.topic_id and c.status = 'published'
  ));

create policy "staff read subtopics" on public.subtopics
  for select to authenticated using (public.jh_is_staff());

create policy "staff write subtopics" on public.subtopics
  for all to authenticated using (public.jh_has_permission('taxonomy.manage'))
  with check (public.jh_has_permission('taxonomy.manage'));

-- questions ------------------------------------------------------------------
-- No student-facing select policy: answer keys never leave the server.
create policy "staff read questions" on public.questions
  for select to authenticated using (public.jh_has_permission('question.review'));

create policy "editors insert questions" on public.questions
  for insert to authenticated with check (public.jh_has_permission('question.import'));

create policy "editors update questions" on public.questions
  for update to authenticated
  using (public.jh_has_permission('question.edit'))
  with check (public.jh_has_permission('question.edit'));

create policy "editors delete archived questions" on public.questions
  for delete to authenticated
  using (public.jh_is_admin() and status = 'archived');

create policy "staff read reviews" on public.question_reviews
  for select to authenticated using (public.jh_is_staff());

create policy "staff write reviews" on public.question_reviews
  for insert to authenticated with check (public.jh_has_permission('question.review'));

create policy "staff read imports" on public.import_batches
  for select to authenticated using (public.jh_is_staff());

create policy "staff create imports" on public.import_batches
  for insert to authenticated with check (public.jh_has_permission('question.import'));

-- routines -------------------------------------------------------------------
create policy "public reads published routines" on public.routines
  for select to anon, authenticated using (
    status = 'published'
    and exists (select 1 from public.courses c where c.id = routines.course_id and c.status = 'published')
  );

create policy "staff read routines" on public.routines
  for select to authenticated using (public.jh_is_staff());

create policy "staff write routines" on public.routines
  for all to authenticated using (public.jh_has_permission('routine.manage'))
  with check (public.jh_has_permission('routine.manage'));

-- exam schedules -------------------------------------------------------------
create policy "public reads published schedules" on public.exam_schedules
  for select to anon, authenticated using (status in ('published','completed'));

create policy "staff read schedules" on public.exam_schedules
  for select to authenticated using (public.jh_is_staff());

create policy "staff write schedules" on public.exam_schedules
  for all to authenticated using (public.jh_has_permission('exam.publish'))
  with check (public.jh_has_permission('exam.publish'));

-- exam papers ----------------------------------------------------------------
create policy "students read own papers" on public.exam_papers
  for select to authenticated using (
    exists (select 1 from public.exam_attempts a where a.paper_id = exam_papers.id and a.user_id = auth.uid())
  );

create policy "staff read papers" on public.exam_papers
  for select to authenticated using (public.jh_is_staff());

create policy "staff write papers" on public.exam_papers
  for all to authenticated using (public.jh_has_permission('exam.publish'))
  with check (public.jh_has_permission('exam.publish'));

-- exam questions -------------------------------------------------------------
create policy "staff read exam questions" on public.exam_questions
  for select to authenticated using (public.jh_is_staff());

create policy "staff write exam questions" on public.exam_questions
  for all to authenticated using (public.jh_has_permission('exam.publish'))
  with check (public.jh_has_permission('exam.publish'));

-- exam attempts --------------------------------------------------------------
create policy "students read own attempts" on public.exam_attempts
  for select to authenticated using (user_id = auth.uid());

create policy "staff read attempts" on public.exam_attempts
  for select to authenticated using (public.jh_has_permission('attempt.inspect'));

-- Inserts/updates go through server routes holding the service role key.
-- Direct student writes are intentionally not granted: a student cannot set
-- their own score, deadline or release flag.

create policy "students read own answers" on public.student_answers
  for select to authenticated using (
    exists (select 1 from public.exam_attempts a where a.id = student_answers.attempt_id and a.user_id = auth.uid())
  );

create policy "staff read answers" on public.student_answers
  for select to authenticated using (public.jh_has_permission('attempt.inspect'));

-- results --------------------------------------------------------------------
create policy "students read own released results" on public.results
  for select to authenticated using (user_id = auth.uid() and is_released);

create policy "staff read results" on public.results
  for select to authenticated using (public.jh_is_staff());

-- bookmarks ------------------------------------------------------------------
create policy "own bookmarks" on public.bookmarks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- study progress -------------------------------------------------------------
create policy "own study progress" on public.study_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit logs -----------------------------------------------------------------
create policy "staff read audit" on public.audit_logs
  for select to authenticated using (public.jh_has_permission('audit.view'));

-- system settings ------------------------------------------------------------
create policy "admins read settings" on public.system_settings
  for select to authenticated using (public.jh_has_permission('settings.manage'));

create policy "admins write settings" on public.system_settings
  for all to authenticated using (public.jh_has_permission('settings.manage'))
  with check (public.jh_has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- Table privileges: RLS narrows rows; grants decide whether the role may even
-- attempt an operation.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;

grant select on public.courses, public.subjects, public.topics, public.subtopics,
      public.routines, public.exam_schedules to anon;

grant select on public.roles, public.permissions, public.role_permissions,
      public.profiles, public.courses, public.subjects, public.topics, public.subtopics,
      public.questions, public.question_reviews, public.import_batches, public.routines,
      public.exam_schedules, public.exam_papers, public.exam_questions, public.exam_attempts,
      public.student_answers, public.results, public.bookmarks, public.study_progress,
      public.audit_logs, public.system_settings to authenticated;

grant insert, update, delete on public.bookmarks to authenticated;
grant insert, update, delete on public.study_progress to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert on public.question_reviews, public.import_batches to authenticated;
grant insert, update, delete on public.questions, public.subjects, public.topics,
      public.subtopics, public.courses, public.routines, public.exam_schedules,
      public.exam_papers, public.exam_questions, public.audit_logs, public.system_settings,
      public.roles, public.role_permissions to authenticated;
grant update on public.results to authenticated;

revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- The service role is only ever used from server route handlers. It bypasses
-- RLS by design (Supabase default) and must never reach the browser bundle.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;
