import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listRoutines } from "@/lib/queries";
import { dhakaDateKey } from "@/lib/format";
import { RoutinePrintSheet } from "./routine-print-sheet";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "স্টাডি রুটিন — PDF" };

/**
 * Student-facing printable routine (the browser's "Save as PDF" path).
 *
 * Deliberately outside the dashboard shell: no nav, no admin controls, no
 * internal metadata — only the published study schedule, branded and
 * paginated for A4.
 */
export default async function RoutinePrintPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = dhakaDateKey();
  const [courses, routines] = await Promise.all([
    listCourses(),
    listRoutines({ fromDate: today, limit: 200 }),
  ]);

  const courseNames: Record<string, string> = {};
  for (const course of courses) courseNames[course.id] = course.title_bn;

  return (
    <RoutinePrintSheet
      routines={routines.map((routine) => ({
        id: routine.id,
        routine_date: routine.routine_date,
        title_bn: routine.title_bn,
        course_title_bn: courseNames[routine.course_id] ?? "",
        subject_title_bn: routine.subject_title_bn ?? null,
        topic_titles_bn:
          routine.topic_titles_bn && routine.topic_titles_bn.length > 0
            ? routine.topic_titles_bn
            : routine.topic_title_bn
              ? [routine.topic_title_bn]
              : [],
        subtopic_titles_bn:
          routine.subtopic_titles_bn && routine.subtopic_titles_bn.length > 0
            ? routine.subtopic_titles_bn
            : routine.subtopic_title_bn
              ? [routine.subtopic_title_bn]
              : [],
        minutes: routine.minutes,
        task_kind: routine.task_kind ?? "study",
        focus_note_bn: routine.focus_note_bn ?? null,
      }))}
      studentName={user.profile?.full_name_bn || user.profile?.full_name || ""}
      generatedOn={today}
    />
  );
}
