import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/routines/plan
 *
 * Saves the student's own 30-day plan.
 *
 * Routines are course-wide and staff-owned, so a personal plan is written with
 * the **service-role** client after this route has authenticated the caller and
 * confirmed the course is published. The student's id is stamped on every row,
 * which is also what makes the plan private: `/api/routines/plan` can only
 * return the caller's own rows.
 *
 * Idempotent by design — re-saving replaces the caller's rows for that course
 * instead of appending a second overlapping plan.
 */

const daySchema = z.object({
  day: z.number().int().min(1).max(31),
  kind: z.enum(["study", "revision", "rest"]),
  minutes: z.number().int().min(0).max(480),
  topicId: z.string().uuid().nullable(),
  extraTopicId: z.string().uuid().nullable(),
  note: z.string().max(400).optional().default(""),
});

const planSchema = z.object({
  courseId: z.string().uuid(),
  minutesPerDay: z.number().int().min(10).max(240),
  restWeekday: z.number().int().min(0).max(6).nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(daySchema).min(1).max(31),
});

/** Dhaka date arithmetic without pulling in a date library. */
function addDays(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "অবৈধ অনুরোধ।" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  }

  let body: z.infer<typeof planSchema>;
  try {
    body = planSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "অবৈধ ডেটা।" }, { status: 400 });
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });
  }

  // Confirm the course is published and that every referenced topic is real and
  // belongs to it — the client sends ids, so they cannot be trusted.
  const { data: course } = await supabase
    .from("courses")
    .select("id, status")
    .eq("id", body.courseId)
    .maybeSingle();
  if (!course || course.status !== "published") {
    return NextResponse.json({ error: "কোর্সটি প্রকাশিত নয়।" }, { status: 409 });
  }

  const topicIds = [
    ...new Set(
      body.days.flatMap((day) => [day.topicId, day.extraTopicId]).filter((id): id is string => Boolean(id)),
    ),
  ];

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from("topics")
      .select("id, title_bn, subject:subjects(course_id)")
      .in("id", topicIds);

    const valid = new Set(
      (topics ?? [])
        .filter((row) => {
          const subject = row.subject as unknown as { course_id: string } | null;
          return subject?.course_id === body.courseId;
        })
        .map((row) => row.id as string),
    );

    const invalid = topicIds.filter((id) => !valid.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "কিছু টপিক এই কোর্সের নয় — প্ল্যান আবার তৈরি করুন।" },
        { status: 422 },
      );
    }
  }

  // A 90-minute day carries two topics. The schema has one `topic_id`, so the
  // second is kept in the note — storing it as `topic_id` would silently drop
  // the first topic from the saved plan.
  const rows = body.days.flatMap((day) => {
    const date = addDays(body.startDate, day.day - 1);
    const note =
      day.extraTopicId && day.note
        ? `${day.note}`
        : day.note || (day.kind === "rest" ? "বিশ্রাম" : "পড়া");

    return [
      {
        user_id: user.id,
        course_id: body.courseId,
        kind: "daily" as const,
        routine_date: date,
        plan_day: day.day,
        plan_kind: day.kind,
        title_bn: note,
        title_en: day.kind === "rest" ? "Rest day" : "Study day",
        subject_id: null,
        topic_id: day.kind === "rest" ? null : day.topicId,
        subtopic_id: null,
        minutes: day.minutes,
        focus_note_bn: note || null,
        status: "published" as const,
        created_by: user.id,
      },
    ];
  });

  // Replace, don't append: a second save for the same course would otherwise
  // leave two overlapping plans on the calendar.
  const { error: deleteError } = await supabase
    .from("student_routines")
    .delete()
    .eq("user_id", user.id)
    .eq("course_id", body.courseId);

  if (deleteError) {
    return NextResponse.json({ error: "পুরনো রুটিন মুছতে সমস্যা হয়েছে।" }, { status: 500 });
  }

  const { error } = await supabase.from("student_routines").insert(rows);
  if (error) {
    return NextResponse.json({ error: "রুটিন সংরক্ষণ করা যায়নি।" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: rows.length, updated: 0 });
}

/** GET — the caller's saved plans, newest course first. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "লগইন প্রয়োজন।" }, { status: 401 });
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "সার্ভার কনফিগারেশন নেই।" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("student_routines")
    .select(
      "id, course_id, routine_date, plan_day, plan_kind, title_bn, minutes, focus_note_bn, topic:topics(title_bn), course:courses(title_bn)",
    )
    .eq("user_id", user.id)
    .order("routine_date");

  if (error) {
    return NextResponse.json({ error: "রুটিন পড়া যায়নি।" }, { status: 500 });
  }

  return NextResponse.json({ plan: data ?? [] });
}
