# Backfill rules for the 2,112 BCS questions that have `topic_id = null`.
#
# Shape: (order, subject_slug, topic_bn, subtopic_bn, sql_condition)
#
#   * `sql_condition` is a boolean expression over the alias `q` (a row of
#     `public.questions`); it may reference `q.statement` and `q.source_type`.
#   * Lower `order` wins. Order matters: an HCF question can also contain the
#     word কাজ, so the numerator rules must come before the work-rate ones.
#   * Every target (subject, topic, subtopic) must exist in the live active
#     tree; the generator asserts that before emitting SQL.
#
# The rules are deliberately keyed on question *wording*, because that is the
# only signal these rows carry: they have no topic_id, no links, and their
# `statement_bn` is empty (every one of the 4,408 rows carries its Bengali text
# in `statement`). Batch filenames supplied the first split — the four
# `ai-draft-lcm-hcf-*` batches are 399 questions of HCF/LCM — and the rest is
# wording.

# ── Bengali / English token fragments reused below ────────────────────────────
B = "q.statement like "

MATH_PATIGANIT = "পাটিগণিত"
MATH_BIJGANIT = "বীজগণিত"
MATH_DHARA = "ধারা ও সেট"
MATH_JYAMITI = "জ্যামিতি"
MATH_PORIMITI = "পরিমিতি"
MATH_PORISONGKHYAN = "পরিসংখ্যান ও সম্ভাব্যতা"

BANGLA_BAKARAN = "বাংলা ভাষা ও ব্যাকরণ"
BANGLA_PROCHIN = "প্রাচীন ও মধ্যযুগের বাংলা সাহিত্য"
BANGLA_ADHUNIK = "আধুনিক বাংলা সাহিত্য"
BANGLA_KARM = "সাহিত্যকর্ম ও সাহিত্যবিষয়ক তথ্য"

RULES = [
    # ═══ MATH — numerators and factors first ═══════════════════════════════════
    # Explicit লসাগু/গসাগু wording.
    (10, "math", MATH_PATIGANIT, "ল.সা.গু ও গ.সা.গু",
     B + "'%গ.সা.গু%' or " + B + "'%গসাগু%' or " + B + "'%ল.সা.গু%' or "
     + B + "'%লসাগু%' or " + B + "'%সাধারণ গুণনীয়ক%' or " + B + "'%সাধারণ গুণিতক%'"),
    # "কোন বৃহত্তম সংখ্যা দ্বারা … ভাগ করলে … ভাগশেষ" is HCF in disguise.
    (11, "math", MATH_PATIGANIT, "ল.সা.গু ও গ.সা.গু",
     "(" + B + "'%বৃহত্তম সংখ্যা%' or " + B + "'%বড় সংখ্যা%' or " + B + "'%ক্ষুদ্রতম সংখ্যা%')"
     " and (" + B + "'%ভাগশেষ%' or " + B + "'%ভাগ করলে%' or " + B + "'%নিঃশেষে%')"),
    # Clock / bell / wheel cycles are LCM problems.
    (12, "math", MATH_PATIGANIT, "ল.সা.গু ও গ.সা.গু",
     "(" + B + "'%একসাথে%' or " + B + "'%একই সময়ে%' or " + B + "'%পরে পরপর%' or "
     + B + "'%বাজে%' or " + B + "'%ঘোরে%') and (" + B + "'%মিনিট%' or " + B + "'%সেকেন্ড%' or "
     + B + "'%ঘণ্টা%')"),

    (20, "math", MATH_PATIGANIT, "শতকরা",
     B + "'%শতকরা%' or " + B + "'%শতাংশ%' or " + B + "'%শতকরা হার%'"),
    (21, "math", MATH_PATIGANIT, "অনুপাত ও সমানুপাত",
     B + "'%অনুপাত%' or " + B + "'%সমানুপাত%'"),
    (22, "math", MATH_PATIGANIT, "লাভ ও ক্ষতি",
     "(" + B + "'%লাভ%' or " + B + "'%ক্ষতি%' or " + B + "'%মুনাফা%') and ("
     + B + "'%কিনে%' or " + B + "'%ক্রয়মূল্য%' or " + B + "'%বিক্রয়মূল্য%' or "
     + B + "'%বিক্রি%' or " + B + "'%দাম%')"),
    (23, "math", MATH_PATIGANIT, "সরল মুনাফা",
     B + "'%সরল মুনাফা%' or " + B + "'%সরল সুদ%'"),
    (24, "math", MATH_PATIGANIT, "যৌগিক মুনাফা",
     B + "'%চক্রবৃদ্ধি%' or " + B + "'%যৌগিক%'"),

    # Work-rate: people/things finishing a job over days.
    (30, "math", MATH_PATIGANIT, "কাজ ও সময়",
     "(" + B + "'%দিনে%' or " + B + "'%দিনের%') and ("
     + B + "'%কাজ%' or " + B + "'%খাবার%' or " + B + "'%খাদ্য%' or "
     + B + "'%ট্যাংক%' or " + B + "'%চৌবাচ্চা%' or " + B + "'%জমি%' or "
     + B + "'%ধান%' or " + B + "'%পুকুর%' or " + B + "'%রাস্তা%')"),
    (31, "math", MATH_PATIGANIT, "দূরত্ব, সময় ও গতি",
     "(" + B + "'%গতি%' or " + B + "'%বেগ%' or " + B + "'%কি.মি%' or "
     + B + "'%কিমি%') and (" + B + "'%ঘণ্টা%' or " + B + "'%সময়%' or "
     + B + "'%মিনিট%' or " + B + "'%সেকেন্ড%')"),
    # Unitary method: "N টি X এর দাম M টাকা হলে …".
    (32, "math", MATH_PATIGANIT, "ঐকিক নিয়ম",
     "(" + B + "'%টাকা%' or " + B + "'%দাম%') and (" + B + "'%টি%' or " + B + "'%কেজি%')"
     " and " + B + "'%কত%'"),
    # Average of a list of numbers ("কয়েকটি সংখ্যার গড়").
    (33, "math", MATH_PATIGANIT, "গড়",
     B + "'%গড়%' and (" + B + "'%সংখ্যা%' or " + B + "'%সংখ্যাগুলোর%')"),

    # ═══ MATH — algebra ═══════════════════════════════════════════════════════
    (40, "math", MATH_BIJGANIT, "বীজগাণিতিক সূত্র",
     "(" + B + "'%a + b%' or " + B + "'%a+b%' or " + B + "'%a² + b²%' or "
     + B + "'%a²+b²%' or " + B + "'%ab =%' or " + B + "'%x + 1/x%' or "
     + B + "'%x³ +%' or " + B + "'%মান কত%') and not " + B + "'%সমীকরণ%'"),
    (41, "math", MATH_BIJGANIT, "উৎপাদক বিশ্লেষণ",
     B + "'%উৎপাদক%'"),
    (42, "math", MATH_BIJGANIT, "দ্বিঘাত সমীকরণ",
     B + "'%দ্বিঘাত%'"),
    (43, "math", MATH_BIJGANIT, "সরল সমীকরণ",
     B + "'%সমীকরণ%'"),
    (44, "math", MATH_BIJGANIT, "সূচক",
     B + "'%সূচক%'"),
    (45, "math", MATH_BIJGANIT, "লগারিদম",
     B + "'%লগারিদম%' or " + B + "'%log%'"),
    (46, "math", MATH_BIJGANIT, "বহুপদী",
     B + "'%বহুপদী%'"),
    (47, "math", MATH_BIJGANIT, "অসমতা",
     B + "'%অসমতা%'"),

    # ═══ MATH — series & sets ═════════════════════════════════════════════════
    (50, "math", MATH_DHARA, "সমান্তর ধারা",
     B + "'%সমান্তর ধারা%'"),
    (51, "math", MATH_DHARA, "গুণোত্তর ধারা",
     B + "'%গুণোত্তর ধারা%'"),
    (52, "math", MATH_DHARA, "ধারার যোগফল",
     B + "'%ধারার%' or " + B + "'%ধারা%'"),
    (53, "math", MATH_DHARA, "সেটের অপারেশন",
     "(" + B + "'%সেট%') and (" + B + "'%সংযোগ%' or " + B + "'%ছেদ%' or "
     + B + "'%উপসেট%' or " + B + "'%পাওয়ার সেট%' or " + B + "'%A ∪%' or " + B + "'%A ∩%')"),
    (54, "math", MATH_DHARA, "সেট",
     B + "'%সেট%'"),

    # ═══ MATH — geometry & mensuration ════════════════════════════════════════
    (60, "math", MATH_JYAMITI, "ত্রিভুজ",
     B + "'%ত্রিভুজ%'"),
    (61, "math", MATH_JYAMITI, "চতুর্ভুজ",
     B + "'%চতুর্ভুজ%' or " + B + "'%সামান্তরিক%' or " + B + "'%রম্বস%' or "
     + B + "'%ট্রাপিজিয়াম%'"),
    (62, "math", MATH_JYAMITI, "বৃত্ত",
     B + "'%বৃত্ত%' or " + B + "'%পরিধি%'"),
    (63, "math", MATH_JYAMITI, "রেখা ও কোণ",
     B + "'%কোণ%'"),
    (70, "math", MATH_PORIMITI, "ক্ষেত্রফল",
     B + "'%ক্ষেত্রফল%'"),
    (71, "math", MATH_PORIMITI, "আয়তন",
     B + "'%আয়তন%'"),
    (72, "math", MATH_PORIMITI, "পরিসীমা",
     B + "'%পরিসীমা%'"),
    (73, "math", MATH_PORIMITI, "ঘনবস্তু",
     B + "'%ঘনক%' or " + B + "'%সিলিন্ডার%' or " + B + "'%কোণক%'"),

    # ═══ MATH — statistics & probability ══════════════════════════════════════
    (80, "math", MATH_PORISONGKHYAN, "সম্ভাব্যতা",
     B + "'%সম্ভাব্যতা%' or " + B + "'%পাশা%' or " + B + "'%কয়েন%' or " + B + "'%মুদ্রা%'"),
    (81, "math", MATH_PORISONGKHYAN, "বিন্যাস",
     B + "'%বিন্যাস%'"),
    (82, "math", MATH_PORISONGKHYAN, "সমাবেশ",
     B + "'%সমাবেশ%'"),
    (83, "math", MATH_PORISONGKHYAN, "মধ্যক",
     B + "'%মধ্যক%'"),
    (84, "math", MATH_PORISONGKHYAN, "প্রচুরক",
     B + "'%প্রচুরক%'"),
    (85, "math", MATH_PORISONGKHYAN, "গাণিতিক গড়",
     B + "'%গড়%'"),

    # ═══ BANGLA — ব্যাকরণ ═════════════════════════════════════════════════════
    (100, "bangla", BANGLA_BAKARAN, "সন্ধি", B + "'%সন্ধি%'"),
    (101, "bangla", BANGLA_BAKARAN, "সমাস", B + "'%সমাস%'"),
    (102, "bangla", BANGLA_BAKARAN, "কারক ও বিভক্তি",
     B + "'%কারক%' or " + B + "'%বিভক্তি%' or " + B + "'%অনুসর্গ%'"),
    (103, "bangla", BANGLA_BAKARAN, "উপসর্গ", B + "'%উপসর্গ%'"),
    (104, "bangla", BANGLA_BAKARAN, "প্রত্যয়",
     B + "'%প্রত্যয়%' or " + B + "'%কৃৎ%' or " + B + "'%তদ্ধিত%'"),
    (105, "bangla", BANGLA_BAKARAN, "ণত্ব ও ষত্ব বিধান",
     B + "'%ণত্ব%' or " + B + "'%ষত্ব%'"),
    (106, "bangla", BANGLA_BAKARAN, "ধ্বনি ও বর্ণ",
     B + "'%ধ্বনি%' or " + B + "'%বর্ণ%' or " + B + "'%স্বরবর্ণ%' or " + B + "'%ব্যঞ্জনবর্ণ%'"),
    (107, "bangla", BANGLA_BAKARAN, "বাগধারা",
     B + "'%বাগধারা%' or " + B + "'%প্রবাদ%' or " + B + "'%প্রবচন%'"),
    (108, "bangla", BANGLA_BAKARAN, "এক কথায় প্রকাশ",
     B + "'%এক কথায়%' or " + B + "'%এককথায়%'"),
    (109, "bangla", BANGLA_BAKARAN, "সমার্থক শব্দ",
     B + "'%সমার্থক%' or " + B + "'%প্রতিশব্দ%'"),
    (110, "bangla", BANGLA_BAKARAN, "বিপরীতার্থক শব্দ",
     B + "'%বিপরীত%'"),
    (111, "bangla", BANGLA_BAKARAN, "বানান শুদ্ধি",
     B + "'%শুদ্ধ বানান%' or " + B + "'%বানান%'"),
    (112, "bangla", BANGLA_BAKARAN, "বাক্য ও বাক্যশুদ্ধি",
     "(" + B + "'%বাক্য%') and (" + B + "'%শুদ্ধ%' or " + B + "'%অশুদ্ধ%' or "
     + B + "'%গঠন%' or " + B + "'%রূপান্তর%')"),
    (113, "bangla", BANGLA_BAKARAN, "বাক্যের শ্রেণিবিভাগ",
     B + "'%বাক্যের%'"),
    (114, "bangla", BANGLA_BAKARAN, "শব্দের শ্রেণিবিভাগ",
     B + "'%শব্দের%' and (" + B + "'%শ্রেণি%' or " + B + "'%ভাগ%')"),
    (115, "bangla", BANGLA_BAKARAN, "পারিভাষিক শব্দ",
     B + "'%পারিভাষিক%'"),
    # `%পদ%` alone also matches সম্পদ / পদ্মা / পদার্থ / পদক্ষেপ, which put 199
    # questions into this bucket during the dry run. Require the word to be
    # discussed *as* a grammar term.
    (116, "bangla", BANGLA_BAKARAN, "পদ",
     B + "'%পদের%' or " + B + "'%কোন পদ%' or " + B + "'%পদ নির্ণয়%' or "
     + B + "'%পদ কত%' or " + B + "'%বিশেষণ পদ%' or " + B + "'%ক্রিয়া পদ%'"),
    (117, "bangla", BANGLA_BAKARAN, "প্রয়োগ ও অপ্রয়োগ",
     B + "'%প্রয়োগ%' and (" + B + "'%অপ্রয়োগ%' or " + B + "'%প্রয়োগ হয়%' or "
     + B + "'%প্রয়োগের%')"),
    (118, "bangla", BANGLA_BAKARAN, "বাংলা ভাষার উৎপত্তি ও বিকাশ",
     B + "'%উৎপত্তি%' or " + B + "'%বিকাশ%' or " + B + "'%ভাষার জন্ম%'"),

    # `পদ` and `প্রয়োগ ও অপ্রয়োগ` are not rows in the live tree. Both are
    # grammar concepts the master list names, so the migration creates them
    # under বাংলা ভাষা ও ব্যাকরণ rather than filing the questions elsewhere.
    # ═══ BANGLA — সাহিত্য ─────────────────────────────────────────────────────
    (130, "bangla", BANGLA_PROCHIN, "চর্যাপদ", B + "'%চর্যাপদ%'"),
    (131, "bangla", BANGLA_PROCHIN, "মঙ্গলকাব্য",
     B + "'%মঙ্গলকাব্য%' or " + B + "'%মনসামঙ্গল%' or " + B + "'%চণ্ডীমঙ্গল%'"),
    (132, "bangla", BANGLA_PROCHIN, "বৈষ্ণব পদাবলি",
     B + "'%বৈষ্ণব%' or " + B + "'%পদাবলি%'"),
    (133, "bangla", BANGLA_PROCHIN, "মধ্যযুগের সাহিত্যকর্ম",
     B + "'%মধ্যযুগ%'"),
    (140, "bangla", BANGLA_ADHUNIK, "রবীন্দ্রনাথ ঠাকুর",
     B + "'%রবীন্দ্র%' or " + B + "'%রবি ঠাকুর%'"),
    (141, "bangla", BANGLA_ADHUNIK, "কাজী নজরুল ইসলাম",
     B + "'%নজরুল%'"),
    (142, "bangla", BANGLA_ADHUNIK, "মাইকেল মধুসূদন দত্ত",
     B + "'%মাইকেল%' or " + B + "'%মধুসূদন%'"),
    (143, "bangla", BANGLA_ADHUNIK, "বঙ্কিমচন্দ্র চট্টোপাধ্যায়",
     B + "'%বঙ্কিম%'"),
    (144, "bangla", BANGLA_ADHUNIK, "শরৎচন্দ্র চট্টোপাধ্যায়",
     B + "'%শরৎচন্দ্র%'"),
    (145, "bangla", BANGLA_ADHUNIK, "মীর মশাররফ হোসেন",
     B + "'%মশাররফ%'"),
    (146, "bangla", BANGLA_ADHUNIK, "বেগম রোকেয়া",
     B + "'%রোকেয়া%'"),
    (147, "bangla", BANGLA_ADHUNIK, "জীবনানন্দ দাশ",
     B + "'%জীবনানন্দ%'"),
    (148, "bangla", BANGLA_ADHUNIK, "জসীমউদ্‌দীন",
     B + "'%জসীম%'"),
    (149, "bangla", BANGLA_ADHUNIK, "সুকান্ত ভট্টাচার্য",
     B + "'%সুকান্ত%'"),
    (150, "bangla", BANGLA_ADHUNIK, "ফররুখ আহমদ",
     B + "'%ফররুখ%'"),
    (151, "bangla", BANGLA_ADHUNIK, "শামসুর রাহমান",
     B + "'%শামসুর রাহমান%'"),
    (152, "bangla", BANGLA_ADHUNIK, "ঈশ্বরচন্দ্র বিদ্যাসাগর",
     B + "'%বিদ্যাসাগর%'"),
    (153, "bangla", BANGLA_ADHUNIK, "দীনবন্ধু মিত্র",
     B + "'%দীনবন্ধু%'"),
    (154, "bangla", BANGLA_ADHUNIK, "সৈয়দ শামসুল হক",
     B + "'%শামসুল হক%'"),

    (160, "bangla", BANGLA_KARM, "বাংলা উপন্যাস", B + "'%উপন্যাস%'"),
    (161, "bangla", BANGLA_KARM, "বাংলা ছোটগল্প", B + "'%ছোটগল্প%'"),
    (162, "bangla", BANGLA_KARM, "বাংলা নাটক",
     B + "'%নাটক%' or " + B + "'%নাট্যকার%'"),
    (163, "bangla", BANGLA_KARM, "বাংলা কাব্যগ্রন্থ ও কবিতা",
     B + "'%কাব্য%' or " + B + "'%কবিতা%' or " + B + "'%কবি%'"),
    (164, "bangla", BANGLA_KARM, "সাহিত্য পত্র-পত্রিকা",
     B + "'%পত্রিকা%' or " + B + "'%সাময়িকী%' or " + B + "'%সম্পাদক%'"),
    (165, "bangla", BANGLA_KARM, "সাহিত্যিকদের ছদ্মনাম ও উপাধি",
     B + "'%ছদ্মনাম%' or " + B + "'%উপাধি%'"),
    (166, "bangla", BANGLA_KARM, "সাহিত্য পুরস্কার",
     B + "'%পুরস্কার%' or " + B + "'%একুশে পদক%'"),
    (167, "bangla", BANGLA_KARM, "বাংলা সাহিত্যের যুগবিভাগ",
     B + "'%যুগবিভাগ%' or " + B + "'%যুগে%'"),
    (168, "bangla", BANGLA_KARM, "বিখ্যাত সাহিত্যিক উক্তি",
     B + "'%উক্তি%'"),
]
