/**
 * Shared day-block builder for the published study routine.
 *
 * Both the student web view (/routines) and the printable PDF sheet
 * (/routines/print) MUST render the exact same schedule: same merged
 * subject lines, same টপিক → সাবটপিক pairing (from study_plan_assignments),
 * same day numbering. Keeping the logic here guarantees the two views can
 * never drift apart again.
 */

export type TopicLine = { topic: string; subtopics: string[] };

export type RoutineLineInput = {
  id: string;
  routine_date: string;
  title_bn: string;
  subject_title_bn: string | null;
  minutes: number;
  slot_label: string | null;
  task_kind: string;
  focus_note_bn: string | null;
  topics: TopicLine[];
};

/** One rendered line of a day block (বিষয় | টপিক → সাবটপিক). */
export type DayLine = {
  key: string;
  label: string; // subject name, or the activity title when no subject
  kind: string;
  minutes: number;
  slots: string[];
  topics: TopicLine[];
  note: string | null;
};

export const KIND_LABELS: Record<string, string> = {
  study: "পড়া",
  practice: "প্র্যাকটিস",
  revision: "রিভিশন",
  exam: "পরীক্ষা",
  rest: "বিশ্রাম",
};

/** Day 1 is the earliest PUBLISHED date of the course, not the first shown date. */
export function dayNumber(date: string, planStart: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${planStart}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Collapse one day's routine rows into printable lines:
 *  * study rows of the same subject merge into one line (total minutes,
 *    united topic list — multi-slot deep work stays one row);
 *  * the nightly generic "দৈনিক রিভিশন" filler (no subject, no topics) is
 *    kept in the app for tracking but omitted from the schedule view;
 *  * course-level activities (weekly exam/revision, mock, rest) stay as-is.
 */
export function buildDayLines(items: RoutineLineInput[]): DayLine[] {
  const lines: DayLine[] = [];
  const bySubject = new Map<string, DayLine>();

  for (const item of items) {
    if (
      item.task_kind === "revision" &&
      !item.subject_title_bn &&
      item.topics.length === 0 &&
      item.title_bn.startsWith("দৈনিক রিভিশন")
    ) {
      continue;
    }

    if (item.subject_title_bn) {
      const mergeKey = `${item.task_kind}:${item.subject_title_bn}`;
      const existing = bySubject.get(mergeKey);
      if (existing) {
        existing.minutes += item.minutes;
        if (item.slot_label) existing.slots.push(item.slot_label);
        for (const line of item.topics) {
          const match = existing.topics.find((t) => t.topic === line.topic);
          if (match) match.subtopics.push(...line.subtopics.filter((s) => !match.subtopics.includes(s)));
          else existing.topics.push({ topic: line.topic, subtopics: [...line.subtopics] });
        }
        if (!existing.note && item.focus_note_bn) existing.note = item.focus_note_bn;
        continue;
      }
      const line: DayLine = {
        key: item.id,
        label: item.subject_title_bn,
        kind: item.task_kind,
        minutes: item.minutes,
        slots: item.slot_label ? [item.slot_label] : [],
        topics: item.topics.map((t) => ({ topic: t.topic, subtopics: [...t.subtopics] })),
        note: item.focus_note_bn,
      };
      bySubject.set(mergeKey, line);
      lines.push(line);
    } else {
      lines.push({
        key: item.id,
        label: item.title_bn,
        kind: item.task_kind,
        minutes: item.minutes,
        slots: item.slot_label ? [item.slot_label] : [],
        topics: item.topics,
        note: item.focus_note_bn,
      });
    }
  }
  return lines;
}

/** Attach টপিক → সাবটপিক pairs (study_plan_assignments) to each routine row. */
export function topicsForRoutine(
  assigned: Map<string, string[]> | undefined,
  topicTitles: string[] | null | undefined,
  subtopicTitles: string[] | null | undefined,
): TopicLine[] {
  if (assigned) {
    return [...assigned.entries()].map(([topic, subtopics]) => ({ topic, subtopics }));
  }
  const topics = topicTitles ?? [];
  return topics.map((topic, _i, arr) => ({
    topic,
    // Legacy rows without assignments: attach the row's subtopics to its
    // single topic; with several topics the pairing is unknown.
    subtopics: arr.length === 1 ? (subtopicTitles ?? []) : [],
  }));
}
