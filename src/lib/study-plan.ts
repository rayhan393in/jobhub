/**
 * 30-day study-plan generator.
 *
 * The plan is derived, never invented: every day points at a real syllabus row
 * (subject → topic) that already exists in the database, and the minutes come
 * from how much per day the student says they can study. A day with no unused
 * topic is a revision day rather than a fabricated lesson title.
 *
 * Kept free of Supabase and React so the ordering/spacing rules are unit-tested.
 */

export type PlanTopic = {
  id: string;
  subjectId: string;
  subjectLabel: string;
  label: string;
};

export type PlanDay = {
  /** 1-based day number inside the 30-day cycle. */
  day: number;
  kind: "study" | "revision" | "rest";
  minutes: number;
  topic: PlanTopic | null;
  /** Second lighter topic for days with a long session. */
  extra: PlanTopic | null;
  note: string;
};

export type PlanOptions = {
  days: number;
  minutesPerDay: number;
  /** Friday in Bangladesh is index 5 (Sunday = 0). */
  restWeekday?: number | null;
  startDate?: string;
};

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const bn = (value: number | string) =>
  String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/**
 * Spread topics so consecutive days never sit in the same subject for long.
 * Round-robin across subjects in descending size keeps momentum on the big
 * subjects without abandoning the small ones — a straight list would spend the
 * first two weeks inside গাণিতিক যুক্তি and never reach নৈতিকতা.
 */
export function interleaveBySubject(topics: PlanTopic[]): PlanTopic[] {
  const buckets = new Map<string, PlanTopic[]>();
  for (const topic of topics) {
    const list = buckets.get(topic.subjectId) ?? [];
    list.push(topic);
    buckets.set(topic.subjectId, list);
  }

  // Largest subjects first, so the leftovers at the end of the plan are small.
  const queue = [...buckets.values()].sort((a, b) => b.length - a.length);
  const out: PlanTopic[] = [];
  let index = 0;

  while (queue.some((bucket) => index < bucket.length)) {
    for (const bucket of queue) {
      if (index < bucket.length) out.push(bucket[index]);
    }
    index += 1;
  }

  return out;
}

/**
 * Build the day-by-day plan.
 *
 * Rules, in order of precedence:
 *  1. The rest day is a rest day. No study, no revision, no guilt.
 *  2. If unused topics remain, the day is `study` and takes the next topic(s).
 *  3. Otherwise the day is `revision` — deliberate spaced repetition over the
 *     topics already covered, which is what the last week of a 30-day plan
 *     should be.
 */
export function buildStudyPlan(topics: PlanTopic[], options: PlanOptions): PlanDay[] {
  const { days, minutesPerDay, restWeekday = null, startDate } = options;
  const ordered = interleaveBySubject(topics);
  const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null;

  // Short sessions get one topic, long ones get two. 45 minutes on a brand-new
  // topic plus 20 on a second is worse than 45 on one, so the split is coarse.
  const topicsPerDay = minutesPerDay >= 90 ? 2 : 1;

  const plan: PlanDay[] = [];
  let cursor = 0;

  for (let day = 1; day <= days; day += 1) {
    const weekday = start ? (start.getUTCDay() + day - 1) % 7 : null;
    const isRest = restWeekday !== null && weekday === restWeekday;

    if (isRest) {
      plan.push({
        day,
        kind: "rest",
        minutes: 0,
        topic: null,
        extra: null,
        note: "বিশ্রাম — পরিবার ও ঘুম। ক্লান্তি জমিয়ে রাখলে পরের সপ্তাহের পড়া নষ্ট হয়।",
      });
      continue;
    }

    const picks: PlanTopic[] = [];
    for (let slot = 0; slot < topicsPerDay && cursor < ordered.length; slot += 1) {
      picks.push(ordered[cursor]);
      cursor += 1;
    }

    if (picks.length === 0) {
      // Everything has been covered at least once; revisit in the same order.
      const revisionTopic = ordered.length > 0 ? ordered[(day - 1) % ordered.length] : null;
      plan.push({
        day,
        kind: "revision",
        minutes: minutesPerDay,
        topic: revisionTopic,
        extra: null,
        note: revisionTopic
          ? `${revisionTopic.subjectLabel} — পুরো সিলেবাস একবার শেষ। এখন পুনরাবৃত্তি ও ভুল প্রশ্নের খাতা ধরে এগোন।`
          : "পুনরাবৃত্তির দিন — পুরনো টপিক ও ভুল প্রশ্নের খাতা দেখুন।",
      });
      continue;
    }

    plan.push({
      day,
      kind: "study",
      minutes: minutesPerDay,
      topic: picks[0] ?? null,
      extra: picks[1] ?? null,
      note:
        picks.length > 1
          ? `${picks[0].subjectLabel} + ${picks[1].subjectLabel} — প্রথমে নতুন পড়া, পরে দ্রুত রিভিশন।`
          : `${picks[0].subjectLabel} — নতুন টপিক, শেষে ৫ মিনিট নিজেকে যাচাই করুন।`,
    });
  }

  return plan;
}

/** Totals for the summary card, in the units the UI shows. */
export function planSummary(plan: PlanDay[]) {
  const study = plan.filter((day) => day.kind === "study").length;
  const revision = plan.filter((day) => day.kind === "revision").length;
  const rest = plan.filter((day) => day.kind === "rest").length;
  const minutes = plan.reduce((sum, day) => sum + day.minutes, 0);
  const topics = plan.reduce(
    (sum, day) => sum + (day.kind === "study" ? (day.topic ? 1 : 0) + (day.extra ? 1 : 0) : 0),
    0,
  );

  return {
    study,
    revision,
    rest,
    minutes,
    topics,
    /** e.g. "১২ ঘণ্টা ৩০ মিনিট" */
    durationBn: `${bn(Math.floor(minutes / 60))} ঘণ্টা ${bn(minutes % 60)} মিনিট`,
  };
}

/**
 * How many days of topics exist for a per-day budget — used to tell the student
 * honestly when their syllabus will run out and revision begins.
 */
export function topicCoverageDays(topicCount: number, minutesPerDay: number): number {
  const perDay = minutesPerDay >= 90 ? 2 : 1;
  return Math.floor(topicCount / perDay);
}

export const formatBn = bn;
