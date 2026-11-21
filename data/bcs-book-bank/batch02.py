#!/usr/bin/env python3
"""
Batch 02 — Khairul's Advanced Math, second read (2026-11-21).

Sources, all from the same text-readable PDF (Drive 1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS):
  * H.C.F & L.C.M chapter, printed pages 3–4   (6 rows)
  * Profit & Loss chapter, printed pages 386–387 (4 rows)

Eight rows carry the book's own options and printed answer ("Ans:x") and are
therefore eligible for the user's Source-Verified rule. Two rows are worked
examples ([Aggarwal-Exm-...]) that the book solves without options; converting
them to MCQs was explicitly authorised, but because the distractors are ours,
those two stay draft and say so in their provenance note.
"""

import csv
import hashlib
import json

COURSE = "599509ae-c4c3-440a-9463-802a4efc7a0c"
MATH = ("0688ee2a-cca7-47b2-bf85-6249887a9d5a", "গাণিতিক যুক্তি")
GCD = ("362eee7c-25f9-4aa3-8e00-efe170e64300", "গসাগু ও লসাগু", "36b725f7-d708-4d27-88a6-e01dfa63093c", "গসাগু")
PL = ("64365abd-f9f3-4f4f-bbbb-133816ddfaf8", "লাভ-ক্ষতি", "23a97320-3507-4d21-b5a1-a27052a18bec", "লাভ ও ক্ষতি")

BOOK = "Khairul's Advanced Math"
AUTHOR = "খাইরুল ইসলাম"
FILE_ID = "1ptOe2Ft038mQ3B1RepHUMNeBPB3SyLcS"

rows = []


def add(topic, chapter, page, statement, bn, a, b, c, d, correct, expl, diff, note, book_options=True):
    rows.append({
        "statement": statement, "statement_bn": bn,
        "option_a": a, "option_b": b, "option_c": c, "option_d": d,
        "correct": correct, "explanation": expl, "difficulty": diff,
        "source_type": "manual", "source_title": BOOK, "author": AUTHOR,
        "book_chapter": chapter, "book_page": page, "source_file_id": FILE_ID,
        "source_locator": f"PDF পৃ. {page}", "source_url": "",
        "exam_name": "", "exam_year": "",
        "subject_id": MATH[0], "subject_bn": MATH[1],
        "topic_id": topic[0], "topic_bn": topic[1],
        "subtopic_id": topic[2], "subtopic_bn": topic[3],
        "official_paper_crosschecked": "false",
        "provenance_note": note,
        "book_options": book_options,
    })


# ---- H.C.F & L.C.M, pp. 3–4 — book's own MCQs -------------------------------

add(GCD, "H.C.F & L.C.M", 3,
    "Find the greatest number that will divide 964, 1238 and 1400 leaving remainders 41, 31 and 51 respectively.",
    "কোন বৃহত্তম সংখ্যা দিয়ে 964, 1238 ও 1400-কে ভাগ করলে যথাক্রমে 41, 31 ও 51 ভাগশেষ থাকে?",
    "61", "71", "73", "81", "B",
    "ভাগশেষ বাদ দিয়ে গসাগু: (964−41), (1238−31), (1400−51) = 923, 1207, 1349; গসাগু = 71।\n[মূল বইয়ের সমাধান: Required number = H.C.F. of 923, 1207 and 1349 = 71]",
    "medium", "বইয়ের নিজস্ব MCQ [Aggarwal-84], Ans:b ছাপা আছে।")

add(GCD, "H.C.F & L.C.M", 3,
    "The greatest possible length which can be used to measure exactly the lengths 7 m, 3 m 85 cm, 12 m 95 cm is",
    "7 মিটার, 3 মিটার 85 সে.মি. ও 12 মিটার 95 সে.মি. দৈর্ঘ্যকে নিঃশেষে মাপা যায় এমন সর্বোচ্চ দৈর্ঘ্য কত?",
    "15 cm", "25 cm", "35 cm", "42 cm", "C",
    "সেন্টিমিটারে: 700, 385, 1295; এদের গসাগু = 35 সে.মি.।\n[মূল বইয়ের সমাধান: Required length = H.C.F. of 700 cm, 385 cm and 1295 cm = 35 cm]",
    "medium", "বইয়ের নিজস্ব MCQ [Aggarwal-69], Ans:c ছাপা আছে।")

add(GCD, "H.C.F & L.C.M", 4,
    "The capacity of two pots is 120 litres and 56 litres respectively. Find the capacity of a container which can exactly measure the contents of the two pots.",
    "দুটি পাত্রের ধারণক্ষমতা যথাক্রমে 120 লিটার ও 56 লিটার। কত ধারণক্ষমতার কনটেইনার দিয়ে পাত্র দুটিকে পূর্ণসংখ্যক বারে মাপা যাবে?",
    "7500 cc", "7850 cc", "8000 cc", "9500 cc", "C",
    "120 ও 56-এর গসাগু = 8 লিটার = 8000 সিসি (1 লিটার = 1000 সিসি)।\n[মূল বইয়ের সমাধান: Required capacity = H.C.F. of 120 litres and 56 litres = 8 litres = 8000 cc]",
    "easy", "বইয়ের নিজস্ব MCQ [Aggarwal-70], Ans:c ছাপা আছে।")

add(GCD, "H.C.F & L.C.M", 4,
    "A daily wage labourer was engaged for a certain number of days for Tk. 5750, but being absent on some of those days he was paid only Tk. 5000. What was his maximum possible daily wage?",
    "এক দিনমজুরকে নির্দিষ্ট কিছু দিনের জন্য 5,750 টাকায় নিয়োগ করা হলো; কয়েকদিন অনুপস্থিত থাকায় সে পেল 5,000 টাকা। তার দৈনিক সর্বোচ্চ মজুরি কত?",
    "Tk. 125", "Tk. 250", "Tk. 375", "Tk. 500", "B",
    "দৈনিক মজুরি দিয়ে 5750 ও 5000 দুটিই নিঃশেষে ভাগ হতে হবে; সর্বোচ্চ হলে গসাগু = 250 টাকা।\n[মূল বইয়ের সমাধান: Maximum possible daily wage = H.C.F. of 5750 and 5000 = 250]",
    "medium", "বইয়ের নিজস্ব MCQ [Aggarwal-71], Ans:b ছাপা আছে।")

# ---- দুটি উদাহরণ → MCQ (অপশন আমাদের, তাই draft) ------------------------------

add(GCD, "H.C.F & L.C.M", 3,
    "Find the largest number which divides 62, 132 and 237 to leave the same remainder in each case.",
    "কোন বৃহত্তম সংখ্যা দিয়ে 62, 132 ও 237-কে ভাগ করলে প্রতিক্ষেত্রে একই ভাগশেষ থাকে?",
    "30", "35", "45", "70", "B",
    "একই ভাগশেষ থাকলে জোড়ায় জোড়ায় বিয়োগফলের গসাগুই উত্তর: (132−62), (237−132), (237−62) = 70, 105, 175; গসাগু = 35।\n[মূল বইয়ের সমাধান: Required number = H.C.F. of 70, 105 and 175 = 35]",
    "medium",
    "বইয়ের সমাধানকৃত উদাহরণ [Aggarwal-Exm-17]; উত্তর (35) বইয়ের, কিন্তু অপশনগুলো আমাদের সাজানো — তাই draft।",
    book_options=False)

add(GCD, "H.C.F & L.C.M", 3,
    "Find the greatest possible length which can be used to measure exactly the lengths 4 m 95 cm, 9 m and 16 m 65 cm.",
    "4 মি. 95 সে.মি., 9 মি. এবং 16 মি. 65 সে.মি. দৈর্ঘ্যকে নিঃশেষে মাপা যায় এমন বৃহত্তম দৈর্ঘ্য কত?",
    "35 cm", "45 cm", "55 cm", "65 cm", "B",
    "সেন্টিমিটারে: 495 = 3²×5×11, 900 = 2²×3²×5², 1665 = 3²×5×37; গসাগু = 3²×5 = 45 সে.মি.।\n[মূল বইয়ের সমাধান: H.C.F. = 3²×5 = 45. Hence, required length = 45 cm]",
    "medium",
    "বইয়ের সমাধানকৃত উদাহরণ [Aggarwal-Exm-15]; উত্তর (45 cm) বইয়ের, কিন্তু অপশনগুলো আমাদের সাজানো — তাই draft।",
    book_options=False)

# ---- Profit & Loss, pp. 386–387 — book's own MCQs ----------------------------

add(PL, "Profit & Loss", 386,
    "By selling an article at two-thirds of the marked price, there is a loss of 10%. What will be the profit percentage if the article is sold at the marked price?",
    "লিখিত মূল্যের দুই-তৃতীয়াংশ দামে একটি পণ্য বিক্রি করলে 10% ক্ষতি হয়। লিখিত মূল্যে বিক্রি করলে কত লাভ হবে?",
    "20%", "30%", "35%", "40%", "C",
    "ক্রয়মূল্য 100 ধরলে 10% ক্ষতিতে বিক্রয়মূল্য 90; এটি লিখিত মূল্যের 2/3 ⇒ লিখিত মূল্য = 90×3/2 = 135 ⇒ লিখিত মূল্যে লাভ = 35%।\n[মূল বইয়ের সমাধান: Marked price = 90×3/2 = 135, so profit = 135−100 = 35%]",
    "medium", "বইয়ের নিজস্ব MCQ [Aggarwal Exm-23 + Aggarwal-139], Ans:c ছাপা আছে।")

add(PL, "Profit & Loss", 386,
    "By selling an article at two-fifths of the marked price, there is a loss of 25%. The ratio of the marked price and the cost price of the article is",
    "লিখিত মূল্যের দুই-পঞ্চমাংশ দামে একটি দ্রব্য বিক্রি করায় 25% ক্ষতি হয়। দ্রব্যটির লিখিত মূল্য ও ক্রয়মূল্যের অনুপাত কত?",
    "2 : 5", "5 : 2", "8 : 15", "15 : 8", "D",
    "ক্রয়মূল্য 100 হলে 25% ক্ষতিতে বিক্রয়মূল্য 75; লিখিত মূল্যের 2/5 = 75 ⇒ লিখিত মূল্য = 187.5 ⇒ 187.5 : 100 = 15 : 8।\n[মূল বইয়ের সমাধান: Required ratio = 375 : 200 = 15 : 8]",
    "hard", "বইয়ের নিজস্ব MCQ [Aggarwal-246], Ans:d ছাপা আছে।")

add(PL, "Profit & Loss", 387,
    "By selling a pen for Tk. 15, a man loses one-sixteenth of what it costs him. The cost price of the pen is",
    "15 টাকায় একটি কলম বিক্রি করায় ক্রয়মূল্যের এক-ষোড়শাংশ ক্ষতি হয়। কলমটির ক্রয়মূল্য কত?",
    "Tk. 16", "Tk. 18", "Tk. 20", "Tk. 21", "A",
    "ক্রয়মূল্য x হলে x − x/16 = 15 ⇒ 15x/16 = 15 ⇒ x = 16 টাকা।\n[মূল বইয়ের সমাধান: x − x/16 = 15 ⇒ x = 16, C.P. = 16]",
    "easy", "বইয়ের নিজস্ব MCQ [Aggarwal-48], Ans:a ছাপা আছে।")

add(PL, "Profit & Loss", 387,
    "By selling an article, Michael earned a profit equal to one-fourth of the price he bought it. If he sold it for Tk. 375, what was the cost price?",
    "মাইকেল একটি দ্রব্য বিক্রি করে ক্রয়মূল্যের এক-চতুর্থাংশ লাভ করে। সে দ্রব্যটি 375 টাকায় বিক্রি করলে ক্রয়মূল্য কত?",
    "Tk. 281.75", "Tk. 300", "Tk. 312.50", "Tk. 350", "B",
    "ক্রয়মূল্য 4 অংশ হলে লাভ 1 অংশ, বিক্রয়মূল্য 5 অংশ = 375 ⇒ 1 অংশ = 75 ⇒ ক্রয়মূল্য = 300 টাকা।\n[মূল বইয়ের সমাধান: 4+1 = 5 অংশ = 375, so C.P. = 300]",
    "easy", "বইয়ের নিজস্ব MCQ [Aggarwal-49], Ans:b ছাপা আছে।")


# ---- guards ------------------------------------------------------------------

stmts = [r["statement"] for r in rows]
assert len(stmts) == len(set(stmts)), "duplicate statement inside batch"
batch1 = json.load(open("data/bcs-book-bank/_rows.json", encoding="utf-8"))
old = {r["statement"].strip() for r in batch1}
clash = [s for s in stmts if s.strip() in old]
assert not clash, f"statement already in batch 01: {clash}"
for r in rows:
    assert all(r[k] for k in ("option_a", "option_b", "option_c", "option_d")), r["statement"]
    assert r["correct"] in "ABCD"
    assert r["book_page"] and r["source_locator"]

json.dump(rows, open("data/bcs-book-bank/_rows02.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# ---- CSV (same 27 columns as batch 01) ----------------------------------------

cols = ["statement", "statement_bn", "option_a", "option_b", "option_c", "option_d",
        "correct", "explanation", "difficulty", "source_type", "source_title", "author",
        "book_chapter", "book_page", "source_file_id", "source_locator", "source_url",
        "exam_name", "exam_year", "subject_id", "subject_bn", "topic_id", "topic_bn",
        "subtopic_id", "subtopic_bn", "official_paper_crosschecked", "provenance_note"]
with open("data/bcs-book-bank/bcs-book-bank-questions-02.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for r in rows:
        w.writerow(r)

verified = sum(1 for r in rows if r["book_options"])
print(f"rows: {len(rows)}, with book options (verified-eligible): {verified}, "
      f"example-converted (draft): {len(rows) - verified}")
print("csv written: bcs-book-bank-questions-02.csv")
for r in rows:
    print(" ", hashlib.sha256(r["statement"].strip().encode()).hexdigest()[:12],
          r["book_page"], r["correct"], r["statement"][:55])
