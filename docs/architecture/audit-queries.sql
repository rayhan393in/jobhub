-- JobHub Phase 1 audit queries (read-only). Run against production Supabase.
-- 2026-11-21

-- 1. Table inventory with approximate rows
select relname as table_name, n_live_tup as approx_rows
from pg_stat_user_tables where schemaname='public' order by relname;

-- 2. Column inventory for key tables
select table_name, string_agg(column_name || ':' || data_type, ', ' order by ordinal_position) as cols
from information_schema.columns
where table_schema='public'
group by table_name order by table_name;

-- 3. Duplicate subject names across courses
select lower(coalesce(s.title_bn, s.title_en)) as subject_name,
       count(*) as copies,
       string_agg(c.slug, ', ' order by c.sort_order) as in_courses
from subjects s join courses c on c.id = s.course_id
group by 1 having count(*) > 1 order by copies desc;

-- 4. Duplicate topic names across courses
select lower(title_bn) as topic_name, count(*) as copies
from topics group by 1 having count(*) > 1 order by copies desc;

-- 5. Cross-course / same-course duplicate questions by fingerprint
select
  (select count(*) from (select fingerprint from questions
     group by fingerprint having count(distinct course_id) > 1) b) as cross_course_dup_fp,
  (select count(*) from (select fingerprint, course_id from questions
     group by fingerprint, course_id having count(*) > 1) c) as same_course_dup_fp;

-- 6. Orphans and relationship mismatches
select
  (select count(*) from questions q join topics t on t.id=q.topic_id
     where t.subject_id is distinct from q.subject_id)   as q_topic_subject_mismatch,
  (select count(*) from questions q join subjects s on s.id=q.subject_id
     where s.course_id is distinct from q.course_id)     as q_subject_course_mismatch,
  (select count(*) from questions q join subtopics st on st.id=q.subtopic_id
     where st.topic_id is distinct from q.topic_id)      as q_subtopic_topic_mismatch,
  (select count(*) from exam_questions eq left join questions q on q.id=eq.question_id
     where q.id is null)                                 as eq_orphan,
  (select count(*) from student_answers sa left join questions q on q.id=sa.question_id
     where q.id is null)                                 as sa_orphan_q,
  (select count(*) from student_answers sa left join exam_attempts a on a.id=sa.attempt_id
     where a.id is null)                                 as sa_orphan_attempt,
  (select count(*) from results r left join exam_attempts a on a.id=r.attempt_id
     where a.id is null)                                 as results_orphan,
  (select count(*) from topics t left join subjects s on s.id=t.subject_id
     where s.id is null)                                 as topic_orphan,
  (select count(*) from subtopics st left join topics t on t.id=st.topic_id
     where t.id is null)                                 as subtopic_orphan;

-- 7. Evidence metadata coverage
select source_type, status, count(*) as n,
       count(year) as with_year, count(exam_name) as with_exam_name,
       count(source_title) as with_source_title, count(source_url) as with_url,
       count(explanation) as with_explanation
from questions group by source_type, status order by n desc;

-- 8. Question distribution per course
select c.slug as course, count(q.id) as questions,
       count(*) filter (where q.status='approved')        as approved,
       count(*) filter (where q.source_type='previous')   as prev_year,
       count(*) filter (where q.source_type='ai_assisted') as ai
from courses c left join questions q on q.course_id = c.id
group by c.slug, c.sort_order order by c.sort_order;

-- 9. Taxonomy approval + canonical linkage state
select 'topics' as tbl, approval_status, count(*) as n, count(canonical_id) as with_canonical
from topics group by approval_status
union all
select 'subtopics', approval_status, count(*), 0 from subtopics group by approval_status
union all
select 'canonical_topics', 'n/a', count(*), 0 from canonical_topics;
