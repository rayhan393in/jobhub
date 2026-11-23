-- ============================================================================
-- JobHub — Canonical-link consolidation (data migration)
--
-- Why: the common-topic sync engine (20261202000000) defines commonality
-- strictly through canonical links. The live registry contained 32
-- auto-generated duplicate canonical topics (slug 'ct-…', canonical_subject_id
-- NULL) that shadow the curated 'lib-…' library, so no cross-course
-- commonality was ever recorded.
--
-- What this does — ONLY unambiguous 1:1 concept matches, per the master-prompt
-- rule "sync only genuinely matching topics, never force":
--   1. Re-points topics linked to a duplicate 'ct-…' canonical topic onto its
--      exact 'lib-…' equivalent (e.g. Tense → lib-en-tense, সমাস → lib-bn-samas).
--      Combined/ambiguous concepts (e.g. "Voice & Narration" spanning two
--      library topics, "রেখা ও কোণ" vs geometry) are deliberately NOT touched.
--   2. Adds direct canonical links for course topics whose content is the
--      same single library concept (BCS ICT topics; Petrobangla
--      "Computer Basics" and "Bangla Literature").
--   3. Deletes the merged 'ct-…' duplicates once nothing references them.
--
-- Idempotent and safe on databases where the 'ct-…' rows never existed
-- (every statement joins on the slug; zero rows match → no-op).
--
-- ROLLBACK: restore topics.canonical_id from a backup of the mapping below;
-- the deleted 'ct-…' rows carried no other data (no subtopics, subject NULL).
-- ============================================================================

-- 1) Merge duplicate 'ct-…' canonical topics into their 'lib-…' equivalents.
with mapping(ct_slug, lib_slug) as (
  values
    -- English
    ('ct-51da34ead8ca', 'lib-en-tense'),            -- Tense
    ('ct-e3878916c93f', 'lib-en-parts-of-speech'),  -- Parts of speech
    ('ct-2c77c703bd66', 'lib-en-comprehension'),    -- Reading Comprehension
    ('ct-ce5dc67dd401', 'lib-en-correction'),       -- Sentence correction
    ('ct-7d760108691b', 'lib-en-sv-agreement'),     -- Subject-verb agreement
    ('ct-8a6a256ee7a3', 'lib-en-syn-ant'),          -- Synonyms & Antonyms
    ('ct-09f06963f502', 'lib-en-vocabulary'),       -- Vocabulary
    -- Bangla
    ('ct-4c471b613413', 'lib-bn-karok-bivokti'),    -- কারক ও বিভক্তি
    ('ct-4059fa11348e', 'lib-bn-dhwani-barna'),     -- ধ্বনি ও বর্ণ
    ('ct-64bf47d2c65c', 'lib-bn-sandhi'),           -- সন্ধি
    ('ct-fa061024a45f', 'lib-bn-samas'),            -- সমাস
    ('ct-307ed06752eb', 'lib-bn-shuddhikoron'),     -- বানান শুদ্ধিকরণ
    ('ct-c485aa700eef', 'lib-bn-bagdhara'),         -- বাগধারা ও প্রবাদ
    -- Mathematics
    ('ct-33394804550e', 'lib-math-percentage'),     -- শতকরা
    ('ct-56bbeade44b6', 'lib-math-profit-loss'),    -- লাভ-ক্ষতি
    ('ct-06d3992eeccf', 'lib-math-interest'),       -- সুদকষা
    ('ct-d28059f53a40', 'lib-math-average'),        -- গড়
    ('ct-6740c52db312', 'lib-math-ratio'),          -- অনুপাত ও সমানুপাত
    ('ct-f8a51558df7d', 'lib-math-mensuration'),    -- পরিমিতি
    ('ct-3019581b4264', 'lib-math-algebra'),        -- বীজগাণিতিক সূত্রাবলি
    ('ct-458138143a35', 'lib-math-geometry'),       -- জ্যামিতির মৌলিক ধারণা
    -- Mental ability
    ('ct-cc8d66c202af', 'lib-mental-direction'),    -- দিক নির্ণয়
    ('ct-33dad1a83c68', 'lib-mental-series')        -- সংখ্যা সিরিজ
)
update public.topics t
   set canonical_id = lib.id
  from mapping m
  join public.canonical_topics dup on dup.slug = m.ct_slug
  join public.canonical_topics lib on lib.slug = m.lib_slug
 where t.canonical_id = dup.id;

-- 2) Direct links where a course topic IS a single library concept.
with direct_links(course_slug, subject_slug, topic_title_en, lib_slug) as (
  values
    -- BCS ICT → library (1:1 concept matches only)
    ('bcs', 'ict', 'History, Types & Capability of Computers', 'lib-ict-fundamentals'),
    ('bcs', 'ict', 'Operating Systems & Embedded Computers',   'lib-ict-os'),
    ('bcs', 'ict', 'Computer Virus & Cyber Security',          'lib-ict-cybersecurity'),
    ('bcs', 'ict', 'Internet, WWW & E-mail',                   'lib-ict-internet'),
    ('bcs', 'ict', 'Computer Networks',                        'lib-ict-networking'),
    -- BCS Bangla → library
    ('bcs', 'bangla', 'পদ ও পদপ্রকরণ',             'lib-bn-shabda-pada'),
    ('bcs', 'bangla', 'বাক্য',                      'lib-bn-bakko'),
    ('bcs', 'bangla', 'সমার্থক ও বিপরীত শব্দ',      'lib-bn-somarthok'),
    ('bcs', 'bangla', 'কবি ও সাহিত্যিক',            'lib-bn-sahityik'),
    -- Petrobangla → library (exact concept matches)
    ('petrobangla-ae-eee', 'pb-ict',    'Computer Basics',   'lib-ict-fundamentals'),
    ('petrobangla-ae-eee', 'pb-bangla', 'Bangla Literature', 'lib-bn-sahitto')
)
update public.topics t
   set canonical_id = lib.id
  from direct_links dl
  join public.canonical_topics lib on lib.slug = dl.lib_slug
  join public.subjects s on s.slug = dl.subject_slug
  join public.courses c on c.id = s.course_id and c.slug = dl.course_slug
 where t.subject_id = s.id
   and t.title_en = dl.topic_title_en
   and t.canonical_id is null;

-- 3) Remove the merged duplicates once nothing references them.
delete from public.canonical_topics dup
 where dup.slug in (
         'ct-51da34ead8ca','ct-e3878916c93f','ct-2c77c703bd66','ct-ce5dc67dd401',
         'ct-7d760108691b','ct-8a6a256ee7a3','ct-09f06963f502','ct-4c471b613413',
         'ct-4059fa11348e','ct-64bf47d2c65c','ct-fa061024a45f','ct-307ed06752eb',
         'ct-c485aa700eef','ct-33394804550e','ct-56bbeade44b6','ct-06d3992eeccf',
         'ct-d28059f53a40','ct-6740c52db312','ct-f8a51558df7d','ct-3019581b4264',
         'ct-458138143a35','ct-cc8d66c202af','ct-33dad1a83c68'
       )
   and not exists (select 1 from public.topics t where t.canonical_id = dup.id)
   and not exists (select 1 from public.canonical_subtopics st where st.canonical_topic_id = dup.id);
