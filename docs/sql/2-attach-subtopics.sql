-- =====================================================================
--  JobHub · প্রশ্নের সাথে সাবটপিক জোড়া লাগানোর সহজ পথ
--
--  ধারণাটা একটাই: টপিক আর সাবটপিকের নাম লিখুন, সাথে প্রশ্নের একটা
--  চেনা অংশ (statement-এর ভেতরের কয়েকটা শব্দ)। স্ক্রিপ্ট নিজেই
--  প্রশ্ন খুঁজে বের করে সাবটপিকে বসিয়ে দেবে।
--
--  নিরাপত্তা:
--   • প্রতিটা লাইনে কতগুলো প্রশ্ন মিলল, আগে দেখিয়ে দেবে
--   • কোনো লাইন ০টায় বা ১টার বেশি প্রশ্নে মিললে কিছুই বসবে না
--   • commit না করে rollback দিলে কিছুই বদলাবে না
-- =====================================================================

-- ── ধাপ ১ · প্রথমে দেখে নিন কোন টপিকে কী কী সাবটপিক আছে ────────────────
--   (আলাদা করে চালালে ভালো — নাম হুবহু দরকার)
--   select s.title_bn subject, t.title_bn topic, sub.title_bn subtopic, sub.is_active
--     from topics t join subjects s on s.id=t.subject_id
--     left join subtopics sub on sub.topic_id=t.id
--    where s.course_id='599509ae-c4c3-440a-9463-802a4efc7a0c'
--    order by 1,2,4;
--   অথবা ফাইলটি চালান: docs/sql/1-see-subtopics.sql


-- ═════════════════════════════════════════════════════════════════════
--  ধাপ ২ · নিচের তালিকায় যোগ করুন: টপিক | সাবটপিক | প্রশ্নের অংশ
--          （তিনটাই টেক্সট, ছোট হাতের/বড় হাতের-lettering দেখে না）
-- ═════════════════════════════════════════════════════════════════════
begin;

drop table if exists m_ctx, m_map, m_res, m_hit, m_bad;

create temp table m_ctx as
select '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id;   -- বিসিএস

create temp table m_map as
select * from (values
  -- ┌─ টপিক ────┬─ সাবটপিক ─┬─ প্রশ্নের অংশ (statement-এ যা আছে) ─────────┐
  ('Grammar',   'Voice',      'Rice sells cheap'),
  ('Grammar',   'Voice',      'Tea is liked by common people'),
  ('Grammar',   'Tense',      'This school was built in 1971')
  -- └──────────────────────────────────────────────────────────────────┘
  -- প্রতি লাইনের শেষে কমা, শেষ লাইনে কমা নয়। উদাহরণ লাইনগুলো আপনার
  -- নিজের প্রশ্ন দিয়ে বদলে নিন, নাহলে ওগুলো বাদ দিন।
) as v(topic, subtopic, q_part);

-- ── টপিক/সাবটপিকের নাম → id (নাম না মিললে নিচে थামবে) ─────────────────
create temp table m_res as
select
  m.topic, m.subtopic, m.q_part,
  t.id   as topic_id,
  sub.id as subtopic_id
from m_map m
cross join m_ctx c
left join topics t
       on t.title_bn = m.topic
       or t.title_en = m.topic
left join subjects s
       on s.id = t.subject_id and s.course_id = c.course_id
left join subtopics sub
       on sub.topic_id = t.id
      and (sub.title_bn = m.subtopic or sub.title_en = m.subtopic);

-- ── কোন লাইনের নাম ভুল? ───────────────────────────────────────────────
select '✘ নাম মেলেনি' as সমস্যা, topic as টপিক, subtopic as সাবটপিক
from m_res
where subtopic_id is null;

do $$
begin
  if exists (select 1 from m_res where subtopic_id is null) then
    raise exception 'কিছু টপিক/সাবটপিকের নাম মেলেনি (উপরের তালিকা দেখুন)। কিছুই বসানো হয়নি।';
  end if;
end $$;

-- ── প্রশ্ন খোঁজা (statement-এর ভেতরে q_part আছে যা যা) ─────────────────
create temp table m_hit as
select
  r.topic, r.subtopic, r.q_part,
  r.subtopic_id,
  q.id         as question_id,
  q.statement,
  q.subtopic_id as old_subtopic_id
from m_res r
join m_ctx c on true
join questions q
  on q.course_id = c.course_id
 and q.topic_id   = r.topic_id
 and q.statement ilike '%' || r.q_part || '%';

-- ── রিপোর্ট: কোন লাইনে কয়টা মিলল ──────────────────────────────────────
select
  r.topic    as টপিক,
  r.subtopic as সাবটপিক,
  r.q_part   as খোঁজা_অংশ,
  count(h.question_id)                     as মিলেছে,
  count(h.question_id) filter (where h.old_subtopic_id is not null) as আগেই_অন্য_সাবটপিকে
from m_res r
left join m_hit h
       on h.topic = r.topic and h.subtopic = r.subtopic and h.q_part = r.q_part
group by r.topic, r.subtopic, r.q_part
order by 4;

-- ── ১টার বেশি বা ০টা মিললে থামুন (ভুল জায়গায় বসা আটকাতে) ──────────────
do $$
declare bad int;
begin
  select count(*) into bad
  from (
    select r.q_part, count(h.question_id) n
    from m_res r
    left join m_hit h
           on h.topic = r.topic and h.subtopic = r.subtopic and h.q_part = r.q_part
    group by r.q_part
    having count(h.question_id) <> 1
  ) x;

  if bad > 0 then
    raise exception '%.টি লাইনে ০ বা ১টার বেশি প্রশ্ন মিলেছে। উপরের রিপোর্ট দেখে প্রশ্নের অংশটা আরও নির্দিষ্ট করুন। কিছুই বসানো হয়নি।', bad;
  end if;
end $$;

-- ── আসল কাজ: সাবটপিক বসানো ────────────────────────────────────────────
--   শুধু যেগুলো এখনো কোনো সাবটপিকে নেই, সেগুলোই বদলাবে
update questions q
   set subtopic_id = h.subtopic_id,
       updated_at  = now()
  from m_hit h
 where q.id = h.question_id
   and q.subtopic_id is null;

-- ── ফলাফল ─────────────────────────────────────────────────────────────
select
  r.topic                            as টপিক,
  r.subtopic                         as সাবটপিক,
  count(q.id) filter (where q.subtopic_id = r.subtopic_id) as এখন_এই_সাবটপিকে
from m_res r
cross join m_ctx c
left join questions q
       on q.subtopic_id = r.subtopic_id
      and q.course_id   = c.course_id
group by r.topic, r.subtopic
order by 1,2;

commit;   -- ── নিশ্চিত হলে commit, নাহলে rollback ──


-- ═════════════════════════════════════════════════════════════════════
--  ধাপ ৩ · সাবটপিক যদি একদমই না থাকে — আগে বানিয়ে নিন
--          (তারপর ধাপ ২-এ ওই নামটা ব্যবহার করুন)
-- ═════════════════════════════════════════════════════════════════════
/*
insert into subtopics (topic_id, slug, title_en, title_bn, sort_order, is_active, approval_status)
select t.id,
       'voice-quasi',            -- slug: ছোট হাতের ইংরেজি, হাইফেন; একই টপিকে দুইবার নয়
       'Voice: Quasi-passive',   -- title_en
       'Voice: Quasi-passive',   -- title_bn  ← ধাপ ২-এ এই নামটাই লিখবেন
       99,                       -- sort_order
       true,                     -- is_active
       'approved'                -- approval_status
from topics t
join subjects s on s.id = t.subject_id
where s.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
  and s.slug      = 'english'
  and t.title_bn  = 'Grammar'
on conflict (topic_id, slug) do nothing;
*/


-- ═════════════════════════════════════════════════════════════════════
--  কাজ শেষ হলে যাচাই
-- ═════════════════════════════════════════════════════════════════════
--  কোন টপিকে কতগুলো প্রশ্ন এখনো সাবটপিক ছাড়া আছে:
--
--  select s.title_bn subject, t.title_bn topic,
--         count(*) filter (where q.subtopic_id is null) as সাবটপিক_ছাড়া,
--         count(*) as মোট
--    from questions q
--    join topics t on t.id = q.topic_id
--    join subjects s on s.id = t.subject_id
--   where q.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'
--   group by 1,2 having count(*) filter (where q.subtopic_id is null) > 0
--   order by 3 desc;
