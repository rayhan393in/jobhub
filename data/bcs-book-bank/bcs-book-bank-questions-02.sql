-- ---------------------------------------------------------------------------
-- JobHub — BCS book-based question bank, batch 02 (Khairul's Advanced Math,
-- pp. 3-4 H.C.F & L.C.M and pp. 386-387 Profit & Loss).
--
-- Verification rule (user's decision, 2026-11-21): a row whose options and
-- answer are printed in the book, with a printed page, is Source Verified and
-- lands approved. The two example-converted rows (options ours) stay draft.
-- None of these are BCS past-paper questions: exam_name and year stay NULL so
-- they can never feed past-paper frequency.
--
-- Idempotent: duplicates are skipped on the statement fingerprint.
-- ---------------------------------------------------------------------------
begin;

do $bb2$
declare
  v_course uuid := '599509ae-c4c3-440a-9463-802a4efc7a0c';
  v_author uuid; v_subject uuid; v_topic uuid; v_subtopic uuid;
  v_created int := 0; v_skipped int := 0; r jsonb; v_verified boolean;
  v_rows jsonb := $rows$[{"statement": "Find the greatest number that will divide 964, 1238 and 1400 leaving remainders 41, 31 and 51 respectively.", "statement_bn": "কোন বৃহত্তম সংখ্যা দিয়ে 964, 1238 ও 1400-কে ভাগ করলে যথাক্রমে 41, 31 ও 51 ভাগশেষ থাকে?", "option_a": "61", "option_b": "71", "option_c": "73", "option_d": "81", "correct": "B", "explanation": "ভাগশেষ বাদ দিয়ে গসাগু: (964−41), (1238−31), (1400−51) = 923, 1207, 1349; গসাগু = 71।\n[মূল বইয়ের সমাধান: Required number = H.C.F. of 923, 1207 and 1349 = 71]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 3, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 3", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-84], Ans:b ছাপা আছে।", "book_options": true}, {"statement": "The greatest possible length which can be used to measure exactly the lengths 7 m, 3 m 85 cm, 12 m 95 cm is", "statement_bn": "7 মিটার, 3 মিটার 85 সে.মি. ও 12 মিটার 95 সে.মি. দৈর্ঘ্যকে নিঃশেষে মাপা যায় এমন সর্বোচ্চ দৈর্ঘ্য কত?", "option_a": "15 cm", "option_b": "25 cm", "option_c": "35 cm", "option_d": "42 cm", "correct": "C", "explanation": "সেন্টিমিটারে: 700, 385, 1295; এদের গসাগু = 35 সে.মি.।\n[মূল বইয়ের সমাধান: Required length = H.C.F. of 700 cm, 385 cm and 1295 cm = 35 cm]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 3, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 3", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-69], Ans:c ছাপা আছে।", "book_options": true}, {"statement": "The capacity of two pots is 120 litres and 56 litres respectively. Find the capacity of a container which can exactly measure the contents of the two pots.", "statement_bn": "দুটি পাত্রের ধারণক্ষমতা যথাক্রমে 120 লিটার ও 56 লিটার। কত ধারণক্ষমতার কনটেইনার দিয়ে পাত্র দুটিকে পূর্ণসংখ্যক বারে মাপা যাবে?", "option_a": "7500 cc", "option_b": "7850 cc", "option_c": "8000 cc", "option_d": "9500 cc", "correct": "C", "explanation": "120 ও 56-এর গসাগু = 8 লিটার = 8000 সিসি (1 লিটার = 1000 সিসি)।\n[মূল বইয়ের সমাধান: Required capacity = H.C.F. of 120 litres and 56 litres = 8 litres = 8000 cc]", "difficulty": "easy", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 4, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 4", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-70], Ans:c ছাপা আছে।", "book_options": true}, {"statement": "A daily wage labourer was engaged for a certain number of days for Tk. 5750, but being absent on some of those days he was paid only Tk. 5000. What was his maximum possible daily wage?", "statement_bn": "এক দিনমজুরকে নির্দিষ্ট কিছু দিনের জন্য 5,750 টাকায় নিয়োগ করা হলো; কয়েকদিন অনুপস্থিত থাকায় সে পেল 5,000 টাকা। তার দৈনিক সর্বোচ্চ মজুরি কত?", "option_a": "Tk. 125", "option_b": "Tk. 250", "option_c": "Tk. 375", "option_d": "Tk. 500", "correct": "B", "explanation": "দৈনিক মজুরি দিয়ে 5750 ও 5000 দুটিই নিঃশেষে ভাগ হতে হবে; সর্বোচ্চ হলে গসাগু = 250 টাকা।\n[মূল বইয়ের সমাধান: Maximum possible daily wage = H.C.F. of 5750 and 5000 = 250]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 4, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 4", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-71], Ans:b ছাপা আছে।", "book_options": true}, {"statement": "Find the largest number which divides 62, 132 and 237 to leave the same remainder in each case.", "statement_bn": "কোন বৃহত্তম সংখ্যা দিয়ে 62, 132 ও 237-কে ভাগ করলে প্রতিক্ষেত্রে একই ভাগশেষ থাকে?", "option_a": "30", "option_b": "35", "option_c": "45", "option_d": "70", "correct": "B", "explanation": "একই ভাগশেষ থাকলে জোড়ায় জোড়ায় বিয়োগফলের গসাগুই উত্তর: (132−62), (237−132), (237−62) = 70, 105, 175; গসাগু = 35।\n[মূল বইয়ের সমাধান: Required number = H.C.F. of 70, 105 and 175 = 35]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 3, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 3", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের সমাধানকৃত উদাহরণ [Aggarwal-Exm-17]; উত্তর (35) বইয়ের, কিন্তু অপশনগুলো আমাদের সাজানো — তাই draft।", "book_options": false}, {"statement": "Find the greatest possible length which can be used to measure exactly the lengths 4 m 95 cm, 9 m and 16 m 65 cm.", "statement_bn": "4 মি. 95 সে.মি., 9 মি. এবং 16 মি. 65 সে.মি. দৈর্ঘ্যকে নিঃশেষে মাপা যায় এমন বৃহত্তম দৈর্ঘ্য কত?", "option_a": "35 cm", "option_b": "45 cm", "option_c": "55 cm", "option_d": "65 cm", "correct": "B", "explanation": "সেন্টিমিটারে: 495 = 3²×5×11, 900 = 2²×3²×5², 1665 = 3²×5×37; গসাগু = 3²×5 = 45 সে.মি.।\n[মূল বইয়ের সমাধান: H.C.F. = 3²×5 = 45. Hence, required length = 45 cm]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "H.C.F & L.C.M", "book_page": 3, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 3", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "362eee7c-25f9-4aa3-8e00-efe170e64300", "topic_bn": "গসাগু ও লসাগু", "subtopic_id": "36b725f7-d708-4d27-88a6-e01dfa63093c", "subtopic_bn": "গসাগু", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের সমাধানকৃত উদাহরণ [Aggarwal-Exm-15]; উত্তর (45 cm) বইয়ের, কিন্তু অপশনগুলো আমাদের সাজানো — তাই draft।", "book_options": false}, {"statement": "By selling an article at two-thirds of the marked price, there is a loss of 10%. What will be the profit percentage if the article is sold at the marked price?", "statement_bn": "লিখিত মূল্যের দুই-তৃতীয়াংশ দামে একটি পণ্য বিক্রি করলে 10% ক্ষতি হয়। লিখিত মূল্যে বিক্রি করলে কত লাভ হবে?", "option_a": "20%", "option_b": "30%", "option_c": "35%", "option_d": "40%", "correct": "C", "explanation": "ক্রয়মূল্য 100 ধরলে 10% ক্ষতিতে বিক্রয়মূল্য 90; এটি লিখিত মূল্যের 2/3 ⇒ লিখিত মূল্য = 90×3/2 = 135 ⇒ লিখিত মূল্যে লাভ = 35%।\n[মূল বইয়ের সমাধান: Marked price = 90×3/2 = 135, so profit = 135−100 = 35%]", "difficulty": "medium", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "Profit & Loss", "book_page": 386, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 386", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "topic_bn": "লাভ-ক্ষতি", "subtopic_id": "23a97320-3507-4d21-b5a1-a27052a18bec", "subtopic_bn": "লাভ ও ক্ষতি", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal Exm-23 + Aggarwal-139], Ans:c ছাপা আছে।", "book_options": true}, {"statement": "By selling an article at two-fifths of the marked price, there is a loss of 25%. The ratio of the marked price and the cost price of the article is", "statement_bn": "লিখিত মূল্যের দুই-পঞ্চমাংশ দামে একটি দ্রব্য বিক্রি করায় 25% ক্ষতি হয়। দ্রব্যটির লিখিত মূল্য ও ক্রয়মূল্যের অনুপাত কত?", "option_a": "2 : 5", "option_b": "5 : 2", "option_c": "8 : 15", "option_d": "15 : 8", "correct": "D", "explanation": "ক্রয়মূল্য 100 হলে 25% ক্ষতিতে বিক্রয়মূল্য 75; লিখিত মূল্যের 2/5 = 75 ⇒ লিখিত মূল্য = 187.5 ⇒ 187.5 : 100 = 15 : 8।\n[মূল বইয়ের সমাধান: Required ratio = 375 : 200 = 15 : 8]", "difficulty": "hard", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "Profit & Loss", "book_page": 386, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 386", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "topic_bn": "লাভ-ক্ষতি", "subtopic_id": "23a97320-3507-4d21-b5a1-a27052a18bec", "subtopic_bn": "লাভ ও ক্ষতি", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-246], Ans:d ছাপা আছে।", "book_options": true}, {"statement": "By selling a pen for Tk. 15, a man loses one-sixteenth of what it costs him. The cost price of the pen is", "statement_bn": "15 টাকায় একটি কলম বিক্রি করায় ক্রয়মূল্যের এক-ষোড়শাংশ ক্ষতি হয়। কলমটির ক্রয়মূল্য কত?", "option_a": "Tk. 16", "option_b": "Tk. 18", "option_c": "Tk. 20", "option_d": "Tk. 21", "correct": "A", "explanation": "ক্রয়মূল্য x হলে x − x/16 = 15 ⇒ 15x/16 = 15 ⇒ x = 16 টাকা।\n[মূল বইয়ের সমাধান: x − x/16 = 15 ⇒ x = 16, C.P. = 16]", "difficulty": "easy", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "Profit & Loss", "book_page": 387, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 387", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "topic_bn": "লাভ-ক্ষতি", "subtopic_id": "23a97320-3507-4d21-b5a1-a27052a18bec", "subtopic_bn": "লাভ ও ক্ষতি", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-48], Ans:a ছাপা আছে।", "book_options": true}, {"statement": "By selling an article, Michael earned a profit equal to one-fourth of the price he bought it. If he sold it for Tk. 375, what was the cost price?", "statement_bn": "মাইকেল একটি দ্রব্য বিক্রি করে ক্রয়মূল্যের এক-চতুর্থাংশ লাভ করে। সে দ্রব্যটি 375 টাকায় বিক্রি করলে ক্রয়মূল্য কত?", "option_a": "Tk. 281.75", "option_b": "Tk. 300", "option_c": "Tk. 312.50", "option_d": "Tk. 350", "correct": "B", "explanation": "ক্রয়মূল্য 4 অংশ হলে লাভ 1 অংশ, বিক্রয়মূল্য 5 অংশ = 375 ⇒ 1 অংশ = 75 ⇒ ক্রয়মূল্য = 300 টাকা।\n[মূল বইয়ের সমাধান: 4+1 = 5 অংশ = 375, so C.P. = 300]", "difficulty": "easy", "source_type": "manual", "source_title": "Khairul's Advanced Math", "author": "খাইরুল ইসলাম", "book_chapter": "Profit & Loss", "book_page": 387, "source_file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS", "source_locator": "PDF পৃ. 387", "source_url": "", "exam_name": "", "exam_year": "", "subject_id": "0688ee2a-cca7-47b2-bf85-6249887a9d5a", "subject_bn": "গাণিতিক যুক্তি", "topic_id": "64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "topic_bn": "লাভ-ক্ষতি", "subtopic_id": "23a97320-3507-4d21-b5a1-a27052a18bec", "subtopic_bn": "লাভ ও ক্ষতি", "official_paper_crosschecked": "false", "provenance_note": "বইয়ের নিজস্ব MCQ [Aggarwal-49], Ans:b ছাপা আছে।", "book_options": true}]$rows$;
begin
  select p.id into v_author
    from public.profiles p join public.roles ro on ro.id = p.role_id
   where ro.name_en = 'super_admin' order by p.created_at limit 1;
  if v_author is null then
    select p.id into v_author from public.profiles p order by p.created_at limit 1;
  end if;

  for r in select value from jsonb_array_elements(v_rows) loop
    v_subject := null; v_topic := null; v_subtopic := null;
    select s.id into v_subject from public.subjects s
     where s.course_id = v_course and s.title_bn = r->>'subject_bn' limit 1;
    select t.id into v_topic from public.topics t
      join public.subjects s on s.id = t.subject_id
     where s.course_id = v_course and s.title_bn = r->>'subject_bn'
       and t.title_bn = r->>'topic_bn' limit 1;
    if v_topic is not null and coalesce(r->>'subtopic_bn','') <> '' then
      select st.id into v_subtopic from public.subtopics st
       where st.topic_id = v_topic and st.title_bn = r->>'subtopic_bn' limit 1;
    end if;

    if exists (select 1 from public.questions qq
                where qq.course_id = v_course
                  and qq.fingerprint = encode(digest(btrim(r->>'statement'),'sha256'),'hex')) then
      v_skipped := v_skipped + 1; continue;
    end if;

    -- Source Verified only when the options themselves come from the book.
    v_verified := (r->>'book_options')::boolean;

    insert into public.questions (
      course_id, subject_id, topic_id, subtopic_id,
      statement, statement_bn, option_a, option_b, option_c, option_d,
      correct_option, explanation, difficulty, source, source_type, year,
      status, is_verified, fingerprint, external_ref,
      source_title, source_locator, source_url, source_file_id,
      book_chapter, book_page, author, edition, exam_name, created_by
    ) values (
      v_course, v_subject, v_topic, v_subtopic,
      r->>'statement', nullif(r->>'statement_bn',''),
      r->>'option_a', r->>'option_b', r->>'option_c', r->>'option_d',
      case upper(btrim(r->>'correct'))
        when 'A' then 0 when 'B' then 1 when 'C' then 2 when 'D' then 3 end,
      r->>'explanation',
      case when r->>'difficulty' in ('easy','medium','hard') then r->>'difficulty' else 'medium' end,
      (r->>'source_title') || ' — ' || (r->>'source_locator'),
      'manual', null,
      case when v_verified then 'approved' else 'draft' end,
      v_verified,
      encode(digest(btrim(r->>'statement'),'sha256'),'hex'),
      'bcs-book-bank-02-' || lpad((v_created + v_skipped + 1)::text, 3, '0'),
      nullif(r->>'source_title',''), nullif(r->>'source_locator',''),
      nullif(r->>'source_url',''), nullif(r->>'source_file_id',''),
      nullif(r->>'book_chapter',''),
      case when coalesce(r->>'book_page','') ~ '^[0-9]+$' then (r->>'book_page')::int else null end,
      nullif(r->>'author',''), null, nullif(r->>'exam_name',''), v_author
    );
    v_created := v_created + 1;
  end loop;

  raise notice 'bcs-book-bank-02: % created, % skipped', v_created, v_skipped;
end;
$bb2$;

commit;
