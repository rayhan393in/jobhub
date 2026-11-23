-- ============================================================================
-- JobHub — sectioned paper builder for the daily 90:10 exam
--
-- `jh_build_paper_with_mix` flattens its composition into one pooled scope and
-- ignores per-item counts (verified live: a 45+5 request produced 30+20).
-- That is fine for a weekly paper where only the total matters, but the daily
-- exam's defining guarantee is the SECTION split: main subject exactly 90%,
-- secondary exactly 10%.
--
-- This builder takes explicit sections. Each section fills its own count from
-- its own subject (optionally restricted to an eligible-topic list), with the
-- difficulty mix applied per section and topped up only INSIDE the section.
-- A short section fails the whole build loudly — the paper is never silently
-- rebalanced across subjects.
-- ============================================================================

create or replace function public.jh_build_paper_sectioned(
  p_course_id        uuid,
  p_sections         jsonb,   -- [{subject_id, count, topic_ids?: uuid[]}, ...]
  p_title_en         text,
  p_title_bn         text,
  p_duration_minutes integer,
  p_total_marks      numeric,
  p_negative_marks   numeric,
  p_created_by       uuid,
  p_mix              jsonb default '{"previous":0,"easy":30,"medium":50,"hard":20}'::jsonb,
  p_paper_type       text default 'scheduled',
  p_schedule_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_section     jsonb;
  v_subject     uuid;
  v_count       integer;
  v_topic_ids   uuid[];
  v_total       integer := 0;
  v_selected    uuid[] := '{}';
  v_section_sel uuid[];
  v_ids         uuid[];
  v_need        integer;
  v_bucket      text;
  v_buckets     text[] := array['previous', 'hard', 'easy', 'medium'];
  v_pct         numeric;
  v_mix_total   numeric := 0;
  v_pool        integer;
  v_paper       uuid;
  v_positive    numeric;
  v_assigned    integer;
  v_targets     jsonb;
begin
  if jsonb_typeof(coalesce(p_sections, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_sections) < 1 then
    raise exception 'Sections must be a non-empty array' using errcode = '22023';
  end if;

  select coalesce(sum(value::numeric), 0) into v_mix_total
  from jsonb_each_text(coalesce(p_mix, '{}'::jsonb))
  where key in ('previous', 'hard', 'easy', 'medium');
  if v_mix_total <> 100 then
    raise exception 'Difficulty mix must total 100 (got %)', v_mix_total using errcode = '22023';
  end if;

  for v_section in select * from jsonb_array_elements(p_sections)
  loop
    v_subject := (v_section ->> 'subject_id')::uuid;
    v_count   := coalesce((v_section ->> 'count')::int, 0);
    if v_subject is null or v_count < 1 then
      raise exception 'Every section needs a subject_id and a positive count' using errcode = '22023';
    end if;

    v_topic_ids := '{}';
    if jsonb_typeof(v_section -> 'topic_ids') = 'array' then
      select coalesce(array_agg(value::uuid), '{}') into v_topic_ids
      from jsonb_array_elements_text(v_section -> 'topic_ids');
    end if;

    -- Per-section difficulty targets (floor + remainder onto 'previous').
    v_targets  := '{}'::jsonb;
    v_assigned := 0;
    for v_bucket in select unnest(v_buckets)
    loop
      v_pct := coalesce((p_mix ->> v_bucket)::numeric, 0);
      v_targets := jsonb_set(v_targets, array[v_bucket], to_jsonb(floor(v_count * v_pct / 100.0)::int));
      v_assigned := v_assigned + (v_targets ->> v_bucket)::int;
    end loop;
    if v_assigned < v_count then
      v_targets := jsonb_set(
        v_targets, '{previous}',
        to_jsonb(((v_targets ->> 'previous')::int) + (v_count - v_assigned))
      );
    end if;

    v_section_sel := '{}';
    for v_bucket in select unnest(v_buckets)
    loop
      v_need := (v_targets ->> v_bucket)::int;
      continue when v_need < 1;

      if v_bucket = 'previous' then
        select array_agg(id) into v_ids from (
          select q.id from public.questions q
          where q.course_id = p_course_id
            and q.subject_id = v_subject
            and q.status = 'approved' and q.is_verified
            and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
            and not (q.id = any (v_section_sel)) and not (q.id = any (v_selected))
            and (q.source_type = 'previous' or q.exam_name is not null or q.year is not null)
          order by random() limit v_need
        ) sel;
      else
        select array_agg(id) into v_ids from (
          select q.id from public.questions q
          where q.course_id = p_course_id
            and q.subject_id = v_subject
            and q.status = 'approved' and q.is_verified
            and q.difficulty = v_bucket
            and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
            and not (q.id = any (v_section_sel)) and not (q.id = any (v_selected))
          order by random() limit v_need
        ) sel;
      end if;

      v_section_sel := v_section_sel || coalesce(v_ids, '{}');
    end loop;

    -- Top up INSIDE this section only: the mix may bend, the 90:10 never does.
    if coalesce(array_length(v_section_sel, 1), 0) < v_count then
      select array_agg(id) into v_ids from (
        select q.id from public.questions q
        where q.course_id = p_course_id
          and q.subject_id = v_subject
          and q.status = 'approved' and q.is_verified
          and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids))
          and not (q.id = any (v_section_sel)) and not (q.id = any (v_selected))
        order by random()
        limit v_count - coalesce(array_length(v_section_sel, 1), 0)
      ) sel;
      v_section_sel := v_section_sel || coalesce(v_ids, '{}');
    end if;

    -- Honest failure, naming the short section.
    if coalesce(array_length(v_section_sel, 1), 0) < v_count then
      select count(*) into v_pool
      from public.questions q
      where q.course_id = p_course_id
        and q.subject_id = v_subject
        and q.status = 'approved' and q.is_verified
        and (cardinality(v_topic_ids) = 0 or q.topic_id = any (v_topic_ids));
      raise exception 'Section % has only % verified questions, % required',
        v_subject, v_pool, v_count using errcode = 'P0001';
    end if;

    v_selected := v_selected || v_section_sel;
    v_total := v_total + v_count;
  end loop;

  v_positive := round(p_total_marks / v_total, 2);

  insert into public.exam_papers (
    schedule_id, course_id, paper_type, title_en, title_bn, question_count,
    duration_minutes, total_marks, positive_marks, negative_marks, composition,
    difficulty_mix, created_by
  ) values (
    p_schedule_id, p_course_id, p_paper_type,
    coalesce(p_title_en, ''), coalesce(p_title_bn, ''), v_total,
    p_duration_minutes, p_total_marks, v_positive, p_negative_marks,
    jsonb_build_object('sections', p_sections),
    p_mix, p_created_by
  ) returning id into v_paper;

  -- Sections stay in order (main first), questions inside a section keep their
  -- random order.
  insert into public.exam_questions (paper_id, question_id, position, marks)
  select v_paper, q, row_number() over (order by ord), v_positive
  from unnest(v_selected) with ordinality as t(q, ord);

  return v_paper;
end;
$$;

comment on function public.jh_build_paper_sectioned is
  'Builds a paper from explicit per-subject sections with exact section counts (daily 90:10 exam). Difficulty mix per section, top-up inside the section only, loud failure when a section is short.';

revoke all on function public.jh_build_paper_sectioned(uuid,jsonb,text,text,integer,numeric,numeric,uuid,jsonb,text,uuid) from public;
revoke all on function public.jh_build_paper_sectioned(uuid,jsonb,text,text,integer,numeric,numeric,uuid,jsonb,text,uuid) from anon;
grant execute on function public.jh_build_paper_sectioned(uuid,jsonb,text,text,integer,numeric,numeric,uuid,jsonb,text,uuid) to authenticated, service_role;
