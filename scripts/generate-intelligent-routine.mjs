#!/usr/bin/env node
/**
 * JobHub — Intelligent course-wise routine generator (master-prompt rebuild).
 *
 * Builds the day-wise routine SKELETON for each course independently:
 *   * BCS (60 days)         — 10 subjects run as parallel tracks; each
 *     subject's slots are spread evenly across the study days in proportion
 *     to its syllabus volume (units = subtopics + topics without subtopics),
 *     so the per-subject syllabus order stays strictly sequential while the
 *     week stays balanced. 4 subject-slots per study day.
 *   * Petrobangla AE EEE (30 days, intensive) — 20 technical subjects are
 *     poured SEQUENTIALLY in prerequisite order (circuit theory → machines →
 *     power system → electronics → control → installation), max 3 slots of
 *     one subject per day, 5 technical slots + 1 general slot per day.
 *
 * Shared calendar rules (both courses, same start date so that the
 * common-topic synchronizer can put genuinely common content on the SAME day):
 *   * Friday  = সাপ্তাহিক পরীক্ষা (weekly_special, exam) + সাপ্তাহিক রিভিশন.
 *   * Every study day ends with a short same-day/previous-day revision row
 *     (kept out of the printable PDF by design — it has no subject/topics).
 *   * The last days form a final block: subject-wise চূড়ান্ত রিভিশন + mock
 *     exams + full model test + ভুল বিশ্লেষণ + rest.
 *
 * The script is deterministic and emits plain SQL chunks to /tmp/routine_sql.
 * First-study topic/subtopic placement is done afterwards by the DB function
 * jh_generate_study_plan (syllabus order, even distribution, never invents
 * items) and cross-course alignment by jh_sync_common_topics.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "/tmp/routine_sql";
mkdirSync(OUT, { recursive: true });

const ADMIN = "b0d40cca-e34b-42fe-bc19-dae3627b7a48";
const START = new Date(Date.UTC(2026, 10, 22)); // 2026-11-22, Sunday

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bn = (n) => String(n).split("").map((d) => (/\d/.test(d) ? BN_DIGITS[+d] : d)).join("");

const iso = (dayNo) => {
  const d = new Date(START.getTime() + (dayNo - 1) * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const isFriday = (dayNo) => new Date(START.getTime() + (dayNo - 1) * 86_400_000).getUTCDay() === 5;
const weekStart = (dayNo) => iso(7 * Math.floor((dayNo - 1) / 7) + 1);
const weekIndex = (dayNo) => Math.floor((dayNo - 1) / 7) + 1;

const esc = (s) => s.replace(/'/g, "''");

/** One routines row. */
function row({ courseId, kind = "daily", dayNo, titleBn, subjectId = null, minutes, taskKind, slotLabel, focusNote = null }) {
  return (
    `('${courseId}', '${kind}', '${iso(dayNo)}', '${esc(titleBn)}', ` +
    (subjectId ? `'${subjectId}', ` : "null, ") +
    `${minutes}, 'published', '${esc(taskKind)}', '${weekStart(dayNo)}', ${weekIndex(dayNo)}, ` +
    `'${esc(slotLabel)}', ${focusNote ? `'${esc(focusNote)}'` : "null"}, '${ADMIN}')`
  );
}

/** Proportional slot allocation with a floor, trimmed/padded to exactly `total`. */
function allocateSlots(subjects, total, floor) {
  const totalUnits = subjects.reduce((a, s) => a + s.units, 0);
  const out = subjects.map((s) => ({ ...s, slots: Math.max(floor, Math.round((total * s.units) / totalUnits)) }));
  let diff = out.reduce((a, s) => a + s.slots, 0) - total;
  // Deterministic trim/pad on the largest allocations.
  const bySize = [...out].sort((a, b) => b.slots - a.slots || a.title.localeCompare(b.title));
  let i = 0;
  while (diff !== 0) {
    const t = bySize[i % bySize.length];
    if (diff > 0 && t.slots > floor) { t.slots -= 1; diff -= 1; }
    else if (diff < 0) { t.slots += 1; diff += 1; }
    i += 1;
  }
  return out;
}

/* ============================== BCS (60 days) ============================== */

const BCS = "599509ae-c4c3-440a-9463-802a4efc7a0c";
// units = subtopics + topics-without-subtopics (live syllabus, verified).
const BCS_SUBJECTS = [
  { title: "বাংলা ভাষা ও সাহিত্য", id: "df641c1a-8c23-4650-9071-84b2e78b9db0", units: 64 },
  { title: "English Language & Literature", id: "c71982a7-58d6-4632-9ca5-6922fdfb9485", units: 52 },
  { title: "গাণিতিক যুক্তি", id: "0688ee2a-cca7-47b2-bf85-6249887a9d5a", units: 80 },
  { title: "মানসিক দক্ষতা", id: "8ce518d7-b0be-432b-bea2-90318d9985ad", units: 24 },
  { title: "সাধারণ বিজ্ঞান", id: "3c11a812-5286-41fb-862a-509c2e910b02", units: 38 },
  { title: "কম্পিউটার ও তথ্যপ্রযুক্তি", id: "3cdd0317-b895-44f8-89e9-2d11358badc8", units: 26 },
  { title: "বাংলাদেশ বিষয়াবলি", id: "35fc02d8-4fe4-433c-8d22-72a539618f1f", units: 40 },
  { title: "আন্তর্জাতিক বিষয়াবলি", id: "be454138-3852-4af8-921f-081fdeaf5322", units: 29 },
  { title: "ভূগোল, পরিবেশ ও দুর্যোগ", id: "2b2235ac-ed39-4e83-a1ff-7c030fbb37d1", units: 15 },
  { title: "নৈতিকতা, মূল্যবোধ ও সুশাসন", id: "1350e8fc-3097-4503-8aa3-0b437b5c3ce1", units: 14 },
];

const BCS_SLOT_META = [
  { label: "সকাল ৭:০০–৯:০০", minutes: 120 },
  { label: "সকাল ৯:১৫–১০:৪৫", minutes: 90 },
  { label: "বিকাল ৪:০০–৬:০০", minutes: 120 },
  { label: "রাত ৮:০০–১০:০০", minutes: 120 },
];

function buildBcs() {
  const rows = [];
  const studyDays = [];
  for (let d = 1; d <= 53; d += 1) if (!isFriday(d)) studyDays.push(d);
  const perDay = 4;
  const totalSlots = studyDays.length * perDay; // 46 * 4 = 184

  const alloc = allocateSlots(BCS_SUBJECTS, totalSlots, 8);
  const daySubjects = studyDays.map(() => []);

  // Even spreading: heavier subjects first, each slot lands near its ideal
  // position so each subject keeps a steady cadence (no long gaps, no pileups).
  for (const s of [...alloc].sort((a, b) => b.slots - a.slots || a.title.localeCompare(b.title))) {
    for (let j = 0; j < s.slots; j += 1) {
      const ideal = Math.min(studyDays.length - 1, Math.floor(((j + 0.5) * studyDays.length) / s.slots));
      let placed = false;
      for (let off = 0; off < studyDays.length && !placed; off += 1) {
        for (const idx of off === 0 ? [ideal] : [ideal + off, ideal - off]) {
          if (idx < 0 || idx >= studyDays.length) continue;
          const bucket = daySubjects[idx];
          if (bucket.length < perDay && !bucket.some((x) => x.id === s.id)) {
            bucket.push(s);
            placed = true;
            break;
          }
        }
      }
      if (!placed) throw new Error(`BCS: could not place slot for ${s.title}`);
    }
  }

  studyDays.forEach((dayNo, di) => {
    daySubjects[di].forEach((s, si) => {
      rows.push(row({
        courseId: BCS, dayNo, titleBn: `দিন ${bn(dayNo)} — ${s.title}`,
        subjectId: s.id, minutes: BCS_SLOT_META[si].minutes, taskKind: "study",
        slotLabel: BCS_SLOT_META[si].label,
      }));
    });
    rows.push(row({
      courseId: BCS, dayNo, titleBn: `দৈনিক রিভিশন — দিন ${bn(dayNo)}`,
      minutes: 45, taskKind: "revision", slotLabel: "রাত ১০:১৫–১১:০০",
      focusNote: "আজকের পড়া ঝালাই + আগের দিনের টপিক দ্রুত রিভিশন",
    }));
  });

  // Fridays (weeks 1–7): weekly exam + weekly revision.
  let week = 0;
  for (let d = 1; d <= 53; d += 1) {
    if (!isFriday(d)) continue;
    week += 1;
    rows.push(row({
      courseId: BCS, kind: "weekly_special", dayNo: d,
      titleBn: `সাপ্তাহিক পরীক্ষা — সপ্তাহ ${bn(week)}`, minutes: 120, taskKind: "exam",
      slotLabel: "সকাল ৯:৩০–১১:৩০", focusNote: "এই সপ্তাহে পড়া সম্পূর্ণ সিলেবাস থেকে প্রশ্ন",
    }));
    rows.push(row({
      courseId: BCS, dayNo: d, titleBn: `সাপ্তাহিক রিভিশন — সপ্তাহ ${bn(week)}`,
      minutes: 90, taskKind: "revision", slotLabel: "বিকাল ৪:০০–৫:৩০",
      focusNote: "সপ্তাহের সব টপিক + পরীক্ষার ভুল উত্তর বিশ্লেষণ",
    }));
  }

  // Final block: days 54–58 subject-pair revision + mock; 59 full model test; 60 wrap-up.
  const pairs = [
    [BCS_SUBJECTS[0], BCS_SUBJECTS[1]],
    [BCS_SUBJECTS[2], BCS_SUBJECTS[3]],
    [BCS_SUBJECTS[6], BCS_SUBJECTS[7]],
    [BCS_SUBJECTS[4], BCS_SUBJECTS[5]],
    [BCS_SUBJECTS[8], BCS_SUBJECTS[9]],
  ];
  pairs.forEach(([a, b], i) => {
    const dayNo = 54 + i;
    rows.push(row({
      courseId: BCS, dayNo, titleBn: `চূড়ান্ত রিভিশন — ${a.title}`, subjectId: a.id,
      minutes: 150, taskKind: "revision", slotLabel: "সকাল ৭:০০–৯:৩০",
    }));
    rows.push(row({
      courseId: BCS, dayNo, titleBn: `চূড়ান্ত রিভিশন — ${b.title}`, subjectId: b.id,
      minutes: 150, taskKind: "revision", slotLabel: "বিকাল ৩:৩০–৬:০০",
    }));
    rows.push(row({
      courseId: BCS, dayNo, titleBn: `বিষয়ভিত্তিক মক টেস্ট — ${a.title} + ${b.title}`,
      minutes: 60, taskKind: "exam", slotLabel: "রাত ৮:৩০–৯:৩০",
    }));
  });
  rows.push(row({
    courseId: BCS, dayNo: 59, titleBn: "পূর্ণাঙ্গ মডেল টেস্ট (২০০ নম্বর)", minutes: 120,
    taskKind: "exam", slotLabel: "সকাল ৯:০০–১১:০০", focusNote: "বিসিএস প্রিলি প্যাটার্নে সম্পূর্ণ সিলেবাস",
  }));
  rows.push(row({
    courseId: BCS, dayNo: 59, titleBn: "ভুল বিশ্লেষণ ও দুর্বল টপিক চিহ্নিতকরণ", minutes: 90,
    taskKind: "revision", slotLabel: "বিকাল ৪:০০–৫:৩০",
  }));
  rows.push(row({
    courseId: BCS, dayNo: 60, titleBn: "চূড়ান্ত ঝালাই — দুর্বল ও হাই-ইল্ড টপিক", minutes: 120,
    taskKind: "revision", slotLabel: "সকাল ৯:০০–১১:০০",
  }));
  rows.push(row({
    courseId: BCS, dayNo: 60, titleBn: "বিশ্রাম ও মানসিক প্রস্তুতি", minutes: 30,
    taskKind: "rest", slotLabel: "বিকাল",
  }));

  return { rows, alloc, studyDays: studyDays.length };
}

/* ======================= Petrobangla AE EEE (30 days) ====================== */

const PETRO = "4ab82963-892e-4c69-9a5d-09d289c33c04";
// Prerequisite order: foundations → machines → power system → electronics →
// control → installation → math/org. units verified against live syllabus.
const PETRO_TECH = [
  { title: "ইলেকট্রিক্যাল সার্কিট তত্ত্ব", id: "d3cee719-40d4-435b-8276-e3a5bffceb3f", units: 8 },
  { title: "এসি সার্কিট বিশ্লেষণ", id: "37cf6297-7426-4c1d-8a90-a9592a08f1f9", units: 6 },
  { title: "ইলেকট্রিক্যাল পরিমাপ", id: "5e49cde1-ef7f-4bf9-a0e6-0dce4202b08b", units: 4 },
  { title: "ইলেকট্রিক্যাল মেশিন মৌলিক", id: "17cf1cb2-1f33-4de7-9fd6-b278fedc5a0e", units: 4 },
  { title: "ট্রান্সফরমার", id: "ba30807f-f808-4e92-bf4c-e24d724c5aa0", units: 8 },
  { title: "ডিসি মেশিন", id: "66859cc1-9b1a-4f8e-bf9e-c162280f1fdf", units: 6 },
  { title: "ইন্ডাকশন মোটর", id: "6cc2b768-03d3-4cfc-9f46-98b494c3820f", units: 6 },
  { title: "সিনক্রোনাস মেশিন", id: "59dd2084-98a9-4c6e-a143-9b89b7a85c04", units: 5 },
  { title: "বিদ্যুৎ উৎপাদন", id: "040f303c-e45c-4ee4-a5c9-a03f0058e12b", units: 7 },
  { title: "বিদ্যুৎ সঞ্চালন ও বিতরণ", id: "2a0c07fc-c3b8-47a8-8dd8-ce431bca4681", units: 7 },
  { title: "পাওয়ার সিস্টেম বিশ্লেষণ", id: "30ed6c8d-0463-4425-a230-4a39fe595238", units: 6 },
  { title: "প্রোটেকশন ও সুইচগিয়ার", id: "cb8c982b-2900-4d43-8c66-7ccd4a5cb876", units: 7 },
  { title: "পাওয়ার ইলেকট্রনিক্স", id: "e3a2abfd-52b2-4796-9a22-0b41324a31a8", units: 5 },
  { title: "অ্যানালগ ইলেকট্রনিক্স", id: "17d40be3-c594-4053-913b-4aaafd9cf8d4", units: 6 },
  { title: "ডিজিটাল ইলেকট্রনিক্স", id: "783af14a-3ffe-4127-ae81-6594fb97e4a8", units: 7 },
  { title: "কন্ট্রোল সিস্টেম", id: "53d1a051-34b1-48f4-8370-07640a48bae3", units: 7 },
  { title: "ইলেকট্রিক্যাল ইনস্টলেশন ও নিরাপত্তা", id: "a8961e21-1119-41ee-b2b5-218f19a4b7c8", units: 4 },
  { title: "গণিত", id: "09dfca57-382f-47a8-adaf-8157aeedb412", units: 5 },
  { title: "পেট্রোবাংলা পরিচিতি", id: "a9b05a0e-4e02-4ed0-9c52-2f8588e655f5", units: 2 },
  { title: "বাংলাদেশ জ্বালানি খাত", id: "dd699161-ae22-4b78-83fa-3a71ffa25908", units: 4 },
];
const PETRO_GENERAL = [
  { title: "বাংলা", id: "a022685f-8775-46cb-9fdd-7b43da3adeb0", units: 4 },
  { title: "ইংরেজি", id: "d3a33a47-9684-4aef-8192-2eec6d3227d7", units: 4 },
  { title: "বাংলাদেশ বিষয়াবলি", id: "56a8b854-c105-4c76-9fa1-07d056e8177e", units: 4 },
  { title: "আন্তর্জাতিক বিষয়াবলি", id: "26d172c6-7c77-4e46-b6a7-b82c54894f4f", units: 4 },
  { title: "সাম্প্রতিক বিষয়াবলি", id: "32bae061-4c49-4d65-97ad-0aad3058e296", units: 2 },
  { title: "আইসিটি", id: "49e24e46-6f1b-45dc-b32c-b768ce196bda", units: 4 },
  { title: "সাধারণ বিজ্ঞান", id: "c411a81b-4b03-455e-aa3e-0d792e9f1a06", units: 4 },
];

const PETRO_SLOT_META = [
  { label: "সকাল ৭:০০–৯:০০", minutes: 120 },        // tech
  { label: "সকাল ৯:১৫–১১:০০", minutes: 105 },       // tech
  { label: "দুপুর ১২:০০–১:৩০", minutes: 90 },        // general
  { label: "বিকাল ৩:৩০–৫:৩০", minutes: 120 },       // tech
  { label: "সন্ধ্যা ৬:০০–৭:৩০", minutes: 90 },        // tech
  { label: "রাত ৮:৩০–১০:০০", minutes: 90 },         // tech
];

function buildPetro() {
  const rows = [];
  const studyDays = [];
  for (let d = 1; d <= 27; d += 1) if (!isFriday(d)) studyDays.push(d);
  const techPerDay = 5;
  const techSlots = studyDays.length * techPerDay; // 23 * 5 = 115

  const techAlloc = allocateSlots(PETRO_TECH, techSlots, 2);
  // Sequential pour in prerequisite order, max 3 slots of one subject per day
  // → prerequisites always finish before dependent subjects start.
  const queue = techAlloc.map((s) => ({ ...s, left: s.slots }));
  const dayTech = studyDays.map(() => []);
  let qi = 0;
  for (let di = 0; di < studyDays.length; di += 1) {
    while (dayTech[di].length < techPerDay) {
      while (qi < queue.length && queue[qi].left === 0) qi += 1;
      if (qi >= queue.length) break;
      // Head of the queue first; if it already has 3 slots today, borrow the
      // next subject in prerequisite order for this day's remaining slots.
      let picked = null;
      for (let k = qi; k < queue.length; k += 1) {
        const cand = queue[k];
        if (cand.left === 0) continue;
        if (dayTech[di].filter((x) => x.id === cand.id).length >= 3) continue;
        picked = cand;
        break;
      }
      if (!picked) break;
      dayTech[di].push(picked);
      picked.left -= 1;
    }
  }
  // Fallback pass: any remainder (cap collisions at the tail) goes to the
  // latest days that still have room, relaxing the per-day cap only here.
  for (const s of queue) {
    while (s.left > 0) {
      const di = dayTech.findLastIndex((bucket) => bucket.length < techPerDay);
      if (di < 0) throw new Error("Petro: no capacity left for technical slots");
      dayTech[di].push(s);
      s.left -= 1;
    }
  }

  // General subjects: 1 slot/day, weighted round-robin (largest remainder).
  const genAlloc = allocateSlots(PETRO_GENERAL, studyDays.length, 2);
  const genQueue = genAlloc.map((s) => ({ ...s, left: s.slots }));
  const dayGen = [];
  let lastGen = null;
  for (let di = 0; di < studyDays.length; di += 1) {
    const pick = [...genQueue]
      .filter((s) => s.left > 0)
      .sort((a, b) => b.left - a.left || a.title.localeCompare(b.title))
      .find((s) => s.id !== lastGen) ??
      genQueue.filter((s) => s.left > 0).sort((a, b) => b.left - a.left)[0];
    dayGen.push(pick);
    pick.left -= 1;
    lastGen = pick.id;
  }

  // Common-topic alignment (jh_sync_common_topics): কম্পিউটার মৌলিক is a
  // canonically-shared topic whose BCS first-study lands on 2026-11-24
  // (day 3). The Petrobangla আইসিটি general slot must sit on the same date,
  // so days 3 and 4 swap their general subjects — this mirrors the fix
  // applied live and keeps the generator's output byte-identical to the DB.
  const ict = PETRO_GENERAL.find((s) => s.title === "আইসিটি").id;
  const day3 = studyDays.indexOf(3);
  const day4 = studyDays.indexOf(4);
  if (day3 >= 0 && day4 >= 0 && dayGen[day3].id !== ict && dayGen[day4].id === ict) {
    [dayGen[day3], dayGen[day4]] = [dayGen[day4], dayGen[day3]];
  }

  studyDays.forEach((dayNo, di) => {
    const slots = [dayTech[di][0], dayTech[di][1], dayGen[di], dayTech[di][2], dayTech[di][3], dayTech[di][4]];
    slots.forEach((s, si) => {
      if (!s) return;
      rows.push(row({
        courseId: PETRO, dayNo, titleBn: `দিন ${bn(dayNo)} — ${s.title}`,
        subjectId: s.id, minutes: PETRO_SLOT_META[si].minutes, taskKind: "study",
        slotLabel: PETRO_SLOT_META[si].label,
      }));
    });
    rows.push(row({
      courseId: PETRO, dayNo, titleBn: `দৈনিক রিভিশন — দিন ${bn(dayNo)}`,
      minutes: 45, taskKind: "revision", slotLabel: "রাত ১০:১৫–১১:০০",
      focusNote: "আজকের সূত্র/ডায়াগ্রাম ঝালাই + আগের দিনের সমস্যা পুনরায় সমাধান",
    }));
  });

  let week = 0;
  for (let d = 1; d <= 27; d += 1) {
    if (!isFriday(d)) continue;
    week += 1;
    rows.push(row({
      courseId: PETRO, kind: "weekly_special", dayNo: d,
      titleBn: `সাপ্তাহিক পরীক্ষা — সপ্তাহ ${bn(week)} (টেকনিক্যাল + সাধারণ)`,
      minutes: 120, taskKind: "exam", slotLabel: "সকাল ৯:৩০–১১:৩০",
      focusNote: "এই সপ্তাহে পড়া টেকনিক্যাল ও সাধারণ সিলেবাস থেকে প্রশ্ন",
    }));
    rows.push(row({
      courseId: PETRO, dayNo: d, titleBn: `সাপ্তাহিক রিভিশন — সপ্তাহ ${bn(week)}`,
      minutes: 90, taskKind: "revision", slotLabel: "বিকাল ৪:০০–৫:৩০",
      focusNote: "সপ্তাহের নিউমেরিক্যাল সমস্যাগুলো আবার সমাধান + ভুল বিশ্লেষণ",
    }));
  }

  rows.push(row({
    courseId: PETRO, dayNo: 28, titleBn: "চূড়ান্ত রিভিশন — সার্কিট, মেশিন ও পাওয়ার গ্রুপ",
    minutes: 180, taskKind: "revision", slotLabel: "সকাল ৮:০০–১১:০০",
  }));
  rows.push(row({
    courseId: PETRO, dayNo: 28, titleBn: "চূড়ান্ত রিভিশন — ইলেকট্রনিক্স, কন্ট্রোল ও সাধারণ বিষয়",
    minutes: 180, taskKind: "revision", slotLabel: "বিকাল ৩:০০–৬:০০",
  }));
  rows.push(row({
    courseId: PETRO, dayNo: 29, titleBn: "ফুল সিলেবাস মক টেস্ট (পেট্রোবাংলা AE প্যাটার্ন)",
    minutes: 120, taskKind: "exam", slotLabel: "সকাল ৯:০০–১১:০০",
  }));
  rows.push(row({
    courseId: PETRO, dayNo: 29, titleBn: "ভুল বিশ্লেষণ ও দুর্বল টপিক চিহ্নিতকরণ",
    minutes: 90, taskKind: "revision", slotLabel: "বিকাল ৪:০০–৫:৩০",
  }));
  rows.push(row({
    courseId: PETRO, dayNo: 30, titleBn: "ফাইনাল ঝালাই — গুরুত্বপূর্ণ সূত্র, ডায়াগ্রাম ও সাম্প্রতিক",
    minutes: 120, taskKind: "revision", slotLabel: "সকাল ৯:০০–১১:০০",
  }));
  rows.push(row({
    courseId: PETRO, dayNo: 30, titleBn: "বিশ্রাম ও মানসিক প্রস্তুতি", minutes: 30,
    taskKind: "rest", slotLabel: "বিকাল",
  }));

  return { rows, techAlloc, genAlloc, studyDays: studyDays.length };
}

/* ================================== emit ================================== */

const COLS =
  "(course_id, kind, routine_date, title_bn, subject_id, minutes, status, task_kind, week_start, week_index, slot_label, focus_note_bn, created_by)";

const bcs = buildBcs();
const petro = buildPetro();

writeFileSync(join(OUT, "00_delete.sql"), `
delete from public.study_plan_assignments where course_id in ('${BCS}', '${PETRO}');
delete from public.student_routines where course_id in ('${BCS}', '${PETRO}');
delete from public.routines where course_id in ('${BCS}', '${PETRO}');
`.trim() + "\n");

const all = [...bcs.rows, ...petro.rows];
const CHUNK = 60;
let fileNo = 0;
for (let i = 0; i < all.length; i += CHUNK) {
  fileNo += 1;
  const chunk = all.slice(i, i + CHUNK);
  writeFileSync(
    join(OUT, `${String(fileNo).padStart(2, "0")}_insert.sql`),
    `insert into public.routines ${COLS} values\n${chunk.join(",\n")};\n`,
  );
}

console.log(JSON.stringify({
  bcs: {
    rows: bcs.rows.length,
    studyDays: bcs.studyDays,
    slots: bcs.alloc.map((s) => `${s.title}: ${s.slots} slots / ${s.units} units`),
  },
  petro: {
    rows: petro.rows.length,
    studyDays: petro.studyDays,
    tech: petro.techAlloc.map((s) => `${s.title}: ${s.slots}/${s.units}`),
    general: petro.genAlloc.map((s) => `${s.title}: ${s.slots}/${s.units}`),
  },
  files: fileNo + 1,
}, null, 2));
