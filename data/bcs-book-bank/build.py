#!/usr/bin/env python3
"""
Build the BCS book/question-bank CSV + SQL from questions read out of the
user's Drive books.

Provenance rules this script enforces, because they are the point of the file:
  * every row names its book and page, and carries the Drive file id;
  * nothing is invented — each row is transcribed from text extracted from the
    book, or is a textbook-recipe exercise whose method and source are named;
  * rows whose book page could not be established honestly are marked
    `page_unknown` instead of being given a guessed page;
  * `official_paper_crosschecked` is false throughout: none of these were
    checked against an official BCS question paper, so none of them may feed
    the past-paper frequency engine.
"""

import csv
import hashlib
import json

COURSE = "599509ae-c4c3-440a-9463-802a4efc7a0c"

SUBJ_MATH = ("0688ee2a-cca7-47b2-bf85-6249887a9d5a", "গাণিতিক যুক্তি")
SUBJ_ENG = ("c71982a7-58d6-4632-9ca5-6922fdfb9485", "English Language & Literature")

HCF = ("362eee7c-25f9-4aa3-8e00-efe170e64300", "গসাগু ও লসাগু",
       "36b725f7-d708-4d27-88a6-e01dfa63093c", "গসাগু")
NUMBER = ("d91dd553-5107-443f-b68d-ccbf72c256ff", "বাস্তব সংখ্যা",
          "f38c5915-df9d-4c6f-beee-62aa2e37683f", "সংখ্যার শ্রেণি")
PCT = ("ef8fd80d-75a9-47f6-80ff-4c5b6ff0a35d", "শতকরা", None, None)

# Real syllabus rows only. The syllabus has no Conditionals topic, so both
# conditional questions sit under "Tense and aspect" with its real
# "Inversion" / "Tense" subtopics rather than inventing a syllabus node.
TENSE = ("1acdfec5-ef82-45b0-bfc3-624753238917", "Tense and aspect",
         "c7218985-3056-4200-9e20-a7caec2b2406", "Tense")
INVERSION = ("1acdfec5-ef82-45b0-bfc3-624753238917", "Tense and aspect",
             "9a984138-0ffc-486a-a22e-840342c36848", "Inversion")

PROFIT = ("64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "লাভ-ক্ষতি",
          "23a97320-3507-4d21-b5a1-a27052a18bec", "লাভ ও ক্ষতি")

ADV = {
    "title": "Khairul's Advanced Math",
    "author": "খাইরুল ইসলাম",
    "file_id": "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS",
}
KHAIRUL_NOTES = {
    "title": "Khairuls Percentage Profit Loss Combined Notes (Khairul's Advanced Math ভিত্তিক)",
    "author": "খাইরুল ইসলাম",
    "file_id": "11iEjGNzf-v4SGdSghHvrxbWBIRSaHDYj",
}
ENG_NOTES = {
    "title": "BCS English Grammar — Tense, Right Form of Verbs, Conditionals",
    "author": "",
    "file_id": "1LDMrzjbhYhGwOzBJo4OtmydyuVdWhgh6",
}

rows = []


def add(book, chapter, page, statement_bn, statement_en, options, ans, expl, subject, topic, difficulty,
        locator=None, exam_name=None, exam_year=None):
    tid, tbn, sid, sbn = topic
    subject_id, subject_bn = subject
    book_page = page if isinstance(page, int) else None
    rows.append({
        "statement": statement_en,
        "statement_bn": statement_bn,
        "option_a": options[0],
        "option_b": options[1],
        "option_c": options[2],
        "option_d": options[3],
        "correct": "ABCD"[ans],
        "explanation": expl,
        "difficulty": difficulty,
        "source_type": "manual",
        "source_title": book["title"],
        "author": book["author"],
        "book_chapter": chapter,
        "book_page": book_page if book_page is not None else "",
        "source_file_id": book["file_id"],
        "source_locator": locator or (f"PDF পৃ. {book_page}" if book_page else "page_unknown"),
        "source_url": "",
        "exam_name": exam_name or "",
        "exam_year": exam_year or "",
        "subject_id": subject_id or "",
        "subject_bn": subject_bn,
        "topic_id": tid,
        "topic_bn": tbn,
        "subtopic_id": sid or "",
        "subtopic_bn": "" if sbn is None else sbn,
        "official_paper_crosschecked": "false",
        "provenance_note": "বই থেকে সরাসরি ট্রান্সক্রাইব করা প্রশ্ন" if page else
                           "বইয়ের অধ্যায়ের পদ্ধতি ও উদাহরণ অনুসরণ করে তৈরি (পৃষ্ঠা অনিশ্চিত)",
    })


# ---------------------------------------------------------------- page 1 (HCF/LCM)
add(ADV, "H.C.F & L.C.M", 1,
    "330-এর উৎপাদকগুলো কোনটি?",
    "Find the factors of 330. (a) 2×4×5×11 (b) 2×3×7×13 (c) 2×3×5×13 (d) 2×3×5×11",
    ["2×4×5×11", "2×3×7×13", "2×3×5×13", "2×3×5×11"], 3,
    "330 = 2×3×5×11। বাকি বিকল্পগুলোর গুণফল 330 হয় না।\n[মূল বইয়ের সমাধান: 330 = 2×3×5×11]",
    SUBJ_MATH, HCF, "easy")

add(ADV, "H.C.F & L.C.M", 1,
    "0 এবং 6-এর সর্বোচ্চ সাধারণ গুণনীয়ক (গসাগু) কত?",
    "The highest common factor of 0 and 6 is",
    ["0", "3", "6", "Undefined"], 3,
    "শূন্য দিয়ে ভাগ সংজ্ঞায়িত নয়, তাই 0 কোনো স্বাভাবিক সংখ্যার উৎপাদক হতে পারে না।\n"
    "[মূল বইয়ের সমাধান: Since division by 0 is undefined, 0 cannot be a factor of any natural number.]",
    SUBJ_MATH, HCF, "medium")

add(ADV, "H.C.F & L.C.M", 1,
    "36 ও 84-এর গসাগু কত?",
    "Find the highest common factor of 36 and 84.",
    ["4", "6", "12", "18"], 2,
    "36 = 2²×3², 84 = 2²×3×7। সাধারণ মৌলিক উৎপাদকের সর্বনিম্ন ঘাত নিলে গসাগু = 2²×3 = 12।\n"
    "[মূল বইয়ের সমাধান: 36 = 4×9 = 2²×3², 84 = 4×21 = 2²×3×7, ∴ H.C.F. = 2²×3 = 12]",
    SUBJ_MATH, HCF, "easy")

add(ADV, "H.C.F & L.C.M", 1,
    "132, 204 ও 228-এর গসাগু কত?",
    "Find the HCF of 132, 204 and 228.",
    ["12", "18", "6", "21"], 0,
    "132 = 2²×3×11, 204 = 2²×3×17, 228 = 2²×3×19। সাধারণ উৎপাদক 2²×3 = 12।\n"
    "[মূল বইয়ের সমাধান: H.C.F. of 132, 204 and 228 is 2×2×3 = 12]",
    SUBJ_MATH, HCF, "easy")

add(ADV, "H.C.F & L.C.M", 1,
    "204, 1190 ও 1445-এর গসাগু কত?",
    "The H.C.F. of 204, 1190 and 1445 is",
    ["17", "18", "19", "21"], 0,
    "204 = 2²×3×17, 1190 = 2×5×7×17, 1445 = 5×17×17। তিনটিতেই সাধারণ উৎপাদক 17।\n"
    "[মূল বইয়ের সমাধান: ∴ H.C.F. = 17]",
    SUBJ_MATH, HCF, "medium")

add(ADV, "H.C.F & L.C.M", 1,
    "নিচের কোন সংখ্যার সবচেয়ে বেশি ভাজক আছে?",
    "Which of the following has most number of divisors?",
    ["99", "101", "176", "182"], 2,
    "99 = 3²×11 → (2+1)(1+1) = 6; 101 = 101 → 2; 176 = 2⁴×11 → (4+1)(1+1) = 10; "
    "182 = 2×7×13 → 2×2×2 = 8। সর্বোচ্চ 10টি ভাজক 176-এর।\n"
    "[মূল বইয়ের সমাধান: Hence, 176 has the most number of divisors. (10টি ভাজক)]",
    SUBJ_MATH, HCF, "medium")

add(ADV, "H.C.F & L.C.M", 2,
    "কোন বৃহত্তম সংখ্যা 105, 1001 ও 2436-কে নিঃশেষে ভাগ করে?",
    "The greatest number that exactly divides 105, 1001 and 2436 is",
    ["3", "7", "11", "21"], 1,
    "105 ও 1001-এর গসাগু = 7; 2436 ও 7-এর গসাগু = 7। তাই তিনটিরই গসাগু 7।\n"
    "[মূল বইয়ের সমাধান: H.C.F. of 105 & 1001 is 7. Also H.C.F. of 2436 & 7 is 7. ∴ H.C.F. = 7]",
    SUBJ_MATH, HCF, "medium")

add(ADV, "H.C.F & L.C.M", 2,
    "1001টি কলম ও 910টি পেন্সিল সমান সংখ্যক কলম ও পেন্সিল দিয়ে সর্বোচ্চ কতজন শিক্ষার্থীর মধ্যে ভাগ করা যাবে?",
    "The maximum number of students among whom 1001 pens and 910 pencils can be distributed "
    "so that each student gets the same number of pens and pencils is",
    ["91", "910", "1001", "1911"], 0,
    "প্রত্যেকের সমান সংখ্যক কলম ও পেন্সিল পেতে হলে শিক্ষার্থীসংখ্যা 1001 ও 910-এর সাধারণ গুণনীয়ক হবে; "
    "সর্বোচ্চ হলে গসাগু = 91।\n[মূল বইয়ের সমাধান: Required number of students = H.C.F. of 1001 and 910 = 91]",
    SUBJ_MATH, HCF, "medium")

add(ADV, "H.C.F & L.C.M", 2,
    "3.78 মিটার দীর্ঘ ও 5.25 মিটার প্রস্থ একটি আয়তাকার উঠান সমান মাপের বর্গাকার টাইলস দিয়ে সম্পূর্ণ ঢাকতে "
    "ব্যবহৃত টাইলের সর্বোচ্চ মাপ কত?",
    "A rectangular courtyard 3.78 m long and 5.25 m wide is to be paved exactly with square tiles, "
    "all of the same size. What is the largest size of the tile which could be used?",
    ["14 cm", "21 cm", "42 cm", "None"], 1,
    "সেন্টিমিটারে: 378 cm ও 525 cm। ডিম্বাকার নয়—বর্গাকার টাইলে পুরো ঢাকতে হলে বাহু দুটির সাধারণ গুণনীয়ক দরকার, "
    "সর্বোচ্চ হলে গসাগু = 21 cm।\n[মূল বইয়ের সমাধান: Largest size of the tile = H.C.F. of 378 cm and 525 cm = 21 cm]",
    SUBJ_MATH, HCF, "hard")

add(ADV, "H.C.F & L.C.M", 3,
    "একজন দুধবিক্রেতার তিনটি পাত্রে যথাক্রমে 57 লিটার, 129 লিটার ও 177 লিটার দুধ আছে। একটি মাপার ক্যান দিয়ে "
    "মাপার পর প্রতিটি পাত্রে সমান পরিমাণ দুধ অবশিষ্ট থাকে। ক্যানটির সর্বোচ্চ ধারণক্ষমতা কত?",
    "A milkman has 3 jars containing 57, 129 and 177 litres of pure milk. A measuring can, after a "
    "different number of exact measurements in each jar, leaves the same amount of milk unmeasured "
    "in each jar. What is the volume of the largest such can?",
    ["12 litres", "16 litres", "24 litres", "None"], 2,
    "তিনটি জোড়ার বিয়োগফলের গসাগুই উত্তর: (129−57), (177−129), (177−57) = 72, 48, 120; এদের গসাগু 24 লিটার।\n"
    "[মূল বইয়ের সমাধান: Required volume = H.C.F of (129−57), (177−129) and (177−57) = H.C.F. of 72, 48 and 120 = 24 litres]",
    SUBJ_MATH, HCF, "hard")

add(ADV, "H.C.F & L.C.M", 3,
    "কোন বৃহত্তম সংখ্যা দিয়ে 3026 ও 5053-কে ভাগ করলে যথাক্রমে 11 ও 13 ভাগশেষ থাকে?",
    "Which greatest number will divide 3026 and 5053 leaving remainders 11 and 13 respectively?",
    ["15", "30", "45", "60"], 2,
    "ভাগশেষ বাদ দিয়ে গসাগু: (3026−11) = 3015, (5053−13) = 5040; গসাগু = 45।\n"
    "[মূল বইয়ের সমাধান: Required number = H.C.F. of 3015 and 5040 = 45]",
    SUBJ_MATH, HCF, "medium")


# ------------------------------------------------ page 4/5 (number-classification block)
add(ADV, "H.C.F & L.C.M", 4,
    "দুইটি সংখ্যার যোগফল 33 এবং বিয়োগফল 15 হলে ছোট সংখ্যাটি কত?",
    "If the sum of two numbers is 33 and their difference is 15, the smaller number is",
    ["9", "12", "15", "18"], 0,
    "x + y = 33, x − y = 15 ⇒ 2y = 18 ⇒ y = 9।\n"
    "[মূল বইয়ের সমাধান: Solving (i) and (ii) we get x = 24, y = 9. Smaller number = 9]",
    SUBJ_MATH, NUMBER, "easy")

add(ADV, "H.C.F & L.C.M", 4,
    "দুইটি সংখ্যার যোগফল 20 ও বিয়োগফল 8 হলে তাদের বর্গের বিয়োগফল কত?",
    "If the sum and difference of two numbers are 20 and 8 respectively, then the difference of their squares is",
    ["12", "28", "160", "180"], 2,
    "x² − y² = (x + y)(x − y) = 20 × 8 = 160।\n[মূল বইয়ের সমাধান: ∴ x² − y² = (x + y)(x − y) = 20 × 8 = 160]",
    SUBJ_MATH, NUMBER, "easy")

add(ADV, "H.C.F & L.C.M", 4,
    "দুইটি সংখ্যার যোগফল 25 ও বিয়োগফল 13 হলে তাদের গুণফল কত?",
    "The sum of two numbers is 25 and their difference is 13. Find their product.",
    ["104", "114", "315", "325"], 1,
    "4xy = (x+y)² − (x−y)² = 625 − 169 = 456 ⇒ xy = 114।\n"
    "[মূল বইয়ের সমাধান: ∴ 4xy = (25)² − (13)² = 456, ∴ xy = 456 ÷ 4 = 114]",
    SUBJ_MATH, NUMBER, "medium")

add(ADV, "H.C.F & L.C.M", 4,
    "দুইটি সংখ্যার যোগফল 75 ও বিয়োগফল 25 হলে সংখ্যা দুইটির গুণফল কত?",
    "The sum of two numbers is 75 and their difference is 25. The product of the two numbers is",
    ["1350", "1250", "125", "1000"], 1,
    "বড় সংখ্যা = (75+25)/2 = 50, ছোট = (75−25)/2 = 25 ⇒ গুণফল = 1250।\n"
    "[মূল বইয়ের সমাধান: ∴ গুণফল = 50 × 25 = 1250]",
    SUBJ_MATH, NUMBER, "easy")

add(ADV, "Problems on numbers", 5,
    "দুইটি সংখ্যার যোগফল 40 ও বিয়োগফল 4 হলে সংখ্যা দুইটির অনুপাত কত?",
    "The sum of two numbers is 40 and their difference is 4. The ratio of the numbers is",
    ["11 : 9", "11 : 18", "21 : 19", "22 : 9"], 0,
    "2x = 44 ⇒ x = 22, y = 18 ⇒ 22 : 18 = 11 : 9।\n"
    "[মূল বইয়ের সমাধান: So, x : y = 22 : 18 = 11 : 9]",
    SUBJ_MATH, NUMBER, "easy")

add(ADV, "Problems on numbers", 5,
    "দুইটি সংখ্যার বিয়োগফল 10 এবং তাদের যোগফলের এক-পঞ্চমাংশ 8 হলে ছোট সংখ্যাটি কত?",
    "The difference between two numbers is 10 and one-fifth of their sum is equal to 8. "
    "Find the smaller number.",
    ["28", "45", "35", "15"], 3,
    "যোগফলের ১/৫ = 8 ⇒ যোগফল = 40। x − y = 10, x + y = 40 ⇒ 2y = 30 ⇒ y = 15।\n"
    "[মূল বইয়ের সমাধান: x − y = 10 …(i) থেকে ছোট সংখ্যা 15]",
    SUBJ_MATH, NUMBER, "medium")

# ------------------------------------------------ Khairul notes: Percentage
add(KHAIRUL_NOTES, "Percentage", None,
    "একটি সংখ্যা 20% ও 30% ধারাবাহিকভাবে বাড়লে মোট কত শতাংশ বৃদ্ধি হয়?",
    "A number is increased successively by 20% and 30%. What is the net increase?",
    ["50%", "56%", "54%", "60%"], 1,
    "সূত্র: Net increase = R + S + RS/100 = 20 + 30 + (20×30)/100 = 56%।\n"
    "[মূল নোটের সমাধান: 20 + 30 + (20×30)/100 = 56%। অতএব বৃদ্ধি = 56%]",
    SUBJ_MATH, PCT, "easy", locator="PDF — নোটের PART-A, ধারাবাহিক শতাংশ পরিবর্তন")

add(KHAIRUL_NOTES, "Percentage", None,
    "একটি সংখ্যা 20% ও 30% ধারাবাহিকভাবে কমলে মোট কত শতাংশ হ্রাস হয়?",
    "A number is decreased successively by 20% and 30%. What is the net decrease?",
    ["50%", "46%", "44%", "56%"], 2,
    "সূত্র: Net decrease = R + S − RS/100 = 20 + 30 − (20×30)/100 = 44%।\n"
    "[মূল নোটের সমাধান: 20 + 30 − (20×30)/100 = 44% decrease]",
    SUBJ_MATH, PCT, "easy", locator="PDF — নোটের PART-A, ধারাবাহিক শতাংশ পরিবর্তন")

add(KHAIRUL_NOTES, "Percentage", None,
    "একটি পণ্যের দাম 30% বাড়িয়ে তারপর 10% ও 10% ধারাবাহিক ছাড় দেওয়া হলো। মূল দামের তুলনায় মোট পরিবর্তন কত?",
    "A product's price is raised by 30% and then two successive 10% discounts are applied. "
    "What is the change from the original price?",
    ["5.3% বৃদ্ধি", "5.3% হ্রাস", "10% বৃদ্ধি", "কোনো পরিবর্তন নেই"], 0,
    "মূল দাম 100 ধরলে: 100 → 130 → 130×90% = 117 → 117×90% = 105.30। "
    "অর্থাৎ 105.30 − 100 = 5.3% বৃদ্ধি।\n"
    "[মূল নোটের সমাধান: তাই original-এর তুলনায় বৃদ্ধি = 105.30 − 100 = 5.3%]",
    SUBJ_MATH, PCT, "medium", locator="PDF — নোটের PART-A, Increase-এর পর Discount")

add(KHAIRUL_NOTES, "Percentage", None,
    "5 লিটার দ্রবণে অ্যালকোহল 40%। তাতে আরও 1 লিটার পানি যোগ করলে অ্যালকোহলের শতকরা পরিমাণ কত হবে?",
    "A 5 litre solution is 40% alcohol. If 1 litre of water is added, what is the new alcohol percentage?",
    ["40%", "33⅓%", "30%", "36%"], 1,
    "অ্যালকোহল = 5×40/100 = 2 লিটার। নতুন মোট = 6 লিটার ⇒ 2/6×100 = 33⅓%।\n"
    "[মূল নোটের সমাধান: New alcohol percentage = 2/6×100 = 33⅓%]",
    SUBJ_MATH, PCT, "medium", locator="PDF — নোটের PART-A, Mixture-এ Percentage")

# ------------------------------------------------ Khairul notes: Profit & Loss
add(KHAIRUL_NOTES, "Profit & Loss", None,
    "ক্রয়মূল্য ৫০০ টাকা এবং বিক্রয়মূল্য ৬০০ টাকা হলে শতকরা লাভ কত?",
    "Cost price is Tk 500 and selling price is Tk 600. What is the profit percentage?",
    ["10%", "20%", "25%", "16.67%"], 1,
    "লাভ = 600 − 500 = 100 টাকা। লাভের শতাংশ সর্বদা ক্রয়মূল্যের ওপর: 100/500×100 = 20%।\n"
    "[মূল নোটের সমাধান: Profit = 100। Profit% = 100/500×100 = 20%]",
    SUBJ_MATH, PROFIT, "easy", locator="PDF — নোটের PART-B, Basic Terms ও Formula")

add(KHAIRUL_NOTES, "Profit & Loss", None,
    "একটি জিনিস ১৭৫৪ টাকায় বিক্রি করলে যত লাভ হয়, ১৪৯২ টাকায় বিক্রি করলে ঠিক তত ক্ষতি হয়। ক্রয়মূল্য কত?",
    "Selling an item for Tk 1754 gives the same profit as selling it for Tk 1492 gives loss. "
    "What is the cost price?",
    ["Tk 1623", "Tk 1600", "Tk 1700", "Tk 1580"], 0,
    "সমান লাভ ও সমান ক্ষতি হলে ক্রয়মূল্য = দুই বিক্রয়মূল্যের যোগফল ÷ 2 = (1754+1492)/2 = 1623 টাকা।\n"
    "[মূল নোটের সমাধান: C.P. = (1754+1492)/2 = 3246/2 = Tk.1623]",
    SUBJ_MATH, PROFIT, "medium", locator="PDF — নোটের PART-B, Equal Profit ও Equal Loss")

add(KHAIRUL_NOTES, "Profit & Loss", None,
    "একই বিক্রয়মূল্যে একটি জিনিস 12% লাভে ও আরেকটি 12% ক্ষতিতে বিক্রি হলো। মোটের ওপর শতকরা কত লাভ বা ক্ষতি?",
    "Two items are sold at the same selling price, one at 12% gain and the other at 12% loss. "
    "What is the overall gain or loss?",
    ["12% ক্ষতি", "1.44% ক্ষতি", "1.44% লাভ", "কোনো লাভ-ক্ষতি নেই"], 1,
    "সমান বিক্রয়মূল্যে ±x% হলে সর্বদা ক্ষতি = (x/10)²% = (12/10)² = 1.44%।\n"
    "[মূল নোটের সমাধান: Loss% = (12/10)² = 1.44%। অতএব overall = 1.44% loss]",
    SUBJ_MATH, PROFIT, "medium", locator="PDF — নোটের PART-B, Same Selling Price-এ Equal Gain ও Loss")

add(KHAIRUL_NOTES, "Profit & Loss", None,
    "একটি দোকানদার ২০% লাভে পাইকারের কাছে বিক্রি করল, পাইকার ৫% ক্ষতিতে খুচরা বিক্রেতার কাছে বিক্রি করল। "
    "মোটের ওপর শতকরা কত লাভ?",
    "A manufacturer sells to a wholesaler at 20% profit, and the wholesaler sells to a retailer at "
    "5% loss. What is the overall profit percentage?",
    ["15%", "14%", "25%", "12%"], 1,
    "ক্রয়মূল্য 100 ধরলে: 100 → 120 → 120×95% = 114। মোট লাভ = 14%।\n"
    "[মূল নোটের সমাধান: CP = 100 → প্রথম SP = 120 → দ্বিতীয় SP = 114। Overall profit = 14%]",
    SUBJ_MATH, PROFIT, "medium", locator="PDF — নোটের PART-B, Selling Two Times")

add(KHAIRUL_NOTES, "Profit & Loss", None,
    "ক্রয়মূল্যের ২০% বেশি দামে লিখিত মূল্য (M.P.) নির্ধারণ করে ১০% ছাড় দেওয়া হলো। প্রকৃত লাভ কত?",
    "A marked price is set 20% above cost, then a 10% discount is given. What is the actual profit?",
    ["8%", "10%", "12%", "20%"], 0,
    "C.P. = 100 ⇒ M.P. = 120; 10% ছাড়ে S.P. = 120×90% = 108 ⇒ লাভ = 8%।\n"
    "[মূল নোটের সমাধান: SP = 120×90% = 108। Profit = 108−100 = 8%]",
    SUBJ_MATH, PROFIT, "medium", locator="PDF — নোটের PART-C, Markup + Discount")

add(KHAIRUL_NOTES, "Profit & Loss", None,
    "৮০ টাকা লিখিত মূল্যের ওপর ৫% ও ৫% ধারাবাহিক ছাড়ে বিক্রয়মূল্য কত?",
    "What is the selling price after two successive 5% discounts on a marked price of Tk 80?",
    ["Tk 72.00", "Tk 72.20", "Tk 72.80", "Tk 71.20"], 1,
    "80×95%×95% = 72.20 টাকা।\n[মূল নোটের সমাধান: SP = 80×95%×95% = Tk.72.20]",
    SUBJ_MATH, PROFIT, "easy", locator="PDF — নোটের PART-C, Successive Discount")

# ------------------------------------------------ English notes
add(ENG_NOTES, "Tense", None,
    "He ____ (arrive) just now. — সঠিক রূপ কোনটি?",
    "Choose the correct form of the verb: He ____ (arrive) just now.",
    ["arrives", "arrived", "has arrived", "is arriving"], 2,
    "সমাপ্ত ক্রিয়া যার বর্তমানের সাথে সম্পর্ক আছে — Present Perfect (has + V3)। 'Just now' এখানে সদ্য-শেষ অর্থে।\n"
    "[মূল নোটের নিয়ম: Present Perfect = have/has + V3; completed action with present relevance: He has arrived]",
    SUBJ_ENG, TENSE, "medium",
    locator="PDF — নোটের 1. TENSE")

add(ENG_NOTES, "Right form of verbs", None,
    "No sooner ____ he arrived than it started raining.",
    "Choose the correct option: No sooner ____ he arrived than it started raining.",
    ["has", "had", "have", "was"], 1,
    "No sooner + had + V3 + than — নির্দিষ্ট গঠন।\n"
    "[মূল নোটের নিয়ম: No sooner had he arrived than it started raining]",
    SUBJ_ENG, TENSE, "medium",
    locator="PDF — নোটের 1. TENSE, High-yield Tense Rules")

add(ENG_NOTES, "Right form of verbs", None,
    "I look forward to ____ (meet) you.",
    "Choose the correct form: I look forward to ____ (meet) you.",
    ["meet", "meeting", "have met", "met"], 1,
    "'look forward to'-তে to অব্যয় (preposition), তাই এর পরে gerund (V-ing) বসে।\n"
    "[মূল নোটের নিয়ম: look forward to + V-ing: I look forward to meeting you]",
    SUBJ_ENG, TENSE, "medium",
    locator="PDF — নোটের 2. RIGHT FORM OF VERBS, BCS Traps")

add(ENG_NOTES, "Conditionals", None,
    "If I ____ rich, I would help the poor.",
    "Choose the correct option: If I ____ rich, I would help the poor.",
    ["am", "was", "were", "will be"], 2,
    "Second conditional: If + Past Simple, would + V1। 'be' verb-এর unreal form সর্বদা 'were'।\n"
    "[মূল নোটের উদাহরণ: Second Conditional: If I were rich, I would help the poor]",
    SUBJ_ENG, TENSE, "medium",
    locator="PDF — নোটের 3. CONDITIONALS")

add(ENG_NOTES, "Conditionals", None,
    "____ I known this, I would have helped you.",
    "Choose the correct option: ____ I known this, I would have helped you.",
    ["If", "Had", "Were", "Should"], 1,
    "Third conditional-এর inverted রূপ: Had + subject + V3 (= If I had known...)।\n"
    "[মূল নোটের নিয়ম: Had + S + V3: Had I known this, I would have helped you]",
    SUBJ_ENG, INVERSION, "hard",
    locator="PDF — নোটের 3. CONDITIONALS, Inverted Conditionals")

add(ENG_NOTES, "Right form of verbs", None,
    "He is accustomed to ____ (work) hard.",
    "Choose the correct form: He is accustomed to ____ (work) hard.",
    ["work", "working", "worked", "have worked"], 1,
    "'be accustomed to'-তে to preposition, তাই gerund বসে।\n"
    "[মূল নোটের নিয়ম: be accustomed to + V-ing: He is accustomed to working hard]",
    SUBJ_ENG, TENSE, "medium",
    locator="PDF — নোটের 2. RIGHT FORM OF VERBS, BCS Traps")


# ---------------------------------------------------------------- duplicate guard
seen = {}
for row in rows:
    key = row["statement"].strip().lower()
    if key in seen:
        raise SystemExit(f"duplicate statement: {row['statement'][:60]}")
    seen[key] = True
    if len(row["statement"].strip()) < 8:
        raise SystemExit(f"statement too short: {row['statement']}")
    if row["book_page"] == "" and row["source_locator"] == "page_unknown":
        pass  # allowed, marked explicitly
    if row["source_locator"] == "":
        raise SystemExit("missing locator")
    for col in ("option_a", "option_b", "option_c", "option_d"):
        if not row[col].strip():
            raise SystemExit(f"empty {col}: {row['statement'][:40]}")

print(f"rows: {len(rows)}")
print("book pages known:", sum(1 for r in rows if r["book_page"] != ""))
print("page_unknown:", sum(1 for r in rows if r["source_locator"] == "page_unknown"))

COLS = ["statement", "statement_bn", "option_a", "option_b", "option_c", "option_d",
        "correct", "explanation", "difficulty", "source_type", "source_title", "author",
        "book_chapter", "book_page", "source_file_id", "source_locator", "source_url",
        "exam_name", "exam_year", "subject_id", "subject_bn", "topic_id", "topic_bn",
        "subtopic_id", "subtopic_bn", "official_paper_crosschecked", "provenance_note"]

with open("data/bcs-book-bank/bcs-book-bank-questions.csv", "w", newline="", encoding="utf-8-sig") as handle:
    writer = csv.DictWriter(handle, fieldnames=COLS)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)

json.dump(rows, open("data/bcs-book-bank/_rows.json", "w", encoding="utf-8"), ensure_ascii=False)
print("csv written")
