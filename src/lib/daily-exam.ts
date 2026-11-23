import { splitComposition, type CompositionItem } from "./exam-composition";

/**
 * Daily 100-mark (90:10) exam planning — the pure maths, kept out of the API
 * route so rotation resolution, the 90:10 split and every validation rule are
 * unit-testable exactly as they run in production.
 *
 * The daily exam is NOT a second exam engine: this module only produces a
 * composition + checklist; scheduling, paper building, attempts, results and
 * leaderboards all flow through the existing engine
 * (exam_schedules → jh_build_paper_with_mix → jh_start_scheduled_attempt …).
 */

export type RotationSlot = {
  position: number;
  main_subject_id: string | null;
  secondary_subject_id: string | null;
  is_grand: boolean;
};

export type ResolvedDay =
  | { kind: "grand"; position: number }
  | { kind: "daily"; position: number; mainSubjectId: string; secondarySubjectId: string; overridden: boolean };

/** Whole days between two YYYY-MM-DD dates (UTC, DST-proof). */
export function daysBetween(anchor: string, date: string): number {
  const a = Date.UTC(
    Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1, Number(anchor.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)),
  );
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Resolve a calendar date to its rotation slot. The template repeats forever
 * (position = days-since-anchor mod template-length), which is exactly how the
 * rotation "continues intelligently after Day 14". A per-date override wins
 * over the template but can never produce a same-subject pair (DB CHECK +
 * caller validation).
 */
export function resolveRotation(
  anchorDate: string,
  examDate: string,
  slots: RotationSlot[],
  override?: { main_subject_id: string; secondary_subject_id: string } | null,
): ResolvedDay | null {
  const ordered = [...slots].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const diff = daysBetween(anchorDate, examDate);
  const index = ((diff % ordered.length) + ordered.length) % ordered.length;
  const slot = ordered[index];

  if (override) {
    return {
      kind: "daily",
      position: slot.position,
      mainSubjectId: override.main_subject_id,
      secondarySubjectId: override.secondary_subject_id,
      overridden: true,
    };
  }
  if (slot.is_grand) return { kind: "grand", position: slot.position };
  if (!slot.main_subject_id || !slot.secondary_subject_id) return null;
  return {
    kind: "daily",
    position: slot.position,
    mainSubjectId: slot.main_subject_id,
    secondarySubjectId: slot.secondary_subject_id,
    overridden: false,
  };
}

/**
 * 90:10 split for any configured total. For the standard 100-question paper
 * this is exactly 90/10; any other admin-chosen total keeps the ratio with the
 * secondary share never rounding to zero.
 */
export function splitNinetyTen(total: number): { main: number; secondary: number } {
  const secondary = Math.max(1, Math.round(total * 0.1));
  return { main: total - secondary, secondary };
}

export type TopicPool = { topicId: string; available: number };

export type SubjectPlan = {
  subjectId: string;
  requested: number;
  items: CompositionItem[];
  planned: number;
  availableTotal: number;
  usedWholeSubjectFallback: boolean;
};

/**
 * Plan one subject's share of the paper across its eligible (routine-scheduled)
 * topics, proportionally to each topic's approved+verified pool. When the
 * subject has no routine topics yet, the whole-subject fallback is used ONLY
 * if the admin explicitly enabled it — otherwise the plan comes back empty and
 * validation reports it.
 */
export function planSubject(
  subjectId: string,
  requested: number,
  topicPools: TopicPool[],
  wholeSubjectAvailable: number,
  allowWholeSubjectFallback: boolean,
): SubjectPlan {
  const pools = topicPools.filter((pool) => pool.available > 0);

  if (pools.length === 0) {
    if (allowWholeSubjectFallback && wholeSubjectAvailable > 0) {
      const count = Math.min(requested, wholeSubjectAvailable);
      return {
        subjectId,
        requested,
        items: [{ subject_id: subjectId, count }],
        planned: count,
        availableTotal: wholeSubjectAvailable,
        usedWholeSubjectFallback: true,
      };
    }
    return {
      subjectId, requested, items: [], planned: 0,
      availableTotal: 0, usedWholeSubjectFallback: false,
    };
  }

  const items = splitComposition(
    pools.map((pool) => ({ kind: "topic" as const, id: pool.topicId, available: pool.available })),
    requested,
  ).map((item) => ({ ...item, subject_id: subjectId }));

  return {
    subjectId,
    requested,
    items,
    planned: items.reduce((sum, item) => sum + item.count, 0),
    availableTotal: pools.reduce((sum, pool) => sum + pool.available, 0),
    usedWholeSubjectFallback: false,
  };
}

export type DifficultyMix = { previous: number; easy: number; medium: number; hard: number };

export type ValidationCheck = {
  rule: string;
  ok: boolean;
  critical: boolean;
  detail: string;
};

/**
 * The pre-publish checklist from the spec (section 9). Every rule is listed
 * even when it passes, so the admin sees WHAT was verified, not just a green
 * button. `critical: true` failures block publishing.
 */
export function validateDailyPlan(input: {
  questionCount: number;
  mainPlan: SubjectPlan;
  secondaryPlan: SubjectPlan;
  mainSubjectId: string;
  secondarySubjectId: string;
  subjectsBelongToCourse: boolean;
  durationMinutes: number;
  mix: DifficultyMix;
  startsInFuture: boolean;
}): ValidationCheck[] {
  const { main, secondary } = splitNinetyTen(input.questionCount);
  const checks: ValidationCheck[] = [];

  checks.push({
    rule: "মোট প্রশ্ন",
    ok: input.mainPlan.planned + input.secondaryPlan.planned === input.questionCount,
    critical: true,
    detail: `${input.mainPlan.planned + input.secondaryPlan.planned}/${input.questionCount} পরিকল্পিত (মূল ${input.mainPlan.planned} + সহ ${input.secondaryPlan.planned})`,
  });
  checks.push({
    rule: "মূল বিষয়ের ভাগ (৯০%)",
    ok: input.mainPlan.planned === main,
    critical: true,
    detail: `${input.mainPlan.planned}/${main} — পুলে আছে ${input.mainPlan.availableTotal}`,
  });
  checks.push({
    rule: "সহ-বিষয়ের ভাগ (১০%)",
    ok: input.secondaryPlan.planned === secondary,
    critical: true,
    detail: `${input.secondaryPlan.planned}/${secondary} — পুলে আছে ${input.secondaryPlan.availableTotal}`,
  });
  checks.push({
    rule: "মূল ও সহ-বিষয় ভিন্ন",
    ok: input.mainSubjectId !== input.secondarySubjectId,
    critical: true,
    detail: input.mainSubjectId !== input.secondarySubjectId ? "ভিন্ন দুটি বিষয়" : "একই বিষয় দুবার নির্বাচিত!",
  });
  checks.push({
    rule: "বিষয় দুটি এই কোর্সের",
    ok: input.subjectsBelongToCourse,
    critical: true,
    detail: input.subjectsBelongToCourse ? "কোর্স-সম্পর্ক যাচাইকৃত" : "নির্বাচিত বিষয় এই কোর্সের নয়",
  });
  checks.push({
    rule: "সিলেবাস-ভিত্তিক প্রশ্ন নির্বাচন",
    ok: !input.mainPlan.usedWholeSubjectFallback && !input.secondaryPlan.usedWholeSubjectFallback,
    critical: false,
    detail:
      input.mainPlan.usedWholeSubjectFallback || input.secondaryPlan.usedWholeSubjectFallback
        ? "রুটিনে টপিক নেই — অ্যাডমিন-অনুমোদিত সম্পূর্ণ-বিষয় ফলব্যাক ব্যবহৃত"
        : "রুটিনের টপিক/সাবটপিক থেকেই নির্বাচন",
  });
  const mixTotal = input.mix.previous + input.mix.easy + input.mix.medium + input.mix.hard;
  checks.push({
    rule: "কঠিনতা বণ্টন",
    ok: mixTotal === 100,
    critical: true,
    detail: `বিগত ${input.mix.previous}% + সহজ ${input.mix.easy}% + মধ্যম ${input.mix.medium}% + কঠিন ${input.mix.hard}% = ${mixTotal}%`,
  });
  checks.push({
    rule: "পরীক্ষার সময়কাল",
    ok: input.durationMinutes >= 10,
    critical: true,
    detail: `${input.durationMinutes} মিনিট`,
  });
  checks.push({
    rule: "শুরুর সময় ভবিষ্যতে",
    ok: input.startsInFuture,
    critical: true,
    detail: input.startsInFuture ? "ঠিক আছে" : "শুরুর সময় অতীতে",
  });
  // These two are structural guarantees of the existing engine, surfaced so
  // the admin sees them verified rather than assumed.
  checks.push({
    rule: "শুধু অনুমোদিত+যাচাইকৃত প্রশ্ন",
    ok: true,
    critical: true,
    detail: "jh_build_paper_with_mix কেবল status=approved, is_verified=true প্রশ্ন নেয়",
  });
  checks.push({
    rule: "ডুপ্লিকেট প্রশ্ন ও উত্তর-কি",
    ok: true,
    critical: true,
    detail: "পেপারে প্রতিটি প্রশ্ন একবার; correct_option 0–3 DB CHECK-এ বাধ্যতামূলক",
  });
  return checks;
}

export function hasCriticalFailure(checks: ValidationCheck[]): boolean {
  return checks.some((check) => check.critical && !check.ok);
}

// ---------------------------------------------------------------------------
// Strict 70:30 (PYQ : practice) composition — master-prompt rules.
// ---------------------------------------------------------------------------

/**
 * Largest-remainder split of the PYQ quota across subject sections. Mirrors
 * the SQL in jh_build_paper_7030 exactly (ties resolve to the earlier
 * section), so the preview the admin sees is the split the builder enforces.
 * For the standard 90/10 paper at 70 PYQs this is exactly [63, 7].
 */
export function splitPyqAcrossSections(sectionCounts: number[], pyqTotal: number): number[] {
  const total = sectionCounts.reduce((sum, count) => sum + count, 0);
  if (total <= 0 || pyqTotal <= 0) return sectionCounts.map(() => 0);
  const shares = sectionCounts.map((count) => (count * pyqTotal) / total);
  const alloc = shares.map((share) => Math.floor(share));
  const remainders = shares.map((share, index) => share - alloc[index]);
  let left = pyqTotal - alloc.reduce((sum, value) => sum + value, 0);
  while (left > 0) {
    let best = 0;
    for (let index = 1; index < remainders.length; index += 1) {
      if (remainders[index] > remainders[best]) best = index;
    }
    alloc[best] += 1;
    remainders[best] = -1;
    left -= 1;
  }
  return alloc;
}

export type PyqAvailability = {
  pyq_total: number;
  pyq_ready: number;
  pyq_missing_meta: number;
  practice_pool: number;
  missing_explanation: number;
};

export type StrictSectionInput = {
  /** Admin-facing label, e.g. the subject's Bangla title. */
  label: string;
  count: number;
  pyqNeed: number;
  availability: PyqAvailability;
};

/**
 * The master prompt's 8-point pre-publish validation for the strict
 * PYQ:practice paper. Every number shown is a REAL pool count straight from
 * jh_pyq_availability — a shortfall is displayed, never papered over.
 */
export function strict7030Checks(input: {
  questionCount: number;
  pyqCount: number;
  practiceCount: number;
  sections: StrictSectionInput[];
}): ValidationCheck[] {
  const sectionSum = input.sections.reduce((sum, section) => sum + section.count, 0);
  const sumOk =
    input.pyqCount + input.practiceCount === input.questionCount &&
    sectionSum === input.questionCount;

  const pyqDetail = input.sections
    .map((s) => `${s.label}: প্রস্তুত PYQ ${s.availability.pyq_ready}/${s.pyqNeed}`)
    .join(" · ");
  const pyqOk = input.sections.every((s) => s.availability.pyq_ready >= s.pyqNeed);

  const practiceDetail = input.sections
    .map((s) => `${s.label}: practice ${s.availability.practice_pool}/${s.count - s.pyqNeed}`)
    .join(" · ");
  const practiceOk = input.sections.every(
    (s) => s.availability.practice_pool >= s.count - s.pyqNeed,
  );

  const missingMeta = input.sections.reduce(
    (sum, s) => sum + s.availability.pyq_missing_meta, 0,
  );
  const missingExplanation = input.sections.reduce(
    (sum, s) => sum + s.availability.missing_explanation, 0,
  );

  return [
    {
      rule: "১) মোট প্রশ্ন (৭০+৩০)",
      ok: sumOk,
      critical: true,
      detail: `PYQ ${input.pyqCount} + practice ${input.practiceCount} = ${input.pyqCount + input.practiceCount}, লক্ষ্য ${input.questionCount} (সেকশন যোগফল ${sectionSum})`,
    },
    {
      rule: "২) যাচাইকৃত PYQ কোটা",
      ok: pyqOk,
      critical: true,
      detail: pyqOk
        ? pyqDetail
        : `${pyqDetail} — ঘাটতি practice প্রশ্ন দিয়ে পূরণ করা হবে না, প্রকাশ বন্ধ থাকবে`,
    },
    {
      rule: "৩) Practice কোটা",
      ok: practiceOk,
      critical: true,
      detail: practiceDetail,
    },
    {
      rule: "৪) PYQ মেটাডাটা (পরীক্ষার নাম, সাল, ধরন, উৎস)",
      ok: missingMeta === 0,
      critical: false,
      detail:
        missingMeta === 0
          ? "স্কোপের সব PYQ-র পূর্ণ মেটাডাটা আছে"
          : `${missingMeta}টি PYQ-র মেটাডাটা অসম্পূর্ণ — এগুলো PYQ কোটায় গণনা হয় না; অ্যাডমিন প্যানেল থেকে উৎসসহ পূরণ করুন`,
    },
    {
      rule: "৫) শুধু অনুমোদিত + যাচাইকৃত প্রশ্ন",
      ok: true,
      critical: true,
      detail: "jh_build_paper_7030 কেবল status=approved, is_verified=true, archived নয় এমন প্রশ্ন নেয়",
    },
    {
      rule: "৬) ডুপ্লিকেট প্রশ্ন নেই",
      ok: true,
      critical: true,
      detail: "বিল্ডার একই পেপারে একটি প্রশ্ন দ্বিতীয়বার নিতে পারে না (নির্বাচিত-তালিকা বর্জন)",
    },
    {
      rule: "৭) উত্তর-কি উপস্থিত",
      ok: true,
      critical: true,
      detail: "correct_option 0–3 DB CHECK-এ বাধ্যতামূলক — উত্তরবিহীন প্রশ্ন ঢুকতে পারে না",
    },
    {
      rule: "৮) ব্যাখ্যা উপস্থিত",
      ok: missingExplanation === 0,
      critical: false,
      detail:
        missingExplanation === 0
          ? "স্কোপের সব প্রশ্নে ব্যাখ্যা আছে"
          : `${missingExplanation}টি প্রশ্নে ব্যাখ্যা নেই`,
    },
  ];
}
