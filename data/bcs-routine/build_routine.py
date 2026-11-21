#!/usr/bin/env python3
"""
30-day BCS Preli routine CSV — starts 2026-11-22, weekly exam every 7th day
(days 7, 14, 21, 28) and a full model test on day 30.

The file targets the site's routine importer (`src/lib/routines/parse.ts` +
POST /api/admin/routines/import): columns day,date,subject,topic,subtopic,
minutes,slot,note,kind. Subject and topic strings are copied verbatim from the
live syllabus (queried 2026-11-21), because the importer matches by name and
treats an unknown name as an error — which is correct, a routine that points at
a topic the syllabus does not have is not a routine.

Structure per study day: 3 slots (60 + 60 + 45 minutes). Exam days keep the
same 3-slot shape: revision warm-up, the exam itself (kind=weekly), and an
answer-analysis slot — because a weekly exam without a review slot teaches
nothing.
"""

import csv
from datetime import date, timedelta

START = date(2026, 11, 22)

# ---- exact syllabus names (subject, topic), copied from the live DB ----------
BAN = "বাংলা ভাষা ও সাহিত্য"
ENG = "English Language & Literature"
MATH = "গাণিতিক যুক্তি"
BD = "বাংলাদেশ বিষয়াবলি"
INTL = "আন্তর্জাতিক বিষয়াবলি"
GEO = "ভূগোল, পরিবেশ ও দুর্যোগ"
SCI = "সাধারণ বিজ্ঞান"
ICT = "কম্পিউটার ও তথ্যপ্রযুক্তি"
MENT = "মানসিক দক্ষতা"
ETH = "নৈতিকতা, মূল্যবোধ ও সুশাসন"

# day -> list of (subject, topic, minutes, slot, note, kind)
plan: dict[int, list[tuple]] = {}

def study(day, *slots):
    plan[day] = [(s, t, m, i + 1, n, "daily") for i, (s, t, m, n) in enumerate(slots)]

def exam_day(day, warm, exam_subject, exam_no, syllabus_note, analysis):
    ws, wt, wn = warm
    as_, at_, an_ = analysis
    plan[day] = [
        (ws, wt, 45, 1, wn, "daily"),
        (exam_subject, "", 60, 2,
         f"সাপ্তাহিক পরীক্ষা-{exam_no} — {syllabus_note} (মিশ্র সিলেবাস, ৬০ নম্বর MCQ)", "weekly"),
        (as_, at_, 45, 3, an_, "daily"),
    ]

# ---- সপ্তাহ ১ : বাংলা ব্যাকরণ + পাটিগণিত + English grammar --------------------
study(1, (BAN, "ধ্বনি ও বর্ণ", 60, "মৌলিক ধারণা + বিগত প্রশ্ন"),
         (MATH, "বাস্তব সংখ্যা", 60, "সংখ্যার শ্রেণি, ২০টি অঙ্ক"),
         (ENG, "Parts of speech", 45, "চিহ্নিতকরণ অনুশীলন"))
study(2, (BAN, "পদ ও পদপ্রকরণ", 60, ""),
         (MATH, "গসাগু ও লসাগু", 60, "Khairul Advanced Math পৃ. ১–৪-এর অঙ্কগুলো"),
         (ENG, "Articles and determiners", 45, ""))
study(3, (BAN, "সন্ধি", 60, "নিয়ম + ব্যতিক্রম তালিকা"),
         (MATH, "শতকরা", 60, "ধারাবাহিক শতাংশ পরিবর্তনের সূত্র"),
         (ENG, "Tense and aspect", 45, "নোটের high-yield নিয়মগুলো"))
study(4, (BAN, "সমাস", 60, ""),
         (MATH, "লাভ-ক্ষতি", 60, "লিখিত মূল্য + ছাড়ের অঙ্ক"),
         (ENG, "Subject-verb agreement", 45, ""))
study(5, (BAN, "কারক ও বিভক্তি", 60, ""),
         (MATH, "অনুপাত", 60, ""),
         (ENG, "Prepositions", 45, "২০টি common preposition মুখস্থ"))
study(6, (BAN, "প্রত্যয়", 60, "উপসর্গের সাথে পার্থক্য"),
         (MATH, "সরল ও চক্রবৃদ্ধি সুদ", 60, ""),
         (ENG, "Voice", 45, ""))
exam_day(7, (BAN, "বাক্য", "পরীক্ষার আগে দ্রুত রিভিশন"),
         MATH, "১", "১ম সপ্তাহ: বাংলা ব্যাকরণ + পাটিগণিত + English grammar",
         (MATH, "সেট", "উত্তর বিশ্লেষণ + ভুলের খাতা হালনাগাদ"))

# ---- সপ্তাহ ২ : বাংলা সাহিত্য + English (বাকি) + বাংলাদেশ ----------------------
study(8, (BAN, "প্রাচীন যুগ ও চর্যাপদ", 60, ""),
         (ENG, "Narration", 60, ""),
         (BD, "ভাষা আন্দোলন", 45, "সাল-তারিখ ছকে লিখুন"))
study(9, (BAN, "মধ্যযুগের সাহিত্য", 60, ""),
         (ENG, "Clauses and phrases", 60, ""),
         (BD, "মুক্তিযুদ্ধ", 45, "সেক্টর, খেতাব, দলিল"))
study(10, (BAN, "আধুনিক যুগ", 60, ""),
          (ENG, "Sentence correction", 60, ""),
          (BD, "সংবিধান", 45, "সংশোধনী তালিকা"))
study(11, (BAN, "কবি ও সাহিত্যিক", 60, "রবীন্দ্র-নজরুল-মধুসূদন অগ্রাধিকার"),
          (ENG, "Vocabulary, idioms and spelling", 60, ""),
          (BD, "রাজনৈতিক ও সরকার ব্যবস্থা", 45, ""))
study(12, (BAN, "বিখ্যাত গ্রন্থ ও চরিত্র", 60, ""),
          (ENG, "Literary periods", 60, ""),
          (BD, "প্রাচীন ও মধ্যযুগের ইতিহাস", 45, ""))
study(13, (BAN, "বাগধারা", 60, "৫০টি বাগধারা"),
          (ENG, "Major authors and works", 60, "Shakespeare-Romantic যুগ অগ্রাধিকার"),
          (BD, "অর্থনীতি ও বাজেট", 45, "সর্বশেষ বাজেটের মূল সংখ্যা"))
exam_day(14, (BAN, "শুদ্ধ বানান ও প্রয়োগ", "পরীক্ষার আগে দ্রুত রিভিশন"),
         BAN, "২", "২য় সপ্তাহ: বাংলা সাহিত্য + English + বাংলাদেশ",
         (ENG, "Literary terms", "উত্তর বিশ্লেষণ + নতুন টার্ম নোট"))

# ---- সপ্তাহ ৩ : গণিত (বীজগণিত-জ্যামিতি) + বিজ্ঞান + আন্তর্জাতিক ------------------
study(15, (MATH, "সমীকরণ", 60, ""),
          (SCI, "ভৌত রাশি ও একক", 60, ""),
          (INTL, "জাতিসংঘ", 45, "অঙ্গসংস্থা + মহাসচিব তালিকা"))
study(16, (MATH, "সূচক ও লগারিদম", 60, ""),
          (SCI, "আলো ও শব্দ", 60, ""),
          (INTL, "আন্তর্জাতিক চুক্তি", 45, ""))
study(17, (MATH, "রেখা ও কোণ", 60, ""),
          (SCI, "গতি ও বল", 60, ""),
          (INTL, "আঞ্চলিক ও অর্থনৈতিক সংস্থা", 45, "SAARC, ASEAN, EU, OPEC"))
study(18, (MATH, "ত্রিভুজ", 60, ""),
          (SCI, "বিদ্যুৎ ও চুম্বক", 60, ""),
          (INTL, "বিশ্ব ইতিহাস", 45, ""))
study(19, (MATH, "বৃত্ত", 60, ""),
          (SCI, "কোষ", 60, ""),
          (INTL, "ভূরাজনীতি", 45, ""))
study(20, (MATH, "পরিমিতি", 60, "ক্ষেত্রফল-আয়তনের সূত্র তালিকা"),
          (SCI, "রোগ ও স্বাস্থ্য", 60, "ভিটামিন-অভাবজনিত রোগ"),
          (MENT, "সংখ্যা ধারা", 45, ""))
exam_day(21, (MATH, "ধারা", "পরীক্ষার আগে দ্রুত রিভিশন"),
         SCI, "৩", "৩য় সপ্তাহ: গণিত + বিজ্ঞান + আন্তর্জাতিক",
         (MENT, "সাদৃশ্য", "উত্তর বিশ্লেষণ + analogy অনুশীলন"))

# ---- সপ্তাহ ৪ : কম্পিউটার + ভূগোল + নৈতিকতা + মানসিক দক্ষতা --------------------
study(22, (ICT, "হার্ডওয়্যার", 60, ""),
          (GEO, "বাংলাদেশের অবস্থান ও ভূপ্রকৃতি", 60, ""),
          (ETH, "নৈতিকতার ধারণা", 45, ""))
study(23, (ICT, "সংখ্যা পদ্ধতি", 60, "বাইনারি-দশমিক রূপান্তর"),
          (GEO, "জলবায়ু পরিবর্তন", 60, "COP সম্মেলন তালিকা"),
          (ETH, "মূল্যবোধ", 45, ""))
study(24, (ICT, "নেটওয়ার্ক", 60, ""),
          (GEO, "দুর্যোগ ঝুঁকি", 60, ""),
          (ETH, "সুশাসন ও উন্নয়ন", 45, ""))
study(25, (ICT, "ইন্টারনেট ও ওয়েব", 60, ""),
          (GEO, "দূষণ", 60, ""),
          (ETH, "স্বচ্ছতা", 45, ""))
study(26, (ICT, "সাইবার নিরাপত্তা", 60, ""),
          (GEO, "প্রাকৃতিক সম্পদ", 60, ""),
          (MENT, "সম্পর্ক ও দিক", 45, ""))
study(27, (ICT, "ডেটা ও মেমোরি", 60, ""),
          (GEO, "বিশ্ব ভূগোল", 60, ""),
          (MENT, "সমস্যা সমাধান", 45, ""))
exam_day(28, (ICT, "সফটওয়্যার", "পরীক্ষার আগে দ্রুত রিভিশন"),
         ICT, "৪", "৪র্থ সপ্তাহ: কম্পিউটার + ভূগোল + নৈতিকতা",
         (MENT, "যান্ত্রিক যুক্তি", "উত্তর বিশ্লেষণ"))

# ---- দিন ২৯–৩০ : পূর্ণ রিভিশন + ফাইনাল মডেল টেস্ট -----------------------------
study(29, (BAN, "সমার্থক ও বিপরীত শব্দ", 60, "দুর্বল টপিকের দ্রুত রিভিশন"),
          (ENG, "Poetry, drama and fiction", 60, "দুর্বল টপিকের দ্রুত রিভিশন"),
          (MATH, "বিন্যাস ও সমাবেশ", 45, "ভুলের খাতার অঙ্কগুলো আবার"))
plan[30] = [
    (MENT, "ভাষাগত যুক্তি", 45, 1, "ওয়ার্ম-আপ", "daily"),
    (MENT, "", 120, 2,
     "ফাইনাল মডেল টেস্ট — পুরো ৩০ দিনের সিলেবাস, ১০০ নম্বর, BCS প্রিলি প্যাটার্ন", "weekly"),
    (BD, "জাতীয় প্রতিষ্ঠান ও অর্জন", 45, 3, "মডেল টেস্টের উত্তর বিশ্লেষণ + শেষ রিভিশন", "daily"),
]

# ---- emit --------------------------------------------------------------------
rows = []
for day in sorted(plan):
    d = (START + timedelta(days=day - 1)).isoformat()
    for item in plan[day]:
        if len(item) == 6:
            subject, topic, minutes, slot, note, kind = item
        else:
            raise ValueError(item)
        rows.append({"day": day, "date": d, "subject": subject, "topic": topic,
                     "subtopic": "", "minutes": minutes, "slot": slot,
                     "note": note, "kind": kind})

assert len({r["day"] for r in rows}) == 30, "every one of the 30 days must appear"
weekly = [r for r in rows if r["kind"] == "weekly"]
assert [r["day"] for r in weekly] == [7, 14, 21, 28, 30], weekly

with open("data/bcs-routine/bcs-routine-30day.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["day", "date", "subject", "topic", "subtopic",
                                      "minutes", "slot", "note", "kind"])
    w.writeheader()
    w.writerows(rows)

print(f"rows: {len(rows)} (study {len(rows) - len(weekly)}, exams {len(weekly)})")
print("dates:", rows[0]["date"], "→", rows[-1]["date"])
