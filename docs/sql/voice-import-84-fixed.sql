-- ============================================================================
--  JobHub | UNIVERSAL AI QUESTION IMPORT V2 — ফিক্সড সংস্করণ
--  English Language & Literature → Grammar → Voice | প্রশ্ন ১–৮৪
--  উৎস: Master, পৃ. 377–386   |   কোর্স: 599509ae-c4c3-440a-9463-802a4efc7a0c
--
--  আপনার দেওয়া স্ক্রিপ্টে যা ভুল ছিল, আর এখানে কী করা হয়েছে:
--
--   1. topic = "Voice"  →  ভুল।
--      Voice কোনো topic নয়, এটি Grammar topic-এর একটি subtopic (slug sub-9,
--      is_active = true)। এইভাবে দিলে STEP 5.1 "unmatched subject/topic/
--      subtopic" বলে পুরো batch বাতিল করত।
--      ফিক্স: topic = Grammar, subtopic = Voice।
--
--   2. question_kind = "previous"  →  CHECK constraint ভাঙে।
--      অনুমোদিত মান কেবল: exact_pyq | similar_concept | practice |
--      ai_generated। "previous" আসলে একটি source_type, question_kind নয়।
--      আর exact_pyq দিলেও চলত না — trg_questions_kind_honesty ট্রিগার
--      verified evidence_records (match_kind = 'exact') দাবি করে, যা ইনসার্টের
--      আগে থাকা অসম্ভব।
--      ফিক্স: question_kind = 'practice', source_type = 'previous'
--      (উৎস সৎভাবে বলা হচ্ছে, কিন্তু verified-PYQ দাবি করা হচ্ছে না)।
--
--   3. created_by = (select id from auth.users limit 1)  →  FK ভাঙে।
--      questions.created_by এবং import_batches.created_by দুটোই
--      profiles(id)-এ রেফারেন্স করে, auth.users-এ নয়।
--      ফিক্স: profiles থেকে admin_id নেওয়া হচ্ছে (b0d40cca-…)।
--
--   4. import_batches-এর চারটি NOT NULL কলাম (created_rows, failed_rows,
--      duplicate_rows, errors) কোথাও লেখা হয়নি → ইনসার্ট ফেল করত।
--      ফিক্স: ব্যাচ রেকর্ডেই পূর্ণ করা হচ্ছে।
--
--   5. source_locator (Page 377, Q-1 …) একবারও লেখা হয়নি, যদিও JSON-এ ছিল।
--      ফিক্স: আলাদা কলামে যাচ্ছে, source-এ শুধু publication নাম।
--
--   6. আগে VALIDATE (SELECT) চালিয়ে তারপর DO ব্লক abort করত — psql-এ রিপোর্টটা
--      দেখা যেত, কিন্তু transaction মরে যেত। এখন রিপোর্ট আর abort একই জায়গায়।
--
--   7. প্রতিটি statement-এর sha256 fingerprint দিয়ে ডুপ্লিকেট আটকানো হচ্ছে
--      (unique: course_id + fingerprint)। এই ৮৪টার কোনোটাই ব্যাংকে নেই —
--      যাচাই করা হয়েছে। স্ক্রিপ্ট আবার চালালে কিছুই ডাবল হবে না।
--
--  চালানোর আগে ড্রাই-রান: শেষের COMMIT; → ROLLBACK; করে দেখুন।
-- ============================================================================

begin;

drop table if exists jh_ctx, jh_in, jh_rows, jh_dedup, jh_batch;

-- STEP 0 · CONFIG
create temp table jh_ctx as
select
  coalesce(nullif(current_setting('jh.course_id', true), ''),
           '599509ae-c4c3-440a-9463-802a4efc7a0c')::uuid as course_id,
  -- profiles(id), auth.users নয়
  coalesce(nullif(current_setting('jh.created_by', true), ''),
           'b0d40cca-e34b-42fe-bc19-dae3627b7a48')::uuid as admin_id,
  ('ai-import-v2 Voice 84 — Master p.377-386 | ' ||
   to_char(now() at time zone 'Asia/Dhaka', 'YYYY-MM-DD HH24:MI'))::text as filename;

-- STEP 1 · QUESTIONS
create temp table jh_in as
select
  nullif(btrim(q->>'subject'), '')  as subject_title,
  nullif(btrim(q->>'topic'), '')    as topic_title,
  nullif(btrim(q->>'subtopic'), '') as subtopic_title,
  regexp_replace(btrim(q->>'statement'), '\s+', ' ', 'g') as st,
  btrim(q->>'option_a') as a,
  btrim(q->>'option_b') as b,
  btrim(q->>'option_c') as c,
  btrim(q->>'option_d') as d,
  case lower(btrim(q->>'correct_option'))
    when 'a' then 0::smallint when 'b' then 1::smallint
    when 'c' then 2::smallint when 'd' then 3::smallint
    when 'ক' then 0::smallint when 'খ' then 1::smallint
    when 'গ' then 2::smallint when 'ঘ' then 3::smallint
    when '0' then 0::smallint when '1' then 1::smallint
    when '2' then 2::smallint when '3' then 3::smallint
  end as co,
  btrim(q->>'explanation') as ex,
  coalesce(nullif(lower(btrim(q->>'difficulty')), ''), 'medium') as diff,
  nullif(btrim(q->>'exam_name'), '')                as exam_name,
  nullif(btrim(q->>'exam_year'), '')::smallint      as exam_year,
  nullif(btrim(q->>'source_title'), '')             as source_title,
  nullif(btrim(q->>'source_locator'), '')           as source_locator
from jsonb_array_elements($json$
[
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Select the active structure:","option_a":"The tree has been uprooted.","option_b":"The door should be kept closed.","option_c":"I have lost my watch.","option_d":"My suggestion was not accepted.","correct_option":"c","explanation":"Present Perfect Tense-এর Active গঠন হলো Subject + have/has + V3 + Object। এখানে 'I have lost my watch' বাক্যে Subject (I) নিজে কাজটি করেছে, তাই এটি Active voice।","difficulty":"easy","exam_name":"বিভিন্ন মন্ত্রণালয়ের প্রশাসনিক কর্মকর্তা","exam_year":"2019","source_title":"Master","source_locator":"Page 377, Q-1"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'Tea is liked by common people.' This is an example of-","option_a":"active voice","option_b":"passive voice","option_c":"quasi-passive voice","option_d":"double passive voice","correct_option":"b","explanation":"Object-এর Subjective form + am/is/are + V3 + by + Subject-এর Objective form গঠনে থাকায় এটি Present Indefinite Tense-এর Passive voice।","difficulty":"easy","exam_name":"টেক্সটাইল ইঞ্জিনিয়ারিং কলেজের ইনস্ট্রাক্টর","exam_year":"2018","source_title":"Master","source_locator":"Page 377, Q-2"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'The work is done by Medha'- This is an example of-","option_a":"active voice","option_b":"passive voice","option_c":"quasi-passive voice","option_d":"not any voice which are mentioned","correct_option":"b","explanation":"Subject (The work) নিষ্ক্রিয় এবং be verb (is) + V3 (done) + by + agent (Medha) গঠন ব্যবহৃত হওয়ায় এটি Passive voice।","difficulty":"easy","exam_name":"সিনিয়র স্টাফ নার্স","exam_year":"2016","source_title":"Master","source_locator":"Page 377, Q-3"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'Rice sells cheap' is-","option_a":"Passive voice","option_b":"Active voice","option_c":"Both","option_d":"None","correct_option":"b","explanation":"'Rice sells cheap' একটি Quasi-passive বাক্য, যার গঠনগত রূপ Active voice, যদিও অর্থগত দিক থেকে এটি Passive।","difficulty":"medium","exam_name":"প্রতিরক্ষা মন্ত্রণালয়ের সিভিলিয়ান স্টাফ অফিসার","exam_year":"2016","source_title":"Master","source_locator":"Page 377, Q-4"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The sentence \"This school was built in 1971\" is-","option_a":"past tense","option_b":"past indefinite","option_c":"passive","option_d":"past perfect","correct_option":"c","explanation":"স্কুলটি নিজে তৈরি হয়নি বরং অন্য কারো দ্বারা তৈরি হয়েছিল; was + V3 (built) গঠন থাকায় বাক্যটি Past Indefinite Tense-এর Passive voice।","difficulty":"easy","exam_name":"জাতীয় রাজস্ব বোর্ডের সহকারী রাজস্ব কর্মকর্তা","exam_year":"2015","source_title":"Master","source_locator":"Page 377, Q-5"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'All his pupils like him.' বাক্যটির সঠিক passive form হচ্ছে:","option_a":"He is liked by all his pupils.","option_b":"He was liked by all his pupils.","option_c":"He is like by all his pupils.","option_d":"He is being liked by all his pupils.","correct_option":"a","explanation":"Present Indefinite Tense-এর Active voice-কে Passive করার নিয়ম: Object-এর Subjective form + am/is/are + V3 + by + Subject।","difficulty":"easy","exam_name":"নির্বাচন কমিশন সচিবালয় স্টোর কিপার","exam_year":"2019","source_title":"Master","source_locator":"Page 378, Q-6"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'We read novels' – passive form voice :","option_a":"Novels is read by us.","option_b":"Novels are read by us.","option_c":"Novels is read by we.","option_d":"Novels are being read by us.","correct_option":"b","explanation":"Object 'Novels' Plural হওয়ায় Passive-এ Plural auxiliary verb 'are' বসবে এবং We-এর Objective form 'us' হবে।","difficulty":"easy","exam_name":"পরিবার পরিকল্পনা অধিদপ্তর","exam_year":"2016","source_title":"Master","source_locator":"Page 378, Q-7"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"A race was run by him.","option_a":"He run a race","option_b":"He ran a race","option_c":"He is to run a race","option_d":"He runs a race","correct_option":"b","explanation":"Past Indefinite Tense-এর Passive voice (was + V3)। তাই Active voice-এ Subject + V2 (ran) + Object হবে।","difficulty":"easy","exam_name":"দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়","exam_year":"2019","source_title":"Master","source_locator":"Page 378, Q-8"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"A song was sung by Rupa. (Change the voice)","option_a":"Rupa was sung a song.","option_b":"Rupa sings a song.","option_c":"Rupa sang a song.","option_d":"Rupa sung a song.","correct_option":"c","explanation":"was sung থাকায় এটি Past Indefinite Tense-এর Passive রূপ। Sing-এর Past form (V2) হলো sang।","difficulty":"easy","exam_name":"BSMRUST (A)","exam_year":"2014","source_title":"Master","source_locator":"Page 378, Q-9"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Choose the correct passive voice of 'BBC broadcast the breaking news.'","option_a":"The breaking news is broadcasted by BBC.","option_b":"The breaking news were broadcasted by BBC.","option_c":"The breaking news was broadcast by BBC.","option_d":"The breaking news are broadcasted by BBC.","correct_option":"c","explanation":"broadcast-এর সাথে s যুক্ত হয়নি তাই Past Indefinite; news সর্বদা singular হওয়ায় 'was' বসবে এবং broadcast-এর V3 রূপ 'broadcast'।","difficulty":"medium","exam_name":"CU (D3)","exam_year":"2015","source_title":"Master","source_locator":"Page 378, Q-10"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The best passive form of the sentence: \"We don't like idle people.\"","option_a":"We are not liked by idle people.","option_b":"Idle people are not like us.","option_c":"Idle people are not liked by us.","option_d":"Idle people are not of our liking.","correct_option":"c","explanation":"Adjective + people সর্বদা Plural হিসেবে ব্যবহৃত হয়। Present Indefinite Negative বাক্যটির Passive হবে 'Idle people are not liked by us.'","difficulty":"easy","exam_name":"17th BCS / CU (A)","exam_year":"2018","source_title":"Master","source_locator":"Page 378, Q-11"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Identify the correct passive form of 'Fortune favours the brave.'","option_a":"The brave is favoured by fortune.","option_b":"The brave was favoured by fortune.","option_c":"The brave were favoured by fortune.","option_d":"The brave are favoured by fortune.","correct_option":"d","explanation":"The + Adjective (the brave) সমগ্র সাহসী জাতিকে বোঝায় এবং Plural Common Noun হিসেবে গণ্য হয়, তাই Plural verb 'are' বসবে।","difficulty":"medium","exam_name":"সহকারী জজ / BSMRSTU (E)","exam_year":"2019","source_title":"Master","source_locator":"Page 378, Q-12"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'I don't like puffed rice.' The passive voice of the sentence is:","option_a":"Puffed rice not liked by me","option_b":"Puffed rice did not liked by me","option_c":"Puffed rice was not liked by me","option_d":"Puffed rice is not liked by me","correct_option":"d","explanation":"Present Indefinite Negative বাক্যে don't/doesn't উঠে গিয়ে am/is/are + not + V3 বসে। Puffed rice singular হওয়ায় 'is not liked' হবে।","difficulty":"easy","exam_name":"RU (A)","exam_year":"2014","source_title":"Master","source_locator":"Page 379, Q-13"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"What is the correct passive form of the sentence 'Shirley paid the bill'?","option_a":"The bill was paid by Shirley","option_b":"The bill paid by Shirley","option_c":"The bill is being paid by Shirley","option_d":"The bill has been paid by Shirley","correct_option":"a","explanation":"Past Indefinite Tense-এর Passive গঠন: Object + was/were + V3 + by + Subject।","difficulty":"easy","exam_name":"প্রাথমিক সহকারী শিক্ষক","exam_year":"2009","source_title":"Master","source_locator":"Page 379, Q-14"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Cats kill mice. Make it passive voice.","option_a":"Mice is killed by cats.","option_b":"Mice are killed by cats.","option_c":"Mice have been killed by cats.","option_d":"Mice are being killed by cats.","correct_option":"b","explanation":"Mouse-এর Plural form হলো Mice, তাই Plural auxiliary verb 'are' বসবে।","difficulty":"easy","exam_name":"সহকারী প্রকৌশলী (এলজিইডি)","exam_year":"2005","source_title":"Master","source_locator":"Page 379, Q-15"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Change into passive: 'The city planner is making all the arrangements.'","option_a":"The all arrangements have been made by the city planner.","option_b":"All arrangements are making by the city planner.","option_c":"The all arrangements had been making by the city planner.","option_d":"All the arrangements are being made by the city planner.","correct_option":"d","explanation":"Present Continuous Tense-এর Passive গঠন: Object + am/is/are + being + V3 + by + Subject।","difficulty":"easy","exam_name":"অগ্রণী ব্যাংক (অফিসার)","exam_year":"2016","source_title":"Master","source_locator":"Page 379, Q-16"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Mukti is writing a letter. Make it passive voice.","option_a":"A letter is being written by Mukti.","option_b":"A letter has been written by Mukti.","option_c":"A letter was written by Mukti.","option_d":"A letter has written by Mukti.","correct_option":"a","explanation":"Present Continuous Tense-এর Passive-এ am/is/are + being + V3 ব্যবহৃত হয়।","difficulty":"easy","exam_name":"MBSTU (D)","exam_year":"2014","source_title":"Master","source_locator":"Page 379, Q-17"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Choose the active form of the sentence – The cheques are being signed by the manager.","option_a":"The manager is signing the cheques.","option_b":"The manager signed the cheques.","option_c":"The manager was signing the cheques.","option_d":"The manager has been signing the cheques.","correct_option":"a","explanation":"are being signed থাকায় এটি Present Continuous Tense-এর Passive রূপ।","difficulty":"easy","exam_name":"JnU (D)","exam_year":"2013","source_title":"Master","source_locator":"Page 379, Q-18"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of 'They were flying kites.'","option_a":"Kites were flown by them.","option_b":"Kites were being flown by them.","option_c":"Kites were being flowing by them.","option_d":"Kites was being flown by them.","correct_option":"b","explanation":"Past Continuous Tense-এর Passive গঠন: Object + was/were + being + V3 + by + Subject-এর Objective form।","difficulty":"easy","exam_name":"RU (E)","exam_year":"2013","source_title":"Master","source_locator":"Page 379, Q-19"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'I had written the letter.' বাক্যটির Passive form হবে","option_a":"The letter was written by me.","option_b":"The letter had been written by me.","option_c":"The letter was being written by me.","option_d":"The letter was wrote by me.","correct_option":"b","explanation":"Past Perfect Tense-এর Passive গঠন: Object + had been + V3 + by + Subject-এর Objective form।","difficulty":"easy","exam_name":"প্রাথমিক সহকারী শিক্ষক","exam_year":"2012","source_title":"Master","source_locator":"Page 379, Q-20"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Chapal has made tea. Make it passive voice.","option_a":"Tea is being made by Chapal.","option_b":"Tea has been made by Chapal.","option_c":"Tea was being made by Chapal.","option_d":"Tea have been made by Chapal.","correct_option":"b","explanation":"Present Perfect Tense-এর Passive গঠন: Object + have/has been + V3 + by + Subject।","difficulty":"easy","exam_name":"উপজেলা শিক্ষা অফিসার","exam_year":"2004","source_title":"Master","source_locator":"Page 379, Q-21"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"A storm has uprooted the tree. (Select the passive form)","option_a":"The tree has been uprooted by a storm.","option_b":"The tree is uprooted by a storm.","option_c":"The tree has been uprooted for a storm.","option_d":"The tree has uprooted himself.","correct_option":"a","explanation":"Present Perfect Tense-এর Passive-এ have/has + been + V3 + by ব্যবহৃত হয়।","difficulty":"easy","exam_name":"থানা সহকারী শিক্ষা অফিসার","exam_year":"2004","source_title":"Master","source_locator":"Page 379, Q-22"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Change the voice: \"He has pulled down the curtain.\"","option_a":"The curtain had been pulled down by him.","option_b":"The curtain has down by him.","option_c":"The curtain has been pulled down by him.","option_d":"The curtain pulled down him.","correct_option":"c","explanation":"has pulled down এর Passive রূপ হবে has been pulled down; Group verb-এর preposition 'down' অপরিবর্তিত থাকে।","difficulty":"easy","exam_name":"সহকারী শিক্ষক","exam_year":"2006","source_title":"Master","source_locator":"Page 380, Q-23"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"I had been doing the work for five days. Change the voice.","option_a":"I had been done the work for five days","option_b":"The work had been done by me for five days","option_c":"The work had been being done by me for five days","option_d":"The work had been doing by me for five days","correct_option":"c","explanation":"Past Perfect Continuous Tense-এর Passive গঠন: Object + had been being + V3 + by + Subject-এর Objective form।","difficulty":"medium","exam_name":"RU (F)","exam_year":"2015","source_title":"Master","source_locator":"Page 380, Q-24"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'I shall do the work.' বাক্যটির Passive form হবে","option_a":"I shall be doing the work.","option_b":"The work may be done by me.","option_c":"The work will be done by me.","option_d":"The work would be done by me.","correct_option":"c","explanation":"Future Indefinite Tense-এর Passive: Object + shall/will + be + V3 + by + Subject। 'The work' third person হওয়ায় 'will be done' বসবে।","difficulty":"easy","exam_name":"প্রাথমিক সহকারী শিক্ষক","exam_year":"2010","source_title":"Master","source_locator":"Page 380, Q-25"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'You will be helped by me.' বাক্যটির Active form হবে","option_a":"I shall have helped you.","option_b":"I should helped you.","option_c":"I shall help you.","option_d":"I shall have helped you..","correct_option":"c","explanation":"Future Indefinite Tense-এর Passive 'You will be helped by me'-কে Active করলে 'I shall help you.' হয়।","difficulty":"easy","exam_name":"প্রাথমিক প্রধান শিক্ষক","exam_year":"2009","source_title":"Master","source_locator":"Page 380, Q-26"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'I shall be teaching him.' বাক্যটির Passive form হবে","option_a":"He shall be taught by me.","option_b":"He will be taught by me.","option_c":"He shall be being taught by me.","option_d":"He will be being taught by me.","correct_option":"d","explanation":"Future Continuous Tense-এর Passive: Object + shall/will + be + being + V3 + by + Subject।","difficulty":"medium","exam_name":"প্রাথমিক প্রধান শিক্ষক","exam_year":"2011","source_title":"Master","source_locator":"Page 380, Q-27"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'We shall be taking tea.' বাক্যটির Passive form হবে","option_a":"Tea will be being taken by us.","option_b":"Tea shall have been taken by us.","option_c":"Tea should be being taken by us.","option_d":"Tea should be taken by us.","correct_option":"a","explanation":"Future Continuous Tense-এ Object 'Tea' Subject হলে will be being + V3 + by us ব্যবহৃত হয়।","difficulty":"medium","exam_name":"প্রাথমিক সহকারী শিক্ষক","exam_year":"2010","source_title":"Master","source_locator":"Page 380, Q-28"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"He killed himself. What is the passive form?","option_a":"Himself was killed by him","option_b":"Himself would be killed by him","option_c":"He was killed himself","option_d":"He was killed by himself.","correct_option":"d","explanation":"Reflexive pronoun কখনো Subject হয় না। Subject ও Object-এর অবস্থান অপরিবর্তিত রেখে Subject + Auxiliary + V3 + by + Reflexive Object গঠনে Passive করতে হয়।","difficulty":"medium","exam_name":"IU","exam_year":"2010","source_title":"Master","source_locator":"Page 380, Q-29"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of the sentence 'Lila fans herself.' is –","option_a":"Lila was fanned by herself.","option_b":"Lila is fanned herself.","option_c":"Herself is fanned by Lila.","option_d":"Lila is fanned by herself.","correct_option":"d","explanation":"Reflexive pronoun যুক্ত Present Indefinite Tense-এর বাক্যে Subject (Lila) ও Reflexive Object (herself) স্বস্থানে থাকে এবং মাঝে 'is fanned by' বসে।","difficulty":"medium","exam_name":"প্রাক-প্রাথমিক সহঃ শিক্ষক","exam_year":"2013","source_title":"Master","source_locator":"Page 380, Q-30"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"They love each other. (Find out the correct passive form)","option_a":"Each other are loved by them.","option_b":"Each other were loved by them.","option_c":"Each other loved by them.","option_d":"They are loved by each other.","correct_option":"d","explanation":"Reciprocal pronoun কখনো Subject হয় না। Subject ও Reciprocal Object অপরিবর্তিত রেখে 'They are loved by each other.' হবে।","difficulty":"medium","exam_name":"RU","exam_year":"2005","source_title":"Master","source_locator":"Page 381, Q-31"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"They married each other. The passive form is –","option_a":"They were married by each other","option_b":"They got married","option_c":"They were married each other","option_d":"They had been married by each other","correct_option":"a","explanation":"Reciprocal pronoun যুক্ত Past Indefinite Tense-এর বাক্যকে Passive করতে Subject ও Object-এর অবস্থান ঠিক রেখে Subject + was/were + V3 + by + Reciprocal Object হয়।","difficulty":"medium","exam_name":"IU (C)","exam_year":"2013","source_title":"Master","source_locator":"Page 381, Q-32"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"He has given me a book (into passive voice)","option_a":"A book was given to me by him.","option_b":"A book has been given to me by him.","option_c":"A book has given to me by him.","option_d":"A book had been given me by him.","correct_option":"b","explanation":"Double object যুক্ত বাক্যে Direct object-কে Subject করলে Indirect object-এর পূর্বে 'to' বসে।","difficulty":"medium","exam_name":"PUST (B)","exam_year":"2013","source_title":"Master","source_locator":"Page 381, Q-33"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Passive form of 'He gave me a pen' is –","option_a":"A pen was given to me by him.","option_b":"A pen is given to me by him.","option_c":"A pen was being given to me by him.","option_d":"A pen is being given to me by him.","correct_option":"a","explanation":"Past Indefinite Tense-এ Direct object 'A pen'-কে Subject করলে 'was given to me by him' সঠিক।","difficulty":"easy","exam_name":"RU","exam_year":"2007","source_title":"Master","source_locator":"Page 381, Q-34"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'The cow gives us milk.' বাক্যটির সঠিক passive হবে-","option_a":"We are being given milk by the cow.","option_b":"We were given milk by the cow.","option_c":"Milk is given to us by the cow.","option_d":"Milk is being given to us by the cow.","correct_option":"c","explanation":"Present Indefinite Tense-এ Direct object 'Milk'-কে Subject করলে 'Milk is given to us by the cow.' সঠিক।","difficulty":"easy","exam_name":"প্রাথমিক সহকারী শিক্ষক","exam_year":"2010","source_title":"Master","source_locator":"Page 381, Q-35"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive voice of \"He made us work.\" is –","option_a":"We was made the work by him.","option_b":"Work was made by him for us.","option_c":"Work were made by him to us.","option_d":"We were made the work for him.","correct_option":"b","explanation":"প্রদত্ত অপশনগুলোর মধ্যে একমাত্র ব্যাকরণগতভাবে শুদ্ধ গঠন হলো 'Work was made by him for us.' (singular Work + was + made)।","difficulty":"hard","exam_name":"IU (G)","exam_year":"2015","source_title":"Master","source_locator":"Page 381, Q-36"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct passive voice of 'He pleases us' is-","option_a":"We are pleased by him.","option_b":"We were pleased with him.","option_c":"We are pleased with him.","option_d":"We will be pleased by him.","correct_option":"c","explanation":"Please-এর Past Participle-এর পর ব্যক্তি থাকলে by-এর পরিবর্তে 'with' বসে এবং Present Indefinite হওয়ায় 'are pleased with' হবে।","difficulty":"medium","exam_name":"BSMRSTU (E)","exam_year":"2018","source_title":"Master","source_locator":"Page 381, Q-37"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"His behaviour surprised me. (Passive)","option_a":"I surprised at his behaviour.","option_b":"I was surprised with his behaviour.","option_c":"I had been surprised at his behaviour.","option_d":"I was surprised at his behaviour.","correct_option":"d","explanation":"Surprise-এর পর আচরণ, কর্ম বা ঘটনা থাকলে Passive-এ by-এর পরিবর্তে 'at' বসে।","difficulty":"medium","exam_name":"১৫তম শিক্ষক নিবন্ধন","exam_year":"2019","source_title":"Master","source_locator":"Page 382, Q-38"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Which is the correct passive form? 'The boy pleased us.'","option_a":"We were pleased by the boy.","option_b":"We were pleased at the boy.","option_c":"We were pleased with the boy.","option_d":"We were pleased to the boy.","correct_option":"c","explanation":"Pleased-এর পর ব্যক্তি থাকায় preposition 'with' বসবে এবং Past Indefinite হওয়ায় 'were pleased with' হবে।","difficulty":"medium","exam_name":"প্রাক-প্রাথমিক সহকারী শিক্ষক","exam_year":"2014","source_title":"Master","source_locator":"Page 382, Q-39"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Which one is the correct voice form?","option_a":"I was charmed at her beauty.","option_b":"I was charmed by her beauty.","option_c":"I was charmed for her beauty.","option_d":"I was charmed to her beauty.","correct_option":"a","explanation":"Charm-এর পর গুণ বা সৌন্দর্য থাকলে Passive-এ by-এর পরিবর্তে 'at' বসে।","difficulty":"medium","exam_name":"মাধ্যমিক সহকারী শিক্ষক","exam_year":"2004","source_title":"Master","source_locator":"Page 382, Q-40"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"He annoyed me. (Select the passive form)","option_a":"I was annoyed by him.","option_b":"I was annoyed at him.","option_c":"I was annoyed with him.","option_d":"I was annoyed against him.","correct_option":"c","explanation":"Annoyed-এর পর ব্যক্তি থাকলে 'with' বসে, আর আচরণ বা বিষয় থাকলে 'at'।","difficulty":"medium","exam_name":"থানা সহকারী শিক্ষা অফিসার","exam_year":"2005","source_title":"Master","source_locator":"Page 382, Q-41"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Change the voice: His conduct annoyed me.","option_a":"He annoyed me with conduct.","option_b":"I was annoyed with his conduct.","option_c":"I was annoyed from his conduct.","option_d":"I was annoyed at his conduct.","correct_option":"d","explanation":"Annoyed-এর পর আচরণ (his conduct) থাকায় preposition 'at' বসবে।","difficulty":"medium","exam_name":"প্রতিরক্ষা মন্ত্রণালয়ের সহকারী পরিচালক","exam_year":"2018","source_title":"Master","source_locator":"Page 382, Q-42"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Give the correct passive form of \"My teacher embodies all the good qualities.\"","option_a":"All the good qualities are embodied by my teacher.","option_b":"All the good qualities are embodied in my teacher.","option_c":"All the good qualities are embodied to my teacher.","option_d":"All the good qualities are embodied on my teacher.","correct_option":"b","explanation":"Contain, embody, include, subsume ইত্যাদি verb-এর Passive-এ by-এর পরিবর্তে 'in' বসে।","difficulty":"medium","exam_name":"27th BCS / RU (E)","exam_year":"2016","source_title":"Master","source_locator":"Page 382, Q-43"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive voice of 'Panic seized me' is–","option_a":"I was seized with panic.","option_b":"I was being seized by panic.","option_c":"I was seized by panic.","option_d":"I was seized from panic.","correct_option":"a","explanation":"Cover, crowd, cram, decorate, ornament, fill, seize, throng ইত্যাদি verb-এর Past Participle-এর পর by-এর পরিবর্তে 'with' বসে।","difficulty":"medium","exam_name":"১৪তম প্রভাষক নিবন্ধন","exam_year":"2017","source_title":"Master","source_locator":"Page 382, Q-44"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Smoke fills the room. Which is the passive form of the sentence?","option_a":"The room is filled by smoke.","option_b":"The room is filled in smoke.","option_c":"The room is filled at smoke.","option_d":"The room is filled with smoke.","correct_option":"d","explanation":"Fill verb-এর Passive voice-এ by-এর পরিবর্তে 'with' বসে।","difficulty":"easy","exam_name":"সহকারী প্রকৌশলী (এলজিইডি)","exam_year":"2005","source_title":"Master","source_locator":"Page 382, Q-45"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct passive voice of 'Do you know them'?","option_a":"Is they know by you?","option_b":"Are they known to you?","option_c":"are they know by you?","option_d":"Are they know with you?","correct_option":"b","explanation":"Passive-এ 'known'-এর পর সাধারণত 'to' বসে এবং Interrogative Present Indefinite হওয়ায় Subject 'they'-এর পূর্বে 'Are' বসবে।","difficulty":"easy","exam_name":"39th BCS","exam_year":"2018","source_title":"Master","source_locator":"Page 382, Q-46"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Choose the correct passive voice: 'His behaviour worried us.'","option_a":"We were worried about his behaviour","option_b":"We were worried with his behaviour.","option_c":"We were worried by his behaviour.","option_d":"We have been worried by his behaviour","correct_option":"a","explanation":"Passive voice-এ 'worried'-এর পর by-এর পরিবর্তে 'about' বসে।","difficulty":"medium","exam_name":"প্রাক-প্রাথমিক সহকারী শিক্ষক","exam_year":"2015","source_title":"Master","source_locator":"Page 382, Q-47"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Choose the voice: \"All of his friends laughed at him\"","option_a":"He laughed at all of his friends","option_b":"He was laughed at by all of his friends.","option_c":"All his friends had laughed at him.","option_d":"All his friends were laughed at him.","correct_option":"b","explanation":"Group verb (laugh at)-এর সাথে সংযুক্ত preposition Passive voice-এ V3-এর সাথে বসে এবং এরপর 'by' বসে।","difficulty":"easy","exam_name":"BU (A)","exam_year":"2015","source_title":"Master","source_locator":"Page 383, Q-48"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct sentence of the following:","option_a":"A new cabinet has been sworn in in Dhaka","option_b":"A new cabinet has been sworn at Dhaka","option_c":"A new cabinet has been sworn by Dhaka","option_d":"A new cabinet has sworn in Dhaka","correct_option":"a","explanation":"Swear in একটি Group verb; এর Passive রূপ 'has been sworn in' এবং স্থান বোঝাতে 'in Dhaka' বসে।","difficulty":"hard","exam_name":"17th BCS / প্রাক-প্রাথমিক সহকারী শিক্ষক","exam_year":"2015","source_title":"Master","source_locator":"Page 383, Q-49"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct passive form of the sentence. 'Take care of your health.'","option_a":"Let your health taken care.","option_b":"Let your health be taken care of.","option_c":"Let your health taken care of.","option_d":"Health is taken care by you.","correct_option":"b","explanation":"Imperative sentence-এ 'take care of' group verb থাকায় Passive-এ Let + Object + be + taken care of বসে।","difficulty":"medium","exam_name":"KU (C)","exam_year":"2018","source_title":"Master","source_locator":"Page 383, Q-50"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"I knew him. Make it passive voice.","option_a":"He is known to me.","option_b":"He was known to me.","option_c":"He was known with me.","option_d":"He was known by me.","correct_option":"b","explanation":"Past Indefinite Tense হওয়ায় 'was known' বসবে এবং known-এর পর 'to' বসে।","difficulty":"easy","exam_name":"সহকারী মাধ্যমিক শিক্ষক","exam_year":"2011","source_title":"Master","source_locator":"Page 383, Q-51"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Active voice of 'They were talked of by us' is –","option_a":"They were talked of.","option_b":"Talked to us","option_c":"We had been talk of","option_d":"We talked of them.","correct_option":"d","explanation":"were talked of Past Indefinite Passive হওয়ায় Active voice-এ Subject + V2 + preposition + Object হবে।","difficulty":"easy","exam_name":"RU ইসলামের ইতিহাস","exam_year":"2009","source_title":"Master","source_locator":"Page 383, Q-52"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"My uncle looks after me. Passive form is-","option_a":"I was looked after by me uncle.","option_b":"I am looked after by my uncle.","option_c":"I am being looked after by my uncle.","option_d":"I am looking after by my uncle.","correct_option":"b","explanation":"Look after একটি Group verb। Present Indefinite Tense-এ এর Passive রূপ 'I am looked after by my uncle.'","difficulty":"easy","exam_name":"JKKNIU (খ)","exam_year":"2016","source_title":"Master","source_locator":"Page 383, Q-53"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'He called on me yesterday.' Passive of the sentence will be-","option_a":"I was called by him yesterday.","option_b":"I have been called on by him yesterday.","option_c":"I had been called on by him yesterday.","option_d":"I was called on by him yesterday.","correct_option":"d","explanation":"Call on Group verb হওয়ায় Passive-এ V3-এর সাথে 'on' যুক্ত থাকবে।","difficulty":"easy","exam_name":"BCS / Job Exam","exam_year":"2018","source_title":"Master","source_locator":"Page 383, Q-54"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct passive form of 'You must shut these doors.","option_a":"These must be shut doors","option_b":"Shut the doors you must","option_c":"Shut must be the doors","option_d":"These doors must be shut","correct_option":"d","explanation":"Modal auxiliary (must) যুক্ত বাক্যের Passive গঠন: Object + modal + be + V3।","difficulty":"easy","exam_name":"35th BCS","exam_year":"2015","source_title":"Master","source_locator":"Page 383, Q-55"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"We ought to obey our parents. (Change the voice)","option_a":"Our parents are obeyed by us.","option_b":"Our parents were obeyed by us.","option_c":"Our parents ought to be obeyed by us.","option_d":"Our parents was ought to obey by us.","correct_option":"c","explanation":"Ought to একটি Modal auxiliary verb হওয়ায় Passive-এ ought to + be + V3 বসবে।","difficulty":"easy","exam_name":"IU (H)","exam_year":"2017","source_title":"Master","source_locator":"Page 383, Q-56"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'We must listen to his words.'- বাক্যটির সঠিক পরিবর্তিত voice হবে-","option_a":"His words must be listened to","option_b":"His words should be listened to","option_c":"His words ought to be listened to","option_d":"His words may be listened to","correct_option":"a","explanation":"Modal auxiliary 'must' অপরিবর্তিত থাকে এবং Group verb 'listen to'-এর সাথে 'to' যুক্ত থাকে।","difficulty":"easy","exam_name":"প্রাথমিক প্রধান শিক্ষক","exam_year":"2009","source_title":"Master","source_locator":"Page 383, Q-57"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Change the voice: 'We will not admit children under ten.'","option_a":"Children under ten will not be admitted by us.","option_b":"Children under ten will be not admitted by us.","option_c":"Children under ten would not be admitted by us.","option_d":"Children under ten shall not be admitted by us.","correct_option":"a","explanation":"Negative Modal sentence-এর Passive গঠন: Object + modal + not + be + V3 + by + Subject।","difficulty":"easy","exam_name":"BSMRSTU","exam_year":"2014","source_title":"Master","source_locator":"Page 384, Q-58"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Find out the active form of the sentence \"Our parents should be respected by us\"","option_a":"We respect our parents","option_b":"We should respect our parents","option_c":"We should honour our parents","option_d":"Parents should be respected by us","correct_option":"b","explanation":"should be respected Passive হওয়ায় Active voice-এ Subject + should + V1 + Object হবে।","difficulty":"easy","exam_name":"KU (জীব, স্কুল)","exam_year":"2001","source_title":"Master","source_locator":"Page 384, Q-59"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct passive form is: (তারা নষ্ট গাড়ি মেরামত করতো)","option_a":"Broken cars are used to repair by them.","option_b":"Broken cars used to be repaired by them.","option_c":"Broken cars used to be repair by them.","option_d":"Broken cars are used to be repaired by them.","correct_option":"b","explanation":"Active: They used to repair broken cars। used to semi-modal হওয়ায় Passive-এ Object + used to + be + V3 + by + Subject হয়।","difficulty":"medium","exam_name":"RU (আইন, রাষ্ট্রবিজ্ঞান)","exam_year":"2007","source_title":"Master","source_locator":"Page 384, Q-60"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Identify the correct passive form of \"He is going to open a shop.\"","option_a":"He is being gone to open a shop.","option_b":"A shop is being gone opened by him.","option_c":"A shop will be opened by him.","option_d":"A shop is going to be opened by him.","correct_option":"d","explanation":"be going to যুক্ত Active বাক্যের Passive-এ going অপরিবর্তিত থাকে; Object + be verb + going to + be + V3 + by + Subject বসে।","difficulty":"easy","exam_name":"26th BCS / JUST (B)","exam_year":"2016","source_title":"Master","source_locator":"Page 384, Q-61"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of \"The Home office is going to renew my passport\" is","option_a":"My passport will be renewed by the Home office.","option_b":"My passport is to be renewed by the Home office.","option_c":"My passport is being renewed by the Home office.","option_d":"My passport is going to be renewed by the Home office.","correct_option":"d","explanation":"is going to renew-এর Passive রূপ হবে is going to be renewed।","difficulty":"easy","exam_name":"CU (E)","exam_year":"2012","source_title":"Master","source_locator":"Page 384, Q-62"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"What is the correct passive form of 'He is going to build a house'?","option_a":"A house is going to be building","option_b":"A house is going to be built.","option_c":"A house is being gone to build","option_d":"A house is gone to be built.","correct_option":"b","explanation":"be going to + V1 যুক্ত বাক্যের Passive গঠন হলো be going to + be + V3।","difficulty":"easy","exam_name":"JnU (C)","exam_year":"2010","source_title":"Master","source_locator":"Page 384, Q-63"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'He is going to set up a school.' বাক্যটির সঠিক পরিবর্তিত voice হবে-","option_a":"A school is going to be set up by him","option_b":"A school is being set up by him","option_c":"A school is gone to be set up by him","option_d":"A school has been going to be set up by him","correct_option":"a","explanation":"is going to set up-এর Passive রূপ হবে is going to be set up (set-এর V3 হলো set)।","difficulty":"easy","exam_name":"প্রাথমিক প্রধান শিক্ষক","exam_year":"2009","source_title":"Master","source_locator":"Page 384, Q-64"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Correct passive form of \"I have to do it\" is","option_a":"It has to be done by me.","option_b":"It is to be done by me.","option_c":"It has to be done to me.","option_d":"Let it be done by me.","correct_option":"a","explanation":"Active voice-এ have to / has to থাকলে Passive-এ Subject অনুযায়ী have to / has to + be + V3 + by + Subject বসে।","difficulty":"easy","exam_name":"DU / IU (BBA)","exam_year":"2015","source_title":"Master","source_locator":"Page 384, Q-65"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'It has to be done by me' বাক্যটির সঠিক পরিবর্তিত voice হবে-","option_a":"I must do it.","option_b":"I should do it.","option_c":"It must have done it.","option_d":"I have to do it.","correct_option":"d","explanation":"has to be done Passive হওয়ায় এর Active রূপ হবে 'I have to do it.'","difficulty":"easy","exam_name":"CU (A)","exam_year":"2018","source_title":"Master","source_locator":"Page 385, Q-66"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"You are to colour this picture. The passive form:","option_a":"This picture has to be coloured by you","option_b":"This picture is to be colour by you","option_c":"This picture is to be coloured by you","option_d":"This picture is being coloured by you","correct_option":"c","explanation":"Active voice-এ am to / is to / are to থাকলে Passive-এ am to / is to / are to + be + V3 বসে।","difficulty":"easy","exam_name":"ডাক বিভাগের মেইল অপারেটর","exam_year":"2019","source_title":"Master","source_locator":"Page 385, Q-67"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of the sentence 'A child could not have done this mischief.' is","option_a":"This mischief could not have been done by a child.","option_b":"This mischief could not been done by a child.","option_c":"This mischief could not have be done by a child.","option_d":"This mischief a child could not have been done.","correct_option":"a","explanation":"Active: Subject + modals + have + V3 + Object হলে Passive: Object + modals + have + been + V3 + by + Subject।","difficulty":"medium","exam_name":"CU (B7)","exam_year":"2014","source_title":"Master","source_locator":"Page 385, Q-68"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The correct active form of the sentence \"It must have been stolen by him\" is–","option_a":"He must have stolen it.","option_b":"He must have been stolen by it.","option_c":"It was stolen by them.","option_d":"They must steal it.","correct_option":"a","explanation":"must have been stolen Passive হওয়ায় Active-এ 'He must have stolen it.' হবে।","difficulty":"easy","exam_name":"NU","exam_year":"2006","source_title":"Master","source_locator":"Page 385, Q-69"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Choose the correct passive statement of \"You should have done it.\"","option_a":"You should have done it.","option_b":"It should have been done by you.","option_c":"It should have done by you.","option_d":"It would have been done by you.","correct_option":"b","explanation":"should have + V3-এর Passive রূপ হবে should have been + V3।","difficulty":"easy","exam_name":"RU","exam_year":"2009","source_title":"Master","source_locator":"Page 385, Q-70"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'Obey your parents' The passive form is -","option_a":"Your parents were obeyed.","option_b":"Your parents must be obeyed.","option_c":"Your parents are to be obeyed.","option_d":"Your parents should be obeyed.","correct_option":"d","explanation":"নৈতিক বা বাস্তবিক অপরিহার্য উপদেশবাচক Imperative Sentence-এ Let না থাকলে Object + should be + V3 গঠনে Passive করা যায়।","difficulty":"medium","exam_name":"IU (C)","exam_year":"2013","source_title":"Master","source_locator":"Page 385, Q-71"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Change the voice: Shut the door at once.","option_a":"The door be shut at once.","option_b":"Let the door be shut at once.","option_c":"Let the door shut at once.","option_d":"The door be shutes at once.","correct_option":"b","explanation":"মূল verb দ্বারা শুরু হওয়া Imperative Sentence-কে Passive করার নিয়ম: Let + Object + be + V3 + বাকি অংশ।","difficulty":"easy","exam_name":"JnU (A)","exam_year":"2013","source_title":"Master","source_locator":"Page 385, Q-72"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Identify the correct passive form 'Open the window'.","option_a":"The window should be opened.","option_b":"Let the window be opened.","option_c":"Let the window be opened by you.","option_d":"The window must be opened.","correct_option":"b","explanation":"সাধারণ আদেশমূলক Imperative Sentence-এ Let + Object + be + V3 ব্যবহৃত হয় এবং 'by you' লেখা হয় না।","difficulty":"easy","exam_name":"RU (G)","exam_year":"2011","source_title":"Master","source_locator":"Page 385, Q-73"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Make the sentence passive: 'Always speak the truth'","option_a":"Let the truth be spoked always.","option_b":"Let the truth be spoken always.","option_c":"Let the truth had spoken always.","option_d":"Let the truth was spoken always.","correct_option":"b","explanation":"Imperative Sentence-এ Let + Object + be + V3 (spoken) + always গঠনে Passive করতে হয়।","difficulty":"easy","exam_name":"IU","exam_year":"2010","source_title":"Master","source_locator":"Page 385, Q-74"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'Let him be told to go' change the voice is-","option_a":"Go","option_b":"Let you go.","option_c":"You go.","option_d":"Tell him to go.","correct_option":"d","explanation":"Let him be told to go Imperative Passive হওয়ায় এর Active রূপ হবে 'Tell him to go.'","difficulty":"medium","exam_name":"NSI সহকারী পরিচালক","exam_year":"2015","source_title":"Master","source_locator":"Page 386, Q-75"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"What is the passive voice \"Do away with it\"?","option_a":"Let it be done away with.","option_b":"Let it has been away with.","option_c":"Let it is to be done away with.","option_d":"Let it has to do away with","correct_option":"a","explanation":"Do away with একটি Group verb। Imperative Sentence হওয়ায় Passive হবে 'Let it be done away with.'","difficulty":"medium","exam_name":"IU (G)","exam_year":"2014","source_title":"Master","source_locator":"Page 386, Q-76"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of the sentence \"Tell him to go\" is-","option_a":"Let him told to go.","option_b":"Let him be told to go.","option_c":"Let he be told to go.","option_d":"Let him tell to be gone.","correct_option":"b","explanation":"Imperative Sentence-এ Let-এর পর Object-এর Objective form (him) বসে এবং এরপর be + V3 + বাকি অংশ বসে।","difficulty":"easy","exam_name":"RU","exam_year":"2009","source_title":"Master","source_locator":"Page 386, Q-77"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of 'Don't do it' is–","option_a":"Let not it be done","option_b":"Let not it be do","option_c":"Let it be done not","option_d":"Let it not be done","correct_option":"d","explanation":"Do not দ্বারা শুরু হওয়া Imperative Sentence-এর Object Pronoun (it) হলে Pronoun-এর পরে 'not' বসে (Noun হলে Let not-এর পরে বসে)।","difficulty":"medium","exam_name":"BRUR (C)","exam_year":"2016","source_title":"Master","source_locator":"Page 386, Q-78"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Mention the passive Voice, 'Don't neglect the poor.'","option_a":"Let the poor be neglected.","option_b":"Let not the poor be neglected.","option_c":"Let not the poor neglected.","option_d":"Poor don't be neglected.","correct_option":"b","explanation":"Do not দ্বারা শুরু হওয়া Imperative Sentence-এ Object Noun হলে গঠন হয়: Let not + Object + be + V3।","difficulty":"easy","exam_name":"RU (G)","exam_year":"2014","source_title":"Master","source_locator":"Page 386, Q-79"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"The passive form of the sentence 'Do not open the door' is-","option_a":"Let not the door be opened.","option_b":"Let not the door open.","option_c":"Let not the door be open.","option_d":"Let not the door opened.","correct_option":"a","explanation":"Object 'the door' একটি Noun হওয়ায় Let not + the door + be + V3 (opened) ব্যবহৃত হবে।","difficulty":"easy","exam_name":"গণপূর্ত অধিদপ্তরের উপ-সহকারী প্রকৌশলী","exam_year":"2018","source_title":"Master","source_locator":"Page 386, Q-80"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Let her sing a song. Passive form is-","option_a":"Let a song be sung by her","option_b":"Let a song be sang by her","option_c":"Let a song sing by her","option_d":"Let a song sung by her","correct_option":"a","explanation":"Let + ব্যক্তিবাচক Object + V1 + বস্তুবাচক Object থাকলে Passive হয়: Let + বস্তুবাচক Object + be + V3 + by + ব্যক্তিবাচক Object।","difficulty":"easy","exam_name":"JU (E)","exam_year":"2014","source_title":"Master","source_locator":"Page 386, Q-81"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Let me do the work. Its passive form is :","option_a":"Let the work done me.","option_b":"Let the work be done.","option_c":"Let me be done the work.","option_d":"Let the work be done by me.","correct_option":"d","explanation":"Let me do the work-এর Passive হবে Let + the work + be + done + by + me।","difficulty":"easy","exam_name":"RU (A2)","exam_year":"2019","source_title":"Master","source_locator":"Page 386, Q-82"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"Let me write a letter. বাক্যটির Passive হবে-","option_a":"Let a letter be write by me.","option_b":"Let a letter be written by me.","option_c":"Let a letter to write by me.","option_d":"Let a letter is written by me.","correct_option":"b","explanation":"Write-এর Past Participle হলো written। তাই Passive গঠন হবে 'Let a letter be written by me.'","difficulty":"easy","exam_name":"BSMRSTU (A)","exam_year":"2012","source_title":"Master","source_locator":"Page 386, Q-83"},
  {"subject":"English Language & Literature","topic":"Grammar","subtopic":"Voice","statement":"'Never catch the Jatka.' Make it passive.","option_a":"Let the Jatka never be caught.","option_b":"Let not the Jatka ever be caught.","option_c":"Never the Jatka be caught by you.","option_d":"The Jatka is caught by you.","correct_option":"b","explanation":"Never যুক্ত Imperative Sentence-এর Passive দুটি গঠনে হয়: Let never + Object + be + V3 অথবা Let not + Object + ever + be + V3।","difficulty":"medium","exam_name":"BRUR (C)","exam_year":"2016","source_title":"Master","source_locator":"Page 386, Q-84"}
]
$json$::jsonb) as q;

-- STEP 2 · REPORT (শুধু সমস্যাগুলো দেখায়; পরিষ্কার হলে কিছু ফেরত দেয় না)
select
  st as statement,
  array_remove(array[
    case when st is null or length(st) < 8 then 'Statement too short' end,
    case when subject_title  is null then 'Missing subject' end,
    case when topic_title    is null then 'Missing topic' end,
    case when subtopic_title is null then 'Missing subtopic' end,
    case when a is null or a='' or b is null or b='' or c is null or c=''
           or d is null or d='' then 'Missing option' end,
    case when a=b or a=c or a=d or b=c or b=d or c=d then 'Duplicate options' end,
    case when co is null then 'Invalid correct option' end,
    case when diff not in ('easy','medium','hard') then 'Invalid difficulty' end,
    case when ex is null or ex='' then 'Missing explanation' end,
    case when source_locator is null then 'Missing source_locator' end,
    case when exam_year is not null and exam_year < 1971 then 'Invalid exam year' end
  ], null) as problems
from jh_in
where st is null or length(st) < 8
   or subject_title is null or topic_title is null or subtopic_title is null
   or a is null or a='' or b is null or b='' or c is null or c='' or d is null or d=''
   or a=b or a=c or a=d or b=c or b=d or c=d
   or co is null or diff not in ('easy','medium','hard')
   or ex is null or ex='' or source_locator is null
   or (exam_year is not null and exam_year < 1971);

-- STEP 3 · STRICT VALIDATION
do $$
declare bad int; dup int;
begin
  select count(*) into bad from jh_in
  where st is null or length(st) < 8
     or subject_title is null or topic_title is null or subtopic_title is null
     or a is null or a='' or b is null or b='' or c is null or c='' or d is null or d=''
     or a=b or a=c or a=d or b=c or b=d or c=d
     or co is null or diff not in ('easy','medium','hard')
     or ex is null or ex='' or source_locator is null
     or (exam_year is not null and exam_year < 1971);
  if bad > 0 then
    raise exception '% invalid questions found. Import cancelled.', bad;
  end if;

  select count(*) into dup from (
    select st from jh_in group by st having count(*) > 1
  ) d;
  if dup > 0 then
    raise exception '% duplicate statements found. Import cancelled.', dup;
  end if;
end $$;

-- STEP 4 · MAP SUBJECT / TOPIC / SUBTOPIC
--  subject guard: t.subject_id = s.id রাখা হয়েছে, তাই প্রশ্ন কখনো ভুল
--  subject-এ যেতে পারে না। title_bn অথবা title_en — যেটায় মিলবে।
create temp table jh_rows as
select i.*, c.course_id, c.admin_id as _admin,
       s.id as subject_id, t.id as topic_id, sub.id as subtopic_id
from jh_in i
cross join jh_ctx c
left join subjects s
  on s.course_id = c.course_id
 and (lower(btrim(s.title_bn)) = lower(btrim(i.subject_title))
   or lower(btrim(s.title_en)) = lower(btrim(i.subject_title)))
left join topics t
  on t.subject_id = s.id
 and t.is_active
 and (lower(btrim(t.title_bn)) = lower(btrim(i.topic_title))
   or lower(btrim(t.title_en)) = lower(btrim(i.topic_title)))
left join subtopics sub
  on sub.topic_id = t.id
 and sub.is_active
 and (lower(btrim(sub.title_bn)) = lower(btrim(i.subtopic_title))
   or lower(btrim(sub.title_en)) = lower(btrim(i.subtopic_title)));

do $$
declare unmapped int; detail text;
begin
  select count(*) into unmapped from jh_rows
  where subject_id is null or topic_id is null
     or (subtopic_title is not null and subtopic_id is null);
  if unmapped > 0 then
    select string_agg(distinct
             coalesce('subject=' || subject_title, '?') || ' / topic=' ||
             coalesce(topic_title, '?') || ' / subtopic=' ||
             coalesce(subtopic_title, '-'), '; ')
      into detail
      from jh_rows
     where subject_id is null or topic_id is null
        or (subtopic_title is not null and subtopic_id is null);
    raise exception '% questions have unmatched subject/topic/subtopic: %. Import cancelled.',
      unmapped, detail;
  end if;
end $$;

-- STEP 5 · DEDUPE AGAINST EXISTING BANK
create temp table jh_dedup as
select r.*
from jh_rows r
where not exists (
  select 1 from questions q
  where q.course_id = r.course_id
    and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
);

-- STEP 6 · IMPORT BATCH RECORD
create temp table jh_batch as select gen_random_uuid() as id;

insert into import_batches (
  id, created_by, filename, format, mode,
  total_rows, created_rows, failed_rows, duplicate_rows, errors
)
select b.id, c.admin_id, c.filename, 'json', 'commit',
       (select count(*) from jh_rows),
       (select count(*) from jh_dedup),
       0,
       (select count(*) from jh_rows) - (select count(*) from jh_dedup),
       '[]'::jsonb
from jh_batch b cross join jh_ctx c;

-- STEP 7 · INSERT
--  question_kind = 'practice' (exact_pyq নয় — কোনো verified evidence নেই)
--  source_type   = 'previous' (Master-এ ছাপা বিগত বছরের প্রশ্ন)
--  status        = 'pending_review' (এডিটর যাচাই করার আগ পর্যন্ত)
insert into questions (
  course_id, subject_id, topic_id, subtopic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty,
  source, source_title, source_locator,
  source_type, status, is_verified,
  question_type, question_kind, fingerprint,
  exam_name, year, import_batch_id, created_by
)
select r.course_id, r.subject_id, r.topic_id, r.subtopic_id, r.st,
       r.a, r.b, r.c, r.d, r.co,
       r.ex, r.diff,
       coalesce(r.source_title, 'Master'), r.source_title, r.source_locator,
       'previous', 'pending_review', false,
       'mcq', 'practice',
       encode(sha256(convert_to(r.st, 'UTF8')), 'hex'),
       r.exam_name, r.exam_year, b.id, r._admin
from jh_dedup r cross join jh_batch b
on conflict (course_id, fingerprint) do nothing;

-- STEP 8 · CONFIRM
update import_batches
set created_rows = (select count(*) from questions
                     where import_batch_id = (select id from jh_batch))
where id = (select id from jh_batch);

select
  (select count(*) from jh_rows)                                   as planned,
  (select count(*) from jh_dedup)                                  as to_insert,
  (select count(*) from questions
    where import_batch_id = (select id from jh_batch))              as inserted_now,
  (select count(*) from jh_rows) - (select count(*) from jh_dedup)  as skipped_existing,
  (select count(*) from questions q
    where q.subtopic_id = (select sub.id
                             from subtopics sub
                             join topics t   on t.id = sub.topic_id
                             join subjects s on s.id = t.subject_id
                            where s.course_id = (select course_id from jh_ctx)
                              and s.slug       = 'english'
                              and t.title_bn   = 'Grammar'
                              and sub.title_bn = 'Voice'))          as voice_total_after;

commit;
