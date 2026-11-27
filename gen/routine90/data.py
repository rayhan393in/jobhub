# -*- coding: utf-8 -*-
"""JobHub — ৯০ দিনের BCS Preliminary রুটিন (V3): source of truth.

দিন ১ = ২৮ নভেম্বর ২০২৬ (শনিবার), দিন ৯০ = ২৫ ফেব্রুয়ারি ২০২৭।

প্রতিটি দিনে চারটি স্লট, সময় অপরিবর্তিত:
    🔴 P1 Main      ২ ঘণ্টা ৩০ মিনিট  (150 min)  band = p1
    🟠 P2 Second    ১ ঘণ্টা ১৫ মিনিট  (75 min)   band = p2
    🟢 P3/P4 Third  ৪৫ মিনিট          (45 min)   band = p3
    📝 MCQ + ভুল বিশ্লেষণ ৫০ মিনিট   (50 min)   band = mcq

MAIN (p1) স্লটের দিনভিত্তিক বিষয়-ক্রম আলাদা করে লেখা হয় না — `subjectForDay()`
থেকে আসে, ঠিক যেমনটা স্পেসিফিকেশনের টেবিলে আছে (দিন ১–২৫ বাংলা,
২৬–৫৩ English, ৫৬–৬০ Bangladesh, ৬১–৬৪ International, ৬৫–৬৯ Geography,
৭০–৭৪ Science, ৭৫–৭৯ ICT, ৮০–৮৬ Math, ৮৭–৮৯ Mental, ৯০ Ethics)।

`P2` ও `P3` কলামের লেখা হুবহু ট্রান্সক্রাইব করা — যেখানে স্পেসিফিকেশনে
"(পুনরালোচনা)" বা Revision লেখা, সেটিও রাখা হয়েছে।
"""

from datetime import date, timedelta

START = date(2026, 11, 28)
DAYS = 90

# রুটিনের সারিতে দেখানো সংক্ষিপ্ত নাম (DB-র subjects.title_bn আলাদা, লম্বা)।
SUBJECT_LABEL = {
    "bangla": "বাংলা",
    "english": "English",
    "bd": "বাংলাদেশ বিষয়াবলি",
    "international": "আন্তর্জাতিক বিষয়াবলি",
    "geography": "ভূগোল ও পরিবেশ",
    "science": "সাধারণ বিজ্ঞান",
    "ict": "কম্পিউটার ও তথ্যপ্রযুক্তি",
    "math": "গাণিতিক যুক্তি",
    "mental": "মানসিক দক্ষতা",
    "ethics": "নৈতিকতা ও সুশাসন",
    "mixed": "সব বিষয়",
}

# DB-র subjects.slug — রুটিনের সারি এগুলো দিয়েই subject_id রিজলভ করে।
SUBJECT_SLUGS = [k for k in SUBJECT_LABEL if k != "mixed"]


SLOTS = {
    "p1": {"label": "P1 Main · সকাল ৭:০০–৯:৩০", "minutes": 150},
    "p2": {"label": "P2 Second · সকাল ১০:০০–১১:১৫", "minutes": 75},
    "p3": {"label": "P3/P4 Third · বিকাল ৫:০০–৫:৪৫", "minutes": 45},
    "mcq": {"label": "MCQ ও ভুল বিশ্লেষণ · রাত ৮:০০–৮:৫০", "minutes": 50},
}

PHASES = [
    (1, 30, "ফেজ ১ · বাংলা ও English"),
    (31, 60, "ফেজ ২ · English ও বাংলাদেশ"),
    (61, 90, "ফেজ ৩ · বাকি Subject ও সমাপ্তি"),
]


def subject_for_day(day: int) -> str:
    """Which subject owns the P1 (Main) slot on a given day."""
    if day <= 25:
        return "bangla"
    if day <= 53:
        return "english"
    if day <= 60:
        return "bd"
    if day <= 64:
        return "international"
    if day <= 69:
        return "geography"
    if day <= 74:
        return "science"
    if day <= 79:
        return "ict"
    if day <= 86:
        return "math"
    if day <= 89:
        return "mental"
    return "ethics"


def phase_for_day(day: int) -> str:
    for lo, hi, label in PHASES:
        if lo <= day <= hi:
            return label
    raise ValueError(day)


def date_for_day(day: int) -> date:
    return START + timedelta(days=day - 1)


# ── P1 (Main) ──────────────────────────────────────────────────────────────
# (দিন, টপিক, [সাবটপিক])
MAIN = [
    (1, "ধ্বনি ও বর্ণ", ["স্বরধ্বনি", "ব্যঞ্জনধ্বনি", "উচ্চারণ"]),
    (2, "শব্দ ও পদ", ["বিশেষ্য", "বিশেষণ", "সর্বনাম", "ক্রিয়া", "অব্যয়"]),
    (3, "সন্ধি", ["স্বরসন্ধি", "ব্যঞ্জনসন্ধি", "বিসর্গসন্ধি"]),
    (4, "সমাস", ["দ্বন্দ্ব", "দ্বিগু", "কর্মধারয়"]),
    (5, "সমাস", ["তৎপুরুষ", "বহুব্রীহি", "অব্যয়ীভাব"]),
    (6, "কারক ও বিভক্তি", ["কর্তৃ", "কর্ম", "করণ", "সম্প্রদান", "অপাদান", "অধিকরণ"]),
    (7, "উপসর্গ ও প্রত্যয়", ["বাংলা উপসর্গ", "সংস্কৃত উপসর্গ", "কৃৎ প্রত্যয়", "তদ্ধিত প্রত্যয়"]),
    (8, "বাক্যতত্ত্ব", ["সরল", "জটিল", "যৌগিক", "উদ্দেশ্য ও বিধেয়"]),
    (9, "শুদ্ধ বানান ও বাক্য শুদ্ধিকরণ", ["বানান", "বাক্য সংশোধন"]),
    (10, "লিঙ্গ ও বচন", ["লিঙ্গের শ্রেণি", "একবচন", "বহুবচন"]),
    (11, "প্রাচীন সাহিত্য", ["চর্যাপদ", "আবিষ্কার", "কবি", "ভাষা"]),
    (12, "মধ্যযুগ", ["মঙ্গলকাব্য", "মনসামঙ্গল", "চণ্ডীমঙ্গল"]),
    (13, "মধ্যযুগ", ["বৈষ্ণব পদাবলি", "মুসলিম সাহিত্য", "আলাওল"]),
    (14, "যুগবিভাগ", ["প্রাচীন", "মধ্যযুগ", "আধুনিক", "নবজাগরণ"]),
    (15, "রবীন্দ্রনাথ", ["জীবনী", "জন্ম-মৃত্যু", "নোবেল", "পরিচিতি"]),
    (16, "রবীন্দ্রনাথ", ["কাব্যগ্রন্থ", "কবিতা", "উপন্যাস", "নাটক", "ছোটগল্প"]),
    (17, "নজরুল", ["জীবনী", "বিদ্রোহী কবিতা", "কাব্যগ্রন্থ"]),
    (18, "নজরুল", ["গান", "গজল", "নাটক", "সাহিত্যকর্ম"]),
    (19, "মাইকেল মধুসূদন", ["জীবনী", "মেঘনাদবধ", "অমিত্রাক্ষর ছন্দ"]),
    (20, "বঙ্কিমচন্দ্র", ["জীবনী", "উপন্যাস", "আনন্দমঠ", "বন্দেমাতরম"]),
    (21, "শরৎচন্দ্র ও বেগম রোকেয়া", ["জীবনী", "উপন্যাস", "নারী জাগরণ"]),
    (22, "অন্যান্য সাহিত্যিক", ["বিদ্যাসাগর", "দীনবন্ধু", "জসীমউদ্দীন", "জীবনানন্দ"]),
    (23, "উপন্যাস", ["ঔপন্যাসিক", "বিখ্যাত রচনা", "চরিত্র"]),
    (24, "নাটক", ["নাট্যকার", "বিখ্যাত নাটক", "বিষয়বস্তু"]),
    (25, "ছোটগল্প", ["গল্পকার", "বিখ্যাত গল্প", "সাহিত্যিক পরিচিতি"]),
    (26, "Parts of Speech", ["Noun", "Pronoun", "Adjective", "Verb", "Adverb",
                             "Preposition", "Conjunction", "Interjection"]),
    (27, "Tense", ["১২টি tense", "structure", "usage"]),
    (28, "Subject-Verb Agreement", ["subject number", "indefinite pronoun", "exceptions"]),
    (29, "Articles", ["a", "an", "the", "zero article", "special uses"]),
    (30, "Prepositions", ["time", "place", "direction", "phrase preposition"]),
    (31, "Right Form of Verbs", ["tense", "conditional", "subject agreement"]),
    (32, "Voice", ["active-passive", "modal", "imperative"]),
    (33, "Narration", ["assertive", "interrogative", "imperative", "exclamatory"]),
    (34, "Transformation", ["degree", "voice", "sentence type"]),
    (35, "Synonyms & Antonyms", ["common words", "contextual meaning"]),
    (36, "Idioms & Phrases", ["common idioms", "phrasal expressions"]),
    (37, "Spelling", ["commonly confused", "correct spelling"]),
    (38, "Error Correction", ["grammar", "usage", "sentence errors"]),
    (39, "Analogy", ["word relationship", "logical analogy"]),
    (40, "Clauses & Phrases", ["noun clause", "adjective clause", "adverb clause", "phrase types"]),
    (41, "Modifiers", ["misplaced", "dangling", "adjective", "adverb"]),
    (42, "Gerund, Infinitive & Participle", ["forms", "usage", "differences"]),
    (43, "Sentence Completion", ["context", "grammar", "vocabulary"]),
    (44, "Pronoun Reference & Conjunctions", ["reference", "agreement", "connectors"]),
    (45, "Literary Periods", ["Renaissance", "Romantic", "Victorian", "Modern"]),
    (46, "Major Authors", ["Shakespeare", "Milton", "Wordsworth", "Dickens"]),
    (47, "Major Literary Works", ["author", "title", "genre"]),
    (48, "Poetry & Poets", ["poet", "poem", "literary period"]),
    (49, "Drama & Dramatists", ["plays", "playwrights", "characters"]),
    (50, "Novelists & Novels", ["novelist", "novel", "characters"]),
    (51, "Literary Movements", ["Romanticism", "Realism", "Modernism"]),
    (52, "Literary Terms", ["metaphor", "simile", "irony", "sonnet"]),
    (53, "Literary Quotations & Awards", ["famous quotations", "Nobel", "awards"]),
    (54, "English P1 Revision", ["grammar rules", "vocabulary", "error correction"]),
    (55, "English Literature Revision", ["authors", "works", "periods", "movements"]),
    (56, "ভাষা আন্দোলন", ["১৯৫২", "রাষ্ট্রভাষা", "শহিদ", "ঘটনাপ্রবাহ"]),
    (57, "মুক্তিযুদ্ধ", ["পটভূমি", "সেক্টর", "কমান্ডার", "মুজিবনগর সরকার", "অভিযান", "বিজয়"]),
    (58, "বঙ্গবন্ধু ও স্বাধীনতা", ["স্বাধীনতার ঘোষণা", "ঐতিহাসিক ভাষণ"]),
    (59, "সংবিধান ও রাষ্ট্রব্যবস্থা", ["রাষ্ট্রপতি", "প্রধানমন্ত্রী", "সংসদ", "বিচার বিভাগ"]),
    (60, "মুক্তিযুদ্ধের আন্তর্জাতিক প্রেক্ষাপট", ["বিশ্বশক্তি", "স্বীকৃতি", "আন্তর্জাতিক সহায়তা"]),
    (61, "জাতিসংঘ", ["UNGA", "Security Council", "ICJ", "Secretariat"]),
    (62, "আন্তর্জাতিক সংস্থা", ["WHO", "UNESCO", "UNICEF", "ILO", "FAO"]),
    (63, "আঞ্চলিক সংস্থা", ["SAARC", "ASEAN", "EU", "OIC"]),
    (64, "আন্তর্জাতিক চুক্তি", ["Paris Agreement", "জলবায়ু চুক্তি"]),
    (65, "বাংলাদেশের ভূগোল", ["অবস্থান", "সীমানা", "আয়তন", "বিভাগ", "জেলা"]),
    (66, "বাংলাদেশের নদ-নদী", ["প্রধান নদী", "উপনদী", "শাখানদী"]),
    (67, "পরিবেশ দূষণ", ["বায়ু", "পানি", "মাটি", "শব্দ"]),
    (68, "জলবায়ু পরিবর্তন", ["Global Warming", "Greenhouse Effect"]),
    (69, "প্রাকৃতিক দুর্যোগ", ["বন্যা", "ঘূর্ণিঝড়", "জলোচ্ছ্বাস", "ভূমিকম্প"]),
    (70, "মানবদেহ", ["রক্ত", "হৃদপিণ্ড", "শ্বাসতন্ত্র", "পরিপাকতন্ত্র"]),
    (71, "রোগ ও স্বাস্থ্য", ["রোগজীবাণু", "সংক্রামক রোগ", "টিকা", "রোগ প্রতিরোধ"]),
    (72, "ভিটামিন ও পুষ্টি", ["ভিটামিন", "খনিজ", "অভাবজনিত রোগ"]),
    (73, "বিদ্যুৎ ও চুম্বকত্ব", ["কারেন্ট", "ভোল্টেজ", "রোধ", "চৌম্বকত্ব"]),
    (74, "আলো ও শব্দ", ["প্রতিফলন", "প্রতিসরণ", "তরঙ্গ"]),
    (75, "কম্পিউটার মৌলিক ধারণা", ["Hardware", "Software", "CPU", "ALU"]),
    (76, "কম্পিউটার মেমোরি", ["RAM", "ROM", "Cache", "Storage"]),
    (77, "Internet ও Networking", ["LAN", "MAN", "WAN", "IP", "DNS"]),
    (78, "Cyber Security", ["Virus", "Malware", "Phishing", "Encryption"]),
    (79, "Web Technology", ["WWW", "Browser", "Search Engine", "URL"]),
    (80, "শতকরা", ["শতকরা নির্ণয়", "বৃদ্ধি", "হ্রাস"]),
    (81, "অনুপাত ও সমানুপাত", ["অনুপাত", "সমানুপাত"]),
    (82, "লাভ-ক্ষতি ও ছাড়", ["লাভ-ক্ষতি", "ছাড়"]),
    (83, "গড় ও বয়স", ["গড়", "বয়স সংক্রান্ত সমস্যা"]),
    (84, "সময় ও কাজ", ["সময় ও কাজ"]),
    (85, "সময়, দূরত্ব ও গতি", ["সময়, দূরত্ব ও গতি"]),
    (86, "ভগ্নাংশ ও সরলীকরণ", ["ভগ্নাংশ", "সরলীকরণ"]),
    (87, "Number Series", ["সংখ্যা ধারা", "missing number"]),
    (88, "Analogy", ["শব্দ", "সংখ্যা", "সম্পর্ক"]),
    (89, "Classification", ["odd one out", "শ্রেণিবিভাগ"]),
    (90, "সুশাসন, নৈতিকতা, সততা ও নিরপেক্ষতা", ["সংজ্ঞা", "বৈশিষ্ট্য", "মূলনীতি", "জনসেবা"]),
]

# ── P2 (Second) ────────────────────────────────────────────────────────────
SECOND = [
    (1, 'english', "Voice", ["Active", "Passive", "tense অনুযায়ী পরিবর্তন"]),
    (2, 'bd', "সংবিধান", ["প্রস্তাবনা", "মূলনীতি", "তফসিল"]),
    (3, 'international', "বিশ্বযুদ্ধ", ["প্রথম বিশ্বযুদ্ধ", "দ্বিতীয় বিশ্বযুদ্ধ", "কারণ", "ফলাফল"]),
    (4, 'math', "বীজগণিত", ["রাশি", "সূত্র", "উৎপাদক"]),
    (5, 'science', "পদার্থের অবস্থা", ["কঠিন", "তরল", "গ্যাসীয়"]),
    (6, 'ict', "Number System", ["Binary", "Decimal", "Octal", "Hexadecimal"]),
    (7, 'mental', "Coding-Decoding", ["letter coding", "number coding", "symbol coding"]),
    (8, 'ethics', "আইনের শাসন", ["Rule of Law", "সমতা", "ন্যায়বিচার"]),
    (9, 'geography', "বিশ্ব ভূগোল", ["মহাদেশ", "মহাসাগর", "দেশ ও রাজধানী"]),
    (10, 'international', "স্নায়ুযুদ্ধ", ["দ্বিমেরু বিশ্ব", "প্রধান ঘটনা"]),
    (11, 'math', "সূচক ও লগারিদম", ["সূচকের সূত্র", "লগের নিয়ম"]),
    (12, 'science', "পরমাণু ও অণু", ["গঠন", "ইলেকট্রন", "প্রোটন", "নিউট্রন"]),
    (13, 'bd', "ছয় দফা ও গণঅভ্যুত্থান", ["১৯৬৬", "১৯৬৯"]),
    (14, 'english', "Narration", ["Direct", "Indirect", "tense ও pronoun পরিবর্তন"]),
    (15, 'math', "সরল ও দ্বিঘাত সমীকরণ", ["সমাধান", "মূল", "উৎপাদক"]),
    (16, 'international', "IMF ও World Bank", ["প্রতিষ্ঠা", "উদ্দেশ্য", "কার্যাবলি"]),
    (17, 'math', "জ্যামিতি", ["ত্রিভুজ", "চতুর্ভুজ", "বৃত্ত"]),
    (18, 'bd', "১৯৭০ সালের নির্বাচন", ["নির্বাচনের ফল", "রাজনৈতিক গুরুত্ব"]),
    (19, 'ict', "Operating System", ["Windows", "Linux", "functions"]),
    (20, 'geography', "পাহাড়, পর্বত ও মালভূমি", []),
    (21, 'english', "Transformation", ["affirmative", "negative", "interrogative", "degree"]),
    (22, 'math', "পরিমিতি", ["ক্ষেত্রফল", "পরিসীমা", "আয়তন"]),
    (23, 'science', "রাসায়নিক বিক্রিয়া", ["অম্ল", "ক্ষার", "লবণ", "pH"]),
    (24, 'mental', "Direction Sense ও Blood Relation", []),
    (25, 'bd', "প্রশাসন ও স্থানীয় সরকার", ["প্রশাসনিক কাঠামো", "স্থানীয় প্রতিষ্ঠান"]),
    (26, 'math', "LCM ও GCD", ["গুণনীয়ক", "গুণিতক", "প্রয়োগ"]),
    (27, 'science', "মৌল ও পর্যায় সারণি", ["পর্যায়", "গ্রুপ", "ধাতু", "অধাতু"]),
    (28, 'international', "NATO ও সামরিক জোট", ["সদস্য", "উদ্দেশ্য", "ভূমিকা"]),
    (29, 'bd', "নির্বাচন ব্যবস্থা ও সাংবিধানিক প্রতিষ্ঠান", []),
    (30, 'math', "মিশ্রণ ও ঐকিক নিয়ম", ["অনুপাত", "একক নিয়ম", "প্রয়োগ"]),
    (31, 'international', "বিপ্লব ও রাজনৈতিক পরিবর্তন", []),
    (32, 'science', "বল ও গতি", ["নিউটনের সূত্র", "ত্বরণ", "ভরবেগ"]),
    (33, 'mental', "Ranking & Arrangement", []),
    (34, 'international', "বিশ্ব ভূরাজনীতি ও সংঘাত", []),
    (35, 'science', "কাজ, শক্তি ও ক্ষমতা", []),
    (36, 'math', "সেট ও ফাংশন", ["set operations", "domain", "range"]),
    (37, 'bd', "বাজেট ও রাজস্ব", ["জাতীয় বাজেট", "কর", "উন্নয়ন ব্যয়"]),
    (38, 'geography', "বাংলাদেশের বন ও প্রাকৃতিক সম্পদ", []),
    (39, 'ict', "Input ও Output Devices", ["keyboard", "mouse", "printer", "monitor"]),
    (40, 'math', "ধারার যোগফল", ["sequence", "arithmetic", "geometric series"]),
    (41, 'international', "নিরস্ত্রীকরণ ও পারমাণবিক চুক্তি", []),
    (42, 'science', "উদ্ভিদবিজ্ঞান", ["উদ্ভিদ টিস্যু", "প্রজনন", "সালোকসংশ্লেষণ"]),
    (43, 'math', "পরিসংখ্যান", ["গড়", "মধ্যক", "প্রচুরক", "range"]),
    (44, 'bd', "শিল্প ও রপ্তানি", ["RMG", "শিল্পনীতি", "রপ্তানি"]),
    (45, 'international', "আন্তর্জাতিক সম্মেলন ও সামিট", []),
    (46, 'math', "সম্ভাবনা", ["ঘটনা", "sample space", "probability"]),
    (47, 'bd', "ব্যাংকিং ও আর্থিক ব্যবস্থা", ["বাংলাদেশ ব্যাংক", "বাণিজ্যিক ব্যাংক"]),
    (48, 'international', "আফ্রিকান ইউনিয়ন ও অন্যান্য সংস্থা", []),
    (49, 'science', "জেনেটিক্স", ["DNA", "RNA", "বংশগতি", "জিন"]),
    (50, 'bd', "জনসংখ্যা, শিক্ষা ও স্বাস্থ্য", []),
    (51, 'math', "করণী", ["surds", "simplification"]),
    (52, 'bd', "জ্বালানি ও প্রাকৃতিক সম্পদ", []),
    (53, 'math', "স্থানাঙ্ক জ্যামিতি", ["coordinates", "distance", "graph"]),
    (54, 'bd', "বৈদেশিক সম্পর্ক ও উন্নয়ন পরিকল্পনা", []),
    (55, 'bd', "মেগা প্রকল্প", ["প্রকল্প", "অবস্থান", "উদ্দেশ্য"]),
    (56, 'math', "অসমতা", ["linear inequality", "solution"]),
    (57, 'international', "উপনিবেশবাদ ও স্বাধীনতা আন্দোলন", []),
    (58, 'bd', "প্রাচীন ও মধ্যযুগের বাংলা", ["রাজবংশ", "শাসনব্যবস্থা"]),
    (59, 'bd', "ব্রিটিশ শাসন", ["পলাশীর যুদ্ধ", "স্থায়ী বন্দোবস্ত"]),
    (60, 'bd', "বঙ্গভঙ্গ ও নবজাগরণ", []),
    (61, 'bd', "জাতীয় প্রতীক ও দিবস", []),
    (62, 'bd', "সংস্কৃতি ও ঐতিহ্য", []),
    (63, 'bd', "পরিবহন ও যোগাযোগ", []),
    (64, 'geography', "উপকূলীয় অঞ্চল ও সুন্দরবন", []),
    (65, 'geography', "সমুদ্র, প্রণালি ও দ্বীপ", []),
    (66, 'geography', "মরুভূমি ও তৃণভূমি", []),
    (67, 'international', "বিশ্ব ভূরাজনীতি (Geopolitics)", []),
    (68, 'international', "সমুদ্রপথ ও কৌশলগত অঞ্চল", []),
    (69, 'ict', "Computer Software", ["System", "Application", "Utility"]),
    (70, 'math', "বিন্যাস ও সমাবেশ", []),
    (71, 'math', "তথ্য বিশ্লেষণ", ["table", "graph", "data interpretation"]),
    (72, 'international', "আন্তর্জাতিক মানবাধিকার ও অভিবাসন", []),
    (73, 'bd', "বৈদেশিক সম্পর্ক ও উন্নয়ন পরিকল্পনা — পুনরালোচনা", []),
    (74, 'math', "সব P2 সূত্র ও সমস্যা অনুশীলন", []),
    (75, 'international', "বিশ্বযুদ্ধ, স্নায়ুযুদ্ধ ও আন্তর্জাতিক সংস্থা Revision", []),
    (76, 'geography', "বাংলাদেশের ভূগোল ও বিশ্ব ভূগোল Revision", []),
    (77, 'math', "Arithmetic Revision", ["শতকরা", "অনুপাত", "লাভ-ক্ষতি", "গড়"]),
    (78, 'bd', "অর্থনীতি ও প্রশাসন Revision", []),
    (79, 'english', "Grammar ও Literature Previous BCS Questions", []),
    (80, 'bangla', "P1 Grammar Previous BCS Questions", []),
    (81, 'bangla', "P1 Literature Previous BCS Questions", []),
    (82, 'bd', "P1 History Previous BCS Questions", []),
    (83, 'bd', "P1 Constitution Previous BCS Questions", []),
    (84, 'international', "P1 Previous BCS Questions", []),
    (85, 'geography', "P1 Previous BCS Questions", []),
    (86, 'math', "P1 Previous BCS Questions", []),
    (87, 'english', "Full Grammar Mock & Error Analysis", []),
    (88, 'bangla', "Full Language & Literature Mock & Error Analysis", []),
    (89, 'bd', "Full Subject Mock & Error Analysis", []),
    (90, None, "১০টি Subject-এর P1/P2 Mixed Mock", []),
]

# ── P3/P4 (Third) ──────────────────────────────────────────────────────────
THIRD = [
    (1, 'bangla', "শব্দার্থ", ["সমার্থক", "বিপরীতার্থক"]),
    (2, 'bangla', "এক কথায় প্রকাশ", []),
    (3, 'bangla', "বাগধারা ও প্রবাদ-প্রবচন", []),
    (4, 'english', "Clauses & Phrases", []),
    (5, 'ict', "Database", ["DBMS", "table", "record", "field"]),
    (6, 'geography', "জলবায়ু", ["ঋতু", "বৃষ্টিপাত", "মৌসুমি বায়ু"]),
    (7, 'ethics', "মানবাধিকার", ["মৌলিক অধিকার", "স্বাধীনতা"]),
    (8, 'english', "Modifiers", []),
    (9, 'science', "উদ্ভিদবিজ্ঞান", ["উদ্ভিদ কোষ", "সালোকসংশ্লেষণ"]),
    (10, 'ict', "Programming Language", ["ভাষার ধরন", "compiler", "interpreter"]),
    (11, 'mental', "Statement & Conclusion", []),
    (12, 'geography', "বায়ুমণ্ডল ও বায়ুপ্রবাহ", []),
    (13, 'ethics', "সামাজিক ন্যায়বিচার", []),
    (14, 'international', "আন্তর্জাতিক বাণিজ্য", ["WTO", "বাণিজ্য চুক্তি"]),
    (15, 'ict', "Algorithm ও Flowchart", []),
    (16, 'geography', "জীববৈচিত্র্য ও বাস্তুতন্ত্র", []),
    (17, 'english', "Gerund, Infinitive & Participle", []),
    (18, 'science', "DNA, RNA ও বংশগতি", []),
    (19, 'mental', "Syllogism", []),
    (20, 'ethics', "দুর্নীতি", ["কারণ", "প্রভাব", "প্রতিরোধ"]),
    (21, 'international', "মানবাধিকার", ["ঘোষণা", "সংস্থা", "চুক্তি"]),
    (22, 'ict', "AI ও Machine Learning", []),
    (23, 'geography', "দুর্যোগ ব্যবস্থাপনা", ["প্রস্তুতি", "সতর্কীকরণ", "পুনর্বাসন"]),
    (24, 'english', "Sentence Completion", []),
    (25, 'ethics', "নারী-পুরুষ সমতা ও অন্তর্ভুক্তি", []),
    (26, 'ict', "IoT", ["সেন্সর", "সংযোগ", "ব্যবহার"]),
    (27, 'geography', "ভূমিধস, খরা ও নদীভাঙন", []),
    (28, 'mental', "Cause & Effect", []),
    (29, 'science', "ধাতু, অধাতু ও সংকর ধাতু", []),
    (30, 'ethics', "সরকারি নীতি ও প্রশাসন", []),
    (31, 'bangla', "সাহিত্যিক পরিচিতি", ["ছদ্মনাম", "উপাধি", "পুরস্কার"]),
    (32, 'english', "Pronoun Reference", []),
    (33, 'bd', "অর্থনীতি", ["GDP", "GNI", "মাথাপিছু আয়", "প্রবৃদ্ধি"]),
    (34, 'geography', "পরিবেশ সংরক্ষণ আইন", []),
    (35, 'ict', "Cloud Computing", []),
    (36, 'ethics', "টেকসই উন্নয়ন", []),
    (37, 'international', "শরণার্থী ও অভিবাসন", []),
    (38, 'science', "তাপ ও তাপগতিবিদ্যা", []),
    (39, 'mental', "Statement & Assumption", []),
    (40, 'bd', "কৃষি ও খাদ্য নিরাপত্তা", []),
    (41, 'geography', "মানচিত্র ও সময় অঞ্চল", []),
    (42, 'ict', "Blockchain", []),
    (43, 'ethics', "আন্তর্জাতিক নৈতিক মানদণ্ড", []),
    (44, 'geography', "অক্ষাংশ ও দ্রাঘিমাংশ", []),
    (45, 'science', "পরিবেশবিজ্ঞান ও বাস্তুতন্ত্র", []),
    (46, 'ict', "Big Data", []),
    (47, 'mental', "Logical Deduction", []),
    (48, 'geography', "সমুদ্র, প্রণালি ও দ্বীপ", []),
    (49, 'ethics', "সামাজিক দায়িত্ব", []),
    (50, 'ict', "Robotics", []),
    (51, 'mental', "Course of Action", []),
    (52, 'geography', "মরুভূমি ও তৃণভূমি", []),
    (53, 'ict', "বাংলাদেশের ICT নীতি", []),
    (54, 'mental', "Word Formation", []),
    (55, 'geography', "আন্তর্জাতিক পরিবেশ সংস্থা", []),
    (56, 'science', "বিবর্তন", []),
    (57, 'ict', "Cyber Law", []),
    (58, 'mental', "Paper Folding & Cutting", []),
    (59, 'geography', "SDGs ও পরিবেশ", []),
    (60, 'science', "জৈবপ্রযুক্তি", []),
    (61, 'mental', "Mirror & Water Image", []),
    (62, 'science', "শিল্প রসায়ন", []),
    (63, 'mental', "Embedded Figures", []),
    (64, 'science', "পলিমার ও দৈনন্দিন রসায়ন", []),
    (65, 'mental', "Cube & Dice", []),
    (66, 'science', "পারমাণবিক শক্তি", []),
    (67, 'mental', "Figure Rotation", []),
    (68, 'science', "জ্বালানি ও পেট্রোকেমিক্যাল", []),
    (69, 'mental', "Spatial Reasoning", []),
    (70, 'ethics', "নৈতিক দর্শন", []),
    (71, 'ethics', "আন্তর্জাতিক নৈতিক মানদণ্ড", []),
    (72, 'geography', "পরিবেশ সংরক্ষণ আইন", []),
    (73, 'ict', "Cyber Law ও বাংলাদেশের ICT নীতি", []),
    (74, 'ethics', "টেকসই উন্নয়ন ও সামাজিক দায়িত্ব", []),
    (75, 'science', "জৈবপ্রযুক্তি ও বিবর্তন Revision", []),
    (76, 'mental', "Verbal Reasoning Revision", []),
    (77, 'mental', "Numerical Reasoning Revision", []),
    (78, 'mental', "Non-verbal Reasoning Revision", []),
    (79, 'ethics', "সুশাসন ও নৈতিকতা Revision", []),
    (80, 'geography', "মানচিত্র, সময় অঞ্চল, অক্ষাংশ ও দ্রাঘিমাংশ", []),
    (81, 'ict', "Cloud, Blockchain ও Big Data Revision", []),
    (82, 'science', "Physics Previous BCS Questions", []),
    (83, 'science', "Chemistry Previous BCS Questions", []),
    (84, 'science', "Biology Previous BCS Questions", []),
    (85, 'ict', "P1 Previous BCS Questions", []),
    (86, 'mental', "P1 Previous BCS Questions", []),
    (87, 'ethics', "P1 Previous BCS Questions", []),
    (88, None, "দুর্বল Topic Revision", []),
    (89, None, "Previous Questions Practice", []),
    (90, None, "১০টি Subject-এর P3/P4 Mixed Revision", []),
]

# প্রতিদিনের MCQ: P1 ৫০ + P2 ২৫ + P3/P4 ১৫ + পূর্বে-পড়া ১০ = ১০০, ৫০ মিনিট।
MCQ = {"p1": 50, "p2": 25, "p3": 15, "revisit": 10}


def _index(rows, label):
    by_day = {}
    for row in rows:
        assert row[0] not in by_day, f"{label}: day {row[0]} appears twice"
        by_day[row[0]] = row
    missing = [d for d in range(1, DAYS + 1) if d not in by_day]
    assert not missing, f"{label}: missing days {missing}"
    return by_day


MAIN_BY_DAY = _index(MAIN, "MAIN")
SECOND_BY_DAY = _index(SECOND, "SECOND")
THIRD_BY_DAY = _index(THIRD, "THIRD")
