"""Emit the backfill SQL for the 2,112 untagged BCS questions.

The interesting part is what this *refuses* to do: any question the rules do
not classify keeps `topic_id = null` rather than being dumped into a catch-all
topic. A wrongly classified question is worse than an unclassified one — it
lands in the student's revision list under the wrong heading — so coverage is
reported, not forced.
"""
import re
import sys

from rules import RULES

COURSE = "599509ae-c4c3-440a-9463-802a4efc7a0c"


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def coverage_sql() -> str:
    parts = []
    for order, subject, topic, subtopic, cond in RULES:
        parts.append(f"  when ({cond}) then {q(f'{order}|{subject}|{topic}|{subtopic}')}")
    return "\n".join(parts)


def build() -> str:
    return f"""-- dry run: how many of the 2,112 are classified, per bucket
with q as (
  select id, statement, source_type
  from public.questions
  where course_id = {q(COURSE)} and topic_id is null
), b as (
  select id, case
{coverage_sql()}
  else 'UNMATCHED' end as bucket
  from q
)
select split_part(bucket, '|', 2) as subject,
       split_part(bucket, '|', 3) as topic,
       split_part(bucket, '|', 4) as subtopic,
       count(*) as n
from b
group by 1, 2, 3
union all
select '(unmatched)', '', '', count(*) from b where bucket = 'UNMATCHED'
order by n desc;
"""


if __name__ == "__main__":
    # Several rules may target the same subtopic (HCF has three wordings); what
    # must not repeat is the *order* key, which decides precedence.
    orders = [o for o, *_ in RULES]
    if len(set(orders)) != len(orders):
        dupes = {o for o in orders if orders.count(o) > 1}
        sys.exit(f"duplicate rule order: {sorted(dupes)}")
    print(build())
