-- ============================================================================
--  JobHub · BCS Preliminary 60-Day Routine V2.0
--  দিন ১ = ২৮ নভেম্বর ২০২৬ · দিন ৬০ = ২৬ জানুয়ারি ২০২৭ · দৈনিক ৩০০ মিনিট
--
--  পুরোনো রুটিন আগেই archived করা হয়েছে (মোছা হয়নি)। এখানে:
--    · ৬০ দিনের রুটিন published হিসেবে বসে
--    · প্রতিটি ব্লকে সত্যিকারের subject_id / topic_id (নাম না মিললে NULL —
--      কখনো বানানো ID নয়)
--    · study_plan_assignments (টপিক → সাবটপিক পেয়ার) তৈরি হয়
--    · ৮টি Weekly Test + দিন ৫৯-এর Full Mock exam_schedules-এ draft হিসেবে
--  প্রশ্ন/ফলাফল/ব্যান্কের কোনো ডেটা মোছা হয় না।
-- ============================================================================

begin;

drop table if exists jh_dp, jh_sb, jh_tp, jh_pl, jh_ins;

create temp table jh_cfg as
select '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id,
       'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id,
       '2026-11-28'::date as day1;

-- ── ১ · ৬০ দিনের প্ল্যান (day, main, 2nd, 3rd — প্রতিটি: code, topic, note) ──
create temp table jh_dp (
  day int, m_code text, m_topic text, m_note text,
  s_code text, s_topic text, s_note text,
  t_code text, t_topic text, t_note text
);

insert into jh_dp values
(1,'BN','ধ্বনি ও বর্ণ','ধ্বনি, বর্ণ, উচ্চারণ, শব্দ','EN','Parts of speech','Parts of Speech, Noun','MATH','বাস্তব সংখ্যা','বাস্তব সংখ্যা, মূলদ-অমূলদ'),
(2,'BN','পদ ও পদপ্রকারণ','শব্দ, পদ, বাক্য, বাক্য গঠন','EN','Articles and determiners','Determiner, Gender, Number','BD','প্রাচীন ও মধ্যযুগের ইতিহাস','প্রাচীন বাংলার ইতিহাস'),
(3,'BN','সন্ধি','সন্ধি ও সন্ধিবিচ্ছেদ','EN','Parts of speech','Pronoun, Finite Verb','MATH','গসাগু ও লসাগু','গ.সা.গু ও ল.সা.গু'),
(4,'BN','সমাস','সমাস ও সমাসবদ্ধ পদ','EN','Parts of speech','Non-finite Verb, Gerund, Infinitive','BD','ভাষা আন্দোলন','ভাষা আন্দোলন'),
(5,'BN','উপসর্গ','উপসর্গ, প্রত্যয়, শব্দগঠন','EN','Prepositions','Participle, Linking Verb, Phrasal Verb','MATH','শতকরা','শতকরা'),
(6,'BN','শুদ্ধ বানান ও প্রয়োগ','বানান, বাক্য শুদ্ধি, প্রয়োগ-অপপ্রয়োগ','EN','Parts of speech','Modals, Adjective, Adverb','ICT','কম্পিউটারের ইতিহাস, প্রকরভেদ ও পারঙ্গমতা','Computer history, types, peripherals'),
(7,'TEST',null,null,null,null,null,null,null,null),
(8,'BN','সমার্থক ও বিপরীত শব্দ','সমার্থক, বিপরীতার্থক, পারিভাষিক শব্দ','EN','Prepositions','Preposition, Conjunction','MATH','অনুপাত','অনুপাত, সমানুপাত'),
(9,'BN','বাগধারা','বাগধারা, প্রবাদ-প্রবচন, এককথায় প্রকাশ','EN','Vocabulary, idioms and spelling','Idioms, Phrases','BD','প্রাচীন ও মধ্যযুগের ইতিহাস','প্রাচীন ও মধ্যযুগের রাজনৈতিক ইতিহাস'),
(10,'BN','প্রাচীন যুগ ও চর্যাপদ','চর্যাপদ, প্রাচীন যুগ','EN','Clauses and phrases','Principal ও Subordinate Clause','MATH','লাভ-ক্ষতি','লাভ-ক্ষতি'),
(11,'BN','মধ্যযুগের সাহিত্য','মঙ্গলকাব্য, বৈষ্ণব পদাবলি','EN','Clauses and phrases','Noun, Adjective, Adverb Clause','BD','প্রাচীন ও মধ্যযুগের ইতিহাস','বঙ্গভঙ্গ, স্বদেশি আন্দোলন'),
(12,'BN','মধ্যযুগের সাহিত্য','অনুবাদ সাহিত্য, মুসলিম সাহিত্যধারা','EN','Tense and aspect','Tense ও Verb Correction','MATH','সরল ও চক্রবৃদ্ধি সুদ','সরল ও যৌগিক মুনাফা'),
(13,'BN','আধুনিক যুগ','ফোর্ট উইলিয়াম কলেজ, বিদ্যাসাগর','EN','Sentence correction','Preposition, Determiner, SVA Correction','ICT','কম্পিউটারের অঙ্গসংগঠন: সিপিইউ, মেমরি, হার্ডডিস্ক','CPU, ALU, Hard Disk, Computer Architecture'),
(14,'TEST',null,null,null,null,null,null,null,null),
(15,'BN','আধুনিক যুগ','বঙ্কিমচন্দ্র, মাইকেল মধুসূদন','EN','Clauses and phrases','Simple, Complex, Compound','BD','রাজনৈতিক ও সরকার ব্যবস্থা','১৯৫৪ নির্বাচন, ১৯৫২–৬৬'),
(16,'BN','কবি ও সাহিত্যিক','রবীন্দ্রনাথ ঠাকুর','EN','Voice','Active ও Passive Voice','MATH','বর্গ ও বর্গমূল','বীজগাণিতিক সূত্র'),
(17,'BN','কবি ও সাহিত্যিক','কাজী নজরুল ইসলাম, মীর মশাররফ','EN','Parts of speech','Degree of Comparison','BD','রাজনৈতিক ও সরকার ব্যবস্থা','ছয় দফা, ১৯৬৯ গণঅভ্যুত্থান'),
(18,'BN','কবি ও সাহিত্যিক','শরৎচন্দ্র, বিভূতিভূষণ, মানিক','EN','Sentence correction','Sentence Transformation','MATH','সমীকরণ','উৎপাদক, সমীকরণ'),
(19,'BN','কবি ও সাহিত্যিক','জীবনানন্দ, সুকান্ত ও আধুনিক কবি','EN','Vocabulary, idioms and spelling','Synonym, Antonym, Word Meaning','BD','রাজনৈতিক ও সরকার ব্যবস্থা','১৯৭০ নির্বাচন, অসহযোগ আন্দোলন'),
(20,'BN','বিখ্যাত গ্রন্থ ও চরিত্র','নাটক, উপন্যাস, ছোটগল্প, প্রবন্ধ','EN','Vocabulary, idioms and spelling','Spelling, Prefix, Suffix, Word Usage','ICT','সংখ্যা পদ্ধতি ও ডিজিটাল লজিক','Number System, Operating System'),
(21,'TEST',null,null,null,null,null,null,null,null),
(22,'BD','মুক্তিযুদ্ধ','৭ মার্চ, মুক্তিযুদ্ধের পটভূমি','EN','Sentence correction','Composition: Paragraph, Letter, Application','MATH','অসমতা','অসমতা, সহসমীকরণ'),
(23,'BD','মুক্তিযুদ্ধ','মুজিবনগর সরকার, সেক্টর','EN','Literary periods','Elizabethan Age','GEO','বাংলাদেশের অবস্থান ও ভূপ্রকৃতি','অবস্থান, সীমানা, ভূপ্রকৃতি'),
(24,'BD','মুক্তিযুদ্ধ','মুক্তিযুদ্ধের আন্তর্জাতিক প্রেক্ষাপট','EN','Major authors and works','Shakespeare, Renaissance','MATH','সূচক ও লগারিদম','সূচক, লগারিদম'),
(25,'BD','সংবিধান','প্রস্তাবনা, বৈশিষ্ট্য, মূলনীতি','EN','Literary periods','Romantic Age','GEO','বাংলাদেশের অবস্থান ও ভূপ্রকৃতি','নদ-নদী, পাহাড়, দ্বীপ'),
(26,'BD','সংবিধান','মৌলিক অধিকার, রাষ্ট্র পরিচালনার মূলনীতি','EN','Literary periods','Victorian Age','MATH','ধারা','সমান্তর ও গুণোত্তর ধারা'),
(27,'BD','সংবিধান','সংবিধান সংশোধনী, সংসদ, নির্বাহী ও বিচার বিভাগ','EN','Literary periods','Modern & Contemporary Writers','ICT','কম্পিউটার ভাইরাস ও সাইবার নিরাপত্তা','Database, Virus, Firewall'),
(28,'TEST',null,null,null,null,null,null,null,null),
(29,'BD','রাজনৈতিক ও সরকার ব্যবস্থা','সরকারব্যবস্থা, প্রশাসন, স্থানীয় সরকার','INT','বিশ্ব ইতিহাস','বিশ্ব ইতিহাস ও সভ্যতা','MATH','রেখা ও কোণ','রেখা, কোণ'),
(30,'BD','অর্থনীতি ও বাজেট','জাতীয় আয়, বাজেট, পরিকল্পনা','INT','ভূরাজনীতি','বিশ্ব রাজনীতি ও ভূরাজনীতি','MA','গাণিতিক সমস্যা সমাধান: বয়স, অনুপাত, গতি','Verbal Reasoning'),
(31,'BD','কৃষি','কৃষি, খাদ্য, মৎস্য, বন ও সম্পদ','INT','ভূরাজনীতি','রাষ্ট্র, ক্ষমতা ও কূটনীতি','MATH','ত্রিভুজ','ত্রিভুজ, চতুর্ভুজ'),
(32,'BD','শিল্প ও বাণিজ্য','শিল্প, বাণিজ্য, RMG, রেমিট্যান্স','INT','আন্তর্জাতিক নিরাপত্তা','আন্তর্জাতিক নিরাপত্তা ও সংঘাত','MA','চিত্র গণনা, ঘনক ও পাশা','Problem Solving'),
(33,'BD','জনসংখ্যা ও সংস্কৃতি','জনসংখ্যা, ক্ষুদ্র নৃগোষ্ঠী, সমাজ ও সংস্কৃতি','INT','আঞ্চলিক ও অর্থনৈতিক সংস্থা','আন্তর্জাতিক অর্থনীতি ও বাণিজ্য','MATH','বৃত্ত','বৃত্ত, পিথাগোরাস'),
(34,'BD','জাতীয় প্রতিষ্ঠান ও অর্জন','জাতীয় অর্জন, প্রতিষ্ঠান, সামাজিক ও অর্থনৈতিক সূচক','INT','জাতিসংঘ','জাতিসংঘ, IMF, World Bank, WTO','ICT','কম্পিউটার নেটওয়ার্ক: ল্যান, ম্যান, ওয়াই-ফাই, ওয়াইম্যাক্স','LAN, MAN, WAN, Wi-Fi, WiMAX'),
(35,'TEST',null,null,null,null,null,null,null,null),
(36,'INT','আঞ্চলিক ও অর্থনৈতিক সংস্থা','আঞ্চলিক সংস্থা: EU, ASEAN, SAARC, OIC','SCI','পদার্থের অবস্থা, এটমের গঠন ও মৌলিক কণা','পদার্থের অবস্থা, পরমাণুর গঠন','GEO','বিশ্ব ভূগোল','বিশ্বভূগোল, মহাদেশ, মহাসাগর'),
(37,'INT','আন্তর্জাতিক চুক্তি','আন্তর্জাতিক চুক্তি, সংস্থা ও সম্মেলন','SCI','এসিড, ক্ষার, লবণ ও সাবানের কাজ','কার্বন, এসিড, ক্ষার, লবণ','MA','গাণিতিক সমস্যা সমাধান: বয়স, অনুপাত, গতি','Numerical Ability'),
(38,'INT','সমসাময়িক ঘটনা','পরিবেশ, জলবায়ু, বৈশ্বিক সমস্যা','SCI','ধাতু-অধাতু, জৈব-অজৈব যৌগ ও জারণ-বিজারণ','ক্ষয়, জারণ-বিজারণ, সাবান','GEO','জলবায়ু','জলবায়ু, প্রাকৃতিক সম্পদ'),
(39,'INT','সমসাময়িক ঘটনা','বিশ্ব সংঘাত, কূটনৈতিক সম্পর্ক, চলমান ঘটনা','SCI','ভৌত রাশি ও পরিমাপ; তাপ ও তাপগতিবিদ্যা','বল, গতি, কাজ, শক্তি','MA','দিক ও দূরত্ব নির্ণয়','Space Relation'),
(40,'SCI','তরঙ্গ ও শব্দ; আলোর প্রকৃতি ও আলোক যন্ত্রপাতি','তাপ, তাপগতিবিদ্যা, আলো, শব্দ, তরঙ্গ','SCI','স্থির-চল তড়িৎ, চৌম্বকত্ব ও ইলেকট্রনিক্স','স্থির ও চল তড়িৎ, চুম্বকত্ব','ICT','সেলুলার ডেটা নেটওয়ার্ক ও স্মার্টফোন: টুজি-ফাইভজি','Cellular Data, Mobile Technology'),
(41,'SCI','স্থির-চল তড়িৎ, চৌম্বকত্ব ও ইলেকট্রনিক্স','ইলেকট্রনিক্স, ডায়োড, ট্রানজিস্টর, ট্রান্সফরমার','SCI','শক্তির উৎস ও রূপান্তর; তেজস্ক্রিয়তা ও এক্সরে','নবায়নযোগ্য শক্তি, X-ray, Radioactivity','নৈতিকতা','মূল্যবোধ','Values, Good Governance'),
(42,'TEST',null,null,null,null,null,null,null,null),
(43,'SCI','টিস্যু, অর্গান সিস্টেম ও জেনেটিক্স','কোষ, টিস্যু, বংশগতি, জেনেটিক্স','SCI','উদ্ভিদজগৎ: সালোকসংশ্লেষণ, পরাগায়ন, ফুল ও ফল','উদ্ভিদ, প্রাণী, জীববৈচিত্র্য','GEO','দূষণ','পরিবেশ দূষণ ও দুর্যোগ'),
(44,'SCI','মানবদেহ: রক্ত, হৃদপিণ্ড, স্নায়ু; খাদ্য ও পুষ্টি','মানবদেহ, রক্ত, হৃদপিণ্ড, স্নায়ুতন্ত্র','SCI','রোগের কারণ ও প্রতিকার; সংক্রামক রোগ ও টিকা','পুষ্টি, ভিটামিন, রোগ, টিকা','MATH','পরিমিতি','পরিমিতি, ক্ষেত্রফল'),
(45,'SCI','ভাইরাস, ব্যাকটেরিয়া ও মাইক্রোবায়োলজি','ভাইরাস, ব্যাকটেরিয়া, অণুজীব','ICT','অপারেটিং সিস্টেম ও অ্যামবেডেড কম্পিউটার','Embedded Computer, Computer Performance','MA','বানান ও ভাষা: বাংলা ও English শুদ্ধি','Spelling & Language'),
(46,'ICT','ই-কমার্স ও দৈনন্দিন জীবনে তথ্যপ্রযুক্তি','Practical Applications, E-mail, Fax','ICT','ইন্টারনেট, ওয়ার্ল্ড ওয়াইড ওয়েব ও ই-মেইল','WWW, Internet, Client-Server','নৈতিকতা','সুশাসন ও উন্নয়ন','Values ও Good Governance-এর সম্পর্ক'),
(47,'ICT','ক্লাউড কম্পিউটিং, কৃত্রিম বুদ্ধিমত্তা ও রোবটিক্স','Smartphone, Cloud, Social Networking, Tech Giants','ICT','কম্পিউটার ভাইরাস ও সাইবার নিরাপত্তা','Robotics, Cyber Crime','MATH','পরিমিতি','ঘনবস্তু, আয়তন'),
(48,'MATH','সেট','সেট, বিন্যাস, সমাবেশ, পরিসংখ্যান, সম্ভাব্যতা','MA','চিত্র গণনা, ঘনক ও পাশা','Mechanical Reasoning','নৈতিকতা','মূল্যবোধ','নাগরিক জীবন, জাতীয় আদর্শ, সামাজিক প্রেক্ষাপট'),
(49,'TEST',null,null,null,null,null,null,null,null),
(50,'BN',null,'সম্পূর্ণ ব্যাকরণ রিভিশন','EN','Parts of speech','Parts of Speech, Tense, Correction','MATH',null,'Arithmetic Revision'),
(51,'BN',null,'প্রাচীন, মধ্যযুগ ও আধুনিক সাহিত্য','EN','Vocabulary, idioms and spelling','Vocabulary, Idioms, Phrases','BD','মুক্তিযুদ্ধ','ইতিহাস ও মুক্তিযুদ্ধ'),
(52,'BD','সংবিধান','সংবিধান, প্রশাসন, অর্থনীতি','INT','ভূরাজনীতি','বিশ্ব রাজনীতি ও কূটনীতি','MA','গাণিতিক সমস্যা সমাধান: বয়স, অনুপাত, গতি','Verbal & Numerical'),
(53,'INT','আঞ্চলিক ও অর্থনৈতিক সংস্থা','সংস্থা, চুক্তি, নিরাপত্তা ও বিশ্ব ঘটনা','EN','Literary periods','Literature & Composition','ICT',null,'Full Revision'),
(54,'SCI',null,'Physical Science','SCI',null,'Biology & Modern Science','GEO',null,'Full Revision'),
(55,'MATH',null,'Algebra, Geometry, Statistics','নৈতিকতা',null,'Full Revision','BD',null,'বাংলাদেশ ও আন্তর্জাতিক: গুরুত্বপূর্ণ তথ্য'),
(56,'TEST',null,null,null,null,null,null,null,null),
(57,'BN',null,'ভুল topic ও grammar রিভিশন','BD',null,'গুরুত্বপূর্ণ তথ্য','MA',null,'১০০টি mixed MCQ'),
(58,'MATH',null,'Formula ও problem practice','SCI',null,'ভুল topic রিভিশন','ICT',null,'১০০টি mixed MCQ'),
(59,'MOCK',null,null,null,null,null,null,null,null),
(60,'BN',null,'Final weak-topic revision','EN',null,'গুরুত্বপূর্ণ তথ্য, vocabulary ও formula','BD',null,'ভুল প্রশ্নের শেষ পুনরালোচনা');

-- ── ২ · বিষয় কোড → subject_id ──────────────────────────────────────────────
create temp table jh_sb as
select v.code, s.id
from (values
  ('BN','বাংলা ভাষা ও সাহিত্য'),
  ('EN','English Language & Literature'),
  ('BD','বাংলাদেশ বিষয়াবলি'),
  ('INT','আন্তর্জাতিক বিষয়াবলি'),
  ('GEO','ভূগোল, পরিবেশ ও দুর্যোগ'),
  ('SCI','সাধারণ বিজ্ঞান'),
  ('ICT','কম্পিউটার ও তথ্যপ্রযুক্তি'),
  ('MATH','গাণিতিক যুক্তি'),
  ('MA','মানসিক দক্ষতা'),
  ('নৈতিকতা','নৈতিকতা, মূল্যবোধ ও সুশাসন')
) as v(code, title)
join jh_cfg c on true
join subjects s on s.course_id = c.course_id and s.title_bn = v.title;

-- ── ৩ · টপিক রেজলভ ────────────────────────────────────────────────────────
--  তুলনার আগে নাম "লঘু" করা হয়: NFC normalize → বাংলা কার/চিহ্ন ও যুক্তাক্ষরের
--  অংশ (U+0981–0983, 09BC–09CD, 09D7, 09E0–09E3) বাদ → শূন্য-প্রস্থ অক্ষর বাদ
--  → lower → স্পেস/যতিচিহ্ন বাদ। এতে "য়" বনাম "য়", "প্রয়োগ" বনাম "প্রয়োগ"
--  একই ধরা পড়ে। হুবহু না মিললে একই বিষয়ের সবচেয়ে কাছের নাম, তবে
--  নয়তো একটির ভেতরে অন্যটি থাকলে ০.৯, নয়তো similarity >= 0.55; তাও না হলে NULL।
create or replace function pg_temp.jh_norm(x text) returns text
language sql immutable as $$
  select translate(
           -- য়→য, ড়→ড, ঢ়→ঢ (বাংলা বানানের দুই রূপ এক করা)
           translate(
             lower(regexp_replace(coalesce(x, ''),
               '[' || chr(2433) || '-' || chr(2435) || chr(2492) || '-' || chr(2509)
                   || chr(2519) || chr(2528) || '-' || chr(2531) || ']', '', 'g')),
             chr(2527) || chr(2524) || chr(2525),
             chr(2479) || chr(2465) || chr(2466)),
           ' ' || chr(9) || '.,;:।-–—()/' || chr(8203) || chr(8204) || chr(8205)
             || chr(8206) || chr(8207) || chr(65279),
           '')
$$;

create temp table jh_tp as
select x.day, x.slot, x.code, x.topic_title, b.id as resolved_id, b.sim
from (
  select day, 'm' as slot, m_code as code, m_topic as topic_title from jh_dp where m_topic is not null
  union all select day, 's', s_code, s_topic from jh_dp where s_topic is not null
  union all select day, 't', t_code, t_topic from jh_dp where t_topic is not null
) x
join jh_sb sb on sb.code = x.code
left join lateral (
  select t.id,
         case
           when pg_temp.jh_norm(t.title_bn) = pg_temp.jh_norm(x.topic_title) then 1::real
           -- একটি নাম অন্যটির ভেতরে পুরোপুরি থাকলে (কমপক্ষে ১০ অক্ষর লম্বা হলে)
           when length(pg_temp.jh_norm(t.title_bn)) >= 10
                and position(pg_temp.jh_norm(t.title_bn) in pg_temp.jh_norm(x.topic_title)) > 0 then 0.9::real
           when length(pg_temp.jh_norm(x.topic_title)) >= 10
                and position(pg_temp.jh_norm(x.topic_title) in pg_temp.jh_norm(t.title_bn)) > 0 then 0.9::real
           else similarity(pg_temp.jh_norm(t.title_bn), pg_temp.jh_norm(x.topic_title))
         end as sim
  from topics t
  where t.subject_id = sb.id
  order by sim desc, t.sort_order
  limit 1
) b on true
where b.sim >= 0.55;

-- ── ৪ · দিন ও ব্লক ─────────────────────────────────────────────────────────
create temp table jh_pl as
select d.day, c.day1 + (d.day - 1) as d_date,
       ((d.day - 1) / 7) + 1 as week_index,
       c.day1 + (((d.day - 1) / 7) * 7) as week_start,
       'দিন ' || d.day::text as day_no
from jh_dp d cross join jh_cfg c
where d.day between 1 and 60;

create temp table jh_ins as
-- সাধারণ দিন: ৩টি পড়ার ব্লক + প্র্যাকটিস + রাতের রিভিশন = ৩০০ মিনিট
select p.day, p.d_date, p.week_index, p.week_start,
       (array['সকাল ৭:০০–৯:০০','সকাল ৯:১৫–১০:১৫','বিকাল ৪:০০–৫:০০'])[n] as slot_label,
       n as slot_no, p.day_no,
       (array[d.m_code, d.s_code, d.t_code])[n] as code,
       (array[d.m_topic, d.s_topic, d.t_topic])[n] as topic_title,
       (array[d.m_note, d.s_note, d.t_note])[n] as note,
       (array[120, 60, 60])[n] as minutes,
       'study'::text as task_kind
from jh_pl p join jh_dp d on d.day = p.day
cross join generate_series(1, 3) as n
where d.m_code not in ('TEST', 'MOCK')
union all
select p.day, p.d_date, p.week_index, p.week_start, 'সন্ধ্যা ৭:০০–৭:৪৫', 4, p.day_no,
       null, null, '৩০–৫০টি প্রশ্ন', 45, 'practice'
from jh_pl p join jh_dp d on d.day = p.day where d.m_code not in ('TEST', 'MOCK')
union all
select p.day, p.d_date, p.week_index, p.week_start, 'রাত ১০:৪৫–১১:০০', 5, p.day_no,
       null, null, 'আজকের পড়া ঝালাই + আগের দিনের টপিক দ্রুত রিভিশন', 15, 'revision'
from jh_pl p join jh_dp d on d.day = p.day where d.m_code not in ('TEST', 'MOCK')
-- Weekly Test-এর দিন: পরীক্ষা ৫০ + বিশ্লেষণ ৪৫ + রিভিশন ১২০ + প্র্যাকটিস ৭০ + ১৫
union all
select p.day, p.d_date, p.week_index, p.week_start, v.slot, v.sno, p.day_no, null, null, v.note, v.mins, v.tk
from jh_pl p join jh_dp d on d.day = p.day
cross join lateral (values
  ('সকাল ৯:৩০–১০:২০', 1, '১০০ MCQ · ৫০ মিনিট · ১০০ নম্বর · ভুলে −০.৫০', 50, 'exam'),
  ('সকাল ১০:৩০–১১:১৫', 2, 'মডেল টেস্টের ভুল প্রশ্ন বিশ্লেষণ', 45, 'revision'),
  ('বিকাল ৪:০০–৬:০০', 3, case when p.day = 56 then 'Full syllabus assessment' else 'সপ্তাহের রিভিশন' end, 120, 'revision'),
  ('সন্ধ্যা ৭:০০–৮:১০', 4, 'দুর্বল টপিকে অতিরিক্ত MCQ প্র্যাকটিস', 70, 'practice'),
  ('রাত ১০:৪৫–১১:০০', 5, 'আজকের পড়া ঝালাই', 15, 'revision')
) as v(slot, sno, note, mins, tk)
where d.m_code = 'TEST'
-- দিন ৫৯ · Full Mock (২০০ প্রশ্ন · ১২০ মিনিট)
union all
select p.day, p.d_date, p.week_index, p.week_start, v.slot, v.sno, p.day_no, null, null, v.note, v.mins, v.tk
from jh_pl p join jh_dp d on d.day = p.day
cross join (values
  ('সকাল ৯:০০–১১:০০', 1, '২০০ প্রশ্ন · ১২০ মিনিট · সম্পূর্ণ সিলেবাস', 120, 'exam'),
  ('সকাল ১১:১৫–১২:১৫', 2, 'Result ও subject-wise analysis', 60, 'revision'),
  ('বিকাল ৪:০০–৫:১৫', 3, 'ভুল প্রশ্ন ও formula revision', 75, 'revision'),
  ('সন্ধ্যা ৭:০০–৭:৩০', 4, 'দুর্বল টপিকে শেষ প্র্যাকটিস', 30, 'practice')
) as v(slot, sno, note, mins, tk)
where d.m_code = 'MOCK';

do $$
declare bad int;
begin
  select count(*) into bad from jh_ins where minutes < 5 or minutes > 480;
  if bad > 0 then raise exception '% সারিতে minutes সীমার বাইরে', bad; end if;
  select count(*) into bad from jh_ins where d_date < week_start or d_date > week_start + 6;
  if bad > 0 then raise exception '% সারির তারিখ week_start-এর বাইরে', bad; end if;
  select count(*) into bad from jh_ins where day_no is null;
  if bad > 0 then raise exception '% সারিতে দিন নম্বর নেই', bad; end if;
end $$;

-- ── ৫ · uniqued index সংঘাত এড়ানো ──────────────────────────────────────────
--  routines_unique_slot_idx = (course, kind, date, subject, topic, slot_label)।
--  পুরোনো archived রুটিনের হুবহু একই কী-এর সারি থাকলে নতুন সারি বসে না,
--  তাই কেবল সেই archived সারিগুলোর slot_label-এ ' · পুরোনো রুটিন' যোগ করা হয়।
--  সারি মোছা হয় না, status বদলায় না।
update routines r
set slot_label = r.slot_label || ' · পুরোনো রুটিন'
from jh_ins i
join jh_cfg cfg on true
join jh_dp d on d.day = i.day
left join jh_sb sb on sb.code = i.code
left join jh_tp t on t.day = i.day
     and t.slot = case i.slot_no when 1 then 'm' when 2 then 's' when 3 then 't' else 'x' end
where r.course_id = cfg.course_id
  and r.status = 'archived'
  and r.kind = case when d.m_code = 'TEST' then 'weekly_special' else 'daily' end
  and r.routine_date = i.d_date
  and r.subject_id is not distinct from sb.id
  and r.topic_id is not distinct from t.resolved_id
  and r.slot_label is not distinct from i.slot_label;

-- ── ৬ · রুটিন সারি (published) ─────────────────────────────────────────────
insert into routines (
  course_id, kind, routine_date, title_en, title_bn, subject_id, topic_id,
  minutes, focus_note_bn, status, created_by, week_start, week_index,
  slot_label, target_bn, task_kind, topic_ids, subtopic_ids
)
select
  cfg.course_id,
  case when d.m_code = 'TEST' then 'weekly_special' else 'daily' end,
  i.d_date,
  'BCS 60-day plan · day ' || i.day,
  case
    when d.m_code = 'TEST' then i.day_no || ' — Weekly Test ' || lpad((((i.day - 1) / 7) + 1)::text, 2, '0')
    when d.m_code = 'MOCK' then i.day_no || ' — Full BCS Mock'
    when i.code is null then i.day_no || ' — ' || i.note
    else i.day_no || ' — ' || sbj.title_bn
  end,
  sb.id,
  t.resolved_id,
  i.minutes,
  i.note,
  'published',
  cfg.admin_id,
  i.week_start,
  i.week_index,
  i.slot_label,
  i.note,
  i.task_kind,
  case when t.resolved_id is null then '{}'::uuid[] else array[t.resolved_id] end,
  '{}'::uuid[]
from jh_ins i
cross join jh_cfg cfg
join jh_dp d on d.day = i.day
left join jh_sb sb on sb.code = i.code
left join subjects sbj on sbj.id = sb.id
left join jh_tp t on t.day = i.day
     and t.slot = case i.slot_no when 1 then 'm' when 2 then 's' when 3 then 't' else 'x' end
order by i.day, i.slot_no;

-- ── ৭ · study_plan_assignments (টপিক → সাবটপিক পেয়ার) ─────────────────────
--  একই টপিক একাধিক দিনে পড়লেও assignment একটাই (প্রথম দিন)।
insert into study_plan_assignments (
  course_id, subject_id, topic_id, subtopic_id, routine_id, plan_day,
  first_study_date, minutes, objective_bn, priority, created_by
)
select distinct on (r.course_id, r.topic_id)
  cfg.course_id, r.subject_id, r.topic_id, null, r.id, p.day,
  r.routine_date, r.minutes, r.focus_note_bn, 'normal', cfg.admin_id
from routines r
cross join jh_cfg cfg
join jh_pl p on r.routine_date = p.d_date
where r.course_id = cfg.course_id
  and r.created_by = cfg.admin_id
  and r.created_at > now() - interval '10 minutes'
  and r.task_kind = 'study'
  and r.subject_id is not null
  and r.topic_id is not null
order by r.course_id, r.topic_id, r.routine_date, r.slot_label
on conflict (course_id, topic_id, subtopic_id) do nothing;

-- ── ৮ · ৮টি Weekly Test + দিন ৫৯-এর Full Mock (draft স্কেলেটন) ────────────
insert into exam_schedules (
  course_id, kind, exam_kind, title_en, title_bn,
  starts_at, ends_at, result_release_at,
  duration_minutes, question_count, total_marks, positive_marks, negative_marks,
  status, week_start, auto_start, routine_ids, settings, created_by
)
select
  cfg.course_id, 'weekly_special', 'weekly',
  'BCS Weekly Test ' || lpad(n::text, 2, '0') || ' — Day 1–' || ((n * 7) - 1),
  'সাপ্তাহিক পরীক্ষা ' || lpad(n::text, 2, '0') || ' — দিন ১–' || ((n * 7) - 1),
  (p.d_date + time '09:30') at time zone 'Asia/Dhaka',
  (p.d_date + time '10:20') at time zone 'Asia/Dhaka',
  (p.d_date + time '12:00') at time zone 'Asia/Dhaka',
  50, 100, 100.0, 1.0, 0.5,
  'draft', p.week_start, true,
  coalesce((select array_agg(r.id order by r.routine_date)
            from routines r
            where r.course_id = cfg.course_id
              and r.created_at > now() - interval '10 minutes'
              and r.task_kind = 'study'
              and r.routine_date between p.week_start and p.d_date), '{}'::uuid[]),
  jsonb_build_object('source', 'routine', 'coverage', 'Day 1–' || ((n * 7) - 1),
                     'note', 'স্কেলেটন — প্রশ্নের কম্পোজিশন পরে তৈরি হবে'),
  cfg.admin_id
from generate_series(1, 8) as n
cross join jh_cfg cfg
join jh_pl p on p.day = n * 7
where not exists (
  select 1 from exam_schedules e
  where e.course_id = cfg.course_id
    and e.week_start = p.week_start
    and e.exam_kind = 'weekly'
    and e.status in ('draft', 'published'));

insert into exam_schedules (
  course_id, kind, exam_kind, title_en, title_bn,
  starts_at, ends_at, result_release_at,
  duration_minutes, question_count, total_marks, positive_marks, negative_marks,
  status, week_start, auto_start, routine_ids, settings, created_by
)
select cfg.course_id, 'scheduled_mock', 'weekly',
  'Full BCS Mock — 200 questions', 'ফুল বিসিএস মক — ২০০ প্রশ্ন',
  (p.d_date + time '09:00') at time zone 'Asia/Dhaka',
  (p.d_date + time '11:00') at time zone 'Asia/Dhaka',
  (p.d_date + time '13:00') at time zone 'Asia/Dhaka',
  120, 200, 200.0, 1.0, 0.5,
  'draft', p.week_start, true, '{}'::uuid[],
  jsonb_build_object('source', 'routine', 'coverage', 'Full syllabus'),
  cfg.admin_id
from jh_cfg cfg
join jh_pl p on p.day = 59
where not exists (
  select 1 from exam_schedules e
  where e.course_id = cfg.course_id
    and e.kind = 'scheduled_mock'
    and e.starts_at = (p.d_date + time '09:00') at time zone 'Asia/Dhaka'
    and e.status in ('draft', 'published'));

-- ── ৯ · ফলাফল (এক রো-তেই সব) ───────────────────────────────────────────────
select jsonb_build_object(
  'routine_rows', (select count(*) from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'),
  'days',         (select count(distinct routine_date) from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'),
  'first_day',    (select min(routine_date)::text from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'),
  'last_day',     (select max(routine_date)::text from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'),
  'topic_ids',    (select count(*) from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'
                       and r.topic_id is not null),
  'no_topic_study_rows', (select count(*) from routines r cross join jh_cfg c
                     where r.course_id = c.course_id and r.created_at > now() - interval '10 minutes'
                       and r.task_kind = 'study' and r.subject_id is not null and r.topic_id is null),
  'assignments',  (select count(*) from study_plan_assignments a cross join jh_cfg c
                     where a.course_id = c.course_id and a.created_at > now() - interval '10 minutes'),
  'exams',        (select count(*) from exam_schedules e cross join jh_cfg c
                     where e.course_id = c.course_id and e.created_at > now() - interval '10 minutes'),
  'weak_matches', (select coalesce(jsonb_agg(jsonb_build_object(
                      'day', t.day, 'plan', t.topic_title, 'db', tp.title_bn,
                      'sim', round(t.sim::numeric, 2)) order by t.sim), '[]'::jsonb)
                   from jh_tp t join topics tp on tp.id = t.resolved_id
                   where t.sim < 1),
  'no_topic_plan', (select coalesce(jsonb_agg(distinct jsonb_build_object(
                      'code', x.code, 'topic', x.topic_title) ), '[]'::jsonb)
                    from (select day, 'm' slot, m_code code, m_topic topic_title from jh_dp
                          union all select day, 's', s_code, s_topic from jh_dp
                          union all select day, 't', t_code, t_topic from jh_dp) x
                    where x.topic_title is not null
                      and not exists (select 1 from jh_tp y
                                      where y.day = x.day and y.slot = x.slot and y.topic_title = x.topic_title))
) as result;

commit;
