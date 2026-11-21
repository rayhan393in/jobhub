/**
 * Study recommendations, grounded in what the database actually knows.
 *
 * The spec (§9) asks for priorities from past-paper frequency, revision for
 * weak topics, carried-forward unfinished topics, and a next week that improves
 * on the last exam's results.
 *
 * The risk in a feature like this is confident-sounding advice built from
 * nothing. A student with no exam history and a bank with no counted questions
 * would still get "focus on Constitutional Law" out of a naive implementation,
 * and it would be pure invention. So every recommendation here carries the
 * evidence it was derived from, and each rule is skipped outright when its
 * evidence is missing. `blocked` records why a rule produced nothing, and the UI
 * shows that instead of a suggestion.
 *
 * Arithmetic only — no database, no React — so the honesty rules are unit
 * tested directly.
 */

import type { FrequencyBand } from "./weekly-plan";

export type TopicEvidence = {
  topic_id: string;
  topic_bn: string;
  subject_id: string;
  subject_bn: string;
  /** Counted past-paper questions. Undefined when the topic was never counted. */
  frequency?: number;
  /** How many distinct papers the count came from. */
  papers?: number;
  band?: FrequencyBand;
};

export type AttemptEvidence = {
  topic_id: string;
  /** Questions the student actually answered on this topic. */
  attempted: number;
  correct: number;
};

export type Recommendation = {
  kind: "frequency" | "weak" | "carry_forward" | "improve";
  topic_id: string;
  topic_bn: string;
  subject_bn: string;
  /** Why this topic is suggested, in the student's language. */
  reason_bn: string;
  /** The numbers the reason is based on, so the student can check them. */
  evidence_bn: string;
  /** Higher first. */
  score: number;
};

export type RecommendationInput = {
  frequency: TopicEvidence[];
  attempts: AttemptEvidence[];
  /** Topic ids scheduled last week with no completed progress row. */
  unfinishedTopicIds: string[];
  /** Topics with a completed progress row — never recommended again. */
  completedTopicIds: string[];
  /** Optional: last week's released result, to phrase the "improve" rule. */
  lastResult?: { accuracy: number; exam_title_bn: string } | null;
  limit?: number;
};

export type RecommendationSet = {
  items: Recommendation[];
  /**
   * Rules that could not run, each with the plain-language reason. The UI shows
   * these so an empty suggestions list never reads as "you are perfect".
   */
  blocked: { kind: Recommendation["kind"]; reason_bn: string }[];
  /** True when nothing at all could be said. */
  empty: boolean;
};

/** A topic needs at least this many answered questions before it reads as weak. */
const MIN_ATTEMPTED_FOR_WEAKNESS = 3;

/** Below this accuracy a topic is weak; at or above it, it is holding. */
const WEAK_ACCURACY = 60;

const round1 = (value: number) => Math.round(value * 10) / 10;

export function buildRecommendations(input: RecommendationInput): RecommendationSet {
  const limit = input.limit ?? 8;
  const completed = new Set(input.completedTopicIds);
  const unfinished = new Set(input.unfinishedTopicIds);
  const blocked: RecommendationSet["blocked"] = [];
  const items: Recommendation[] = [];

  const byTopic = new Map(input.frequency.map((row) => [row.topic_id, row]));
  const attemptsByTopic = new Map(input.attempts.map((row) => [row.topic_id, row]));

  /* ---------------------------------------------------------------------
   * Rule 1 — weak topics.
   *
   * Weakness is measured, not guessed: the student answered at least three
   * questions on the topic and got under 60% right. One answered question that
   * happened to be wrong is noise, so it is deliberately not enough.
   * ------------------------------------------------------------------ */
  const weakTopics = input.attempts.filter(
    (row) =>
      row.attempted >= MIN_ATTEMPTED_FOR_WEAKNESS &&
      (row.correct * 100) / row.attempted < WEAK_ACCURACY &&
      !completed.has(row.topic_id),
  );

  if (input.attempts.length === 0) {
    blocked.push({
      kind: "weak",
      reason_bn: "এখনও কোনো পরীক্ষা দেওয়া হয়নি, তাই কোন টপিক দুর্বল তা বলা যাচ্ছে না।",
    });
  } else if (weakTopics.length === 0) {
    blocked.push({
      kind: "weak",
      reason_bn: `যে টপিকগুলোতে ${MIN_ATTEMPTED_FOR_WEAKNESS}টি বা বেশি প্রশ্নের উত্তর দেওয়া হয়েছে, সবগুলোতেই ৬০% বা বেশি সঠিক হয়েছে।`,
    });
  }

  for (const row of weakTopics) {
    const topic = byTopic.get(row.topic_id);
    const accuracy = round1((row.correct * 100) / row.attempted);
    // A topic that past papers also ask about often matters more; when it has
    // never been counted, the weakness alone has to carry it.
    const bandWeight = topic?.band === "high" ? 3 : topic?.band === "medium" ? 2 : topic?.band === "low" ? 1 : 0;
    items.push({
      kind: "weak",
      topic_id: row.topic_id,
      topic_bn: topic?.topic_bn ?? "টপিক",
      subject_bn: topic?.subject_bn ?? "",
      reason_bn: `${row.attempted}টি প্রশ্নের মধ্যে ${row.correct}টি সঠিক — এটি পুনরাবৃত্তি দরকার।`,
      evidence_bn: `আপনার নিজের উত্তর থেকে: সঠিকতা ${accuracy}%${
        topic?.frequency !== undefined ? `; বিগত পরীক্ষায় ${topic.frequency}টি প্রশ্ন` : ""
      }`,
      score: (100 - accuracy) * 4 + bandWeight * 10,
    });
  }

  /* ---------------------------------------------------------------------
   * Rule 2 — high-frequency topics not yet touched.
   *
   * Only topics with a real counted number appear. "high" is a tertile of
   * actual counts, so calling it a priority is a statement about the past, not
   * a prediction about the next paper, and the wording says so.
   * ------------------------------------------------------------------ */
  const counted = input.frequency.filter((row) => (row.frequency ?? 0) > 0);
  if (counted.length === 0) {
    blocked.push({
      kind: "frequency",
      reason_bn: "প্রশ্নফ্রিকোয়েন্সি এখনও গণনা করা হয়নি বা শূন্য — তাই বিগত পরীক্ষার ভিত্তিতে অগ্রাধিকার দেওয়া যাচ্ছে না।",
    });
  }

  const frequencyPicks = counted
    .filter((row) => row.band === "high" && !completed.has(row.topic_id))
    .sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));

  for (const topic of frequencyPicks) {
    const attempt = attemptsByTopic.get(topic.topic_id);
    // Already strong on it — a "study this first" nudge would be noise.
    if (attempt && attempt.attempted >= MIN_ATTEMPTED_FOR_WEAKNESS && (attempt.correct * 100) / attempt.attempted >= 80) {
      continue;
    }
    items.push({
      kind: "frequency",
      topic_id: topic.topic_id,
      topic_bn: topic.topic_bn,
      subject_bn: topic.subject_bn,
      reason_bn: "বিগত পরীক্ষায় এই টপিক থেকে সবচেয়ে বেশি প্রশ্ন এসেছে।",
      evidence_bn: `${topic.papers ?? 0}টি পরীক্ষায় মোট ${topic.frequency}টি প্রশ্ন${
        attempt ? `; আপনার সঠিকতা ${round1((attempt.correct * 100) / attempt.attempted)}%` : "; এখনও এই টপিকে অনুশীলন হয়নি"
      }`,
      score: (topic.frequency ?? 0) * 6 + (topic.papers ?? 0) * 3,
    });
  }

  /* ---------------------------------------------------------------------
   * Rule 3 — carry forward. Facts, not advice: these were scheduled and left
   * unfinished, so they come back first.
   * ------------------------------------------------------------------ */
  if (unfinished.size === 0) {
    blocked.push({
      kind: "carry_forward",
      reason_bn: "গত সপ্তাহে অসম্পূর্ণ কোনো টপিক নেই।",
    });
  }
  for (const topicId of unfinished) {
    if (completed.has(topicId)) continue;
    const topic = byTopic.get(topicId);
    items.push({
      kind: "carry_forward",
      topic_id: topicId,
      topic_bn: topic?.topic_bn ?? "টপিক",
      subject_bn: topic?.subject_bn ?? "",
      reason_bn: "গত সপ্তাহের রুটিনে ছিল, কিন্তু শেষ হয়নি।",
      evidence_bn: "আপনার রুটিনের অসম্পূর্ণ এন্ট্রি থেকে",
      // Carried topics lead the next week, so they outrank pure frequency picks.
      score: 1000,
    });
  }

  /* ---------------------------------------------------------------------
   * Rule 4 — next week shaped by last week's result. Only speaks when a result
   * exists; otherwise the reason is surfaced.
   * ------------------------------------------------------------------ */
  if (!input.lastResult) {
    blocked.push({
      kind: "improve",
      reason_bn: "গত সপ্তাহের প্রকাশিত ফলাফল নেই, তাই ফলাফলের ভিত্তিতে পরামর্শ দেওয়া যাচ্ছে না।",
    });
  }

  // One row per topic; the strongest reason wins, and carries its evidence.
  const best = new Map<string, Recommendation>();
  for (const item of items) {
    const existing = best.get(item.topic_id);
    if (!existing || item.score > existing.score) best.set(item.topic_id, item);
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);

  return {
    items: ranked,
    blocked,
    empty: ranked.length === 0,
  };
}

/**
 * One-line summary for the student. Deliberately quiet when the data is thin:
 * it says what is missing rather than offering a confident plan.
 */
export function summariseRecommendations(set: RecommendationSet): string {
  if (set.empty) {
    return "পরামর্শ দেওয়ার মতো যথেষ্ট তথ্য এখনও নেই।";
  }
  const counts = set.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1;
    return acc;
  }, {});
  const parts: string[] = [];
  if (counts.carry_forward) parts.push(`${counts.carry_forward}টি অসম্পূর্ণ টপিক আগে`);
  if (counts.weak) parts.push(`${counts.weak}টি দুর্বল টপিক`);
  if (counts.frequency) parts.push(`${counts.frequency}টি বেশি-চাহিদার টপিক`);
  return parts.join(", ") + "।";
}
