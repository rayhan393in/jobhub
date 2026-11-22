-- ROLLBACK for 20261124000000_question_intelligence.sql
-- Drops ONLY the objects that migration created. No pre-existing table,
-- column, row or constraint is touched. Run top-to-bottom.

drop trigger if exists trg_guard_previous on questions;
drop function if exists jh_guard_previous_source();
drop trigger if exists trg_qtl_autolink on questions;
drop function if exists jh_autolink_question();
drop trigger if exists trg_qtl_sync on questions;
drop function if exists jh_sync_primary_link();
drop table if exists ai_generations;

drop function if exists jh_recompute_topic_priorities();
drop table if exists topic_priorities;

drop view if exists v_evidence_coverage;
drop view if exists v_question_bank;
drop view if exists v_topic_frequency;
drop table if exists evidence_records;

drop function if exists jh_detect_similar_questions(numeric);
drop table if exists question_similarity;
drop index if exists idx_questions_statement_trgm;
drop table if exists question_topic_links;
-- (pg_trgm extension left installed; harmless and may be shared)

drop view if exists v_canonical_topic_members;
drop table if exists taxonomy_merges;
alter table canonical_topics drop column if exists canonical_subject_id;
alter table canonical_topics drop column if exists approval_status;
alter table subjects drop column if exists canonical_subject_id;
drop table if exists canonical_subjects;

-- Data rollback for the topic pre-link seed (if ever needed):
--   update topics set canonical_id = null
--   where canonical_id in (select id from canonical_topics where slug like 'ct-%');
--   delete from canonical_topics where slug like 'ct-%';
--   (taxonomy_merges rows record exactly which member_ids were linked)

-- Remove the proposed-merge suggestions and applied pre-link audit rows:
--   delete from taxonomy_merges where reason like 'Auto-link rule R1%' or reason like 'Same name but different scope%';

-- Remove the migration ledger row:
delete from schema_migrations where filename = '20261124000000_question_intelligence.sql';

drop index if exists canonical_topics_slug_key;
