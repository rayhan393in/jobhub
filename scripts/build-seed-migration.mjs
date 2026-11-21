import { writeFileSync } from "node:fs";
import { SAMPLE_QUESTIONS } from "./sample-questions.mjs";

const esc = (s) => String(s).replace(/'/g, "''");

const header = `-- ============================================================================
-- JobHub — 05 Editorial sample content (development seed)
-- These are JobHub-authored editorial questions imported in \`pending_review\`.
-- They are NOT verified past questions and are NOT approved automatically.
-- An administrator must review and approve them before any exam can use them.
-- No exam, routine or schedule is published by this migration.
-- ============================================================================
`;

const body = [];
body.push(`
do $$
declare
  v_admin uuid;
  v_batch uuid;
  v_q uuid;
  v_course uuid;
begin
  -- Import attribution: the first super admin if one exists, otherwise NULL.
  select id into v_admin from public.profiles where role_id = 'super_admin' order by created_at limit 1;

  insert into public.import_batches (created_by, filename, format, mode, total_rows)
  values (v_admin, 'editorial-sample-questions.json', 'json', 'commit', ${SAMPLE_QUESTIONS.length})
  returning id into v_batch;
`);

for (const q of SAMPLE_QUESTIONS) {
  const opts = q.o.map((o) => `'${esc(o)}'`).join(", ");
  body.push(`
  select c.id into v_course from public.courses c where c.slug = '${q.subj === "circuit" || q.subj === "machines" || q.subj === "power" ? "eee" : "bcs"}';
  v_q := null;
  select qq.id into v_q
    from public.questions qq
    join public.subjects su on su.id = qq.subject_id
    join public.topics t on t.id = qq.topic_id
    where qq.course_id = v_course and su.slug = '${q.subj}' and t.sort_order = ${q.topic}
      and qq.fingerprint = encode(digest('${esc(q.q)}', 'sha256'), 'hex')
    limit 1;

  if v_q is null then
    insert into public.questions (
      course_id, subject_id, topic_id, statement, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year, status, is_verified,
      fingerprint, import_batch_id, created_by
    )
    select v_course, su.id, t.id, '${esc(q.q)}', ${opts},
           ${q.a}, '${esc(q.e)}', '${q.diff}', '${esc(q.src)}', 'manual', ${q.year ?? "null"},
           'pending_review', false,
           encode(digest('${esc(q.q)}', 'sha256'), 'hex'), v_batch, v_admin
    from public.subjects su
    join public.topics t on t.subject_id = su.id
    where su.course_id = v_course and su.slug = '${q.subj}' and t.sort_order = ${q.topic};
  end if;
`);
}

body.push(`
  update public.import_batches b set
    created_rows = (select count(*) from public.questions q where q.import_batch_id = b.id),
    total_rows = ${SAMPLE_QUESTIONS.length}
  where b.id = v_batch;
end;
$$;
`);

const verify = `
-- Seed integrity: every seeded question is unverified and awaiting review.
do $$
begin
  if exists (select 1 from public.questions where source_type = 'manual' and is_verified) then
    raise warning 'Some manual questions are already verified (pre-existing data).';
  end if;
  if exists (select 1 from public.exam_schedules where status = 'published') then
    raise warning 'Published exams already exist (pre-existing data).';
  end if;
end;
$$;
`;

writeFileSync(
  "supabase/migrations/20261121120400_seed_content.sql",
  header + body.join("") + verify,
);
console.log("wrote seed migration with", SAMPLE_QUESTIONS.length, "questions");
