# Taxonomy seed record (2026-11-22)

Research-based syllabus topics seeded directly into Supabase (production) as
part of the Advanced Subject/Topic/Subtopic Management upgrade. Everything
entered **pending + inactive** — invisible to students until the admin
approves it from `/admin/taxonomy`.

| Course | Subjects | Pending topics | Source reference |
| --- | --- | --- | --- |
| university-admission | 7 (বাংলা, English, পদার্থ, রসায়ন, উচ্চতর গণিত, জীববিজ্ঞান, GK+ICT) | 47 | du.ac.bd |
| government-jobs | 8 | 40 | bpsc.gov.bd |
| primary-teacher | 6 | 31 | dpe.gov.bd |
| ntrca | 4 | 22 | ntrca.gov.bd |
| private-jobs | 5 | 21 | — |
| technical-recruitment | 7 | 26 | — |

Also created: 28 `canonical_topics` (central common-topic library: বাংলা,
English, গণিত, সাধারণ জ্ঞান, আইসিটি, মানসিক দক্ষতা groups).

Existing data untouched: BCS (10/137/366) and EEE (15/114) remain
`approved` + active exactly as before.

All inserts used `WHERE NOT EXISTS` guards, so re-running is safe but
unnecessary — the data is already live. The schema itself lives in
`supabase/migrations/20261122100000_advanced_taxonomy.sql`.

University admission subjects deliberately cover the Engineering/Medical
admission syllabus too (Physics, Chemistry, Higher Math, Biology) — a separate
course can be added later and the common topics mapped from the canonical
library.
