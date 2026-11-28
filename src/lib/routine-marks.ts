/**
 * Exam marks distribution for the routine page's instruction bar.
 *
 * The bar shows marks only — never study minutes, never exam duration, never a
 * question count. So this module resolves *marks* and nothing else.
 *
 * Sources, most specific first:
 *
 *   1. An active `exam_schedules` row for the course — its `settings.marks_split`
 *      is the live configuration the actual exam will use.
 *   2. `exam_marks` rows (নম্বর বিভাজন) at the preliminary stage.
 *   3. `courses.exam_config.priority_marks` — a per-course admin override.
 *   4. Nothing. The bar then hides rather than printing an invented number.
 *
 * BCS Preliminary is the only course whose priority split (50/25/15/10) is
 * verified, so it is the only hardcoded fallback and it is scoped to that course
 * id. Everything else must come from configuration.
 */

export type MarksItem = { label: string; marks: number };

/**
 * BCS Preliminary's verified split. Scoped to its course id on purpose: a global
 * default would quietly attach BCS marks to an unrelated course, which is the
 * exact failure the marks configuration is meant to prevent.
 */
export const BCS_COURSE_ID = "599509ae-c4c3-440a-9463-802a4efc7a0c";

export const BCS_PRIORITY_MARKS: MarksItem[] = [
  { label: "P1", marks: 50 },
  { label: "P2", marks: 25 },
  { label: "P3/P4", marks: 15 },
  { label: "পূর্ববর্তী/রিভিশন", marks: 10 },
];

type MarksSplitSettings = Record<string, unknown> | null | undefined;

/** Narrow `settings.marks_split` into items, tolerating key styling. */
export function parseMarksSplit(settings: MarksSplitSettings): MarksItem[] | null {
  const split = (settings as { marks_split?: unknown } | null)?.marks_split;
  if (!split || typeof split !== "object" || Array.isArray(split)) return null;

  const items: MarksItem[] = [];
  for (const [label, value] of Object.entries(split as Record<string, unknown>)) {
    const marks = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(marks) || marks <= 0) continue;
    items.push({ label, marks });
  }
  return items.length > 0 ? items : null;
}

/** Narrow `courses.exam_config.priority_marks` into items. */
export function parsePriorityMarks(examConfig: unknown): MarksItem[] | null {
  const config = examConfig as Record<string, unknown> | null;
  if (!config) return null;
  const raw = config.priority_marks;
  if (!raw) return null;

  // Accept both `{ P1: 50 }` and `[{ label, marks }]` so an admin can write
  // whichever shape their editor produces.
  if (Array.isArray(raw)) {
    const items: MarksItem[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const { label, marks } = entry as Record<string, unknown>;
      const value = typeof marks === "number" ? marks : Number(marks);
      if (typeof label !== "string" || !Number.isFinite(value) || value <= 0) continue;
      items.push({ label, marks: value });
    }
    return items.length > 0 ? items : null;
  }
  if (typeof raw === "object") {
    return parseMarksSplit({ marks_split: raw });
  }
  return null;
}

/**
 * Resolve the marks distribution to show, or null when the course has none.
 * `null` is the honest answer for a course without a verified pattern, and the
 * bar hides instead of showing zeroes.
 */
export function resolvePriorityMarks(input: {
  courseId: string;
  examSettings?: MarksSplitSettings;
  examConfig?: unknown;
}): { items: MarksItem[]; source: "exam" | "config" | "bcs" | "none" } {
  const fromExam = parseMarksSplit(input.examSettings);
  if (fromExam) return { items: fromExam, source: "exam" };

  const fromConfig = parsePriorityMarks(input.examConfig);
  if (fromConfig) return { items: fromConfig, source: "config" };

  if (input.courseId === BCS_COURSE_ID) {
    return { items: BCS_PRIORITY_MARKS, source: "bcs" };
  }

  return { items: [], source: "none" };
}

/** Bengali numerals for marks: 50 → ৫০, 0.5 → ০.৫০. */
export function bnMarks(value: number): string {
  const digits = "০১২৩৪৫৬৭৮৯";
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return text.replace(/\d/g, (digit) => digits[Number(digit)]);
}
