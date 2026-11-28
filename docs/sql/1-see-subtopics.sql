-- =====================================================================
--  JobHub · টপিক থেকে সব সাবটপিক দেখা (নাম হুবহু কপি করার জন্য)
--  রান করুন, তারপর কোনো টপিকের নাম নিচের স্ক্রিপ্টে বসান।
-- =====================================================================

select
  s.title_bn                as subject,
  t.title_bn                as topic,
  count(sub.id)             as সব_সাবটপিক,
  count(sub.id) filter (where sub.is_active) as চালু,
  string_agg(
    case when sub.is_active then '✔ ' else '✘ ' end || sub.title_bn,
    '  |  ' order by sub.sort_order, sub.title_bn
  )                         as সাবটপিক_তালিকা
from topics t
join subjects s on s.id = t.subject_id
left join subtopics sub on sub.topic_id = t.id
where s.course_id = '599509ae-c4c3-440a-9463-802a4efc7a0c'   -- বিসিএস
group by s.title_bn, t.title_bn, t.sort_order
order by s.title_bn, t.sort_order, t.title_bn;

-- ✔ = is_active true (নতুন প্রশ্ন এখানে বসবে)
-- ✘ = is_active false (পুরোনো/বন্ধ — নতুন প্রশ্ন এখানে বসে না)
