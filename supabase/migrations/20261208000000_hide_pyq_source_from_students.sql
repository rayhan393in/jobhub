-- 20261208 — Portal question payloads must not carry collection provenance.
--
-- `jh_qb_pyq_list` is SECURITY DEFINER and executable by `authenticated`, i.e.
-- by every student. It used to return `source` and `source_title`, which hold
-- the imported collections, book names and page numbers. Students must see the
-- exam attribution only (`exam_name`, `year`); provenance stays admin-side in
-- `questions.source` and is read through the admin routes.
--
-- This runs after 20261207000000_question_bank.sql, which is what defines the
-- function in the first place; signature is unchanged, so its grants stay valid.
create or replace function public.jh_qb_pyq_list(
  p_course_slug text default 'bcs',
  p_exam_name text default null,
  p_exam_year smallint default null,
  p_subject_id uuid default null,
  p_topic_id uuid default null,
  p_subtopic_id uuid default null,
  p_question_type text default null,
  p_difficulty text default null,
  p_search text default null,
  p_sort text default 'year',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_course uuid;
  v_page int := greatest(coalesce(p_page, 1), 1);
  v_size int := least(greatest(coalesce(p_page_size, 12), 1), 50);
  v_total bigint;
  v_needle text;
  v_rows jsonb;
begin
  select id into v_course from public.courses where slug = p_course_slug and status = 'published';
  if v_course is null then
    return jsonb_build_object('total', 0, 'page', v_page, 'page_size', v_size, 'total_pages', 0, 'rows', '[]'::jsonb);
  end if;

  if p_search is not null and btrim(p_search) <> '' then
    -- Escape ILIKE wildcards so student input can never alter the pattern.
    v_needle := '%' || replace(replace(replace(lower(btrim(p_search)), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select count(*) into v_total
  from public.questions q
  where q.course_id = v_course
    and q.source_type = 'previous'
    and q.status = 'approved'
    and q.is_verified
    and q.archived_at is null
    and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
    and (p_exam_year is null or q.year = p_exam_year)
    and (p_subject_id is null or q.subject_id = p_subject_id)
    and (p_topic_id is null or q.topic_id = p_topic_id)
    and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
    and (p_question_type is null or q.question_type = p_question_type)
    and (p_difficulty is null or q.difficulty = p_difficulty)
    and (v_needle is null or lower(q.statement) like v_needle escape '\' or lower(coalesce(q.statement_bn, '')) like v_needle escape '\');

  select coalesce(jsonb_agg(payload order by
    case when p_sort = 'difficulty' then difficulty end asc,
    case when p_sort = 'newest' then created_at end desc,
    case when coalesce(p_sort, 'year') = 'year' then year end desc nulls last,
    exam_name, id), '[]'::jsonb)
  into v_rows
  from (
    select q.id,
           q.exam_name,
           q.year,
           q.difficulty,
           q.created_at,
           jsonb_build_object(
             'id', q.id,
             'statement', q.statement,
             'statement_bn', q.statement_bn,
             'options', jsonb_build_array(q.option_a, q.option_b, q.option_c, q.option_d),
             'difficulty', q.difficulty,
             'subject_id', q.subject_id,
             'topic_id', q.topic_id,
             'subtopic_id', q.subtopic_id,
             'subject_title', coalesce(s.title_bn, s.title_en),
             'topic_title', coalesce(t.title_bn, t.title_en),
             'subtopic_title', coalesce(st.title_bn, st.title_en),
             'exam_name', q.exam_name,
             'year', q.year,
             'question_type', q.question_type,
             'has_explanation', length(btrim(coalesce(q.explanation, ''))) > 0,
             'classification', 'pyq'
           ) as payload
    from public.questions q
    left join public.subjects s on s.id = q.subject_id
    left join public.topics t on t.id = q.topic_id
    left join public.subtopics st on st.id = q.subtopic_id
    where q.course_id = v_course
      and q.source_type = 'previous'
      and q.status = 'approved'
      and q.is_verified
      and q.archived_at is null
      and (p_exam_name is null or lower(btrim(q.exam_name)) = lower(btrim(p_exam_name)))
      and (p_exam_year is null or q.year = p_exam_year)
      and (p_subject_id is null or q.subject_id = p_subject_id)
      and (p_topic_id is null or q.topic_id = p_topic_id)
      and (p_subtopic_id is null or q.subtopic_id = p_subtopic_id)
      and (p_question_type is null or q.question_type = p_question_type)
      and (p_difficulty is null or q.difficulty = p_difficulty)
      and (v_needle is null or lower(q.statement) like v_needle escape '\' or lower(coalesce(q.statement_bn, '')) like v_needle escape '\')
    order by
      case when p_sort = 'difficulty' then q.difficulty end asc,
      case when p_sort = 'newest' then q.created_at end desc,
      case when coalesce(p_sort, 'year') = 'year' then q.year end desc nulls last,
      q.exam_name, q.id
    offset (v_page - 1) * v_size
    limit v_size
  ) page;

  return jsonb_build_object(
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'total_pages', case when v_total = 0 then 0 else ceil(v_total::numeric / v_size) end,
    'rows', coalesce(v_rows, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.jh_qb_pyq_list(text,text,smallint,uuid,uuid,uuid,text,text,text,text,integer,integer) from public, anon;
grant execute on function public.jh_qb_pyq_list(text,text,smallint,uuid,uuid,uuid,text,text,text,text,integer,integer) to authenticated;
