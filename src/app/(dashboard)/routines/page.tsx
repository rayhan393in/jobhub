import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, FileDown, Plus, Radio, Settings, Upload } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StudyPlanner } from "@/components/routines/study-planner";
import { WeeklyPlanner } from "@/components/routines/weekly-planner";
import { RecommendationsPanel } from "@/components/routines/recommendations-panel";
import { UniversalRoutineSheet, type SheetCourse } from "@/components/routines/universal-routine-sheet";
import { CourseSelector, type CourseOption } from "@/components/routines/course-selector";
import { resolvePriorities } from "@/lib/routine-priorities";
import { resolvePriorityMarks } from "@/lib/routine-marks";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  listCourses,
  listCourseRoutineHistory,
  getActiveExamMarksSettings,
  listMyDoneDates,
  listMyEnrollments,
  listMyStudentRoutines,
  listRoutines,
  listStudyPlanTopicPairs,
  listSubjects,
  listTopicsWithSubtopics,
} from "@/lib/queries";
import { dhakaDateKey, formatDate, formatNumber } from "@/lib/format";
import { dayNumber, topicsForRoutine } from "@/lib/routine-day-lines";
import type { PlanTopic } from "@/lib/study-plan";

/**
 * Build the selector's options from the database.
 *
 * Every published course appears — that is the "no hardcoded course list"
 * requirement — with `hasRoutine` telling the selector whether switching to it
 * would land on real content. Ordering keeps BCS first because it is the flagship
 * plan, then the rest by the course's own sort_order.
 */
function alignCourseOptions(
  courses: { id: string; title_bn: string; title_en: string }[],
  withRoutine: Set<string>,
): CourseOption[] {
  const isBcs = (title: string) => /বিসিএস|bcs/i.test(title);
  return [...courses]
    .sort((a, b) => {
      if (isBcs(a.title_bn) !== isBcs(b.title_bn)) return isBcs(a.title_bn) ? -1 : 1;
      return a.title_bn.localeCompare(b.title_bn, "bn");
    })
    .map((course) => ({
      id: course.id,
      title_bn: course.title_bn,
      title_en: course.title_en,
      hasRoutine: withRoutine.has(course.id),
    }));
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "স্টাডি রুটিন" };

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams?: Promise<{ course?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = dhakaDateKey();
  const params = searchParams ? await searchParams : undefined;
  // Header actions are permission-gated server-side: the check happens here, so
  // an admin control never reaches a student's HTML at all.
  const canManageRoutine = can(user.role, "routine.manage");
  const [courses, routines] = await Promise.all([
    listCourses(),
    listRoutines({ fromDate: today, limit: 1000 }),
  ]);

  // The personal planner needs the real syllabus, and only for courses that have
  // one — most catalogue entries are published before their subjects exist.
  const subjectRows = await Promise.all(courses.map((course) => listSubjects(course.id)));
  const coursesWithSyllabus = courses.filter((_, index) => subjectRows[index].length > 0);

  const topicsByCourse: Record<string, PlanTopic[]> = {};
  await Promise.all(
    coursesWithSyllabus.map(async (course) => {
      const [subjects, topics] = await Promise.all([
        listSubjects(course.id),
        listTopicsWithSubtopics(course.id),
      ]);
      const subjectLabel = new Map(subjects.map((subject) => [subject.id, subject.title_bn]));
      topicsByCourse[course.id] = topics.map((topic) => ({
        id: topic.id,
        subjectId: topic.subject_id,
        subjectLabel: subjectLabel.get(topic.subject_id) ?? "",
        label: topic.title_bn,
      }));
    }),
  );

  const targetCourseId = user.profile?.target_course_id ?? null;
  const initialCourseId =
    (targetCourseId && topicsByCourse[targetCourseId]?.length ? targetCourseId : null) ??
    coursesWithSyllabus[0]?.id ??
    "";

  const myPlan = await listMyStudentRoutines(user.id);

  const courseById = new Map(courses.map((c) => [c.id, c]));

  // Each program keeps its OWN independent routine — the viewer shows one
  // course at a time via the selector bar. BCS always comes first.
  const isBcs = (title: string) => /বিসিএস|bcs/i.test(title);
  const routineCourseIds = [...new Set(routines.map((r) => r.course_id))].sort((a, b) => {
    const ta = courseById.get(a)?.title_bn ?? "";
    const tb = courseById.get(b)?.title_bn ?? "";
    if (isBcs(ta) !== isBcs(tb)) return isBcs(ta) ? -1 : 1;
    return ta.localeCompare(tb, "bn");
  });

  // Same data pipeline as the PDF sheet: টপিক → সাবটপিক pairs come from
  // study_plan_assignments, and day 1 is the earliest PUBLISHED date of the
  // course — so the web view and the PDF always match exactly.
  const [topicPairs, ...planStartRows] = await Promise.all([
    listStudyPlanTopicPairs(routineCourseIds),
    ...routineCourseIds.map((id) => listRoutines({ courseId: id, limit: 1 })),
  ]);
  const planStart: Record<string, string> = {};
  routineCourseIds.forEach((id, i) => {
    planStart[id] =
      planStartRows[i]?.[0]?.routine_date ?? routines.find((r) => r.course_id === id)!.routine_date;
  });

  const pairsByRoutine = new Map<string, Map<string, string[]>>();
  for (const pair of topicPairs) {
    if (!pair.routine_id || !pair.topic_title_bn) continue;
    const byTopic = pairsByRoutine.get(pair.routine_id) ?? new Map<string, string[]>();
    const subs = byTopic.get(pair.topic_title_bn) ?? [];
    if (pair.subtopic_title_bn) subs.push(pair.subtopic_title_bn);
    byTopic.set(pair.topic_title_bn, subs);
    pairsByRoutine.set(pair.routine_id, byTopic);
  }

  // The 90-day sheet groups rows by their own slot label, so it needs the raw
  // rows rather than the merged day lines: one row per study slot keeps
  // P1 / P2 / P3 in their own columns.
  const sheetCourses: SheetCourse[] = routineCourseIds.map((courseId) => {
    const courseRoutines = routines.filter((r) => r.course_id === courseId);
    const dates = [...new Set(courseRoutines.map((r) => r.routine_date))].sort();
    const days = dates
      .map((date) => ({
        date,
        day_number: dayNumber(date, planStart[courseId]),
        rows: courseRoutines
          .filter((r) => r.routine_date === date)
          .map((routine) => ({
            id: routine.id,
            routine_date: routine.routine_date,
            title_bn: routine.title_bn,
            subject_title_bn: routine.subject_title_bn ?? null,
            minutes: routine.minutes,
            slot_label: routine.slot_label ?? null,
            task_kind: routine.task_kind ?? "study",
            focus_note_bn: routine.focus_note_bn ?? null,
            topics: topicsForRoutine(
              pairsByRoutine.get(routine.id),
              routine.topic_titles_bn,
              routine.subtopic_titles_bn,
            ),
          })),
      }))
      .filter((day) => day.rows.length > 0);
    return {
      id: courseId,
      title_bn: courseById.get(courseId)?.title_bn ?? "কোর্স",
      plan_start: planStart[courseId],
      start_date: planStart[courseId] ?? dates[0] ?? null,
      end_date: dates[dates.length - 1] ?? null,
      status: courseRoutines.some((r) => r.status === "published") ? "active" : "draft",
      days,
    };
  });

  // ---- which course is on screen -------------------------------------------
  // ?course= wins, then the student's target course, then BCS, then whatever
  // has a routine. Never a hardcoded single course.
  const requested = params?.course ?? null;
  const selectedSheet =
    sheetCourses.find((course) => course.id === requested) ??
    sheetCourses.find((course) => course.id === targetCourseId) ??
    sheetCourses.find((course) => isBcs(course.title_bn)) ??
    sheetCourses[0] ??
    null;

  const selectedCourse = selectedSheet ? courseById.get(selectedSheet.id) ?? null : null;

  // Selector options come straight from the database. A course with no routine
  // is listed but disabled, so a student sees it exists without being dropped
  // onto an empty page.
  const courseOptions = alignCourseOptions(courses, new Set(routineCourseIds));
  const enrolledIds = new Set((await listMyEnrollments(user.id)).map((row) => row.course_id));

  // Progress comes from the student's own ticks, so the tracker shows what was
  // actually completed rather than assuming the plan is done.
  const selectedProgress = selectedSheet ? await listMyDoneDates(user.id, selectedSheet.id) : [];

  // Priorities: admin config first, then the routine's own slot labels, then BCS.
  const slotLabels = selectedSheet
    ? selectedSheet.days.flatMap((day) => day.rows.map((row) => row.slot_label))
    : [];
  const { priorities } = resolvePriorities(selectedCourse?.metadata, slotLabels);

  // Marks: the live exam config, else courses.exam_config, else BCS's verified
  // split. Any other course with no configuration hides the bar.
  const marks = selectedSheet
    ? resolvePriorityMarks({
        courseId: selectedSheet.id,
        examSettings: await getActiveExamMarksSettings(selectedSheet.id),
        examConfig: selectedCourse?.exam_config,
      })
    : { items: [], source: "none" as const };

  // This course's earlier routines, for the history block.
  const history = await listCourseRoutineHistory(selectedSheet?.id ?? null, selectedSheet?.plan_start ?? null);
  const historyWithProgress = await Promise.all(
    history.map(async (entry) => ({
      id: entry.id,
      title_bn: entry.title_bn,
      start: entry.start,
      end: entry.end,
      done: (await listMyDoneDates(user.id, entry.course_id)).filter(
        (date) => date >= entry.start && date <= entry.end,
      ).length,
      total: entry.total,
    })),
  );

  const printHref = selectedSheet
    ? `/routines/print?course=${selectedSheet.id}&range=all`
    : "/routines/print";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        eyebrow="স্টাডি রুটিন"
        title="স্টাডি রুটিন"
        description="নির্বাচিত কোর্সের জন্য দৈনিক অধ্যয়ন পরিকল্পনা, বিষয়, টপিক ও পরীক্ষা।"
        action={
          <div className="flex flex-wrap gap-2">
            {/* Admin-only controls. A student must never see these, so they are
                gated on the same permission the admin routes themselves use. */}
            {canManageRoutine ? (
              <>
                <ButtonLink href="/admin/routines" variant="primary" size="md">
                  <Plus className="size-3.5" aria-hidden />
                  রুটিন তৈরি
                </ButtonLink>
                <ButtonLink href="/admin/routines" variant="secondary" size="md">
                  <Settings className="size-3.5" aria-hidden />
                  রুটিন ব্যবস্থাপনা
                </ButtonLink>
                <ButtonLink href="/admin/routines?tab=csv" variant="secondary" size="md">
                  <Upload className="size-3.5" aria-hidden />
                  CSV আপলোড
                </ButtonLink>
              </>
            ) : null}
            <ButtonLink
              href={printHref}
              variant="secondary"
              size="md"
              target="_blank"
            >
              <FileDown className="size-3.5" aria-hidden />
              PDF ডাউনলোড
            </ButtonLink>
          </div>
        }
      />

      {/* ── the universal routine view ──────────────────────────────────── */}
      <section aria-labelledby="routine-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="routine-heading"
              className="text-[1.0625rem] font-bold tracking-[-0.02em] text-[var(--text)]"
            >
              {selectedSheet ? selectedSheet.title_bn : "কোর্স রুটিন"}
            </h2>
            <p className="text-[0.75rem] text-[var(--text-muted)]">
              নির্বাচিত কোর্সের জন্য দৈনিক অধ্যয়ন পরিকল্পনা, বিষয়, টপিক ও পরীক্ষা।
            </p>
          </div>
        </div>

        {/* searchable, database-driven course selector */}
        <div className="max-w-md">
          <CourseSelector
            courses={courseOptions.map((option) => ({
              ...option,
              enrolled: enrolledIds.has(option.id),
            }))}
            value={selectedSheet?.id ?? ""}
            onChange={(courseId) => {
              // Re-run the page with the chosen course; all per-course data
              // (routine, marks, priorities, progress, history) reloads server
              // side so two courses can never share state on screen.
              const url = new URL(window.location.href);
              url.searchParams.set("course", courseId);
              window.location.assign(url.toString());
            }}
          />
        </div>

        {selectedSheet ? (
          <UniversalRoutineSheet
            course={selectedSheet}
            priorities={priorities}
            marks={marks}
            initialCompletedDates={selectedProgress}
            today={today}
            history={historyWithProgress}
            printHref={printHref}
          />
        ) : (
          <EmptyState
            icon={<CalendarDays className="size-5" />}
            title="এই কোর্সের জন্য বর্তমানে কোনো সক্রিয় রুটিন নেই।"
            description="প্রশাসক রুটিন প্রকাশ করলে এখানে তারিখ অনুযায়ী দেখা যাবে। কৃত্রিম কোনো রুটিন দেখানো হয় না।"
            action={
              <ButtonLink href="/exams" variant="secondary" size="sm">
                <Radio className="size-3.5" aria-hidden />
                পরীক্ষা কেন্দ্র দেখুন
              </ButtonLink>
            }
          />
        )}
      </section>

      {/* ── personal study tools ─────────────────────────────────────────
          The published course routine is the primary content, so these
          student-authored planners sit below it rather than pushing the plan
          off the first screen. */}
      <div className="mt-8 border-t border-[var(--border)] pt-6">
      <section className="mb-6" aria-labelledby="weekly-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="weekly-heading" className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
            সপ্তাহভিত্তিক রুটিন ও পরীক্ষা
          </h2>
          <Badge tone="brand">২–৩ বিষয় / দিন</Badge>
        </div>
        {coursesWithSyllabus.length === 0 ? (
          <p className="jh-card p-4 text-[0.8125rem] text-[var(--text-muted)]">
            যে কোর্সে বিষয় ও টপিক আছে, তার জন্য সাপ্তাহিক রুটিন তৈরি হবে। এখনো কোনো কোর্সে সিলেবাস যোগ হয়নি।
          </p>
        ) : (
          <>
            <WeeklyPlanner
              courses={coursesWithSyllabus.map((course) => ({ id: course.id, title_bn: course.title_bn }))}
              initialCourseId={initialCourseId || coursesWithSyllabus[0].id}
              today={today}
            />

            <div className="mt-4">
              <RecommendationsPanel initialCourseId={initialCourseId || coursesWithSyllabus[0].id} />
            </div>
          </>
        )}
      </section>

      <section className="mb-6" aria-labelledby="planner-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="planner-heading" className="text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
            আমার ৩০ দিনের রুটিন
          </h2>
          <Badge tone={myPlan.length > 0 ? "success" : "neutral"} dot={myPlan.length > 0}>
            {myPlan.length > 0 ? `${formatNumber(myPlan.length)} দিন সেভ করা আছে` : "এখনো সেভ করা হয়নি"}
          </Badge>
        </div>

        {courses.length === 0 ? (
          <p className="jh-card p-4 text-[0.8125rem] text-[var(--text-muted)]">
            কোর্স প্রকাশিত হলে এখানে ৩০ দিনের প্ল্যান তৈরি করা যাবে।
          </p>
        ) : (
          <StudyPlanner
            courses={courses.map((course) => ({ id: course.id, slug: course.slug, title_bn: course.title_bn }))}
            topicsByCourse={topicsByCourse}
            initialCourseId={initialCourseId}
            today={today}
            hasTargetCourse={Boolean(targetCourseId)}
          />
        )}
      </section>

      {myPlan.length > 0 ? (
        <section className="mb-6" aria-labelledby="saved-heading">
          <h2 id="saved-heading" className="mb-3 text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">
            সেভ করা প্ল্যান
          </h2>
          <div className="jh-card overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {myPlan.slice(0, 30).map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[0.625rem] font-bold text-[var(--brand)]">
                    {formatNumber(row.plan_day)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-semibold text-[var(--text)]">
                      {row.topic_title_bn ?? (row.plan_kind === "rest" ? "বিশ্রাম" : "পুনরাবৃত্তি")}
                    </p>
                    <p className="truncate text-[0.625rem] text-[var(--text-subtle)]">
                      {formatDate(row.routine_date, "bn", { weekday: "short", day: "numeric", month: "short" })}
                      {row.course_title_bn ? ` · ${row.course_title_bn}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.6875rem] font-semibold text-[var(--text-muted)]">
                    {formatNumber(row.minutes)} মিনিট
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      </div>
    </div>
  );
}
