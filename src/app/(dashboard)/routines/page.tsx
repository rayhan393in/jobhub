import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarDays, Info, Radio, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/dashboard/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { listCourses, listRoutines } from "@/lib/queries";
import { dhakaDateKey, formatDate, formatNumber } from "@/lib/format";

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

      <p className="mb-4 flex items-start gap-1.5 rounded-xl bg-[var(--surface-muted)] px-3.5 py-2.5 text-[0.6875rem] leading-relaxed text-[var(--text-muted)]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--brand)]" aria-hidden />
        নিজের রুটিন তৈরি করার সুবিধা শীঘ্রই আসছে। এখন প্রশাসক প্রকাশিত রুটিন অনুসরণ করুন।
      </p>

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
