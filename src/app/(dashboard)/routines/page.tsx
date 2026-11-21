import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Radio, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StudyPlanner } from "@/components/routines/study-planner";
import { WeeklyPlanner } from "@/components/routines/weekly-planner";
import { RecommendationsPanel } from "@/components/routines/recommendations-panel";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listMyStudentRoutines, listRoutines, listSubjects, listTopicsWithSubtopics } from "@/lib/queries";
import { dhakaDateKey, formatDate, formatNumber } from "@/lib/format";
import type { PlanTopic } from "@/lib/study-plan";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "স্টাডি রুটিন" };

export default async function RoutinesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const today = dhakaDateKey();
  const [courses, routines] = await Promise.all([
    listCourses(),
    listRoutines({ fromDate: today, limit: 60 }),
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
  const byDate = new Map<string, typeof routines>();
  for (const routine of routines) {
    const list = byDate.get(routine.routine_date) ?? [];
    list.push(routine);
    byDate.set(routine.routine_date, list);
  }
  const dates = [...byDate.keys()].sort();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        eyebrow="স্টাডি রুটিন"
        title="প্রতিদিনের প্রস্তুতি পরিকল্পনা"
        description="প্রশাসক প্রকাশিত রুটিন এখানে দেখা যায়। রুটিন সংরক্ষণ করলেই কোনো পরীক্ষা প্রকাশ পায় না, আবার পরীক্ষা প্রকাশ করলেই রুটিন তৈরি হয় না।"
        action={
          <ButtonLink href="/practice" variant="secondary" size="md">
            <Sparkles className="size-3.5" aria-hidden />
            প্র্যাকটিস
          </ButtonLink>
        }
      />

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

      <h2 className="mb-3 text-[1rem] font-bold tracking-[-0.02em] text-[var(--text)]">প্রশাসকের দেওয়া রুটিন</h2>

      {dates.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-5" />}
          title="এখনো কোনো প্রকাশিত রুটিন নেই"
          description="প্রশাসক রুটিন তৈরি করে প্রকাশ করলে এখানে তারিখ অনুযায়ী দেখা যাবে। কৃত্রিম কোনো রুটিন দেখানো হয় না।"
          action={
            <ButtonLink href="/exams" variant="secondary" size="sm">
              <Radio className="size-3.5" aria-hidden />
              পরীক্ষা কেন্দ্র দেখুন
            </ButtonLink>
          }
        />
      ) : (
        <div className="space-y-3">
          {dates.map((date) => {
            const items = byDate.get(date) ?? [];
            const isToday = date === today;
            return (
              <section key={date} className="jh-card overflow-hidden">
                <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5">
                  <h2 className="text-[0.8125rem] font-semibold text-[var(--text)]">
                    {formatDate(`${date}T12:00:00`, "bn", { weekday: "long", day: "numeric", month: "long" })}
                  </h2>
                  <div className="flex items-center gap-1.5">
                    {isToday ? <Badge tone="brand">আজ</Badge> : null}
                    <span className="text-[0.625rem] text-[var(--text-subtle)]">
                      {formatNumber(items.reduce((sum, i) => sum + i.minutes, 0))} মিনিট
                    </span>
                  </div>
                </header>
                <ul className="divide-y divide-[var(--border)]">
                  {items.map((routine) => (
                    <li key={routine.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[0.625rem] font-bold text-[var(--brand)]">
                        {formatNumber(routine.minutes)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[0.8125rem] font-semibold text-[var(--text)]">
                          {routine.title_bn || routine.subject_title_bn || "পড়ার পরিকল্পনা"}
                        </p>
                        <p className="text-[0.6875rem] text-[var(--text-subtle)]">
                          {courseById.get(routine.course_id)?.title_bn ?? ""}
                          {routine.topic_title_bn ? ` · ${routine.topic_title_bn}` : ""}
                          {routine.kind === "weekly_special" ? " · সাপ্তাহিক" : ""}
                        </p>
                        {routine.focus_note_bn ? (
                          <p className="mt-1 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
                            {routine.focus_note_bn}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
