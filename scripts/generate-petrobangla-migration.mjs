#!/usr/bin/env node
/**
 * Generates supabase/migrations/20261130000000_prep_programs_petrobangla.sql
 *
 * Deterministic seed for the Petrobangla Assistant Engineer (EEE) 30-day
 * preparation program. The taxonomy below is a PROVISIONAL study framework
 * authored for preparation purposes — it is NOT an official Petrobangla
 * syllabus and the migration labels it as such. No exam pattern, marks
 * distribution or question counts are invented anywhere.
 *
 * Run: node scripts/generate-petrobangla-migration.mjs
 */
import { writeFileSync } from "node:fs";

const COURSE_SLUG = "petrobangla-ae-eee";
const START = new Date(Date.UTC(2026, 10, 24)); // Day 1 = 2026-11-24

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const dateOf = (day) => {
  const d = new Date(START.getTime() + (day - 1) * 86400000);
  return d.toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Taxonomy: [slug, title_en, title_bn, group, topics[]]
// topic: [slug, title_en, title_bn, subtopics[]]; subtopic: [slug, en, bn]
// ---------------------------------------------------------------------------
const T = (slug, en, bn, subs = []) => ({ slug, en, bn, subs });
const S = (slug, en, bn) => ({ slug, en, bn });

const SUBJECTS = [
  // ---- Technical (17) ----
  {
    slug: "circuit-theory", en: "Electrical Circuit Theory", bn: "ইলেকট্রিক্যাল সার্কিট তত্ত্ব", grp: "technical",
    topics: [
      T("dc-fundamentals", "DC Circuit Fundamentals", "ডিসি সার্কিট মৌলিক", [
        S("ohms-law-resistance", "Ohm's Law & Resistance Combinations", "ও'মের সূত্র ও রোধের সংযোগ"),
        S("kvl-kcl", "KVL & KCL", "KVL ও KCL"),
        S("source-transformation", "Source Transformation", "সোর্স ট্রান্সফরমেশন"),
      ]),
      T("network-theorems", "Network Theorems", "নেটওয়ার্ক উপপাদ্য", [
        S("thevenin-norton", "Thevenin & Norton Theorems", "থেভেনিন ও নর্টন উপপাদ্য"),
        S("superposition", "Superposition Theorem", "সুপারপজিশন উপপাদ্য"),
        S("max-power-transfer", "Maximum Power Transfer", "সর্বোচ্চ পাওয়ার ট্রান্সফার"),
      ]),
      T("transients", "Circuit Transients", "সার্কিট ট্রানজিয়েন্ট", [
        S("rl-rc-transients", "RL & RC Transients", "RL ও RC ট্রানজিয়েন্ট"),
        S("rlc-transients", "RLC Transients", "RLC ট্রানজিয়েন্ট"),
      ]),
    ],
  },
  {
    slug: "ac-circuits", en: "AC Circuit Analysis", bn: "এসি সার্কিট বিশ্লেষণ", grp: "technical",
    topics: [
      T("sinusoidal-basics", "Sinusoidal Basics & Phasors", "সাইনুসয়েডাল মৌলিক ও ফেজর", [
        S("rms-average", "RMS & Average Values", "RMS ও গড় মান"),
        S("phasors-impedance", "Phasors & Complex Impedance", "ফেজর ও জটিল ইম্পিড্যান্স"),
      ]),
      T("ac-power", "AC Power", "এসি পাওয়ার", [
        S("power-types", "Active, Reactive & Apparent Power", "অ্যাকটিভ, রিঅ্যাকটিভ ও আপাত পাওয়ার"),
        S("pf-correction", "Power Factor Correction", "পাওয়ার ফ্যাক্টর সংশোধন"),
      ]),
      T("resonance-polyphase", "Resonance & Three-Phase Systems", "রেজোন্যান্স ও থ্রি-ফেজ সিস্টেম", [
        S("series-parallel-resonance", "Series & Parallel Resonance", "সিরিজ ও প্যারালাল রেজোন্যান্স"),
        S("three-phase-star-delta", "Three-Phase Star-Delta Systems", "থ্রি-ফেজ স্টার-ডেল্টা সিস্টেম"),
      ]),
    ],
  },
  {
    slug: "machines-fundamentals", en: "Electrical Machines Fundamentals", bn: "ইলেকট্রিক্যাল মেশিন মৌলিক", grp: "technical",
    topics: [
      T("energy-conversion", "Electromechanical Energy Conversion", "ইলেকট্রোমেকানিক্যাল শক্তি রূপান্তর", [
        S("magnetic-circuits", "Magnetic Circuits", "চৌম্বক বর্তনী"),
        S("emf-torque", "Induced EMF & Torque Production", "আবিষ্ট EMF ও টর্ক উৎপাদন"),
      ]),
      T("windings-losses", "Windings & Losses", "ওয়াইন্ডিং ও লস", [
        S("winding-basics", "Winding Basics", "ওয়াইন্ডিং মৌলিক"),
        S("losses-efficiency", "Losses & Efficiency", "লস ও দক্ষতা"),
      ]),
    ],
  },
  {
    slug: "transformer", en: "Transformer", bn: "ট্রান্সফরমার", grp: "technical",
    topics: [
      T("principles", "Transformer Principles", "ট্রান্সফরমার নীতি", [
        S("working-emf-equation", "Working Principle & EMF Equation", "কার্যনীতি ও EMF সমীকরণ"),
        S("equivalent-circuit", "Equivalent Circuit", "সমতুল্য বর্তনী"),
        S("phasor-diagram", "Phasor Diagram", "ফেজর ডায়াগ্রাম"),
      ]),
      T("performance", "Transformer Performance", "ট্রান্সফরমার পারফরম্যান্স", [
        S("oc-sc-tests", "OC & SC Tests", "OC ও SC পরীক্ষা"),
        S("voltage-regulation", "Voltage Regulation", "ভোল্টেজ রেগুলেশন"),
        S("efficiency-all-day", "Efficiency & All-Day Efficiency", "দক্ষতা ও সারাদিনের দক্ষতা"),
      ]),
      T("three-phase-special", "Three-Phase & Special Transformers", "থ্রি-ফেজ ও বিশেষ ট্রান্সফরমার", [
        S("vector-groups-parallel", "Vector Groups & Parallel Operation", "ভেক্টর গ্রুপ ও সমান্তরাল চালনা"),
        S("auto-instrument", "Auto-Transformer & Instrument Transformers", "অটো-ট্রান্সফরমার ও ইনস্ট্রুমেন্ট ট্রান্সফরমার"),
      ]),
    ],
  },
  {
    slug: "dc-machines", en: "DC Machines", bn: "ডিসি মেশিন", grp: "technical",
    topics: [
      T("dc-generator", "DC Generator", "ডিসি জেনারেটর", [
        S("construction-emf", "Construction & EMF Equation", "গঠন ও EMF সমীকরণ"),
        S("armature-commutation", "Armature Reaction & Commutation", "আর্মেচার রিঅ্যাকশন ও কম্যুটেশন"),
        S("generator-characteristics", "Generator Characteristics", "জেনারেটর বৈশিষ্ট্য"),
      ]),
      T("dc-motor", "DC Motor", "ডিসি মোটর", [
        S("torque-speed", "Torque & Speed Equations", "টর্ক ও গতি সমীকরণ"),
        S("speed-control", "Speed Control Methods", "গতি নিয়ন্ত্রণ পদ্ধতি"),
        S("starting-braking", "Starting & Braking", "স্টার্টিং ও ব্রেকিং"),
      ]),
    ],
  },
  {
    slug: "induction-motor", en: "Induction Motor", bn: "ইন্ডাকশন মোটর", grp: "technical",
    topics: [
      T("three-phase-im", "Three-Phase Induction Motor", "থ্রি-ফেজ ইন্ডাকশন মোটর", [
        S("rotating-field", "Rotating Magnetic Field", "ঘূর্ণায়মান চৌম্বক ক্ষেত্র"),
        S("slip-torque", "Slip & Torque-Slip Characteristics", "স্লিপ ও টর্ক-স্লিপ বৈশিষ্ট্য"),
        S("im-equivalent-circuit", "Equivalent Circuit", "সমতুল্য বর্তনী"),
      ]),
      T("im-operation", "Induction Motor Operation", "ইন্ডাকশন মোটর চালনা", [
        S("starting-methods", "Starting Methods", "স্টার্টিং পদ্ধতি"),
        S("im-speed-control", "Speed Control", "গতি নিয়ন্ত্রণ"),
        S("single-phase-im", "Single-Phase Induction Motors", "সিঙ্গেল-ফেজ ইন্ডাকশন মোটর"),
      ]),
    ],
  },
  {
    slug: "synchronous-machines", en: "Synchronous Machines", bn: "সিনক্রোনাস মেশিন", grp: "technical",
    topics: [
      T("alternator", "Alternator", "অল্টারনেটর", [
        S("alt-emf-winding", "EMF Equation & Winding Factors", "EMF সমীকরণ ও ওয়াইন্ডিং ফ্যাক্টর"),
        S("alt-voltage-regulation", "Voltage Regulation (Synchronous Impedance)", "ভোল্টেজ রেগুলেশন (সিনক্রোনাস ইম্পিড্যান্স)"),
        S("alt-parallel", "Parallel Operation", "সমান্তরাল চালনা"),
      ]),
      T("synchronous-motor", "Synchronous Motor", "সিনক্রোনাস মোটর", [
        S("sm-operation-starting", "Operation Principle & Starting", "কার্যনীতি ও স্টার্টিং"),
        S("v-curves-pf", "V-Curves & Power Factor Correction", "V-কার্ভ ও পাওয়ার ফ্যাক্টর সংশোধন"),
      ]),
    ],
  },
  {
    slug: "power-generation", en: "Power Generation", bn: "বিদ্যুৎ উৎপাদন", grp: "technical",
    topics: [
      T("conventional-plants", "Conventional Power Plants", "প্রচলিত বিদ্যুৎকেন্দ্র", [
        S("thermal-plant", "Thermal Power Plant", "তাপবিদ্যুৎ কেন্দ্র"),
        S("gas-combined-cycle", "Gas Turbine & Combined Cycle", "গ্যাস টারবাইন ও কম্বাইন্ড সাইকেল"),
        S("hydro-plant", "Hydroelectric Plant", "জলবিদ্যুৎ কেন্দ্র"),
      ]),
      T("nuclear-renewables", "Nuclear & Renewable Energy", "পারমাণবিক ও নবায়নযোগ্য শক্তি", [
        S("nuclear-basics", "Nuclear Power Basics", "পারমাণবিক বিদ্যুৎ মৌলিক"),
        S("solar-wind", "Solar & Wind Power", "সৌর ও বায়ু বিদ্যুৎ"),
      ]),
      T("generation-economics", "Generation Economics", "উৎপাদন অর্থনীতি", [
        S("load-curves", "Load Curves & Load Factor", "লোড কার্ভ ও লোড ফ্যাক্টর"),
        S("tariffs", "Tariffs", "ট্যারিফ"),
      ]),
    ],
  },
  {
    slug: "transmission-distribution", en: "Power Transmission & Distribution", bn: "বিদ্যুৎ সঞ্চালন ও বিতরণ", grp: "technical",
    topics: [
      T("line-parameters", "Transmission Line Parameters", "সঞ্চালন লাইন প্যারামিটার", [
        S("rlc-parameters", "Resistance, Inductance & Capacitance", "রোধ, ইন্ডাকট্যান্স ও ক্যাপাসিট্যান্স"),
        S("line-models", "Short, Medium & Long Line Models", "শর্ট, মিডিয়াম ও লং লাইন মডেল"),
      ]),
      T("line-performance", "Line Performance", "লাইন পারফরম্যান্স", [
        S("regulation-efficiency", "Voltage Regulation & Efficiency", "ভোল্টেজ রেগুলেশন ও দক্ষতা"),
        S("corona-ferranti", "Corona & Ferranti Effect", "করোনা ও ফেরান্টি ইফেক্ট"),
        S("sag-insulators", "Sag & Insulators", "স্যাগ ও ইনসুলেটর"),
      ]),
      T("distribution-systems", "Distribution Systems", "বিতরণ ব্যবস্থা", [
        S("radial-ring", "Radial & Ring Systems", "রেডিয়াল ও রিং সিস্টেম"),
        S("cables-underground", "Cables & Underground Distribution", "ক্যাবল ও ভূগর্ভস্থ বিতরণ"),
      ]),
    ],
  },
  {
    slug: "power-system-analysis", en: "Power System Analysis", bn: "পাওয়ার সিস্টেম বিশ্লেষণ", grp: "technical",
    topics: [
      T("per-unit-load-flow", "Per-Unit System & Load Flow", "পার-ইউনিট সিস্টেম ও লোড ফ্লো", [
        S("per-unit", "Per-Unit System", "পার-ইউনিট সিস্টেম"),
        S("load-flow-basics", "Load Flow Basics (GS/NR)", "লোড ফ্লো মৌলিক (GS/NR)"),
      ]),
      T("fault-analysis", "Fault Analysis", "ফল্ট বিশ্লেষণ", [
        S("symmetrical-faults", "Symmetrical Faults", "প্রতিসম ফল্ট"),
        S("unsymmetrical-faults", "Symmetrical Components & Unsymmetrical Faults", "প্রতিসম উপাদান ও অপ্রতিসম ফল্ট"),
      ]),
      T("stability", "Power System Stability", "পাওয়ার সিস্টেম স্থিতিশীলতা", [
        S("swing-equation", "Swing Equation", "সুইং সমীকরণ"),
        S("equal-area", "Equal-Area Criterion", "ইকুয়াল-এরিয়া ক্রাইটেরিয়ন"),
      ]),
    ],
  },
  {
    slug: "protection-switchgear", en: "Protection & Switchgear", bn: "প্রোটেকশন ও সুইচগিয়ার", grp: "technical",
    topics: [
      T("relays", "Protective Relays", "প্রোটেকটিভ রিলে", [
        S("relay-types", "Electromagnetic & Static Relays", "ইলেকট্রোম্যাগনেটিক ও স্ট্যাটিক রিলে"),
        S("distance-differential", "Distance & Differential Protection", "ডিস্ট্যান্স ও ডিফারেনশিয়াল প্রোটেকশন"),
      ]),
      T("circuit-breakers", "Circuit Breakers", "সার্কিট ব্রেকার", [
        S("arc-interruption", "Arc Interruption Theory", "আর্ক নির্বাপণ তত্ত্ব"),
        S("breaker-types", "SF6, Vacuum & Air Breakers", "SF6, ভ্যাকুয়াম ও এয়ার ব্রেকার"),
        S("breaker-ratings", "Breaker Ratings & Testing", "ব্রেকার রেটিং ও পরীক্ষা"),
      ]),
      T("system-protection", "System Protection & Earthing", "সিস্টেম প্রোটেকশন ও আর্থিং", [
        S("equipment-protection", "Generator, Transformer & Line Protection", "জেনারেটর, ট্রান্সফরমার ও লাইন প্রোটেকশন"),
        S("grounding-earthing", "Grounding & Earthing", "গ্রাউন্ডিং ও আর্থিং"),
      ]),
    ],
  },
  {
    slug: "power-electronics-eee", en: "Power Electronics", bn: "পাওয়ার ইলেকট্রনিক্স", grp: "technical",
    topics: [
      T("pe-devices", "Power Semiconductor Devices", "পাওয়ার সেমিকন্ডাক্টর ডিভাইস", [
        S("scr-thyristor", "SCR Characteristics & Triggering", "SCR বৈশিষ্ট্য ও ট্রিগারিং"),
        S("mosfet-igbt", "Power MOSFET & IGBT", "পাওয়ার MOSFET ও IGBT"),
      ]),
      T("converters", "Converters", "কনভার্টার", [
        S("rectifiers", "Controlled & Uncontrolled Rectifiers", "নিয়ন্ত্রিত ও অনিয়ন্ত্রিত রেক্টিফায়ার"),
        S("inverters", "Inverters", "ইনভার্টার"),
        S("choppers-regulators", "Choppers & AC Voltage Regulators", "চপার ও এসি ভোল্টেজ রেগুলেটর"),
      ]),
    ],
  },
  {
    slug: "control-systems", en: "Control Systems", bn: "কন্ট্রোল সিস্টেম", grp: "technical",
    topics: [
      T("modeling", "System Modeling", "সিস্টেম মডেলিং", [
        S("transfer-function", "Transfer Function & Block Diagrams", "ট্রান্সফার ফাংশন ও ব্লক ডায়াগ্রাম"),
        S("signal-flow", "Signal Flow Graphs (Mason's Rule)", "সিগন্যাল ফ্লো গ্রাফ (মেসনের সূত্র)"),
      ]),
      T("response-analysis", "Time & Frequency Response", "টাইম ও ফ্রিকোয়েন্সি রেসপন্স", [
        S("time-response", "Time-Domain Specs & Steady-State Error", "টাইম-ডোমেইন স্পেক ও স্টেডি-স্টেট এরর"),
        S("bode-nyquist", "Bode & Nyquist Plots", "বোডে ও নাইকুইস্ট প্লট"),
        S("root-locus", "Root Locus", "রুট লোকাস"),
      ]),
      T("stability-controllers", "Stability & Controllers", "স্থিতিশীলতা ও কন্ট্রোলার", [
        S("routh-hurwitz", "Routh-Hurwitz Criterion", "রাউথ-হারভিৎস ক্রাইটেরিয়ন"),
        S("pid-compensators", "PID Controllers & Compensators", "PID কন্ট্রোলার ও কমপেনসেটর"),
      ]),
    ],
  },
  {
    slug: "analog-electronics", en: "Analog Electronics", bn: "অ্যানালগ ইলেকট্রনিক্স", grp: "technical",
    topics: [
      T("diodes", "Diodes & Applications", "ডায়োড ও প্রয়োগ", [
        S("diode-rectifiers", "Diode Characteristics & Rectifiers", "ডায়োড বৈশিষ্ট্য ও রেক্টিফায়ার"),
        S("zener-regulators", "Zener Diode & Voltage Regulators", "জেনার ডায়োড ও ভোল্টেজ রেগুলেটর"),
      ]),
      T("transistors", "Transistor Circuits", "ট্রানজিস্টর সার্কিট", [
        S("bjt-biasing-amp", "BJT Biasing & Amplifiers", "BJT বায়াসিং ও অ্যামপ্লিফায়ার"),
        S("fet-amplifiers", "FET/MOSFET Amplifiers", "FET/MOSFET অ্যামপ্লিফায়ার"),
      ]),
      T("opamps", "Operational Amplifiers", "অপারেশনাল অ্যামপ্লিফায়ার", [
        S("opamp-configs", "Ideal Op-Amp & Configurations", "আদর্শ অপ-অ্যাম্প ও কনফিগারেশন"),
        S("oscillators-filters", "Oscillators & Active Filters", "অসিলেটর ও অ্যাকটিভ ফিল্টার"),
      ]),
    ],
  },
  {
    slug: "digital-electronics", en: "Digital Electronics", bn: "ডিজিটাল ইলেকট্রনিক্স", grp: "technical",
    topics: [
      T("number-gates", "Number Systems & Logic Gates", "সংখ্যা পদ্ধতি ও লজিক গেট", [
        S("number-systems", "Number Systems & Codes", "সংখ্যা পদ্ধতি ও কোড"),
        S("gates-boolean", "Logic Gates & Boolean Algebra", "লজিক গেট ও বুলিয়ান বীজগণিত"),
        S("kmap", "K-Map Minimization", "K-ম্যাপ সরলীকরণ"),
      ]),
      T("combinational-sequential", "Combinational & Sequential Circuits", "কম্বিনেশনাল ও সিকোয়েনশিয়াল সার্কিট", [
        S("adders-mux", "Adders, MUX & Decoders", "অ্যাডার, MUX ও ডিকোডার"),
        S("flipflops-counters", "Flip-Flops, Counters & Registers", "ফ্লিপ-ফ্লপ, কাউন্টার ও রেজিস্টার"),
      ]),
      T("converters-memory", "Converters & Memory", "কনভার্টার ও মেমরি", [
        S("adc-dac", "ADC & DAC", "ADC ও DAC"),
        S("memory-microprocessor", "Memory & Microprocessor Basics", "মেমরি ও মাইক্রোপ্রসেসর মৌলিক"),
      ]),
    ],
  },
  {
    slug: "measurements", en: "Electrical Measurements", bn: "ইলেকট্রিক্যাল পরিমাপ", grp: "technical",
    topics: [
      T("instruments", "Measuring Instruments", "পরিমাপ যন্ত্র", [
        S("pmmc-mi", "PMMC & MI Instruments", "PMMC ও MI যন্ত্র"),
        S("wattmeter-energy", "Wattmeter & Energy Meter", "ওয়াটমিটার ও এনার্জি মিটার"),
      ]),
      T("bridges-transducers", "Bridges & Transducers", "ব্রিজ ও ট্রান্সডিউসার", [
        S("ac-dc-bridges", "AC & DC Bridges", "এসি ও ডিসি ব্রিজ"),
        S("transducers-cro", "Transducers & CRO", "ট্রান্সডিউসার ও CRO"),
      ]),
    ],
  },
  {
    slug: "installation-safety", en: "Electrical Installation & Safety", bn: "ইলেকট্রিক্যাল ইনস্টলেশন ও নিরাপত্তা", grp: "technical",
    topics: [
      T("wiring-earthing", "Wiring & Earthing", "ওয়্যারিং ও আর্থিং", [
        S("house-wiring", "House Wiring Systems & Estimation", "হাউস ওয়্যারিং সিস্টেম ও প্রাক্কলন"),
        S("earthing-systems", "Earthing Systems", "আর্থিং সিস্টেম"),
      ]),
      T("safety-practice", "Electrical Safety", "বৈদ্যুতিক নিরাপত্তা", [
        S("safety-practices", "Electrical Safety Practices", "বৈদ্যুতিক নিরাপত্তা চর্চা"),
        S("protective-devices", "Protective Devices (MCB/RCD)", "প্রোটেকটিভ ডিভাইস (MCB/RCD)"),
      ]),
    ],
  },
  // ---- General (10) ----
  {
    slug: "pb-bangla", en: "Bangla", bn: "বাংলা", grp: "general",
    topics: [
      T("byakaran", "Bangla Grammar", "বাংলা ব্যাকরণ", [
        S("dhvani-shabda", "Sounds & Words", "ধ্বনি ও শব্দ"),
        S("bakya-proyog", "Sentence & Usage", "বাক্য ও প্রয়োগ"),
      ]),
      T("sahitya", "Bangla Literature", "বাংলা সাহিত্য", [
        S("prachin-madhya", "Ancient & Medieval Period", "প্রাচীন ও মধ্যযুগ"),
        S("adhunik", "Modern Period", "আধুনিক যুগ"),
      ]),
    ],
  },
  {
    slug: "pb-english", en: "English", bn: "ইংরেজি", grp: "general",
    topics: [
      T("grammar", "English Grammar", "ইংরেজি গ্রামার", [
        S("parts-agreement", "Parts of Speech & Agreement", "Parts of Speech ও Agreement"),
        S("tense-voice-narration", "Tense, Voice & Narration", "Tense, Voice ও Narration"),
      ]),
      T("vocab-composition", "Vocabulary & Composition", "শব্দভান্ডার ও রচনা", [
        S("synonyms-idioms", "Synonyms, Antonyms & Idioms", "Synonyms, Antonyms ও Idioms"),
        S("correction-translation", "Sentence Correction & Translation", "Sentence Correction ও Translation"),
      ]),
    ],
  },
  {
    slug: "pb-math", en: "Mathematics", bn: "গণিত", grp: "general",
    topics: [
      T("arithmetic", "Arithmetic", "পাটিগণিত", [
        S("percentage-interest", "Percentage, Profit-Loss & Interest", "শতকরা, লাভ-ক্ষতি ও সুদ"),
        S("ratio-mixture", "Ratio & Mixtures", "অনুপাত ও মিশ্রণ"),
        S("speed-time-work", "Speed, Time & Work", "গতি, সময় ও কাজ"),
      ]),
      T("algebra-geometry", "Algebra & Geometry", "বীজগণিত ও জ্যামিতি", [
        S("equations-series", "Equations & Series", "সমীকরণ ও ধারা"),
        S("geometry-mensuration", "Geometry & Mensuration", "জ্যামিতি ও পরিমিতি"),
      ]),
    ],
  },
  {
    slug: "pb-bangladesh", en: "Bangladesh Affairs", bn: "বাংলাদেশ বিষয়াবলি", grp: "general",
    topics: [
      T("history-liberation", "History & Liberation War", "ইতিহাস ও মুক্তিযুদ্ধ", [
        S("bhasha-muktijuddho", "Language Movement & Liberation War", "ভাষা আন্দোলন ও মুক্তিযুদ্ধ"),
        S("constitution", "Constitution of Bangladesh", "বাংলাদেশের সংবিধান"),
      ]),
      T("economy-geography", "Economy & Geography", "অর্থনীতি ও ভূগোল", [
        S("economy-development", "Economy & Development", "অর্থনীতি ও উন্নয়ন"),
        S("geography-admin", "Geography & Administration", "ভূগোল ও প্রশাসন"),
      ]),
    ],
  },
  {
    slug: "pb-international", en: "International Affairs", bn: "আন্তর্জাতিক বিষয়াবলি", grp: "general",
    topics: [
      T("organizations", "International Organizations", "আন্তর্জাতিক সংস্থা", [
        S("un-agencies", "United Nations & Agencies", "জাতিসংঘ ও সংস্থাসমূহ"),
        S("regional-blocs", "Regional Blocs", "আঞ্চলিক জোট"),
      ]),
      T("geopolitics-environment", "Geopolitics & Environment", "ভূরাজনীতি ও পরিবেশ", [
        S("geopolitics", "Contemporary Geopolitics", "সমকালীন ভূরাজনীতি"),
        S("climate-agreements", "Climate Agreements", "জলবায়ু চুক্তি"),
      ]),
    ],
  },
  {
    slug: "pb-science", en: "General Science", bn: "সাধারণ বিজ্ঞান", grp: "general",
    topics: [
      T("physical-science", "Physical Science", "ভৌত বিজ্ঞান", [
        S("force-energy", "Force & Energy", "বল ও শক্তি"),
        S("electricity-magnetism", "Electricity & Magnetism", "তড়িৎ ও চুম্বকত্ব"),
      ]),
      T("life-chemistry", "Life Science & Chemistry", "জীববিজ্ঞান ও রসায়ন", [
        S("biology-basics", "Biology Basics", "জীববিজ্ঞান মৌলিক"),
        S("chemistry-basics", "Chemistry Basics", "রসায়ন মৌলিক"),
      ]),
    ],
  },
  {
    slug: "pb-ict", en: "ICT", bn: "আইসিটি", grp: "general",
    topics: [
      T("computer-basics", "Computer Basics", "কম্পিউটার মৌলিক", [
        S("hardware-software", "Hardware & Software", "হার্ডওয়্যার ও সফটওয়্যার"),
        S("operating-systems", "Operating Systems", "অপারেটিং সিস্টেম"),
      ]),
      T("network-security", "Networks & Security", "নেটওয়ার্ক ও নিরাপত্তা", [
        S("internet-networking", "Internet & Networking", "ইন্টারনেট ও নেটওয়ার্কিং"),
        S("cyber-security", "Cyber Security", "সাইবার নিরাপত্তা"),
      ]),
    ],
  },
  {
    slug: "pb-current-affairs", en: "Current Affairs", bn: "সাম্প্রতিক বিষয়াবলি", grp: "general",
    topics: [
      T("current-bd", "Recent Bangladesh Affairs", "সাম্প্রতিক বাংলাদেশ", []),
      T("current-intl", "Recent International Affairs", "সাম্প্রতিক আন্তর্জাতিক", []),
    ],
  },
  {
    slug: "pb-energy-sector", en: "Bangladesh Energy Sector", bn: "বাংলাদেশ জ্বালানি খাত", grp: "general",
    topics: [
      T("energy-infrastructure", "Energy Infrastructure", "জ্বালানি অবকাঠামো", [
        S("power-situation", "Power Generation Situation", "বিদ্যুৎ উৎপাদন পরিস্থিতি"),
        S("gas-fields-lng", "Gas Fields & LNG", "গ্যাসক্ষেত্র ও এলএনজি"),
      ]),
      T("energy-policy-orgs", "Energy Policy & Organizations", "জ্বালানি নীতি ও সংস্থা", [
        S("energy-policy", "Energy Policy", "জ্বালানি নীতি"),
        S("sector-organizations", "Sector Organizations", "খাত-সংশ্লিষ্ট সংস্থাসমূহ"),
      ]),
    ],
  },
  {
    slug: "pb-petrobangla", en: "Petrobangla Awareness", bn: "পেট্রোবাংলা পরিচিতি", grp: "general",
    topics: [
      T("petrobangla-profile", "Petrobangla Profile", "পেট্রোবাংলা প্রোফাইল", [
        S("history-activities", "History & Activities", "ইতিহাস ও কার্যক্রম"),
        S("subsidiary-companies", "Subsidiary Companies", "অঙ্গ কোম্পানিসমূহ"),
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// 30-day calendar (prompt §5/§6). Day → technical subject slug(s).
// ---------------------------------------------------------------------------
const TECH_BY_DAY = {
  1: ["circuit-theory"], 2: ["circuit-theory"],
  3: ["ac-circuits"], 4: ["ac-circuits"],
  5: ["transformer"], 6: ["transformer"],
  8: ["machines-fundamentals"], 9: ["dc-machines"], 10: ["induction-motor"],
  11: ["synchronous-machines"], 12: ["power-generation"], 13: ["transmission-distribution"],
  15: ["transmission-distribution"], 16: ["power-system-analysis"], 17: ["power-system-analysis"],
  18: ["protection-switchgear"],
  19: ["power-electronics-eee"], 20: ["power-electronics-eee"],
  22: ["control-systems"], 23: ["control-systems"],
  24: ["analog-electronics"], 25: ["digital-electronics"],
  26: ["measurements", "installation-safety"],
};
const MOCK_DAYS = { 7: "সাপ্তাহিক মক ১", 14: "সাপ্তাহিক মক ২", 21: "সাপ্তাহিক মক ৩", 27: "সাপ্তাহিক মক ৪" };
const GK_ROTATION = [
  "pb-bangladesh", "pb-international", "pb-science", "pb-ict",
  "pb-current-affairs", "pb-energy-sector", "pb-petrobangla",
];

const WRITTEN_NOTE =
  "লিখিত অনুশীলন (কনফিগারযোগ্য লক্ষ্য): ৫টি টেকনিক্যাল লিখিত প্রশ্ন, ৩টি নিউমেরিক্যাল (প্রদত্ত-সূত্র-ধাপ-একক-চূড়ান্ত উত্তর), ১টি ডেরিভেশন, ১টি ডায়াগ্রামভিত্তিক প্রশ্ন";
const MOCK_NOTE =
  "প্রশ্নব্যাংকে যাচাইকৃত ও অনুমোদিত EEE প্রশ্ন যুক্ত হওয়ার পর অ্যাডমিন এই মকের পেপার কনফিগার করবেন — কোনো অফিসিয়াল প্যাটার্ন/মার্কস অনুমান করা হয়নি";

const bnName = Object.fromEntries(SUBJECTS.map((s) => [s.slug, s.bn]));

// Build routine rows: [day, subjectSlug|null, title_bn, minutes, note|null, task_kind]
const routineRows = [];
let studyDayIndex = 0;
for (let day = 1; day <= 30; day += 1) {
  if (MOCK_DAYS[day]) {
    routineRows.push([day, null, `${MOCK_DAYS[day]} — পরীক্ষার দিন`, 180, MOCK_NOTE, "exam"]);
    continue;
  }
  if (day === 28) {
    routineRows.push([day, null, "টেকনিক্যাল রিভিশন — দুর্বল টপিক, ভুল প্রশ্ন ও কঠিন নিউমেরিক্যাল অগ্রাধিকার", 360, null, "revision"]);
    continue;
  }
  if (day === 29) {
    routineRows.push([day, null, "সাধারণ রিভিশন + লিখিত অনুশীলন + ভাইভা প্রস্তুতি", 360, null, "revision"]);
    continue;
  }
  if (day === 30) {
    routineRows.push([day, null, "ফাইনাল ফুল-লেংথ মক", 240, MOCK_NOTE, "exam"]);
    continue;
  }

  const techs = TECH_BY_DAY[day];
  if (!techs) throw new Error(`day ${day} has no plan`);
  const techMinutes = techs.length === 1 ? [180] : [90, 90];
  techs.forEach((slug, i) => {
    routineRows.push([
      day, slug,
      `টেকনিক্যাল: ${bnName[slug]} — থিওরি + নিউমেরিক্যাল`,
      techMinutes[i], WRITTEN_NOTE, "study",
    ]);
  });
  routineRows.push([day, "pb-math", "গণিত অনুশীলন", 45, null, "study"]);
  routineRows.push([day, "pb-english", "ইংরেজি অনুশীলন (লিখিত অনুশীলনসহ)", 30, null, "study"]);
  routineRows.push([day, "pb-bangla", "বাংলা অনুশীলন (লিখিত অনুশীলনসহ)", 30, null, "study"]);
  const gk = GK_ROTATION[studyDayIndex % GK_ROTATION.length];
  routineRows.push([day, gk, `জিকে ও জ্বালানি খাত: ${bnName[gk]}`, 45, null, "study"]);
  routineRows.push([day, null, "MCQ অনুশীলন + দৈনিক রিভিশন", 30, null, "revision"]);
  studyDayIndex += 1;
}

// Sanity: every study day totals 360 minutes.
for (let day = 1; day <= 30; day += 1) {
  const rows = routineRows.filter((r) => r[0] === day);
  if (TECH_BY_DAY[day]) {
    const total = rows.reduce((sum, r) => sum + r[3], 0);
    if (total !== 360) throw new Error(`day ${day} totals ${total} minutes, expected 360`);
  }
  if (rows.length === 0) throw new Error(`day ${day} empty`);
}

// Sanity: subject/date uniqueness (matches routines unique index with topic null).
const seen = new Set();
for (const [day, slug] of routineRows) {
  const key = `${day}:${slug ?? "null"}`;
  if (seen.has(key)) throw new Error(`duplicate slot ${key}`);
  seen.add(key);
}

// ---------------------------------------------------------------------------
// Emit SQL
// ---------------------------------------------------------------------------
const lines = [];
lines.push(`-- ============================================================================
-- JobHub — Preparation-program architecture + Petrobangla AE (EEE) 30-day plan
--
-- Master-prompt (multi-exam) §2, §5, §6:
--  * courses.program_kind classifies records as 'course' | 'job_prep' |
--    'question_collection' — ONE engine, no duplicate routine/question/exam
--    systems. Existing courses keep the default 'course'.
--  * student_programs: per-student multi-select of programs (onboarding),
--    owner-scoped RLS; selecting a program never touches other data.
--  * Seeds the Petrobangla Assistant Engineer (EEE) program: 27 subjects
--    (17 technical + 10 general), topic/subtopic taxonomy, and a 30-day
--    published routine (Day 1 = ${dateOf(1)}) following the prompt's
--    calendar (mocks on days 7/14/21/27, final mock day 30).
--
-- HONESTY NOTE: this taxonomy and calendar are a PROVISIONAL preparation
-- framework for study purposes — NOT an official Petrobangla syllabus or
-- exam pattern. The course metadata records this and the admin UI shows it.
-- Mock-day rows carry no question counts/marks: admins configure papers
-- only from verified, approved questions. Nothing existing is modified:
-- the BCS course, its 10/137/366 taxonomy and all data stay untouched.
--
-- Generated by scripts/generate-petrobangla-migration.mjs (deterministic).
-- Rollback: delete the course row (cascades to its subjects/topics/subtopics/
-- routines), drop table student_programs, drop column courses.program_kind.
-- ============================================================================

-- CHUNK:1 — classification column + student_programs
alter table public.courses
  add column if not exists program_kind text not null default 'course';
alter table public.courses
  drop constraint if exists courses_program_kind_check;
alter table public.courses
  add constraint courses_program_kind_check
  check (program_kind in ('course', 'job_prep', 'question_collection'));

create table if not exists public.student_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'hidden')),
  source text not null default 'self' check (source in ('self', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

alter table public.student_programs enable row level security;
alter table public.student_programs force row level security;

drop policy if exists "own program selections" on public.student_programs;
create policy "own program selections" on public.student_programs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "staff read program selections" on public.student_programs;
create policy "staff read program selections" on public.student_programs
  for select to authenticated using (public.jh_is_staff());

revoke all on public.student_programs from anon;
grant select, insert, update, delete on public.student_programs to authenticated;
grant all on public.student_programs to service_role;
`);

// Course
const courseMeta = {
  provisional: true,
  pattern_note:
    "প্রভিশনাল প্রস্তুতি-কাঠামো — অফিসিয়াল পেট্রোবাংলা সিলেবাস/প্যাটার্ন নয়; যাচাইকৃত নিয়োগ বিজ্ঞপ্তি বা অফিসিয়াল সিলেবাস পাওয়া গেলে সেটিই প্রাধান্য পাবে",
  daily_minutes: 360,
  day_structure: [
    { block: "টেকনিক্যাল থিওরি", minutes: 90 },
    { block: "টেকনিক্যাল নিউমেরিক্যাল", minutes: 90 },
    { block: "গণিত", minutes: 45 },
    { block: "ইংরেজি", minutes: 30 },
    { block: "বাংলা", minutes: 30 },
    { block: "জিকে ও জ্বালানি খাত", minutes: 45 },
    { block: "MCQ + রিভিশন", minutes: 30 },
  ],
  written_targets_eee: {
    technical_written: 5, numericals: 3, derivation: 1, diagram_based: 1,
    note: "কনফিগারযোগ্য অনুশীলন-লক্ষ্য — অফিসিয়াল পরীক্ষার শর্ত নয়",
  },
};

lines.push(`-- CHUNK:2 — Petrobangla AE (EEE) course + subjects
insert into public.courses
  (slug, title_en, title_bn, short_en, short_bn, summary_bn, level, icon, accent,
   duration_weeks, status, sort_order, program_kind, metadata)
values
  (${q(COURSE_SLUG)},
   'Petrobangla Assistant Engineer (EEE)',
   'পেট্রোবাংলা সহকারী প্রকৌশলী (EEE)',
   '30-day intensive EEE job preparation',
   '৩০ দিনের ইনটেনসিভ EEE চাকরি প্রস্তুতি',
   '১৭টি টেকনিক্যাল + ১০টি সাধারণ বিষয়ের টপিক-স্তরের ৩০ দিনের রুটিন, দৈনিক ৬ ঘণ্টা (কনফিগারযোগ্য)। প্রভিশনাল কাঠামো — অফিসিয়াল সিলেবাস নয়।',
   'advanced', 'zap', 'amber', 5, 'published', 20, 'job_prep',
   ${q(JSON.stringify(courseMeta))}::jsonb)
on conflict (slug) do nothing;
`);

// Subjects
const subjectValues = SUBJECTS.map((s, i) =>
  `  (${q(s.slug)}, ${q(s.en)}, ${q(s.bn)}, ${q(s.grp)}, ${s.grp === "technical" ? 3 : 1}, ${i + 1})`,
).join(",\n");
lines.push(`insert into public.subjects (course_id, slug, title_en, title_bn, chapter_group, weight, sort_order)
select c.id, v.slug, v.te, v.tb, v.grp, v.w, v.so
from (values
${subjectValues}
) as v(slug, te, tb, grp, w, so)
cross join (select id from public.courses where slug = ${q(COURSE_SLUG)}) c
on conflict (course_id, slug) do nothing;
`);

// Topics
const topicValues = [];
SUBJECTS.forEach((s) => {
  s.topics.forEach((t, ti) => {
    topicValues.push(`  (${q(s.slug)}, ${q(t.slug)}, ${q(t.en)}, ${q(t.bn)}, ${ti + 1})`);
  });
});
lines.push(`-- CHUNK:3 — topics + subtopics
insert into public.topics (subject_id, slug, title_en, title_bn, sort_order)
select s.id, v.tslug, v.te, v.tb, v.so
from (values
${topicValues.join(",\n")}
) as v(sslug, tslug, te, tb, so)
join public.subjects s
  on s.slug = v.sslug
 and s.course_id = (select id from public.courses where slug = ${q(COURSE_SLUG)})
on conflict (subject_id, slug) do nothing;
`);

// Subtopics
const subValues = [];
SUBJECTS.forEach((s) => {
  s.topics.forEach((t) => {
    t.subs.forEach((st, si) => {
      subValues.push(`  (${q(s.slug)}, ${q(t.slug)}, ${q(st.slug)}, ${q(st.en)}, ${q(st.bn)}, ${si + 1})`);
    });
  });
});
lines.push(`insert into public.subtopics (topic_id, slug, title_en, title_bn, sort_order)
select t.id, v.stslug, v.te, v.tb, v.so
from (values
${subValues.join(",\n")}
) as v(sslug, tslug, stslug, te, tb, so)
join public.subjects s
  on s.slug = v.sslug
 and s.course_id = (select id from public.courses where slug = ${q(COURSE_SLUG)})
join public.topics t on t.subject_id = s.id and t.slug = v.tslug
on conflict (topic_id, slug) do nothing;
`);

// Routine
const routineValues = routineRows.map(([day, slug, title, mins, note, tk]) =>
  `  (${q(dateOf(day))}, ${q(slug)}, ${q(title)}, ${mins}, ${q(note)}, ${q(tk)})`,
).join(",\n");
lines.push(`-- CHUNK:4 — 30-day published routine (Day 1 = ${dateOf(1)}, Day 30 = ${dateOf(30)})
insert into public.routines
  (course_id, kind, routine_date, title_bn, subject_id, topic_id, minutes, focus_note_bn, task_kind, status)
select c.id, 'daily', v.d::date, v.title, s.id, null, v.mins, v.note, v.tk, 'published'
from (values
${routineValues}
) as v(d, sslug, title, mins, note, tk)
cross join (select id from public.courses where slug = ${q(COURSE_SLUG)}) c
left join public.subjects s on s.course_id = c.id and s.slug = v.sslug
where v.sslug is null or s.id is not null
on conflict (course_id, kind, routine_date, subject_id, topic_id) do nothing;
`);

const sql = lines.join("\n");
const out = new URL("../supabase/migrations/20261130000000_prep_programs_petrobangla.sql", import.meta.url).pathname;
writeFileSync(out, sql);

const nTopics = SUBJECTS.reduce((n, s) => n + s.topics.length, 0);
const nSubs = SUBJECTS.reduce((n, s) => n + s.topics.reduce((m, t) => m + t.subs.length, 0), 0);
const nNoSub = SUBJECTS.reduce((n, s) => n + s.topics.filter((t) => t.subs.length === 0).length, 0);
console.log(`subjects=${SUBJECTS.length} topics=${nTopics} subtopics=${nSubs} units=${nSubs + nNoSub} routineRows=${routineRows.length}`);
console.log(`wrote ${out}`);
