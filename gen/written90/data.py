#!/usr/bin/env python3
"""BCS Written (compulsory) — subject → P1..P4 → topic → subtopic.

Source: the user's 2026-11-27 Written master structure, which follows the BPSC
Written syllabus (bpsc.portal.gov.bd, "SYLLABUS FOR BCS (WRITTEN) EXAMINATION").

IMPORTANT — what the P1..P4 tags are
------------------------------------
BPSC's official Written syllabus does NOT rank its topics. The P1-P4 labels here
are a *proposed study priority* for planning, not an official BPSC ranking, and
every generated row records that in its metadata so no screen can present them
as official. The marks, however, ARE the official paper marks.

What is verified and what is not
--------------------------------
* Marks (900 total, per paper) — from the official written syllabus table.
* Subject / band / topic / subtopic names — transcribed from the user's master
  structure, which is itself the working taxonomy.
* General Science & Technology Part B ("Technology") — the user flagged that
  this section is not yet fully mapped against the official PDF. Only the four
  broad lines that were supplied are encoded here, marked `provisional`.
"""
from __future__ import annotations

# --------------------------------------------------------------------------
# Course
# --------------------------------------------------------------------------
COURSE_SLUG = "bcs-written"
COURSE_TITLE_EN = "BCS Written"
COURSE_TITLE_BN = "বিসিএস লিখিত"
COURSE_SORT_ORDER = 2

# Official paper marks (compulsory papers, total 900).
TOTAL_MARKS = 900

# --------------------------------------------------------------------------
# Subjects. `bands` is a list of (band, band_marks, [(topic_bn, [subtopic_bn…])]).
#
# band_marks=None means the official syllabus does not split the paper into
# separately-marked parts, so the band carries no mark of its own.
# --------------------------------------------------------------------------
SUBJECTS = [
    {
        "slug": "bangla-1",
        "title_bn": "বাংলা ১ম পত্র",
        "title_en": "Bangla First Paper",
        "marks": 100,
        "bands": [
            ("P1", 30, [
                ("শব্দগঠন", [
                    "উপসর্গ, প্রত্যয় ও সমাসের মাধ্যমে শব্দগঠন",
                    "শব্দের গঠন ও ব্যবহার",
                ]),
                ("বানান ও বানানের নিয়ম", [
                    "শুদ্ধ বানান",
                    "বানান সংশোধন",
                ]),
                ("বাক্যশুদ্ধি ও প্রয়োগ-অপপ্রয়োগ", [
                    "বাক্যের ভুল সংশোধন",
                    "শব্দের যথাযথ প্রয়োগ",
                ]),
                ("প্রবাদ-প্রবচনের নিহিতার্থ প্রকাশ", [
                    "প্রবাদ ও প্রবচনের অর্থ",
                    "প্রাসঙ্গিক ব্যাখ্যা",
                ]),
                ("বাক্যগঠন", [
                    "শুদ্ধ বাক্য রচনা",
                    "বাক্যের গঠন ও প্রকাশভঙ্গি",
                ]),
            ]),
            ("P2", 20, [
                ("ভাবসম্প্রসারণ", [
                    "উদ্ধৃতি ও প্রবাদভিত্তিক ভাবসম্প্রসারণ",
                    "নৈতিক ও সামাজিক বিষয়",
                    "সাহিত্য ও জীবনবোধ",
                    "সমসাময়িক বিষয়",
                ]),
            ]),
            ("P3", 20, [
                ("সারমর্ম", [
                    "গদ্যাংশের সারমর্ম",
                    "কবিতার সারমর্ম",
                    "মূল বক্তব্য শনাক্তকরণ",
                    "সংক্ষিপ্ত ও যথাযথ ভাষায় উপস্থাপন",
                ]),
            ]),
            ("P4", 30, [
                ("প্রাচীন ও মধ্যযুগের সাহিত্য", [
                    "চর্যাপদ",
                    "মঙ্গলকাব্য",
                    "রোমান্টিক কাব্য",
                ]),
                ("বাংলা গদ্য ও সাহিত্যের বিকাশ", [
                    "ফোর্ট উইলিয়াম কলেজ",
                    "ঈশ্বরচন্দ্র বিদ্যাসাগর",
                    "বঙ্কিমচন্দ্র চট্টোপাধ্যায়",
                ]),
                ("আধুনিক বাংলা সাহিত্য", [
                    "মাইকেল মধুসূদন দত্ত",
                    "মীর মশাররফ হোসেন",
                    "রবীন্দ্রনাথ ঠাকুর",
                    "দীনবন্ধু মিত্র",
                    "কাজী নজরুল ইসলাম",
                    "জসীমউদ্দীন",
                    "বেগম রোকেয়া",
                    "ফররুখ আহমদ",
                    "কায়কোবাদ",
                ]),
                ("সমকালীন সাহিত্য", [
                    "আধুনিক ও সমকালীন কবি",
                    "আধুনিক ও সমকালীন লেখক",
                    "আধুনিক ও সমকালীন নাট্যকার",
                ]),
            ]),
        ],
    },
    {
        "slug": "bangla-2",
        "title_bn": "বাংলা ২য় পত্র",
        "title_en": "Bangla Second Paper",
        "marks": 100,
        "bands": [
            ("P1", 40, [
                ("রচনা", [
                    "বাংলাদেশ বিষয়াবলি",
                    "জাতীয় ও আন্তর্জাতিক গুরুত্বপূর্ণ বিষয়",
                    "শিক্ষা, সমাজ ও সংস্কৃতি",
                    "বিজ্ঞান, প্রযুক্তি ও অর্থনীতি",
                    "পরিবেশ ও উন্নয়ন",
                ]),
            ]),
            ("P2", 15, [
                ("ইংরেজি থেকে বাংলা অনুবাদ", [
                    "শব্দ ও বাক্যাংশের যথাযথ অর্থ",
                    "বাক্যের ভাব বজায় রাখা",
                    "প্রাসঙ্গিক ও প্রাঞ্জল বাংলা",
                ]),
            ]),
            ("P3", 15, [
                ("পত্রলিখন", [
                    "আনুষ্ঠানিক পত্র",
                    "আধা-আনুষ্ঠানিক পত্র",
                    "স্মারকলিপি",
                    "ব্যবসায়িক পত্র",
                ]),
            ]),
            ("P4", 30, [
                ("কাল্পনিক সংলাপ", [
                    "সামাজিক ও জাতীয় বিষয়",
                    "সমসাময়িক সমস্যা",
                    "যুক্তিনির্ভর সংলাপ",
                ]),
                ("গ্রন্থ-সমালোচনা", [
                    "গ্রন্থ পরিচিতি",
                    "মূল বক্তব্য ও বিষয়বস্তু",
                    "সাহিত্যমান ও মূল্যায়ন",
                ]),
            ]),
        ],
    },
    {
        "slug": "english",
        "title_bn": "English",
        "title_en": "English",
        "marks": 200,
        "bands": [
            ("P1", 60, [
                ("Reading Comprehension", [
                    "Unseen passage",
                    "Thematic questions",
                    "Main idea and supporting arguments",
                    "Inference and interpretation",
                ]),
                ("Grammar and Usage", [
                    "Parts of speech",
                    "Tense and sequence of tenses",
                    "Subject-verb agreement",
                    "Articles and prepositions",
                    "Sentence structure",
                    "Clauses and phrases",
                    "Voice and narration",
                    "Transformation",
                    "Appropriate word usage",
                    "Error detection and correction",
                ]),
            ]),
            ("P2", 40, [
                ("Summary Writing", [
                    "Main idea identification",
                    "Concise expression",
                    "Writing within 100 words",
                    "Avoiding unnecessary details",
                ]),
                ("Letter to the Editor", [
                    "Formal letter format",
                    "Issue identification",
                    "Argument and recommendation",
                    "Appropriate tone and language",
                ]),
            ]),
            ("P3", 50, [
                ("Essay", [
                    "Contemporary issues",
                    "Bangladesh-related issues",
                    "International affairs",
                    "Economy and development",
                    "Science and technology",
                    "Environment and climate change",
                    "Governance and society",
                    "Analytical and argumentative writing",
                ]),
            ]),
            ("P4", 50, [
                ("Bangla to English Translation", [
                    "Sentence translation",
                    "Paragraph translation",
                    "Appropriate vocabulary",
                    "Grammatical accuracy",
                ]),
                ("English to Bangla Translation", [
                    "Sentence translation",
                    "Paragraph translation",
                    "Contextual meaning",
                    "Natural Bengali expression",
                ]),
            ]),
        ],
    },
    {
        "slug": "bd-affairs",
        "title_bn": "বাংলাদেশ বিষয়াবলি",
        "title_en": "Bangladesh Affairs",
        "marks": 200,
        "bands": [
            ("P1", None, [
                ("বাংলাদেশের ইতিহাস ও সংস্কৃতি", [
                    "প্রাচীন থেকে আধুনিক বাংলাদেশের ইতিহাস",
                    "ভাষা আন্দোলন ১৯৫২",
                    "১৯৫৪ সালের নির্বাচন",
                    "ছয় দফা আন্দোলন ১৯৬৬",
                    "গণ-অভ্যুত্থান ১৯৬৮–৬৯",
                    "১৯৭০ সালের সাধারণ নির্বাচন",
                    "অসহযোগ আন্দোলন ১৯৭১",
                    "৭ মার্চের ঐতিহাসিক ভাষণ",
                    "মুজিবনগর সরকার: গঠন ও কার্যাবলি",
                    "মুক্তিযুদ্ধে প্রধান শক্তি ও জাতিসংঘের ভূমিকা",
                    "পাকিস্তানি বাহিনীর আত্মসমর্পণ",
                    "বঙ্গবন্ধুর স্বদেশ প্রত্যাবর্তন",
                    "বাংলাদেশ থেকে ভারতীয় সশস্ত্র বাহিনীর প্রত্যাহার",
                ]),
                ("বাংলাদেশের সংবিধান", [
                    "প্রস্তাবনা",
                    "সংবিধানের বৈশিষ্ট্য",
                    "রাষ্ট্র পরিচালনার মূলনীতি",
                    "সংবিধান সংশোধনী",
                ]),
            ]),
            ("P2", None, [
                ("সরকারের অঙ্গসমূহ", [
                    "আইনসভা",
                    "আইন প্রণয়ন ও আর্থিক কার্যাবলি",
                    "সংসদের তদারকি কার্যাবলি",
                    "নির্বাহী বিভাগ",
                    "রাষ্ট্রপতি ও প্রধানমন্ত্রীর ক্ষমতা ও কার্যাবলি",
                    "মন্ত্রিসভা ও মন্ত্রণালয়",
                    "আমলাতন্ত্র ও সচিবালয়",
                    "আইনশৃঙ্খলা রক্ষাকারী বাহিনী",
                    "বিচার বিভাগ",
                    "সুপ্রিম কোর্ট ও অধস্তন আদালত",
                    "বিচার বিভাগের স্বাধীনতা",
                    "Judicial Review",
                    "Alternative Dispute Resolution (ADR)",
                ]),
                ("প্রশাসনিক কাঠামো", [
                    "জাতীয় ও স্থানীয় সরকার",
                    "বিকেন্দ্রীকরণ",
                    "স্থানীয় পর্যায়ের পরিকল্পনা",
                ]),
                ("রাজনৈতিক দল ও নির্বাচন", [
                    "রাজনৈতিক দলের ঐতিহাসিক বিকাশ",
                    "নেতৃত্ব, আদর্শ ও কর্মসূচি",
                    "দলীয় জোট ও দলীয় রাজনীতি",
                    "নির্বাচন কমিশন",
                    "নির্বাচনী আইন",
                    "Representation of People Order (RPO)",
                    "নির্বাচনী আচরণ ও পর্যবেক্ষণ",
                ]),
            ]),
            ("P3", None, [
                ("বাংলাদেশের অর্থনীতি", [
                    "GDP, GNP ও NNP",
                    "দারিদ্র্য বিমোচন",
                    "অর্থনৈতিক উন্নয়ন",
                    "Vision 2021",
                    "জাতীয় উন্নয়ন ও অর্থনৈতিক প্রবৃদ্ধি",
                ]),
                ("বাংলাদেশের সমাজ ও জনসংখ্যা", [
                    "জনমিতিক বৈশিষ্ট্য",
                    "জাতিগত ও সাংস্কৃতিক বৈচিত্র্য",
                    "নারী ও উন্নয়ন",
                    "সামাজিক সমস্যা ও সম্ভাবনা",
                ]),
                ("ভূগোল ও প্রাকৃতিক সম্পদ", [
                    "বাংলাদেশের ভূপ্রকৃতি",
                    "বিভিন্ন অঞ্চলের বৈশিষ্ট্য",
                    "প্রাকৃতিক সম্পদ",
                    "সম্পদের টেকসই ব্যবস্থাপনা",
                ]),
                ("পরিবেশ ও প্রকৃতি", [
                    "পরিবেশ সংরক্ষণ",
                    "জীববৈচিত্র্য",
                    "পরিবেশগত চ্যালেঞ্জ",
                    "টেকসই উন্নয়ন",
                ]),
                ("বিশ্বায়ন ও বাংলাদেশ", [
                    "বিশ্বায়নের অর্থনৈতিক ও রাজনৈতিক প্রভাব",
                    "WTO",
                    "World Bank",
                    "IMF",
                    "ADB ও IDB",
                    "বহুজাতিক কোম্পানি",
                ]),
            ]),
            ("P4", None, [
                ("বাংলাদেশের পররাষ্ট্রনীতি", [
                    "পররাষ্ট্রনীতির লক্ষ্য ও নির্ধারক",
                    "নীতি প্রণয়ন প্রক্রিয়া",
                    "জাতীয় ক্ষমতার উপাদান",
                    "নিরাপত্তা কৌশল",
                    "ভূরাজনীতি ও পরিবেশগত বিষয়",
                    "অর্থনৈতিক কূটনীতি",
                    "বৈদেশিক সাহায্য ও আন্তর্জাতিক বাণিজ্য",
                ]),
                ("আন্তর্জাতিক সংস্থায় বাংলাদেশের অংশগ্রহণ", [
                    "জাতিসংঘ",
                    "শান্তিরক্ষা মিশন",
                    "NAM",
                    "SAARC",
                    "OIC",
                    "BIMSTEC",
                    "D-8",
                ]),
                ("ICT ও গণমাধ্যম", [
                    "সমসাময়িক যোগাযোগব্যবস্থা",
                    "গণমাধ্যমের ভূমিকা",
                    "তথ্য অধিকার আইন (RTI)",
                    "ই-গভর্ন্যান্স",
                ]),
                ("নাগরিক সমাজ ও বেসরকারি প্রতিষ্ঠান", [
                    "Civil Society",
                    "Interest Groups",
                    "NGOs",
                    "Non-formal Institutions",
                ]),
            ]),
        ],
    },
    {
        "slug": "international-affairs",
        "title_bn": "আন্তর্জাতিক বিষয়াবলি",
        "title_en": "International Affairs",
        "marks": 100,
        "bands": [
            ("P1", None, [
                ("International Affairs-এর পরিচিতি", [
                    "অর্থ, পরিধি ও গুরুত্ব",
                    "International Affairs ও International Politics-এর সম্পর্ক",
                ]),
                ("আন্তর্জাতিক ব্যবস্থার Actor", [
                    "Modern State",
                    "Sovereignty",
                    "Non-state Actors",
                    "International Institutions",
                ]),
                ("Power and Security", [
                    "Power ও National Power",
                    "Balance of Power",
                    "Disarmament",
                    "Arms Control",
                    "Geopolitics",
                    "Terrorism",
                ]),
                ("Major Ideas and Ideologies", [
                    "Nationalism",
                    "Imperialism",
                    "Colonialism",
                    "Neo-colonialism",
                    "Post-modernism",
                    "Globalization",
                    "New World Order",
                ]),
            ]),
            ("P2", None, [
                ("Foreign Policy and Diplomacy", [
                    "পররাষ্ট্রনীতির ধারণা",
                    "পররাষ্ট্রনীতি নির্ধারণ",
                    "Decision-making process",
                    "কূটনীতির কার্যাবলি",
                    "Diplomatic Immunities and Privileges",
                ]),
                ("International Economic Relations", [
                    "International Trade",
                    "Free Trade",
                    "Protectionism",
                    "Foreign Aid",
                    "Debt Crisis",
                    "Foreign Direct Investment (FDI)",
                    "Financial Liberalization",
                    "Regionalism ও Regionalization",
                    "North-South Gap",
                    "Global Poverty",
                    "MDGs",
                ]),
                ("Global Environment", [
                    "Climate Change",
                    "Global Warming",
                    "Climate Adaptation",
                    "Climate Diplomacy",
                ]),
            ]),
            ("P3", None, [
                ("United Nations System", [
                    "জাতিসংঘের অঙ্গসংস্থা",
                    "Security Council",
                    "UN Reforms",
                    "Peacekeeping and Peace-building",
                    "Human Rights Agenda",
                    "Environmental Agenda",
                    "International Court of Justice",
                    "Women Empowerment",
                ]),
                ("Global Institutions", [
                    "World Bank",
                    "IMF",
                    "ADB",
                    "WTO",
                    "G8 ও G-77",
                    "Kyoto Protocol",
                    "COP",
                ]),
                ("Regional Institutions", [
                    "SAARC",
                    "BIMSTEC",
                    "EU",
                    "ASEAN",
                    "NATO",
                    "APEC",
                    "OIC",
                    "AU",
                    "GCC",
                ]),
            ]),
            ("P4", None, [
                ("Major Powers", [
                    "USA",
                    "Russia",
                    "UK",
                    "China",
                    "France",
                    "Germany",
                    "India",
                    "Japan",
                ]),
                ("আন্তর্জাতিক সংঘাত ও সমস্যা", [
                    "Palestine Problem",
                    "Arab Spring",
                    "Kashmir Issue",
                    "Syrian Crisis",
                    "Persian Gulf Conflict",
                    "Iran Nuclear Issue",
                    "North Korean Issue",
                    "Nuclear Proliferation",
                    "Southeast ও East Asian Territorial Disputes",
                ]),
                ("South Asian Politics", [
                    "India-Pakistan Relations",
                    "Bangladesh-India Relations",
                    "Regional Integration",
                    "Water Dispute",
                    "Border Problems",
                    "Terrorism",
                ]),
                ("Bangladesh in International Affairs", [
                    "বাংলাদেশের আন্তর্জাতিক অর্জন",
                    "চ্যালেঞ্জ",
                    "ভবিষ্যৎ দিকনির্দেশনা",
                ]),
                ("Problem-solving and Analytical Writing", [
                    "আন্তর্জাতিক সমস্যা বিশ্লেষণ",
                    "কারণ ও প্রভাব",
                    "সম্ভাব্য সমাধান",
                    "বাণিজ্য, জলবায়ু, বৈদেশিক সাহায্য ও নিরাপত্তা সমস্যা",
                ]),
            ]),
        ],
    },
    {
        "slug": "math-reasoning",
        "title_bn": "গাণিতিক যুক্তি",
        "title_en": "Mathematical Reasoning",
        "marks": 50,
        "bands": [
            ("P1", None, [
                ("Simplification", ["Arithmetic expressions", "Algebraic expressions"]),
                ("Unitary Method", ["ঐকিক নিয়ম", "বাস্তবভিত্তিক সমস্যা"]),
                ("Average", ["গড় নির্ণয়", "গড়ের প্রয়োগ"]),
                ("Percentage", ["শতকরা", "শতকরা পরিবর্তন"]),
                ("Interest", ["Simple Interest", "Compound Interest"]),
                ("Ratio and Proportion", ["অনুপাত", "সমানুপাত"]),
                ("Profit and Loss", ["লাভ-ক্ষতি", "ক্রয়মূল্য ও বিক্রয়মূল্য"]),
                ("LCM and GCD", ["লসাগু", "গসাগু"]),
            ]),
            ("P2", None, [
                ("Algebraic Formulas", ["বীজগাণিতিক সূত্র", "সূত্রের প্রয়োগ"]),
                ("Factorization", ["Polynomial factorization", "উৎপাদক নির্ণয়"]),
                ("Equations", [
                    "Linear Equations",
                    "Quadratic Equations",
                    "Two/Three Unknowns-এর সমীকরণ",
                ]),
                ("Inequalities", ["Linear Inequalities", "Quadratic Inequalities"]),
                ("Exponents and Logarithms", [
                    "সূচক",
                    "লগারিদম",
                    "Exponential Functions",
                    "Logarithmic Functions",
                ]),
            ]),
            ("P3", None, [
                ("Line, Angle and Triangle", [
                    "রেখা ও কোণ",
                    "ত্রিভুজের উপপাদ্য",
                    "Pythagoras Theorem",
                ]),
                ("Circle", ["বৃত্তের উপপাদ্য", "Corollaries"]),
                ("Area and Mensuration", [
                    "ক্ষেত্রফল",
                    "সমতল ক্ষেত্র",
                    "ঘনবস্তু",
                    "পরিমিতি",
                ]),
                ("Cartesian Geometry", ["Distance", "Equation of a Straight Line"]),
            ]),
            ("P4", None, [
                ("Sequence and Series", [
                    "Arithmetic Sequence and Series",
                    "Geometric Sequence and Series",
                ]),
                ("Trigonometry", [
                    "Trigonometric Ratios",
                    "Trigonometric Functions",
                    "Height and Distance",
                ]),
                ("Set Theory", ["Sets", "Venn Diagram"]),
                ("Counting Principles", [
                    "Permutation",
                    "Combination",
                    "Elementary Probability",
                ]),
            ]),
        ],
    },
    {
        "slug": "mental-ability",
        "title_bn": "মানসিক দক্ষতা",
        "title_en": "Mental Ability",
        "marks": 50,
        "bands": [
            ("P1", None, [
                ("Verbal Reasoning", [
                    "Word Relationships",
                    "Analogy",
                    "শব্দের সম্পর্ক ও ধারণা",
                    "ভাষাভিত্তিক যুক্তি",
                    "শব্দের মাধ্যমে সম্পর্ক নির্ণয়",
                ]),
            ]),
            ("P2", None, [
                ("Numerical Ability", [
                    "Number Series",
                    "Missing Number",
                    "Numerical Relationships",
                    "সংখ্যাভিত্তিক যুক্তি",
                    "গাণিতিক সম্পর্ক নির্ণয়",
                ]),
            ]),
            ("P3", None, [
                ("Abstract Reasoning", [
                    "Figure Series",
                    "Pattern Recognition",
                    "Diagram Analysis",
                    "পরিবর্তিত চিত্রের নিয়ম শনাক্তকরণ",
                    "Non-verbal reasoning",
                ]),
            ]),
            ("P4", None, [
                ("Space Relations", [
                    "Spatial Visualization",
                    "Object Rotation",
                    "Direction and Distance",
                    "Pattern-to-object visualization",
                ]),
                ("Spelling and Language", [
                    "Grammar Error Detection",
                    "Punctuation",
                    "Capitalization",
                    "Spelling and Word Formation",
                ]),
                ("Mechanical Reasoning", [
                    "যন্ত্রের কার্যপদ্ধতি",
                    "মৌলিক যান্ত্রিক নীতি",
                    "যন্ত্রের অংশ ও কার্যকারণ",
                ]),
            ]),
        ],
    },
    {
        "slug": "general-science",
        "title_bn": "সাধারণ বিজ্ঞান ও প্রযুক্তি",
        "title_en": "General Science and Technology",
        "marks": 100,
        "bands": [
            ("P1", None, [
                ("Light", [
                    "আলোর প্রকৃতি",
                    "Spectrum",
                    "বিভিন্ন রং ও তরঙ্গদৈর্ঘ্য",
                    "UV, IR ও LASER",
                    "Reflection ও Refraction",
                    "Total Internal Reflection",
                    "Lens ও Thin Converging Lens",
                    "Dispersion",
                    "Particle Nature of Light",
                    "Photoelectric Equation",
                    "Photocell",
                ]),
                ("Sound", [
                    "শ্রবণ প্রক্রিয়া",
                    "Decibel ও Frequency",
                    "Microphone ও Loudspeaker",
                    "Public Address System",
                    "Stationary Waves",
                    "Vibrating Strings",
                    "Beats ও Doppler Effect",
                    "Echo ও Reverberation",
                    "Building Acoustics",
                    "Sabine's Formula",
                ]),
                ("Magnetism", [
                    "চৌম্বকত্ব ও বিদ্যুৎ প্রবাহের সম্পর্ক",
                    "Bar Magnet",
                    "Magnetic Lines of Force",
                    "Torque on a Bar Magnet",
                    "Earth's Magnetic Field",
                    "Tangent Galvanometer",
                    "Vibration Magnetometer",
                    "Para, Dia ও Ferromagnetic Substances",
                    "Electromagnets ও Permanent Magnets",
                ]),
                ("Acid, Base and Salt", [
                    "Acid-base concepts",
                    "Acid ও Base-এর বৈশিষ্ট্য",
                    "Indicators",
                    "pH",
                    "Salts",
                    "দৈনন্দিন ও শিল্পক্ষেত্রে ব্যবহার",
                ]),
            ]),
            ("P2", None, [
                ("Water", [
                    "পানির বৈশিষ্ট্য",
                    "গলনাঙ্ক ও স্ফুটনাঙ্ক",
                    "পানির গঠন ও Hydrogen Bonding",
                    "বাংলাদেশের মিঠাপানির উৎস",
                    "Water Quality Parameters",
                    "Dissolved Oxygen ও Salinity",
                    "Water Recycling",
                    "পানি বিশুদ্ধকরণ",
                    "পানি দূষণের কারণ ও প্রভাব",
                    "পানি সংরক্ষণ",
                ]),
                ("Natural Resources", [
                    "মাটি ও মাটির ধরন",
                    "Soil pH ও Soil Pollution",
                    "Natural Gas",
                    "Petroleum ও Coal",
                    "প্রাকৃতিক সম্পদের ব্যবহার ও সংরক্ষণ",
                    "বনসম্পদ",
                ]),
                ("Atmosphere", [
                    "Biosphere ও Hydrosphere",
                    "Ionosphere",
                    "Oxygen, Carbon Dioxide ও Nitrogen",
                    "Potable ও Polluted Water",
                    "Pasteurization",
                ]),
            ]),
            ("P3", None, [
                ("Polymer", [
                    "Natural ও Synthetic Polymer",
                    "Polymerization",
                    "Polymer-এর উৎস ও ব্যবহার",
                    "Fiber, Silk, Wool, Nylon ও Rayon",
                    "Rubber ও Plastic",
                    "পরিবেশে Rubber ও Plastic-এর প্রভাব",
                ]),
                ("Food and Nutrition", [
                    "খাদ্যের উপাদান",
                    "Carbohydrates",
                    "Protein",
                    "Fats and Lipids",
                    "Vitamins",
                    "খাদ্যের উৎস ও পুষ্টিগুণ",
                ]),
            ]),
            ("P4", None, [
                ("প্রযুক্তি ও বিজ্ঞানভিত্তিক প্রয়োগ", [
                    "দৈনন্দিন জীবনে বিজ্ঞান",
                    "শিল্প ও প্রযুক্তিতে বিজ্ঞানের ব্যবহার",
                    "আধুনিক প্রযুক্তির সামাজিক ও অর্থনৈতিক প্রভাব",
                    "বিজ্ঞান ও প্রযুক্তির সমসাময়িক প্রয়োগ",
                ]),
            ]),
        ],
    },
]

# Bands whose content the user flagged as not yet fully verified against the
# official PDF. Rows carry `provisional: true` so the UI can label them.
PROVISIONAL_BANDS = {("general-science", "P4")}


# --------------------------------------------------------------------------
# Derived structure
# --------------------------------------------------------------------------
def units(subject) -> list[dict]:
    """Flatten a subject into ordered (band, topic) study units, P1 → P4."""
    out = []
    for band, band_marks, topics in subject["bands"]:
        for topic_bn, subtopics in topics:
            out.append(
                {
                    "band": band,
                    "band_marks": band_marks,
                    "topic_bn": topic_bn,
                    "subtopics": subtopics,
                }
            )
    return out


def validate() -> None:
    assert sum(s["marks"] for s in SUBJECTS) == TOTAL_MARKS, "paper marks must total 900"

    slugs = [s["slug"] for s in SUBJECTS]
    assert len(slugs) == len(set(slugs)), "duplicate subject slug"

    for subject in SUBJECTS:
        seen = set()
        for band, _marks, topics in subject["bands"]:
            assert band in ("P1", "P2", "P3", "P4"), band
            for topic_bn, subtopics in topics:
                assert topic_bn.strip(), "empty topic"
                assert subtopics, f"topic without subtopics: {topic_bn}"
                for sub in subtopics:
                    assert sub.strip(), f"empty subtopic in {topic_bn}"
                    # A duplicate (topic, subtopic) pair would collide on the
                    # (topic_id, slug) unique index once slugs are generated.
                    assert (topic_bn, sub) not in seen, f"duplicate: {topic_bn} / {sub}"
                    seen.add((topic_bn, sub))

        # Band marks, where given, must add up to the paper's mark.
        marked = [m for _b, m, _t in subject["bands"] if m is not None]
        if marked:
            assert sum(marked) == subject["marks"], (
                f"{subject['slug']}: band marks {sum(marked)} != {subject['marks']}"
            )


def topic_count() -> int:
    return sum(len(units(s)) for s in SUBJECTS)


def subtopic_count() -> int:
    return sum(len(u["subtopics"]) for s in SUBJECTS for u in units(s))


if __name__ == "__main__":
    validate()
    print("validation passed")
    print(f"subjects:  {len(SUBJECTS)}")
    print(f"marks:     {sum(s['marks'] for s in SUBJECTS)}")
    print(f"topics:    {topic_count()}")
    print(f"subtopics: {subtopic_count()}")
    for s in SUBJECTS:
        print(
            f"  {s['slug']:<22} marks {s['marks']:>3}  "
            f"topics {len(units(s)):>2}  subtopics {sum(len(u['subtopics']) for u in units(s)):>3}"
        )
