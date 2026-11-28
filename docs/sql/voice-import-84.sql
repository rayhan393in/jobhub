-- =====================================================================
--  JobHub · প্রশ্ন ঢোকার স্ক্রিপ্ট — Voice (প্রশ্ন ১–৮৪) | Master পৃ. ৩৭৭–৩৮৬
--  পুরোটা একসাথে রান করুন।  ভুল থাকলে কিছুই ইনসার্ট হবে না।
--
--  আগের সংস্করণে যে ৩টি বাগ ছিল, এবং এখানে কী করা হয়েছে:
--
--   ১. আপনার VALUES টেবিলে 'English Language & Literature','Voice' —
--      অর্থাৎ Voice কে TOPIC হিসেবে দেওয়া ছিল। কিন্তু ডেটাবেজে Voice হলো
--      Grammar টপিকের SUBTOPIC (slug sub-9)। তাই STEP 2-এ
--      "বিষয়/টপিক পাওয়া যায়নি: English Language & Literature → Voice"
--      এরর আসছিল।
--      ফিক্স: VALUES-এ এখন (subject, topic, subtopic) — তিনটাই আলাদা,
--      অর্থাৎ 'English Language & Literature', 'Grammar', 'Voice'।
--
--   ২. questions-এর status = 'pending_review' আর is_verified = false রাখা
--      হচ্ছিল, কিন্তু STEP 4 শেষে question_kind = 'exact_pyq' করে দেওয়া হচ্ছিল।
--      এতে questions_check (status='approved' হলে is_verified=true) না ভাঙলেও
--      "verified PYQ" দাবিটা মিথ্যা থেকে যেত — অথচ এখানে প্রমাণ (evidence)
--      তৈরি হচ্ছে verified_by দিয়ে। এখন exact_pyq + previous হলে
--      status='approved', is_verified=true, verified_by/verified_at সেট হবে।
--      Master-এ ছাপা বিগত বছরের প্রশ্ন + verified evidence = approved PYQ।
--
--   ৩. INSERT-এ subtopic_id পাঠানো হচ্ছিল না, ফলে Voice-এর মতো সাবটপিক
--      থাকলেও প্রশ্নগুলো শুধু Grammar টপিকে আটকে থাকত এবং Voice-এর
--      প্রগ্রেস/কভারেজে কখনো গণ্য হতো না। একইভাবে source_locator-ও
--      বাদ পড়ছিল।
--      ফিক্স: দুটোই এখন INSERT-এ যাচ্ছে।
--
--   ৪. STEP 5-এ jh_dedup এবং questions — দুই টেবিলেই "statement" আছে,
--      তাই দ.statement / q2.statement দ্ব্যর্থক (42702) হতো।
--      ফিক্স: সব কলাম alias দিয়ে qualify করা হয়েছে।
--
--  স্ক্রিপ্ট idempotent: আবার চালালে নতুন কিছু ঢুকবে না
--  (course_id + sha256(statement) ইউনিক)।
-- =====================================================================

-- ── STEP 0 · কোর্স ──────────────────────────────────────────────────────
--  বিসিএস  = 599509ae-c4c3-440a-9463-802a4efc7a0c
--  পেট্রোবাংলা = 4ab82963-892e-4c69-9a5d-09d289c33c04
drop table if exists jh_ctx;
create temp table jh_ctx as
select
  '599509ae-c4c3-440a-9463-802a4efc7a0c'::uuid as course_id,
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id,
  -- true  → Master-এ ছাপা PYQ হিসেবে evidence তৈরি করে exact_pyq + approved
  -- false → শুধু pending_review + practice (নিজে যাচাই করে পরে approve করবেন)
  true as approve_pyq;

-- ── STEP 1 · প্রশ্ন ──────────────────────────────────────────────────────
--  কলাম ক্রম: statement, a, b, c, d, correct_option(0=ক 1=খ 2=গ 3=ঘ),
--            explanation, difficulty, subject, topic, subtopic,
--            exam_name, exam_year, source_title, source_locator
drop table if exists jh_in;
create temp table jh_in as
select * from (values
  ('Select the active structure:', 'The tree has been uprooted.', 'The door should be kept closed.', 'I have lost my watch.', 'My suggestion was not accepted.', 2, 'Present Perfect Tense-এর Active গঠন হলো Subject + have/has + V3 + Object। এখানে ''I have lost my watch'' বাক্যে Subject (I) নিজে কাজটি করেছে, তাই এটি Active voice।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'বিভিন্ন মন্ত্রণালয়ের প্রশাসনিক কর্মকর্তা', 2019, 'Master', 'Page 377, Q-1'),
  ('''Tea is liked by common people.'' This is an example of-', 'active voice', 'passive voice', 'quasi-passive voice', 'double passive voice', 1, 'Object-এর Subjective form + am/is/are + V3 + by + Subject-এর Objective form গঠনে থাকায় এটি Present Indefinite Tense-এর Passive voice।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'টেক্সটাইল ইঞ্জিনিয়ারিং কলেজের ইনস্ট্রাক্টর', 2018, 'Master', 'Page 377, Q-2'),
  ('''The work is done by Medha''- This is an example of-', 'active voice', 'passive voice', 'quasi-passive voice', 'not any voice which are mentioned', 1, 'Subject (The work) নিষ্ক্রিয় এবং be verb (is) + V3 (done) + by + agent (Medha) গঠন ব্যবহৃত হওয়ায় এটি Passive voice।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'সিনিয়র স্টাফ নার্স', 2016, 'Master', 'Page 377, Q-3'),
  ('''Rice sells cheap'' is-', 'Passive voice', 'Active voice', 'Both', 'None', 1, '''Rice sells cheap'' একটি Quasi-passive বাক্য, যার গঠনগত রূপ Active voice, যদিও অর্থগত দিক থেকে এটি Passive।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রতিরক্ষা মন্ত্রণালয়ের সিভিলিয়ান স্টাফ অফিসার', 2016, 'Master', 'Page 377, Q-4'),
  ('The sentence "This school was built in 1971" is-', 'past tense', 'past indefinite', 'passive', 'past perfect', 2, 'স্কুলটি নিজে তৈরি হয়নি বরং অন্য কারো দ্বারা তৈরি হয়েছিল; was + V3 (built) গঠন থাকায় বাক্যটি Past Indefinite Tense-এর Passive voice।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'জাতীয় রাজস্ব বোর্ডের সহকারী রাজস্ব কর্মকর্তা', 2015, 'Master', 'Page 377, Q-5'),
  ('''All his pupils like him.'' বাক্যটির সঠিক passive form হচ্ছে:', 'He is liked by all his pupils.', 'He was liked by all his pupils.', 'He is like by all his pupils.', 'He is being liked by all his pupils.', 0, 'Present Indefinite Tense-এর Active voice-কে Passive করার নিয়ম: Object-এর Subjective form + am/is/are + V3 + by + Subject।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'নির্বাচন কমিশন সচিবালয় স্টোর কিপার', 2019, 'Master', 'Page 378, Q-6'),
  ('''We read novels'' – passive form voice :', 'Novels is read by us.', 'Novels are read by us.', 'Novels is read by we.', 'Novels are being read by us.', 1, 'Object ''Novels'' Plural হওয়ায় Passive-এ Plural auxiliary verb ''are'' বসবে এবং We-এর Objective form ''us'' হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'পরিবার পরিকল্পনা অধিদপ্তর', 2016, 'Master', 'Page 378, Q-7'),
  ('A race was run by him.', 'He run a race', 'He ran a race', 'He is to run a race', 'He runs a race', 1, 'Past Indefinite Tense-এর Passive voice (was + V3)। তাই Active voice-এ Subject + V2 (ran) + Object হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়', 2019, 'Master', 'Page 378, Q-8'),
  ('A song was sung by Rupa. (Change the voice)', 'Rupa was sung a song.', 'Rupa sings a song.', 'Rupa sang a song.', 'Rupa sung a song.', 2, 'was sung থাকায় এটি Past Indefinite Tense-এর Passive রূপ। Sing-এর Past form (V2) হলো sang।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'BSMRUST (A)', 2014, 'Master', 'Page 378, Q-9'),
  ('Choose the correct passive voice of ''BBC broadcast the breaking news.''', 'The breaking news is broadcasted by BBC.', 'The breaking news were broadcasted by BBC.', 'The breaking news was broadcast by BBC.', 'The breaking news are broadcasted by BBC.', 2, 'broadcast-এর সাথে s যুক্ত হয়নি তাই Past Indefinite; news সর্বদা singular হওয়ায় ''was'' বসবে এবং broadcast-এর V3 রূপ ''broadcast''।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'CU (D3)', 2015, 'Master', 'Page 378, Q-10'),
  ('The best passive form of the sentence: "We don''t like idle people."', 'We are not liked by idle people.', 'Idle people are not like us.', 'Idle people are not liked by us.', 'Idle people are not of our liking.', 2, 'Adjective + people সর্বদা Plural হিসেবে ব্যবহৃত হয়। Present Indefinite Negative বাক্যটির Passive হবে ''Idle people are not liked by us.''', 'easy', 'English Language & Literature', 'Grammar', 'Voice', '17th BCS / CU (A)', 2018, 'Master', 'Page 378, Q-11'),
  ('Identify the correct passive form of ''Fortune favours the brave.''', 'The brave is favoured by fortune.', 'The brave was favoured by fortune.', 'The brave were favoured by fortune.', 'The brave are favoured by fortune.', 3, 'The + Adjective (the brave) সমগ্র সাহসী জাতিকে বোঝায় এবং Plural Common Noun হিসেবে গণ্য হয়, তাই Plural verb ''are'' বসবে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'সহকারী জজ / BSMRSTU (E)', 2019, 'Master', 'Page 378, Q-12'),
  ('''I don''t like puffed rice.'' The passive voice of the sentence is:', 'Puffed rice not liked by me', 'Puffed rice did not liked by me', 'Puffed rice was not liked by me', 'Puffed rice is not liked by me', 3, 'Present Indefinite Negative বাক্যে don''t/doesn''t উঠে গিয়ে am/is/are + not + V3 বসে। Puffed rice singular হওয়ায় ''is not liked'' হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU (A)', 2014, 'Master', 'Page 379, Q-13'),
  ('What is the correct passive form of the sentence ''Shirley paid the bill''?', 'The bill was paid by Shirley', 'The bill paid by Shirley', 'The bill is being paid by Shirley', 'The bill has been paid by Shirley', 0, 'Past Indefinite Tense-এর Passive গঠন: Object + was/were + V3 + by + Subject।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক সহকারী শিক্ষক', 2009, 'Master', 'Page 379, Q-14'),
  ('Cats kill mice. Make it passive voice.', 'Mice is killed by cats.', 'Mice are killed by cats.', 'Mice have been killed by cats.', 'Mice are being killed by cats.', 1, 'Mouse-এর Plural form হলো Mice, তাই Plural auxiliary verb ''are'' বসবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'সহকারী প্রকৌশলী (এলজিইডি)', 2005, 'Master', 'Page 379, Q-15'),
  ('Change into passive: ''The city planner is making all the arrangements.''', 'The all arrangements have been made by the city planner.', 'All arrangements are making by the city planner.', 'The all arrangements had been making by the city planner.', 'All the arrangements are being made by the city planner.', 3, 'Present Continuous Tense-এর Passive গঠন: Object + am/is/are + being + V3 + by + Subject।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'অগ্রণী ব্যাংক (অফিসার)', 2016, 'Master', 'Page 379, Q-16'),
  ('Mukti is writing a letter. Make it passive voice.', 'A letter is being written by Mukti.', 'A letter has been written by Mukti.', 'A letter was written by Mukti.', 'A letter has written by Mukti.', 0, 'Present Continuous Tense-এর Passive-এ am/is/are + being + V3 ব্যবহৃত হয়।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'MBSTU (D)', 2014, 'Master', 'Page 379, Q-17'),
  ('Choose the active form of the sentence – The cheques are being signed by the manager.', 'The manager is signing the cheques.', 'The manager signed the cheques.', 'The manager was signing the cheques.', 'The manager has been signing the cheques.', 0, 'are being signed থাকায় এটি Present Continuous Tense-এর Passive রূপ।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'JnU (D)', 2013, 'Master', 'Page 379, Q-18'),
  ('The passive form of ''They were flying kites.''', 'Kites were flown by them.', 'Kites were being flown by them.', 'Kites were being flowing by them.', 'Kites was being flown by them.', 1, 'Past Continuous Tense-এর Passive গঠন: Object + was/were + being + V3 + by + Subject-এর Objective form।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU (E)', 2013, 'Master', 'Page 379, Q-19'),
  ('''I had written the letter.'' বাক্যটির Passive form হবে', 'The letter was written by me.', 'The letter had been written by me.', 'The letter was being written by me.', 'The letter was wrote by me.', 1, 'Past Perfect Tense-এর Passive গঠন: Object + had been + V3 + by + Subject-এর Objective form।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক সহকারী শিক্ষক', 2012, 'Master', 'Page 379, Q-20'),
  ('Chapal has made tea. Make it passive voice.', 'Tea is being made by Chapal.', 'Tea has been made by Chapal.', 'Tea was being made by Chapal.', 'Tea have been made by Chapal.', 1, 'Present Perfect Tense-এর Passive গঠন: Object + have/has been + V3 + by + Subject।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'উপজেলা শিক্ষা অফিসার', 2004, 'Master', 'Page 379, Q-21'),
  ('A storm has uprooted the tree. (Select the passive form)', 'The tree has been uprooted by a storm.', 'The tree is uprooted by a storm.', 'The tree has been uprooted for a storm.', 'The tree has uprooted himself.', 0, 'Present Perfect Tense-এর Passive-এ have/has + been + V3 + by ব্যবহৃত হয়।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'থানা সহকারী শিক্ষা অফিসার', 2004, 'Master', 'Page 379, Q-22'),
  ('Change the voice: "He has pulled down the curtain."', 'The curtain had been pulled down by him.', 'The curtain has down by him.', 'The curtain has been pulled down by him.', 'The curtain pulled down him.', 2, 'has pulled down এর Passive রূপ হবে has been pulled down; Group verb-এর preposition ''down'' অপরিবর্তিত থাকে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'সহকারী শিক্ষক', 2006, 'Master', 'Page 380, Q-23'),
  ('I had been doing the work for five days. Change the voice.', 'I had been done the work for five days', 'The work had been done by me for five days', 'The work had been being done by me for five days', 'The work had been doing by me for five days', 2, 'Past Perfect Continuous Tense-এর Passive গঠন: Object + had been being + V3 + by + Subject-এর Objective form।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'RU (F)', 2015, 'Master', 'Page 380, Q-24'),
  ('''I shall do the work.'' বাক্যটির Passive form হবে', 'I shall be doing the work.', 'The work may be done by me.', 'The work will be done by me.', 'The work would be done by me.', 2, 'Future Indefinite Tense-এর Passive: Object + shall/will + be + V3 + by + Subject। ''The work'' third person হওয়ায় ''will be done'' বসবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক সহকারী শিক্ষক', 2010, 'Master', 'Page 380, Q-25'),
  ('''You will be helped by me.'' বাক্যটির Active form হবে', 'I shall have helped you.', 'I should helped you.', 'I shall help you.', 'I shall have helped you..', 2, 'Future Indefinite Tense-এর Passive ''You will be helped by me''-কে Active করলে ''I shall help you.'' হয়।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক প্রধান শিক্ষক', 2009, 'Master', 'Page 380, Q-26'),
  ('''I shall be teaching him.'' বাক্যটির Passive form হবে', 'He shall be taught by me.', 'He will be taught by me.', 'He shall be being taught by me.', 'He will be being taught by me.', 3, 'Future Continuous Tense-এর Passive: Object + shall/will + be + being + V3 + by + Subject।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক প্রধান শিক্ষক', 2011, 'Master', 'Page 380, Q-27'),
  ('''We shall be taking tea.'' বাক্যটির Passive form হবে', 'Tea will be being taken by us.', 'Tea shall have been taken by us.', 'Tea should be being taken by us.', 'Tea should be taken by us.', 0, 'Future Continuous Tense-এ Object ''Tea'' Subject হলে will be being + V3 + by us ব্যবহৃত হয়।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক সহকারী শিক্ষক', 2010, 'Master', 'Page 380, Q-28'),
  ('He killed himself. What is the passive form?', 'Himself was killed by him', 'Himself would be killed by him', 'He was killed himself', 'He was killed by himself.', 3, 'Reflexive pronoun কখনো Subject হয় না। Subject ও Object-এর অবস্থান অপরিবর্তিত রেখে Subject + Auxiliary + V3 + by + Reflexive Object গঠনে Passive করতে হয়।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'IU', 2010, 'Master', 'Page 380, Q-29'),
  ('The passive form of the sentence ''Lila fans herself.'' is –', 'Lila was fanned by herself.', 'Lila is fanned herself.', 'Herself is fanned by Lila.', 'Lila is fanned by herself.', 3, 'Reflexive pronoun যুক্ত Present Indefinite Tense-এর বাক্যে Subject (Lila) ও Reflexive Object (herself) স্বস্থানে থাকে এবং মাঝে ''is fanned by'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাক-প্রাথমিক সহঃ শিক্ষক', 2013, 'Master', 'Page 380, Q-30'),
  ('They love each other. (Find out the correct passive form)', 'Each other are loved by them.', 'Each other were loved by them.', 'Each other loved by them.', 'They are loved by each other.', 3, 'Reciprocal pronoun কখনো Subject হয় না। Subject ও Reciprocal Object অপরিবর্তিত রেখে ''They are loved by each other.'' হবে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'RU', 2005, 'Master', 'Page 381, Q-31'),
  ('They married each other. The passive form is –', 'They were married by each other', 'They got married', 'They were married each other', 'They had been married by each other', 0, 'Reciprocal pronoun যুক্ত Past Indefinite Tense-এর বাক্যকে Passive করতে Subject ও Object-এর অবস্থান ঠিক রেখে Subject + was/were + V3 + by + Reciprocal Object হয়।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'IU (C)', 2013, 'Master', 'Page 381, Q-32'),
  ('He has given me a book (into passive voice)', 'A book was given to me by him.', 'A book has been given to me by him.', 'A book has given to me by him.', 'A book had been given me by him.', 1, 'Double object যুক্ত বাক্যে Direct object-কে Subject করলে Indirect object-এর পূর্বে ''to'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'PUST (B)', 2013, 'Master', 'Page 381, Q-33'),
  ('Passive form of ''He gave me a pen'' is –', 'A pen was given to me by him.', 'A pen is given to me by him.', 'A pen was being given to me by him.', 'A pen is being given to me by him.', 0, 'Past Indefinite Tense-এ Direct object ''A pen''-কে Subject করলে ''was given to me by him'' সঠিক।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU', 2007, 'Master', 'Page 381, Q-34'),
  ('''The cow gives us milk.'' বাক্যটির সঠিক passive হবে-', 'We are being given milk by the cow.', 'We were given milk by the cow.', 'Milk is given to us by the cow.', 'Milk is being given to us by the cow.', 2, 'Present Indefinite Tense-এ Direct object ''Milk''-কে Subject করলে ''Milk is given to us by the cow.'' সঠিক।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক সহকারী শিক্ষক', 2010, 'Master', 'Page 381, Q-35'),
  ('The passive voice of "He made us work." is –', 'We was made the work by him.', 'Work was made by him for us.', 'Work were made by him to us.', 'We were made the work for him.', 1, 'প্রদত্ত অপশনগুলোর মধ্যে একমাত্র ব্যাকরণগতভাবে শুদ্ধ গঠন হলো ''Work was made by him for us.'' (singular Work + was + made)।', 'hard', 'English Language & Literature', 'Grammar', 'Voice', 'IU (G)', 2015, 'Master', 'Page 381, Q-36'),
  ('The correct passive voice of ''He pleases us'' is-', 'We are pleased by him.', 'We were pleased with him.', 'We are pleased with him.', 'We will be pleased by him.', 2, 'Please-এর Past Participle-এর পর ব্যক্তি থাকলে by-এর পরিবর্তে ''with'' বসে এবং Present Indefinite হওয়ায় ''are pleased with'' হবে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'BSMRSTU (E)', 2018, 'Master', 'Page 381, Q-37'),
  ('His behaviour surprised me. (Passive)', 'I surprised at his behaviour.', 'I was surprised with his behaviour.', 'I had been surprised at his behaviour.', 'I was surprised at his behaviour.', 3, 'Surprise-এর পর আচরণ, কর্ম বা ঘটনা থাকলে Passive-এ by-এর পরিবর্তে ''at'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', '১৫তম শিক্ষক নিবন্ধন', 2019, 'Master', 'Page 382, Q-38'),
  ('Which is the correct passive form? ''The boy pleased us.''', 'We were pleased by the boy.', 'We were pleased at the boy.', 'We were pleased with the boy.', 'We were pleased to the boy.', 2, 'Pleased-এর পর ব্যক্তি থাকায় preposition ''with'' বসবে এবং Past Indefinite হওয়ায় ''were pleased with'' হবে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাক-প্রাথমিক সহকারী শিক্ষক', 2014, 'Master', 'Page 382, Q-39'),
  ('Which one is the correct voice form?', 'I was charmed at her beauty.', 'I was charmed by her beauty.', 'I was charmed for her beauty.', 'I was charmed to her beauty.', 0, 'Charm-এর পর গুণ বা সৌন্দর্য থাকলে Passive-এ by-এর পরিবর্তে ''at'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'মাধ্যমিক সহকারী শিক্ষক', 2004, 'Master', 'Page 382, Q-40'),
  ('He annoyed me. (Select the passive form)', 'I was annoyed by him.', 'I was annoyed at him.', 'I was annoyed with him.', 'I was annoyed against him.', 2, 'Annoyed-এর পর ব্যক্তি থাকলে ''with'' বসে, আর আচরণ বা বিষয় থাকলে ''at''।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'থানা সহকারী শিক্ষা অফিসার', 2005, 'Master', 'Page 382, Q-41'),
  ('Change the voice: His conduct annoyed me.', 'He annoyed me with conduct.', 'I was annoyed with his conduct.', 'I was annoyed from his conduct.', 'I was annoyed at his conduct.', 3, 'Annoyed-এর পর আচরণ (his conduct) থাকায় preposition ''at'' বসবে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রতিরক্ষা মন্ত্রণালয়ের সহকারী পরিচালক', 2018, 'Master', 'Page 382, Q-42'),
  ('Give the correct passive form of "My teacher embodies all the good qualities."', 'All the good qualities are embodied by my teacher.', 'All the good qualities are embodied in my teacher.', 'All the good qualities are embodied to my teacher.', 'All the good qualities are embodied on my teacher.', 1, 'Contain, embody, include, subsume ইত্যাদি verb-এর Passive-এ by-এর পরিবর্তে ''in'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', '27th BCS / RU (E)', 2016, 'Master', 'Page 382, Q-43'),
  ('The passive voice of ''Panic seized me'' is–', 'I was seized with panic.', 'I was being seized by panic.', 'I was seized by panic.', 'I was seized from panic.', 0, 'Cover, crowd, cram, decorate, ornament, fill, seize, throng ইত্যাদি verb-এর Past Participle-এর পর by-এর পরিবর্তে ''with'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', '১৪তম প্রভাষক নিবন্ধন', 2017, 'Master', 'Page 382, Q-44'),
  ('Smoke fills the room. Which is the passive form of the sentence?', 'The room is filled by smoke.', 'The room is filled in smoke.', 'The room is filled at smoke.', 'The room is filled with smoke.', 3, 'Fill verb-এর Passive voice-এ by-এর পরিবর্তে ''with'' বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'সহকারী প্রকৌশলী (এলজিইডি)', 2005, 'Master', 'Page 382, Q-45'),
  ('The correct passive voice of ''Do you know them''?', 'Is they know by you?', 'Are they known to you?', 'are they know by you?', 'Are they know with you?', 1, 'Passive-এ ''known''-এর পর সাধারণত ''to'' বসে এবং Interrogative Present Indefinite হওয়ায় Subject ''they''-এর পূর্বে ''Are'' বসবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', '39th BCS', 2018, 'Master', 'Page 382, Q-46'),
  ('Choose the correct passive voice: ''His behaviour worried us.''', 'We were worried about his behaviour', 'We were worried with his behaviour.', 'We were worried by his behaviour.', 'We have been worried by his behaviour', 0, 'Passive voice-এ ''worried''-এর পর by-এর পরিবর্তে ''about'' বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাক-প্রাথমিক সহকারী শিক্ষক', 2015, 'Master', 'Page 382, Q-47'),
  ('Choose the voice: "All of his friends laughed at him"', 'He laughed at all of his friends', 'He was laughed at by all of his friends.', 'All his friends had laughed at him.', 'All his friends were laughed at him.', 1, 'Group verb (laugh at)-এর সাথে সংযুক্ত preposition Passive voice-এ V3-এর সাথে বসে এবং এরপর ''by'' বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'BU (A)', 2015, 'Master', 'Page 383, Q-48'),
  ('The correct sentence of the following:', 'A new cabinet has been sworn in in Dhaka', 'A new cabinet has been sworn at Dhaka', 'A new cabinet has been sworn by Dhaka', 'A new cabinet has sworn in Dhaka', 0, 'Swear in একটি Group verb; এর Passive রূপ ''has been sworn in'' এবং স্থান বোঝাতে ''in Dhaka'' বসে।', 'hard', 'English Language & Literature', 'Grammar', 'Voice', '17th BCS / প্রাক-প্রাথমিক সহকারী শিক্ষক', 2015, 'Master', 'Page 383, Q-49'),
  ('The correct passive form of the sentence. ''Take care of your health.''', 'Let your health taken care.', 'Let your health be taken care of.', 'Let your health taken care of.', 'Health is taken care by you.', 1, 'Imperative sentence-এ ''take care of'' group verb থাকায় Passive-এ Let + Object + be + taken care of বসে।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'KU (C)', 2018, 'Master', 'Page 383, Q-50'),
  ('I knew him. Make it passive voice.', 'He is known to me.', 'He was known to me.', 'He was known with me.', 'He was known by me.', 1, 'Past Indefinite Tense হওয়ায় ''was known'' বসবে এবং known-এর পর ''to'' বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'সহকারী মাধ্যমিক শিক্ষক', 2011, 'Master', 'Page 383, Q-51'),
  ('Active voice of ''They were talked of by us'' is –', 'They were talked of.', 'Talked to us', 'We had been talk of', 'We talked of them.', 3, 'were talked of Past Indefinite Passive হওয়ায় Active voice-এ Subject + V2 + preposition + Object হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU ইসলামের ইতিহাস', 2009, 'Master', 'Page 383, Q-52'),
  ('My uncle looks after me. Passive form is-', 'I was looked after by me uncle.', 'I am looked after by my uncle.', 'I am being looked after by my uncle.', 'I am looking after by my uncle.', 1, 'Look after একটি Group verb। Present Indefinite Tense-এ এর Passive রূপ ''I am looked after by my uncle.''', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'JKKNIU (খ)', 2016, 'Master', 'Page 383, Q-53'),
  ('''He called on me yesterday.'' Passive of the sentence will be-', 'I was called by him yesterday.', 'I have been called on by him yesterday.', 'I had been called on by him yesterday.', 'I was called on by him yesterday.', 3, 'Call on Group verb হওয়ায় Passive-এ V3-এর সাথে ''on'' যুক্ত থাকবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'BCS / Job Exam', 2018, 'Master', 'Page 383, Q-54'),
  ('The correct passive form of ''You must shut these doors.', 'These must be shut doors', 'Shut the doors you must', 'Shut must be the doors', 'These doors must be shut', 3, 'Modal auxiliary (must) যুক্ত বাক্যের Passive গঠন: Object + modal + be + V3।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', '35th BCS', 2015, 'Master', 'Page 383, Q-55'),
  ('We ought to obey our parents. (Change the voice)', 'Our parents are obeyed by us.', 'Our parents were obeyed by us.', 'Our parents ought to be obeyed by us.', 'Our parents was ought to obey by us.', 2, 'Ought to একটি Modal auxiliary verb হওয়ায় Passive-এ ought to + be + V3 বসবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'IU (H)', 2017, 'Master', 'Page 383, Q-56'),
  ('''We must listen to his words.''- বাক্যটির সঠিক পরিবর্তিত voice হবে-', 'His words must be listened to', 'His words should be listened to', 'His words ought to be listened to', 'His words may be listened to', 0, 'Modal auxiliary ''must'' অপরিবর্তিত থাকে এবং Group verb ''listen to''-এর সাথে ''to'' যুক্ত থাকে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক প্রধান শিক্ষক', 2009, 'Master', 'Page 383, Q-57'),
  ('Change the voice: ''We will not admit children under ten.''', 'Children under ten will not be admitted by us.', 'Children under ten will be not admitted by us.', 'Children under ten would not be admitted by us.', 'Children under ten shall not be admitted by us.', 0, 'Negative Modal sentence-এর Passive গঠন: Object + modal + not + be + V3 + by + Subject।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'BSMRSTU', 2014, 'Master', 'Page 384, Q-58'),
  ('Find out the active form of the sentence "Our parents should be respected by us"', 'We respect our parents', 'We should respect our parents', 'We should honour our parents', 'Parents should be respected by us', 1, 'should be respected Passive হওয়ায় Active voice-এ Subject + should + V1 + Object হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'KU (জীব, স্কুল)', 2001, 'Master', 'Page 384, Q-59'),
  ('The correct passive form is: (তারা নষ্ট গাড়ি মেরামত করতো)', 'Broken cars are used to repair by them.', 'Broken cars used to be repaired by them.', 'Broken cars used to be repair by them.', 'Broken cars are used to be repaired by them.', 1, 'Active: They used to repair broken cars। used to semi-modal হওয়ায় Passive-এ Object + used to + be + V3 + by + Subject হয়।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'RU (আইন, রাষ্ট্রবিজ্ঞান)', 2007, 'Master', 'Page 384, Q-60'),
  ('Identify the correct passive form of "He is going to open a shop."', 'He is being gone to open a shop.', 'A shop is being gone opened by him.', 'A shop will be opened by him.', 'A shop is going to be opened by him.', 3, 'be going to যুক্ত Active বাক্যের Passive-এ going অপরিবর্তিত থাকে; Object + be verb + going to + be + V3 + by + Subject বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', '26th BCS / JUST (B)', 2016, 'Master', 'Page 384, Q-61'),
  ('The passive form of "The Home office is going to renew my passport" is', 'My passport will be renewed by the Home office.', 'My passport is to be renewed by the Home office.', 'My passport is being renewed by the Home office.', 'My passport is going to be renewed by the Home office.', 3, 'is going to renew-এর Passive রূপ হবে is going to be renewed।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'CU (E)', 2012, 'Master', 'Page 384, Q-62'),
  ('What is the correct passive form of ''He is going to build a house''?', 'A house is going to be building', 'A house is going to be built.', 'A house is being gone to build', 'A house is gone to be built.', 1, 'be going to + V1 যুক্ত বাক্যের Passive গঠন হলো be going to + be + V3।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'JnU (C)', 2010, 'Master', 'Page 384, Q-63'),
  ('''He is going to set up a school.'' বাক্যটির সঠিক পরিবর্তিত voice হবে-', 'A school is going to be set up by him', 'A school is being set up by him', 'A school is gone to be set up by him', 'A school has been going to be set up by him', 0, 'is going to set up-এর Passive রূপ হবে is going to be set up (set-এর V3 হলো set)।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'প্রাথমিক প্রধান শিক্ষক', 2009, 'Master', 'Page 384, Q-64'),
  ('Correct passive form of "I have to do it" is', 'It has to be done by me.', 'It is to be done by me.', 'It has to be done to me.', 'Let it be done by me.', 0, 'Active voice-এ have to / has to থাকলে Passive-এ Subject অনুযায়ী have to / has to + be + V3 + by + Subject বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'DU / IU (BBA)', 2015, 'Master', 'Page 384, Q-65'),
  ('''It has to be done by me'' বাক্যটির সঠিক পরিবর্তিত voice হবে-', 'I must do it.', 'I should do it.', 'It must have done it.', 'I have to do it.', 3, 'has to be done Passive হওয়ায় এর Active রূপ হবে ''I have to do it.''', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'CU (A)', 2018, 'Master', 'Page 385, Q-66'),
  ('You are to colour this picture. The passive form:', 'This picture has to be coloured by you', 'This picture is to be colour by you', 'This picture is to be coloured by you', 'This picture is being coloured by you', 2, 'Active voice-এ am to / is to / are to থাকলে Passive-এ am to / is to / are to + be + V3 বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'ডাক বিভাগের মেইল অপারেটর', 2019, 'Master', 'Page 385, Q-67'),
  ('The passive form of the sentence ''A child could not have done this mischief.'' is', 'This mischief could not have been done by a child.', 'This mischief could not been done by a child.', 'This mischief could not have be done by a child.', 'This mischief a child could not have been done.', 0, 'Active: Subject + modals + have + V3 + Object হলে Passive: Object + modals + have + been + V3 + by + Subject।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'CU (B7)', 2014, 'Master', 'Page 385, Q-68'),
  ('The correct active form of the sentence "It must have been stolen by him" is–', 'He must have stolen it.', 'He must have been stolen by it.', 'It was stolen by them.', 'They must steal it.', 0, 'must have been stolen Passive হওয়ায় Active-এ ''He must have stolen it.'' হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'NU', 2006, 'Master', 'Page 385, Q-69'),
  ('Choose the correct passive statement of "You should have done it."', 'You should have done it.', 'It should have been done by you.', 'It should have done by you.', 'It would have been done by you.', 1, 'should have + V3-এর Passive রূপ হবে should have been + V3।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU', 2009, 'Master', 'Page 385, Q-70'),
  ('''Obey your parents'' The passive form is -', 'Your parents were obeyed.', 'Your parents must be obeyed.', 'Your parents are to be obeyed.', 'Your parents should be obeyed.', 3, 'নৈতিক বা বাস্তবিক অপরিহার্য উপদেশবাচক Imperative Sentence-এ Let না থাকলে Object + should be + V3 গঠনে Passive করা যায়।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'IU (C)', 2013, 'Master', 'Page 385, Q-71'),
  ('Change the voice: Shut the door at once.', 'The door be shut at once.', 'Let the door be shut at once.', 'Let the door shut at once.', 'The door be shutes at once.', 1, 'মূল verb দ্বারা শুরু হওয়া Imperative Sentence-কে Passive করার নিয়ম: Let + Object + be + V3 + বাকি অংশ।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'JnU (A)', 2013, 'Master', 'Page 385, Q-72'),
  ('Identify the correct passive form ''Open the window''.', 'The window should be opened.', 'Let the window be opened.', 'Let the window be opened by you.', 'The window must be opened.', 1, 'সাধারণ আদেশমূলক Imperative Sentence-এ Let + Object + be + V3 ব্যবহৃত হয় এবং ''by you'' লেখা হয় না।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU (G)', 2011, 'Master', 'Page 385, Q-73'),
  ('Make the sentence passive: ''Always speak the truth''', 'Let the truth be spoked always.', 'Let the truth be spoken always.', 'Let the truth had spoken always.', 'Let the truth was spoken always.', 1, 'Imperative Sentence-এ Let + Object + be + V3 (spoken) + always গঠনে Passive করতে হয়।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'IU', 2010, 'Master', 'Page 385, Q-74'),
  ('''Let him be told to go'' change the voice is-', 'Go', 'Let you go.', 'You go.', 'Tell him to go.', 3, 'Let him be told to go Imperative Passive হওয়ায় এর Active রূপ হবে ''Tell him to go.''', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'NSI সহকারী পরিচালক', 2015, 'Master', 'Page 386, Q-75'),
  ('What is the passive voice "Do away with it"?', 'Let it be done away with.', 'Let it has been away with.', 'Let it is to be done away with.', 'Let it has to do away with', 0, 'Do away with একটি Group verb। Imperative Sentence হওয়ায় Passive হবে ''Let it be done away with.''', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'IU (G)', 2014, 'Master', 'Page 386, Q-76'),
  ('The passive form of the sentence "Tell him to go" is-', 'Let him told to go.', 'Let him be told to go.', 'Let he be told to go.', 'Let him tell to be gone.', 1, 'Imperative Sentence-এ Let-এর পর Object-এর Objective form (him) বসে এবং এরপর be + V3 + বাকি অংশ বসে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU', 2009, 'Master', 'Page 386, Q-77'),
  ('The passive form of ''Don''t do it'' is–', 'Let not it be done', 'Let not it be do', 'Let it be done not', 'Let it not be done', 3, 'Do not দ্বারা শুরু হওয়া Imperative Sentence-এর Object Pronoun (it) হলে Pronoun-এর পরে ''not'' বসে (Noun হলে Let not-এর পরে বসে)।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'BRUR (C)', 2016, 'Master', 'Page 386, Q-78'),
  ('Mention the passive Voice, ''Don''t neglect the poor.''', 'Let the poor be neglected.', 'Let not the poor be neglected.', 'Let not the poor neglected.', 'Poor don''t be neglected.', 1, 'Do not দ্বারা শুরু হওয়া Imperative Sentence-এ Object Noun হলে গঠন হয়: Let not + Object + be + V3।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU (G)', 2014, 'Master', 'Page 386, Q-79'),
  ('The passive form of the sentence ''Do not open the door'' is-', 'Let not the door be opened.', 'Let not the door open.', 'Let not the door be open.', 'Let not the door opened.', 0, 'Object ''the door'' একটি Noun হওয়ায় Let not + the door + be + V3 (opened) ব্যবহৃত হবে।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'গণপূর্ত অধিদপ্তরের উপ-সহকারী প্রকৌশলী', 2018, 'Master', 'Page 386, Q-80'),
  ('Let her sing a song. Passive form is-', 'Let a song be sung by her', 'Let a song be sang by her', 'Let a song sing by her', 'Let a song sung by her', 0, 'Let + ব্যক্তিবাচক Object + V1 + বস্তুবাচক Object থাকলে Passive হয়: Let + বস্তুবাচক Object + be + V3 + by + ব্যক্তিবাচক Object।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'JU (E)', 2014, 'Master', 'Page 386, Q-81'),
  ('Let me do the work. Its passive form is :', 'Let the work done me.', 'Let the work be done.', 'Let me be done the work.', 'Let the work be done by me.', 3, 'Let me do the work-এর Passive হবে Let + the work + be + done + by + me।', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'RU (A2)', 2019, 'Master', 'Page 386, Q-82'),
  ('Let me write a letter. বাক্যটির Passive হবে-', 'Let a letter be write by me.', 'Let a letter be written by me.', 'Let a letter to write by me.', 'Let a letter is written by me.', 1, 'Write-এর Past Participle হলো written। তাই Passive গঠন হবে ''Let a letter be written by me.''', 'easy', 'English Language & Literature', 'Grammar', 'Voice', 'BSMRSTU (A)', 2012, 'Master', 'Page 386, Q-83'),
  ('''Never catch the Jatka.'' Make it passive.', 'Let the Jatka never be caught.', 'Let not the Jatka ever be caught.', 'Never the Jatka be caught by you.', 'The Jatka is caught by you.', 1, 'Never যুক্ত Imperative Sentence-এর Passive দুটি গঠনে হয়: Let never + Object + be + V3 অথবা Let not + Object + ever + be + V3।', 'medium', 'English Language & Literature', 'Grammar', 'Voice', 'BRUR (C)', 2016, 'Master', 'Page 386, Q-84')
) as v(statement, a, b, c, d, correct_option, explanation, difficulty,
       subject_title, topic_title, subtopic_title,
       exam_name, exam_year, source_title, source_locator);

-- ── STEP 2 · যাচাই (কিছু ভুল থাকলে এখানেই থামবে) ─────────────────────────
drop table if exists jh_rows;
create temp table jh_rows as
select
  i.*,
  c.course_id,
  c.admin_id,
  s.id  as subject_id,
  t.id  as topic_id,
  sb.id as subtopic_id
from jh_in i
cross join jh_ctx c
left join subjects  s  on s.course_id = c.course_id
                      and (lower(btrim(s.title_bn)) = lower(btrim(i.subject_title))
                        or lower(btrim(s.title_en)) = lower(btrim(i.subject_title)))
left join topics    t  on t.subject_id = s.id
                      and t.is_active
                      and (lower(btrim(t.title_bn)) = lower(btrim(i.topic_title))
                        or lower(btrim(t.title_en)) = lower(btrim(i.topic_title)))
left join subtopics sb on sb.topic_id = t.id
                      and sb.is_active
                      and (lower(btrim(sb.title_bn)) = lower(btrim(i.subtopic_title))
                        or lower(btrim(sb.title_en)) = lower(btrim(i.subtopic_title)));

do $$
declare v_list text;
begin
  select string_agg(distinct subject_title || ' → ' || topic_title ||
                           coalesce(' → ' || subtopic_title, ''), ', ')
    into v_list
    from jh_rows
   where subject_id is null or topic_id is null
      or (subtopic_title is not null and subtopic_id is null);
  if v_list is not null then
    raise exception 'বিষয়/টপিক/সাবটপিক পাওয়া যায়নি: %. নাম ডাটাবেজে যেমন আছে হুবহু তেমন লিখুন। কিছুই ঢোকেনি।', v_list;
  end if;

  if exists (select 1 from jh_rows where correct_option not between 0 and 3) then
    raise exception 'correct_option 0-3 এর মধ্যে হতে হবে (0=ক 1=খ 2=গ 3=ঘ)। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where difficulty not in ('easy','medium','hard')) then
    raise exception 'difficulty শুধু easy / medium / hard হবে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where explanation is null or btrim(explanation) = '') then
    raise exception 'explanation খালি রাখা যাবে না। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows
              where statement is null or length(btrim(statement)) < 8) then
    raise exception 'statement কমপক্ষে ৮ অক্ষরের হতে হবে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows
              where a = b or a = c or a = d or b = c or b = d or c = d) then
    raise exception 'একই অপশন দুইবার দেওয়া হয়েছে। কিছুই ঢোকেনি।';
  end if;

  if exists (select 1 from jh_rows where (exam_name is null) <> (exam_year is null)) then
    raise exception 'exam_name আর exam_year দুটোই দিন, নাহলে দুটোই null দিন। কিছুই ঢোকেনি।';
  end if;
end $$;

-- একই statement দুইবার দিলে একটাই রাখা হয় (PYQ তথ্য থাকলে সেটাই)
drop table if exists jh_dedup;
create temp table jh_dedup as
select distinct on (statement) *
from (
  select q.*, row_number() over (
    partition by statement
    order by exam_name nulls last, source_locator nulls last
  ) as rn
  from jh_rows q
) ranked
where rn = 1;

-- ── STEP 3 · ইনসার্ট (প্রথমে pending_review + unverified) ────────────────
drop table if exists jh_inserted;
create temp table jh_inserted as
with ins as (
  insert into questions (
    course_id, subject_id, topic_id, subtopic_id, statement,
    option_a, option_b, option_c, option_d, correct_option,
    explanation, difficulty,
    source, source_title, source_locator,
    source_type, status, is_verified,
    question_type, question_kind, fingerprint,
    exam_name, "year", created_by
  )
  select
    q.course_id, q.subject_id, q.topic_id, q.subtopic_id, q.statement,
    q.a, q.b, q.c, q.d, q.correct_option,
    q.explanation, q.difficulty,
    coalesce(q.source_title, 'Master'), q.source_title, q.source_locator,
    'ai_assisted', 'pending_review', false,
    'mcq', 'practice',
    encode(sha256(convert_to(q.statement, 'UTF8')), 'hex'),
    q.exam_name, q.exam_year::smallint, q.admin_id
  from jh_dedup q
  on conflict (course_id, fingerprint) do nothing
  returning id, fingerprint
)
select id, fingerprint from ins;

-- ── STEP 4 · PYQ হলে প্রমাণ + লেবেল (শুধু এইমাত্র ঢোকা সারিতে) ───────────
insert into evidence_records (question_id, exam_name, exam_year, match_kind, verified_by, source_ref)
select i.id, q.exam_name, q.exam_year::smallint, 'exact', q.admin_id, q.source_locator
from jh_inserted i
join jh_dedup q
  on q.course_id = (select course_id from jh_ctx)
 and encode(sha256(convert_to(q.statement, 'UTF8')), 'hex') = i.fingerprint
where q.exam_name is not null
  and (select approve_pyq from jh_ctx)
on conflict (question_id, exam_name, exam_year) do nothing;

-- evidence ঠিক আগে বসানো হয়েছে, তাই triggers (jh_enforce_question_kind,
-- jh_guard_previous_source) এখন পাস করবে।
update questions q2
   set source_type   = 'previous',
       question_kind = 'exact_pyq',
       status        = 'approved',
       is_verified   = true,
       verified_by   = q.admin_id,
       verified_at   = now()
  from jh_dedup q
 where (select approve_pyq from jh_ctx)
   and q2.id in (select i.id from jh_inserted i)
   and q2.course_id   = q.course_id
   and q2.fingerprint = encode(sha256(convert_to(q.statement, 'UTF8')), 'hex')
   and q.exam_name is not null;

-- ── STEP 5 · ফলাফল ──────────────────────────────────────────────────────
select
  d.statement,
  case d.correct_option when 0 then 'ক' when 1 then 'খ' when 2 then 'গ' else 'ঘ' end as সঠিক_উত্তর,
  q2.source_type,
  q2.status,
  q2.is_verified     as যাচাইকৃত,
  q2.question_kind,
  q2.exam_name,
  q2."year",
  (q2.topic_id    is not null) as টপিক_আছে,
  (q2.subtopic_id is not null) as সাবটপিক_আছে,
  case when i.id is null then 'আগেই ছিল — বাদ পড়েছে' else 'নতুন ঢুকেছে' end as ফলাফল
from jh_dedup d
left join jh_inserted i
       on i.fingerprint = encode(sha256(convert_to(d.statement, 'UTF8')), 'hex')
left join questions q2
       on q2.course_id   = d.course_id
      and q2.fingerprint = encode(sha256(convert_to(d.statement, 'UTF8')), 'hex')
order by d.source_locator;
