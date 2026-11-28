import { NextResponse } from "next/server";
import { assertSameOrigin, requireApiPermission } from "@/lib/api";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { parseCsvRows, slotLabel, validateRoutineRows, weekMeta } from "@/lib/routines/parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/admin/routines/import
 *
 * Routine CSV → published routine rows, in one call.
 *
 * Two-phase on purpose (`mode: "dry_run"` then `"commit"`): a coaching routine
 * is 30–90 rows, and a half-applied file is worse than a rejected one. The dry
 * run resolves every subject/topic name to a real syllabus row and reports the
 * ones it could not find *before* anything is written.
 *
 * Matching is by name, case-insensitively, and a missing syllabus row is an
 * error rather than something to invent — that is where a routine stops being
 * real. `createMissingTopics` is opt-in for the case where the file is the
 * source of truth and the syllabus is behind.
 */

const bodySchema = z.object({
  courseId: z.string().uuid(),
  mode: z.enum(["dry_run", "commit"]).default("dry_run"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  defaultMinutes: z.number().int().min(5).max(480).default(60),
  createMissingTopics: z.boolean().default(false),
  /** Replaces the published daily routines for this course in the date range. */
  replace: z.boolean().default(true),
  filename: z.string().trim().max(160).optional().default("routine.csv"),
  content: z.string().min(1).max(2_000_000),
});

type SubjectRow = { id: string; title_bn: string; title_en: string | null };
type TopicRow = { id: string; subject_id: string; title_bn: string; title_en: string | null };
type SubtopicRow = { id: string; topic_id: string; title_bn: string };

/**
 * Name matching for syllabus rows.
 *
 * Beyond case and spacing this folds the punctuation that differs between a
 * spreadsheet and the syllabus without changing the words: an arrow, an en or
 * em dash and a hyphen all become a single hyphen, and the soft hyphen and
 * zero-width joiners are dropped. "Subject-verb agreement → Subject–verb
 * agreement" therefore matches the syllabus row "Subject-verb agreement".
 */
const normalise = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\u200b-\u200d\u00ad]/g, "")
    .replace(/\s*[→←↔–—>-]+>?\s*/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim();

/**
 * For a topic written as "A → B", also try the text before the arrow. The CSV
 * carries the parent topic on the left and the leaf on the right; the syllabus
 * stores the leaf only.
 */
const topicCandidates = (value: string): string[] => {
  const parts = value.split(/[→←↔]/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? [...parts.reverse(), value.trim()] : [value.trim()];
};

export async function POST(request: Request) {
  const guard = await requireApiPermission("routine.manage");
  if ("error" in guard) return guard.error;
  const { user } = guard;

  if (!assertSameOrigin(request)) return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 422 });
  }

  const supabase = await getServerClient();
  if (!supabase) return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });

  const { data: course } = await supabase
    .from("courses")
    .select("id, title_bn, status")
    .eq("id", body.courseId)
    .maybeSingle();
  if (!course) return NextResponse.json({ error: "কোর্স পাওয়া যায়নি।" }, { status: 404 });

  const rows = parseCsvRows(body.content);
  if (rows.length === 0) {
    return NextResponse.json({ error: "ফাইলে কোনো সারি পাওয়া যায়নি।" }, { status: 422 });
  }
  if (rows.length > 400) {
    return NextResponse.json({ error: "একবারে সর্বোচ্চ ৪০০ সারি ইমপোর্ট করা যায়।" }, { status: 413 });
  }

  const parsed = validateRoutineRows(rows, {
    startDate: body.startDate,
    defaultMinutes: body.defaultMinutes,
  });

  // Resolve names → ids against the real syllabus.
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, title_bn, title_en")
    .eq("course_id", body.courseId)
    .eq("is_active", true);

  const subjectRows = (subjects ?? []) as SubjectRow[];
  const subjectById = new Map(subjectRows.map((row) => [row.id, row]));
  const subjectByName = new Map<string, SubjectRow>();
  for (const row of subjectRows) {
    subjectByName.set(normalise(row.title_bn), row);
    if (row.title_en) subjectByName.set(normalise(row.title_en), row);
  }

  const subjectIds = subjectRows.map((row) => row.id);
  const { data: topics } = subjectIds.length
    ? await supabase
        .from("topics")
        .select("id, subject_id, title_bn, title_en")
        .in("subject_id", subjectIds)
        .eq("is_active", true)
    : { data: [] as TopicRow[] };

  const topicRows = (topics ?? []) as TopicRow[];

  // Subtopics are what the spec calls "নির্দিষ্ট Topics ও Subtopics" — a routine
  // row that names one must resolve to the real row, or the daily exam has a
  // narrower pool than the routine promised.
  const topicIds = topicRows.map((row) => row.id);
  const { data: subtopics } = topicIds.length
    ? await supabase
        .from("subtopics")
        .select("id, topic_id, title_bn")
        .in("topic_id", topicIds)
        .eq("is_active", true)
    : { data: [] as SubtopicRow[] };

  const subtopicRows = (subtopics ?? []) as SubtopicRow[];
  const subtopicByName = new Map<string, SubtopicRow>();
  for (const row of subtopicRows) {
    subtopicByName.set(`${row.topic_id}::${normalise(row.title_bn)}`, row);
  }
  const unresolvedSubtopics = new Set<string>();
  const topicByName = new Map<string, TopicRow>();
  for (const row of topicRows) {
    // Keyed per subject: "ভগ্নাংশ" can exist in both math and mental ability.
    const key = `${row.subject_id}::${normalise(row.title_bn)}`;
    topicByName.set(key, row);
    if (row.title_en) topicByName.set(`${row.subject_id}::${normalise(row.title_en)}`, row);
  }

  const unresolvedSubjects = new Set<string>();
  const unresolvedTopics = new Set<string>();
  const planned: Array<{
    row: number;
    date: string;
    kind: "daily" | "weekly_special";
    subjectId: string | null;
    topicId: string | null;
    subtopicId: string | null;
    titleBn: string;
    minutes: number;
    note: string;
    slot: number;
  }> = [];

  for (const row of parsed.valid) {
    const subject = subjectByName.get(normalise(row.subject));
    if (!subject) {
      unresolvedSubjects.add(row.subject);
      continue;
    }
    let topic: TopicRow | undefined;
    if (row.topic) {
      for (const candidate of topicCandidates(row.topic)) {
        topic = topicByName.get(`${subject.id}::${normalise(candidate)}`);
        if (topic) break;
      }
      if (!topic) {
        unresolvedTopics.add(`${subject.title_bn} → ${row.topic}`);
        continue;
      }
    }
    let subtopicId: string | null = null;
    if (row.subtopic) {
      if (!topic) {
        unresolvedSubtopics.add(`${subject.title_bn} → ${row.subtopic} (টপিক ছাড়া)`);
        continue;
      }
      const subtopic = subtopicByName.get(`${topic.id}::${normalise(row.subtopic)}`);
      if (!subtopic) {
        unresolvedSubtopics.add(`${topic.title_bn} → ${row.subtopic}`);
        continue;
      }
      subtopicId = subtopic.id;
    }

    planned.push({
      row: row.row,
      date: row.routineDate!,
      kind: row.kind,
      subjectId: subject.id,
      topicId: topic?.id ?? null,
      subtopicId,
      titleBn: row.topic || subject.title_bn,
      minutes: row.minutes,
      note: row.note,
      slot: row.slot,
    });
  }

  const missingTopics = [...unresolvedTopics];
  const missingSubjects = [...unresolvedSubjects];

  if (body.mode === "dry_run") {
    return NextResponse.json(
      {
        mode: "dry_run",
        total: parsed.total,
        invalidRows: parsed.invalid.slice(0, 25),
        invalidCount: parsed.invalid.length,
        ready: planned.length,
        missingSubjects,
        missingTopics,
        missingSubtopics: [...unresolvedSubtopics],
        dateRange: planned.length
          ? [planned[0].date, planned[planned.length - 1].date]
          : null,
        preview: planned.slice(0, 10).map((row) => ({
          row: row.row,
          date: row.date,
          subject: subjectById.get(row.subjectId!)?.title_bn ?? "",
          topic: row.titleBn,
          subtopic: row.subtopicId ? subtopicRows.find((s) => s.id === row.subtopicId)?.title_bn ?? "" : "",
          minutes: row.minutes,
          note: row.note,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (planned.length === 0) {
    return NextResponse.json(
      {
        error: "কোনো সারি সিলেবাসের সঙ্গে মেলানো যায়নি — আগে বিষয়/টপিক ঠিক করুন।",
        missingSubjects,
        missingTopics,
      },
      { status: 422 },
    );
  }

  // Optionally create the missing topics so the file itself can define the
  // syllabus. Subjects are never auto-created: a new subject changes the
  // public catalogue, which is an editorial decision, not an import detail.
  let createdTopics = 0;
  if (body.createMissingTopics && unresolvedTopics.size > 0) {
    const toCreate: Array<{ subject_id: string; slug: string; title_bn: string; title_en: string }> = [];
    for (const row of parsed.valid) {
      const subject = subjectByName.get(normalise(row.subject));
      if (!subject || !row.topic) continue;
      if (topicByName.has(`${subject.id}::${normalise(row.topic)}`)) continue;
      const slug = slugify(`${subject.title_bn}-${row.topic}`);
      toCreate.push({
        subject_id: subject.id,
        slug,
        title_bn: row.topic,
        title_en: row.topic,
      });
      // Prevent duplicates inside the same file.
      topicByName.set(`${subject.id}::${normalise(row.topic)}`, {
        id: "pending",
        subject_id: subject.id,
        title_bn: row.topic,
        title_en: row.topic,
      });
    }
    if (toCreate.length > 0) {
      const { data: inserted, error } = await supabase.from("topics").insert(toCreate).select("id, subject_id, title_bn");
      if (error) {
        return NextResponse.json({ error: `টপিক তৈরি করা যায়নি: ${error.message}` }, { status: 500 });
      }
      createdTopics = inserted?.length ?? 0;
      // Re-resolve so the insert below uses real ids.
      const { data: fresh } = await supabase
        .from("topics")
        .select("id, subject_id, title_bn, title_en")
        .in("subject_id", subjectIds);
      for (const row of (fresh ?? []) as TopicRow[]) {
        topicByName.set(`${row.subject_id}::${normalise(row.title_bn)}`, row);
      }
    }
  }

  const payload = planned
    .map((row) => {
      const subject = subjectById.get(row.subjectId!);
      const topicId =
        row.topicId ??
        (subject ? topicByName.get(`${subject.id}::${normalise(row.titleBn)}`)?.id ?? null : null);
      const meta = weekMeta(row.date);
      return {
        course_id: body.courseId,
        kind: row.kind,
        routine_date: row.date,
        // Week bookkeeping is what makes a weekly exam possible: the exam is
        // built from the topics of one `week_start`, not from a date range the
        // admin has to remember.
        week_start: meta.weekStart,
        week_index: meta.weekIndex,
        slot_label: slotLabel(row.slot ?? 1, row.note),
        target_bn: row.note || null,
        task_kind: row.kind === "weekly_special" ? "exam" : "study",
        title_bn: row.titleBn,
        title_en: row.titleBn,
        subject_id: row.subjectId,
        topic_id: topicId,
        subtopic_id: row.subtopicId,
        minutes: row.minutes,
        focus_note_bn: row.note || null,
        status: "published" as const,
        created_by: user.id,
      };
    })
    .filter((row) => row.topic_id !== null || row.subject_id !== null);

  if (body.replace) {
    const dates = [...new Set(payload.map((row) => row.routine_date))].sort();
    const { error } = await supabase
      .from("routines")
      .delete()
      .eq("course_id", body.courseId)
      .eq("status", "published")
      .gte("routine_date", dates[0])
      .lte("routine_date", dates[dates.length - 1]);
    if (error) {
      return NextResponse.json({ error: "পুরনো রুটিন মুছতে সমস্যা হয়েছে।" }, { status: 500 });
    }
  }

  const { error } = await supabase.from("routines").insert(payload);
  if (error) {
    return NextResponse.json({ error: `রুটিন সংরক্ষণ করা যায়নি: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    created: payload.length,
    skipped: parsed.valid.length - planned.length,
    createdTopics,
    missingSubjects,
    missingTopics,
    missingSubtopics: [...unresolvedSubtopics],
  });
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `topic-${Date.now().toString(36)}`
  );
}
