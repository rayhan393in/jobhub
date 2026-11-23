-- ============================================================================
-- JobHub — Common-topic synchronization across preparation routines
--
-- Master-prompt rule: "Same common topics → same study day; different
-- specialized topics → separate study schedules."
--
-- When a student follows several programs (e.g. BCS + Petrobangla), the
-- genuinely common content — identified ONLY through the central taxonomy
-- (subjects.canonical_subject_id + topics.canonical_id), never through name
-- similarity — should land on the SAME date in every routine, while each
-- course keeps its own independent routine, syllabus and progress.
--
-- What the function does:
--   * finds canonical topics that 2+ of the selected courses both study;
--   * anchor date = the earliest MUTUAL slot date — a date inside the window
--     [earliest, latest first-study date] on which EVERY participating course
--     has a published study/practice slot for its mapped subject. When no
--     mutual date exists it falls back to the earliest first-study date and
--     reports the blocked courses instead of forcing them;
--   * for every other course it moves that course's first-study assignments
--     of the topic to the anchor date — but ONLY when that course already has
--     a published study/practice slot for the subject on the anchor date.
--     The routine skeleton is admin-published; this function NEVER invents
--     routine rows, never touches specialized (non-canonical) content and
--     never merges the courses' routines.
--   * p_apply=false (default) = dry-run preview for the admin;
--     unsyncable items are reported with can_apply=false, never forced.
--
-- ROLLBACK:
--   drop function if exists public.jh_sync_common_topics(uuid[], boolean);
-- ============================================================================

create or replace function public.jh_sync_common_topics(
  p_course_ids uuid[],
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_moves jsonb;
  v_applied integer := 0;
  v_shared integer := 0;
  v_course uuid;
begin
  if auth.role() is distinct from 'service_role'
     and not public.jh_has_permission('routine.manage') then
    raise exception 'routine.manage permission required' using errcode = '42501';
  end if;

  if coalesce(array_length(p_course_ids, 1), 0) < 2 then
    raise exception 'কমন-টপিক সিঙ্কের জন্য কমপক্ষে ২টি কোর্স নির্বাচন করুন'
      using errcode = 'P0001';
  end if;

  drop table if exists _jh_sync_moves;
  create temp table _jh_sync_moves as
  with ct_assign as (
    -- Assignments whose subject AND topic are canonically linked: the only
    -- honest definition of "genuinely common". Name similarity plays no part.
    select a.id, a.course_id, a.subject_id, a.first_study_date,
           t.canonical_id as canonical_topic_id
    from public.study_plan_assignments a
    join public.topics t on t.id = a.topic_id and t.canonical_id is not null
    join public.subjects s on s.id = a.subject_id and s.canonical_subject_id is not null
    where a.course_id = any(p_course_ids)
  ),
  shared as (
    select canonical_topic_id
    from ct_assign
    group by canonical_topic_id
    having count(distinct course_id) >= 2
  ),
  course_first as (
    select ca.canonical_topic_id, ca.course_id, ca.subject_id,
           min(ca.first_study_date) as cur_date
    from ct_assign ca
    join shared sh using (canonical_topic_id)
    group by ca.canonical_topic_id, ca.course_id, ca.subject_id
  ),
  windows as (
    select canonical_topic_id,
           min(cur_date) as dmin,
           max(cur_date) as dmax,
           count(distinct course_id) as n_courses
    from course_first
    group by canonical_topic_id
  ),
  -- Earliest date in [dmin, dmax] on which EVERY course has a published
  -- study/practice slot for its mapped subject: the ideal common study day.
  mutual as (
    select x.canonical_topic_id, min(x.d) as mutual_date
    from (
      select cf.canonical_topic_id, r.routine_date as d, w.n_courses,
             count(distinct cf.course_id) as covered
      from course_first cf
      join windows w using (canonical_topic_id)
      join public.routines r
        on r.course_id = cf.course_id
       and r.subject_id = cf.subject_id
       and r.routine_date between w.dmin and w.dmax
       and r.kind = 'daily'
       and r.status = 'published'
       and coalesce(r.task_kind, 'study') in ('study', 'practice')
      group by cf.canonical_topic_id, r.routine_date, w.n_courses
    ) x
    where x.covered = x.n_courses
    group by x.canonical_topic_id
  ),
  anchors as (
    select w.canonical_topic_id,
           coalesce(m.mutual_date, w.dmin) as anchor_date
    from windows w
    left join mutual m using (canonical_topic_id)
  )
  select cf.canonical_topic_id,
         cf.course_id,
         cf.subject_id,
         cf.cur_date,
         an.anchor_date,
         sl.routine_id as target_routine_id,
         d0.day0
  from course_first cf
  join anchors an using (canonical_topic_id)
  left join lateral (
    select r.id as routine_id
    from public.routines r
    where r.course_id = cf.course_id
      and r.subject_id = cf.subject_id
      and r.routine_date = an.anchor_date
      and r.kind = 'daily'
      and r.status = 'published'
      and coalesce(r.task_kind, 'study') in ('study', 'practice')
    order by r.created_at
    limit 1
  ) sl on true
  left join lateral (
    select min(r2.routine_date) as day0
    from public.routines r2
    where r2.course_id = cf.course_id
      and r2.kind = 'daily'
      and r2.status = 'published'
  ) d0 on true
  where cf.cur_date <> an.anchor_date;

  select count(distinct canonical_topic_id) into v_shared from _jh_sync_moves;

  if p_apply then
    update public.study_plan_assignments a
       set first_study_date = m.anchor_date,
           plan_day = least(60, greatest(1, (m.anchor_date - m.day0) + 1)),
           routine_id = m.target_routine_id,
           updated_at = now()
      from _jh_sync_moves m
      join public.topics t
        on t.canonical_id = m.canonical_topic_id
     where a.course_id = m.course_id
       and a.topic_id = t.id
       and a.first_study_date = m.cur_date
       and m.target_routine_id is not null;
    get diagnostics v_applied = row_count;

    -- Mirror the new allocation back into routines.topic_ids/subtopic_ids so
    -- the daily-exam taught-scope filter and the PDF stay truthful.
    for v_course in
      select distinct course_id from _jh_sync_moves where target_routine_id is not null
    loop
      perform public.jh_sync_routine_scope(v_course, null);
    end loop;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'canonical_topic_id', m.canonical_topic_id,
           'canonical_topic_bn', coalesce(ct.title_bn, ct.title_en),
           'course', c.slug,
           'subject_bn', s.title_bn,
           'from_date', m.cur_date,
           'to_date', m.anchor_date,
           'can_apply', m.target_routine_id is not null
         ) order by m.anchor_date, c.slug), '[]'::jsonb)
    into v_moves
  from _jh_sync_moves m
  join public.canonical_topics ct on ct.id = m.canonical_topic_id
  join public.courses c on c.id = m.course_id
  join public.subjects s on s.id = m.subject_id;

  drop table if exists _jh_sync_moves;

  return jsonb_build_object(
    'dry_run', not p_apply,
    'shared_topics_out_of_sync', v_shared,
    'applied', v_applied,
    'moves', v_moves
  );
end;
$$;

comment on function public.jh_sync_common_topics is
  'Aligns the first-study date of genuinely common topics (canonical taxonomy links only) across the selected courses'' study plans. Anchor = earliest mutual published-slot date within the courses'' current window, falling back to the earliest first-study date. Moves happen only onto existing published study slots; specialized topics and each course''s own routine stay untouched. Dry-run by default.';

revoke all on function public.jh_sync_common_topics(uuid[], boolean) from public, anon;
grant execute on function public.jh_sync_common_topics(uuid[], boolean) to authenticated, service_role;
