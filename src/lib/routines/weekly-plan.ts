/**
 * Weekly study plan maths.
 *
 * The spec asks for a week-at-a-time plan (2–3 subjects a day, with the topics
 * and subtopics named), a weekly exam built from exactly that week's topics, and
 * unfinished topics rolling into the next week.
 *
 * All of that is arithmetic over the syllabus, so it lives here — dependency
 * free, no database, no React — and is unit-tested against the real shape of
 * the BCS syllabus. Nothing in this file invents a topic: every id it emits was
 * passed in.
 */

export type FrequencyBand = "high" | "medium" | "low" | "none";

export type SyllabusTopic = {
  id: string;
  subject_id: string;
  title_bn: string;
  /** Counted questions from past papers, when any real count exists. */
  frequency?: number;
  band?: FrequencyBand;
};

export type SyllabusSubject = {
  id: string;
  title_bn: string;
  topics: SyllabusTopic[];
};

export type PlanSlot = {
  date: string;
  week_index: number;
  subject_id: string;
  topic_id: string;
  subtopic_id: string | null;
  minutes: number;
  task_kind: "study" | "practice" | "revision";
  title_bn: string;
  focus_note_bn: string;
};

export type WeekPlanOptions = {
  /** ISO Monday of the week, YYYY-MM-DD. */
  weekStart: string;
  weekIndex: number;
  dailyMinutes: number;
  /** How many distinct subjects a single day should carry (2–3 per the spec). */
  subjectsPerDay?: number;
  /** Topic ids already finished — they are never scheduled again. */
  completedTopicIds?: Iterable<string>;
  /** Topics carried over from last week, scheduled first. */
  priorityTopicIds?: Iterable<string>;
};

const BAND_WEIGHT: Record<FrequencyBand, number> = {
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ISO Monday of the week containing `dateKey`. */
export function mondayOf(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay(); // 0 = Sunday
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, offset);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/**
 * Order topics by evidence, then by syllabus order.
 *
 * A topic with a real counted frequency always outranks one without, and among
 * counted topics the higher count wins. Ties fall back to syllabus order so the
 * plan is stable between runs — a plan that reshuffles on every refresh is
 * impossible to follow.
 */
export function rankTopics(topics: SyllabusTopic[], priorityIds: Set<string> = new Set()): SyllabusTopic[] {
  return [...topics].sort((a, b) => {
    const aPriority = priorityIds.has(a.id) ? 1 : 0;
    const bPriority = priorityIds.has(b.id) ? 1 : 0;
    if (aPriority !== bPriority) return bPriority - aPriority;

    const aBand = BAND_WEIGHT[a.band ?? "none"];
    const bBand = BAND_WEIGHT[b.band ?? "none"];
    if (aBand !== bBand) return bBand - aBand;

    const aFreq = a.frequency ?? 0;
    const bFreq = b.frequency ?? 0;
    if (aFreq !== bFreq) return bFreq - aFreq;

    return a.title_bn.localeCompare(b.title_bn, "bn");
  });
}

/**
 * Build one week of study slots.
 *
 * Rules, in order:
 *  1. Unfinished/priority topics come first, so a topic the student did not
 *     finish last week is the first thing they see this week.
 *  2. Each day gets `subjectsPerDay` distinct subjects while enough remain.
 *  3. Days with the most weekly weight are touched by the most subjects.
 *  4. Every topic appears at most once in the week, so "this week's topics" is
 *     a well-defined set for the weekly exam.
 *  5. If the syllabus runs out, the week is shorter — it never repeats a topic
 *     just to fill seven days, and never invents one.
 */
export function buildWeekPlan(
  subjects: SyllabusSubject[],
  options: WeekPlanOptions,
): PlanSlot[] {
  const {
    weekStart,
    weekIndex,
    dailyMinutes,
    subjectsPerDay = 3,
    completedTopicIds = [],
    priorityTopicIds = [],
  } = options;

  const completed = new Set(completedTopicIds);
  const priority = new Set(priorityTopicIds);
  const perDay = Math.max(1, Math.min(4, Math.round(subjectsPerDay)));

  const usable = subjects
    .map((subject) => ({
      subject,
      topics: rankTopics(
        subject.topics.filter((topic) => !completed.has(topic.id)),
        priority,
      ),
    }))
    .filter((entry) => entry.topics.length > 0);

  const totalTopics = usable.reduce((sum, entry) => sum + entry.topics.length, 0);
  if (totalTopics === 0) return [];

  // The spec wants 2–3 subjects every single day. Dealing topics out to a fixed
  // seven days would leave the tail days with one or none, so the week is only
  // as long as it has topics to fill: at least two subjects per day, never more
  // than seven days. A 9-topic syllabus therefore makes a 4-day week of 3/2/2/2
  // rather than a 7-day week that peters out.
  const minPerDay = Math.min(2, totalTopics);
  const days = Math.max(1, Math.min(7, Math.floor(totalTopics / minPerDay)));

  const cursors = new Map<string, number>(usable.map((entry) => [entry.subject.id, 0]));
  const nextTopic = (subjectId: string) => {
    const entry = usable.find((candidate) => candidate.subject.id === subjectId);
    if (!entry) return undefined;
    return entry.topics[cursors.get(subjectId) ?? 0];
  };

  const dates = weekDates(weekStart).slice(0, days);
  const slots: PlanSlot[] = [];
  let dealt = 0;

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
    const date = dates[dayIndex];
    const remaining = usable.filter((entry) => {
      const cursor = cursors.get(entry.subject.id) ?? 0;
      return cursor < entry.topics.length;
    });
    if (remaining.length === 0) break;

    // Lead with the subject whose *next* topic is most important, so a topic
    // carried over from last week is genuinely the first thing in the week —
    // not merely first inside its own subject.
    const ranked = [...remaining].sort((a, b) => {
      const aTopic = nextTopic(a.subject.id);
      const bTopic = nextTopic(b.subject.id);
      const aWeight = (priority.has(aTopic?.id ?? "") ? 100 : 0) + BAND_WEIGHT[aTopic?.band ?? "none"];
      const bWeight = (priority.has(bTopic?.id ?? "") ? 100 : 0) + BAND_WEIGHT[bTopic?.band ?? "none"];
      if (aWeight !== bWeight) return bWeight - aWeight;
      return bTopic?.frequency && aTopic?.frequency ? bTopic.frequency - aTopic.frequency : 0;
    });

    // Never deal more subjects than there are topics left, and never leave a
    // day with a single subject while another subject still has topics. Days
    // are dealt evenly (ceil of what is left over what remains), which is what
    // keeps the tail of the week from collapsing to one subject a day.
    const daysLeft = dates.length - dayIndex;
    const topicsLeft = totalTopics - dealt;
    const quota = Math.min(
      remaining.length,
      Math.max(Math.min(2, remaining.length), Math.min(perDay, Math.ceil(topicsLeft / daysLeft))),
    );
    const chosen = ranked.slice(0, quota);

    // Alternate the lead subject on odd days so no subject always opens the day.
    if (dayIndex % 2 === 1 && chosen.length > 1) {
      chosen.push(chosen.shift()!);
    }

    for (const entry of chosen) {
      const cursor = cursors.get(entry.subject.id) ?? 0;
      const topic = entry.topics[cursor];
      if (!topic) continue;
      cursors.set(entry.subject.id, cursor + 1);
      dealt += 1;

      const bandLabel =
        topic.band === "high" ? "হাই-ফ্রিকোয়েন্সি"
        : topic.band === "medium" ? "মিড-ফ্রিকোয়েন্সি"
        : topic.band === "low" ? "লো-ফ্রিকোয়েন্সি"
        : "";
      const frequencyNote = topic.frequency
        ? `${topic.frequency}টি প্রশ্ন (${bandLabel})`
        : "নমুনা প্রশ্নসংখ্যার তথ্য নেই";

      slots.push({
        date,
        week_index: weekIndex,
        subject_id: entry.subject.id,
        topic_id: topic.id,
        subtopic_id: null,
        minutes: Math.max(15, Math.round(dailyMinutes / chosen.length)),
        task_kind: dayIndex === dates.length - 1 && dates.length > 2 ? "revision" : "study",
        title_bn: topic.title_bn,
        focus_note_bn: `${entry.subject.title_bn} · ${frequencyNote}`,
      });
    }
  }

  return slots;
}

/**
 * The weekly exam draws from these topics — and only these.
 * Returns one composition item per subject, with each topic's share of the
 * paper proportional to how much of the week it actually occupied.
 */
export function weeklyExamComposition(
  slots: PlanSlot[],
  questionCount: number,
): { subject_id: string; topic_id: string; count: number }[] {
  if (slots.length === 0 || questionCount < 1) return [];

  const byTopic = new Map<string, { subject_id: string; topic_id: string; weight: number }>();
  for (const slot of slots) {
    const key = `${slot.subject_id}:${slot.topic_id}`;
    const current = byTopic.get(key);
    if (current) current.weight += slot.minutes;
    else byTopic.set(key, { subject_id: slot.subject_id, topic_id: slot.topic_id, weight: slot.minutes });
  }

  const items = [...byTopic.values()];
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return [];

  // Largest-remainder apportionment: floor everything, then hand the leftover
  // questions to the largest fractional parts. Guarantees the counts sum to
  // exactly questionCount without favouring the first item.
  const total = Math.max(1, Math.min(questionCount, items.length === 0 ? 0 : questionCount));
  const raw = items.map((item) => ({ ...item, exact: (item.weight / totalWeight) * total }));
  const counts = raw.map((item) => Math.max(1, Math.floor(item.exact)));
  let assigned = counts.reduce((sum, value) => sum + value, 0);

  if (assigned > total) {
    // More topics than questions: keep the heaviest, drop the rest.
    const order = raw
      .map((item, index) => ({ index, exact: item.exact }))
      .sort((a, b) => b.exact - a.exact);
    const keep = new Set(order.slice(0, total).map((item) => item.index));
    return raw
      .map((item, index) => ({ item, index }))
      .filter((entry) => keep.has(entry.index))
      .map((entry) => ({ subject_id: entry.item.subject_id, topic_id: entry.item.topic_id, count: 1 }));
  }

  const remainders = raw
    .map((item, index) => ({ index, fraction: item.exact - Math.floor(item.exact) }))
    .sort((a, b) => b.fraction - a.fraction);

  let cursor = 0;
  while (assigned < total && remainders.length > 0) {
    const target = remainders[cursor % remainders.length];
    counts[target.index] += 1;
    assigned += 1;
    cursor += 1;
  }

  return raw.map((item, index) => ({
    subject_id: item.subject_id,
    topic_id: item.topic_id,
    count: counts[index],
  }));
}

/**
 * How many questions of each difficulty bucket a paper of `count` must carry
 * under a percentage mix. The remainder always lands on `previous`, which is
 * the category the spec puts first.
 */
export function difficultyTargets(
  count: number,
  mix: Record<string, number> = { previous: 60, hard: 20, easy: 10, medium: 10 },
): Record<"previous" | "hard" | "easy" | "medium", number> {
  const order = ["previous", "hard", "easy", "medium"] as const;
  const total = order.reduce((sum, key) => sum + (mix[key] ?? 0), 0);
  if (count < 1) return { previous: 0, hard: 0, easy: 0, medium: 0 };
  if (total !== 100) {
    throw new Error(`Difficulty mix must total 100, got ${total}`);
  }

  const result = { previous: 0, hard: 0, easy: 0, medium: 0 };
  let assigned = 0;
  for (const key of order) {
    result[key] = Math.floor((count * (mix[key] ?? 0)) / 100);
    assigned += result[key];
  }
  result.previous += count - assigned;
  return result;
}
