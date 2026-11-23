import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listRoutines, listStudyPlanTopicPairs } from "@/lib/queries";
import { dhakaDateKey } from "@/lib/format";
import { RoutinePrintSheet, type PrintCourse } from "./routine-print-sheet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "স্টাডি রুটিন — PDF" };

/**
 * Student-facing printable routine (the browser's "Save as PDF" path).
 *
 * Deliberately outside the dashboard shell: no nav, no admin controls, no
 * internal metadata — only the published study schedule, compact and
 * paginated for A4. Each course renders as its OWN routine (separate
 * day-blocks, page break between courses) — courses are never mixed.
 *
 * Query params:
 *   ?course=<id>  print one course only
 *   ?range=week   current week only (Dhaka Mon–Sun)
 *   ?range=all    the whole published plan including past days
 */
export default async function RoutinePrintPage({
  searchParams,
}: {
  searchParams?: Promise<{ range?: string; course?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = dhakaDateKey();
  const params = searchParams ? await searchParams : undefined;

  let fromDate: string | undefined = today;
  let toDate: string | undefined;
  if (params?.range === "week") {
    const base = new Date(`${today}T00:00:00Z`);
    const dow = (base.getUTCDay() + 6) % 7; // Monday = 0
    const sunday = new Date(base);
    sunday.setUTCDate(base.getUTCDate() + (6 - dow));
    toDate = sunday.toISOString().slice(0, 10);
  } else if (params?.range === "all") {
    fromDate = undefined;
  }

  const [courses, routines] = await Promise.all([
    listCourses(),
    listRoutines({ courseId: params?.course, fromDate, toDate, limit: 1000 }),
  ]);

  const courseIds = [...new Set(routines.map((r) => r.course_id))];
  const [topicPairs, ...planStartRows] = await Promise.all([
    listStudyPlanTopicPairs(courseIds),
    // Day numbering stays stable even for a mid-plan or weekly print: day 1 is
    // the earliest PUBLISHED date of the course, not the first printed date.
    ...courseIds.map((id) => listRoutines({ courseId: id, limit: 1 })),
  ]);

  const planStart: Record<string, string> = {};
  courseIds.forEach((id, i) => {
    planStart[id] = planStartRows[i]?.[0]?.routine_date ?? routines.find((r) => r.course_id === id)!.routine_date;
  });

  // Topic → subtopics per routine row, association preserved.
  const pairsByRoutine = new Map<string, Map<string, string[]>>();
  for (const pair of topicPairs) {
    if (!pair.routine_id || !pair.topic_title_bn) continue;
    const byTopic = pairsByRoutine.get(pair.routine_id) ?? new Map<string, string[]>();
    const subs = byTopic.get(pair.topic_title_bn) ?? [];
    if (pair.subtopic_title_bn) subs.push(pair.subtopic_title_bn);
    byTopic.set(pair.topic_title_bn, subs);
    pairsByRoutine.set(pair.routine_id, byTopic);
  }

  const courseNames: Record<string, string> = {};
  for (const course of courses) courseNames[course.id] = course.title_bn;

  const printCourses: PrintCourse[] = courseIds.map((courseId) => ({
    id: courseId,
    title_bn: courseNames[courseId] ?? "",
    plan_start: planStart[courseId],
    routines: routines
      .filter((r) => r.course_id === courseId)
      .map((routine) => {
        const assigned = pairsByRoutine.get(routine.id);
        const topics = assigned
          ? [...assigned.entries()].map(([topic, subtopics]) => ({ topic, subtopics }))
          : (routine.topic_titles_bn ?? []).map((topic, i, arr) => ({
              topic,
              // Legacy rows without assignments: attach the row's subtopics to
              // its single topic; with several topics the pairing is unknown.
              subtopics: arr.length === 1 ? (routine.subtopic_titles_bn ?? []) : [],
            }));
        return {
          id: routine.id,
          routine_date: routine.routine_date,
          title_bn: routine.title_bn,
          subject_title_bn: routine.subject_title_bn ?? null,
          minutes: routine.minutes,
          slot_label: routine.slot_label ?? null,
          task_kind: routine.task_kind ?? "study",
          focus_note_bn: routine.focus_note_bn ?? null,
          topics,
        };
      }),
  }));

  return (
    <RoutinePrintSheet
      courses={printCourses}
      studentName={user.profile?.full_name_bn || user.profile?.full_name || ""}
      generatedOn={today}
    />
  );
}
