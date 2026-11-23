# -*- coding: utf-8 -*-
"""
JobHub — ৬০ দিনের BCS স্টাডি রুটিন জেনারেটর (দিনভিত্তিক, ফেজ-ভিত্তিক)।

ফেজ:
  দিন ১–১৫   : ভিত্তি + হাই-প্রায়োরিটি টপিক (বিগত বছরের প্রশ্ন-ফ্রিকোয়েন্সি অনুযায়ী)
  দিন ১৬–৩০  : কোর সিলেবাস কভারেজ
  দিন ৩১–৪৫  : অ্যাডভান্সড প্র্যাকটিস + রিভিশন + দুর্বলতা মেরামত
  দিন ৪৬–৫৫  : ফুল-লেংথ মক + ইনটেনসিভ রিভিশন
  দিন ৫৬–৬০  : ফাইনাল রিভিশন + পরীক্ষা সিমুলেশন

প্রতিদিন: ২টি স্টাডি/প্র্যাকটিস স্লট (বিষয় + নির্দিষ্ট টপিক + MCQ টার্গেট)
         + ১টি রিভিশন স্লট (আগের দিনের টপিক + ভুল প্রশ্ন)।
শুক্রবার: সাপ্তাহিক মক (১০০ MCQ) + পারফরম্যান্স বিশ্লেষণ + দুর্বল টপিক সেশন।

আউটপুট: bcs-routine-60day.sql (idempotent — ON CONFLICT DO UPDATE)
"""
from datetime import date, timedelta

COURSE = "599509ae-c4c3-440a-9463-802a4efc7a0c"  # বিসিএস প্রস্তুতি
CREATED_BY = "b0d40cca-e34b-42fe-bc19-dae3627b7a48"
START = date(2026, 11, 23)  # দিন ১

SUBJ = {
    "bangla": "df641c1a-8c23-4650-9071-84b2e78b9db0",
    "english": "c71982a7-58d6-4632-9ca5-6922fdfb9485",
    "bd": "35fc02d8-4fe4-433c-8d22-72a539618f1f",
    "intl": "be454138-3852-4af8-921f-081fdeaf5322",
    "geo": "2b2235ac-ed39-4e83-a1ff-7c030fbb37d1",
    "sci": "3c11a812-5286-41fb-862a-509c2e910b02",
    "ict": "3cdd0317-b895-44f8-89e9-2d11358badc8",
    "math": "0688ee2a-cca7-47b2-bf85-6249887a9d5a",
    "mental": "8ce518d7-b0be-432b-bea2-90318d9985ad",
    "ethics": "1350e8fc-3097-4503-8aa3-0b437b5c3ce1",
}

NAME = {
    "bangla": "বাংলা", "english": "ইংরেজি", "bd": "বাংলাদেশ বিষয়াবলি",
    "intl": "আন্তর্জাতিক বিষয়াবলি", "geo": "ভূগোল ও পরিবেশ", "sci": "সাধারণ বিজ্ঞান",
    "ict": "কম্পিউটার ও তথ্যপ্রযুক্তি", "math": "গাণিতিক যুক্তি", "mental": "মানসিক দক্ষতা",
    "ethics": "নৈতিকতা ও সুশাসন",
}

# বিগত বিসিএস (৪০তম–৪৬তম) প্রশ্ন-ফ্রিকোয়েন্সি অনুযায়ী অগ্রাধিকারক্রমে সাজানো টপিক
TOPICS = {
    "bangla": [
        "বাংলা সাহিত্য: প্রাচীন ও মধ্যযুগ (চর্যাপদ, বৈষ্ণব পদাবলি, মঙ্গলকাব্য)",
        "রবীন্দ্রনাথ ঠাকুর ও কাজী নজরুল ইসলাম — জীবন ও সাহিত্যকর্ম",
        "ব্যাকরণ: ধ্বনি, বর্ণ ও ধ্বনি পরিবর্তন",
        "সন্ধি ও সমাস — নিয়ম ও ব্যতিক্রম",
        "আধুনিক যুগ: বঙ্কিম, মধুসূদন, শরৎচন্দ্র ও তাঁদের রচনা",
        "শব্দ প্রকরণ, পদ প্রকরণ ও কারক-বিভক্তি",
        "বানান শুদ্ধি ও বাক্য শুদ্ধি (প্রমিত বানান রীতি)",
        "মুক্তিযুদ্ধ ও ভাষা আন্দোলনভিত্তিক সাহিত্য",
        "সমার্থক-বিপরীত শব্দ, বাগধারা ও প্রবাদ-প্রবচন",
        "পত্রিকা, সাময়িকী ও প্রকাশনা সাল",
        "জীবনানন্দ দাশ, ফররুখ আহমদ ও চল্লিশোত্তর কবিতা",
        "উপন্যাস ও নাটক: প্রধান চরিত্র ও রচয়িতা",
        "প্রত্যয়, উপসর্গ ও অনুসর্গ",
        "বাক্য প্রকরণ ও যতিচিহ্নের ব্যবহার",
    ],
    "english": [
        "Parts of Speech & Determiners — high-frequency rules",
        "Tense, Right form of verbs & Subject-Verb Agreement",
        "Preposition (appropriate preposition, phrasal verbs)",
        "Phrases & Idioms — BCS repeated list",
        "Voice, Narration & Transformation",
        "Synonyms & Antonyms (previous BCS words)",
        "English Literature: Shakespeare ও তাঁর প্রধান নাটক",
        "Romantic & Victorian poets (Wordsworth, Keats, Tennyson)",
        "Clauses, Conditionals & Subjunctive",
        "Spelling, One-word substitution & Correction",
        "Literary terms, periods ও famous quotations",
        "Modern & American literature — প্রধান লেখক ও রচনা",
        "Gerund, Participle & Infinitive",
        "Analogy ও Sentence completion",
    ],
    "bd": [
        "ভাষা আন্দোলন ও ৫২-পরবর্তী রাজনৈতিক ঘটনাপ্রবাহ",
        "মুক্তিযুদ্ধ ১৯৭১: পটভূমি, সেক্টর, বীরত্বসূচক খেতাব",
        "সংবিধান: মূলনীতি, মৌলিক অধিকার, গুরুত্বপূর্ণ অনুচ্ছেদ",
        "সংবিধানের সংশোধনীসমূহ ও সাংবিধানিক পদাধিকারী",
        "প্রাচীন বাংলা: জনপদ, শাসন আমল (পাল, সেন, সুলতানি, মুঘল)",
        "ব্রিটিশ আমল: বঙ্গভঙ্গ, দেশভাগ ও সংস্কার আন্দোলন",
        "বাংলাদেশের অর্থনীতি: বাজেট, পঞ্চবার্ষিক পরিকল্পনা, রপ্তানি",
        "কৃষি, শিল্প ও বৈদেশিক কর্মসংস্থান",
        "সরকার কাঠামো, প্রশাসন ও স্থানীয় সরকার",
        "জনসংখ্যা, জনশুমারি ও ক্ষুদ্র নৃগোষ্ঠী",
        "বাংলাদেশের নদ-নদী, হাওর-বাঁওড় ও সমুদ্রসীমা",
        "জাতীয় পুরস্কার, স্থাপত্য, সংস্কৃতি ও ক্রীড়া অর্জন",
        "মেগা প্রকল্প ও সাম্প্রতিক জাতীয় অর্জন",
        "বাংলাদেশের পররাষ্ট্রনীতি ও আন্তর্জাতিক চুক্তি",
    ],
    "intl": [
        "জাতিসংঘ: অঙ্গসংস্থা, মহাসচিব, শান্তিরক্ষা মিশন",
        "আন্তর্জাতিক সংস্থা: WB, IMF, WTO, ADB, OIC, ASEAN, SAARC",
        "ভূ-রাজনীতি: গুরুত্বপূর্ণ চুক্তি ও সনদ",
        "বিশ্ব ইতিহাস: দুই বিশ্বযুদ্ধ ও স্নায়ুযুদ্ধ",
        "পরিবেশ কূটনীতি: COP সম্মেলন, প্যারিস চুক্তি, কিয়োটো প্রোটোকল",
        "মুদ্রা, রাজধানী, পার্লামেন্ট ও সীমারেখা",
        "প্রণালী, দ্বীপ, খাল ও ভৌগোলিক উপনাম",
        "সাম্প্রতিক বিশ্ব: নির্বাচন, সংঘাত, শীর্ষ সম্মেলন",
        "আঞ্চলিক জোট ও নিরাপত্তা সংস্থা (NATO, QUAD, BRICS)",
        "নোবেল পুরস্কার ও আন্তর্জাতিক দিবস",
    ],
    "geo": [
        "বাংলাদেশের ভৌগোলিক অবস্থান, সীমানা ও ভূপ্রকৃতি",
        "জলবায়ু, মৌসুমি বায়ু ও বৃষ্টিপাত",
        "দুর্যোগ ব্যবস্থাপনা: ঘূর্ণিঝড়, বন্যা, ভূমিকম্প",
        "পরিবেশ দূষণ ও জলবায়ু পরিবর্তনের প্রভাব",
        "বিশ্ব ভূগোল: মহাদেশ, মহাসাগর, পর্বত ও মরুভূমি",
        "প্রাকৃতিক সম্পদ ও জ্বালানি",
    ],
    "sci": [
        "ভৌত বিজ্ঞান: আলো, শব্দ, তাপ ও তড়িৎ",
        "জীববিজ্ঞান: কোষ, টিস্যু, রক্ত ও সংবহনতন্ত্র",
        "খাদ্য, পুষ্টি ও ভিটামিন",
        "রোগ, জীবাণু, টিকা ও জনস্বাস্থ্য",
        "রসায়ন: এসিড-ক্ষার-লবণ, ধাতু-অধাতু",
        "শক্তির উৎস ও নবায়নযোগ্য শক্তি",
        "মহাকাশ, জ্যোতির্বিজ্ঞান ও উপগ্রহ",
        "দৈনন্দিন জীবনে বিজ্ঞান ও প্রযুক্তি",
    ],
    "ict": [
        "কম্পিউটারের ইতিহাস, প্রজন্ম ও সংগঠন",
        "সংখ্যা পদ্ধতি ও লজিক গেট",
        "হার্ডওয়্যার, সফটওয়্যার ও অপারেটিং সিস্টেম",
        "কম্পিউটার নেটওয়ার্ক ও ইন্টারনেট প্রোটোকল",
        "ই-মেইল, ক্লাউড কম্পিউটিং ও সোশ্যাল মিডিয়া",
        "ডেটাবেজ ও তথ্য ব্যবস্থাপনা",
        "সাইবার নিরাপত্তা ও ডিজিটাল অপরাধ",
        "AI, IoT, রোবটিক্স ও নতুন প্রযুক্তি",
        "মোবাইল প্রযুক্তি ও টেলিযোগাযোগ (4G/5G)",
    ],
    "math": [
        "বাস্তব সংখ্যা, ল.সা.গু ও গ.সা.গু",
        "শতকরা, লাভ-ক্ষতি ও সরল-চক্রবৃদ্ধি সুদ",
        "অনুপাত, সমানুপাত ও মিশ্রণ",
        "বীজগাণিতিক সূত্র ও উৎপাদক",
        "সমীকরণ, অসমতা ও সরল সহসমীকরণ",
        "সূচক ও লগারিদম",
        "অনুক্রম ও ধারা",
        "জ্যামিতি: রেখা, কোণ, ত্রিভুজ ও বৃত্ত",
        "পরিমিতি: ক্ষেত্রফল ও আয়তন",
        "সেট, ভেনচিত্র ও ফাংশন",
        "বিন্যাস, সমাবেশ ও সম্ভাব্যতা",
    ],
    "mental": [
        "সংখ্যা ও বর্ণ সিরিজ, প্যাটার্ন",
        "কোডিং-ডিকোডিং ও সাদৃশ্য (Analogy)",
        "দিক নির্ণয়, দূরত্ব ও রক্তের সম্পর্ক",
        "আয়না ও পানির প্রতিবিম্ব, ঘড়ি-ক্যালেন্ডার",
        "ভাষাগত ও যান্ত্রিক যুক্তি",
        "স্থানাঙ্ক সম্পর্ক ও চিত্রভিত্তিক সমস্যা",
    ],
    "ethics": [
        "মূল্যবোধ ও নৈতিকতার ধারণা, দার্শনিক ভিত্তি",
        "সুশাসন: উপাদান, সূচক ও প্রতিবন্ধকতা",
        "সাংবিধানিক প্রতিষ্ঠান ও জবাবদিহিতা",
        "দুর্নীতি দমন ও নাগরিক অধিকার-কর্তব্য",
        "আন্তর্জাতিক সনদ ও মানবাধিকার",
    ],
}

# শনিবার(5)=সাপ্তাহিক শুরু ... শুক্রবার(4)=মক। Python: Mon=0 ... Sun=6
# সাপ্তাহিক টেমপ্লেট (weekday -> দুটি স্টাডি বিষয়); শুক্রবার (4) = মক
WEEK_TEMPLATE = {
    5: ("bangla", "english"),   # শনি
    6: ("bd", "math"),          # রবি
    0: ("english", "sci"),      # সোম
    1: ("bangla", "intl"),      # মঙ্গল
    2: ("math", "ict"),         # বুধ
    3: ("bd", "geo"),           # বৃহস্পতি (বিকল্প সপ্তাহে ethics/mental)
}
ALT_THU = [("bd", "ethics"), ("bd", "mental"), ("intl", "geo"), ("bd", "ethics")]

PHASES = [
    (1, 15, "ফেজ ১ · ভিত্তি ও হাই-প্রায়োরিটি", 30),
    (16, 30, "ফেজ ২ · কোর সিলেবাস", 35),
    (31, 45, "ফেজ ৩ · অ্যাডভান্সড প্র্যাকটিস ও দুর্বলতা", 40),
    (46, 55, "ফেজ ৪ · ফুল মক ও ইনটেনসিভ রিভিশন", 50),
    (56, 60, "ফেজ ৫ · ফাইনাল রিভিশন ও সিমুলেশন", 60),
]

BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

def bn(n):
    return str(n).translate(BN_DIGITS)

def phase_of(day):
    for lo, hi, label, target in PHASES:
        if lo <= day <= hi:
            return label, target
    raise ValueError(day)

pointers = {k: 0 for k in TOPICS}

def next_topic(subj, revisit=False):
    lst = TOPICS[subj]
    i = pointers[subj]
    pointers[subj] = i + 1
    topic = lst[i % len(lst)]
    if i >= len(lst) or revisit:
        return f"গভীর রিভিশন: {topic}"
    return topic

def esc(s):
    return s.replace("'", "''")

rows = []  # (kind, date, subject_uuid|None, slot, minutes, task, title, focus, target, week_index)

def add(kind, d, subj_key, slot, minutes, task, title, focus, target, week_index):
    rows.append((kind, d, SUBJ[subj_key] if subj_key else None, slot, minutes, task, title, focus, target, week_index))

prev_day_topics = []

for day in range(1, 61):
    d = START + timedelta(days=day - 1)
    wd = d.weekday()
    label, target = phase_of(day)
    week_index = (day - 1) // 7 + 1
    title = f"দিন {bn(day)} · {label}"
    today_topics = []

    is_friday = wd == 4
    final_phase = day >= 56
    mock_phase = 46 <= day <= 55
    mock_day = (mock_phase and day % 2 == 1) or day == 58  # ৪৭,৪৯,৫১,৫৩,৫৫ + ৫৮ সিমুলেশন

    if final_phase:
        # ফেজ ৫: ফাইনাল রিভিশন ও সিমুলেশন
        if day == 56:
            plan = [("bangla", "মেগা রিভিশন: সাহিত্য + ব্যাকরণ হাই-ফ্রিকোয়েন্সি প্রশ্ন"),
                    ("english", "মেগা রিভিশন: Grammar rules + Literature quick notes")]
        elif day == 57:
            plan = [("bd", "মেগা রিভিশন: সংবিধান, মুক্তিযুদ্ধ, অর্থনীতি"),
                    ("intl", "মেগা রিভিশন: সংস্থা, চুক্তি, সাম্প্রতিক বিশ্ব")]
        elif day == 58:
            plan = []  # ফাইনাল সিমুলেশন মক
        elif day == 59:
            plan = [("math", "ফর্মুলা শিট + সবচেয়ে বেশি ভুল হওয়া অঙ্কগুলো আবার"),
                    ("sci", "বিজ্ঞান + ICT ঝটপট রিভিশন (ভুল খাতার প্রশ্ন)")]
        else:  # day 60
            plan = [("ethics", "হালকা রিভিশন: নৈতিকতা, ভূগোল, মানসিক দক্ষতা শর্ট নোট")]

        if day == 58:
            add("weekly_special", d, None, "সকাল ৯:০০–১১:০০", 150, "exam", title,
                "ফাইনাল সিমুলেশন: বাস্তব পরীক্ষার নিয়মে ২০০ নম্বরের ফুল-লেংথ মডেল টেস্ট।",
                "২০০ MCQ · ১২০ মিনিট · নেগেটিভ মার্কিংসহ", week_index)
            add("daily", d, None, "বিকাল ৪:০০–৬:০০", 120, "revision", title,
                "সিমুলেশনের ভুল বিশ্লেষণ — প্রতিটি ভুলের কারণ লিখে দুর্বল টপিক চিহ্নিত করুন।",
                "ভুল প্রশ্নের ১০০% রিভিউ", week_index)
        else:
            slots = ["সকাল ৭:০০–৯:৩০", "রাত ৮:০০–১০:০০"]
            for i, (sk, focus) in enumerate(plan):
                add("daily", d, sk, slots[i % 2], 135, "revision", title, focus,
                    f"{bn(target)}টি দ্রুত MCQ + শর্ট নোট", week_index)
            if day == 60:
                add("daily", d, None, "বিকাল ৫:০০–৫:৪৫", 45, "rest", title,
                    "পর্যাপ্ত বিশ্রাম নিন। পরীক্ষার দিনের কৌশল: সহজ প্রশ্ন আগে, অনিশ্চিত হলে স্কিপ, সময় ভাগ করে নিন।",
                    "কৌশল ঝালাই + বিশ্রাম", week_index)
            else:
                add("daily", d, None, "রাত ১০:১৫–১১:০০", 45, "revision", title,
                    "আজকের রিভিশনে আটকে যাওয়া পয়েন্টগুলো ফ্ল্যাশকার্ডে তুলুন।",
                    f"{bn(20)}টি রিভিশন MCQ", week_index)
        continue

    if mock_phase:
        if mock_day:
            add("weekly_special", d, None, "সকাল ৯:০০–১১:০০", 150, "exam", title,
                "ফুল-লেংথ মডেল টেস্ট — বাস্তব পরীক্ষার পরিবেশে, নেগেটিভ মার্কিংসহ।",
                "২০০ MCQ · ১২০ মিনিট", week_index)
            add("daily", d, None, "বিকাল ৪:০০–৬:০০", 120, "revision", title,
                "মকের পূর্ণাঙ্গ বিশ্লেষণ: ভুল ও অনুত্তরিত প্রশ্ন ধরে ধরে কারণ বের করুন; দুর্বল টপিক তালিকায় যোগ করুন।",
                "ভুল প্রশ্নের ১০০% রিভিউ + দুর্বল টপিক তালিকা হালনাগাদ", week_index)
        else:
            pair = WEEK_TEMPLATE.get(wd) or ("bangla", "bd")
            slots = ["সকাল ৭:০০–৯:০০", "রাত ৮:০০–১০:০০"]
            for i, sk in enumerate(pair):
                add("daily", d, sk, slots[i], 120, "revision", title,
                    f"{NAME[sk]} — আগের মকগুলোতে ভুল হওয়া টপিকগুলোর ইনটেনসিভ রিভিশন।",
                    f"{bn(target)}টি MCQ (দুর্বল টপিক থেকে)", week_index)
            add("daily", d, None, "বিকাল ৫:০০–৬:০০", 60, "practice", title,
                "দুর্বল টপিক সেশন: নিজের দুর্বল-টপিক তালিকা থেকে টাইমড প্র্যাকটিস।",
                f"{bn(30)}টি টাইমড MCQ", week_index)
        continue

    # ফেজ ১–৩ (দিন ১–৪৫)
    if is_friday:
        add("weekly_special", d, None, "সকাল ৯:৩০–১১:১০", 120, "exam", title,
            "সাপ্তাহিক মক: এ সপ্তাহে পড়া সব টপিক থেকে, বাস্তব নিয়মে (+১/−০.৫)।",
            "১০০ MCQ · ৬০ মিনিট", week_index)
        add("daily", d, None, "বিকাল ৪:০০–৫:৩০", 90, "revision", title,
            "সাপ্তাহিক পারফরম্যান্স বিশ্লেষণ: বিষয়ভিত্তিক accuracy দেখুন, দুর্বল টপিক তালিকা হালনাগাদ করুন এবং সবচেয়ে দুর্বল ২টি টপিক আবার পড়ুন।",
            "বিশ্লেষণ + দুর্বল ২ টপিকে " + bn(20) + "টি MCQ", week_index)
        prev_day_topics = ["সাপ্তাহিক মকের ভুল প্রশ্ন"]
        continue

    if wd == 3:
        pair = ALT_THU[(week_index - 1) % len(ALT_THU)]
    else:
        pair = WEEK_TEMPLATE[wd]

    revisit = day > 30  # ফেজ ৩: টপিক আবার আসে গভীর রিভিশন হিসেবে
    slots = ["সকাল ৭:০০–৯:০০", "রাত ৮:০০–১০:০০"]
    task = "study" if day <= 30 else "practice"
    for i, sk in enumerate(pair):
        topic = next_topic(sk, revisit=revisit)
        today_topics.append(f"{NAME[sk]}: {topic}")
        add("daily", d, sk, slots[i], 120, task, title,
            f"{NAME[sk]} — {topic}",
            f"{bn(target)}টি MCQ (টপিকভিত্তিক, টাইমারসহ)", week_index)

    rev_focus = ("আগের দিনের টপিক রিভিশন: " + "; ".join(prev_day_topics)) if prev_day_topics \
        else "নতুন পড়ার আগে নিজের নোট ঝালিয়ে নিন।"
    add("daily", d, None, "রাত ১০:১৫–১১:০০", 45, "revision", title,
        rev_focus + " ভুল করা প্রশ্নগুলো আবার সমাধান করুন।",
        f"{bn(20)}টি রিভিশন MCQ", week_index)
    prev_day_topics = today_topics

# ---- SQL ----
out = []
out.append("-- JobHub — নতুন ৬০ দিনের BCS স্টাডি রুটিন (দিন ১ = 2026-11-23)")
out.append("-- পুরোনো সক্রিয় রুটিন: রেফারেন্সবিহীন রো মুছে, রেফারেন্সড রো আর্কাইভ করা হয়।")
out.append("begin;")
out.append("""
delete from public.routines r
where r.archived_at is null
  and not exists (select 1 from public.exam_schedules es where es.routine_id = r.id)
  and not exists (select 1 from public.routine_progress rp where rp.routine_id = r.id);

update public.routines r
set archived_at = now(), status = 'archived'
where r.archived_at is null;
""")

vals = []
for kind, d, subj, slot, minutes, task, title, focus, target, week_index in rows:
    subj_sql = f"'{subj}'::uuid" if subj else "null"
    day_no = (d - START).days + 1
    title_en = f"Day {day_no} - 60-day BCS plan"
    vals.append(
        "  ('%s'::uuid, '%s', '%s', '%s', %s, null, null, %d, '%s', '%s', '%s', '%s', '%s', %d, 'published', '%s'::uuid)"
        % (COURSE, kind, d.isoformat(), title_en, subj_sql, minutes, esc(title), esc(focus),
           esc(slot), esc(target), esc(task), week_index, CREATED_BY)
    )

# ইনসার্ট ভাগ করা হয় যেন এক স্টেটমেন্ট বেশি বড় না হয়
CHUNK = 40
for i in range(0, len(vals), CHUNK):
    chunk = vals[i:i + CHUNK]
    out.append(
        "insert into public.routines (course_id, kind, routine_date, title_en, subject_id, topic_id, subtopic_id, minutes, title_bn, focus_note_bn, slot_label, target_bn, task_kind, week_index, status, created_by)\nvalues\n"
        + ",\n".join(chunk)
        + "\non conflict (course_id, kind, routine_date, subject_id, topic_id) do update set\n"
        + "  title_bn = excluded.title_bn, focus_note_bn = excluded.focus_note_bn,\n"
        + "  slot_label = excluded.slot_label, target_bn = excluded.target_bn,\n"
        + "  task_kind = excluded.task_kind, minutes = excluded.minutes,\n"
        + "  week_index = excluded.week_index, status = 'published', archived_at = null,\n"
        + "  updated_at = now();"
    )

out.append("commit;")

with open("data/bcs-routine/bcs-routine-60day.sql", "w", encoding="utf-8") as f:
    f.write("\n\n".join(out) + "\n")

print(f"rows: {len(rows)}  chunks: {(len(vals) + CHUNK - 1)//CHUNK}")
print("dates:", rows[0][1], "→", rows[-1][1])
