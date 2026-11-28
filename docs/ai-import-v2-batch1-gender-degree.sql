-- ============================================================================
--  JobHub | AI import v2 — Batch 1 (50 questions)
--  Parts of speech → Gender (25) + Degree of Comparison (25)
--
--  যা বদলানো হয়েছে (আপনার খসড়া স্ক্রিপ্ট থেকে):
--   1. subject: "English" → "English Language & Literature"  (ডেটাবেজে নাম এটাই)
--   2. "Choose the correct sentence:" statement দুবার ছিল → দুইটাই আলাদা করা
--      হয়েছে (নাহলে strict duplicate check পুরো batch বাতিল করত)
--   3. question_kind: previous → practice
--      ("previous" হলে jh_guard_previous_source ট্রিগার evidence_records দাবি
--       করে; এই ৫০টার কোনো evidence নেই, তাই whole-batch abort হতো)
--   4. exam_name / year কিছুই লেখা হয়নি — যে attribution গুলো দেওয়া ছিল
--      সেগুলো পরস্পরবিরোধী (যেমন 41st BCS = 2019, লেখা ছিল 2021)
--   5. import_batches-এর ৪টি NOT NULL কলাম (created_rows, failed_rows,
--      duplicate_rows, errors) যোগ করা হয়েছে
--   6. subtopics-এ সত্যিকারের লিংক (Gender / Degree of Comparison)
--      subject/topic/subtopic — title_bn অথবা title_en, যেটায় মিলবে
--      (লাইভ seed-এ कিছু নাম title_en-এ আছে, कিছু title_bn-এ)
--   7. transaction-এ abort হলে BEGIN...COMMIT পুরোটা রোলব্যাক করে
-- ============================================================================

begin;

drop table if exists jh_ctx, jh_in, jh_rows, jh_dedup, jh_batch;

-- STEP 0 · CONFIG
--  অন্য কোর্সে চালাতে চাইলে আগে:  select set_config('jh.course_id', '<uuid>', false);
create temp table jh_ctx as
select
  coalesce(nullif(current_setting('jh.course_id', true), ''),
           '599509ae-c4c3-440a-9463-802a4efc7a0c')::uuid as course_id,
  'b0d40cca-e34b-42fe-bc19-dae3627b7a48'::uuid as admin_id,
  'ai-import-v2 batch1 — Gender + Degree of Comparison (50)'::text as filename;

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
  nullif(btrim(q->>'source_title'), '')   as source_title,
  nullif(btrim(q->>'source_locator'), '') as source_locator
from jsonb_array_elements($json$
[
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What gender is the word 'orphan'?","option_a":"Neuter","option_b":"Feminine","option_c":"Common","option_d":"Masculine","correct_option":"c","explanation":"যে সকল Noun নারী ও পুরুষ উভয়কে বোঝায়, তাদেরকে Common Gender বলে। Orphan অর্থ এতিম বালক বা বালিকা।","difficulty":"easy","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 35"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which one of the following is a common gender?","option_a":"King","option_b":"Sovereign","option_c":"Emperor","option_d":"Queen","correct_option":"b","explanation":"Sovereign (সার্বভৌম শাসক/রাজা বা রানী) দ্বারা নারী ও পুরুষ উভয়কেই বোঝানো হয় বলে এটি Common Gender।","difficulty":"medium","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 35"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which one of the following words is masculine?","option_a":"Mare","option_b":"Lad","option_c":"Pillow","option_d":"Pony","correct_option":"b","explanation":"Lad (বালক/কিশোর) হলো Masculine Gender, যার Feminine রূপ Lass। Mare হলো Feminine এবং Pillow হলো Neuter Gender।","difficulty":"easy","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the masculine gender of 'mare'?","option_a":"Mermaid","option_b":"Bear","option_c":"Stallion","option_d":"Dog","correct_option":"c","explanation":"Mare অর্থ ঘোটকী (Feminine Gender), এর Masculine Gender হলো Stallion বা Horse (ঘোটক/ঘোড়া)।","difficulty":"easy","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"The feminine form of the word 'Ram' is —","option_a":"Ewe","option_b":"Hind","option_c":"Mare","option_d":"Sow","correct_option":"a","explanation":"Ram (ভেড়া) এর Feminine Gender হলো Ewe (ভেড়ী)। Hind হলো Stag এর এবং Sow হলো Boar এর Feminine রূপ।","difficulty":"medium","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Fox'?","option_a":"Foxen","option_b":"Vixen","option_c":"Female fox","option_d":"Foxess","correct_option":"b","explanation":"Fox (খেঁকশিয়াল) এর ব্যতিক্রমী Feminine Gender হলো Vixen (খেঁকশিয়ালী)।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"The feminine form of the word 'Duke' is —","option_a":"Dramatist","option_b":"Dutchman","option_c":"Duchess","option_d":"Earl","correct_option":"c","explanation":"Duke (সম্ভ্রান্ত পুরুষ/সর্দার) এর শেষে 'ess' যোগ হয়ে এবং বানানের সামান্য পরিবর্তনে Feminine রূপ হয় Duchess।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 28"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which of the following is always 'feminine'?","option_a":"Blonde","option_b":"Judge","option_c":"Coward","option_d":"Knight","correct_option":"a","explanation":"Blonde (স্বর্ণকেশী নারী) সর্বদা Feminine Gender হিসেবে ব্যবহৃত হয়, এর কোনো Masculine রূপ নেই। Judge, Coward ও Knight সর্বদা Masculine।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Rule 33"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which of the following nouns is used in the masculine form?","option_a":"Autumn","option_b":"Moon","option_c":"Peace","option_d":"Time","correct_option":"d","explanation":"শক্তি, ক্ষমতা বা কঠোরতার প্রতীক হিসেবে Time, Sun, Summer, Winter, Death, Thunder ইত্যাদি Masculine Gender হিসেবে বিবেচিত হয়।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Rule 31"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which of the following nouns is used in the feminine form?","option_a":"Anger","option_b":"Time","option_c":"Moon","option_d":"Winter","correct_option":"c","explanation":"সৌন্দর্য, কোমলতা বা পবিত্রতার প্রতীক হিসেবে Moon, Earth, Nature, Spring, Autumn, Liberty, Peace ইত্যাদি Feminine Gender হয়।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 32"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"The masculine gender of the word 'spinster' is —","option_a":"Unattached","option_b":"Single","option_c":"Bachelor","option_d":"Free","correct_option":"c","explanation":"Spinster অর্থ অবিবাহিত নারী (Feminine), এর Masculine Gender হলো Bachelor (অবিবাহিত পুরুষ)।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which one of the following words is in feminine form?","option_a":"Nun","option_b":"Boar","option_c":"Drone","option_d":"Emperor","correct_option":"a","explanation":"Nun (সন্ন্যাসিনী) হলো Monk বা Friar এর Feminine Gender। Boar, Drone ও Emperor হলো Masculine Gender।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which parts of speech do not have gender?","option_a":"Noun and Pronoun","option_b":"Adjective and Verb","option_c":"Pronoun only","option_d":"Noun only","correct_option":"b","explanation":"ইংরেজি ব্যাকরণে কেবল Noun এবং Pronoun-এর Gender থাকে; Adjective এবং Verb-এর কোনো Gender হয় না।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Page 31"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Drone'?","option_a":"Bee","option_b":"Hind","option_c":"Doe","option_d":"Duck","correct_option":"a","explanation":"Drone অর্থ পুরুষ মৌমাছি (Masculine) এবং এর Feminine Gender হলো Bee (স্ত্রী মৌমাছি)।","difficulty":"easy","source_title":"Master English & 152 Grammatical Rules","source_locator":"Page 42 / Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Identify the feminine gender from the following options:","option_a":"Buck","option_b":"Sow","option_c":"Hunter","option_d":"Baron","correct_option":"b","explanation":"Sow (শূকরী) হলো Boar এর Feminine Gender। Buck (পুরুষ হরিণ), Hunter (শিকারী) ও Baron (সম্ভ্রান্ত পুরুষ) Masculine Gender।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"The feminine form of the word 'Author' is —","option_a":"Authorss","option_b":"Authoress","option_c":"Authores","option_d":"Authors","correct_option":"b","explanation":"Author (লেখক) এর শেষে মূল বানানের কোনো পরিবর্তন না করে শুধু 'ess' যোগ করলে Feminine রূপ হয় Authoress (লেখিকা)।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 29"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Wizard'?","option_a":"Witch","option_b":"Vixen","option_c":"Lass","option_d":"Belle","correct_option":"a","explanation":"Wizard (জাদুকর) এর Feminine Gender হলো Witch (জাদুকরী)।","difficulty":"easy","source_title":"Master English","source_locator":"Page 42"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine form of 'Executor'?","option_a":"Executrix","option_b":"Executress","option_c":"Executora","option_d":"Executoress","correct_option":"a","explanation":"ল্যাটিন উৎসজাত কিছু শব্দের শেষে 'or' থাকলে তা তুলে দিয়ে 'rix' যোগ করে Feminine করা হয়; যেমন— Executor থেকে Executrix।","difficulty":"hard","source_title":"Master English","source_locator":"Page 42"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which one of the following is always used as a masculine noun?","option_a":"Squire","option_b":"Siren","option_c":"Shrew","option_d":"Prude","correct_option":"a","explanation":"Squire (প্রধান ভূমি মালিক/সম্ভ্রান্ত পুরুষ) সর্বদা Masculine Gender হিসেবে ব্যবহৃত হয়। Siren, Shrew ও Prude সর্বদা Feminine।","difficulty":"hard","source_title":"152 Grammatical Rules","source_locator":"Rule 34"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Beau'?","option_a":"Belle","option_b":"Bride","option_c":"Niece","option_d":"Governess","correct_option":"a","explanation":"Beau (সুদর্শন পুরুষ) এর Feminine Gender হলো Belle (সুশ্রী নারী)।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which one of the following is a neuter gender?","option_a":"Spouse","option_b":"Child","option_c":"Book","option_d":"Monarch","correct_option":"c","explanation":"Book একটি অচেতন পদার্থ, তাই এটি Neuter Gender। Spouse, Child ও Monarch হলো Common Gender।","difficulty":"easy","source_title":"Master English","source_locator":"Page 42"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Drake'?","option_a":"Goose","option_b":"Duck","option_c":"Hen","option_d":"Swan","correct_option":"b","explanation":"Drake (পাতিহাঁস) এর Feminine Gender হলো Duck (পাতিহাঁসী)। Goose হলো Gander এর Feminine রূপ।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 30"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the masculine gender of 'Bee'?","option_a":"Drone","option_b":"Stag","option_c":"Colt","option_d":"Bullock","correct_option":"a","explanation":"Bee (স্ত্রী মৌমাছি) এর Masculine Gender হলো Drone (পুরুষ মৌমাছি)।","difficulty":"easy","source_title":"Master English","source_locator":"Page 42"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"Which of the following is a common gender?","option_a":"Spouse","option_b":"Nephew","option_c":"Widow","option_d":"Niece","correct_option":"a","explanation":"Spouse অর্থ স্বামী বা স্ত্রী—উভয়কে বোঝায় বলে এটি Common Gender। Nephew Masculine এবং Widow ও Niece Feminine Gender।","difficulty":"easy","source_title":"152 Grammatical Rules","source_locator":"Rule 35"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Gender","statement":"What is the feminine gender of 'Abbot'?","option_a":"Abbess","option_b":"Abbotess","option_c":"Abbey","option_d":"Abbotrix","correct_option":"a","explanation":"Abbot (মঠাধ্যক্ষ) এর Feminine Gender হলো Abbess (মঠাধ্যক্ষা)।","difficulty":"medium","source_title":"152 Grammatical Rules","source_locator":"Rule 28"},

  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which sentence uses 'preferable' correctly?","option_a":"Death is preferable than dishonour.","option_b":"Death is more preferable than dishonour.","option_c":"Death is more preferable then dishonour.","option_d":"Death is preferable to dishonour.","correct_option":"d","explanation":"Preferable, senior, junior, superior, inferior, prior ইত্যাদি ল্যাটিন Comparative শব্দের পূর্বে more বসে না এবং পরে than-এর পরিবর্তে to বসে।","difficulty":"easy","source_title":"152 Grammatical Rules & Master English","source_locator":"Rule 48 / Page 101"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"He is senior ___ me by two years.","option_a":"than","option_b":"to","option_c":"from","option_d":"with","correct_option":"b","explanation":"Senior, junior, superior, inferior, prior ইত্যাদির পর তুলনা বোঝাতে than না বসে preposition 'to' বসে।","difficulty":"easy","source_title":"Master English","source_locator":"Page 101"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"The ___ we walk, the ___ we get tired.","option_a":"more, more","option_b":"most, most","option_c":"much, much","option_d":"more, most","correct_option":"a","explanation":"সমানুপাতিক হ্রাস বা বৃদ্ধি বোঝাতে Double Comparative ব্যবহৃত হয় এবং উভয় অংশেই 'The + Comparative degree' বসে।","difficulty":"medium","source_title":"Master English & 99 Grammar Rules","source_locator":"Page 102"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Of the two boys, Latif is ___ intelligent.","option_a":"most","option_b":"the most","option_c":"the more","option_d":"more","correct_option":"c","explanation":"দুইয়ের মধ্যে তুলনা বোঝাতে 'Of the two + Plural Noun' থাকলে Comparative Degree-এর পূর্বে 'the' বসে (the more intelligent)।","difficulty":"medium","source_title":"Master English & 99 Grammar Rules","source_locator":"Page 102"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which of the following sentences is correct?","option_a":"The climate of Dhaka is better than Khulna.","option_b":"The climate of Dhaka is better than that of Khulna.","option_c":"The climate of Dhaka is better than those of Khulna.","option_d":"The climate of Dhaka is best than that of Khulna.","correct_option":"b","explanation":"তুলনা সর্বদা সমজাতীয় বিষয়ের মধ্যে হয়। এখানে ঢাকার জলবায়ুর সাথে খুলনার জলবায়ুর তুলনা বোঝাতে singular noun 'climate'-এর পরিবর্তে 'that of' বসবে।","difficulty":"medium","source_title":"Master English & 99 Grammar Rules","source_locator":"Page 103"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which of the following is the correct comparative form of 'bad'?","option_a":"Badder","option_b":"Worse","option_c":"Worst","option_d":"More bad","correct_option":"b","explanation":"Bad / Ill / Evil-এর Irregular Comparative form হলো Worse এবং Superlative form হলো Worst।","difficulty":"easy","source_title":"Master English","source_locator":"Page 101"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Dhaka is becoming one of the ___ cities in Asia.","option_a":"more busy","option_b":"busy","option_c":"busiest","option_d":"most busiest","correct_option":"c","explanation":"'One of the' এর পর Superlative Degree বসে এবং পরবর্তী Noun-টি Plural হয়। Busy-এর Superlative রূপ busiest (most busiest দ্বৈত ভুল)।","difficulty":"easy","source_title":"Master English","source_locator":"Page 104"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Choose the correct comparative form of the sentence: 'Very few boys in the class are as industrious as Zaman.'","option_a":"Zaman is more industrious than any other boy in the class.","option_b":"Zaman is more industrious than most other boys in the class.","option_c":"Zaman is the most industrious boy in the class.","option_d":"Zaman is more industrious than all other boys in the class.","correct_option":"b","explanation":"'Very few' যুক্ত Positive Degree-কে Comparative করতে হলে Comparative form-এর পর 'than most other + Plural Noun' বসে।","difficulty":"medium","source_title":"Master English","source_locator":"Page 105"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Gold is one of the ___ metals.","option_a":"precious","option_b":"more precious","option_c":"most precious","option_d":"preciousest","correct_option":"c","explanation":"একাধিক syllable-বিশিষ্ট Adjective (precious)-এর পূর্বে 'most' বসিয়ে Superlative Degree গঠন করা হয় এবং 'one of the' এর পর Superlative বসে।","difficulty":"easy","source_title":"Master English","source_locator":"Page 104"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which sentence is grammatically correct?","option_a":"He is better than any boy in the class.","option_b":"He is better than any other boy in the class.","option_c":"He is better than all boy in the class.","option_d":"He is the better than any other boy in the class.","correct_option":"b","explanation":"একই শ্রেণির অন্য সকলের সাথে তুলনা বোঝাতে Comparative Degree-এর পর 'than any other + Singular Noun' ব্যবহৃত হয়।","difficulty":"medium","source_title":"Master English","source_locator":"Page 103"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"The roads of Rajshahi are wider ___.","option_a":"than Dhaka","option_b":"than that of Dhaka","option_c":"than those of Dhaka","option_d":"to those of Dhaka","correct_option":"c","explanation":"এখানে তুলনীয় বিষয় 'roads' (Plural Noun) হওয়ায় পুনরাবৃত্তি এড়াতে Comparative-এর পর 'than those of' বসবে।","difficulty":"medium","source_title":"Master English & 99 Grammar Rules","source_locator":"Page 103"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"No other metal is ___ useful as iron.","option_a":"so","option_b":"more","option_c":"most","option_d":"very","correct_option":"a","explanation":"Negative বাক্যে Positive Degree বোঝাতে 'so + Positive Adjective + as' অথবা 'as + Positive Adjective + as' ব্যবহৃত হয়।","difficulty":"easy","source_title":"Master English","source_locator":"Page 102"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Identify the correct sentence: (comparatively)","option_a":"She is comparatively better today.","option_b":"She is comparatively well today.","option_c":"She is more better today.","option_d":"She is best than yesterday.","correct_option":"b","explanation":"Comparatively এবং relatively শব্দ দুটি নিজেই তুলনামূলক অর্থ প্রকাশ করে, তাই এদের পর Comparative Degree না বসে Positive Degree (well) বসে।","difficulty":"hard","source_title":"Master English & 99 Grammar Rules","source_locator":"Page 106"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which of the following adjectives cannot be used in comparative or superlative degree?","option_a":"Unique","option_b":"Clever","option_c":"Happy","option_d":"Polite","correct_option":"a","explanation":"Unique, supreme, perfect, complete, universal, dead, infinite ইত্যাদি Absolute Adjective সর্বোচ্চ পূর্ণতা বোঝায় বলে এদের Comparative বা Superlative হয় না।","difficulty":"medium","source_title":"Master English","source_locator":"Page 106"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"His house is ___ from the station than mine.","option_a":"farther","option_b":"further","option_c":"farthest","option_d":"furthest","correct_option":"a","explanation":"ভৌত দূরত্ব (physical distance) বোঝাতে Far-এর Comparative রূপ 'farther' বসে; আর 'অতিরিক্ত/আরো' বোঝাতে 'further' বসে।","difficulty":"medium","source_title":"Master English","source_locator":"Page 107"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"The higher you climb, the ___ it gets.","option_a":"cold","option_b":"colder","option_c":"coldest","option_d":"more cold","correct_option":"b","explanation":"Double Comparative গঠনে প্রথম অংশে 'The + Comparative' থাকলে দ্বিতীয় অংশেও 'the + Comparative' (colder) বসবে।","difficulty":"easy","source_title":"99 Grammar Rules","source_locator":"Comparison Rule"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"She is ___ of the three sisters.","option_a":"tall","option_b":"taller","option_c":"the tallest","option_d":"the taller","correct_option":"c","explanation":"দুইয়ের অধিক ব্যক্তি বা বস্তুর (three sisters) মধ্যে তুলনা বোঝাতে Superlative Degree-এর পূর্বে 'the' বসে।","difficulty":"easy","source_title":"Master English","source_locator":"Page 104"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which is the correct superlative form of 'little'?","option_a":"Littlest","option_b":"Least","option_c":"Less","option_d":"Lesser","correct_option":"b","explanation":"Little-এর Irregular Comparative form হলো Less/Lesser এবং Superlative form হলো Least।","difficulty":"easy","source_title":"Master English","source_locator":"Page 101"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"He is ___ wise than brave.","option_a":"wiser","option_b":"more","option_c":"most","option_d":"very","correct_option":"b","explanation":"একই ব্যক্তির দুটি গুণের মধ্যে তুলনা বোঝাতে প্রথম Adjective-টির পূর্বে 'more' বসে এবং Adjective-টির সাথে 'er' যুক্ত হয় না (more wise than brave)।","difficulty":"hard","source_title":"Master English","source_locator":"Page 107"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"My brother is ___ than I.","option_a":"elder","option_b":"older","option_c":"eldest","option_d":"oldest","correct_option":"b","explanation":"Elder-এর পরে কখনো 'than' বসে না (elder to বসে)। বাক্যে 'than' থাকায় 'older' বসবে।","difficulty":"medium","source_title":"Master English","source_locator":"Page 107"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Choose the correct sentence: as tall as","option_a":"He is as tall as me.","option_b":"He is as tall as I.","option_c":"He is so tall as I.","option_d":"He is as taller as I.","correct_option":"b","explanation":"Formal grammar অনুযায়ী 'as ... as'-এর পরে Subject pronoun (I) বসে এবং হ্যাঁ-বোধক বাক্যে 'as + Positive + as' ব্যবহৃত হয়।","difficulty":"medium","source_title":"99 Grammar Rules","source_locator":"Pronoun & Comparison"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"This is the ___ book I have ever read.","option_a":"interesting","option_b":"more interesting","option_c":"most interesting","option_d":"interestingly","correct_option":"c","explanation":"বাক্যে 'the' এবং 'ever' থাকায় Superlative Degree (most interesting) ব্যবহৃত হবে।","difficulty":"easy","source_title":"Master English","source_locator":"Page 104"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Shakespeare is greater than ___ dramatist.","option_a":"any","option_b":"any other","option_c":"all","option_d":"most","correct_option":"b","explanation":"Shakespeare নিজেও একজন নাট্যকার (dramatist), তাই অন্য সব নাট্যকারের সাথে তুলনা বোঝাতে 'any other + Singular Noun' বসবে।","difficulty":"medium","source_title":"Master English","source_locator":"Page 103"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"Which is the correct positive form of 'Dhaka is larger than any other city in Bangladesh'?","option_a":"Very few cities in Bangladesh are as large as Dhaka.","option_b":"No other city in Bangladesh is as large as Dhaka.","option_c":"No other cities in Bangladesh are as large as Dhaka.","option_d":"All other cities in Bangladesh are not as large as Dhaka.","correct_option":"b","explanation":"'than any other + Singular Noun' যুক্ত Comparative বাক্যকে Positive করতে হলে 'No other + Singular Noun + Singular Verb + as + Positive + as' বসে।","difficulty":"easy","source_title":"Master English","source_locator":"Page 105"},
  {"subject":"English Language & Literature","topic":"Parts of speech","subtopic":"Degree of Comparison","statement":"This ring is made of ___ gold.","option_a":"the purest","option_b":"purest","option_c":"more pure","option_d":"most pure","correct_option":"a","explanation":"Superlative Degree-এর পূর্বে নির্দিষ্টতা বোঝাতে সর্বদা 'the' বসে এবং 'pure'-এর Superlative form হলো 'purest'।","difficulty":"easy","source_title":"Master English","source_locator":"Page 104"}
]
$json$::jsonb) as q;

-- STEP 2 · VALIDATION REPORT (কিছু থাকলে দেখা যাবে)
select
  st as statement,
  array_remove(array[
    case when st is null or length(st) < 8 then 'Invalid statement' end,
    case when subject_title is null then 'Missing subject' end,
    case when topic_title is null then 'Missing topic' end,
    case when a is null or a='' or b is null or b='' or c is null or c='' or d is null or d=''
      then 'Missing option' end,
    case when a=b or a=c or a=d or b=c or b=d or c=d then 'Duplicate options' end,
    case when co is null then 'Invalid correct option' end,
    case when diff not in ('easy','medium','hard') then 'Invalid difficulty' end,
    case when ex is null or ex='' then 'Missing explanation' end
  ], null) as problems
from jh_in
where st is null or length(st) < 8
   or subject_title is null or topic_title is null
   or a is null or a='' or b is null or b='' or c is null or c='' or d is null or d=''
   or a=b or a=c or a=d or b=c or b=d or c=d
   or co is null or diff not in ('easy','medium','hard') or ex is null or ex='';

-- STEP 3 · STRICT VALIDATION
do $$
declare bad int; dup int;
begin
  select count(*) into bad from jh_in
  where st is null or length(st) < 8
     or subject_title is null or topic_title is null
     or a is null or a='' or b is null or b='' or c is null or c='' or d is null or d=''
     or a=b or a=c or a=d or b=c or b=d or c=d
     or co is null or diff not in ('easy','medium','hard') or ex is null or ex='';
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
 and (lower(btrim(t.title_bn)) = lower(btrim(i.topic_title))
   or lower(btrim(t.title_en)) = lower(btrim(i.topic_title)))
left join subtopics sub
  on sub.topic_id = t.id
 and (lower(btrim(sub.title_bn)) = lower(btrim(i.subtopic_title))
   or lower(btrim(sub.title_en)) = lower(btrim(i.subtopic_title)));

do $$
declare unmapped int;
begin
  select count(*) into unmapped from jh_rows
  where subject_id is null or topic_id is null
     or (subtopic_title is not null and subtopic_id is null);
  if unmapped > 0 then
    raise exception '% questions have unmatched subject/topic/subtopic. Import cancelled.', unmapped;
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

-- STEP 7 · INSERT AS practice + pending_review (কোনো exam attribution নেই)
insert into questions (
  course_id, subject_id, topic_id, subtopic_id, statement,
  option_a, option_b, option_c, option_d, correct_option,
  explanation, difficulty, source, source_type, status, is_verified,
  question_type, question_kind, fingerprint, import_batch_id, created_by
)
select r.course_id, r.subject_id, r.topic_id, r.subtopic_id, r.st,
       r.a, r.b, r.c, r.d, r.co,
       r.ex, r.diff,
       coalesce(r.source_title, 'AI import v2 — batch 1'),
       'ai_assisted', 'pending_review', false,
       'mcq', 'practice',
       encode(sha256(convert_to(r.st, 'UTF8')), 'hex'),
       b.id, r._admin
from jh_dedup r cross join jh_batch b
on conflict (course_id, fingerprint) do nothing;

update import_batches
set created_rows = (select count(*) from jh_dedup)
where id = (select id from jh_batch);

-- STEP 8 · SUMMARY
select
  r.subtopic_title as subtopic,
  count(*) as planned,
  count(*) filter (
    where exists (
      select 1 from questions q
      where q.course_id = r.course_id
        and q.fingerprint = encode(sha256(convert_to(r.st, 'UTF8')), 'hex')
    )
  ) as now_in_bank
from jh_rows r
group by r.subtopic_title
order by r.subtopic_title;

commit;
