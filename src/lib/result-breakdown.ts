/**
 * Section / topic breakdown of a released attempt review — pure maths over the
 * items jh_get_attempt_review returns, so the 90:10 split, per-subject marks
 * and weak-topic picks are unit-testable.
 */

export type BreakdownInput = {
  subject_id: string | null;
  topic_id: string | null;
  selected_option: number | null;
  is_correct: boolean;
};

export type SectionStat = {
  id: string;
  role: "main" | "secondary" | null;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
  maxMarks: number;
  accuracy: number;
};

export type TopicStat = {
  id: string;
  subjectId: string | null;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  accuracy: number;
};

function accuracyOf(correct: number, attempted: number): number {
  return attempted === 0 ? 0 : Math.round((correct / attempted) * 1000) / 10;
}

export function computeSubjectBreakdown(
  items: BreakdownInput[],
  options: {
    positiveMarks: number;
    negativeMarks: number;
    mainSubjectId?: string | null;
    secondarySubjectId?: string | null;
  },
): SectionStat[] {
  const bySubject = new Map<string, { total: number; correct: number; wrong: number; unanswered: number }>();
  for (const item of items) {
    const key = item.subject_id ?? "unknown";
    const entry = bySubject.get(key) ?? { total: 0, correct: 0, wrong: 0, unanswered: 0 };
    entry.total += 1;
    if (item.selected_option === null) entry.unanswered += 1;
    else if (item.is_correct) entry.correct += 1;
    else entry.wrong += 1;
    bySubject.set(key, entry);
  }

  const stats: SectionStat[] = [...bySubject.entries()].map(([id, entry]) => ({
    id,
    role:
      id === options.mainSubjectId ? ("main" as const) : id === options.secondarySubjectId ? ("secondary" as const) : null,
    ...entry,
    marks:
      Math.round((entry.correct * options.positiveMarks - entry.wrong * options.negativeMarks) * 100) / 100,
    maxMarks: Math.round(entry.total * options.positiveMarks * 100) / 100,
    accuracy: accuracyOf(entry.correct, entry.correct + entry.wrong),
  }));

  // Main first, then secondary, then the rest by size.
  const order = (stat: SectionStat) => (stat.role === "main" ? 0 : stat.role === "secondary" ? 1 : 2);
  return stats.sort((a, b) => order(a) - order(b) || b.total - a.total);
}

export function computeTopicBreakdown(items: BreakdownInput[]): TopicStat[] {
  const byTopic = new Map<string, TopicStat>();
  for (const item of items) {
    if (!item.topic_id) continue;
    const entry = byTopic.get(item.topic_id) ?? {
      id: item.topic_id, subjectId: item.subject_id, total: 0, correct: 0, wrong: 0, unanswered: 0, accuracy: 0,
    };
    entry.total += 1;
    if (item.selected_option === null) entry.unanswered += 1;
    else if (item.is_correct) entry.correct += 1;
    else entry.wrong += 1;
    byTopic.set(item.topic_id, entry);
  }
  return [...byTopic.values()]
    .map((entry) => ({ ...entry, accuracy: accuracyOf(entry.correct, entry.correct + entry.wrong) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Weak topics = enough questions to mean something (≥2 seen) and under 60%
 * accuracy counting unanswered as missed knowledge. Sorted weakest first.
 */
export function weakTopics(topics: TopicStat[], limit = 5): TopicStat[] {
  return topics
    .filter((topic) => topic.total >= 2 && topic.correct / topic.total < 0.6)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, limit);
}
