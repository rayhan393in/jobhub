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
/**
 * Slot order within a day: P1 → P2 → P3/P4 → MCQ → everything else.
 *
 * The slot label is `P1 Main · সকাল ৭:০০–৯:৩০`, and sorting that text
 * alphabetically would put `MCQ …` before `P1 …` and break the day's
 * chronology. Only the *first* occurrence of a slot contributes its label, so
 * merged subject lines keep the position of the slot that opened them.
 */
const SLOT_ORDER = ["P1 Main", "P2 Second", "P3/P4 Third", "MCQ"];

function slotRank(slots: string[]): number {
  const first = slots[0];
  if (!first) return SLOT_ORDER.length;
  const index = SLOT_ORDER.findIndex((slot) => first.startsWith(slot));
  return index === -1 ? SLOT_ORDER.length : index;
}

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
  // Stable sort: slots in clock order, then the first-seen order within a slot.
  return lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => slotRank(a.line.slots) - slotRank(b.line.slots) || a.index - b.index)
    .map(({ line }) => line);
}

/**
 * Day 1 of the plan is 28 Nov 2026 (শনিবার); day 90 is 25 Feb 2027.
 *
 * The 90-day sheet is a fixed, dated plan — the same three phases the PDF
 * prints. Phase boundaries live here rather than being re-typed per view, so
 * the heading under a day can never disagree with the day's number.
 */
export const PLAN_START = "2026-11-28";

export const PHASES: { from: number; to: number; label: string }[] = [
  { from: 1, to: 30, label: "ফেজ ১ · বাংলা ও English" },
  { from: 31, to: 60, label: "ফেজ ২ · English ও বাংলাদেশ" },
  { from: 61, to: 90, label: "ফেজ ৩ · বাকি Subject ও সমাপ্তি" },
];

export function phaseForDay(day: number): { from: number; to: number; label: string } | null {
  return PHASES.find((phase) => day >= phase.from && day <= phase.to) ?? null;
}

/** The three study columns of the daily grid, in clock order. */
export type GridSlot = "p1" | "p2" | "p3";

export const GRID_SLOTS: { slot: GridSlot; title: string; minutes: number; dot: string }[] = [
  { slot: "p1", title: "Main — P1", minutes: 150, dot: "#d03030" },
  { slot: "p2", title: "Second — P2", minutes: 75, dot: "#d97a06" },
  { slot: "p3", title: "Third — P3/P4", minutes: 45, dot: "#1f9d55" },
];

/** Which grid column a routine row's slot label belongs to. */
export function gridSlotFor(slotLabel: string | null): GridSlot | null {
  if (!slotLabel) return null;
  if (slotLabel.startsWith("P1 Main")) return "p1";
  if (slotLabel.startsWith("P2 Second")) return "p2";
  if (slotLabel.startsWith("P3/P4 Third")) return "p3";
  return null;
}

/**
 * The nightly MCQ block is derived from the published MCQ row rather than
 * hard-coded: its focus note carries the official split
 * (P1 ৫০ + P2 ২৫ + P3/P4 ১৫ + পূর্বে-পড়া ১০ = ১০০). If the plan's split ever
 * changes, the table on screen follows the plan, not this file.
 */
export const MCQ_DEFAULT_SPLIT = { p1: 50, p2: 25, p3: 15, revisit: 10 };

export function parseMcqSplit(note: string | null | undefined): {
  p1: number;
  p2: number;
  p3: number;
  revisit: number;
} {
  if (!note) return MCQ_DEFAULT_SPLIT;
  const num = (pattern: RegExp) => {
    const match = note.match(pattern);
    return match ? Number.parseInt(match[1], 10) : 0;
  };
  // The note is Bengali-numeral text; only trust it when all four are found.
  const p1 = num(/P1\s*([0-9]+)/);
  const p2 = num(/P2\s*([0-9]+)/);
  const p3 = num(/P3\/P4\s*([0-9]+)/);
  const revisit = num(/পূর্বে-পড়া\s*([0-9]+)/);
  if (!p1 || !p2 || !p3 || !revisit) return MCQ_DEFAULT_SPLIT;
  return { p1, p2, p3, revisit };
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
